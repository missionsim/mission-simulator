import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Box,
  Typography,
  Chip,
  Divider,
  Button,
} from '@mui/material';
import {
  Map,
  Delete,
  CloudDownload,
  CloudUpload,
  Psychology,
} from '@mui/icons-material';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { selectMission, deleteMission } from '../../store/slices/missionSlice';

interface MissionSelectorProps {
  open: boolean;
  onClose: () => void;
}

const MissionSelector: React.FC<MissionSelectorProps> = ({ open, onClose }) => {
  const dispatch = useDispatch();
  const missions = useSelector((state: RootState) => state.mission.missions);
  const currentMissionId = useSelector((state: RootState) => state.mission.currentMissionId);
  const missionList = Object.values(missions);

  const handleSelectMission = (missionId: string) => {
    dispatch(selectMission(missionId));
    onClose();
  };

  const handleDeleteMission = (e: React.MouseEvent, missionId: string) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this mission?')) {
      dispatch(deleteMission(missionId));
    }
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return 'Not planned';
    return new Date(date).toLocaleDateString();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">Load Mission</Typography>
          <Box>
            <IconButton size="small" title="Import Mission">
              <CloudDownload />
            </IconButton>
            <IconButton size="small" title="Export Mission">
              <CloudUpload />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent>
        {missionList.length > 0 ? (
          <List>
            {missionList.map((mission) => (
              <React.Fragment key={mission.id}>
                <ListItem disablePadding>
                  <ListItemButton 
                    onClick={() => handleSelectMission(mission.id)}
                    selected={mission.id === currentMissionId}
                  >
                    <ListItemIcon>
                      <Map />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body1">
                            {mission.name}
                          </Typography>
                          {mission.aiGenerated && (
                            <Chip 
                              icon={<Psychology />} 
                              label="AI" 
                              size="small" 
                              color="primary"
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box sx={{ mt: 0.5 }}>
                          <Typography variant="caption" component="div">
                            {mission.waypoints.length} waypoints
                          </Typography>
                          <Typography variant="caption" component="div">
                            {mission.description || 'No description'}
                          </Typography>
                          <Typography variant="caption" component="div" sx={{ mt: 0.5 }}>
                            Created: {formatDate(mission.plannedDate)}
                          </Typography>
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <IconButton 
                        edge="end" 
                        onClick={(e) => handleDeleteMission(e, mission.id)}
                        disabled={mission.id === currentMissionId}
                      >
                        <Delete />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItemButton>
                </ListItem>
                <Divider />
              </React.Fragment>
            ))}
          </List>
        ) : (
          <Box sx={{ 
            textAlign: 'center', 
            py: 4,
            color: 'text.secondary',
          }}>
            <Map sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
            <Typography variant="body2">
              No missions available
            </Typography>
            <Typography variant="caption">
              Create a new mission to get started
            </Typography>
          </Box>
        )}
        
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={onClose}>Close</Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default MissionSelector; 