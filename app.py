from flask import Flask, render_template, jsonify, send_from_directory, request, session
import location_processor
import geopandas as gpd
import pandas as pd
import os
import r5py
import datetime
from shapely.geometry import Point
from shapely.geometry import LineString
import datetime
from datetime import timedelta

# Ithe Flask application
app = Flask(__name__, static_folder='static')
app.secret_key = 'Ayman'

# the trip origins GeoDataFrame
grid_file = "data/shannon_acc_merge.shp"
grid_gdf = location_processor.load_grid(grid_file)

# reading the network layer
transport_network_path = "static/data/muenster_osm.osm.pbf"
transport_network = r5py.TransportNetwork(transport_network_path)

# Paths to yspeed-based CSVs
CSV_PATH = os.path.join('static', 'data', 'all_destinations_wgs84.csv')
SLOW_CSV_PATH = os.path.join('static', 'data', 'alldestinations_travel_matrix_slow_15.csv')
AVG_CSV_PATH = os.path.join('static', 'data', 'alldestinations_travel_matrix_average_15.csv')
FAST_CSV_PATH = os.path.join('static', 'data', 'alldestinations_travel_matrix_fast_15.csv')
INDEX_SLOW_CSV_PATH = os.path.join('static', 'data', 'index_slow.csv')
INDEX_AVG_CSV_PATH = os.path.join('static', 'data', 'index_average.csv')
INDEX_FAST_CSV_PATH = os.path.join('static', 'data', 'index_fast.csv')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/amenities')
def amenities_page():
    return render_template('amenities.html')

@app.route('/dashboard')
def dashboard_page():
    return render_template('dashboard.html')

@app.route('/locations', methods=['GET'])
def get_locations():
    """
    Reads the CSV file, converts it to JSON, and serves it via the `/locations` endpoint.
    """
    try:
        # Load the CSV file into a DataFrame
        df = pd.read_csv(CSV_PATH)

        # Ensure required columns exist
        if not {'id', 'type', 'lon', 'lat', 'name', 'fclass'}.issubset(df.columns):
            return jsonify({"error": "CSV file is missing required columns."}), 400

        # Replace NaN values in critical columns
        df['name'] = df['name'].fillna('Unknown')  # Replace NaN in 'name' with 'Unknown'
        df['type'] = df['type'].fillna('Unknown')  # Replace NaN in 'type' with 'Unknown'

        # Convert the DataFrame to a GeoJSON-like structure
        features = []
        for _, row in df.iterrows():
            # Skip invalid rows
            if pd.isna(row['lat']) or pd.isna(row['lon']) or pd.isna(row['type']):
                continue

            # Add each row as a feature
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [row['lon'], row['lat']]
                },
                "properties": {
                    "id": row['id'],
                    "type": row['type'],
                    "name": row['name'],
                    "fclass": row['fclass']
                }
            })

        # Combine into a GeoJSON FeatureCollection
        geojson_response = {
            "type": "FeatureCollection",
            "features": features
        }
        return jsonify(geojson_response)

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    

# Process location endpoint
@app.route('/process-location', methods=['POST'])
def process_location():
    data = request.get_json()
    lat = data.get('lat')
    lng = data.get('lng')

    # Reload the grid GeoDataFrame
    grid_gdf = location_processor.load_grid("data/shannon_acc_merge.shp", target_crs="EPSG:25832")
    result = location_processor.find_overlapping_grid(lat, lng, grid_gdf, target_crs="EPSG:25832")

    if result['status'] == 'success':
        from_id = result['id']
        # Store the found grid ID in session
        session['from_id'] = from_id

        return jsonify({
                "status": "success",
                "grid_id": from_id,
                "from_id": from_id,
            })
    else:
        return jsonify(result), 400
    

@app.route('/filter-travel-time', methods=['POST'])
def filter_travel_time():
    try:
        data = request.get_json()
        from_id = session.get('from_id', None)
        rider_speed = data.get("riderSpeed")



        if from_id is None:

            return jsonify({"status": "error", "message": "No from_id found in session."}), 400

        # Determine which CSV to load
        csv_path_map = {
            "slow": SLOW_CSV_PATH,
            "average": AVG_CSV_PATH,
            "fast": FAST_CSV_PATH
        }
        csv_path = csv_path_map.get(rider_speed)

        if not csv_path or not os.path.exists(csv_path):

            return jsonify({"status": "error", "message": "Unknown rider speed."}), 400

        # Read the CSV and filter by from_id
        df = pd.read_csv(csv_path)


        df_filtered = df[
            (df['from_id'] == int(from_id)) &
            (df['travel_time'].notna())
        ]


        # Create a list of dictionaries with to_id and travel_time
        travel_data = df_filtered[['to_id', 'travel_time']].to_dict(orient='records')


        return jsonify({"status": "success", "travel_data": travel_data}), 200

    except Exception as e:

        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/fetch-destinations', methods=['POST'])
