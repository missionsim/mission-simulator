import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface ThreatData {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: string;
  severity: 'low' | 'medium' | 'high';
}

export interface PoiData {
  id: string;
  name: string;
  lat: number;
  lng: number;
  description: string;
}

export interface RestrictedAreaData {
  id: string;
  name: string;
  coordinates: Array<[number, number]>;
}

interface IntelState {
  threats: ThreatData[];
  pois: PoiData[];
  restrictedAreas: RestrictedAreaData[];
  isVisible: {
    threats: boolean;
    pois: boolean;
    restrictedAreas: boolean;
  };
}

const initialState: IntelState = {
  threats: [],
  pois: [],
  restrictedAreas: [],
  isVisible: {
    threats: true,
    pois: true,
    restrictedAreas: true,
  },
};

const intelSlice = createSlice({
  name: 'intel',
  initialState,
  reducers: {
    addThreats: (state, action: PayloadAction<Omit<ThreatData, 'id'>[]>) => {
      const newThreats = action.payload.map(threat => ({
        ...threat,
        id: `threat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      }));
      state.threats.push(...newThreats);
    },
    addPois: (state, action: PayloadAction<Omit<PoiData, 'id'>[]>) => {
      const newPois = action.payload.map(poi => ({
        ...poi,
        id: `poi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      }));
      state.pois.push(...newPois);
    },
    addRestrictedAreas: (state, action: PayloadAction<Omit<RestrictedAreaData, 'id'>[]>) => {
      const newAreas = action.payload.map(area => ({
        ...area,
        id: `area_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      }));
      state.restrictedAreas.push(...newAreas);
    },
    clearAllIntel: (state) => {
      state.threats = [];
      state.pois = [];
      state.restrictedAreas = [];
    },
    clearThreats: (state) => {
      state.threats = [];
    },
    clearPois: (state) => {
      state.pois = [];
    },
    clearRestrictedAreas: (state) => {
      state.restrictedAreas = [];
    },
    toggleVisibility: (state, action: PayloadAction<keyof IntelState['isVisible']>) => {
      state.isVisible[action.payload] = !state.isVisible[action.payload];
    },
    setVisibility: (state, action: PayloadAction<{ type: keyof IntelState['isVisible']; visible: boolean }>) => {
      state.isVisible[action.payload.type] = action.payload.visible;
    },
  },
});

export const {
  addThreats,
  addPois,
  addRestrictedAreas,
  clearAllIntel,
  clearThreats,
  clearPois,
  clearRestrictedAreas,
  toggleVisibility,
  setVisibility,
} = intelSlice.actions;

export default intelSlice.reducer; 