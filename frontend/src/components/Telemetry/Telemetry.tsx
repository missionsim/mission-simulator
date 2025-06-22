import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  LinearProgress,
  Chip,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from 'recharts';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { Speed, Height, Battery90, Satellite, ExpandLess, ExpandMore } from '@mui/icons-material';

const Telemetry: React.FC = () => {
  const [minimized, setMinimized] = useState(true);
  const selectedDroneId = useSelector((state: RootState) => state.drone.selectedDroneId);
  const selectedDrone = useSelector((state: RootState) => 
    selectedDroneId ? state.drone.drones[selectedDroneId] : null
  );

  if (!selectedDrone) {
    return (
      <Paper
        sx={{
          position: 'absolute',
          bottom: 24,
          left: 16,
          right: 226,
          p: 2,
          backgroundColor: 'rgba(26, 26, 26, 0.95)',
          backdropFilter: 'blur(10px)',
          maxHeight: '35vh',
          overflowY: 'auto',
          zIndex: 1000,  // Add z-index to ensure it appears above the map
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
          maxWidth: '1200px',
          margin: '0 auto',
        }}
      >
        <Typography variant="h6" gutterBottom>
          Telemetry
        </Typography>
        <Typography color="text.secondary">
          No drone connected. Connect a drone to view telemetry data.
        </Typography>
      </Paper>
    );
  }

  const { telemetry, battery } = selectedDrone;

  // Mock historical data for charts
  const altitudeData = Array.from({ length: 20 }, (_, i) => ({
    time: i,
    altitude: telemetry.altitude + (Math.random() - 0.5) * 5,
  }));

  const speedData = Array.from({ length: 20 }, (_, i) => ({
    time: i,
    groundSpeed: telemetry.groundSpeed + (Math.random() - 0.5) * 2,
    airSpeed: telemetry.airSpeed + (Math.random() - 0.5) * 2,
  }));

  const batteryData = [
    {
      name: 'Battery',
      value: battery.remaining,
      fill: battery.remaining > 50 ? '#4caf50' : battery.remaining > 20 ? '#ff9800' : '#f44336',
    },
  ];

  return (
    <Paper
      sx={{
        position: 'fixed',
        bottom: 24,
        left: 216,
        right: 226,
        p: 1,
        backgroundColor: 'rgba(26, 26, 26, 0.95)',
        backdropFilter: 'blur(10px)',
        maxHeight: minimized ? 'auto' : '35vh',
        overflowY: 'auto',
        zIndex: 1000,
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
        maxWidth: '1200px',
        margin: '0 auto',
        transition: 'all 0.3s ease-in-out',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: minimized ? 0 : 1 }}>
        <Typography variant="h6" sx={{ fontSize: '1rem', paddingLeft: '10px' }}>
          Telemetry - {selectedDrone.name}
        </Typography>
        
        {/* Quick stats when minimized */}
        {minimized && (
          <Box sx={{ display: 'flex', gap: 2, flex: 1, mx: 2, justifyContent: 'center' }}>
            <Chip label={`Alt: ${telemetry.altitude.toFixed(1)}m`} size="small" />
            <Chip label={`Speed: ${telemetry.groundSpeed.toFixed(1)}m/s`} size="small" />
            <Chip label={`Battery: ${battery.remaining}%`} size="small" color={battery.remaining > 50 ? 'success' : battery.remaining > 20 ? 'warning' : 'error'} />
            <Chip label={`Sats: ${telemetry.satellites}`} size="small" />
          </Box>
        )}
        
        <IconButton 
          onClick={() => setMinimized(!minimized)} 
          size="small"
          sx={{ ml: 'auto' }}
        >
          {minimized ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
      </Box>

      <Collapse in={!minimized}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {/* Key Metrics */}
          <Box sx={{ flex: '1 1 250px', minWidth: 200 }}>
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Height sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="body2" color="text.secondary">
                  Altitude
                </Typography>
              </Box>
              <Typography variant="h4">
                {telemetry.altitude.toFixed(1)}m
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Vertical Speed: {telemetry.verticalSpeed.toFixed(1)}m/s
              </Typography>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Speed sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="body2" color="text.secondary">
                  Ground Speed
                </Typography>
              </Box>
              <Typography variant="h4">
                {telemetry.groundSpeed.toFixed(1)}m/s
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Air Speed: {telemetry.airSpeed.toFixed(1)}m/s
              </Typography>
            </Box>

            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Satellite sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="body2" color="text.secondary">
                  GPS Status
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Chip 
                  label={`${telemetry.satellites} sats`} 
                  size="small" 
                  color={telemetry.satellites >= 10 ? 'success' : 'warning'}
                />
                <Chip 
                  label={`HDOP: ${telemetry.hdop.toFixed(1)}`} 
                  size="small"
                  color={telemetry.hdop < 1.5 ? 'success' : 'warning'}
                />
              </Box>
            </Box>
          </Box>

          {/* Altitude Chart */}
          <Box sx={{ flex: '1 1 250px', minWidth: 200 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Altitude History
            </Typography>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={altitudeData}>
                <defs>
                  <linearGradient id="colorAlt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2196f3" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#2196f3" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" hide />
                <YAxis hide />
                <Tooltip />
                <Area 
                  type="monotone" 
                  dataKey="altitude" 
                  stroke="#2196f3" 
                  fillOpacity={1} 
                  fill="url(#colorAlt)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </Box>

          {/* Speed Chart */}
          <Box sx={{ flex: '1 1 250px', minWidth: 200 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Speed History
            </Typography>
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={speedData}>
                <XAxis dataKey="time" hide />
                <YAxis hide />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="groundSpeed" 
                  stroke="#4caf50" 
                  strokeWidth={2}
                  dot={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="airSpeed" 
                  stroke="#ff9800" 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>

          {/* Battery Chart */}
          <Box sx={{ flex: '1 1 250px', minWidth: 200 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Battery Status
            </Typography>
            <ResponsiveContainer width="100%" height={120}>
              <RadialBarChart 
                cx="50%" 
                cy="50%" 
                innerRadius="60%" 
                outerRadius="90%" 
                data={batteryData}
              >
                <PolarAngleAxis
                  type="number"
                  domain={[0, 100]}
                  angleAxisId={0}
                  tick={false}
                />
                <RadialBar
                  background
                  dataKey="value"
                  cornerRadius={10}
                  fill="#4caf50"
                />
                <text 
                  x="50%" 
                  y="50%" 
                  textAnchor="middle" 
                  dominantBaseline="middle" 
                  className="recharts-text"
                  fill="#fff"
                >
                  <tspan fontSize="24" fontWeight="bold">{battery.remaining}%</tspan>
                </text>
              </RadialBarChart>
            </ResponsiveContainer>
            <Box sx={{ px: 2 }}>
              <Typography variant="caption" color="text.secondary">
                {battery.voltage.toFixed(1)}V | {battery.current.toFixed(1)}A
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Attitude Indicators */}
        <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
          <Chip label={`Roll: ${telemetry.roll.toFixed(1)}°`} size="small" />
          <Chip label={`Pitch: ${telemetry.pitch.toFixed(1)}°`} size="small" />
          <Chip label={`Yaw: ${telemetry.yaw.toFixed(1)}°`} size="small" />
          <Chip label={`Throttle: ${telemetry.throttle}%`} size="small" />
        </Box>
      </Collapse>
    </Paper>
  );
};

export default Telemetry; 