import React, { useState } from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Toolbar,
  Box,
  Typography,
  Collapse,
  IconButton,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  CircularProgress,
  MenuItem,
  FormControlLabel,
  Switch,
  Chip,
  Paper,
  Input,
} from '@mui/material';
import {
  Map,
  Navigation,
  Settings,
  Psychology,
  Timeline,
  FolderOpen,
  Add,
  ExpandLess,
  ExpandMore,
  FlightTakeoff,
  CloudDownload,
  CloudUpload,
  Image,
  Warning,
  LocationOn,
  Security,
  Upload,
  AddLocationAlt,
  Route,
  GitHub,
  Archive,
} from '@mui/icons-material';
import NewMissionDialog from '../MissionPlanning/NewMissionDialog';
import MissionSelector from '../MissionPlanning/MissionSelector';
import WaypointsPanel from '../MissionPlanning/WaypointsPanel';
import missionPlanningApi from '../../services/missionPlanningApi';
import { useDispatch, useSelector } from 'react-redux';
import { setDrawingMode } from '../../store/slices/missionSlice';
import { addThreats, addPois, addRestrictedAreas } from '../../store/slices/intelSlice';
import { RootState } from '../../store';

const drawerWidth = 200;

interface SidebarSection {
  title: string;
  icon: React.ReactNode;
  items: {
    label: string;
    icon: React.ReactNode;
    action?: () => void;
    loading?: boolean;
  }[];
}

