import os
import json
import tempfile
import asyncio
from typing import List, Optional, Tuple, Dict, Any
from io import BytesIO
import logging

import httpx
import mercantile
import rasterio
from rasterio.transform import from_bounds
from rasterio.crs import CRS
import numpy as np
from PIL import Image

from models import MissionPlan, Waypoint

logger = logging.getLogger(__name__)


class ExportService:
    def __init__(self):
        self.google_maps_api_key = os.getenv("GOOGLE_MAPS_API_KEY")
        if not self.google_maps_api_key:
            logger.warning("GOOGLE_MAPS_API_KEY not found in environment variables")

    async def export_mission_for_drone(self, mission_plan: MissionPlan) -> Dict[str, Any]:
        """
        Export mission plan in a format suitable for drone consumption.
        This creates a standardized format that can be loaded onto drones.
        """
        logger.info(f"Exporting mission plan {mission_plan.id} for drone")
        
        # Convert waypoints to a common drone format (MAVLink-compatible)
        drone_waypoints = []
        for waypoint in mission_plan.waypoints:
            drone_waypoint = {
                "seq": waypoint.order,
                "frame": 3,  # MAV_FRAME_GLOBAL_RELATIVE_ALT
                "command": self._get_mavlink_command(waypoint.type),
                "current": 1 if waypoint.order == 0 else 0,
                "autocontinue": 1,
                "param1": waypoint.loiter_time or 0,
                "param2": waypoint.radius or 0,
                "param3": 0,  # Pass through
                "param4": 0,  # Yaw angle
                "x": waypoint.position.lat,
                "y": waypoint.position.lng,
                "z": waypoint.position.alt or 30,  # Default altitude
                "mission_type": 0
            }
            drone_waypoints.append(drone_waypoint)
        
        # Create mission file structure
        mission_export = {
            "fileType": "Mission",
            "geoFence": {
                "circles": [],
                "polygons": []
            },
            "groundStation": "QGroundControl",
            "mission": {
                "cruiseSpeed": 15,
                "firmwareType": 12,  # ArduPilot
                "globalPlanAltitudeMode": 1,
                "hoverSpeed": 5,
                "items": drone_waypoints,
                "plannedHomePosition": [
                    mission_plan.waypoints[0].position.lat,
                    mission_plan.waypoints[0].position.lng,
                    mission_plan.waypoints[0].position.alt or 0
                ],
                "vehicleType": 2,  # Multirotor
                "version": 2
            },
            "ralliePoints": {
                "points": []
            },
            "version": 1
        }
        
        return mission_export

    def _get_mavlink_command(self, waypoint_type: str) -> int:
        """Convert waypoint type to MAVLink command number."""
        mavlink_commands = {
            "takeoff": 22,      # MAV_CMD_NAV_TAKEOFF
            "waypoint": 16,     # MAV_CMD_NAV_WAYPOINT
            "land": 21,         # MAV_CMD_NAV_LAND
            "loiter": 17,       # MAV_CMD_NAV_LOITER_UNLIM
            "orbit": 18,        # MAV_CMD_NAV_LOITER_TURNS
            "survey": 16        # MAV_CMD_NAV_WAYPOINT (treated as waypoint)
        }
        return mavlink_commands.get(waypoint_type, 16)

    def export_mission_waypoints(self, mission_plan: MissionPlan) -> str:
        """
        Export mission plan as a .waypoints file (Mission Planner format).
        
        This creates a tab-separated text file compatible with ArduPilot/Mission Planner.
        Format: QGC WPL 110 header followed by waypoint lines.
        
        Args:
            mission_plan: The mission plan containing waypoints
            
        Returns:
            str: Waypoints file content as string
        """
        logger.info(f"Exporting mission plan {mission_plan.id} as .waypoints file")
        
        lines = []
        
        # Add header (QGC WPL version 110 is standard)
        lines.append("QGC WPL 110")
        
        # Add home position as first waypoint (seq 0)
        # Use the first waypoint position as home, or default coordinates if no waypoints
        if mission_plan.waypoints:
            first_waypoint = mission_plan.waypoints[0]
            home_lat = first_waypoint.position.lat
            home_lng = first_waypoint.position.lng
            home_alt = 0  # Home altitude is typically 0 (ground level)
        else:
            # Default coordinates (San Francisco) if no waypoints
            home_lat, home_lng, home_alt = 37.7749, -122.4194, 0
        
        # Home position (seq=0, current=1, frame=0 for absolute, command=16 for waypoint)
        home_line = f"0\t1\t0\t16\t0.000000\t0.000000\t0.000000\t0.000000\t{home_lat:.8f}\t{home_lng:.8f}\t{home_alt:.6f}\t1"
        lines.append(home_line)
        
        # Add mission waypoints (starting from seq 1)
        for i, waypoint in enumerate(mission_plan.waypoints, 1):
            seq = i
            current = 0  # Only home position has current=1
            frame = 3    # MAV_FRAME_GLOBAL_RELATIVE_ALT (relative to home altitude)
            command = self._get_mavlink_command(waypoint.type.value if hasattr(waypoint.type, 'value') else str(waypoint.type))
            
            # Set parameters based on waypoint type
            param1 = param2 = param3 = param4 = 0.0
            
            if waypoint.type in ['takeoff']:
                param1 = 0  # Minimum pitch (for fixed wing)
                param2 = 0  # Empty
                param3 = 0  # Empty  
                param4 = 0  # Yaw angle (NaN for default)
            elif waypoint.type in ['land']:
                param1 = 0  # Abort altitude (0 = use default)
                param2 = 0  # Precision land mode
                param3 = 0  # Empty
                param4 = 0  # Yaw angle
            elif waypoint.type in ['waypoint']:
                param1 = waypoint.loiter_time or 0  # Hold time in seconds
                param2 = 0  # Acceptance radius in meters (0 = use default)
                param3 = 0  # Pass through (0) or orbit to reach (1)
                param4 = 0  # Yaw angle in degrees (NaN for default)
            elif waypoint.type in ['loiter']:
                param1 = waypoint.loiter_time or 10  # Loiter time in seconds (0 = unlimited)
                param2 = 0  # Empty
                param3 = waypoint.radius or 0  # Loiter radius (0 = use default)
                param4 = 0  # Forward moving (1) or direction of vehicle turn (0=clockwise, 1=counter-clockwise)
            elif waypoint.type in ['orbit']:
                param1 = waypoint.radius or 10  # Radius in meters
                param2 = waypoint.loiter_time or 1  # Number of turns (0 = unlimited)
                param3 = 0  # Empty
                param4 = 0  # Exit location (0=center, 1=exit_location)
            
            lat = waypoint.position.lat
            lng = waypoint.position.lng
            alt = waypoint.position.alt or 50  # Default altitude if not specified
            autocontinue = 1
            
            # Format: seq current frame command param1 param2 param3 param4 x y z autocontinue
            waypoint_line = f"{seq}\t{current}\t{frame}\t{command}\t{param1:.6f}\t{param2:.6f}\t{param3:.6f}\t{param4:.6f}\t{lat:.8f}\t{lng:.8f}\t{alt:.6f}\t{autocontinue}"
            lines.append(waypoint_line)
        
        waypoints_content = "\n".join(lines)
        logger.info(f"Generated .waypoints file with {len(mission_plan.waypoints) + 1} entries (including home)")
        
        return waypoints_content

    async def generate_route_geotiff(
        self, 
        mission_plan: MissionPlan, 
        zoom_level: int = 16,
        buffer_meters: int = 500,
        map_type: str = "satellite"
    ) -> bytes:
        """
        Generate a GeoTIFF of the route using Google Maps tiles.
        
        Args:
            mission_plan: The mission plan containing waypoints
            zoom_level: Tile zoom level (higher = more detailed)
            buffer_meters: Buffer around route in meters
            map_type: Type of map ("satellite", "roadmap", "hybrid", "terrain")
        
        Returns:
            bytes: GeoTIFF file contents
        """
        if not self.google_maps_api_key:
            raise ValueError("Google Maps API key required for GeoTIFF generation")
        
        logger.info(f"Generating GeoTIFF for mission {mission_plan.id} at zoom {zoom_level}")
        
        # Calculate bounding box for the route
        bounds = self._calculate_route_bounds(mission_plan.waypoints, buffer_meters)
        logger.info(f"Route bounds: {bounds}")
        
        # Get tiles that cover the route
        tiles = list(mercantile.tiles(
            bounds['west'], bounds['south'], 
            bounds['east'], bounds['north'], 
            zoom_level
        ))
        logger.info(f"Need {len(tiles)} tiles at zoom {zoom_level}")
        
        if not tiles:
            raise ValueError("No tiles found for the given route bounds")
        
        # Download tiles
        tile_images = await self._download_tiles(tiles, map_type)
        
        # Stitch tiles together into a single image
        stitched_image, image_bounds = self._stitch_tiles(tiles, tile_images)
        
        # Convert to GeoTIFF
        geotiff_bytes = self._create_geotiff(stitched_image, image_bounds)
        
        logger.info("GeoTIFF generation completed")
        return geotiff_bytes

    def _calculate_route_bounds(self, waypoints: List[Waypoint], buffer_meters: int) -> Dict[str, float]:
        """Calculate bounding box for waypoints with buffer."""
        if not waypoints:
            raise ValueError("No waypoints provided")
        
        lats = [wp.position.lat for wp in waypoints]
        lngs = [wp.position.lng for wp in waypoints]
        
        min_lat, max_lat = min(lats), max(lats)
        min_lng, max_lng = min(lngs), max(lngs)
        
        # Convert buffer from meters to degrees
        # 1 degree latitude ≈ 111,320 meters (more accurate)
        lat_buffer = buffer_meters / 111320
        
        # Longitude varies by latitude - use center latitude for calculation
        center_lat = (min_lat + max_lat) / 2
        lng_buffer = buffer_meters / (111320 * abs(np.cos(np.radians(center_lat))))
        
        # Add small extra buffer (10%) to ensure route is well-contained
        lat_buffer *= 1.1
        lng_buffer *= 1.1
        
        bounds = {
            'west': min_lng - lng_buffer,
            'south': min_lat - lat_buffer,
            'east': max_lng + lng_buffer,
            'north': max_lat + lat_buffer
        }
        
        logger.info(f"Route bounds: {bounds}")
        return bounds

    async def _download_tiles(self, tiles: List[mercantile.Tile], map_type: str = "satellite") -> Dict[mercantile.Tile, Image.Image]:
        """Download map tiles from Google Maps."""
        tile_images = {}
        
        async with httpx.AsyncClient() as client:
            # Download tiles in batches to avoid overwhelming the API
            for i in range(0, len(tiles), 10):  # Process 10 tiles at a time
                batch = tiles[i:i+10]
                tasks = [self._download_single_tile(client, tile, map_type) for tile in batch]
                results = await asyncio.gather(*tasks, return_exceptions=True)
                
                for tile, result in zip(batch, results):
                    if isinstance(result, Exception):
                        logger.warning(f"Failed to download tile {tile}: {result}")
                        # Create a placeholder image for failed tiles
                        tile_images[tile] = Image.new('RGB', (256, 256), color='gray')
                    else:
                        tile_images[tile] = result
        
        return tile_images

    async def _download_single_tile(self, client: httpx.AsyncClient, tile: mercantile.Tile, map_type: str) -> Image.Image:
        """Download a single tile from Google Maps."""
        # Google Maps tile layer types
        layer_types = {
            "satellite": "s",      # Satellite imagery
            "roadmap": "m",        # Standard roadmap
            "hybrid": "y",         # Hybrid (satellite + roads/labels)
            "terrain": "t"         # Terrain
        }
        
        layer = layer_types.get(map_type, "s")  # Default to satellite
        
        # Google Maps tile servers (mt0-mt3)
        server = f"mt{tile.x % 4}"  # Load balance across servers
        
        url = f"https://{server}.google.com/vt/lyrs={layer}&x={tile.x}&y={tile.y}&z={tile.z}&key={self.google_maps_api_key}"
        
        response = await client.get(url, timeout=30.0)
        response.raise_for_status()
        
        # Convert to PIL Image
        image = Image.open(BytesIO(response.content))
        return image

    def _stitch_tiles(self, tiles: List[mercantile.Tile], tile_images: Dict[mercantile.Tile, Image.Image]) -> Tuple[Image.Image, Dict[str, float]]:
        """Stitch individual tiles into a single image."""
        if not tiles:
            raise ValueError("No tiles to stitch")
        
        # Find the bounds of all tiles
        min_x = min(tile.x for tile in tiles)
        max_x = max(tile.x for tile in tiles)
        min_y = min(tile.y for tile in tiles)
        max_y = max(tile.y for tile in tiles)
        
        # Calculate output image size (Google Maps tiles are 256x256)
        tile_size = 256
        width = (max_x - min_x + 1) * tile_size
        height = (max_y - min_y + 1) * tile_size
        
        # Create output image
        stitched = Image.new('RGB', (width, height))
        
        # Place each tile in the correct position
        for tile in tiles:
            if tile in tile_images:
                x_offset = (tile.x - min_x) * tile_size
                y_offset = (tile.y - min_y) * tile_size
                stitched.paste(tile_images[tile], (x_offset, y_offset))
        
        # Calculate geographic bounds of the stitched image
        top_left_tile = mercantile.Tile(min_x, min_y, tiles[0].z)
        bottom_right_tile = mercantile.Tile(max_x, max_y, tiles[0].z)
        
        top_left_bounds = mercantile.bounds(top_left_tile)
        bottom_right_bounds = mercantile.bounds(bottom_right_tile)
        
        image_bounds = {
            'west': top_left_bounds.west,
            'north': top_left_bounds.north,
            'east': bottom_right_bounds.east,
            'south': bottom_right_bounds.south
        }
        
        return stitched, image_bounds

    def _create_geotiff(self, image: Image.Image, bounds: Dict[str, float]) -> bytes:
        """Convert PIL Image to georeferenced GeoTIFF with proper spatial reference."""
        with tempfile.NamedTemporaryFile(suffix='.geotiff', delete=False) as temp_file:
            temp_path = temp_file.name
        
        # Convert PIL image to numpy array
        image_array = np.array(image)
        
        # Handle RGB vs RGBA
        if len(image_array.shape) == 3:
            height, width, bands = image_array.shape
        else:
            height, width = image_array.shape
            bands = 1
            image_array = image_array.reshape((height, width, 1))
        
        # Create geotransform (maps pixel coordinates to geographic coordinates)
        transform = from_bounds(
            bounds['west'], bounds['south'], 
            bounds['east'], bounds['north'], 
            width, height
        )
        
        logger.info(f"Creating georeferenced GeoTIFF: {width}x{height} pixels")
        logger.info(f"Geographic bounds: W={bounds['west']:.6f}, S={bounds['south']:.6f}, E={bounds['east']:.6f}, N={bounds['north']:.6f}")
        logger.info(f"Pixel size: {abs(transform.a):.8f}° x {abs(transform.e):.8f}°")
        
        # Write georeferenced GeoTIFF
        with rasterio.open(
            temp_path,
            'w',
            driver='GTiff',
            height=height,
            width=width,
            count=bands,
            dtype=image_array.dtype,
            crs=CRS.from_epsg(4326),  # WGS84 Geographic Coordinate System
            transform=transform,
            compress='jpeg',
            tiled=True,
            # Add georeferencing metadata
            photometric='RGB' if bands == 3 else 'GRAY',
            interleave='pixel'
        ) as dst:
            # Write image data
            if bands == 1:
                dst.write(image_array[:, :, 0], 1)
            else:
                for i in range(bands):
                    dst.write(image_array[:, :, i], i + 1)
            
            # Add additional metadata for better georeferencing
            dst.update_tags(
                TIFFTAG_SOFTWARE="Mission Simulator - Drone Route Export",
                TIFFTAG_ARTIST="Mission Planning API",
                TIFFTAG_DOCUMENTNAME=f"Drone Route GeoTIFF",
                AREA_OR_POINT="Area",  # Pixel values represent area averages
                DATUM="WGS84",
                PROJECTION="Geographic"
            )
            
            # Verify georeferencing
            logger.info(f"GeoTIFF CRS: {dst.crs}")
            logger.info(f"GeoTIFF Transform: {dst.transform}")
            logger.info(f"GeoTIFF Bounds: {dst.bounds}")
        
        # Read the georeferenced file back as bytes
        with open(temp_path, 'rb') as f:
            geotiff_bytes = f.read()
        
        # Clean up temporary file
        os.unlink(temp_path)
        
        logger.info("Georeferenced GeoTIFF creation completed")
        return geotiff_bytes

    def verify_geotiff_georeferencing(self, geotiff_path: str) -> Dict[str, Any]:
        """
        Verify the georeferencing of a GeoTIFF file.
        This is a utility method for debugging and validation.
        """
        verification_info = {}
        
        with rasterio.open(geotiff_path) as src:
            verification_info.update({
                "crs": str(src.crs),
                "crs_epsg": src.crs.to_epsg() if src.crs else None,
                "transform": list(src.transform),
                "bounds": {
                    "left": src.bounds.left,
                    "bottom": src.bounds.bottom, 
                    "right": src.bounds.right,
                    "top": src.bounds.top
                },
                "width": src.width,
                "height": src.height,
                "count": src.count,
                "dtype": str(src.dtypes[0]),
                "nodata": src.nodata,
                "is_georeferenced": src.crs is not None and src.transform != rasterio.Affine.identity(),
                "pixel_size": {
                    "x": abs(src.transform.a),
                    "y": abs(src.transform.e)
                },
                "tags": dict(src.tags())
            })
            
            # Calculate center point
            center_x = (src.bounds.left + src.bounds.right) / 2
            center_y = (src.bounds.bottom + src.bounds.top) / 2
            verification_info["center_point"] = {"x": center_x, "y": center_y}
            
            # Get corner coordinates in geographic space
            verification_info["corners"] = {
                "top_left": src.transform * (0, 0),
                "top_right": src.transform * (src.width, 0),
                "bottom_left": src.transform * (0, src.height),
                "bottom_right": src.transform * (src.width, src.height)
            }
        
        return verification_info

    async def generate_route_png(
        self, 
        mission_plan: MissionPlan, 
        zoom_level: int = 16,
        buffer_meters: int = 500,
        map_type: str = "satellite"
    ) -> bytes:
        """
        Generate a PNG image of the route using Google Maps tiles.
        
        Args:
            mission_plan: The mission plan containing waypoints
            zoom_level: Tile zoom level (higher = more detailed)
            buffer_meters: Buffer around route in meters
            map_type: Type of map ("satellite", "roadmap", "hybrid", "terrain")
        
        Returns:
            bytes: PNG file contents
        """
        if not self.google_maps_api_key:
            raise ValueError("Google Maps API key required for PNG generation")
        
        logger.info(f"Generating PNG for mission {mission_plan.id} at zoom {zoom_level}")
        
        # Calculate bounding box for the route
        bounds = self._calculate_route_bounds(mission_plan.waypoints, buffer_meters)
        logger.info(f"Route bounds: {bounds}")
        
        # Get tiles that cover the route
        tiles = list(mercantile.tiles(
            bounds['west'], bounds['south'], 
            bounds['east'], bounds['north'], 
            zoom_level
        ))
        logger.info(f"Need {len(tiles)} tiles at zoom {zoom_level}")
        
        if not tiles:
            raise ValueError("No tiles found for the given route bounds")
        
        # Download tiles
        tile_images = await self._download_tiles(tiles, map_type)
        
        # Stitch tiles together into a single image
        stitched_image, image_bounds = self._stitch_tiles(tiles, tile_images)
        
        # Convert to PNG bytes
        png_bytes = self._create_png(stitched_image)
        
        logger.info("PNG generation completed")
        return png_bytes

    def _create_png(self, image: Image.Image) -> bytes:
        """Convert PIL Image to PNG bytes."""
        logger.info(f"Creating PNG: {image.width}x{image.height} pixels")
        
        # Create a BytesIO buffer to hold the PNG data
        png_buffer = BytesIO()
        
        # Save as PNG with optimization
        image.save(
            png_buffer, 
            format='PNG',
            optimize=True,
            compress_level=6  # Good balance of size vs quality
        )
        
        # Get the PNG bytes
        png_bytes = png_buffer.getvalue()
        png_buffer.close()
        
        logger.info(f"PNG creation completed, size: {len(png_bytes)} bytes")
        return png_bytes 