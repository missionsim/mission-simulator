from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from typing import Dict, Any
import json
import logging
import os
import tempfile

from models import (
    MissionPlanRequest, MissionPlanResponse, 
    ChatRequest, StreamingChunk
)
from services.mission_planning import MissionPlanningService
from services.export import ExportService
from debug_utils import debug_print

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mission-planning", tags=["Mission Planning"])

# Initialize services
mission_planning_service = MissionPlanningService()
export_service = ExportService()


@router.post("/generate-plan", response_model=MissionPlanResponse)
async def generate_mission_plan(request: MissionPlanRequest):
    """
    Generate a mission plan based on the provided objectives and constraints.
    
    This endpoint returns a complete mission plan without streaming.
    """
    logger.info(f"Generating mission plan for objective: {request.objective.description}")
    
    response = await mission_planning_service.generate_mission_plan_simple(request)
    
    if not response.success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=response.error or "Failed to generate mission plan"
        )
    
    return response


@router.post("/generate-plan/stream")
async def generate_mission_plan_stream(request: MissionPlanRequest):
    """
    Generate a mission plan with streaming response.
    
    This endpoint streams the plan generation process, including:
    - Status updates
    - Reasoning (if requested)
    - Individual waypoints as they're generated
    - The complete plan
    
    The response is a Server-Sent Events (SSE) stream.
    """
    logger.info(f"Starting streaming mission plan generation for: {request.objective.description}")
    debug_print(f"🌐 [API] Received streaming request for: {request.objective.description}")
    debug_print(f"🔧 [API] Request model: {request.model or 'default'}")
    debug_print(f"📡 [API] Include reasoning: {request.include_reasoning}")
    
    async def event_generator():
        chunk_count = 0
        async for chunk in mission_planning_service.generate_mission_plan(request):
            chunk_count += 1
            debug_print(f"📤 [API] Yielding SSE chunk #{chunk_count}: {chunk.type}")
            
            # Convert chunk to SSE format with datetime handling
            event_data = {
                "event": chunk.type,
                "data": chunk.dict()
            }
            
            # Use Pydantic's JSON serialization to handle datetime objects
            try:
                json_data = json.dumps(event_data, default=str)
            except Exception as e:
                debug_print(f"❌ [API] JSON serialization error: {e}")
                # Fallback: convert problematic objects to strings
                if chunk.data and hasattr(chunk.data, 'dict'):
                    # If it's a Pydantic model, use its json() method
                    event_data["data"] = json.loads(chunk.data.json()) if hasattr(chunk.data, 'json') else chunk.dict()
                json_data = json.dumps(event_data, default=str)
            
            yield f"data: {json_data}\n\n"
        
        debug_print(f"✅ [API] Stream completed. Total chunks: {chunk_count}")
        # Send final done event
        yield f"data: {json.dumps({'event': 'done'})}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable proxy buffering
        }
    )


@router.post("/chat")
async def chat_with_planner(request: ChatRequest):
    """
    Chat with the mission planner for interactive planning.
    
    This endpoint allows for conversational mission planning where users can
    refine and adjust plans through natural language.
    """
    logger.info(f"Chat request with {len(request.messages)} messages")
    
    # Build messages for LLM
    messages = [{"role": msg.role, "content": msg.content} for msg in request.messages]
    
    # Add context if provided
    if request.context:
        context_message = f"Current context: {json.dumps(request.context)}"
        messages.insert(0, {"role": "system", "content": context_message})
    
    if request.stream:
        async def chat_generator():
            from llm import stream_text
            
            async for chunk in stream_text(
                prompt="",  # Empty prompt since we're using messages
                messages=messages,
                model=request.model,
                system_prompt="You are an expert drone mission planner assistant. Help users create, modify, and optimize drone mission plans. Be concise but thorough."
            ):
                # Convert OpenAI chunk format to our format
                if hasattr(chunk, 'choices') and chunk.choices:
                    delta = chunk.choices[0].delta
                    if hasattr(delta, 'content') and delta.content:
                        yield f"data: {json.dumps({'content': delta.content})}\n\n"
            
            yield f"data: {json.dumps({'done': True})}\n\n"
        
        return StreamingResponse(
            chat_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )
    else:
        # Non-streaming response
        from llm import stream_text
        
        accumulated_response = ""
        async for chunk in stream_text(
            prompt="",
            messages=messages,
            model=request.model,
            system_prompt="You are an expert drone mission planner assistant. Help users create, modify, and optimize drone mission plans. Be concise but thorough."
        ):
            if hasattr(chunk, 'choices') and chunk.choices:
                delta = chunk.choices[0].delta
                if hasattr(delta, 'content') and delta.content:
                    accumulated_response += delta.content
        
        return {"response": accumulated_response}


