import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Drone, Telemetry, Coordinates, DroneStatus } from '../../types';

interface DroneState {
  drones: Record<string, Drone>;
  selectedDroneId: string | null;
  isConnecting: boolean;
  connectionError: string | null;
}

const initialState: DroneState = {
  drones: {},
  selectedDroneId: null,
  isConnecting: false,
  connectionError: null,
};

const droneSlice = createSlice({
  name: 'drone',
  initialState,
  reducers: {
    addDrone: (state, action: PayloadAction<Drone>) => {
      state.drones[action.payload.id] = action.payload;
    },
    updateDrone: (state, action: PayloadAction<{ id: string; updates: Partial<Drone> }>) => {
      const { id, updates } = action.payload;
      if (state.drones[id]) {
        state.drones[id] = { ...state.drones[id], ...updates };
      }
    },
    updateDronePosition: (state, action: PayloadAction<{ id: string; position: Coordinates }>) => {
      const { id, position } = action.payload;
      if (state.drones[id]) {
        state.drones[id].position = position;
      }
    },
    updateDroneTelemetry: (state, action: PayloadAction<{ id: string; telemetry: Telemetry }>) => {
      const { id, telemetry } = action.payload;
      if (state.drones[id]) {
        state.drones[id].telemetry = telemetry;
      }
    },
    selectDrone: (state, action: PayloadAction<string | null>) => {
      state.selectedDroneId = action.payload;
    },
    removeDrone: (state, action: PayloadAction<string>) => {
      delete state.drones[action.payload];
      if (state.selectedDroneId === action.payload) {
        state.selectedDroneId = null;
      }
    },
    setConnectionStatus: (state, action: PayloadAction<{ isConnecting: boolean; error?: string }>) => {
      state.isConnecting = action.payload.isConnecting;
      state.connectionError = action.payload.error || null;
    },
    updateDroneStatus: (state, action: PayloadAction<{ id: string; status: DroneStatus }>) => {
      const { id, status } = action.payload;
      if (state.drones[id]) {
        state.drones[id].status = status;
      }
    },
  },
});

export const {
  addDrone,
  updateDrone,
  updateDronePosition,
  updateDroneTelemetry,
  selectDrone,
  removeDrone,
  setConnectionStatus,
  updateDroneStatus,
} = droneSlice.actions;

export default droneSlice.reducer; 