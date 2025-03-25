"""
Logger module for MacOS Process Monitor.

This module is responsible for logging process data that exceeds thresholds,
maintaining log files, and handling log rotation.
"""

import os
import logging
import datetime
import json
from logging.handlers import RotatingFileHandler
from typing import Dict, List, Any, Optional


class ProcessLogger:
    """
    Logs processes that exceed resource thresholds.
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialize the process logger.
        
        Args:
            config: Optional configuration dictionary with logger settings.
                   If None, default values will be used.
        """
        self.config = config or {}
        self.logging_config = self.config.get('logging', {})
        
        # Configure logging
        self._setup_logging()
        
    def _setup_logging(self):
        """
        Set up the logging configuration.
        """
        # Get log directory from config or use default
        log_dir = self.logging_config.get('directory', os.path.expanduser('~/.procmon/logs'))
        os.makedirs(log_dir, exist_ok=True)
        
        # Get filename format from config or use default
        filename_format = self.logging_config.get('filename', 'procmon-%Y-%m-%d.log')
        filename = datetime.datetime.now().strftime(filename_format)
        log_path = os.path.join(log_dir, filename)
        
        # Get max size and backup count from config or use defaults
        max_size = self.logging_config.get('max_size', 10485760)  # 10 MB default
        backup_count = self.logging_config.get('backup_count', 5)
        
        # Get log level from config or use default
        log_level_name = self.logging_config.get('level', 'INFO')
        log_level = getattr(logging, log_level_name.upper(), logging.INFO)
        
        # Create logger
        self.logger = logging.getLogger('procmon')
        self.logger.setLevel(log_level)
        
        # Remove any existing handlers (in case setup_logging is called multiple times)
        for handler in self.logger.handlers[:]:
            self.logger.removeHandler(handler)
        
        # Create handler with rotation
        handler = RotatingFileHandler(
            log_path, maxBytes=max_size, backupCount=backup_count
        )
        
        # Create formatter
        formatter = logging.Formatter(
            '%(asctime)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        handler.setFormatter(formatter)
        
        # Add handler to logger
        self.logger.addHandler(handler)
        
        # Optionally add console handler
        if self.logging_config.get('console', False):
            console_handler = logging.StreamHandler()
            console_handler.setFormatter(formatter)
            self.logger.addHandler(console_handler)
        
        self.logger.info("ProcessLogger initialized")
    
    def log_processes(self, processes: List[Dict[str, Any]], system_info: Dict[str, Any] = None):
        """
        Log processes that have exceeded resource thresholds.
        
        Args:
            processes: List of processes that have exceeded thresholds.
            system_info: Optional system information to include in the log.
        """
        if not processes:
            return
        
        # Log system information if provided
        if system_info:
            self.logger.info(f"System: CPU: {system_info['cpu']['percent']}%, "
                             f"Memory: {system_info['memory']['virtual']['percent']}%")
        
        # Log each process that exceeds thresholds
        for process in processes:
            self._log_process(process)
    
    def _log_process(self, process: Dict[str, Any]):
        """
        Log a single process that has exceeded resource thresholds.
        
        Args:
            process: Process information dictionary.
        """
        threshold_info = process.get('threshold_info', {})
        
        # Get only the important data for the log
        log_data = {
            'timestamp': datetime.datetime.now().isoformat(),
            'pid': process.get('pid', 'Unknown'),
            'name': process.get('name', 'Unknown'),
            'username': process.get('username', 'Unknown'),
            'cpu_percent': process.get('cpu_percent', 0),
            'memory_percent': process.get('memory_percent', 0),
            'rss': process.get('rss', 0),
            'vms': process.get('vms', 0),
            'thresholds_exceeded': {
                'cpu': threshold_info.get('cpu', False),
                'memory': threshold_info.get('memory', False),
                'duration': threshold_info.get('duration', 0)
            }
        }
        
        # Include command line if configured to do so
        if self.logging_config.get('include_cmdline', True):
            log_data['cmdline'] = process.get('cmdline', '')
        
        # Log the data
        message = (
            f"Process {log_data['name']} (PID: {log_data['pid']}) exceeded thresholds - "
            f"CPU: {log_data['cpu_percent']:.1f}%, "
            f"Memory: {log_data['memory_percent']:.1f}% "
            f"({log_data['rss'] / (1024*1024):.1f} MB)"
        )
        
        self.logger.warning(message)
        
        # Log detailed data as JSON if configured to do so
        if self.logging_config.get('detailed_json', False):
            self.logger.info(f"Details: {json.dumps(log_data)}")
    
    def get_recent_logs(self, count: int = 10) -> List[str]:
        """
        Get the most recent log entries.
        
        Args:
            count: Maximum number of log entries to return.
            
        Returns:
            List of the most recent log entries as strings.
        """
        log_dir = self.logging_config.get('directory', os.path.expanduser('~/.procmon/logs'))
        filename_format = self.logging_config.get('filename', 'procmon-%Y-%m-%d.log')
        filename = datetime.datetime.now().strftime(filename_format)
        log_path = os.path.join(log_dir, filename)
        
        if not os.path.exists(log_path):
            return []
        
        try:
            with open(log_path, 'r') as f:
                lines = f.readlines()
                return lines[-count:] if len(lines) > count else lines
        except Exception as e:
            self.logger.error(f"Error reading recent logs: {str(e)}")
            return []
