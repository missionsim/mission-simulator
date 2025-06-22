import React, { useRef, useEffect, useState } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { Line, TransformControls as DreiTransformControls } from '@react-three/drei';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { Waypoint, WaypointCommand } from '../../types';
import { addWaypoint, updateWaypoint } from '../../store/slices/missionSlice';
import { usePathAnimation } from '../../hooks/usePathAnimation';
import * as THREE from 'three';
import { 
  TilesRenderer as TilesRendererImpl,
  GlobeControls as GlobeControlsImpl
} from '3d-tiles-renderer';
import {
  GLTFExtensionsPlugin,
  GoogleCloudAuthPlugin,
  TileCompressionPlugin,
  TilesFadePlugin,
  UpdateOnChangePlugin
} from '3d-tiles-renderer/plugins';
import {
  TilesAttributionOverlay,
  TilesRenderer
} from '3d-tiles-renderer/r3f';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { Geodetic, PointOfView, radians } from '@takram/three-geospatial';

interface ThreeMap3DProps {
  apiKey: string;
}

// DRACO loader setup
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

// Globe component that uses 3D tiles with proper authentication and controls
const Globe: React.FC<{ apiKey: string }> = ({ apiKey }) => {
  const [tiles, setTiles] = useState<TilesRendererImpl | null>(null);
  const [controls, setControls] = useState<GlobeControlsImpl | null>(null);
  const { scene, camera, gl } = useThree();

  // Set initial camera position using geospatial utilities
  const setInitialCameraPosition = (camera: THREE.Camera) => {
    // Default position: San Francisco area with good altitude for viewing
    const longitude = -122.4194; // San Francisco
    const latitude = 37.7749;
    const altitude = 15000; // 15km altitude for good overview
    const heading = 0; // North
    const pitch = -45; // Looking down at 45 degrees
    
    // Create point of view
    const pov = new PointOfView(altitude, radians(heading), radians(pitch));
    const geodetic = new Geodetic(radians(longitude), radians(latitude));
    
    // Apply to camera
    pov.decompose(
      geodetic.toECEF(),
      camera.position,
      camera.quaternion,
      camera.up
    );
    
    camera.updateMatrix();
    camera.updateMatrixWorld(true);
  };

  useEffect(() => {
    if (!apiKey) return;

    console.log('Setting up 3D tiles with API key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'MISSING');
    
    // Create tiles renderer
    const tilesUrl = `https://tile.googleapis.com/v1/3dtiles/root.json?key=${apiKey}`;
    const tilesRenderer = new TilesRendererImpl(tilesUrl);
    
    // Configure camera and renderer
    tilesRenderer.setCamera(camera);
    tilesRenderer.setResolutionFromRenderer(camera, gl);
    
    // Set initial camera position
    setInitialCameraPosition(camera);
    
    // Create globe controls with correct parameter order (scene, camera, domElement, tilesRenderer)
    const globeControls = new GlobeControlsImpl(scene, camera, gl.domElement, tilesRenderer);
    globeControls.enableDamping = true;
    globeControls.adjustHeight = false; // Re-enable when user first drags
    globeControls.maxAltitude = Math.PI * 0.55; // Permit grazing angles
    
    // Set up controls behavior - re-enable adjustHeight on first interaction
    const enableAdjustHeight = () => {
      globeControls.adjustHeight = true;
      globeControls.removeEventListener('start', enableAdjustHeight);
    };
    globeControls.addEventListener('start', enableAdjustHeight);
    
    console.log('Created tiles renderer with globe controls for URL:', tilesUrl);
    
    // ----- Begin DRACO setup -----
    const gltfLoader = new GLTFLoader(tilesRenderer.manager);
    gltfLoader.setDRACOLoader(dracoLoader);
    tilesRenderer.manager.addHandler(/\.gltf$/i, gltfLoader);
    tilesRenderer.manager.addHandler(/\.glb$/i, gltfLoader);
    // ----- End DRACO setup -----
    
    // Add plugins for proper Google Cloud authentication
    try {
      const authPlugin = new GoogleCloudAuthPlugin({
        apiToken: apiKey,
        autoRefreshToken: true
      });
      tilesRenderer.registerPlugin(authPlugin);
      console.log('GoogleCloudAuthPlugin registered successfully');
      
      // Add other performance plugins
      tilesRenderer.registerPlugin(new GLTFExtensionsPlugin());
      tilesRenderer.registerPlugin(new TileCompressionPlugin());
      tilesRenderer.registerPlugin(new UpdateOnChangePlugin());
      tilesRenderer.registerPlugin(new TilesFadePlugin());
      
    } catch (error) {
      console.warn('Could not register plugins:', error);
      console.log('Falling back to basic tile loading...');
    }
    
    // Add to scene
    scene.add(tilesRenderer.group);
    
    // Configure error handling
    tilesRenderer.addEventListener('load-error', (event: any) => {
      console.error('3D Tiles load error:', event);
      console.error('URL that failed:', event.url);
      console.error('Error details:', event.error);
    });
    
    tilesRenderer.addEventListener('load-model', (event: any) => {
      console.log('3D Tile model loaded successfully');
    });
    
    setTiles(tilesRenderer);
    setControls(globeControls);
    
    // Store globe controls globally for waypoint interaction
    (window as any).globeControls = globeControls;
    
    return () => {
      scene.remove(tilesRenderer.group);
      tilesRenderer.dispose();
      globeControls.dispose();
      if ((window as any).globeControls === globeControls) {
        (window as any).globeControls = null;
      }
    };
  }, [apiKey, scene, camera, gl]);

  // Update tiles and controls in animation loop
  useFrame(() => {
    if (tiles) {
      tiles.update();
    }
    if (controls) {
      controls.update();
    }
  });

  return null;
};

// Individual waypoint marker component
const WaypointMarker: React.FC<{
  waypoint: Waypoint;
  position: [number, number, number];
  isSelected: boolean;
  onSelect: (waypoint: Waypoint) => void;
  onPositionChange: (waypoint: Waypoint, position: [number, number, number]) => void;
  index: number;
}> = ({ waypoint, position, isSelected, onSelect, onPositionChange, index }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const transformRef = useRef<any>(null);
  const { camera } = useThree();

  const handleClick = (event: any) => {
    event.stopPropagation();
    onSelect(waypoint);
  };

  // Register listeners & global shortcuts when selected
  useEffect(() => {
    const controls = transformRef.current;
    if (!isSelected || !controls) return;

    (window as any).currentTransformControls = controls;

    const handleObjectChange = () => {
      if (meshRef.current) {
        const newPosition = meshRef.current.position.toArray() as [number, number, number];
        onPositionChange(waypoint, newPosition);
      }
    };

    const handleDraggingChanged = (event: any) => {
      const globeControls = (window as any).globeControls;
      if (globeControls) {
        globeControls.enabled = !event.value;
      }
    };

    controls.addEventListener('objectChange', handleObjectChange);
    controls.addEventListener('dragging-changed', handleDraggingChanged);

    return () => {
      controls.removeEventListener('objectChange', handleObjectChange);
      controls.removeEventListener('dragging-changed', handleDraggingChanged);
      if ((window as any).currentTransformControls === controls) {
        (window as any).currentTransformControls = null;
      }
    };
  }, [isSelected, waypoint, onPositionChange, transformRef]);

  // Dynamically resize the gizmo based on camera distance
  useFrame(() => {
    if (isSelected && transformRef.current && meshRef.current) {
      const distance = camera.position.distanceTo(meshRef.current.position);
      const scale = Math.max(50, distance / 10); // Larger gizmo for earth-scale coordinates
      if (typeof transformRef.current.setSize === 'function') {
        transformRef.current.setSize(scale);
      } else {
        (transformRef.current as any).size = scale;
      }
    }
  });

  const markerMesh = (
    <mesh
      ref={meshRef}
      position={position}
      onClick={handleClick}
      onPointerOver={(e) => (e.stopPropagation(), (document.body.style.cursor = 'pointer'))}
      onPointerOut={(e) => (document.body.style.cursor = 'auto')}
    >
      <sphereGeometry args={[10, 16, 16]} />
      <meshBasicMaterial 
        color={isSelected ? "#ff9800" : "#2196f3"} 
        transparent 
        opacity={isSelected ? 0.9 : 0.7}
      />
    </mesh>
  );

  return (
    <group>
      {isSelected ? (
        <DreiTransformControls
          ref={transformRef as any}
          mode="translate"
          showX
          showY
          showZ
        >
          {markerMesh}
        </DreiTransformControls>
      ) : (
        markerMesh
      )}

      {/* Direction indicator for selected waypoint */}
      {isSelected && (
        <group>
          {/* X axis indicator (red) */}
          <mesh position={[position[0] + 400, position[1], position[2]]}>
            <boxGeometry args={[200, 25, 25]} />
            <meshBasicMaterial color="#ff4444" transparent opacity={0.6} />
          </mesh>
          {/* Y axis indicator (green) */}
          <mesh position={[position[0], position[1] + 400, position[2]]}>
            <boxGeometry args={[25, 200, 25]} />
            <meshBasicMaterial color="#44ff44" transparent opacity={0.6} />
          </mesh>
          {/* Z axis indicator (blue) */}
          <mesh position={[position[0], position[1], position[2] + 400]}>
            <boxGeometry args={[25, 25, 200]} />
            <meshBasicMaterial color="#4444ff" transparent opacity={0.6} />
          </mesh>
        </group>
      )}
    </group>
  );
};

// Smooth spline path component
const WaypointPath: React.FC<{
  waypoints: Waypoint[];
  latLngToECEF: (lat: number, lng: number, alt?: number) => [number, number, number];
}> = ({ waypoints, latLngToECEF }) => {
  const [points, setPoints] = useState<[number, number, number][]>([]);
  
  useEffect(() => {
    if (waypoints.length > 1) {
      const controlPoints: THREE.Vector3[] = [];
      
      waypoints.forEach((waypoint) => {
        const position = latLngToECEF(
          waypoint.position.lat,
          waypoint.position.lng,
          waypoint.position.alt || 50
        );
        controlPoints.push(new THREE.Vector3(position[0], position[1], position[2]));
      });
      
      if (controlPoints.length >= 2) {
        // Create smooth Catmull-Rom spline curve
        const curve = new THREE.CatmullRomCurve3(controlPoints, false, 'catmullrom', 0.3);
        
        // Generate smooth points along the curve
        const divisions = Math.max(50, controlPoints.length * 20); // More points for smoother curves
        const curvePoints = curve.getPoints(divisions);
        
        // Convert to array of tuples for Line component
        const linePoints = curvePoints.map(point => [point.x, point.y, point.z] as [number, number, number]);
        setPoints(linePoints);
      }
    }
  }, [waypoints, latLngToECEF]);

  if (waypoints.length < 2 || points.length === 0) return null;

  return (
    <Line
      points={points}
      color="#ffffff"
      lineWidth={2}
      transparent
      opacity={0.9}
    />
  );
};

// Enhanced waypoint markers component
const WaypointMarkers: React.FC = () => {
  const dispatch = useDispatch();
  const [selectedWaypointId, setSelectedWaypointId] = useState<string | null>(null);
  const currentMissionId = useSelector((state: RootState) => state.mission.currentMissionId);
  const currentMission = useSelector((state: RootState) => 
    currentMissionId ? state.mission.missions[currentMissionId] : null
  );
  const selectedDroneId = useSelector((state: RootState) => state.drone.selectedDroneId);
  const selectedDrone = useSelector((state: RootState) => 
    selectedDroneId ? state.drone.drones[selectedDroneId] : null
  );
  const animationState = useSelector((state: RootState) => state.animation);
  
  // Initialize path animation for 3D map
  usePathAnimation();

  // Convert lat/lng to ECEF coordinates
  const latLngToECEF = (lat: number, lng: number, alt: number = 0) => {
    const a = 6378137.0; // Earth's semi-major axis
    const f = 1 / 298.257223563; // Earth's flattening
    const e2 = 2 * f - f * f; // First eccentricity squared
    
    const latRad = lat * Math.PI / 180;
    const lngRad = lng * Math.PI / 180;
    
    const N = a / Math.sqrt(1 - e2 * Math.sin(latRad) * Math.sin(latRad));
    
    const x = (N + alt) * Math.cos(latRad) * Math.cos(lngRad);
    const y = (N + alt) * Math.cos(latRad) * Math.sin(lngRad);
    const z = (N * (1 - e2) + alt) * Math.sin(latRad);
    
    return [x, y, z] as [number, number, number];
  };

  // Convert ECEF back to lat/lng
  const ecefToLatLng = (x: number, y: number, z: number) => {
    const a = 6378137.0;
    const f = 1 / 298.257223563;
    const e2 = 2 * f - f * f;
    
    const p = Math.sqrt(x * x + y * y);
    const theta = Math.atan2(z * a, p * (1 - f) * a);
    
    const lat = Math.atan2(
      z + (e2 * (1 - f) / (1 - e2)) * a * Math.pow(Math.sin(theta), 3),
      p - e2 * a * Math.pow(Math.cos(theta), 3)
    );
    
    const lng = Math.atan2(y, x);
    const N = a / Math.sqrt(1 - e2 * Math.sin(lat) * Math.sin(lat));
    const alt = p / Math.cos(lat) - N;
    
    return {
      lat: lat * 180 / Math.PI,
      lng: lng * 180 / Math.PI,
      alt: alt
    };
  };

  const handleWaypointSelect = (waypoint: Waypoint) => {
    setSelectedWaypointId(waypoint.id === selectedWaypointId ? null : waypoint.id);
  };

  const handleWaypointPositionChange = (waypoint: Waypoint, newPosition: [number, number, number]) => {
    if (!currentMissionId) return;
    
    const newLatLng = ecefToLatLng(newPosition[0], newPosition[1], newPosition[2]);
    const updatedPosition = {
      lat: newLatLng.lat,
      lng: newLatLng.lng,
      alt: Math.max(0, newLatLng.alt) // Ensure altitude is not negative
    };
    
    dispatch(updateWaypoint({ 
      missionId: currentMissionId, 
      waypointId: waypoint.id, 
      updates: { position: updatedPosition } 
    }));
  };

  // Keyboard shortcuts for transform mode switching
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      const transformControls = (window as any).currentTransformControls;
      if (!transformControls || !selectedWaypointId) return;
      
      switch (event.key.toLowerCase()) {
        case 'g': // Grab/Move (translate)
          transformControls.setMode('translate');
          break;
        case 'r': // Rotate
          transformControls.setMode('rotate');
          break;
        case 's': // Scale
          transformControls.setMode('scale');
          break;
        case 'escape':
          setSelectedWaypointId(null);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedWaypointId]);

  return (
    <group>
      {/* Render path connections */}
      {currentMission?.waypoints && (
        <WaypointPath waypoints={currentMission.waypoints} latLngToECEF={latLngToECEF} />
      )}
      
      {/* Render waypoints */}
      {currentMission?.waypoints.map((waypoint, index) => {
        const position = latLngToECEF(
          waypoint.position.lat, 
          waypoint.position.lng, 
          waypoint.position.alt || 50
        );
        
        return (
          <WaypointMarker
            key={waypoint.id}
            waypoint={waypoint}
            position={position}
            isSelected={waypoint.id === selectedWaypointId}
            onSelect={handleWaypointSelect}
            onPositionChange={handleWaypointPositionChange}
            index={index}
          />
        );
      })}
      
      {/* Render drone */}
      {selectedDrone && (
        <group 
          position={latLngToECEF(
            animationState.animatedDronePosition?.lat || selectedDrone.position.lat,
            animationState.animatedDronePosition?.lng || selectedDrone.position.lng,
            selectedDrone.telemetry.altitude
          )}
          rotation={[0, (animationState.animatedDroneHeading || selectedDrone.heading) * Math.PI / 180, 0]}
        >
          {/* Main drone cone */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[15, 30, 4]} />
            <meshBasicMaterial color={animationState.isPlaying ? "#ff9800" : "#4caf50"} />
          </mesh>
          
          {/* Helper axes */}
          <primitive object={new THREE.AxesHelper(200)} />
        </group>
      )}
    </group>
  );
};

