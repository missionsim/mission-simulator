import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { useDispatch } from 'react-redux';
import { createMission } from '../../store/slices/missionSlice';
import { v4 as uuidv4 } from 'uuid';

interface NewMissionDialogProps {
  open: boolean;
  onClose: () => void;
}

const NewMissionDialog: React.FC<NewMissionDialogProps> = ({ open, onClose }) => {
  const dispatch = useDispatch();
  const [missionName, setMissionName] = useState('');
  const [description, setDescription] = useState('');
  const [missionType, setMissionType] = useState('survey');

  const handleCreate = () => {
    if (missionName.trim()) {
      const newMission = {
        id: uuidv4(),
        name: missionName,
        waypoints: [],
        homePosition: { lat: 37.7749, lng: -122.4194 }, // Default SF coordinates
        description,
        plannedDate: new Date(),
      };
      
      dispatch(createMission(newMission));
      handleClose();
    }
  };

  const handleClose = () => {
    setMissionName('');
    setDescription('');
    setMissionType('survey');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create New Mission</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Mission Name"
            value={missionName}
            onChange={(e) => setMissionName(e.target.value)}
            fullWidth
            required
            autoFocus
          />
          
          <FormControl fullWidth>
            <InputLabel>Mission Type</InputLabel>
            <Select
              value={missionType}
              onChange={(e) => setMissionType(e.target.value)}
              label="Mission Type"
            >
              <MenuItem value="survey">Survey</MenuItem>
              <MenuItem value="mapping">Mapping</MenuItem>
              <MenuItem value="inspection">Inspection</MenuItem>
              <MenuItem value="delivery">Delivery</MenuItem>
              <MenuItem value="search">Search & Rescue</MenuItem>
            </Select>
          </FormControl>
          
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            rows={3}
            fullWidth
          />
          
          <Typography variant="caption" color="text.secondary">
            After creating the mission, click on the map to add waypoints.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button 
          onClick={handleCreate} 
          variant="contained" 
          disabled={!missionName.trim()}
        >
          Create Mission
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default NewMissionDialog; 