def fetch_destinations():
    try:
        data = request.get_json()
        travel_data = data.get('travel_data', [])
        selected_types = data.get('selected_types', [])


        if not travel_data:
        
            return jsonify({"status": "error", "message": "No travel_data provided."}), 400

        # Convert travel_data to DataFrame
        travel_df = pd.DataFrame(travel_data)
        

        # Load all destinations
        dest_df = pd.read_csv(CSV_PATH)
        

        # Ensure 'id' and 'to_id' are integers
        dest_df['id'] = pd.to_numeric(dest_df['id'], errors='coerce')
        travel_df['to_id'] = pd.to_numeric(travel_df['to_id'], errors='coerce')

        # Drop rows with NaN in 'id' or 'to_id'
        dest_df = dest_df.dropna(subset=['id'])
        travel_df = travel_df.dropna(subset=['to_id', 'travel_time'])

        # Convert 'id' and 'to_id' to integer
        dest_df['id'] = dest_df['id'].astype(int)
        travel_df['to_id'] = travel_df['to_id'].astype(int)

        # Merge destinations with travel_time based on to_id and id
        merged_df = pd.merge(dest_df, travel_df, left_on='id', right_on='to_id', how='inner')
    

        if merged_df.empty:
  
            return jsonify({"status": "success", "destinations": []}), 200

        if selected_types:
            # Standardize 'type' for case-insensitive matching
            merged_df['type'] = merged_df['type'].str.lower().str.strip()
            selected_types_lower = [t.lower().strip() for t in selected_types]
            merged_df = merged_df[merged_df['type'].isin(selected_types_lower)]


        if merged_df.empty:

            return jsonify({"status": "success", "destinations": []}), 200

        # Replace or fill NaNs
        merged_df = merged_df.where(pd.notnull(merged_df), None)

        # Select relevant columns, including travel_time
        selected_columns = ['id', 'osm_id', 'code', 'fclass', 'name', 'type', 'lon', 'lat', 'geometry', 'opportunities', 'travel_time']
        merged_df = merged_df[selected_columns]


        # Convert to dictionary
        records = merged_df.to_dict(orient='records')


        # Store in session for route generation
        session['filtered_destinations'] = records  # A list of dicts

        return jsonify({"status": "success", "destinations": records}), 200

    except Exception as e:

        return jsonify({"status": "error", "message": "Internal server error."}), 500


@app.route('/get-index', methods=['POST'])
def get_index():
    try:
        data = request.get_json()
        rider_speed = data.get('rider_speed')
        from_id = session.get('from_id')

        if not from_id:
            return jsonify({"status": "error", "message": "No from_id found in session."}), 400

        if not rider_speed:
            return jsonify({"status": "error", "message": "Missing rider_speed in request."}), 400

        # Map rider_speed to the corresponding CSV path
        csv_path_map = {
            "slow": INDEX_SLOW_CSV_PATH,
            "average": INDEX_AVG_CSV_PATH,
            "fast": INDEX_FAST_CSV_PATH
        }

        csv_path = csv_path_map.get(rider_speed)
        if not csv_path or not os.path.exists(csv_path):
            return jsonify({"status": "error", "message": f"Invalid rider_speed or missing CSV file for {rider_speed}."}), 404

        index_df = pd.read_csv(csv_path)

        # Validate columns
        required_columns = ['from_id', 'shannon_in', 'X-minute City Compliance Score', 'Aggregated Bike Lanes', 'Bikeability Index']
        if not all(col in index_df.columns for col in required_columns):
            return jsonify({"status": "error", "message": "CSV file is missing required columns."}), 400

        # Filter for the relevant row
        row = index_df[index_df['from_id'] == int(from_id)]
        if row.empty:
            return jsonify({"status": "error", "message": f"No data found for from_id: {from_id}."}), 404

        # Convert row to response
        result = row.iloc[0].to_dict()
        response = {
            "status": "success",
            "shannon_in": result['shannon_in'],
            "compliance_score": result['X-minute City Compliance Score'],
            "bike_lanes": result['Aggregated Bike Lanes'],
            "bikeability_index": result['Bikeability Index']
        }

        return jsonify(response), 200

    except Exception as e:
        app.logger.error(f"Error in /get-index: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
