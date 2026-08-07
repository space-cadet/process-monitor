#!/usr/bin/env python3
"""Daemon starter for process-monitor services. Detaches properly so processes survive."""
import os, sys, subprocess, time

def start_detached(cmd, cwd, log_out, log_err):
    # Fork once
    pid = os.fork()
    if pid > 0:
        return pid
    # Child: create new session
    os.setsid()
    # Fork again to prevent acquiring controlling terminal
    pid = os.fork()
    if pid > 0:
        os._exit(0)
    # Grandchild: redirect stdio and exec
    os.chdir(cwd)
    os.umask(0)
    with open(os.devnull, 'r') as devnull:
        os.dup2(devnull.fileno(), sys.stdin.fileno())
    with open(log_out, 'a') as out, open(log_err, 'a') as err:
        os.dup2(out.fileno(), sys.stdout.fileno())
        os.dup2(err.fileno(), sys.stderr.fileno())
    subprocess.Popen(cmd, shell=True)
    os._exit(0)

base = "/Users/sage/.openclaw/workspace/code/process-monitor"

# Start monitor
start_detached(
    "bash run.sh",
    base,
    f"{base}/logs/monitor.log",
    f"{base}/logs/monitor-error.log"
)

# Start dashboard
start_detached(
    "bash start-dashboard.sh",
    base,
    f"{base}/logs/dashboard.log",
    f"{base}/logs/dashboard-error.log"
)

print("Services started")
