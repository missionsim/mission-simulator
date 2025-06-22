# Export Functionality Setup

This document explains how to set up the export functionality for missions and route GeoTIFFs.

## Overview

The export functionality provides three main features:

1. **Mission Export** - Export mission plans in drone-compatible format (QGroundControl/MAVLink)
2. **Route GeoTIFF** - Generate **fully georeferenced** TIFF images of mission routes using satellite imagery
3. **Route PNG** - Generate standard PNG images of mission routes for viewing and sharing

The GeoTIFF files include complete spatial reference information:
- **Coordinate Reference System**: WGS84 (EPSG:4326)
- **Geotransform**: Maps pixel coordinates to geographic coordinates
- **Spatial Metadata**: Proper TIFF tags for GIS software compatibility
- **File Format**: Standards-compliant GeoTIFF that works with QGIS, ArcGIS, Google Earth Pro, etc.

The PNG files are standard images without spatial metadata:
- **File Format**: Optimized PNG for universal viewing
- **Use Cases**: Presentations, reports, social media sharing
- **Compatibility**: Works with any image viewer or web browser
- **File Size**: Typically smaller than GeoTIFF for easier sharing

## Required API Keys

### Google Maps API Key (Required)

For generating route GeoTIFFs, you need a Google Maps API key:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Maps Static API** in the API Library
4. Navigate to **Credentials** and create a new API key
5. (Optional but recommended) Restrict the API key to the Maps Static API
6. Add the API key to your environment:
   ```bash
   export GOOGLE_MAPS_API_KEY=AIzaSyC-dK_kcAm... 
   ```

### Alternative Tile Providers (Optional)

The system can be extended for other tile providers:

- **Mapbox** - Requires Mapbox account and access token
- **Bing Maps API** - Requires Microsoft Azure account and Bing Maps key
- **OpenStreetMap** - Free tiles available (no API key required, but rate limited)

## Environment Variables

Create a `.env` file in the `api/` directory with:

```env
# Required for GeoTIFF generation
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# Required for AI functionality
OPENAI_API_KEY=your_openai_api_key_here

# Optional configuration
API_HOST=0.0.0.0
API_PORT=9000
DEBUG=true
```

## Dependencies

The following Python packages are required (already added to requirements.txt):

- `mercantile==1.2.1` - Tile coordinate calculations
- `rasterio==1.3.9` - GeoTIFF creation and manipulation
- `Pillow==10.2.0` - Image processing
- `numpy==1.26.4` - Array operations

## API Endpoints

### Export Mission for Drone
```
POST /api/v1/mission-planning/export/mission/{mission_id}
```
Returns a QGroundControl-compatible mission file (.plan format).

### Export Route GeoTIFF
```
POST /api/v1/mission-planning/export/geotiff/{mission_id}?zoom_level=16&buffer_meters=500&map_type=satellite
```
Returns a georeferenced TIFF file of the mission route.

### Export Route PNG
```
POST /api/v1/mission-planning/export/png/{mission_id}?zoom_level=16&buffer_meters=500&map_type=satellite
```
Returns a standard PNG image file of the mission route.

Parameters for both image exports:
- `zoom_level` (1-18): Tile detail level (higher = more detail)
- `buffer_meters` (50-5000): Buffer around route in meters
- `map_type`: Type of map imagery
  - `satellite` - High-resolution satellite imagery
  - `roadmap` - Standard road map
  - `hybrid` - Satellite imagery with roads and labels
  - `terrain` - Topographic terrain map

## Usage Examples

### Export Mission
```bash
curl -X POST "http://localhost:9000/api/v1/mission-planning/export/mission/demo-mission-001" \
  -H "accept: application/json" \
  -o mission_demo.plan
```

### Export Route GeoTIFF
```bash
curl -X POST "http://localhost:9000/api/v1/mission-planning/export/geotiff/demo-mission-001?zoom_level=16&buffer_meters=1000&map_type=satellite" \
  -H "accept: image/tiff" \
  -o route_demo_satellite.geotiff
```

### Export Route PNG
```bash
curl -X POST "http://localhost:9000/api/v1/mission-planning/export/png/demo-mission-001?zoom_level=16&buffer_meters=1000&map_type=satellite" \
  -H "accept: image/png" \
  -o route_demo_satellite.png
```

## Format Comparison

