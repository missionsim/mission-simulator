from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Literal
from datetime import datetime
from enum import Enum


class WaypointType(str, Enum):
    WAYPOINT = "waypoint"
    TAKEOFF = "takeoff"
    LAND = "land"
    LOITER = "loiter"
    SURVEY = "survey"
    ORBIT = "orbit"


class Coordinate(BaseModel):
    lat: float = Field(..., ge=-90, le=90, description="Latitude in degrees")
    lng: float = Field(..., ge=-180, le=180, description="Longitude in degrees")
    alt: Optional[float] = Field(None, ge=0, description="Altitude in meters")


class Waypoint(BaseModel):
    id: str = Field(..., description="Unique waypoint identifier")
    type: WaypointType = Field(WaypointType.WAYPOINT, description="Type of waypoint")
    position: Coordinate
    order: int = Field(..., ge=0, description="Order in the mission sequence")
    name: Optional[str] = Field(None, description="Human-readable name")
    speed: Optional[float] = Field(None, ge=0, description="Target speed in m/s")
    loiter_time: Optional[float] = Field(None, ge=0, description="Time to loiter in seconds")
    radius: Optional[float] = Field(None, ge=0, description="Radius for orbit/loiter in meters")
    camera_action: Optional[str] = Field(None, description="Camera action at waypoint")


class MissionObjective(BaseModel):
    description: str = Field(..., description="Natural language description of the mission objective")
    priority: Literal["low", "medium", "high"] = Field("medium", description="Mission priority")
    constraints: Optional[List[str]] = Field(None, description="List of constraints")


class DroneCapabilities(BaseModel):
    max_altitude: float = Field(120, ge=0, description="Maximum altitude in meters")
    max_speed: float = Field(15, ge=0, description="Maximum speed in m/s")
    flight_time: float = Field(30, ge=0, description="Maximum flight time in minutes")
    has_camera: bool = Field(True, description="Whether drone has camera")
    has_gimbal: bool = Field(True, description="Whether drone has gimbal")
    payload_capacity: Optional[float] = Field(None, ge=0, description="Payload capacity in kg")


class EnvironmentConditions(BaseModel):
    wind_speed: Optional[float] = Field(None, ge=0, description="Wind speed in m/s")
    wind_direction: Optional[float] = Field(None, ge=0, le=360, description="Wind direction in degrees")
    temperature: Optional[float] = Field(None, description="Temperature in Celsius")
    visibility: Optional[float] = Field(None, ge=0, description="Visibility in meters")
    no_fly_zones: Optional[List[Dict[str, Any]]] = Field(None, description="No-fly zone definitions")


class MissionPlanRequest(BaseModel):
    objective: MissionObjective
    start_position: Optional[Coordinate] = Field(None, description="Starting position")
    area_of_interest: Optional[List[Coordinate]] = Field(None, description="Area boundary points")
    drone_capabilities: Optional[DroneCapabilities] = Field(None, description="Drone specifications")
    environment: Optional[EnvironmentConditions] = Field(None, description="Environmental conditions")
    existing_waypoints: Optional[List[Waypoint]] = Field(None, description="Existing waypoints to incorporate")
    model: Optional[str] = Field(None, description="LLM model to use")
    include_reasoning: bool = Field(False, description="Include reasoning in response")


class MissionPlan(BaseModel):
    id: str = Field(..., description="Unique mission plan identifier")
    name: str = Field(..., description="Mission name")
    description: str = Field(..., description="Mission description")
    waypoints: List[Waypoint] = Field(..., description="Ordered list of waypoints")
    estimated_duration: float = Field(..., description="Estimated mission duration in minutes")
    total_distance: float = Field(..., description="Total distance in meters")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")


class MissionPlanResponse(BaseModel):
    success: bool = Field(..., description="Whether plan generation was successful")
    plan: Optional[MissionPlan] = Field(None, description="Generated mission plan")
    reasoning: Optional[str] = Field(None, description="LLM reasoning for the plan")
    warnings: Optional[List[str]] = Field(None, description="Any warnings or issues")
    error: Optional[str] = Field(None, description="Error message if generation failed")


class StreamingChunk(BaseModel):
    type: Literal["reasoning", "plan", "waypoint", "status", "error", "structure_analysis", "location_geocoded"] = Field(..., description="Type of streaming chunk")
    content: Optional[str] = Field(None, description="Text content for reasoning/status")
    data: Optional[Dict[str, Any]] = Field(None, description="Structured data for plan/waypoint/structure_analysis/location_geocoded")
    sequence: int = Field(..., description="Sequence number for ordering")
    is_final: bool = Field(False, description="Whether this is the final chunk")


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"] = Field(..., description="Message role")
    content: str = Field(..., description="Message content")


class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(..., description="Chat messages")
    context: Optional[Dict[str, Any]] = Field(None, description="Additional context")
    model: Optional[str] = Field(None, description="LLM model to use")
    stream: bool = Field(True, description="Whether to stream response") 