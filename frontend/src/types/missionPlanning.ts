export interface Coordinate {
  lat: number;
  lng: number;
  alt?: number;
}

export interface MissionObjective {
  description: string;
  priority: 'low' | 'medium' | 'high';
  constraints?: string[];
}

export interface DroneCapabilities {
  max_altitude: number;
  max_speed: number;
  flight_time: number;
  has_camera: boolean;
  has_gimbal: boolean;
  payload_capacity?: number;
}

export interface EnvironmentConditions {
  wind_speed?: number;
  wind_direction?: number;
  temperature?: number;
  visibility?: number;
  no_fly_zones?: any[];
}

export interface Waypoint {
  id: string;
  type: 'waypoint' | 'takeoff' | 'land' | 'loiter' | 'survey' | 'orbit';
  position: Coordinate;
  order: number;
  name?: string;
  speed?: number;
  loiter_time?: number;
  radius?: number;
  camera_action?: string;
}

export interface MissionPlanRequest {
  objective: MissionObjective;
  start_position?: Coordinate;
  area_of_interest?: Coordinate[];
  drone_capabilities?: DroneCapabilities;
  environment?: EnvironmentConditions;
  existing_waypoints?: Waypoint[];
  model?: string;
  include_reasoning?: boolean;
}

export interface MissionPlan {
  id: string;
  name: string;
  description: string;
  waypoints: Waypoint[];
  estimated_duration: number;
  total_distance: number;
  created_at: Date;
  metadata?: any;
}

export interface MissionPlanResponse {
  success: boolean;
  plan?: MissionPlan;
  reasoning?: string;
  warnings?: string[];
  error?: string;
}

export interface StreamingChunk {
  type: 'reasoning' | 'plan' | 'waypoint' | 'status' | 'error';
  content?: string;
  data?: any;
  sequence: number;
  is_final: boolean;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  context?: any;
  model?: string;
  stream?: boolean;
} 