// amenities.js

/////////////////////////////////////////////////////////////////////////////////////////////
// 1) Leaflet Map Initialization
/////////////////////////////////////////////////////////////////////////////////////////////

// Initialize the map and set its view to Münster city center
const map = L.map('map').setView([51.9610, 7.6100], 13);

// Add various tile layers
const OpenStreetMap_HOT = L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap contributors, Tiles style by Humanitarian OpenStreetMap Team hosted by OpenStreetMap France',
}).addTo(map);

const Stadia_AlidadeSatellite = L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_satellite/{z}/{x}/{y}{r}.{ext}', {
    minZoom: 0,
    maxZoom: 20,
    attribution: '&copy; CNES, Distribution Airbus DS, © Airbus DS, © PlanetObserver (Contains Copernicus Data) | © Stadia Maps © OpenMapTiles © OpenStreetMap contributors',
    ext: 'jpg'
});

const Esri_WorldGrayCanvas = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles © Esri — Esri, DeLorme, NAVTEQ',
    maxZoom: 16
});

// Add OpenStreetMap tile layer as another option
const OpenStreetMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
});

// Base layers object for layer control
const baseMaps = {
    "Street Map": OpenStreetMap_HOT,
    "Open Street Map": OpenStreetMap,
    "Satellite": Stadia_AlidadeSatellite,
    "Esri World Gray Canvas": Esri_WorldGrayCanvas
};

// Add zoom control at the bottom right
L.control.zoom({
    position: 'bottomright'
}).addTo(map);

// Add layer control to the map
L.control.layers(baseMaps).addTo(map);

/////////////////////////////////////////////////////////////////////////////////////////////
// 2) Handling Selected Location
/////////////////////////////////////////////////////////////////////////////////////////////

// Retrieve the selected location from localStorage
const selectedLocation = JSON.parse(localStorage.getItem('selectedLocation'));

