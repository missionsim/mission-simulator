import React from 'react';
import { Provider } from 'react-redux';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import { store } from './store';
import Topbar from './components/Topbar/Topbar';
import Sidebar from './components/Sidebar/Sidebar';
import MapView from './components/Map/MapView';
import Telemetry from './components/Telemetry/Telemetry';
import AIPlanning from './components/AIPlanning/AIPlanning';
import DebugPanel from './components/DebugPanel/DebugPanel';
import './App.css';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#2196f3',
    },
    secondary: {
      main: '#4caf50',
    },
    background: {
      default: '#0a0a0a',
      paper: '#1a1a1a',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h6: {
      fontWeight: 600,
    },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
});

function App() {
  const [showAIPanel, setShowAIPanel] = React.useState(false);
  const [showTelemetry, setShowTelemetry] = React.useState(true);

  React.useEffect(() => {
    // Initialize with a default mission
    const defaultMission = {
      id: 'default_mission',
      name: 'Default Mission',
      waypoints: [],
      homePosition: { lat: 37.7749, lng: -122.4194 },
      description: 'Click on the map to add waypoints',
    };
    
    store.dispatch({
      type: 'mission/createMission',
      payload: defaultMission,
    });

    // Initialize with a mock drone for demo
    const mockDrone = {
      id: 'drone_1',
      name: 'Drone Alpha',
      type: 'quadcopter',
      status: 'connected',
      position: { lat: 37.7749, lng: -122.4194 },
      heading: 45,
      battery: {
        voltage: 12.6,
        current: 15.2,
        remaining: 85,
        cellCount: 4,
      },
      telemetry: {
        altitude: 0,
        groundSpeed: 0,
        verticalSpeed: 0,
        airSpeed: 0,
        throttle: 0,
        roll: 0,
        pitch: 0,
        yaw: 45,
        satellites: 12,
        hdop: 0.9,
        fixType: 3,
      },
      armed: false,
      mode: 'STABILIZE',
      lastHeartbeat: new Date(),
    };

    store.dispatch({
      type: 'drone/addDrone',
      payload: mockDrone,
    });

    store.dispatch({
      type: 'drone/selectDrone',
      payload: 'drone_1',
    });

    // Listen for AI planning event from sidebar
    const handleOpenAIPlanning = () => {
      setShowAIPanel(true);
    };

    window.addEventListener('openAIPlanning', handleOpenAIPlanning);

    return () => {
      window.removeEventListener('openAIPlanning', handleOpenAIPlanning);
    };
  }, []);

  return (
    <Provider store={store}>
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
          <Topbar onOpenAIPanel={() => setShowAIPanel(true)} />
          <Sidebar />
          <Box
            component="main"
            sx={{
              flexGrow: 1,
              display: 'flex',
              flexDirection: 'column',
              marginTop: '64px', // Height of topbar
              marginLeft: '0px', // always 0 
              position: 'relative',
              height: 'calc(100vh - 70px)',
              overflow: 'hidden',
            }}
          >
            <MapView />
            {showTelemetry && <Telemetry />}
            {showAIPanel && <AIPlanning onClose={() => setShowAIPanel(false)} />}
            <DebugPanel />
          </Box>
        </Box>
      </ThemeProvider>
    </Provider>
  );
}

export default App; 