@router.get("/templates")
async def get_mission_templates():
    """
    Get pre-defined mission templates for common scenarios.
    """
    templates = [
        {
            "id": "survey_grid",
            "name": "Grid Survey",
            "description": "Systematic grid pattern for area mapping",
            "objective": {
                "description": "Conduct a systematic aerial survey of the specified area using a grid pattern for complete coverage",
                "priority": "medium",
                "constraints": ["Maintain constant altitude", "Overlap images by 70%", "Complete within battery limits"]
            }
        },
        {
            "id": "perimeter_patrol",
            "name": "Perimeter Patrol",
            "description": "Security patrol around a defined perimeter",
            "objective": {
                "description": "Patrol the perimeter of the specified area for security monitoring",
                "priority": "high",
                "constraints": ["Maintain visual line of sight", "Complete circuit every 15 minutes", "Focus cameras outward"]
            }
        },
        {
            "id": "search_pattern",
            "name": "Search Pattern",
            "description": "Expanding square search pattern",
            "objective": {
                "description": "Execute an expanding square search pattern to locate target within search area",
                "priority": "high",
                "constraints": ["Start from last known position", "Expand search radius systematically", "Maintain low altitude for visibility"]
            }
        },
        {
            "id": "infrastructure_inspection",
            "name": "Infrastructure Inspection",
            "description": "Detailed inspection of infrastructure",
            "objective": {
                "description": "Conduct detailed visual inspection of infrastructure capturing all angles and potential issues",
                "priority": "medium",
                "constraints": ["Maintain safe distance from structures", "Capture high-resolution imagery", "Document GPS coordinates of issues"]
            }
        }
    ]
    
    return {"templates": templates}


@router.get("/health")
async def health_check():
    """Check if the mission planning service is healthy."""
    return {
        "status": "healthy",
        "service": "mission-planning",
        "version": "1.0.0"
    }


