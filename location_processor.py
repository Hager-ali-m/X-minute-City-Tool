import geopandas as gpd
from shapely.geometry import Point

def load_grid(file_path, target_crs="EPSG:25832"):
    """
    Load grid data and convert to the target projected coordinate system.
    Args:
        file_path (str): Path to the shapefile or GeoPackage containing grid data.
        target_crs (str): EPSG code for the target projected CRS (default: EPSG:25832).
    Returns:
        GeoDataFrame: Grid data in the target CRS.
    """
    # Load the grid GeoDataFrame and reproject to the target CRS
    grid_gdf = gpd.read_file(file_path)
    return grid_gdf.to_crs(target_crs)

def find_overlapping_grid(lat, lng, grid_gdf, target_crs="EPSG:25832", id_column="id"):
    """
    Find the value of the specified ID column of the grid cell that overlaps with the given lat/lng point.

    Args:
        lat (float): Latitude of the point.
        lng (float): Longitude of the point.
        grid_gdf (GeoDataFrame): GeoDataFrame of grid polygons in the target CRS.
        target_crs (str): EPSG code of the target projected CRS (default: EPSG:25832).
        id_column (str): The column name in the GeoDataFrame to be returned.

    Returns:
        dict: Result with status and either the grid ID or an error message.
    """
    try:
        # Create a Point object in the geographic CRS (EPSG:4326)
        user_point_geo = Point(lng, lat)

        # Convert the point to the projected CRS (EPSG:25832)
        user_point_projected = gpd.GeoSeries([user_point_geo], crs="EPSG:4326").to_crs(target_crs).iloc[0]

        # Find the grid cell containing the point
        overlapping_grid = grid_gdf[grid_gdf.geometry.contains(user_point_projected)]

        if not overlapping_grid.empty:
            # Get the value from the specified ID column and convert it to a native Python type
            grid_id = overlapping_grid.iloc[0][id_column]
            if isinstance(grid_id, (int, float, str)):
                return {"status": "success", "id": grid_id}
            else:
                return {"status": "success", "id": grid_id.item()}  # Convert NumPy types to native Python types
        else:
            return {"status": "error", "message": "No overlapping grid found."}

    except Exception as e:
        return {"status": "error", "message": str(e)}


