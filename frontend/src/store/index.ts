import { configureStore } from '@reduxjs/toolkit';
import droneReducer from './slices/droneSlice';
import missionReducer from './slices/missionSlice';
import aiPlanningReducer from './slices/aiPlanningSlice';
import intelReducer from './slices/intelSlice';
import mapViewReducer from './slices/mapViewSlice';
import animationReducer from './slices/animationSlice';

export const store = configureStore({
  reducer: {
    drone: droneReducer,
    mission: missionReducer,
    aiPlanning: aiPlanningReducer,
    intel: intelReducer,
    mapView: mapViewReducer,
    animation: animationReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['drone/updateDrone', 'mission/updateMission'],
        ignoredPaths: ['drone.drones', 'mission.missions'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch; 