@router.post("/export/mission/{mission_id}")
async def export_mission_for_drone(mission_id: str):
    """
    Export a mission plan in drone-compatible format.
    
    This endpoint exports the mission plan in a standardized format 
    (QGroundControl/MAVLink compatible) that can be loaded onto drones.
    """
    logger.info(f"Exporting mission {mission_id} for drone")
    debug_print(f"📋 [EXPORT] Exporting mission {mission_id} for drone")
    
    # For testing, create a demo mission if the demo ID is used
    if mission_id == "demo-mission-001":
        from models import MissionPlan, Waypoint, Coordinate, WaypointType
        from datetime import datetime
        
        # Create a demo mission for testing that covers a larger area (Alcatraz to SFO area)
        demo_waypoints = [
            Waypoint(
                id="wp_0",
                type=WaypointType.TAKEOFF,
                position=Coordinate(lat=37.8267, lng=-122.4233, alt=10),  # Alcatraz area
                order=0,
                name="Takeoff - Alcatraz Area"
            ),
            Waypoint(
                id="wp_1", 
                type=WaypointType.WAYPOINT,
                position=Coordinate(lat=37.8085, lng=-122.4099, alt=50),  # North Beach
                order=1,
                name="North Beach"
            ),
            Waypoint(
                id="wp_2",
                type=WaypointType.WAYPOINT, 
                position=Coordinate(lat=37.7749, lng=-122.4194, alt=50),  # Downtown SF
                order=2,
                name="Downtown SF"
            ),
            Waypoint(
                id="wp_3",
                type=WaypointType.WAYPOINT,
                position=Coordinate(lat=37.7544, lng=-122.4477, alt=50),  # Golden Gate Park area
                order=3,
                name="Golden Gate Park"
            ),
            Waypoint(
                id="wp_4",
                type=WaypointType.WAYPOINT,
                position=Coordinate(lat=37.7280, lng=-122.4680, alt=50),  # Sunset District
                order=4,
                name="Sunset District"
            ),
            Waypoint(
                id="wp_5",
                type=WaypointType.WAYPOINT,
                position=Coordinate(lat=37.7062, lng=-122.4603, alt=50),  # Daly City
                order=5,
                name="Daly City"
            ),
            Waypoint(
                id="wp_6",
                type=WaypointType.WAYPOINT,
                position=Coordinate(lat=37.6777, lng=-122.4557, alt=50),  # South SF
                order=6,
                name="South San Francisco"
            ),
            Waypoint(
                id="wp_7",
                type=WaypointType.WAYPOINT,
                position=Coordinate(lat=37.6624, lng=-122.4827, alt=50),  # San Bruno
                order=7,
                name="San Bruno"
            ),
            Waypoint(
                id="wp_8",
                type=WaypointType.WAYPOINT,
                position=Coordinate(lat=37.6213, lng=-122.3790, alt=50),  # SFO area
                order=8,
                name="SFO Area"
            ),
            Waypoint(
                id="wp_9",
                type=WaypointType.LAND,
                position=Coordinate(lat=37.6090, lng=-122.3733, alt=0),   # SFO
                order=9,
                name="Landing - SFO"
            )
        ]
        
        demo_mission = MissionPlan(
            id=mission_id,
            name="Demo Mission - San Francisco",
            description="A demonstration mission around San Francisco for testing export functionality",
            waypoints=demo_waypoints,
            estimated_duration=15.5,
            total_distance=2500.0,
            created_at=datetime.utcnow()
        )
        
        drone_mission = await export_service.export_mission_for_drone(demo_mission)
        
        return StreamingResponse(
            iter([json.dumps(drone_mission, indent=2)]),
            media_type="application/json",
            headers={
                "Content-Disposition": f"attachment; filename=mission_{mission_id}.plan"
            }
        )
    
    # For other mission IDs, return 404 as we don't have persistence yet
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Mission {mission_id} not found. Use 'demo-mission-001' for testing or implement mission persistence."
    )