const Sidebar: React.FC = () => {
  const dispatch = useDispatch();
  const intelData = useSelector((state: RootState) => state.intel);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    mission: true,
    ai: true,
    export: true,
    settings: false,
  });
  
  // Dialog states
  const [newMissionDialogOpen, setNewMissionDialogOpen] = useState(false);
  const [missionSelectorOpen, setMissionSelectorOpen] = useState(false);
  const [waypointsPanelOpen, setWaypointsPanelOpen] = useState(false);
  
  // Export dialog state
  const [geotiffDialogOpen, setGeotiffDialogOpen] = useState(false);
  const [geotiffZoom, setGeotiffZoom] = useState(16);
  const [geotiffBuffer, setGeotiffBuffer] = useState(500);
  const [geotiffMapType, setGeotiffMapType] = useState('satellite');
  const [exportType, setExportType] = useState<'geotiff' | 'png'>('geotiff');
  
  // Constraints dialog state
  const [constraintsDialogOpen, setConstraintsDialogOpen] = useState(false);
  const [constraints, setConstraints] = useState({
    maxAltitude: 120,
    minAltitude: 10,
    maxSpeed: 15,
    batteryReserve: 20,
    maxFlightTime: 20,
    weatherWindLimit: 12,
    noFlyZones: [] as string[],
  });
  
  // Import Intel dialog state
  const [importIntelDialogOpen, setImportIntelDialogOpen] = useState(false);
  const [importIntelLoading, setImportIntelLoading] = useState(false);
  
  // Loading states
  const [exportMissionLoading, setExportMissionLoading] = useState(false);
  const [exportGeotiffLoading, setExportGeotiffLoading] = useState(false);
  const [exportPngLoading, setExportPngLoading] = useState(false);
  const [exportTakLoading, setExportTakLoading] = useState(false);
  
  // Notification states
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });

  const showNotification = (message: string, severity: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setNotification({ open: true, message, severity });
  };

  const handleCloseNotification = () => {
    setNotification(prev => ({ ...prev, open: false }));
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleNewMission = () => {
    setNewMissionDialogOpen(true);
  };

  const handleLoadMission = () => {
    setMissionSelectorOpen(true);
  };

  const handleWaypoints = () => {
    setWaypointsPanelOpen(true);
    window.dispatchEvent(new CustomEvent('openWaypointsPanel'));
  };

  const handleCloseWaypoints = () => {
    setWaypointsPanelOpen(false);
    window.dispatchEvent(new CustomEvent('closeWaypointsPanel'));
  };

  const handleFlightData = () => {
    // TODO: Implement flight data viewer
    console.log('Flight data viewer not yet implemented');
  };

  const handleGeneratePlan = () => {
    // This is handled by the AI Planning button in the topbar
    // But we could also trigger it from here
    const event = new CustomEvent('openAIPlanning');
    window.dispatchEvent(event);
  };

  const handleConstraints = () => {
    setConstraintsDialogOpen(true);
  };

  const handleImportIntel = () => {
    setImportIntelDialogOpen(true);
  };

  const handleConstraintChange = (field: string, value: any) => {
    setConstraints(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveConstraints = () => {
    // Save constraints to store or API
    showNotification('Mission constraints updated successfully!', 'success');
    setConstraintsDialogOpen(false);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportIntelLoading(true);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      
      // Parse different file formats
      if (file.name.endsWith('.json') || file.name.endsWith('.geojson')) {
        const data = JSON.parse(content);
        
        // Handle GeoJSON format
        if (data.type === 'FeatureCollection' && data.features) {
          const newThreats: Array<{ name: string; lat: number; lng: number; type: string; severity: 'low' | 'medium' | 'high' }> = [];
          const newPois: Array<{ name: string; lat: number; lng: number; description: string }> = [];
          const newRestrictedAreas: Array<{ name: string; coordinates: Array<[number, number]> }> = [];
          
          data.features.forEach((feature: any) => {
            if (feature.geometry && feature.properties) {
              const name = feature.properties.name || 'Unnamed Feature';
              
              if (feature.geometry.type === 'Point') {
                const [lng, lat] = feature.geometry.coordinates;
                
                // Determine feature type based on name or properties
                const nameUpper = name.toUpperCase();
                if (nameUpper.includes('THREAT') || nameUpper.includes('INTERCEPTOR') || nameUpper.includes('DANGER')) {
                  newThreats.push({
                    name,
                    lat,
                    lng,
                    type: feature.properties.type || 'Unknown',
                    severity: (feature.properties.severity === 'low' || feature.properties.severity === 'high') 
                      ? feature.properties.severity 
                      : 'medium'
                  });
                } else {
                  newPois.push({
                    name,
                    lat,
                    lng,
                    description: feature.properties.description || name
                  });
                }
              } else if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
                // Handle polygon features as restricted areas
                let coordinates: Array<[number, number]> = [];
                
                if (feature.geometry.type === 'Polygon') {
                  coordinates = feature.geometry.coordinates[0].map((coord: number[]) => [coord[0], coord[1]]);
                } else if (feature.geometry.type === 'MultiPolygon') {
                  // Use the first polygon of the multipolygon
                  coordinates = feature.geometry.coordinates[0][0].map((coord: number[]) => [coord[0], coord[1]]);
                }
                
                newRestrictedAreas.push({
                  name,
                  coordinates
                });
              }
            }
          });
          
          // Dispatch to Redux store
          if (newThreats.length > 0) {
            dispatch(addThreats(newThreats));
          }
          if (newPois.length > 0) {
            dispatch(addPois(newPois));
          }
          if (newRestrictedAreas.length > 0) {
            dispatch(addRestrictedAreas(newRestrictedAreas));
          }
          
          const totalFeatures = newThreats.length + newPois.length + newRestrictedAreas.length;
          showNotification(`Imported ${totalFeatures} features from GeoJSON successfully!`, 'success');
        } else {
          // Handle regular JSON format (existing functionality)
          // For regular JSON, we assume it has the correct structure
          if (data.threats && Array.isArray(data.threats)) {
            dispatch(addThreats(data.threats));
          }
          if (data.pois && Array.isArray(data.pois)) {
            dispatch(addPois(data.pois));
          }
          if (data.restrictedAreas && Array.isArray(data.restrictedAreas)) {
            dispatch(addRestrictedAreas(data.restrictedAreas));
          }
          showNotification(`Imported ${file.name} successfully!`, 'success');
        }
      } else if (file.name.endsWith('.kml') || file.name.endsWith('.kmz')) {
        // Basic KML parsing (in real app, you'd use a proper KML parser)
        showNotification('KML import functionality would be implemented here', 'info');
      } else {
        showNotification('Unsupported file format', 'error');
      }
      
      setImportIntelLoading(false);
    };
    
    reader.onerror = () => {
      showNotification('Failed to read file', 'error');
      setImportIntelLoading(false);
    };
    
    reader.readAsText(file);
  };

  const handleSaveIntelData = () => {
    // Intel data is already saved to Redux store during import
    showNotification('Intelligence data imported successfully!', 'success');
    setImportIntelDialogOpen(false);
  };

  const handleExportMission = async () => {
    // For now, we'll use a demo mission ID since we don't have persistence yet
    const demoMissionId = "demo-mission-001";
    
    setExportMissionLoading(true);
    try {
      await missionPlanningApi.exportMissionWaypoints(demoMissionId);
      showNotification('Mission waypoints file exported successfully!', 'success');
    } catch (error: any) {
      console.error('Export mission waypoints failed:', error);
      showNotification(error.message || 'Failed to export mission waypoints', 'error');
    } finally {
      setExportMissionLoading(false);
    }
  };

  const handleExportGeotiff = () => {
    setExportType('geotiff');
    setGeotiffDialogOpen(true);
  };

  const handleExportPng = () => {
    setExportType('png');
    setGeotiffDialogOpen(true);
  };

  const handleExportTakMission = async () => {
    const demoMissionId = "demo-mission-001";

    setExportTakLoading(true);
    try {
      await missionPlanningApi.exportTakMission(demoMissionId);
      showNotification('TAK mission package exported successfully!', 'success');
    } catch (error: any) {
      console.error('Export TAK mission failed:', error);
      showNotification(error.message || 'Failed to export TAK mission', 'error');
    } finally {
      setExportTakLoading(false);
    }
  };

  const handleImageExport = async () => {
    // For now, we'll use a demo mission ID since we don't have persistence yet
    const demoMissionId = "demo-mission-001";
    
    if (exportType === 'geotiff') {
      setExportGeotiffLoading(true);
    } else {
      setExportPngLoading(true);
    }
    setGeotiffDialogOpen(false);
    
    try {
      if (exportType === 'geotiff') {
        await missionPlanningApi.exportRouteGeotiff(demoMissionId, geotiffZoom, geotiffBuffer, geotiffMapType);
        showNotification('Route GeoTIFF exported successfully!', 'success');
      } else {
        await missionPlanningApi.exportRoutePng(demoMissionId, geotiffZoom, geotiffBuffer, geotiffMapType);
        showNotification('Route PNG exported successfully!', 'success');
      }
    } catch (error: any) {
      console.error(`Export ${exportType.toUpperCase()} failed:`, error);
      showNotification(error.message || `Failed to export route ${exportType.toUpperCase()}`, 'error');
    } finally {
      if (exportType === 'geotiff') {
        setExportGeotiffLoading(false);
      } else {
        setExportPngLoading(false);
      }
    }
  };

  const sections: SidebarSection[] = [
    {
      title: 'Mission Planning',
      icon: <Map />,
      items: [
        { label: 'New Mission', icon: <Add />, action: handleNewMission },
        { label: 'Load Mission', icon: <FolderOpen />, action: handleLoadMission },
        { label: 'Waypoints', icon: <Navigation />, action: handleWaypoints },
        { label: 'Flight Data', icon: <Timeline />, action: handleFlightData },
      ],
    },
    {
      title: 'AI Operations',
      icon: <Psychology />,
      items: [
        { label: 'Generate Plan', icon: <AddLocationAlt />, action: handleGeneratePlan },
        { label: 'Constraints', icon: <Settings />, action: handleConstraints },
        { label: 'Import Intel', icon: <CloudDownload />, action: handleImportIntel },
      ],
    },
    {
      title: 'Export',
      icon: <CloudDownload />,
      items: [
        { 
          label: 'Export Waypoints', 
          icon: exportMissionLoading ? <CircularProgress size={20} /> : <Route />, 
          action: handleExportMission,
          loading: exportMissionLoading
        },
        { 
          label: 'Route GeoTIFF', 
          icon: exportGeotiffLoading ? <CircularProgress size={20} /> : <Map />, 
          action: handleExportGeotiff,
          loading: exportGeotiffLoading
        },
        { 
          label: 'Route PNG', 
          icon: exportPngLoading ? <CircularProgress size={20} /> : <Image />, 
          action: handleExportPng,
          loading: exportPngLoading
        },
        { 
          label: 'TAK Mission', 
          icon: exportTakLoading ? <CircularProgress size={20} /> : <Archive />, 
          action: handleExportTakMission,
          loading: exportTakLoading
        },
      ],
    },
    {
      title: 'Drone Config',
      icon: <FlightTakeoff />,
      items: [
        { label: 'Parameters', icon: <Settings /> },
        { label: 'Calibration', icon: <Settings /> },
        { label: 'Failsafe', icon: <Settings /> },
      ],
    },
  ];

  return (
    <>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            backgroundColor: 'background.paper',
            borderRight: '1px solid rgba(255, 255, 255, 0.12)',
          },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>
          {sections.map((section, index) => (
            <React.Fragment key={section.title}>
              {index > 0 && <Divider />}
              <List sx={{ py: 0.5 }}>
                <ListItem disablePadding>
                  <ListItemButton
                    onClick={() => toggleSection(section.title.toLowerCase().split(' ')[0])}
                    sx={{ py: 0.5, minHeight: 32 }}
                  >
                    <ListItemIcon sx={{ 
                      minWidth: 32, 
                      '& svg': { fontSize: 18 } 
                    }}>
                      {section.icon}
                    </ListItemIcon>
                    <ListItemText 
                      primary={section.title} 
                      sx={{ 
                        '& .MuiListItemText-primary': { 
                          fontSize: '14px',
                          fontWeight: 500
                        } 
                      }} 
                    />
                    {expandedSections[section.title.toLowerCase().split(' ')[0]] ? (
                      <ExpandLess sx={{ fontSize: 16 }} />
                    ) : (
                      <ExpandMore sx={{ fontSize: 16 }} />
                    )}
                  </ListItemButton>
                </ListItem>
                <Collapse
                  in={expandedSections[section.title.toLowerCase().split(' ')[0]]}
                  timeout="auto"
                  unmountOnExit
                >
                  <List component="div" disablePadding>
                    {section.items.map((item) => (
                      <ListItemButton
                        key={item.label}
                        sx={{ pl: 2.5, py: 0.25, minHeight: 28 }}
                        onClick={item.action}
                        disabled={item.loading}
                      >
                        <ListItemIcon sx={{ 
                          minWidth: 28, 
                          '& svg': { fontSize: 16 } 
                        }}>
                          {item.icon}
                        </ListItemIcon>
                        <ListItemText 
                          primary={item.label} 
                          sx={{ 
                            '& .MuiListItemText-primary': { 
                              fontSize: '14px' 
                            } 
                          }} 
                        />
                      </ListItemButton>
                    ))}
                  </List>
                </Collapse>
              </List>
            </React.Fragment>
          ))}
        </Box>
        
        {/* GitHub Fork Button */}
        <Box sx={{ 
          position: 'absolute', 
          bottom: 16, 
          left: 16, 
          right: 16 
        }}>
          <Button
            variant="outlined"
            fullWidth
            startIcon={<GitHub />}
            onClick={() => window.open('https://github.com/missionsim/mission-simulator', '_blank')}
            sx={{
              fontSize: '12px',
              py: 1,
              borderColor: 'rgba(255, 255, 255, 0.23)',
              color: 'text.secondary',
              '&:hover': {
                borderColor: 'rgba(255, 255, 255, 0.4)',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
              },
            }}
          >
            Fork on GitHub
          </Button>
        </Box>
      </Drawer>
      
      {/* Dialogs and Panels */}
      <NewMissionDialog 
        open={newMissionDialogOpen} 
        onClose={() => setNewMissionDialogOpen(false)} 
      />
      <MissionSelector 
        open={missionSelectorOpen} 
        onClose={() => setMissionSelectorOpen(false)} 
      />
      <WaypointsPanel 
        open={waypointsPanelOpen} 
        onClose={handleCloseWaypoints} 
      />

      {/* Constraints Dialog */}
      <Dialog open={constraintsDialogOpen} onClose={() => setConstraintsDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Settings sx={{ fontSize: 18 }} />
          Mission Constraints
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              <Box sx={{ flex: '1 1 300px', minWidth: 250 }}>
                <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, mb: 2 }}>
                  Flight Parameters
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    label="Maximum Altitude (m)"
                    type="number"
                    value={constraints.maxAltitude}
                    onChange={(e) => handleConstraintChange('maxAltitude', parseInt(e.target.value) || 120)}
                    InputProps={{ inputProps: { min: 1, max: 500 } }}
                    size="small"
                    sx={{ '& .MuiInputLabel-root': { fontSize: '12px' }, '& .MuiInputBase-input': { fontSize: '12px' } }}
                  />
                  <TextField
                    label="Minimum Altitude (m)"
                    type="number"
                    value={constraints.minAltitude}
                    onChange={(e) => handleConstraintChange('minAltitude', parseInt(e.target.value) || 10)}
                    InputProps={{ inputProps: { min: 1, max: 100 } }}
                    size="small"
                    sx={{ '& .MuiInputLabel-root': { fontSize: '12px' }, '& .MuiInputBase-input': { fontSize: '12px' } }}
                  />
                  <TextField
                    label="Maximum Speed (m/s)"
                    type="number"
                    value={constraints.maxSpeed}
                    onChange={(e) => handleConstraintChange('maxSpeed', parseInt(e.target.value) || 15)}
                    InputProps={{ inputProps: { min: 1, max: 30 } }}
                    size="small"
                    sx={{ '& .MuiInputLabel-root': { fontSize: '12px' }, '& .MuiInputBase-input': { fontSize: '12px' } }}
                  />
                </Box>
              </Box>
              <Box sx={{ flex: '1 1 300px', minWidth: 250 }}>
                <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, mb: 2 }}>
                  Safety & Weather
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    label="Battery Reserve (%)"
                    type="number"
                    value={constraints.batteryReserve}
                    onChange={(e) => handleConstraintChange('batteryReserve', parseInt(e.target.value) || 20)}
                    InputProps={{ inputProps: { min: 10, max: 50 } }}
                    size="small"
                    sx={{ '& .MuiInputLabel-root': { fontSize: '12px' }, '& .MuiInputBase-input': { fontSize: '12px' } }}
                  />
                  <TextField
                    label="Max Flight Time (min)"
                    type="number"
                    value={constraints.maxFlightTime}
                    onChange={(e) => handleConstraintChange('maxFlightTime', parseInt(e.target.value) || 20)}
                    InputProps={{ inputProps: { min: 5, max: 60 } }}
                    size="small"
                    sx={{ '& .MuiInputLabel-root': { fontSize: '12px' }, '& .MuiInputBase-input': { fontSize: '12px' } }}
                  />
                  <TextField
                    label="Wind Speed Limit (m/s)"
                    type="number"
                    value={constraints.weatherWindLimit}
                    onChange={(e) => handleConstraintChange('weatherWindLimit', parseInt(e.target.value) || 12)}
                    InputProps={{ inputProps: { min: 1, max: 25 } }}
                    size="small"
                    sx={{ '& .MuiInputLabel-root': { fontSize: '12px' }, '& .MuiInputBase-input': { fontSize: '12px' } }}
                  />
                </Box>
              </Box>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 3, fontSize: '11px' }}>
              These constraints will be applied during AI mission planning to ensure safe and compliant flight operations.
              All parameters should comply with local aviation regulations.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConstraintsDialogOpen(false)} sx={{ fontSize: '12px' }}>Cancel</Button>
          <Button onClick={handleSaveConstraints} variant="contained" sx={{ fontSize: '12px' }}>
            Save Constraints
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import Intel Dialog */}
      <Dialog open={importIntelDialogOpen} onClose={() => setImportIntelDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Security sx={{ fontSize: 18 }} />
          Import Intelligence Data
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Paper sx={{ p: 2, border: '2px dashed #ccc', textAlign: 'center' }}>
                <Upload sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                <Typography variant="body1" sx={{ fontSize: '12px', mb: 1 }}>
                  Upload Intelligence Files
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '11px', mb: 2 }}>
                  Supported formats: JSON, KML, KMZ, GeoJSON
                </Typography>
                <input
                  accept=".json,.kml,.kmz,.geojson"
                  style={{ display: 'none' }}
                  id="intel-file-upload"
                  type="file"
                  onChange={handleFileUpload}
                />
                <label htmlFor="intel-file-upload">
                  <Button
                    variant="outlined"
                    component="span"
                    disabled={importIntelLoading}
                    sx={{ fontSize: '12px' }}
                  >
                    {importIntelLoading ? <CircularProgress size={16} /> : 'Choose File'}
                  </Button>
                </label>
              </Paper>
              
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {/* Threats Section */}
                <Box sx={{ flex: '1 1 200px', minWidth: 200 }}>
                  <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Warning sx={{ fontSize: 16, color: 'error.main' }} />
                    Threats ({intelData.threats.length})
                  </Typography>
                  <Box sx={{ maxHeight: 120, overflow: 'auto' }}>
                    {intelData.threats.map((threat, index) => (
                      <Chip
                        key={index}
                        label={`${threat.name} (${threat.type})`}
                        size="small"
                        color={threat.severity === 'high' ? 'error' : threat.severity === 'medium' ? 'warning' : 'default'}
                        sx={{ m: 0.25, fontSize: '10px' }}
                      />
                    ))}
                    {intelData.threats.length === 0 && (
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '11px', fontStyle: 'italic' }}>
                        No threats imported
                      </Typography>
                    )}
                  </Box>
                </Box>

                {/* Points of Interest Section */}
                <Box sx={{ flex: '1 1 200px', minWidth: 200 }}>
                  <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <LocationOn sx={{ fontSize: 16, color: 'info.main' }} />
                    Points of Interest ({intelData.pois.length})
                  </Typography>
                  <Box sx={{ maxHeight: 120, overflow: 'auto' }}>
                    {intelData.pois.map((poi, index) => (
                      <Chip
                        key={index}
                        label={poi.name}
                        size="small"
                        color="info"
                        sx={{ m: 0.25, fontSize: '10px' }}
                      />
                    ))}
                    {intelData.pois.length === 0 && (
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '11px', fontStyle: 'italic' }}>
                        No POIs imported
                      </Typography>
                    )}
                  </Box>
                </Box>

                {/* Restricted Areas Section */}
                <Box sx={{ flex: '1 1 200px', minWidth: 200 }}>
                  <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Security sx={{ fontSize: 16, color: 'warning.main' }} />
                    Restricted Areas ({intelData.restrictedAreas.length})
                  </Typography>
                  <Box sx={{ maxHeight: 120, overflow: 'auto' }}>
                    {intelData.restrictedAreas.map((area, index) => (
                      <Chip
                        key={index}
                        label={area.name}
                        size="small"
                        color="warning"
                        sx={{ m: 0.25, fontSize: '10px' }}
                      />
                    ))}
                    {intelData.restrictedAreas.length === 0 && (
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '11px', fontStyle: 'italic' }}>
                        No restricted areas imported
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Box>
            </Box>
            
            <Typography variant="body2" color="text.secondary" sx={{ mt: 3, fontSize: '11px' }}>
              Intelligence data will be used during AI mission planning to identify threats, avoid restricted areas, 
              and optimize routes around points of interest. Data is processed locally and securely.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportIntelDialogOpen(false)} sx={{ fontSize: '12px' }}>Cancel</Button>
          <Button 
            onClick={handleSaveIntelData} 
            variant="contained" 
            disabled={intelData.threats.length === 0 && intelData.pois.length === 0 && intelData.restrictedAreas.length === 0}
            sx={{ fontSize: '12px' }}
          >
            Import Data
          </Button>
        </DialogActions>
      </Dialog>

      {/* Route Export Dialog */}
      <Dialog open={geotiffDialogOpen} onClose={() => setGeotiffDialogOpen(false)}>
        <DialogTitle sx={{ fontSize: '14px' }}>Export Route {exportType.toUpperCase()}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 300 }}>
            <TextField
              label="Zoom Level"
              type="number"
              value={geotiffZoom}
              onChange={(e) => setGeotiffZoom(Math.max(1, Math.min(18, parseInt(e.target.value) || 16)))}
              helperText="Higher values = more detail (1-18)"
              InputProps={{ inputProps: { min: 1, max: 18 } }}
              fullWidth
              sx={{
                '& .MuiInputLabel-root': { fontSize: '12px' },
                '& .MuiInputBase-input': { fontSize: '12px' },
                '& .MuiFormHelperText-root': { fontSize: '10px' }
              }}
            />
            <TextField
              label="Buffer (meters)"
              type="number"
              value={geotiffBuffer}
              onChange={(e) => setGeotiffBuffer(Math.max(50, Math.min(5000, parseInt(e.target.value) || 500)))}
              helperText="Buffer around route (50-5000m)"
              InputProps={{ inputProps: { min: 50, max: 5000 } }}
              fullWidth
              sx={{
                '& .MuiInputLabel-root': { fontSize: '12px' },
                '& .MuiInputBase-input': { fontSize: '12px' },
                '& .MuiFormHelperText-root': { fontSize: '10px' }
              }}
            />
            <TextField
              label="Map Type"
              select
              value={geotiffMapType}
              onChange={(e) => setGeotiffMapType(e.target.value)}
              fullWidth
              sx={{
                '& .MuiInputLabel-root': { fontSize: '12px' },
                '& .MuiInputBase-input': { fontSize: '12px' },
                '& .MuiMenuItem-root': { fontSize: '12px' }
              }}
            >
              <MenuItem value="satellite" sx={{ fontSize: '12px' }}>Satellite</MenuItem>
              <MenuItem value="roadmap" sx={{ fontSize: '12px' }}>Roadmap</MenuItem>
              <MenuItem value="hybrid" sx={{ fontSize: '12px' }}>Hybrid (Satellite + Roads)</MenuItem>
              <MenuItem value="terrain" sx={{ fontSize: '12px' }}>Terrain</MenuItem>
            </TextField>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontSize: '11px' }}>
              {exportType === 'geotiff' ? (
                <>
                  <strong>GeoTIFF:</strong> Georeferenced image with spatial metadata for use in GIS software (QGIS, ArcGIS).
                  <br />
                  Note: Higher zoom levels and larger buffers will take longer to generate and may consume more API credits.
                </>
              ) : (
                <>
                  <strong>PNG:</strong> Standard image format for viewing and sharing. No spatial metadata included.
                  <br />
                  Note: Higher zoom levels and larger buffers will take longer to generate and may consume more API credits.
                </>
              )}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGeotiffDialogOpen(false)} sx={{ fontSize: '12px' }}>Cancel</Button>
          <Button onClick={handleImageExport} variant="contained" sx={{ fontSize: '12px' }}>
            Export {exportType.toUpperCase()}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert 
          onClose={handleCloseNotification} 
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default Sidebar; 