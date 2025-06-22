import json
import uuid
import math
import os
import asyncio
from typing import List, Dict, Any, Optional, AsyncGenerator
from datetime import datetime
import logging
from functools import wraps

from models import (
    MissionPlanRequest, MissionPlan, Waypoint, WaypointType,
    Coordinate, StreamingChunk, MissionPlanResponse
)
from llm import stream_text
from debug_utils import debug_print

logger = logging.getLogger(__name__)


def retry_llm_call(max_retries=5, base_delay=1.0, max_delay=30.0, backoff_factor=2.0):
    """
    Decorator for retrying LLM calls with exponential backoff.
    
    Args:
        max_retries: Maximum number of retry attempts
        base_delay: Initial delay between retries in seconds
        max_delay: Maximum delay between retries in seconds
        backoff_factor: Multiplier for delay after each retry
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None
            delay = base_delay
            
            for attempt in range(max_retries + 1):  # +1 for initial attempt
                try:
                    return await func(*args, **kwargs)
                except json.JSONDecodeError as e:
                    last_exception = e
                    if attempt < max_retries:
                        logger.warning(f"JSON decode error in {func.__name__} (attempt {attempt + 1}/{max_retries + 1}): {e}. Retrying in {delay:.1f}s...")
                        await asyncio.sleep(delay)
                        delay = min(delay * backoff_factor, max_delay)
                    else:
                        logger.error(f"JSON decode error in {func.__name__} failed after {max_retries + 1} attempts: {e}")
                except Exception as e:
                    # For non-JSON errors, we might want to retry fewer times or not at all
                    # depending on the error type
                    if attempt < min(2, max_retries):  # Only retry critical errors 2 times max
                        logger.warning(f"Error in {func.__name__} (attempt {attempt + 1}): {e}. Retrying in {delay:.1f}s...")
                        last_exception = e
                        await asyncio.sleep(delay)
                        delay = min(delay * backoff_factor, max_delay)
                    else:
                        logger.error(f"Error in {func.__name__} failed after retries: {e}")
                        raise e
            
            # If we get here, all retries failed
            raise last_exception
        return wrapper
    return decorator


class GeoCodingService:
    """Simple geocoding service using Google Maps API"""
    
    def __init__(self):
        self.api_key = os.getenv('GOOGLE_MAPS_API_KEY')
        if not self.api_key:
            logger.warning("GOOGLE_MAPS_API_KEY not found in environment variables")
    
    async def geocode_location(self, location_name: str) -> Optional[tuple[float, float]]:
        """Geocode a location name to lat/lng coordinates"""
        if not self.api_key:
            logger.warning(f"Cannot geocode '{location_name}': No Google Maps API key")
            return None
            
        # For now, using a simple implementation
        # You can enhance this with actual Google Maps API calls
        try:
            import aiohttp
            
            url = "https://maps.googleapis.com/maps/api/geocode/json"
            params = {
                'address': location_name,
                'key': self.api_key
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        if data['status'] == 'OK' and data['results']:
                            location = data['results'][0]['geometry']['location']
                            return (location['lat'], location['lng'])
                        else:
                            logger.warning(f"Geocoding failed for '{location_name}': {data.get('status', 'Unknown error')}")
                            return None
                    else:
                        logger.error(f"Geocoding API request failed with status {response.status}")
                        return None
                        
        except ImportError:
            logger.warning("aiohttp not available, using fallback coordinates")
            # Fallback coordinates (San Francisco area)
            return (37.7749, -122.4194)
        except Exception as e:
            logger.error(f"Error geocoding '{location_name}': {e}")
            return None


class MissionPlanningService:
    """Service for generating mission plans using multiple LLM calls and geocoding"""
    
    def __init__(self):
        self.geocoding_service = GeoCodingService()
        
        self.structure_system_prompt = """You are an expert drone mission planner analyzing mission requirements.

Your job is to analyze a mission request and identify:
1. Key locations mentioned or implied in the mission
2. Types of waypoints needed (takeoff, survey, orbit, loiter, waypoint, land)
3. Mission flow and sequence
4. Potential challenges or considerations

