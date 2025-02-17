from flask import Blueprint, request, jsonify

filter_bp = Blueprint('filter_bp', __name__)

@filter_bp.route('/filter-by-id', methods=['POST'])
def filter_by_id():
    try:
        data = request.get_json()
        location_id = data.get("id")
        
        # Access the DataFrame via a custom attribute on the blueprint
        dest_travel_time_df = filter_bp.dest_travel_time_df  

        if not location_id:
            return jsonify({"status": "error", "message": "No location_id provided."}), 400

        filtered = dest_travel_time_df[dest_travel_time_df['from_id'] == location_id]
        records = filtered.to_dict(orient='records')

        return jsonify({"status": "success", "filtered_data": records}), 200

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
