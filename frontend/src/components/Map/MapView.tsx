import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Box, Paper, ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';
import { AddLocation, Timeline, Pentagon, LocationOn, ThreeDRotation, Map as MapIcon, PlayArrow, Stop, Replay, Pause } from '@mui/icons-material';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { Coordinates, Waypoint, WaypointCommand } from '../../types';
import { addWaypoint, setDrawingMode } from '../../store/slices/missionSlice';
import { toggle3D } from '../../store/slices/mapViewSlice';
import { playAnimation, pauseAnimation, stopAnimation, resetAnimation } from '../../store/slices/animationSlice';
import { usePathAnimation } from '../../hooks/usePathAnimation';
import ThreeMap3D from './ThreeMap3D';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in React Leaflet using inline SVG
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUiIGhlaWdodD0iNDEiIHZpZXdCb3g9IjAgMCAyNSA0MSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyLjUgMEMyMC4wNjUgMCAyNSA2LjI2NTAxIDI1IDEzLjU2NTNDMjUgMjAuODY1NSAxOS41MzUgMzQuNzYwOSAxMi41IDQxQzUuNDY1IDM0Ljc2MDkgMCAyMC44NjU1IDAgMTMuNTY1M0MwIDYuMjY1MDEgNC45MzUgMCAxMi41IDBaIiBmaWxsPSIjMjE5NmYzIi8+CjxjaXJjbGUgY3g9IjEyLjUiIGN5PSIxMy41IiByPSI0LjUiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPg==',
  shadowUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDEiIGhlaWdodD0iNDEiIHZpZXdCb3g9IjAgMCA0MSA0MSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGVsbGlwc2UgY3g9IjIwLjUiIGN5PSIzNC41IiByeD0iMjAuNSIgcnk9IjYuNSIgZmlsbD0iYmxhY2siIGZpbGwtb3BhY2l0eT0iMC4zIi8+Cjwvc3ZnPg==',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Custom waypoint icon
const waypointIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiMyMTk2ZjMiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMiIvPgo8dGV4dCB4PSIxMiIgeT0iMTYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IndoaXRlIiBmb250LXNpemU9IjEyIiBmb250LWZhbWlseT0iQXJpYWwiPjE8L3RleHQ+Cjwvc3ZnPg==',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12],
});

