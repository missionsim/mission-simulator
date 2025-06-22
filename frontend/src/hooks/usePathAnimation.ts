import { useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { tick, updateAnimatedDronePosition } from '../store/slices/animationSlice';
import { Waypoint, Coordinates } from '../types';

// Calculate distance between two coordinates in meters
function calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
  const R = 6371000; // Earth's radius in meters
  const lat1Rad = coord1.lat * Math.PI / 180;
  const lat2Rad = coord2.lat * Math.PI / 180;
  const deltaLatRad = (coord2.lat - coord1.lat) * Math.PI / 180;
  const deltaLngRad = (coord2.lng - coord1.lng) * Math.PI / 180;

  const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) *
    Math.sin(deltaLngRad / 2) * Math.sin(deltaLngRad / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Calculate bearing between two coordinates in degrees
function calculateBearing(coord1: Coordinates, coord2: Coordinates): number {
  const lat1Rad = coord1.lat * Math.PI / 180;
  const lat2Rad = coord2.lat * Math.PI / 180;
  const deltaLngRad = (coord2.lng - coord1.lng) * Math.PI / 180;

  const y = Math.sin(deltaLngRad) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(deltaLngRad);

  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
}

// Interpolate between two coordinates
function interpolateCoordinates(coord1: Coordinates, coord2: Coordinates, t: number): Coordinates {
  return {
    lat: coord1.lat + (coord2.lat - coord1.lat) * t,
    lng: coord1.lng + (coord2.lng - coord1.lng) * t,
  };
}

// Calculate path segments with distances and cumulative distances
function calculatePathSegments(waypoints: Waypoint[]) {
  const segments = [];
  let totalDistance = 0;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const start = waypoints[i].position;
    const end = waypoints[i + 1].position;
    const distance = calculateDistance(start, end);
    
    segments.push({
      start,
      end,
      distance,
      cumulativeDistance: totalDistance,
      bearing: calculateBearing(start, end),
      startIndex: i,
      endIndex: i + 1,
    });
    
    totalDistance += distance;
  }

  return { segments, totalDistance };
}

export const usePathAnimation = () => {
  const dispatch = useDispatch();
  const animationRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number>(0);
  
  const animationState = useSelector((state: RootState) => state.animation);
  const currentMissionId = useSelector((state: RootState) => state.mission.currentMissionId);
  const currentMission = useSelector((state: RootState) => 
    currentMissionId ? state.mission.missions[currentMissionId] : null
  );

  useEffect(() => {
    if (!animationState.isPlaying || !currentMission || currentMission.waypoints.length < 2) {
      if (animationRef.current !== undefined) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = undefined;
      }
      return;
    }

    const animate = (currentTime: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = currentTime;
      }

      const deltaTime = (currentTime - lastTimeRef.current) / 1000; // Convert to seconds
      lastTimeRef.current = currentTime;

      // Update animation time
      dispatch(tick(deltaTime));

      // Calculate current position along path
      const { segments, totalDistance } = calculatePathSegments(currentMission.waypoints);
      
      if (segments.length > 0 && totalDistance > 0) {
        // Calculate current distance along path based on animation progress
        const currentDistance = animationState.progress * totalDistance;
        
        // Find which segment we're currently in
        let currentSegment = segments[0];
        for (const segment of segments) {
          if (currentDistance >= segment.cumulativeDistance && 
              currentDistance <= segment.cumulativeDistance + segment.distance) {
            currentSegment = segment;
            break;
          }
        }

        // Calculate position within the current segment
        const segmentProgress = totalDistance > 0 
          ? Math.max(0, Math.min(1, (currentDistance - currentSegment.cumulativeDistance) / currentSegment.distance))
          : 0;
        
        const interpolatedPosition = interpolateCoordinates(
          currentSegment.start,
          currentSegment.end,
          segmentProgress
        );

        // Update animated drone position
        dispatch(updateAnimatedDronePosition({
          position: interpolatedPosition,
          heading: currentSegment.bearing,
          waypointIndex: currentSegment.startIndex,
        }));
      }

      if (animationState.isPlaying) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current !== undefined) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animationState.isPlaying, animationState.progress, currentMission, dispatch]);

  // Reset lastTimeRef when animation is reset or stopped
  useEffect(() => {
    if (!animationState.isPlaying) {
      lastTimeRef.current = 0;
    }
  }, [animationState.isPlaying]);
}; 