export interface Coordinates {
  lat: number;
  lng: number;
  alt?: number;
}

export interface Waypoint {
  id: string;
  position: Coordinates;
  command: WaypointCommand;
  params: number[];
  frame: CoordinateFrame;
  isCurrent: boolean;
  autocontinue: boolean;
  description?: string;
}

export enum WaypointCommand {
  WAYPOINT = 16,
  LOITER_UNLIM = 17,
  LOITER_TURNS = 18,
  LOITER_TIME = 19,
  RETURN_TO_LAUNCH = 20,
  LAND = 21,
  TAKEOFF = 22,
  DELAY = 93,
  DO_JUMP = 177,
  DO_SET_MODE = 176,
  DO_CHANGE_SPEED = 178,
  DO_SET_HOME = 179,
  DO_SET_RELAY = 181,
  DO_SET_SERVO = 183,
}

export enum CoordinateFrame {
  GLOBAL = 0,
  GLOBAL_RELATIVE_ALT = 3,
  GLOBAL_INT = 5,
  GLOBAL_RELATIVE_ALT_INT = 6,
  GLOBAL_TERRAIN_ALT = 10,
  GLOBAL_TERRAIN_ALT_INT = 11,
}

export interface Mission {
  id: string;
  name: string;
  waypoints: Waypoint[];
  homePosition: Coordinates;
  plannedDate?: Date;
  description?: string;
  aiGenerated?: boolean;
}

export interface Drone {
  id: string;
  name: string;
  type: DroneType;
  status: DroneStatus;
  position: Coordinates;
  heading: number;
  battery: BatteryStatus;
  telemetry: Telemetry;
  armed: boolean;
  mode: FlightMode;
  lastHeartbeat: Date;
}

export enum DroneType {
  QUADCOPTER = 'quadcopter',
  HEXACOPTER = 'hexacopter',
  FIXED_WING = 'fixed_wing',
  VTOL = 'vtol',
}

export enum DroneStatus {
  DISCONNECTED = 'disconnected',
  CONNECTED = 'connected',
  ARMED = 'armed',
  IN_FLIGHT = 'in_flight',
  LANDING = 'landing',
  EMERGENCY = 'emergency',
}

export enum FlightMode {
  MANUAL = 'MANUAL',
  STABILIZE = 'STABILIZE',
  ALT_HOLD = 'ALT_HOLD',
  LOITER = 'LOITER',
  RTL = 'RTL',
  LAND = 'LAND',
  GUIDED = 'GUIDED',
  AUTO = 'AUTO',
  ACRO = 'ACRO',
  POSHOLD = 'POSHOLD',
}

export interface BatteryStatus {
  voltage: number;
  current: number;
  remaining: number; // percentage
  cellCount: number;
}

export interface Telemetry {
  altitude: number;
  groundSpeed: number;
  verticalSpeed: number;
  airSpeed: number;
  throttle: number;
  roll: number;
  pitch: number;
  yaw: number;
  satellites: number;
  hdop: number;
  fixType: number;
}

export interface AIOperationPlan {
  id: string;
  name: string;
  objective: string;
  constraints: OperationConstraints;
  suggestedMissions: Mission[];
  riskAssessment: RiskAssessment;
  weatherConsiderations: WeatherData;
  createdAt: Date;
}

export interface OperationConstraints {
  maxAltitude: number;
  maxDistance: number;
  maxFlightTime: number;
  noFlyZones: Coordinates[][];
  requiredSensors: string[];
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high';
  factors: RiskFactor[];
}

export interface RiskFactor {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  mitigation: string;
}

export interface WeatherData {
  temperature: number;
  windSpeed: number;
  windDirection: number;
  visibility: number;
  condition: string;
} 