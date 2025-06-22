import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Box,
  Chip,
  Select,
  MenuItem,
  FormControl,
  Tooltip,
} from '@mui/material';
import {
  FlightTakeoff,
  FlightLand,
  Home,
  Stop,
  PlayArrow,
  Wifi,
  WifiOff,
  Battery90,
  BatteryAlert,
  Psychology,
  Map,
} from '@mui/icons-material';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { DroneStatus, FlightMode } from '../../types';

interface TopbarProps {
  onOpenAIPanel: () => void;
}

const Topbar: React.FC<TopbarProps> = ({ onOpenAIPanel }) => {
  const dispatch = useDispatch();
  const selectedDroneId = useSelector((state: RootState) => state.drone.selectedDroneId);
  const selectedDrone = useSelector((state: RootState) => 
    selectedDroneId ? state.drone.drones[selectedDroneId] : null
  );
  const currentMissionId = useSelector((state: RootState) => state.mission.currentMissionId);
  const currentMission = useSelector((state: RootState) => 
    currentMissionId ? state.mission.missions[currentMissionId] : null
  );

  const getConnectionIcon = () => {
    if (!selectedDrone) return <WifiOff />;
    return selectedDrone.status !== DroneStatus.DISCONNECTED ? <Wifi /> : <WifiOff />;
  };

  const getConnectionColor = () => {
    if (!selectedDrone) return 'default';
    return selectedDrone.status !== DroneStatus.DISCONNECTED ? 'success' : 'error';
  };

  const getBatteryIcon = () => {
    if (!selectedDrone) return <Battery90 />;
    return selectedDrone.battery.remaining > 20 ? <Battery90 /> : <BatteryAlert />;
  };

  const getBatteryColor = () => {
    if (!selectedDrone) return 'inherit';
    if (selectedDrone.battery.remaining > 50) return 'success.main';
    if (selectedDrone.battery.remaining > 20) return 'warning.main';
    return 'error.main';
  };

  return (
    <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
      <Toolbar>
        <img src="/mission_simulator_logo.png" alt="Mission Simulator" style={{ width: '32px', height: '32px', marginRight: '10px', filter: 'grayscale(100%) invert(1)' }} />

        <Typography variant="h6" component="div" sx={{ mr: 3, fontSize: '14px' }}>
          Mission Simulator
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexGrow: 1 }}>
          {/* Current Mission */}
          {currentMission && (
            <Chip
              icon={<Map />}
              label={`Mission: ${currentMission.name} (${currentMission.waypoints.length} waypoints)`}
              variant="outlined"
              size="small"
              sx={{ padding: '6px 8px', height: 'auto', fontSize: '12px' }}
            />
          )}

          {/* Connection Status */}
          <Chip
            icon={getConnectionIcon()}
            label={selectedDrone ? `${selectedDrone.name}` : 'No Drone Connected'}
            color={getConnectionColor() as any}
            variant="outlined"
            sx={{ padding: '2px 8px', height: 'auto', fontSize: '12px' }}
          />

          {/* Flight Mode Selector */}
          {selectedDrone && (
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <Select
                value={selectedDrone.mode}
                displayEmpty
                sx={{ height: 32, fontSize: '12px' }}
              >
                {Object.values(FlightMode).map((mode) => (
                  <MenuItem key={mode} value={mode}>
                    {mode}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Battery Status */}
          {selectedDrone && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ color: getBatteryColor() }}>{getBatteryIcon()}</Box>
              <Typography variant="body2" sx={{ color: getBatteryColor() }}>
                {selectedDrone.battery.remaining}%
              </Typography>
            </Box>
          )}

          {/* Telemetry Info */}
          {selectedDrone && selectedDrone.status === DroneStatus.IN_FLIGHT && (
            <>
              <Chip label={`Alt: ${selectedDrone.telemetry.altitude.toFixed(1)}m`} size="small" />
              <Chip label={`Speed: ${selectedDrone.telemetry.groundSpeed.toFixed(1)}m/s`} size="small" />
              <Chip label={`Sats: ${selectedDrone.telemetry.satellites}`} size="small" />
            </>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          {/* AI Planning Button */}
          <Tooltip title="AI Mission Planning">
            <IconButton color="inherit" onClick={onOpenAIPanel}>
              <Psychology />
            </IconButton>
          </Tooltip>

          {/* Action Buttons */}
          <Tooltip title="Arm/Disarm">
            <IconButton color="inherit" disabled={!selectedDrone}>
              <PlayArrow />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Takeoff">
            <IconButton color="inherit" disabled={!selectedDrone || !selectedDrone.armed}>
              <FlightTakeoff />
            </IconButton>
          </Tooltip>

          <Tooltip title="Land">
            <IconButton color="inherit" disabled={!selectedDrone || selectedDrone.status !== DroneStatus.IN_FLIGHT}>
              <FlightLand />
            </IconButton>
          </Tooltip>

          <Tooltip title="Return to Launch">
            <IconButton color="inherit" disabled={!selectedDrone || selectedDrone.status !== DroneStatus.IN_FLIGHT}>
              <Home />
            </IconButton>
          </Tooltip>

          <Tooltip title="Emergency Stop">
            <IconButton color="error" disabled={!selectedDrone}>
              <Stop />
            </IconButton>
          </Tooltip>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Topbar; 