@router.post("/export/geotiff/{mission_id}")
async def export_route_geotiff(
    mission_id: str,
    zoom_level: int = 16,
    buffer_meters: int = 500,
    map_type: str = "satellite"
):
    """
    Export route as a GeoTIFF file.
    
    This endpoint generates a georeferenced TIFF image of the mission route
    using satellite imagery from Google Maps.
    
    Parameters:
    - zoom_level: Tile zoom level (higher = more detail, 1-18)
    - buffer_meters: Buffer around route in meters
    - map_type: Type of map ("satellite", "roadmap", "hybrid", "terrain")
    """
    logger.info(f"Exporting GeoTIFF for mission {mission_id}")
    debug_print(f"🗺️ [EXPORT] Generating GeoTIFF for mission {mission_id}")
    debug_print(f"🔧 [EXPORT] Zoom level: {zoom_level}, Buffer: {buffer_meters}m, Type: {map_type}")
    
    # Validate parameters
    if not (1 <= zoom_level <= 18):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Zoom level must be between 1 and 18"
        )
    
    if not (50 <= buffer_meters <= 5000):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Buffer must be between 50 and 5000 meters"
        )
    
    if map_type not in ["satellite", "roadmap", "hybrid", "terrain"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Map type must be one of: satellite, roadmap, hybrid, terrain"
        )
    
    # For testing, create a demo mission if the demo ID is used
    if mission_id == "demo-mission-001":
        from models import MissionPlan, Waypoint, Coordinate, WaypointType
        from datetime import datetime
        
        # Create a demo mission for testing (same as above)
        demo_waypoints = [
            Waypoint(
                id="wp_0",
                type=WaypointType.TAKEOFF,
                position=Coordinate(lat=37.8267, lng=-122.4233, alt=10),  # Alcatraz area
                order=0,
                name="Takeoff - Alcatraz Area"
            ),
            Waypoint(
                id="wp_1", 
                type=WaypointType.WAYPOINT,
                position=Coordinate(lat=37.8085, lng=-122.4099, alt=50),  # North Beach
                order=1,
                name="North Beach"
            ),
            Waypoint(
                id="wp_2",
                type=WaypointType.WAYPOINT, 
                position=Coordinate(lat=37.7749, lng=-122.4194, alt=50),  # Downtown SF
                order=2,
                name="Downtown SF"
            ),
            Waypoint(
                id="wp_3",
                type=WaypointType.WAYPOINT,
                position=Coordinate(lat=37.7544, lng=-122.4477, alt=50),  # Golden Gate Park area
                order=3,
                name="Golden Gate Park"
            ),
            Waypoint(
                id="wp_4",
                type=WaypointType.WAYPOINT,
                position=Coordinate(lat=37.7280, lng=-122.4680, alt=50),  # Sunset District
                order=4,
                name="Sunset District"
            ),
            Waypoint(
                id="wp_5",
                type=WaypointType.WAYPOINT,
                position=Coordinate(lat=37.7062, lng=-122.4603, alt=50),  # Daly City
                order=5,
                name="Daly City"
            ),
            Waypoint(
                id="wp_6",
                type=WaypointType.WAYPOINT,
                position=Coordinate(lat=37.6777, lng=-122.4557, alt=50),  # South SF
                order=6,
                name="South San Francisco"
            ),
            Waypoint(
                id="wp_7",
                type=WaypointType.WAYPOINT,
                position=Coordinate(lat=37.6624, lng=-122.4827, alt=50),  # San Bruno
                order=7,
                name="San Bruno"
            ),
            Waypoint(
                id="wp_8",
                type=WaypointType.WAYPOINT,
                position=Coordinate(lat=37.6213, lng=-122.3790, alt=50),  # SFO area
                order=8,
                name="SFO Area"
            ),
            Waypoint(
                id="wp_9",
                type=WaypointType.LAND,
                position=Coordinate(lat=37.6090, lng=-122.3733, alt=0),   # SFO
                order=9,
                name="Landing - SFO"
            )
        ]
        
        demo_mission = MissionPlan(
            id=mission_id,
            name="Demo Mission - San Francisco",
            description="A demonstration mission around San Francisco for testing export functionality",
            waypoints=demo_waypoints,
            estimated_duration=15.5,
            total_distance=2500.0,
            created_at=datetime.utcnow()
        )
        
        try:
            geotiff_bytes = await export_service.generate_route_geotiff(
                demo_mission, 
                zoom_level=zoom_level, 
                buffer_meters=buffer_meters,
                map_type=map_type
            )
            
            return StreamingResponse(
                iter([geotiff_bytes]),
                media_type="image/tiff",
                headers={
                    "Content-Disposition": f"attachment; filename=route_{mission_id}_{map_type}.geotiff"
                }
            )
        except ValueError as e:
            debug_print(f"❌ [EXPORT] GeoTIFF generation failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
        except Exception as e:
            debug_print(f"💥 [EXPORT] Unexpected error: {e}")
            logger.error(f"GeoTIFF generation error: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to generate GeoTIFF"
            )
    
    # For other mission IDs, return 404 as we don't have persistence yet
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Mission {mission_id} not found. Use 'demo-mission-001' for testing or implement mission persistence."
    )