Be specific about locations - include full addresses or landmarks when possible for accurate geocoding.

Respond with ONLY valid JSON in this exact format:
{
  "mission_type": "survey|inspection|delivery|search_rescue|patrol|custom",
  "key_locations": [
    {
      "name": "Specific location name or address",
      "purpose": "takeoff|landing|survey_area|inspection_point|waypoint|loiter_zone",
      "priority": "high|medium|low"
    }
  ],
  "waypoint_sequence": [
    {
      "type": "takeoff|waypoint|survey|orbit|loiter|land",
      "purpose": "Brief description of what happens at this waypoint",
      "location_reference": "Key location name this waypoint relates to"
    }
  ],
  "estimated_complexity": "simple|moderate|complex",
  "considerations": [
    "List of important factors to consider for this mission"
  ]
}"""

        self.detailed_system_prompt = """You are an expert drone mission planner creating detailed flight plans.

You will be given:
1. Mission structure analysis
2. Precise coordinates for all locations
3. Mission requirements and constraints

Create a comprehensive mission plan with waypoints, ensuring safety and efficiency.

CRITICAL: You MUST respond with ONLY valid JSON in the exact format below. Do not include any text before or after the JSON.

JSON TEMPLATE:
{
  "mission_name": "Descriptive Mission Name",
  "mission_description": "Brief description of what this mission accomplishes",
  "waypoints": [
    {
      "id": "wp_001",
      "type": "takeoff",
      "position": {
        "lat": 37.7749,
        "lng": -122.4194,
        "alt": 5
      },
      "order": 1,
      "name": "Takeoff Point",
      "speed": 5.0
    }
  ],
  "estimated_duration": 15.5,
  "total_distance": 1200.0,
  "warnings": []
}

Available waypoint types: "takeoff", "waypoint", "loiter", "survey", "orbit", "land"
Optional waypoint fields: "speed", "loiter_time", "radius", "camera_action"

