import asyncio
from typing import Optional

debug_manager = None

def set_debug_manager(manager):
    global debug_manager
    debug_manager = manager

def debug_print(message: str, level: str = "info"):
    """Print message and broadcast to WebSocket debug panel"""
    print(message)
    
    # Broadcast to WebSocket if manager is available
    if debug_manager and debug_manager.active_connections:
        try:
            # Try to get current event loop
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # Schedule the broadcast as a task
                asyncio.create_task(debug_manager.broadcast_debug(message, level))
            else:
                # If no running loop, just print
                pass
        except Exception as e:
            # If there's any error with WebSocket broadcasting, just continue
            pass 