@router.post("/export/png/{mission_id}")
async def export_route_png(
    mission_id: str,
    zoom_level: int = 16,
    buffer_meters: int = 500,
    map_type: str = "satellite"
):
    """
    Export route as a PNG image file.
    
    This endpoint generates a PNG image of the mission route
    using satellite imagery from Google Maps (without georeferencing).
    
    Parameters:
    - zoom_level: Tile zoom level (higher = more detail, 1-18)
    - buffer_meters: Buffer around route in meters
    - map_type: Type of map ("satellite", "roadmap", "hybrid", "terrain")
    """
    logger.info(f"Exporting PNG for mission {mission_id}")
    debug_print(f"🖼️ [EXPORT] Generating PNG for mission {mission_id}")
    debug_print(f"🔧 [EXPORT] Zoom level: {zoom_level}, Buffer: {buffer_meters}m, Type: {map_type}")
    
    # Validate parameters
    if not (1 <= zoom_level <= 18):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Zoom level must be between 1 and 18"
        )
    
    if not (50 <= buffer_meters <= 5000):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Buffer must be between 50 and 5000 meters"
        )
    
    if map_type not in ["satellite", "roadmap", "hybrid", "terrain"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Map type must be one of: satellite, roadmap, hybrid, terrain"
        )
    
    # For testing, create a demo mission if the demo ID is used
    if mission_id == "demo-mission-001":
        from models import MissionPlan, Waypoint, Coordinate, WaypointType
        from datetime import datetime
        
        # Create a demo mission for testing (same as GeoTIFF)
        demo_waypoints = [
            Waypoint(
                id="wp_0",
                type=WaypointType.TAKEOFF,
                position=Coordinate(lat=37.8267, lng=-122.4233, alt=10),  # Alcatraz area
                order=0,
                name="Takeoff - Alcatraz Area"
            ),
            Waypoint(
                id="wp_1", 
                type=WaypointType.WAYPOINT,
                position=Coordinate(lat=37.8085, lng=-122.4099, alt=50),  # North Beach
                order=1,
                name="North Beach"
            ),
            Waypoint(
                id="wp_2",
                type=WaypointType.WAYPOINT, 
                position=Coordinate(lat=37.7749, lng=-122.4194, alt=50),  # Downtown SF
                order=2,
                name="Downtown SF"
            ),
            Waypoint(
                id="wp_3",
                type=WaypointType.WAYPOINT,
                position=Coordinate(lat=37.7544, lng=-122.4477, alt=50),  # Golden Gate Park area
                order=3,
                name="Golden Gate Park"
            ),
            Waypoint(
                id="wp_4",
                type=WaypointType.WAYPOINT,
                position=Coordinate(lat=37.7280, lng=-122.4680, alt=50),  # Sunset District
                order=4,
                name="Sunset District"
            ),
            Waypoint(
                id="wp_5",
                type=WaypointType.WAYPOINT,
                position=Coordinate(lat=37.7062, lng=-122.4603, alt=50),  # Daly City
                order=5,
                name="Daly City"
            ),
            Waypoint(
                id="wp_6",
                type=WaypointType.WAYPOINT,
                position=Coordinate(lat=37.6777, lng=-122.4557, alt=50),  # South SF
                order=6,
                name="South San Francisco"
            ),
            Waypoint(
                id="wp_7",
                type=WaypointType.WAYPOINT,
                position=Coordinate(lat=37.6624, lng=-122.4827, alt=50),  # San Bruno
                order=7,
                name="San Bruno"
            ),
            Waypoint(
                id="wp_8",
                type=WaypointType.WAYPOINT,
                position=Coordinate(lat=37.6213, lng=-122.3790, alt=50),  # SFO area
                order=8,
                name="SFO Area"
            ),
            Waypoint(
                id="wp_9",
                type=WaypointType.LAND,
                position=Coordinate(lat=37.6090, lng=-122.3733, alt=0),   # SFO
                order=9,
                name="Landing - SFO"
            )
        ]
        
        demo_mission = MissionPlan(
            id=mission_id,
            name="Demo Mission - San Francisco",
            description="A demonstration mission around San Francisco for testing export functionality",
            waypoints=demo_waypoints,
            estimated_duration=15.5,
            total_distance=2500.0,
            created_at=datetime.utcnow()
        )
        
        try:
            png_bytes = await export_service.generate_route_png(
                demo_mission, 
                zoom_level=zoom_level, 
                buffer_meters=buffer_meters,
                map_type=map_type
            )
            
            return StreamingResponse(
                iter([png_bytes]),
                media_type="image/png",
                headers={
                    "Content-Disposition": f"attachment; filename=route_{mission_id}_{map_type}.png"
                }
            )
        except ValueError as e:
            debug_print(f"❌ [EXPORT] PNG generation failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
        except Exception as e:
            debug_print(f"💥 [EXPORT] Unexpected error: {e}")
            logger.error(f"PNG generation error: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to generate PNG"
            )
    
    # For other mission IDs, return 404 as we don't have persistence yet
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Mission {mission_id} not found. Use 'demo-mission-001' for testing or implement mission persistence."
    )


