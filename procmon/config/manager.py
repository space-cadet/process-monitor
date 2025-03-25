"""
Configuration manager for MacOS Process Monitor.

This module is responsible for loading, parsing, and validating configuration settings.
"""

import os
import yaml
from pathlib import Path
from typing import Dict, Any, Optional


class ConfigManager:
    """
    Manages configuration for the process monitor.
    """
    
    def __init__(self, config_path: Optional[str] = None):
        """
        Initialize the configuration manager.
        
        Args:
            config_path: Optional path to a user configuration file.
                         If None, only default configuration is used.
        """
        self.default_config_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            'config', 'default_config.yaml'
        )
        self.user_config_path = config_path
        self.config = self._load_config()
    
    def _load_config(self) -> Dict[str, Any]:
        """
        Load and merge configuration from default and user files.
        
        Returns:
            Merged configuration dictionary.
        """
        # Load default configuration
        default_config = self._load_yaml(self.default_config_path)
        
        # Load user configuration if provided
        user_config = {}
        if self.user_config_path and os.path.exists(self.user_config_path):
            user_config = self._load_yaml(self.user_config_path)
        
        # Merge configurations, with user config taking precedence
        merged_config = self._merge_configs(default_config, user_config)
        
        # Process and validate the configuration
        self._process_config(merged_config)
        
        return merged_config
    
    def _load_yaml(self, file_path: str) -> Dict[str, Any]:
        """
        Load YAML configuration from file.
        
        Args:
            file_path: Path to YAML configuration file.
            
        Returns:
            Configuration dictionary, or empty dict if file not found or invalid.
        """
        try:
            with open(file_path, 'r') as f:
                config = yaml.safe_load(f)
                return config if config else {}
        except Exception as e:
            print(f"Error loading configuration from {file_path}: {e}")
            return {}
    
    def _merge_configs(self, default_config: Dict[str, Any], user_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Recursively merge default and user configurations.
        
        Args:
            default_config: Default configuration dictionary.
            user_config: User configuration dictionary.
            
        Returns:
            Merged configuration dictionary.
        """
        merged = default_config.copy()
        
        for key, value in user_config.items():
            # If both dicts have the same key and both values are dicts, merge them
            if (key in merged and isinstance(merged[key], dict) 
                    and isinstance(value, dict)):
                merged[key] = self._merge_configs(merged[key], value)
            else:
                # Otherwise, user config overrides default
                merged[key] = value
                
        return merged
    
    def _process_config(self, config: Dict[str, Any]):
        """
        Process and validate configuration values.
        
        Args:
            config: Configuration dictionary to process.
        """
        # Expand user home directory in log directory path
        if 'logging' in config and 'directory' in config['logging']:
            config['logging']['directory'] = os.path.expanduser(
                config['logging']['directory']
            )
            
            # Ensure log directory exists
            log_dir = Path(config['logging']['directory'])
            log_dir.mkdir(parents=True, exist_ok=True)
        
        # Validate threshold values
        if 'thresholds' in config:
            thresholds = config['thresholds']
            
            # Ensure CPU threshold is between 0 and 100
            if 'cpu' in thresholds:
                thresholds['cpu'] = max(0.0, min(100.0, float(thresholds['cpu'])))
            
            # Ensure memory threshold is between 0 and 100
            if 'memory' in thresholds:
                thresholds['memory'] = max(0.0, min(100.0, float(thresholds['memory'])))
            
            # Ensure duration is positive
            if 'duration' in thresholds:
                thresholds['duration'] = max(1, int(thresholds['duration']))
        
        # Validate monitoring interval
        if 'monitoring' in config and 'interval' in config['monitoring']:
            config['monitoring']['interval'] = max(1, int(config['monitoring']['interval']))
    
    def get(self, *keys, default=None) -> Any:
        """
        Get a configuration value by key path.
        
        Args:
            *keys: Sequence of keys to traverse the configuration.
            default: Value to return if the key path doesn't exist.
            
        Returns:
            The configuration value, or default if not found.
        """
        current = self.config
        for key in keys:
            if isinstance(current, dict) and key in current:
                current = current[key]
            else:
                return default
        return current
    
    def get_thresholds(self) -> Dict[str, Any]:
        """
        Get the threshold configuration.
        
        Returns:
            Dictionary containing threshold settings.
        """
        return self.get('thresholds', {})
    
    def get_logging_config(self) -> Dict[str, Any]:
        """
        Get the logging configuration.
        
        Returns:
            Dictionary containing logging settings.
        """
        return self.get('logging', {})
    
    def get_processes_config(self) -> Dict[str, Any]:
        """
        Get the processes configuration.
        
        Returns:
            Dictionary containing process filter settings.
        """
        return self.get('processes', {})
    
    def get_monitoring_interval(self) -> int:
        """
        Get the monitoring interval in seconds.
        
        Returns:
            Monitoring interval in seconds.
        """
        return self.get('monitoring', 'interval', default=10)
    
    def save_user_config(self, config: Dict[str, Any], path: Optional[str] = None) -> bool:
        """
        Save a user configuration to a file.
        
        Args:
            config: Configuration dictionary to save.
            path: Path to save the configuration to. If None, uses the current user_config_path.
            
        Returns:
            True if the configuration was saved successfully, False otherwise.
        """
        save_path = path or self.user_config_path
        if not save_path:
            return False
        
        try:
            # Ensure the directory exists
            os.makedirs(os.path.dirname(save_path), exist_ok=True)
            
            # Save the configuration
            with open(save_path, 'w') as f:
                yaml.dump(config, f, default_flow_style=False)
            return True
        except Exception as e:
            print(f"Error saving configuration to {save_path}: {e}")
            return False
