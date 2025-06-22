import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface MapViewState {
  is3D: boolean;
  googleMapsApiKey: string | null;
  cameraPosition: {
    lat: number;
    lng: number;
    altitude: number;
    heading: number;
    tilt: number;
    zoom: number;
  };
}

const initialState: MapViewState = {
  is3D: false,
  googleMapsApiKey: null,
  cameraPosition: {
    lat: 37.7749,
    lng: -122.4194,
    altitude: 500,
    heading: 0,
    tilt: 45,
    zoom: 15,
  },
};

const mapViewSlice = createSlice({
  name: 'mapView',
  initialState,
  reducers: {
    toggle3D: (state) => {
      state.is3D = !state.is3D;
    },
    set3D: (state, action: PayloadAction<boolean>) => {
      state.is3D = action.payload;
    },
    setGoogleMapsApiKey: (state, action: PayloadAction<string>) => {
      state.googleMapsApiKey = action.payload;
    },
    updateCameraPosition: (state, action: PayloadAction<Partial<MapViewState['cameraPosition']>>) => {
      state.cameraPosition = { ...state.cameraPosition, ...action.payload };
    },
  },
});

export const {
  toggle3D,
  set3D,
  setGoogleMapsApiKey,
  updateCameraPosition,
} = mapViewSlice.actions;

export default mapViewSlice.reducer; 