@router.get("/export/test-geotiff-info")
async def test_geotiff_georeferencing():
    """
    Test endpoint to verify GeoTIFF georeferencing capabilities.
    Creates a small test GeoTIFF and returns its georeferencing information.
    """
    debug_print("🧪 [TEST] Creating test GeoTIFF to verify georeferencing")
    
    from models import MissionPlan, Waypoint, Coordinate, WaypointType
    from datetime import datetime
    
    # Create a minimal test mission
    test_waypoints = [
        Waypoint(
            id="test_wp_1",
            type=WaypointType.WAYPOINT,
            position=Coordinate(lat=40.7128, lng=-74.0060, alt=30),  # NYC
            order=0,
            name="Test Point 1"
        ),
        Waypoint(
            id="test_wp_2",
            type=WaypointType.WAYPOINT,
            position=Coordinate(lat=40.7228, lng=-73.9960, alt=30),  # Nearby point
            order=1,
            name="Test Point 2"
        )
    ]
    
    test_mission = MissionPlan(
        id="test-mission",
        name="Test Mission - NYC",
        description="Test mission for GeoTIFF georeferencing verification",
        waypoints=test_waypoints,
        estimated_duration=5.0,
        total_distance=1000.0,
        created_at=datetime.utcnow()
    )
    
    try:
        # Generate a small test GeoTIFF
        geotiff_bytes = await export_service.generate_route_geotiff(
            test_mission,
            zoom_level=12,  # Lower zoom for faster processing
            buffer_meters=1000,
            map_type="satellite"
        )
        
        # Save temporarily to verify georeferencing
        with tempfile.NamedTemporaryFile(suffix='.geotiff', delete=False) as temp_file:
            temp_file.write(geotiff_bytes)
            temp_path = temp_file.name
        
        # Verify georeferencing
        verification_info = export_service.verify_geotiff_georeferencing(temp_path)
        
        # Clean up
        os.unlink(temp_path)
        
        debug_print(f"✅ [TEST] GeoTIFF verification completed successfully")
        debug_print(f"📊 [TEST] CRS: {verification_info.get('crs')}")
        debug_print(f"📊 [TEST] Bounds: {verification_info.get('bounds')}")
        debug_print(f"📊 [TEST] Is Georeferenced: {verification_info.get('is_georeferenced')}")
        
        return {
            "success": True,
            "message": "GeoTIFF georeferencing test completed successfully",
            "georeferencing_info": verification_info,
            "test_file_size_bytes": len(geotiff_bytes)
        }
        
    except Exception as e:
        debug_print(f"❌ [TEST] GeoTIFF test failed: {e}")
        logger.error(f"GeoTIFF test error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"GeoTIFF test failed: {str(e)}"
        )