RESPOND WITH ONLY THE JSON - NO OTHER TEXT."""

    async def generate_mission_plan(
        self,
        request: MissionPlanRequest
    ) -> AsyncGenerator[StreamingChunk, None]:
        """Generate a mission plan using multiple LLM calls and geocoding"""
        
        sequence = 0
        
        debug_print(f"🎯 [MISSION] Starting multi-phase mission plan generation")
        debug_print(f"📋 [MISSION] Objective: {request.objective.description}")
        
        # Phase 1: Structure Analysis (0-30% progress)
        yield StreamingChunk(
            type="status",
            content="Phase 1/3: Analyzing mission structure and identifying key locations...",
            data={"phase": 1, "total_phases": 3, "progress": 5},
            sequence=sequence,
            is_final=False
        )
        sequence += 1
        
        try:
            structure_data = await self._generate_mission_structure(request)
            debug_print(f"🏗️ [MISSION] Structure analysis complete: {len(structure_data.get('key_locations', []))} locations identified")
            
            yield StreamingChunk(
                type="status",
                content=f"✅ Mission structure analyzed - {len(structure_data.get('key_locations', []))} locations identified",
                data={"phase": 1, "total_phases": 3, "progress": 25, "structure_data": structure_data},
                sequence=sequence,
                is_final=False
            )
            sequence += 1
            
        except Exception as e:
            debug_print(f"❌ [MISSION] Structure analysis failed: {str(e)}")
            yield StreamingChunk(
                type="error",
                content=f"Mission structure analysis failed: {str(e)}",
                sequence=sequence,
                is_final=True
            )
            return
        
        # Phase 2: Geocoding (25-60% progress)
        yield StreamingChunk(
            type="status",
            content="Phase 2/3: Geocoding locations and getting precise coordinates...",
            data={"phase": 2, "total_phases": 3, "progress": 30},
            sequence=sequence,
            is_final=False
        )
        sequence += 1
        
        try:
            geocoded_locations = await self._geocode_mission_locations(structure_data, request)
            debug_print(f"🌍 [MISSION] Geocoding complete: {len(geocoded_locations)} locations processed")
            
            successful_geocodes = 0
            for location_name, coords in geocoded_locations.items():
                if coords:
                    successful_geocodes += 1
                    yield StreamingChunk(
                        type="status",
                        content=f"📍 Geocoded location: {location_name}",
                        data={
                            "phase": 2, 
                            "total_phases": 3, 
                            "progress": 30 + (successful_geocodes / len(geocoded_locations)) * 25,
                            "location": {"name": location_name, "coordinates": coords}
                        },
                        sequence=sequence,
                        is_final=False
                    )
                    sequence += 1
            
            # Geocoding complete
            yield StreamingChunk(
                type="status",
                content=f"✅ Geocoding complete - {successful_geocodes}/{len(geocoded_locations)} locations processed",
                data={"phase": 2, "total_phases": 3, "progress": 55},
                sequence=sequence,
                is_final=False
            )
            sequence += 1
                    
        except Exception as e:
            debug_print(f"❌ [MISSION] Geocoding failed: {str(e)}")
            yield StreamingChunk(
                type="error",
                content=f"Location geocoding failed: {str(e)}",
                sequence=sequence,
                is_final=True
            )
            return
        
        # Phase 3: Detailed Mission Planning (60-100% progress)
        yield StreamingChunk(
            type="status",
            content="Phase 3/3: Creating detailed mission plan with optimized waypoints...",
            data={"phase": 3, "total_phases": 3, "progress": 60},
            sequence=sequence,
            is_final=False
        )
        sequence += 1
        
        try:
            async for chunk in self._generate_detailed_mission_plan(
                request, structure_data, geocoded_locations, sequence
            ):
                yield chunk
                sequence += 1
                
        except Exception as e:
            debug_print(f"❌ [MISSION] Detailed planning failed: {str(e)}")
            yield StreamingChunk(
                type="error",
                content=f"Detailed mission planning failed: {str(e)}",
                sequence=sequence,
                is_final=True
            )

    @retry_llm_call(max_retries=5, base_delay=1.5)
    async def _generate_mission_structure(self, request: MissionPlanRequest) -> Dict[str, Any]:
        """Phase 1: Analyze mission structure and identify key locations"""
        
        prompt = self._build_structure_prompt(request)
        debug_print(f"🔧 [MISSION] Built structure analysis prompt: {len(prompt)} chars")
        
        accumulated_content = ""
        
        # Use default model if none specified
        default_model = os.getenv('OPENROUTER_API_MODEL', 'google/gemini-2.5-pro')
        model_to_use = request.model or default_model
        debug_print(f"🤖 [MISSION] Using model for structure analysis: {model_to_use}")
        
        async for chunk in stream_text(
            prompt=prompt,
            system_prompt=self.structure_system_prompt,
            model=model_to_use,
            include_reasoning=False
        ):
            if hasattr(chunk, 'choices') and chunk.choices:
                delta = chunk.choices[0].delta
                if hasattr(delta, 'content') and delta.content:
                    accumulated_content += delta.content
                    
                if chunk.choices[0].finish_reason == 'stop':
                    # Parse the structure response
                    try:
                        # Try to extract JSON from the response
                        start_idx = accumulated_content.find('{')
                        if start_idx != -1:
                            brace_count = 0
                            end_idx = start_idx
                            for i, char in enumerate(accumulated_content[start_idx:], start_idx):
                                if char == '{':
                                    brace_count += 1
                                elif char == '}':
                                    brace_count -= 1
                                    if brace_count == 0:
                                        end_idx = i + 1
                                        break
                            
                            json_text = accumulated_content[start_idx:end_idx]
                            structure_data = json.loads(json_text)
                            debug_print(f"✅ [MISSION] Structure analysis parsed successfully")
                            return structure_data
                        else:
                            raise ValueError("No JSON found in structure analysis response")
                            
                    except (json.JSONDecodeError, ValueError) as e:
                        debug_print(f"⚠️ [MISSION] Structure analysis JSON parse failed: {e}")
                        debug_print(f"📄 [MISSION] Raw content: {repr(accumulated_content)}")
                        raise
        
        raise ValueError("No structure analysis response received")

    async def _geocode_mission_locations(
        self, 
        structure_data: Dict[str, Any], 
        request: MissionPlanRequest
    ) -> Dict[str, Optional[tuple[float, float]]]:
        """Phase 2: Geocode all identified locations"""
        
        geocoded_locations = {}
        
        # Add start position if provided
        if request.start_position:
            geocoded_locations["start_position"] = (request.start_position.lat, request.start_position.lng)
        
        # Add area of interest points if provided
        if request.area_of_interest:
            for i, coord in enumerate(request.area_of_interest):
                geocoded_locations[f"aoi_point_{i+1}"] = (coord.lat, coord.lng)
        
        # Geocode locations from structure analysis
        for location in structure_data.get('key_locations', []):
            location_name = location.get('name', '')
            if location_name and location_name not in geocoded_locations:
                debug_print(f"🌍 [MISSION] Geocoding: {location_name}")
                coords = await self.geocoding_service.geocode_location(location_name)
                geocoded_locations[location_name] = coords
                
                if coords:
                    debug_print(f"✅ [MISSION] Geocoded '{location_name}': {coords}")
                else:
                    debug_print(f"⚠️ [MISSION] Failed to geocode '{location_name}'")
        
        return geocoded_locations

    async def _generate_detailed_mission_plan(
        self,
        request: MissionPlanRequest,
        structure_data: Dict[str, Any],
        geocoded_locations: Dict[str, Optional[tuple[float, float]]],
        start_sequence: int
    ) -> AsyncGenerator[StreamingChunk, None]:
        """Phase 3: Generate detailed mission plan with precise coordinates"""
        
        sequence = start_sequence
        prompt = self._build_detailed_prompt(request, structure_data, geocoded_locations)
        debug_print(f"🔧 [MISSION] Built detailed planning prompt: {len(prompt)} chars")
        
        # Define the expected JSON schema for structured output
        response_schema = {
            "type": "object",
            "properties": {
                "mission_name": {"type": "string"},
                "mission_description": {"type": "string"},
                "waypoints": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string"},
                            "type": {"type": "string", "enum": ["takeoff", "waypoint", "loiter", "survey", "orbit", "land"]},
                            "position": {
                                "type": "object",
                                "properties": {
                                    "lat": {"type": "number"},
                                    "lng": {"type": "number"},
                                    "alt": {"type": "number"}
                                },
                                "required": ["lat", "lng", "alt"]
                            },
                            "order": {"type": "integer"},
                            "name": {"type": "string"},
                            "speed": {"type": "number"},
                            "loiter_time": {"type": "number"},
                            "radius": {"type": "number"},
                            "camera_action": {"type": "string"}
                        },
                        "required": ["id", "type", "position", "order"]
                    }
                },
                "estimated_duration": {"type": "number"},
                "total_distance": {"type": "number"},
                "warnings": {
                    "type": "array",
                    "items": {"type": "string"}
                }
            },
            "required": ["mission_name", "mission_description", "waypoints", "estimated_duration", "total_distance"]
        }
        
        accumulated_content = ""
        accumulated_reasoning = ""
        
        # Use default model if none specified
        default_model = os.getenv('OPENROUTER_API_MODEL', 'google/gemini-2.5-pro')
        model_to_use = request.model or default_model
        debug_print(f"🤖 [MISSION] Using model for detailed planning: {model_to_use}")
        
        async for chunk in stream_text(
            prompt=prompt,
            system_prompt=self.detailed_system_prompt,
            model=model_to_use,
            response_schema=response_schema if not request.include_reasoning else None,
            schema_name="detailed_mission_plan",
            include_reasoning=request.include_reasoning
        ):
            if hasattr(chunk, 'choices') and chunk.choices:
                delta = chunk.choices[0].delta
                
                # Check for reasoning content
                if hasattr(delta, 'reasoning') and delta.reasoning:
                    accumulated_reasoning += delta.reasoning
                    yield StreamingChunk(
                        type="reasoning",
                        content=delta.reasoning,
                        sequence=sequence,
                        is_final=False
                    )
                    sequence += 1
                
                # Check for regular content
                if hasattr(delta, 'content') and delta.content:
                    accumulated_content += delta.content
                    
                # Check if we have a complete JSON response
                if chunk.choices[0].finish_reason == 'stop':
                    # Parse and yield the final plan
                    debug_print(f"🔍 [MISSION] Parsing detailed plan: {accumulated_content[:200]}...")
                    
                    # Try to extract JSON from the response
                    try:
                        # First try direct parsing
                        plan_data = json.loads(accumulated_content)
                    except json.JSONDecodeError:
                        # If that fails, try to find JSON within the text
                        debug_print("⚠️ [MISSION] Direct JSON parse failed, searching for JSON in text...")
                        
                        # Look for JSON block between { and }
                        start_idx = accumulated_content.find('{')
                        if start_idx != -1:
                            # Find the matching closing brace
                            brace_count = 0
                            end_idx = start_idx
                            for i, char in enumerate(accumulated_content[start_idx:], start_idx):
                                if char == '{':
                                    brace_count += 1
                                elif char == '}':
                                    brace_count -= 1
                                    if brace_count == 0:
                                        end_idx = i + 1
                                        break
                            
                            json_text = accumulated_content[start_idx:end_idx]
                            debug_print(f"🔧 [MISSION] Extracted JSON: {json_text[:200]}...")
                            plan_data = json.loads(json_text)
                        else:
                            raise ValueError("No JSON found in response")
                    
                    # Convert to our model format
                    waypoints = []
                    total_waypoints = len(plan_data['waypoints'])
                    
                    for i, wp_data in enumerate(plan_data['waypoints'], 1):
                        waypoint = Waypoint(
                            id=wp_data.get('id', str(uuid.uuid4())),
                            type=WaypointType(wp_data['type']),
                            position=Coordinate(**wp_data['position']),
                            order=wp_data['order'],
                            name=wp_data.get('name'),
                            speed=wp_data.get('speed'),
                            loiter_time=wp_data.get('loiter_time'),
                            radius=wp_data.get('radius'),
                            camera_action=wp_data.get('camera_action')
                        )
                        waypoints.append(waypoint)
                        
                        # Stream waypoint progress
                        waypoint_progress = 70 + (i / total_waypoints) * 20  # 70-90% for waypoint processing
                        yield StreamingChunk(
                            type="status",
                            content=f"🛰️ Generated waypoint {i}/{total_waypoints}: {waypoint.name or waypoint.type.value}",
                            data={
                                "phase": 3,
                                "total_phases": 3,
                                "progress": waypoint_progress,
                                "waypoint": waypoint.dict()
                            },
                            sequence=sequence,
                            is_final=False
                        )
                        sequence += 1
                    
                    # Create the complete mission plan
                    mission_plan = MissionPlan(
                        id=str(uuid.uuid4()),
                        name=plan_data['mission_name'],
                        description=plan_data['mission_description'],
                        waypoints=waypoints,
                        estimated_duration=plan_data['estimated_duration'],
                        total_distance=plan_data['total_distance'],
                        metadata={
                            "objective": request.objective.dict(),
                            "generated_by": request.model or "default",
                            "warnings": plan_data.get('warnings', []),
                            "structure_analysis": structure_data,
                            "geocoded_locations": {k: v for k, v in geocoded_locations.items() if v is not None}
                        }
                    )
                    
                    # Stream completion status
                    yield StreamingChunk(
                        type="status",
                        content="✅ Mission plan generation complete!",
                        data={
                            "phase": 3,
                            "total_phases": 3,
                            "progress": 95,
                            "plan_summary": {
                                "name": mission_plan.name,
                                "waypoints": len(waypoints),
                                "duration": plan_data['estimated_duration'],
                                "distance": plan_data['total_distance']
                            }
                        },
                        sequence=sequence,
                        is_final=False
                    )
                    sequence += 1
                    
                    # Stream the complete plan
                    debug_print(f"✅ [MISSION] Generated complete mission plan: {mission_plan.name}")
                    debug_print(f"📊 [MISSION] Plan stats: {len(waypoints)} waypoints, {plan_data['estimated_duration']}min, {plan_data['total_distance']}m")
                    yield StreamingChunk(
                        type="plan",
                        data={"progress": 100, "plan": mission_plan.dict()},
                        sequence=sequence,
                        is_final=True
                    )
                    return

    async def generate_mission_plan_simple(
        self,
        request: MissionPlanRequest
    ) -> MissionPlanResponse:
        """Generate a mission plan and return complete response (non-streaming)"""
        
        mission_plan = None
        reasoning = ""
        warnings = []
        
        async for chunk in self.generate_mission_plan(request):
            if chunk.type == "reasoning":
                reasoning += chunk.content or ""
            elif chunk.type == "plan" and chunk.is_final:
                mission_plan = MissionPlan(**chunk.data)
                warnings = chunk.data.get('metadata', {}).get('warnings', [])
        
        if mission_plan:
            return MissionPlanResponse(
                success=True,
                plan=mission_plan,
                reasoning=reasoning if request.include_reasoning else None,
                warnings=warnings
            )
        else:
            return MissionPlanResponse(
                success=False,
                error="Failed to generate mission plan"
            )

    def _build_structure_prompt(self, request: MissionPlanRequest) -> str:
        """Build the prompt for mission structure analysis"""
        
        prompt_parts = [
            f"Analyze the following drone mission request and identify the structure:",
            f"**Objective**: {request.objective.description}",
            f"**Priority**: {request.objective.priority}",
        ]
        
        if request.objective.constraints:
            prompt_parts.append(f"**Constraints**: {', '.join(request.objective.constraints)}")
        
        if request.start_position:
            prompt_parts.append(f"\n**Start Position**: Lat: {request.start_position.lat}, Lng: {request.start_position.lng}, Alt: {request.start_position.alt or 0}m")
        
        if request.area_of_interest:
            prompt_parts.append("\n**Area of Interest**:")
            for i, coord in enumerate(request.area_of_interest):
                prompt_parts.append(f"  Point {i+1}: Lat: {coord.lat}, Lng: {coord.lng}")
        
        if request.drone_capabilities:
            cap = request.drone_capabilities
            prompt_parts.append("\n**Drone Capabilities**:")
            prompt_parts.append(f"  - Max Altitude: {cap.max_altitude}m")
            prompt_parts.append(f"  - Max Speed: {cap.max_speed}m/s")
            prompt_parts.append(f"  - Flight Time: {cap.flight_time} minutes")
            prompt_parts.append(f"  - Camera: {'Yes' if cap.has_camera else 'No'}")
            prompt_parts.append(f"  - Gimbal: {'Yes' if cap.has_gimbal else 'No'}")
            if cap.payload_capacity:
                prompt_parts.append(f"  - Payload Capacity: {cap.payload_capacity}kg")
        
        if request.environment:
            env = request.environment
            prompt_parts.append("\n**Environmental Conditions**:")
            if env.wind_speed is not None:
                prompt_parts.append(f"  - Wind Speed: {env.wind_speed}m/s")
            if env.wind_direction is not None:
                prompt_parts.append(f"  - Wind Direction: {env.wind_direction}°")
            if env.temperature is not None:
                prompt_parts.append(f"  - Temperature: {env.temperature}°C")
            if env.visibility is not None:
                prompt_parts.append(f"  - Visibility: {env.visibility}m")
            if env.no_fly_zones:
                prompt_parts.append(f"  - No-Fly Zones: {len(env.no_fly_zones)} defined")
        
        prompt_parts.append("\nIdentify key locations, waypoint types needed, and mission structure.")
        
        return "\n".join(prompt_parts)

    def _build_detailed_prompt(
        self, 
        request: MissionPlanRequest, 
        structure_data: Dict[str, Any], 
        geocoded_locations: Dict[str, Optional[tuple[float, float]]]
    ) -> str:
        """Build the prompt for detailed mission planning"""
        
        prompt_parts = [
            f"Create a detailed drone mission plan based on the following analysis and coordinates:",
            f"\n**Original Objective**: {request.objective.description}",
            f"**Priority**: {request.objective.priority}",
        ]
        
        # Add structure analysis results
        prompt_parts.append(f"\n**Mission Structure Analysis**:")
        prompt_parts.append(f"  - Mission Type: {structure_data.get('mission_type', 'custom')}")
        prompt_parts.append(f"  - Complexity: {structure_data.get('estimated_complexity', 'moderate')}")
        
        if structure_data.get('considerations'):
            prompt_parts.append(f"  - Considerations: {', '.join(structure_data['considerations'])}")
        
        # Add geocoded locations
        prompt_parts.append(f"\n**Precise Coordinates for Key Locations**:")
        for location_name, coords in geocoded_locations.items():
            if coords:
                prompt_parts.append(f"  - {location_name}: Lat: {coords[0]:.6f}, Lng: {coords[1]:.6f}")
            else:
                prompt_parts.append(f"  - {location_name}: GEOCODING FAILED - use fallback coordinates")
        
        # Add waypoint sequence from structure analysis
        if structure_data.get('waypoint_sequence'):
            prompt_parts.append(f"\n**Recommended Waypoint Sequence**:")
            for i, wp in enumerate(structure_data['waypoint_sequence'], 1):
                prompt_parts.append(f"  {i}. {wp.get('type', 'waypoint').upper()}: {wp.get('purpose', 'No description')}")
                if wp.get('location_reference'):
                    prompt_parts.append(f"     Location: {wp['location_reference']}")
        
        # Add original constraints
        if request.objective.constraints:
            prompt_parts.append(f"\n**Constraints**: {', '.join(request.objective.constraints)}")
        
        # Add drone capabilities
        if request.drone_capabilities:
            cap = request.drone_capabilities
            prompt_parts.append("\n**Drone Capabilities**:")
            prompt_parts.append(f"  - Max Altitude: {cap.max_altitude}m")
            prompt_parts.append(f"  - Max Speed: {cap.max_speed}m/s")
            prompt_parts.append(f"  - Flight Time: {cap.flight_time} minutes")
            prompt_parts.append(f"  - Camera: {'Yes' if cap.has_camera else 'No'}")
            prompt_parts.append(f"  - Gimbal: {'Yes' if cap.has_gimbal else 'No'}")
            if cap.payload_capacity:
                prompt_parts.append(f"  - Payload Capacity: {cap.payload_capacity}kg")
        
        # Add environmental conditions
        if request.environment:
            env = request.environment
            prompt_parts.append("\n**Environmental Conditions**:")
            if env.wind_speed is not None:
                prompt_parts.append(f"  - Wind Speed: {env.wind_speed}m/s")
            if env.wind_direction is not None:
                prompt_parts.append(f"  - Wind Direction: {env.wind_direction}°")
            if env.temperature is not None:
                prompt_parts.append(f"  - Temperature: {env.temperature}°C")
            if env.visibility is not None:
                prompt_parts.append(f"  - Visibility: {env.visibility}m")
            if env.no_fly_zones:
                prompt_parts.append(f"  - No-Fly Zones: {len(env.no_fly_zones)} defined")
        
        prompt_parts.append("\nUse the precise coordinates provided above to create an optimized mission plan.")
        prompt_parts.append("Ensure waypoints follow logical sequence and maintain safety margins.")
        prompt_parts.append("Calculate realistic timing and distances based on drone capabilities.")
        
        return "\n".join(prompt_parts)

    def calculate_distance(self, coord1: Coordinate, coord2: Coordinate) -> float:
        """Calculate distance between two coordinates in meters using Haversine formula"""
        
        R = 6371000  # Earth's radius in meters
        
        lat1_rad = math.radians(coord1.lat)
        lat2_rad = math.radians(coord2.lat)
        delta_lat = math.radians(coord2.lat - coord1.lat)
        delta_lng = math.radians(coord2.lng - coord1.lng)
        
        a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        
        horizontal_distance = R * c
        
        # Add altitude difference if available
        if coord1.alt is not None and coord2.alt is not None:
            altitude_diff = abs(coord2.alt - coord1.alt)
            return math.sqrt(horizontal_distance**2 + altitude_diff**2)
        
        return horizontal_distance 