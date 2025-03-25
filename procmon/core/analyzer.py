"""
Threshold analyzer for MacOS Process Monitor.

This module is responsible for analyzing process data and identifying processes
that exceed configured resource thresholds.
"""

from typing import Dict, List, Any, Optional, Tuple
import time


class ThresholdAnalyzer:
    """
    Analyzes process data against configured thresholds.
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialize the threshold analyzer.
        
        Args:
            config: Optional configuration dictionary with threshold settings.
                   If None, default values will be used.
        """
        self.config = config or {}
        self.thresholds = self.config.get('thresholds', {})
        
        # Default thresholds if not specified in config
        self.cpu_threshold = self.thresholds.get('cpu', 80.0)
        self.memory_threshold = self.thresholds.get('memory', 15.0)
        self.duration_threshold = self.thresholds.get('duration', 30)
        
        # Track processes that have exceeded thresholds and when they started
        self.exceeded_processes = {}
        self.last_cleanup = time.time()
    
    def analyze(self, processes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Analyze process data and identify processes exceeding thresholds.
        
        Args:
            processes: List of process dictionaries from the collector.
            
        Returns:
            List of processes that exceed thresholds and have done so for
            the required duration.
        """
        current_time = time.time()
        result = []
        current_pids = set()
        
        # Cleanup old processes occasionally
        if current_time - self.last_cleanup > 60:
            self._cleanup_old_processes()
            self.last_cleanup = current_time
        
        for process in processes:
            pid = process['pid']
            current_pids.add(pid)
            
            # Check if process exceeds any threshold
            exceeds_cpu = process.get('cpu_percent', 0) > self.cpu_threshold
            exceeds_memory = process.get('memory_percent', 0) > self.memory_threshold
            
            if exceeds_cpu or exceeds_memory:
                # If this is the first time seeing this process exceed thresholds
                if pid not in self.exceeded_processes:
                    self.exceeded_processes[pid] = {
                        'start_time': current_time,
                        'process_name': process.get('name', 'Unknown'),
                        'cpu': exceeds_cpu,
                        'memory': exceeds_memory
                    }
                else:
                    # Update which thresholds are exceeded
                    self.exceeded_processes[pid]['cpu'] = exceeds_cpu
                    self.exceeded_processes[pid]['memory'] = exceeds_memory
                
                # Check if it has exceeded thresholds for the required duration
                if (current_time - self.exceeded_processes[pid]['start_time'] >=
                        self.duration_threshold):
                    # Add information about which thresholds are exceeded
                    process['threshold_info'] = {
                        'cpu': exceeds_cpu,
                        'memory': exceeds_memory,
                        'duration': current_time - self.exceeded_processes[pid]['start_time']
                    }
                    result.append(process)
            elif pid in self.exceeded_processes:
                # No longer exceeding thresholds, remove from tracking
                del self.exceeded_processes[pid]
        
        return result
    
    def _cleanup_old_processes(self):
        """
        Clean up the exceeded_processes dictionary by removing entries
        for processes that no longer exist or haven't been seen recently.
        """
        current_time = time.time()
        to_remove = []
        
        for pid, info in self.exceeded_processes.items():
            # If tracking for more than 10 minutes, assume process is gone
            if current_time - info['start_time'] > 600:
                to_remove.append(pid)
        
        for pid in to_remove:
            del self.exceeded_processes[pid]
    
    def get_threshold_stats(self) -> Dict[str, Any]:
        """
        Get statistics about the current threshold state.
        
        Returns:
            Dictionary with threshold statistics.
        """
        return {
            'thresholds': {
                'cpu': self.cpu_threshold,
                'memory': self.memory_threshold,
                'duration': self.duration_threshold
            },
            'processes_being_monitored': len(self.exceeded_processes),
            'processes_exceeding_duration': sum(
                1 for pid, info in self.exceeded_processes.items()
                if time.time() - info['start_time'] >= self.duration_threshold
            )
        }
