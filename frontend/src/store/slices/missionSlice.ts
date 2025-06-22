import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Mission, Waypoint, Coordinates } from '../../types';

interface MissionState {
  missions: Record<string, Mission>;
  currentMissionId: string | null;
  isPlanning: boolean;
  drawingMode: 'waypoint' | 'polygon' | null;
  tempWaypoints: Waypoint[];
}

const initialState: MissionState = {
  missions: {},
  currentMissionId: null,
  isPlanning: false,
  drawingMode: null,
  tempWaypoints: [],
};

const missionSlice = createSlice({
  name: 'mission',
  initialState,
  reducers: {
    createMission: (state, action: PayloadAction<Mission>) => {
      state.missions[action.payload.id] = action.payload;
      state.currentMissionId = action.payload.id;
    },
    updateMission: (state, action: PayloadAction<{ id: string; updates: Partial<Mission> }>) => {
      const { id, updates } = action.payload;
      if (state.missions[id]) {
        state.missions[id] = { ...state.missions[id], ...updates };
      }
    },
    deleteMission: (state, action: PayloadAction<string>) => {
      delete state.missions[action.payload];
      if (state.currentMissionId === action.payload) {
        state.currentMissionId = null;
      }
    },
    selectMission: (state, action: PayloadAction<string | null>) => {
      state.currentMissionId = action.payload;
    },
    addWaypoint: (state, action: PayloadAction<{ missionId: string; waypoint: Waypoint }>) => {
      const { missionId, waypoint } = action.payload;
      if (state.missions[missionId]) {
        state.missions[missionId].waypoints.push(waypoint);
      }
    },
    updateWaypoint: (state, action: PayloadAction<{ missionId: string; waypointId: string; updates: Partial<Waypoint> }>) => {
      const { missionId, waypointId, updates } = action.payload;
      if (state.missions[missionId]) {
        const waypointIndex = state.missions[missionId].waypoints.findIndex(wp => wp.id === waypointId);
        if (waypointIndex !== -1) {
          state.missions[missionId].waypoints[waypointIndex] = {
            ...state.missions[missionId].waypoints[waypointIndex],
            ...updates,
          };
        }
      }
    },
    removeWaypoint: (state, action: PayloadAction<{ missionId: string; waypointId: string }>) => {
      const { missionId, waypointId } = action.payload;
      if (state.missions[missionId]) {
        state.missions[missionId].waypoints = state.missions[missionId].waypoints.filter(
          wp => wp.id !== waypointId
        );
      }
    },
    reorderWaypoints: (state, action: PayloadAction<{ missionId: string; waypoints: Waypoint[] }>) => {
      const { missionId, waypoints } = action.payload;
      if (state.missions[missionId]) {
        state.missions[missionId].waypoints = waypoints;
      }
    },
    setDrawingMode: (state, action: PayloadAction<'waypoint' | 'polygon' | null>) => {
      state.drawingMode = action.payload;
    },
    setPlanningMode: (state, action: PayloadAction<boolean>) => {
      state.isPlanning = action.payload;
    },
    setTempWaypoints: (state, action: PayloadAction<Waypoint[]>) => {
      state.tempWaypoints = action.payload;
    },
    clearTempWaypoints: (state) => {
      state.tempWaypoints = [];
    },
  },
});

export const {
  createMission,
  updateMission,
  deleteMission,
  selectMission,
  addWaypoint,
  updateWaypoint,
  removeWaypoint,
  reorderWaypoints,
  setDrawingMode,
  setPlanningMode,
  setTempWaypoints,
  clearTempWaypoints,
} = missionSlice.actions;

export default missionSlice.reducer; 