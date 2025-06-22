import React, { useState } from 'react';
import {
  Drawer,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  Chip,
} from '@mui/material';
import {
  LocationOn,
  Delete,
  Edit,
  DragIndicator,
  Add,
  FlightTakeoff,
  FlightLand,
  Home,
  Close,
} from '@mui/icons-material';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { WaypointCommand } from '../../types';
import { updateWaypoint, removeWaypoint } from '../../store/slices/missionSlice';

interface WaypointsPanelProps {
  open: boolean;
  onClose: () => void;
}

const WaypointsPanel: React.FC<WaypointsPanelProps> = ({ open, onClose }) => {
  const dispatch = useDispatch();
  const currentMissionId = useSelector((state: RootState) => state.mission.currentMissionId);
  const currentMission = useSelector((state: RootState) => 
    currentMissionId ? state.mission.missions[currentMissionId] : null
  );
  const [editingWaypoint, setEditingWaypoint] = useState<string | null>(null);
  const [editAltitude, setEditAltitude] = useState<number>(50);

  const getWaypointIcon = (command: WaypointCommand) => {
    switch (command) {
      case WaypointCommand.TAKEOFF:
        return <FlightTakeoff />;
      case WaypointCommand.LAND:
        return <FlightLand />;
      case WaypointCommand.RETURN_TO_LAUNCH:
        return <Home />;
      default:
        return <LocationOn />;
    }
  };

  const getWaypointLabel = (command: WaypointCommand) => {
    switch (command) {
      case WaypointCommand.TAKEOFF:
        return 'Takeoff';
      case WaypointCommand.LAND:
        return 'Land';
      case WaypointCommand.RETURN_TO_LAUNCH:
        return 'Return to Launch';
      case WaypointCommand.LOITER_TIME:
        return 'Loiter Time';
      case WaypointCommand.LOITER_TURNS:
        return 'Loiter Turns';
      default:
        return 'Waypoint';
    }
  };

  const handleDeleteWaypoint = (waypointId: string) => {
    if (currentMissionId) {
      dispatch(removeWaypoint({ missionId: currentMissionId, waypointId }));
    }
  };

  const handleClearAll = () => {
    if (currentMissionId && currentMission && window.confirm('Are you sure you want to clear all waypoints?')) {
      // Remove all waypoints one by one
      currentMission.waypoints.forEach((waypoint) => {
        dispatch(removeWaypoint({ missionId: currentMissionId, waypointId: waypoint.id }));
      });
    }
  };

  const handleUpdateAltitude = (waypointId: string) => {
    if (currentMissionId) {
      dispatch(updateWaypoint({
        missionId: currentMissionId,
        waypointId,
        updates: { position: { ...currentMission!.waypoints.find(w => w.id === waypointId)!.position, alt: editAltitude } }
      }));
      setEditingWaypoint(null);
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      variant="persistent"
      ModalProps={{
        keepMounted: true,
        BackdropProps: {
          invisible: true,
        },
      }}
      sx={{
        '& .MuiDrawer-paper': {
          width: 360,
          backgroundColor: 'background.paper',
          boxShadow: '-4px 0 8px rgba(0, 0, 0, 0.3)',
          position: 'absolute',
          height: 'calc(100% - 64px)',
          top: 64,
        },
      }}
    >
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">
            Waypoints
          </Typography>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
        
        {currentMission ? (
          <>
            <Box sx={{ mb: 2 }}>
              <Chip 
                label={`Mission: ${currentMission.name}`} 
                color="primary" 
                sx={{ mr: 1 }}
              />
              <Chip 
                label={`${currentMission.waypoints.length} waypoints`} 
                size="small"
              />
            </Box>

            <Divider sx={{ mb: 2 }} />

            {currentMission.waypoints.length > 0 ? (
              <List>
                {currentMission.waypoints.map((waypoint, index) => (
                  <ListItem key={waypoint.id} sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <DragIndicator sx={{ cursor: 'grab' }} />
                    </ListItemIcon>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      {getWaypointIcon(waypoint.command)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2">
                            {index + 1}. {getWaypointLabel(waypoint.command)}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        editingWaypoint === waypoint.id ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                            <TextField
                              size="small"
                              label="Altitude (m)"
                              type="number"
                              value={editAltitude}
                              onChange={(e) => setEditAltitude(Number(e.target.value))}
                              sx={{ width: 100 }}
                            />
                            <Button 
                              size="small" 
                              onClick={() => handleUpdateAltitude(waypoint.id)}
                            >
                              Save
                            </Button>
                            <Button 
                              size="small" 
                              onClick={() => setEditingWaypoint(null)}
                            >
                              Cancel
                            </Button>
                          </Box>
                        ) : (
                          <>
                            <Typography variant="caption" component="div">
                              Lat: {waypoint.position.lat.toFixed(6)}
                            </Typography>
                            <Typography variant="caption" component="div">
                              Lng: {waypoint.position.lng.toFixed(6)}
                            </Typography>
                            <Typography variant="caption" component="div">
                              Alt: {waypoint.position.alt}m
                            </Typography>
                          </>
                        )
                      }
                    />
                    <ListItemSecondaryAction>
                      <IconButton 
                        edge="end" 
                        size="small"
                        onClick={() => {
                          setEditingWaypoint(waypoint.id);
                          setEditAltitude(waypoint.position.alt || 50);
                        }}
                        sx={{ mr: 1 }}
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton 
                        edge="end" 
                        size="small"
                        onClick={() => handleDeleteWaypoint(waypoint.id)}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Box sx={{ 
                textAlign: 'center', 
                py: 4,
                color: 'text.secondary',
              }}>
                <LocationOn sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                <Typography variant="body2">
                  No waypoints added yet
                </Typography>
                <Typography variant="caption">
                  Click on the map to add waypoints
                </Typography>
              </Box>
            )}

            <Divider sx={{ my: 2 }} />

            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                fullWidth
                startIcon={<Add />}
                variant="outlined"
                size="small"
                disabled={!currentMission}
              >
                Add Special
              </Button>
              <Button
                fullWidth
                startIcon={<Delete />}
                variant="outlined"
                color="error"
                size="small"
                disabled={!currentMission || currentMission.waypoints.length === 0}
                onClick={handleClearAll}
              >
                Clear All
              </Button>
            </Box>
          </>
        ) : (
          <Box sx={{ 
            textAlign: 'center', 
            py: 4,
            color: 'text.secondary',
          }}>
            <Typography variant="body2">
              No mission selected
            </Typography>
            <Typography variant="caption">
              Create or select a mission first
            </Typography>
          </Box>
        )}
      </Box>
    </Drawer>
  );
};

export default WaypointsPanel; 