@router.post("/export/waypoints/{mission_id}")
async def export_mission_waypoints(mission_id: str):
    """
    Export a mission plan as a .waypoints file (Mission Planner format).
    
    This endpoint exports the mission plan in the Mission Planner/ArduPilot 
    compatible .waypoints format, which is a tab-separated text file.
    """
    logger.info(f"Exporting mission {mission_id} as .waypoints file")
    debug_print(f"📋 [EXPORT] Exporting mission {mission_id} as .waypoints file")
    
    # For testing, create a demo mission if the demo ID is used
    if mission_id == "demo-mission-001":
        from models import MissionPlan, Waypoint, Coordinate, WaypointType
        from datetime import datetime
        
        # Create a demo mission for testing that covers a larger area (Alcatraz to SFO area)
        demo_waypoints = [
            Waypoint(
                id="wp_0",
                type=WaypointType.TAKEOFF,
                position=Coordinate(lat=37.8267, lng=-122.4233, alt=10),  # Alcatraz area
                order=0,
                name="Takeoff - Alcatraz Area"
            ),
            Waypoint(
                id="wp_1", 
                type=WaypointType.WAYPOINT,
                position=Coordinate(lat=37.8085, lng=-122.4099, alt=50),  # North Beach
                order=1,
                name="North Beach"
            ),
            Waypoint(
                id="wp_2",
                type=WaypointType.WAYPOINT, 
                position=Coordinate(lat=37.7749, lng=-122.4194, alt=50),  # Downtown SF
                order=2,
                name="Downtown SF"
            ),
            Waypoint(
                id="wp_3",
                type=WaypointType.WAYPOINT,
                position=Coordinate(lat=37.7544, lng=-122.4477, alt=50),  # Golden Gate Park area
                order=3,
                name="Golden Gate Park"
            ),
            Waypoint(
                id="wp_4",
                type=WaypointType.WAYPOINT,
                position=Coordinate(lat=37.7280, lng=-122.4680, alt=50),  # Sunset District
                order=4,
                name="Sunset District"
            ),
            Waypoint(
                id="wp_5",
                type=WaypointType.WAYPOINT,
                position=Coordinate(lat=37.7062, lng=-122.4603, alt=50),  # Daly City
                order=5,
                name="Daly City"
            ),
            Waypoint(
                id="wp_6",
                type=WaypointType.WAYPOINT,
                position=Coordinate(lat=37.6777, lng=-122.4557, alt=50),  # South SF
                order=6,
                name="South San Francisco"
            ),
            Waypoint(
                id="wp_7",
                type=WaypointType.WAYPOINT,
                position=Coordinate(lat=37.6624, lng=-122.4827, alt=50),  # San Bruno
                order=7,
                name="San Bruno"
            ),
            Waypoint(
                id="wp_8",
                type=WaypointType.WAYPOINT,
                position=Coordinate(lat=37.6213, lng=-122.3790, alt=50),  # SFO area
                order=8,
                name="SFO Area"
            ),
            Waypoint(
                id="wp_9",
                type=WaypointType.LAND,
                position=Coordinate(lat=37.6090, lng=-122.3733, alt=0),   # SFO
                order=9,
                name="Landing - SFO"
            )
        ]
        
        demo_mission = MissionPlan(
            id=mission_id,
            name="Demo Mission - San Francisco",
            description="A demonstration mission around San Francisco for testing export functionality",
            waypoints=demo_waypoints,
            estimated_duration=15.5,
            total_distance=2500.0,
            created_at=datetime.utcnow()
        )
        
        waypoints_content = export_service.export_mission_waypoints(demo_mission)
        
        return StreamingResponse(
            iter([waypoints_content]),
            media_type="text/plain",
            headers={
                "Content-Disposition": f"attachment; filename=mission_{mission_id}.waypoints"
            }
        )
    
    # For other mission IDs, return 404 as we don't have persistence yet
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Mission {mission_id} not found. Use 'demo-mission-001' for testing or implement mission persistence."
    ) 