if (selectedLocation) {
    const { lat, lng } = selectedLocation;

    // Custom marker icon for the user's location
    const customIcon = L.icon({
        iconUrl: '/static/images/pin.png', // Path to your marker image
        iconSize: [50, 50], // Size of the icon [width, height]
        iconAnchor: [25, 50], // Point of the icon which will correspond to marker's location [x, y]
        popupAnchor: [0, -50], // Point from which the popup should open relative to the iconAnchor
    });

    // Create the marker for the user's location
    const userMarker = L.marker([lat, lng], { icon: customIcon })
        .addTo(map)
        .bindPopup('<strong>Your Location</strong>')
        .openPopup();

    // Zoom in to the selected location
    map.setView([lat, lng], 16);

    // Reverse geocoding to get the address
    fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`)
        .then(response => response.json())
        .then(data => {
            const address = data.display_name || 'Unknown address';

            // Update the marker's popup with the address
            userMarker.setPopupContent(`
                <strong>Selected Location:</strong><br>${address}<br>
                <strong>Latitude:</strong> ${lat}<br>
                <strong>Longitude:</strong> ${lng}
            `).openPopup();
        })
        .catch(error => {
            console.error('Reverse geocoding error:', error);
            // Fallback popup content if reverse geocoding fails
            userMarker.setPopupContent(`
                <strong>Selected Location</strong><br>
                Latitude: ${lat}, Longitude: ${lng}
            `).openPopup();
        });
} else {
    console.log("No location selected.");
}

/////////////////////////////////////////////////////////////////////////////////////////////
// 3) Navigation Strip Icon Click Events (Optional)
///////////////////////////////////////////////////////////////////////////////////////////////

// Uncomment and modify the following if you have navigation icons to handle
/*
document.getElementById('icon-other').addEventListener('click', function() {
    alert('Navigating to the Other Interface.');
});

var toolIcon = document.getElementById('icon-map');
var leftPane = document.getElementById('left-pane');

toolIcon.addEventListener('click', function() {
    leftPane.classList.toggle('hidden');
});
*/

/////////////////////////////////////////////////////////////////////////////////////////////
// 4) Layer Groups for Different Amenity Types
/////////////////////////////////////////////////////////////////////////////////////////////
const layerGroups = {
    food: L.layerGroup(),
    education: L.layerGroup(),
    healthcare: L.layerGroup(),
    sports: L.layerGroup(),
    leisure: L.layerGroup(),
    transportation: L.layerGroup(),
};

// Optionally, add all layer groups to the map by default
// Object.values(layerGroups).forEach(group => group.addTo(map));

/////////////////////////////////////////////////////////////////////////////////////////////
// 5) Loading Indicator Functions
/////////////////////////////////////////////////////////////////////////////////////////////

// Ensure that your amenities.html has an element with ID 'loader'.
// If you wish to remove the loading indicator from amenities.js as well, comment out or remove these functions.

function showLoadingIndicator() {
    const loader = document.getElementById('loading-indicator'); // Ensure your HTML has an element with id 'loader'
    if (loader) loader.style.display = 'flex';
}

function hideLoadingIndicator() {
    const loader = document.getElementById('loading-indicator');
    if (loader) loader.style.display = 'none';
}

/////////////////////////////////////////////////////////////////////////////////////////////
// 6) Fetch and Render All Amenities
/////////////////////////////////////////////////////////////////////////////////////////////
function fetchAndRenderLocations() {
    fetch('/locations')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            // Clear all existing layer groups
            Object.values(layerGroups).forEach(g => g.clearLayers());

            data.features.forEach(feature => {
                const { geometry, properties } = feature;
                if (!geometry || geometry.type !== 'Point') return;

                const [lon, lat] = geometry.coordinates;
                const typeLower = properties.type.toLowerCase();

                if (layerGroups[typeLower]) {
                    const marker = L.marker([lat, lon], {
                        icon: L.icon({
                            iconUrl: `/static/images/${typeLower}.png`,
                            iconSize: [20, 20],
                            iconAnchor: [10, 20],
                            popupAnchor: [0, -20],
                        })
                    }).bindPopup(`
                        <strong>Name:</strong> ${properties.name || 'Unknown'}<br>
                        <strong>Sub-Category:</strong> ${properties.fclass || 'Unknown'}<br>
                        <strong>ID:</strong> ${properties.id}
                    `);
                    
                    // Add marker to the corresponding layer group
                    layerGroups[typeLower].addLayer(marker);
                }
            });

            console.log('All amenities loaded and placed in layer groups.');
        })
        .catch(error => {
            console.error('Error fetching locations:', error);
        });
}

/////////////////////////////////////////////////////////////////////////////////////////////
// 7) Amenity Type Selection Handling
/////////////////////////////////////////////////////////////////////////////////////////////
function getSelectedAmenityType() {
    const radios = document.querySelectorAll('input[name="amenityType"]');
    for (const radio of radios) {
        if (radio.checked) {
            return radio.value; // e.g., 'food', 'education', etc.
        }
    }
    return null; // If none is selected
}

function onAmenityTypeChange() {
    // Remove all layer groups from the map
    Object.values(layerGroups).forEach(layer => {
        map.removeLayer(layer);
    });

    // Add only the selected layer to the map
    const selectedType = getSelectedAmenityType();
    if (selectedType && layerGroups[selectedType]) {
        layerGroups[selectedType].addTo(map);
        console.log(`Added layer for amenity type: ${selectedType}`);
    }
}

/////////////////////////////////////////////////////////////////////////////////////////////
// 8) Back Button Handling (Optional)
/////////////////////////////////////////////////////////////////////////////////////////////
function handleBackButtonClick() {
    // Clear relevant localStorage items
    localStorage.removeItem('from_id');
    localStorage.removeItem('selectedLocation');
    localStorage.removeItem('selectedAmenityType');
    localStorage.removeItem('filteredDestinations');
    localStorage.removeItem('shannon_in');

    // Optionally clear all localStorage (use with caution)
    // localStorage.clear();

    // Redirect to the index page
    window.location.href = '/';
}

/////////////////////////////////////////////////////////////////////////////////////////////
// 9) Event Listeners on Page Load
/////////////////////////////////////////////////////////////////////////////////////////////
document.addEventListener('DOMContentLoaded', () => {
    // Fetch and render all amenities
    fetchAndRenderLocations();

    // Attach event listeners to amenity type radio buttons
    const radios = document.querySelectorAll('input[name="amenityType"]');
    radios.forEach(radio => {
        radio.addEventListener('change', onAmenityTypeChange);
    });

    // Attach event listener to the back button
    const backButton = document.getElementById('back-button');
    if (backButton) {
        backButton.addEventListener('click', handleBackButtonClick);
    }

    // Pre-select the amenity type if stored and update the map layers
    const storedAmenityType = localStorage.getItem('selectedAmenityType');
    if (storedAmenityType) {
        const amenityRadio = document.querySelector(`input[name="amenityType"][value="${storedAmenityType}"]`);
        if (amenityRadio) {
            amenityRadio.checked = true;
            onAmenityTypeChange(); // Update the map layers accordingly
            console.log(`Pre-selected amenity type: ${storedAmenityType}`);
        }
    }

    // Attach event listener to the rider speed selector
    const riderSpeedSelector = document.getElementById('rider-speed-selector');
    if (riderSpeedSelector) {
        riderSpeedSelector.addEventListener('change', (event) => {
            const speed = event.target.value;
            localStorage.setItem('riderSpeed', speed);
            console.log(`Rider speed selected: ${speed}`);
        });
    } else {
        console.error("Rider speed selector with ID 'rider-speed-selector' not found.");
    }
});

// Log 'from_id' if present
const fromId = localStorage.getItem('from_id');
console.log("From ID:", fromId);

/////////////////////////////////////////////////////////////////////////////////////////////
// 10) Rider Speed Selection Handling
/////////////////////////////////////////////////////////////////////////////////////////////
function getSelectedRiderSpeed() {
    const riderSpeedSelector = document.getElementById('rider-speed-selector');
    return riderSpeedSelector ? riderSpeedSelector.value : null;
}

/////////////////////////////////////////////////////////////////////////////////////////////
// 11) Generate Dashboard Click Handler
/////////////////////////////////////////////////////////////////////////////////////////////
function onGenerateClick() {
    // 1. Gather user inputs
    const selectedAmenityType = getSelectedAmenityType();
    const riderSpeed = getSelectedRiderSpeed();

    console.log("Selected Amenity Type:", selectedAmenityType);
    console.log("Selected Rider Speed:", riderSpeed);

    if (!selectedAmenityType || !riderSpeed) {
        alert("Please select both an amenity type and rider speed.");
        return;
    }

    // 2. Show loading indicator
    showLoadingIndicator();

    // 3. Retrieve selected location from localStorage
    const selectedLocation = JSON.parse(localStorage.getItem('selectedLocation'));
    if (!selectedLocation) {
        alert("No location selected.");
        hideLoadingIndicator();
        return;
    }

    console.log("Selected Location:", selectedLocation);

    // 4. Send location to /process-location
    fetch('/process-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: selectedLocation.lat, lng: selectedLocation.lng })
    })
    .then(response => response.json())
    .then(data => {
        console.log("Process Location Response:", data);
        if (data.status !== 'success') {
            throw new Error(data.message || 'Error processing location.');
        }
        // Proceed to filter travel time
        return fetch('/filter-travel-time', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ riderSpeed })
        });
    })
    .then(response => response.json())
    .then(data => {
        console.log("Filter Travel Time Response:", data);
        if (data.status !== 'success') {
            throw new Error(data.message || 'Error filtering travel time.');
        }
        const travel_data = data.travel_data; // Correctly extract 'travel_data'
        if (!travel_data || travel_data.length === 0) {
            throw new Error('No destinations found for the selected rider speed.');
        }
        // Store selected amenity type and rider speed in localStorage
        localStorage.setItem('selectedAmenityType', selectedAmenityType);
        localStorage.setItem('riderSpeed', riderSpeed);
        console.log("Stored 'selectedAmenityType' and 'riderSpeed' in localStorage.");

        // Fetch destinations based on travel data and selected amenity type
        return fetch('/fetch-destinations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                travel_data: travel_data, // Send 'travel_data'
                selected_types: [selectedAmenityType] 
            })
        });
    })
    .then(response => response.json())
    .then(data => {
        console.log("Fetch Destinations Response:", data);
        if (data.status !== 'success') {
            throw new Error(data.message || 'Error fetching destinations.');
        }
        const destinations = data.destinations;
        if (!destinations || destinations.length === 0) {
            throw new Error('No matching destinations found.');
        }
        // Store filtered destinations in localStorage
        localStorage.setItem('filteredDestinations', JSON.stringify(destinations));
        console.log("Stored 'filteredDestinations' in localStorage.");

        // Fetch diversity index
        return fetch('/get-index', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rider_speed: riderSpeed })
        })
        .then(response => response.json())
        .then(shannonData => {
            console.log("Get Index Response:", shannonData);
            if (shannonData.status !== 'success') {
                throw new Error(shannonData.message || 'Error fetching diversity index.');
            }
            const shannon_in = shannonData.shannon_in;
            const compliance_score = shannonData.compliance_score;
            const bike_lanes = shannonData.bike_lanes;
            const bikeability_index = shannonData.bikeability_index;

            // 5. Store diversity indices in localStorage
            localStorage.setItem('shannon_in', shannon_in !== null ? shannon_in.toString() : 'N/A');
            localStorage.setItem('compliance_score', compliance_score !== null ? compliance_score.toString() : 'N/A');
            localStorage.setItem('bike_lanes', bike_lanes !== null ? bike_lanes.toString() : 'N/A');
            localStorage.setItem('bikeability_index', bikeability_index !== null ? bikeability_index.toString() : 'N/A');

            console.log("Stored diversity indices in localStorage.");

            // 6. Hide loading indicator
            hideLoadingIndicator();

            // 7. Redirect to dashboard
            window.location.href = '/dashboard';
        });
    })
    .catch(error => {
        console.error('Error in onGenerateClick:', error);
        alert('Error: ' + error.message);
        hideLoadingIndicator(); // Ensure the loading indicator is hidden even on error
    });
}
