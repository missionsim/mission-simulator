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
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Paper,
  Chip,
  Grid,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  LinearProgress,
} from '@mui/material';
import {
  Psychology,
  LocationOn,
  Flight,
  Warning,
  CheckCircle,
  CloudUpload,
  Map,
  Schedule,
  Height,
  Speed,
  Close,
  Info,
  Navigation,
} from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { AIOperationPlan, Mission, RiskAssessment, WaypointCommand, CoordinateFrame } from '../../types';
import { startPlanGeneration, planGenerationSuccess, planGenerationFailure } from '../../store/slices/aiPlanningSlice';
import { createMission, addWaypoint } from '../../store/slices/missionSlice';
import missionPlanningApi from '../../services/missionPlanningApi';
import { 
  MissionPlanRequest, 
  MissionPlan, 
  StreamingChunk,
  Waypoint as ApiWaypoint 
} from '../../types/missionPlanning';

interface AIPlannngProps {
  onClose: () => void;
}

const AIPlanning: React.FC<AIPlannngProps> = ({ onClose }) => {
  const dispatch = useDispatch();
  const isGenerating = useSelector((state: RootState) => state.aiPlanning.isGenerating);
  const currentMission = useSelector((state: RootState) => 
    state.mission.currentMissionId ? state.mission.missions[state.mission.currentMissionId] : null
  );
  const [activeStep, setActiveStep] = useState(0);
  
  // Form state
  const [objective, setObjective] = useState('');
  const [missionType, setMissionType] = useState('surveillance');
  const [maxAltitude, setMaxAltitude] = useState(120);
  const [maxDistance, setMaxDistance] = useState(5000);
  const [maxFlightTime, setMaxFlightTime] = useState(30);
  const [weatherConstraints, setWeatherConstraints] = useState({
    maxWindSpeed: 10,
    minVisibility: 5,
  });
  
  // AI-generated plan state
  const [generatedPlan, setGeneratedPlan] = useState<MissionPlan | null>(null);
  const [planReasoning, setPlanReasoning] = useState<string>('');
  const [streamingStatus, setStreamingStatus] = useState<string>('');
  const [streamProgress, setStreamProgress] = useState<number>(0);

  const steps = [
    'Define Objective',
    'Set Constraints',
    'Review AI Plan',
    'Execute Mission',
  ];

  const handleNext = async () => {
    console.log(`🔄 HandleNext called, activeStep: ${activeStep}`);
    
    if (activeStep === 1) {
      console.log('🎯 Triggering AI plan generation...');
      // Generate AI plan (don't wait, let it run async while we advance to review step)
      generateAIPlan().catch(error => {
        console.error('❌ Plan generation failed:', error);
      });
    }
    
    console.log(`➡️ Advancing from step ${activeStep} to ${activeStep + 1}`);
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const generateAIPlan = async () => {
    console.log('🚀 generateAIPlan function called');
    
    dispatch(startPlanGeneration());
    setGeneratedPlan(null);
    setPlanReasoning('');
    setStreamingStatus('Initializing AI planning...');
    setStreamProgress(0);
    
    console.log('📋 Redux state updated, starting API call...');
    
    // Prepare the request
    const request: MissionPlanRequest = {
      objective: {
        description: objective,
        priority: missionType === 'search' ? 'high' : 'medium',
        constraints: [
          `Maximum altitude: ${maxAltitude}m`,
          `Maximum distance: ${maxDistance}m`,
          `Maximum flight time: ${maxFlightTime} minutes`,
          `Wind speed limit: ${weatherConstraints.maxWindSpeed} m/s`,
        ],
      },
      drone_capabilities: {
        max_altitude: maxAltitude,
        max_speed: 15, // Default drone speed
        flight_time: maxFlightTime,
        has_camera: true,
        has_gimbal: true,
      },
      environment: {
        wind_speed: weatherConstraints.maxWindSpeed,
        visibility: weatherConstraints.minVisibility * 1000, // Convert km to m
      },
      include_reasoning: true,
    };
    
    // Add start position if available from current mission
    if (currentMission?.homePosition) {
      request.start_position = {
        lat: currentMission.homePosition.lat,
        lng: currentMission.homePosition.lng,
        alt: 0,
      };
    }
    
    let waypointCount = 0;
    
    console.log('🌐 Making API call to generatePlanStream...');
    console.log('📦 Request payload:', JSON.stringify(request, null, 2));
    
    try {
      await missionPlanningApi.generatePlanStream(
        request,
        (chunk: StreamingChunk) => {
          console.log('📨 Received chunk:', chunk.type, chunk.content || 'no content');
          
          switch (chunk.type) {
            case 'status':
              setStreamingStatus(chunk.content || '');
              
              // Update progress if provided in chunk data
              if (chunk.data?.progress !== undefined) {
                setStreamProgress(chunk.data.progress);
              }
              
              // Handle specific status updates
              if (chunk.data?.phase) {
                console.log(`📋 Phase ${chunk.data.phase}/${chunk.data.total_phases}: ${chunk.content}`);
              }
              
              // Handle location geocoding updates
              if (chunk.data?.location) {
                console.log(`📍 Geocoded: ${chunk.data.location.name} -> ${chunk.data.location.coordinates}`);
              }
              
              // Handle waypoint generation updates
              if (chunk.data?.waypoint) {
                waypointCount++;
                console.log(`🛰️ Waypoint ${waypointCount} generated: ${chunk.data.waypoint.name || chunk.data.waypoint.type}`);
              }
              break;
              
            case 'reasoning':
              setPlanReasoning(prev => prev + (chunk.content || ''));
              // Don't set fixed progress for reasoning, let status updates handle it
              break;
              
            case 'plan':
              if (chunk.is_final && chunk.data) {
                // Extract plan from data structure
                const planData = chunk.data.plan || chunk.data;
                setGeneratedPlan(planData as MissionPlan);
                setStreamProgress(100);
                setStreamingStatus('Plan generation complete!');
                
                // Convert API plan to our store format
                const aiPlan: AIOperationPlan = {
                  id: planData.id,
                  name: planData.name,
                  objective: objective,
                  constraints: {
                    maxAltitude,
                    maxDistance,
                    maxFlightTime,
                    noFlyZones: [],
                    requiredSensors: ['camera', 'gps'],
                  },
                  suggestedMissions: [{
                    id: `mission_${Date.now()}`,
                    name: planData.name,
                    waypoints: planData.waypoints.map((wp: ApiWaypoint) => ({
                      id: wp.id,
                      position: wp.position,
                      altitude: wp.position.alt || 50,
                      speed: wp.speed || 5,
                      loiterTime: wp.loiter_time,
                      actions: wp.camera_action ? [wp.camera_action] : [],
                    })),
                    homePosition: request.start_position || { lat: 0, lng: 0 },
                    aiGenerated: true,
                  }],
                  riskAssessment: {
                    overallRisk: 'low',
                    factors: planData.metadata?.warnings?.map((warning: string) => ({
                      type: 'Warning',
                      severity: 'medium',
                      description: warning,
                      mitigation: 'Review and adjust as needed',
                    })) || [],
                  },
                  weatherConsiderations: {
                    temperature: request.environment?.temperature || 20,
                    windSpeed: request.environment?.wind_speed || 5,
                    windDirection: request.environment?.wind_direction || 0,
                    visibility: request.environment?.visibility || 10000,
                    condition: 'Clear',
                  },
                  createdAt: new Date(),
                };
                
                dispatch(planGenerationSuccess(aiPlan));
              }
              break;
              
            case 'error':
              setStreamingStatus(`Streaming error: ${chunk.content}. Falling back to standard generation...`);
              // Fallback to non-streaming request
              missionPlanningApi.generatePlan(request)
                .then((resp) => {
                  if (resp.success && resp.plan) {
                    const plan = resp.plan as MissionPlan;
                    setGeneratedPlan(plan);
                    setPlanReasoning(resp.reasoning || '');
                    setStreamProgress(100);
                    dispatch(planGenerationSuccess({
                      id: plan.id,
                      name: plan.name,
                      objective: objective,
                      constraints: {
                        maxAltitude,
                        maxDistance,
                        maxFlightTime,
                        noFlyZones: [],
                        requiredSensors: ['camera', 'gps'],
                      },
                      suggestedMissions: [],
                      riskAssessment: {
                        overallRisk: 'low',
                        factors: [],
                      },
                      weatherConsiderations: {
                        temperature: request.environment?.temperature || 20,
                        windSpeed: request.environment?.wind_speed || 5,
                        windDirection: request.environment?.wind_direction || 0,
                        visibility: request.environment?.visibility || 10000,
                        condition: 'Clear',
                      },
                      createdAt: new Date(),
                    } as AIOperationPlan));
                  } else {
                    dispatch(planGenerationFailure(resp.error || 'Failed to generate plan'));
                  }
                })
                .catch((err) => {
                  dispatch(planGenerationFailure(err.message));
                });
              break;
          }
        },
        (error: Error) => {
          console.error('❌ Streaming error occurred:', error);
          console.error('Error details:', error.message, error.stack);
          setStreamingStatus(`Streaming error: ${error.message}. Falling back to standard generation...`);
          // Fallback to non-streaming request
          missionPlanningApi.generatePlan(request)
            .then((resp) => {
              if (resp.success && resp.plan) {
                const plan = resp.plan as MissionPlan;
                setGeneratedPlan(plan);
                setPlanReasoning(resp.reasoning || '');
                setStreamProgress(100);
                dispatch(planGenerationSuccess({
                  id: plan.id,
                  name: plan.name,
                  objective: objective,
                  constraints: {
                    maxAltitude,
                    maxDistance,
                    maxFlightTime,
                    noFlyZones: [],
                    requiredSensors: ['camera', 'gps'],
                  },
                  suggestedMissions: [],
                  riskAssessment: {
                    overallRisk: 'low',
                    factors: [],
                  },
                  weatherConsiderations: {
                    temperature: request.environment?.temperature || 20,
                    windSpeed: request.environment?.wind_speed || 5,
                    windDirection: request.environment?.wind_direction || 0,
                    visibility: request.environment?.visibility || 10000,
                    condition: 'Clear',
                  },
                  createdAt: new Date(),
                } as AIOperationPlan));
              } else {
                dispatch(planGenerationFailure(resp.error || 'Failed to generate plan'));
              }
            })
            .catch((err) => {
              dispatch(planGenerationFailure(err.message));
            });
        }
      );
    } catch (error) {
      console.error('❌ Outer catch - Failed to generate plan:', error);
      console.error('Error type:', typeof error, 'Error details:', error);
      dispatch(planGenerationFailure(error instanceof Error ? error.message : 'Failed to generate plan'));
    }
  };

  const getRiskColor = (risk: 'low' | 'medium' | 'high') => {
    switch (risk) {
      case 'low': return 'success';
      case 'medium': return 'warning';
      case 'high': return 'error';
    }
  };

  return (
    <Dialog 
      open 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: 'background.paper',
          backgroundImage: 'none',
        }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Psychology color="primary" />
            <Typography variant="h6">AI Mission Planning</Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Stepper activeStep={activeStep} orientation="vertical">
          {/* Step 1: Define Objective */}
          <Step>
            <StepLabel>Define Mission Objective</StepLabel>
            <StepContent>
              <Box sx={{ mb: 2 }}>
                <TextField
                  fullWidth
                  label="Mission Objective"
                  multiline
                  rows={3}
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  placeholder="e.g., Survey the perimeter of the facility and identify any security vulnerabilities"
                  sx={{ mb: 2 }}
                />
                
                <FormControl fullWidth>
                  <InputLabel>Mission Type</InputLabel>
                  <Select
                    value={missionType}
                    onChange={(e) => setMissionType(e.target.value)}
                    label="Mission Type"
                  >
                    <MenuItem value="surveillance">Surveillance</MenuItem>
                    <MenuItem value="mapping">Mapping</MenuItem>
                    <MenuItem value="inspection">Inspection</MenuItem>
                    <MenuItem value="search">Search & Rescue</MenuItem>
                    <MenuItem value="delivery">Delivery</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Button
                  variant="contained"
                  onClick={handleNext}
                  disabled={!objective}
                >
                  Continue
                </Button>
              </Box>
            </StepContent>
          </Step>

          {/* Step 2: Set Constraints */}
          <Step>
            <StepLabel>Set Operation Constraints</StepLabel>
            <StepContent>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                <Box sx={{ flex: '1 1 45%', minWidth: 280 }}>
                  <Typography gutterBottom>Max Altitude (m)</Typography>
                  <Slider
                    value={maxAltitude}
                    onChange={(e, newValue) => setMaxAltitude(newValue as number)}
                    min={20}
                    max={400}
                    valueLabelDisplay="auto"
                    marks={[
                      { value: 20, label: '20m' },
                      { value: 120, label: '120m' },
                      { value: 400, label: '400m' },
                    ]}
                  />
                </Box>
                
                <Box sx={{ flex: '1 1 45%', minWidth: 280 }}>
                  <Typography gutterBottom>Max Distance (m)</Typography>
                  <Slider
                    value={maxDistance}
                    onChange={(e, newValue) => setMaxDistance(newValue as number)}
                    min={100}
                    max={10000}
                    valueLabelDisplay="auto"
                    marks={[
                      { value: 100, label: '100m' },
                      { value: 5000, label: '5km' },
                      { value: 10000, label: '10km' },
                    ]}
                  />
                </Box>
                
                <Box sx={{ flex: '1 1 45%', minWidth: 280 }}>
                  <Typography gutterBottom>Max Flight Time (min)</Typography>
                  <Slider
                    value={maxFlightTime}
                    onChange={(e, newValue) => setMaxFlightTime(newValue as number)}
                    min={5}
                    max={60}
                    valueLabelDisplay="auto"
                    marks={[
                      { value: 5, label: '5min' },
                      { value: 30, label: '30min' },
                      { value: 60, label: '60min' },
                    ]}
                  />
                </Box>
                
                <Box sx={{ flex: '1 1 45%', minWidth: 280 }}>
                  <Typography gutterBottom>Max Wind Speed (m/s)</Typography>
                  <Slider
                    value={weatherConstraints.maxWindSpeed}
                    onChange={(e, newValue) => setWeatherConstraints({
                      ...weatherConstraints,
                      maxWindSpeed: newValue as number,
                    })}
                    min={0}
                    max={20}
                    valueLabelDisplay="auto"
                  />
                </Box>
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Button variant="contained" onClick={handleNext} sx={{ mr: 1 }}>
                  Generate Plan
                </Button>
                <Button onClick={handleBack}>
                  Back
                </Button>
              </Box>
            </StepContent>
          </Step>

          {/* Step 3: Review AI Plan */}
          <Step>
            <StepLabel>Review AI-Generated Plan</StepLabel>
            <StepContent>
              {isGenerating ? (
                <Box sx={{ my: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <CircularProgress size={24} />
                    <Typography>{streamingStatus}</Typography>
                  </Box>
                  
                  {/* Phase Indicators */}
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                      <Chip 
                        icon={<Psychology />} 
                        label="1. Structure Analysis" 
                        size="small"
                        color={streamProgress >= 5 ? (streamProgress >= 25 ? 'success' : 'primary') : 'default'}
                        variant={streamProgress >= 5 ? 'filled' : 'outlined'}
                      />
                      <Chip 
                        icon={<LocationOn />} 
                        label="2. Location Geocoding" 
                        size="small"
                        color={streamProgress >= 30 ? (streamProgress >= 55 ? 'success' : 'primary') : 'default'}
                        variant={streamProgress >= 30 ? 'filled' : 'outlined'}
                      />
                      <Chip 
                        icon={<Flight />} 
                        label="3. Mission Planning" 
                        size="small"
                        color={streamProgress >= 60 ? (streamProgress >= 95 ? 'success' : 'primary') : 'default'}
                        variant={streamProgress >= 60 ? 'filled' : 'outlined'}
                      />
                    </Box>
                  </Box>
                  
                  <LinearProgress 
                    variant="determinate" 
                    value={streamProgress} 
                    sx={{ 
                      mb: 2,
                      height: 8,
                      borderRadius: 4,
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 4,
                      }
                    }} 
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                    {streamProgress.toFixed(0)}% complete
                  </Typography>
                  
                  {planReasoning && (
                    <Paper variant="outlined" sx={{ p: 2, mb: 2, backgroundColor: 'background.default' }}>
                      <Typography variant="subtitle2" gutterBottom color="primary">
                        <Psychology sx={{ mr: 1, verticalAlign: 'middle', fontSize: 18 }} />
                        AI Reasoning
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {planReasoning}
                      </Typography>
                    </Paper>
                  )}
                </Box>
              ) : generatedPlan ? (
                <Box>
                  <Alert severity="success" sx={{ mb: 2 }}>
                    AI has generated an optimized mission plan: "{generatedPlan.name}"
                  </Alert>
                  
                  {planReasoning && (
                    <Paper variant="outlined" sx={{ p: 2, mb: 2, backgroundColor: 'background.default' }}>
                      <Typography variant="subtitle2" gutterBottom color="primary">
                        <Psychology sx={{ mr: 1, verticalAlign: 'middle', fontSize: 18 }} />
                        AI Reasoning
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {planReasoning}
                      </Typography>
                    </Paper>
                  )}
                  
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Box sx={{ flex: '1 1 45%', minWidth: 280 }}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            <Map sx={{ mr: 1, verticalAlign: 'bottom' }} />
                            Generated Flight Plan
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                            <Chip 
                              icon={<Navigation />} 
                              label={`${generatedPlan.waypoints.length} waypoints`} 
                              size="small" 
                            />
                            <Chip 
                              icon={<Schedule />} 
                              label={`${Math.round(generatedPlan.estimated_duration)} min`} 
                              size="small" 
                            />
                            <Chip 
                              icon={<LocationOn />} 
                              label={`${(generatedPlan.total_distance / 1000).toFixed(2)} km`} 
                              size="small" 
                            />
                          </Box>
                          <Typography variant="body2" color="text.secondary">
                            {generatedPlan.description}
                          </Typography>
                          
                          {generatedPlan.waypoints.length > 0 && (
                            <Box sx={{ mt: 2 }}>
                              <Typography variant="subtitle2" gutterBottom>
                                Waypoint Types:
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                {Array.from(new Set(generatedPlan.waypoints.map(wp => wp.type))).map(type => (
                                  <Chip 
                                    key={type}
                                    label={type} 
                                    size="small" 
                                    variant="outlined"
                                    color={type === 'takeoff' || type === 'land' ? 'primary' : 'default'}
                                  />
                                ))}
                              </Box>
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    </Box>
                    
                    <Box sx={{ flex: '1 1 45%', minWidth: 280 }}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            <Info sx={{ mr: 1, verticalAlign: 'bottom' }} />
                            Mission Details
                          </Typography>
                          
                          {generatedPlan.metadata?.warnings && generatedPlan.metadata.warnings.length > 0 ? (
                            <>
                              <Alert severity="warning" sx={{ mb: 2 }}>
                                <Typography variant="subtitle2" gutterBottom>
                                  Warnings:
                                </Typography>
                                {generatedPlan.metadata.warnings.map((warning: string, index: number) => (
                                  <Typography key={index} variant="body2">
                                    • {warning}
                                  </Typography>
                                ))}
                              </Alert>
                            </>
                          ) : (
                            <Alert severity="success">
                              No warnings or conflicts detected
                            </Alert>
                          )}
                          
                          <Box sx={{ mt: 2 }}>
                            <Typography variant="body2" color="text.secondary">
                              Plan generated for: {objective}
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    </Box>
                  </Box>
                  
                  <Box sx={{ mt: 2 }}>
                    <Button variant="contained" onClick={handleNext} sx={{ mr: 1 }}>
                      Accept Plan
                    </Button>
                    <Button onClick={handleBack}>
                      Modify Constraints
                    </Button>
                  </Box>
                </Box>
              ) : (
                <Box>
                  <Alert severity="info">
                    Click "Generate Plan" to create an AI-optimized mission plan.
                  </Alert>
                </Box>
              )}
            </StepContent>
          </Step>

          {/* Step 4: Execute */}
          <Step>
            <StepLabel>Execute Mission</StepLabel>
            <StepContent>
              <Alert severity="success" sx={{ mb: 2 }}>
                Mission plan has been accepted and loaded to the map. You can now:
              </Alert>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  ✓ Review waypoints on the map
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  ✓ Make final adjustments if needed
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  ✓ Connect to your drone
                </Typography>
                <Typography variant="body2">
                  ✓ Upload mission and start flying
                </Typography>
              </Box>
              
              {generatedPlan && (
                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Mission Summary: {generatedPlan.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {generatedPlan.waypoints.length} waypoints • 
                    {Math.round(generatedPlan.estimated_duration)} min • 
                    {(generatedPlan.total_distance / 1000).toFixed(2)} km
                  </Typography>
                </Paper>
              )}
              
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button 
                  variant="contained" 
                  color="success"
                  startIcon={<Flight />}
                  onClick={() => {
                    // Apply the generated mission to the map
                    if (generatedPlan) {
                      const mission: Mission = {
                        id: `mission_${Date.now()}`,
                        name: generatedPlan.name,
                        waypoints: generatedPlan.waypoints.map((wp) => {
                          // Map API waypoint types to MAVLink commands
                          let command = WaypointCommand.WAYPOINT;
                          const params = [0, 0, 0, 0, 0, 0, 0];
                          
                          switch (wp.type) {
                            case 'takeoff':
                              command = WaypointCommand.TAKEOFF;
                              params[6] = wp.position.alt || 50; // Altitude
                              break;
                            case 'land':
                              command = WaypointCommand.LAND;
                              break;
                            case 'loiter':
                              command = WaypointCommand.LOITER_TIME;
                              params[0] = wp.loiter_time || 10; // Loiter time in seconds
                              break;
                            case 'orbit':
                              command = WaypointCommand.LOITER_TURNS;
                              params[0] = 1; // Number of turns
                              params[2] = wp.radius || 10; // Radius
                              break;
                            case 'survey':
                            case 'waypoint':
                            default:
                              command = WaypointCommand.WAYPOINT;
                              if (wp.loiter_time) {
                                params[0] = wp.loiter_time; // Delay at waypoint
                              }
                              break;
                          }
                          
                          return {
                            id: wp.id,
                            position: wp.position,
                            command,
                            params,
                            frame: CoordinateFrame.GLOBAL_RELATIVE_ALT,
                            isCurrent: false,
                            autocontinue: true,
                            description: wp.name || `${wp.type} waypoint`,
                          };
                        }),
                        homePosition: currentMission?.homePosition || { lat: 0, lng: 0 },
                        aiGenerated: true,
                      };
                      dispatch(createMission(mission));
                    }
                    onClose();
                  }}
                >
                  View on Map
                </Button>
                <Button 
                  variant="outlined"
                  startIcon={<CloudUpload />}
                  onClick={() => {
                    // TODO: Implement export functionality
                    console.log('Export mission:', generatedPlan);
                  }}
                >
                  Export Mission
                </Button>
              </Box>
            </StepContent>
          </Step>
        </Stepper>
      </DialogContent>
    </Dialog>
  );
};

export default AIPlanning; 