// Function to create waypoint icon with number
const createWaypointIcon = (number: number) => {
  const svg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" fill="#2196f3" stroke="white" stroke-width="2"/>
    <text x="12" y="16" text-anchor="middle" fill="white" font-size="12" font-family="Arial">${number}</text>
  </svg>`;
  
  const svgUrl = `data:image/svg+xml;base64,${btoa(svg)}`;
  
  return new L.Icon({
    iconUrl: svgUrl,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
};

// Drone icon
const droneIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iOCIgZmlsbD0iIzRjYWY1MCIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIi8+CjxwYXRoIGQ9Ik0xNiA4VjI0TTggMTZIMjQiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMiIvPgo8L3N2Zz4=',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

// Threat icon - Red warning triangle
const threatIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMjIgMjBIMkwxMiAyWiIgZmlsbD0iI2Y0NDMzNiIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIi8+CjxwYXRoIGQ9Ik0xMiA5VjEzTTEyIDE3SDE2IiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4=',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12],
});

// POI icon - Blue info marker
const poiIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiMyMTk2ZjMiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMiIvPgo8cGF0aCBkPSJNMTIgOFYxMk0xMiAxNkgxNiIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KPC9zdmc+',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12],
});

function MapEventHandler() {
  const dispatch = useDispatch();
  const drawingMode = useSelector((state: RootState) => state.mission.drawingMode);
  const currentMissionId = useSelector((state: RootState) => state.mission.currentMissionId);

  useMapEvents({
    click: (e) => {
      if (drawingMode === 'waypoint' && currentMissionId) {
        const newWaypoint: Waypoint = {
          id: `wp_${Date.now()}`,
          position: {
            lat: e.latlng.lat,
            lng: e.latlng.lng,
            alt: 50, // Default altitude
          },
          command: WaypointCommand.WAYPOINT,
          params: [0, 0, 0, 0],
          frame: 3, // GLOBAL_RELATIVE_ALT
          isCurrent: false,
          autocontinue: true,
        };
        dispatch(addWaypoint({ missionId: currentMissionId, waypoint: newWaypoint }));
      }
    },
  });

  return null;
}

const MapView: React.FC = () => {
  const dispatch = useDispatch();
  const selectedDroneId = useSelector((state: RootState) => state.drone.selectedDroneId);
  const selectedDrone = useSelector((state: RootState) => 
    selectedDroneId ? state.drone.drones[selectedDroneId] : null
  );
  const currentMissionId = useSelector((state: RootState) => state.mission.currentMissionId);
  const currentMission = useSelector((state: RootState) => 
    currentMissionId ? state.mission.missions[currentMissionId] : null
  );
  const drawingMode = useSelector((state: RootState) => state.mission.drawingMode);
  const intelData = useSelector((state: RootState) => state.intel);
  const is3D = useSelector((state: RootState) => state.mapView.is3D);
  const animationState = useSelector((state: RootState) => state.animation);
  
  // Initialize path animation
  usePathAnimation();
  
  // You'll need to set your Google Maps API key here
  // For production, this should be in an environment variable
  const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';

  console.log('MapView rendered - API Key:', GOOGLE_MAPS_API_KEY ? 'Present' : 'Missing');
  console.log('Current view mode:', is3D ? '3D' : '2D');

  const handleDrawingModeChange = (
    event: React.MouseEvent<HTMLElement>,
    newMode: 'waypoint' | 'polygon' | null,
  ) => {
    dispatch(setDrawingMode(newMode));
  };

  const handle3DToggle = () => {
    console.log('3D toggle clicked, switching from', is3D ? '3D' : '2D', 'to', !is3D ? '3D' : '2D');
    dispatch(toggle3D());
  };

  const handlePlayPause = () => {
    if (animationState.isPlaying) {
      dispatch(pauseAnimation());
    } else {
      dispatch(playAnimation());
    }
  };

  const handleStop = () => {
    dispatch(stopAnimation());
  };

  const handleReset = () => {
    dispatch(resetAnimation());
  };

  return (
    <Box sx={{ position: 'fixed', height: 'calc(100vh - 70px)', width: 'calc(100vw - 216px)', overflow: 'hidden' }}>
      {is3D && GOOGLE_MAPS_API_KEY ? (
        <ThreeMap3D apiKey={GOOGLE_MAPS_API_KEY} />
      ) : (
        <MapContainer
          center={[37.7749, -122.4194]} // Default to San Francisco
          zoom={13}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapEventHandler />

        {/* Render drone position */}
        {selectedDrone && (
          <Marker
            position={[
              animationState.animatedDronePosition?.lat || selectedDrone.position.lat,
              animationState.animatedDronePosition?.lng || selectedDrone.position.lng
            ]}
            icon={droneIcon}
          >
            <Popup>
              <div>
                <strong>{selectedDrone.name}</strong>
                <br />
                Alt: {selectedDrone.telemetry.altitude.toFixed(1)}m
                <br />
                Speed: {selectedDrone.telemetry.groundSpeed.toFixed(1)}m/s
                {animationState.isPlaying && (
                  <>
                    <br />
                    <em>Animated position</em>
                  </>
                )}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Render mission waypoints */}
        {currentMission && (
          <>
            {currentMission.waypoints.map((waypoint, index) => (
              <Marker
                key={waypoint.id}
                position={[waypoint.position.lat, waypoint.position.lng]}
                icon={createWaypointIcon(index + 1)}
              >
                <Popup>
                  <div>
                    <strong>Waypoint {index + 1}</strong>
                    <br />
                    Alt: {waypoint.position.alt}m
                    <br />
                    Command: {WaypointCommand[waypoint.command]}
                  </div>
                </Popup>
              </Marker>
            ))}
            
            {/* Draw path between waypoints */}
            {currentMission.waypoints.length > 1 && (
              <Polyline
                positions={currentMission.waypoints.map(wp => [wp.position.lat, wp.position.lng])}
                color="#2196f3"
                weight={3}
                opacity={0.7}
              />
            )}
          </>
        )}

        {/* Render Intel Data */}
        {/* Threats */}
        {intelData.isVisible.threats && intelData.threats.map((threat) => (
          <Marker
            key={threat.id}
            position={[threat.lat, threat.lng]}
            icon={threatIcon}
          >
            <Popup>
              <div>
                <strong style={{ color: '#f44336' }}>⚠️ THREAT</strong>
                <br />
                <strong>{threat.name}</strong>
                <br />
                Type: {threat.type}
                <br />
                Severity: <span style={{ 
                  color: threat.severity === 'high' ? '#f44336' : 
                        threat.severity === 'medium' ? '#ff9800' : '#4caf50',
                  fontWeight: 'bold',
                  textTransform: 'uppercase'
                }}>
                  {threat.severity}
                </span>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Points of Interest */}
        {intelData.isVisible.pois && intelData.pois.map((poi) => (
          <Marker
            key={poi.id}
            position={[poi.lat, poi.lng]}
            icon={poiIcon}
          >
            <Popup>
              <div>
                <strong style={{ color: '#2196f3' }}>📍 POI</strong>
                <br />
                <strong>{poi.name}</strong>
                <br />
                {poi.description}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Restricted Areas - TODO: Add polygon rendering */}
        {intelData.isVisible.restrictedAreas && intelData.restrictedAreas.map((area) => {
          // For now, just show the center point of the area
          if (area.coordinates && area.coordinates.length > 0) {
            const centerLat = area.coordinates.reduce((sum, coord) => sum + coord[1], 0) / area.coordinates.length;
            const centerLng = area.coordinates.reduce((sum, coord) => sum + coord[0], 0) / area.coordinates.length;
            
            return (
              <Marker
                key={area.id}
                position={[centerLat, centerLng]}
                icon={new L.Icon({
                  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3QgeD0iMyIgeT0iMyIgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiBmaWxsPSIjZmY5ODAwIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiLz4KPHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMiIgZmlsbD0ibm9uZSI+PC9zdHJva2U+CjxwYXRoIGQ9Ik0xMiA4VjE2TTggMTJIMTYiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMiIvPgo8L3N2Zz4=',
                  iconSize: [24, 24],
                  iconAnchor: [12, 12],
                  popupAnchor: [0, -12],
                })}
              >
                <Popup>
                  <div>
                    <strong style={{ color: '#ff9800' }}>🚫 RESTRICTED AREA</strong>
                    <br />
                    <strong>{area.name}</strong>
                    <br />
                    Coordinates: {area.coordinates.length} points
                  </div>
                </Popup>
              </Marker>
            );
          }
          return null;
        })}
        </MapContainer>
      )}

      {/* Drawing Mode Controls */}
      <Paper
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          p: 1,
          backgroundColor: 'rgba(26, 26, 26, 0.9)',
          backdropFilter: 'blur(10px)',
          zIndex: 1000,
          display: 'flex',
          gap: 1,
        }}
      >
        {/* Animation Controls */}
        {currentMission && currentMission.waypoints.length > 1 && (
          <>
            <ToggleButton
              value="play"
              selected={false}
              onClick={handlePlayPause}
              size="small"
              sx={{ 
                border: '1px solid rgba(255, 255, 255, 0.23)',
                color: animationState.isPlaying ? '#4caf50' : '#ffffff',
              }}
            >
              <Tooltip title={animationState.isPlaying ? "Pause Animation" : "Play Animation"}>
                {animationState.isPlaying ? <Pause /> : <PlayArrow />}
              </Tooltip>
            </ToggleButton>
            
            <ToggleButton
              value="stop"
              selected={false}
              onClick={handleStop}
              size="small"
              sx={{ 
                border: '1px solid rgba(255, 255, 255, 0.23)',
                color: '#f44336',
              }}
            >
              <Tooltip title="Stop Animation">
                <Stop />
              </Tooltip>
            </ToggleButton>
            
            <ToggleButton
              value="reset"
              selected={false}
              onClick={handleReset}
              size="small"
              sx={{ 
                border: '1px solid rgba(255, 255, 255, 0.23)',
              }}
            >
              <Tooltip title="Reset Animation">
                <Replay />
              </Tooltip>
            </ToggleButton>
          </>
        )}

        {/* 2D/3D Toggle */}
        <ToggleButton
          value="3d"
          selected={is3D}
          onChange={handle3DToggle}
          size="small"
          sx={{ 
            border: '1px solid rgba(255, 255, 255, 0.23)',
            '&.Mui-selected': {
              backgroundColor: 'rgba(33, 150, 243, 0.2)',
              color: '#2196f3',
            }
          }}
        >
          <Tooltip title={is3D ? "Switch to 2D View" : "Switch to 3D View"}>
            {is3D ? <MapIcon /> : <ThreeDRotation />}
          </Tooltip>
        </ToggleButton>

        {/* Drawing Mode Controls */}
        <ToggleButtonGroup
          value={drawingMode}
          exclusive
          onChange={handleDrawingModeChange}
          size="small"
        >
          <ToggleButton value="waypoint">
            <Tooltip title="Add Waypoints">
              <AddLocation />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="polygon">
            <Tooltip title="Draw Polygon">
              <Pentagon />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>
      </Paper>
    </Box>
  );
};

export default MapView; 