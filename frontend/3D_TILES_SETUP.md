# 3D Tiles Renderer Setup Instructions

This project uses the [NASA-AMMOS/3DTilesRendererJS](https://github.com/NASA-AMMOS/3DTilesRendererJS) library to stream photorealistic 3D tiles from Google's Photorealistic 3D Tiles API.

## Prerequisites

1. **Google Cloud Console Account** with billing enabled
2. **Three.js knowledge** for custom 3D interactions

## Setup Steps

### 1. Get Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Go to "APIs & Services" > "Credentials"
4. Click "Create Credentials" > "API Key"
5. Copy your API key

### 2. Enable Required APIs

Enable these APIs in your Google Cloud Console:
- **Map Tiles API** (required for photorealistic 3D tiles)
- **Maps JavaScript API** (required)
- **Places API** (optional, for enhanced location features)

### 3. Set Environment Variable

Create a `.env` file in the `frontend` directory:

```env
REACT_APP_GOOGLE_MAPS_API_KEY=your_actual_api_key_here
```

**Important:** No quotes, no spaces around the equals sign.

### 4. Secure Your API Key (Critical!)

1. In Google Cloud Console, go to your API key settings
2. Add "Application restrictions" (HTTP referrers)
3. Add your domain(s):
   - `http://localhost:3000/*` (for development)
   - `https://yourdomain.com/*` (for production)
4. Add "API restrictions" and select only the APIs you need

## Features

### 🌍 Photorealistic 3D Tiles
- **Real-world 3D terrain and buildings** from Google's satellite and aerial imagery
- **High-resolution textures** with actual building geometries
- **Streaming LOD (Level of Detail)** - loads only what you need to see

### 🎯 Mission Planning in 3D
- **Click to place waypoints** directly on 3D terrain
- **Drag waypoints** in 3D space for precise positioning
- **Altitude-aware planning** - see actual building heights and terrain
- **Real-time 3D flight paths** between waypoints

### 🚁 Drone Visualization
- **3D drone markers** with heading indicators
- **Real-time position updates** on 3D terrain
- **Altitude visualization** relative to actual ground/building heights

### 📊 Intel Data Integration
- **3D threat markers** positioned on actual terrain
- **Points of Interest (POIs)** with 3D context
- **Interactive labels** that scale with distance

### 🎮 Advanced Controls
- **Globe controls** optimized for Earth-scale navigation
- **Smooth camera transitions** between locations
- **Gesture support** for pan, zoom, tilt, and rotate
- **Keyboard shortcuts** for precise navigation

## Architecture

### Components
- `ThreeMap3D.tsx` - Main 3D map container using React Three Fiber
- `WaypointMarkers` - 3D waypoint visualization and interaction
- `Globe` - Core 3D tiles renderer with plugins

### Key Libraries
- **[3d-tiles-renderer](https://github.com/NASA-AMMOS/3DTilesRendererJS)** - Core 3D tiles streaming
- **[@react-three/fiber](https://github.com/pmndrs/react-three-fiber)** - React integration for Three.js
- **[Three.js](https://threejs.org/)** - 3D rendering engine

### Plugins Used
- `GoogleCloudAuthPlugin` - API authentication
- `TileCompressionPlugin` - Optimized tile loading
- `TilesFadePlugin` - Smooth tile transitions
- `UpdateOnChangePlugin` - Efficient re-rendering

## Performance Optimization

### Automatic Features
- **Level of Detail (LOD)** streaming based on camera distance
- **Frustum culling** - only renders visible tiles
- **Tile caching** with LRU (Least Recently Used) eviction
- **Compression** for faster downloads

### Tips for Better Performance
- Use API key restrictions to avoid quota exhaustion
- Monitor tile loading in browser dev tools
- Consider implementing custom tile prioritization for mission-critical areas

## Troubleshooting

**Map not loading?**
- Check that your API key is correctly set in `.env`
- Verify that the Map Tiles API is enabled
- Check browser console for error messages
- Ensure you've restarted the dev server after adding the API key

**3D tiles not appearing?**
- 3D tiles are only available in major cities and populated areas
- Try zooming in closer - 3D tiles appear at higher zoom levels
- Check that your location has 3D coverage in Google Earth

**Performance issues?**
- Monitor your API usage in Google Cloud Console
- Reduce the number of simultaneous tile requests
- Consider implementing tile request throttling

**Waypoint placement not working?**
- Ensure you're in "waypoint" drawing mode (click the waypoint tool)
- Click directly on the 3D terrain, not empty space
- Check that you have a mission selected

## API Costs

3D tiles consume significantly more API quota than standard 2D tiles:
- **Map Tiles API** charges per tile request
- **3D tiles are larger** and require more requests
- **Monitor usage** in Google Cloud Console
- **Set billing alerts** to avoid unexpected charges

## Development Notes

The current implementation provides a solid foundation for 3D mission planning. Future enhancements could include:
- Ray-casting against 3D geometry for precise ground positioning
- Custom DRACO/KTX2 loader configuration for optimized models
- Advanced lighting and atmospheric effects
- Multi-LOD waypoint rendering based on camera distance

## Comparison with Traditional 2D Maps

| Feature | 2D Maps (Leaflet) | 3D Tiles |
|---------|-------------------|----------|
| **Terrain Awareness** | Flat representation | True 3D elevation |
| **Building Heights** | Not shown | Actual building geometry |
| **Flight Planning** | Estimate obstacles | See actual obstacles |
| **Performance** | Fast, lightweight | More intensive |
| **Visual Fidelity** | Good for overview | Photorealistic detail |
| **API Usage** | Lower | Higher |

Choose 3D view for detailed mission planning in urban environments, 2D for quick overview and rural areas. 