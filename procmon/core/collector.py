"""
Process data collector for MacOS Process Monitor.

This module is responsible for collecting process information from the operating system,
including CPU usage, memory usage, and other process metrics.
"""

import time
import psutil
from typing import Dict, List, Any, Optional

class ProcessCollector:
    """
    Collects process information from the operating system.
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialize the process collector.
        
        Args:
            config: Optional configuration dictionary with collector settings.
                   If None, default values will be used.
        """
        self.config = config or {}
        self.include_system = self.config.get('include_system', True)
        self.ignore_list = self.config.get('ignore', [])
        self.always_monitor = self.config.get('always_monitor', [])
        
    def get_processes(self) -> List[Dict[str, Any]]:
        """
        Get a list of all running processes with their resource usage.
        
        Returns:
            A list of dictionaries containing process information.
        """
        processes = []
        
        for proc in psutil.process_iter(['pid', 'name', 'username', 'memory_percent', 'cpu_percent']):
            try:
                # Get process info as dictionary
                proc_info = proc.info
                
                # Skip if it's in the ignore list (unless it's in always_monitor)
                if (proc_info['name'] in self.ignore_list and 
                    proc_info['name'] not in self.always_monitor):
                    continue
                
                # Add additional information
                proc_info['cpu_percent'] = proc.cpu_percent(interval=0.1)
                proc_info['memory_percent'] = proc.memory_percent()
                
                # Get memory details
                memory_info = proc.memory_info()
                proc_info['rss'] = memory_info.rss  # Resident Set Size
                proc_info['vms'] = memory_info.vms  # Virtual Memory Size
                
                # Get command line if available
                try:
                    proc_info['cmdline'] = ' '.join(proc.cmdline())
                except (psutil.AccessDenied, psutil.ZombieProcess):
                    proc_info['cmdline'] = 'Access Denied'
                
                # Add creation time
                proc_info['create_time'] = proc.create_time()
                
                # Add status
                proc_info['status'] = proc.status()
                
                processes.append(proc_info)
                
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                pass
        
        return processes
    
    def get_system_info(self) -> Dict[str, Any]:
        """
        Get system-wide resource usage information.
        
        Returns:
            A dictionary containing system resource information.
        """
        system_info = {
            'timestamp': time.time(),
            'cpu': {
                'percent': psutil.cpu_percent(interval=0.1),
                'count': {
                    'physical': psutil.cpu_count(logical=False),
                    'logical': psutil.cpu_count(logical=True)
                },
                'times': dict(psutil.cpu_times()._asdict())
            },
            'memory': {
                'virtual': dict(psutil.virtual_memory()._asdict()),
                'swap': dict(psutil.swap_memory()._asdict())
            },
            'disk': {
                'usage': dict(psutil.disk_usage('/')._asdict()),
                'io': dict(psutil.disk_io_counters()._asdict()) if psutil.disk_io_counters() else {}
            }
        }
        
        return system_info
