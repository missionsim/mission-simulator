import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Coordinates } from '../../types';

interface AnimationState {
  isPlaying: boolean;
  currentTime: number; // Current animation time in seconds
  duration: number; // Total animation duration in seconds
  speed: number; // Animation speed multiplier (1.0 = normal speed)
  animatedDronePosition: Coordinates | null;
  animatedDroneHeading: number;
  currentWaypointIndex: number;
  progress: number; // Progress from 0 to 1
}

const initialState: AnimationState = {
  isPlaying: false,
  currentTime: 0,
  duration: 30, // Default 30 seconds for full path
  speed: 1.0,
  animatedDronePosition: null,
  animatedDroneHeading: 0,
  currentWaypointIndex: 0,
  progress: 0,
};

const animationSlice = createSlice({
  name: 'animation',
  initialState,
  reducers: {
    playAnimation: (state) => {
      state.isPlaying = true;
    },
    pauseAnimation: (state) => {
      state.isPlaying = false;
    },
    stopAnimation: (state) => {
      state.isPlaying = false;
      state.currentTime = 0;
      state.progress = 0;
      state.currentWaypointIndex = 0;
      state.animatedDronePosition = null;
    },
    resetAnimation: (state) => {
      state.isPlaying = false;
      state.currentTime = 0;
      state.progress = 0;
      state.currentWaypointIndex = 0;
      state.animatedDronePosition = null;
      state.animatedDroneHeading = 0;
    },
    setAnimationTime: (state, action: PayloadAction<number>) => {
      state.currentTime = Math.max(0, Math.min(action.payload, state.duration));
      state.progress = state.duration > 0 ? state.currentTime / state.duration : 0;
    },
    setAnimationSpeed: (state, action: PayloadAction<number>) => {
      state.speed = Math.max(0.1, Math.min(5.0, action.payload));
    },
    setAnimationDuration: (state, action: PayloadAction<number>) => {
      state.duration = Math.max(1, action.payload);
      state.progress = state.duration > 0 ? state.currentTime / state.duration : 0;
    },
    updateAnimatedDronePosition: (state, action: PayloadAction<{
      position: Coordinates;
      heading: number;
      waypointIndex: number;
    }>) => {
      state.animatedDronePosition = action.payload.position;
      state.animatedDroneHeading = action.payload.heading;
      state.currentWaypointIndex = action.payload.waypointIndex;
    },
    tick: (state, action: PayloadAction<number>) => {
      if (state.isPlaying) {
        const deltaTime = action.payload * state.speed;
        state.currentTime = Math.min(state.currentTime + deltaTime, state.duration);
        state.progress = state.duration > 0 ? state.currentTime / state.duration : 0;
        
        // Auto-pause when animation completes
        if (state.currentTime >= state.duration) {
          state.isPlaying = false;
        }
      }
    },
  },
});

export const {
  playAnimation,
  pauseAnimation,
  stopAnimation,
  resetAnimation,
  setAnimationTime,
  setAnimationSpeed,
  setAnimationDuration,
  updateAnimatedDronePosition,
  tick,
} = animationSlice.actions;

export default animationSlice.reducer; 