// Enhanced click handler component with 3D raycasting
const ClickHandler: React.FC = () => {
  const dispatch = useDispatch();
  const { camera, raycaster, scene } = useThree();
  const drawingMode = useSelector((state: RootState) => state.mission.drawingMode);
  const currentMissionId = useSelector((state: RootState) => state.mission.currentMissionId);
  const cameraPosition = useSelector((state: RootState) => state.mapView.cameraPosition);

  // Convert ECEF back to lat/lng
  const ecefToLatLng = (x: number, y: number, z: number) => {
    const a = 6378137.0;
    const f = 1 / 298.257223563;
    const e2 = 2 * f - f * f;
    
    const p = Math.sqrt(x * x + y * y);
    const theta = Math.atan2(z * a, p * (1 - f) * a);
    
    const lat = Math.atan2(
      z + (e2 * (1 - f) / (1 - e2)) * a * Math.pow(Math.sin(theta), 3),
      p - e2 * a * Math.pow(Math.cos(theta), 3)
    );
    
    const lng = Math.atan2(y, x);
    const N = a / Math.sqrt(1 - e2 * Math.sin(lat) * Math.sin(lat));
    const alt = p / Math.cos(lat) - N;
    
    return {
      lat: lat * 180 / Math.PI,
      lng: lng * 180 / Math.PI,
      alt: alt
    };
  };

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (drawingMode !== 'waypoint' || !currentMissionId) return;

      // Skip if clicking on UI elements or transform controls
      const target = event.target as HTMLElement;
      if (target.tagName.toLowerCase() !== 'canvas') return;

      // Get mouse position in normalized device coordinates
      const canvas = target as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );

      // Create a raycaster
      const tempRaycaster = new THREE.Raycaster();
      tempRaycaster.setFromCamera(mouse, camera);

      // Create a waypoint at a reasonable distance in front of the camera
      const distance = 10000; // 10km in front of camera
      const direction = tempRaycaster.ray.direction.clone();
      const newPosition = camera.position.clone().add(direction.multiplyScalar(distance));
      
      // Convert back to lat/lng
      const latLng = ecefToLatLng(newPosition.x, newPosition.y, newPosition.z);
      
      const newWaypoint: Waypoint = {
        id: `wp_${Date.now()}`,
        position: {
          lat: latLng.lat,
          lng: latLng.lng,
          alt: Math.max(50, latLng.alt), // Minimum 50m altitude
        },
        command: WaypointCommand.WAYPOINT,
        params: [0, 0, 0, 0],
        frame: 3,
        isCurrent: false,
        autocontinue: true,
      };
      
      dispatch(addWaypoint({ missionId: currentMissionId, waypoint: newWaypoint }));
    };

    const canvas = document.querySelector('canvas');
    if (canvas) {
      canvas.addEventListener('click', handleClick);
      return () => canvas.removeEventListener('click', handleClick);
    }
  }, [drawingMode, currentMissionId, dispatch, camera, ecefToLatLng]);

  return null;
};