| Feature | GeoTIFF | PNG |
|---------|---------|-----|
| **Spatial Reference** | ✅ Full georeferencing | ❌ No spatial metadata |
| **GIS Compatibility** | ✅ QGIS, ArcGIS, etc. | ❌ Image viewers only |
| **File Size** | Larger | Smaller |
| **Sharing** | Technical users | Universal |
| **Use Cases** | Analysis, mapping | Presentations, reports |
| **Quality** | Lossless | Optimized compression |

### When to Use Each Format

**Use GeoTIFF when:**
- Working with GIS software (QGIS, ArcGIS)
- Need precise coordinate information
- Overlaying with other spatial data
- Professional mapping workflows
- Coordinate-based analysis

**Use PNG when:**
- Creating presentations or reports
- Sharing on social media
- Email attachments (smaller files)
- Quick visual reference
- Non-technical stakeholders

## GeoTIFF Georeferencing Details

The generated GeoTIFF files are fully georeferenced and include:

### Spatial Information
- **Coordinate System**: WGS84 Geographic (EPSG:4326)
- **Units**: Decimal degrees
- **Datum**: World Geodetic System 1984
- **Pixel Registration**: Area-based (each pixel represents an area average)

### Metadata Tags
- Software identification
- Creation date and source
- Projection information
- Spatial reference details

### GIS Software Compatibility
The GeoTIFF files work directly with:
- **QGIS** - Open source GIS software
- **ArcGIS** - ESRI's GIS platform  
- **Google Earth Pro** - For visualization and analysis
- **GDAL/OGR** - Command-line geospatial tools
- **Python** - rasterio, GDAL bindings
- **R** - raster, terra packages

### Verification
To verify georeferencing with GDAL tools:
```bash
gdalinfo route_demo_satellite.geotiff
```

This will show the coordinate system, geotransform, and bounds information.

## Tile Costs and Limits

### Google Maps Pricing
- **Maps Static API**: $2.00 per 1,000 requests after free tier
- **Free tier**: $200 monthly credit (≈100,000 requests)
- Rate limit: Varies by project and usage

### Tile Estimation
For a typical mission covering 1km², you might need:
- Zoom 14: ~16 tiles
- Zoom 16: ~256 tiles  
- Zoom 18: ~4,096 tiles

Higher zoom levels provide more detail but consume more API calls.

### Map Type Considerations
- **Satellite**: Best for terrain analysis and obstacle identification
- **Roadmap**: Useful for urban navigation and infrastructure
- **Hybrid**: Combines satellite imagery with road/label overlays
- **Terrain**: Shows elevation and topographic features

## Troubleshooting

### Common Issues

1. **"Google Maps API key required"**
   - Ensure `GOOGLE_MAPS_API_KEY` is set in your environment
   - Verify the API key is valid and Maps Static API is enabled
   - Check that your project has billing enabled (required for Maps APIs)

2. **"No tiles found for the given route bounds"**
   - Check that your mission has valid waypoints with lat/lng coordinates
   - Ensure the buffer_meters parameter isn't too small

3. **"Failed to download tile" / HTTP 403 errors**
   - Check your Google Cloud Console for API quotas and billing
   - Verify your API key hasn't exceeded rate limits
   - Ensure the Maps Static API is enabled for your project

4. **Installation Issues**
   - For rasterio installation issues on macOS: `brew install gdal`
   - For Windows: Use conda instead of pip for geospatial packages

### API Key Setup Verification

Test your API key with a simple request:
```bash
curl "https://mt1.google.com/vt/lyrs=s&x=0&y=0&z=1&key=YOUR_API_KEY"
```

If successful, you should receive image data. If you get a 403 error, check your API key and billing setup.

### Debugging

Set `DEBUG=true` in your environment to see detailed logging of the export process, including:
- Tile calculation and bounds
- Download progress and errors
- Image stitching details

## Map Type Examples

Different map types serve different purposes:

- **Satellite** (`satellite`): Perfect for analyzing terrain, vegetation, and natural obstacles
- **Roadmap** (`roadmap`): Shows roads, buildings, and infrastructure clearly  
- **Hybrid** (`hybrid`): Combines satellite with roads/labels - great for flight planning in populated areas
- **Terrain** (`terrain`): Shows elevation changes and topography - useful for mountain/hill operations

## Future Enhancements

- Support for additional tile providers (Mapbox, Bing, OSM)
- Custom styling and overlays on GeoTIFFs
- Vector tile support for smaller file sizes
- Batch export of multiple missions
- Integration with drone fleet management systems
- Offline tile caching for repeated areas 