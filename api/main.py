from fastapi import FastAPI, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
import os
import json
import asyncio
from contextlib import asynccontextmanager
from typing import Set


from routes.mission_planning import router as mission_planning_router
from debug_utils import set_debug_manager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# WebSocket connection manager for debug panel
class DebugConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"Debug WebSocket connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        logger.info(f"Debug WebSocket disconnected. Total connections: {len(self.active_connections)}")

    async def broadcast_debug(self, message: str, level: str = "info"):
        if self.active_connections:
            debug_data = {
                "timestamp": str(asyncio.get_event_loop().time()),
                "level": level,
                "message": message
            }
            message_json = json.dumps(debug_data)
            disconnected = set()
            
            for connection in self.active_connections:
                try:
                    await connection.send_text(message_json)
                except Exception as e:
                    logger.warning(f"Failed to send debug message to WebSocket: {e}")
                    disconnected.add(connection)
            
            # Remove disconnected connections
            for conn in disconnected:
                self.active_connections.discard(conn)

debug_manager = DebugConnectionManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events"""
    # Startup
    logger.info("Starting Mission Planning API...")
    set_debug_manager(debug_manager)
    yield
    # Shutdown
    logger.info("Shutting down Mission Planning API...")


# Create FastAPI app
app = FastAPI(
    title="Mission Planning API",
    description="API for AI-powered drone mission planning",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],  # Frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global exception handler caught: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "An unexpected error occurred",
            "error": str(exc)
        }
    )


# Include routers
app.include_router(mission_planning_router, prefix="/api/v1")


# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "Mission Planning API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc"
    }


# Health check
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "mission-planning-api",
        "version": "1.0.0"
    }


# WebSocket endpoint for debug panel
@app.websocket("/ws/debug")
async def websocket_debug_endpoint(websocket: WebSocket):
    await debug_manager.connect(websocket)
    try:
        # Send initial connection message
        await websocket.send_text(json.dumps({
            "timestamp": str(asyncio.get_event_loop().time()),
            "level": "info",
            "message": "🔌 Debug panel connected to API"
        }))
        
        # Keep connection alive
        while True:
            await websocket.receive_text()
    except Exception as e:
        logger.info(f"Debug WebSocket connection closed: {e}")
    finally:
        debug_manager.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=9000,
        reload=True,
        log_level="info"
    ) 