const ThreeMap3D: React.FC<ThreeMap3DProps> = ({ apiKey }) => {
  const cameraPosition = useSelector((state: RootState) => state.mapView.cameraPosition);

  console.log('ThreeMap3D rendering with API key:', apiKey ? 'Present' : 'Missing');

  if (!apiKey) {
    return (
      <div style={{ 
        height: '100%', 
        width: '100%',
        backgroundColor: '#0a0a0a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#f44336',
        fontSize: '16px',
        textAlign: 'center',
        padding: '20px'
      }}>
        <div>
          <div>🔑 Google Maps API Key Required</div>
          <div style={{ fontSize: '14px', marginTop: '10px', opacity: 0.8 }}>
            Please set REACT_APP_GOOGLE_MAPS_API_KEY in your .env file
          </div>
          <div style={{ fontSize: '12px', marginTop: '10px', opacity: 0.6 }}>
            See 3D_TILES_SETUP.md for instructions
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      <Canvas
        gl={{ depth: true, antialias: true }}
        camera={{
          position: [0, 0, cameraPosition.altitude],
          fov: 50,
          near: 0.1,
          far: 50000000
        }}
        style={{ height: '100%', width: '100%' }}
        onCreated={({ gl }) => {
          gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1;
        }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[1, 1, 1]} intensity={1} />
        <Globe apiKey={apiKey} />
        <WaypointMarkers />
        <ClickHandler />
      </Canvas>
    </div>
  );
};

export default ThreeMap3D; 