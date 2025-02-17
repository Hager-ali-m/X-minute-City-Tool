// Initialize the map centered on Münster
// Initialize the map
var map = L.map('map', {
    center: [51.9610, 7.6100], // Münster city center coordinates
    zoom: 13,
  });
  

// Add the OpenStreetMap tiles
var OpenStreetMap_HOT = L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
	maxZoom: 18,
	attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by <a href="https://www.hotosm.org/" target="_blank">Humanitarian OpenStreetMap Team</a> hosted by <a href="https://openstreetmap.fr/" target="_blank">OpenStreetMap France</a>',
}).addTo(map);;

var Stadia_AlidadeSatellite = L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_satellite/{z}/{x}/{y}{r}.{ext}', {
	minZoom: 0,
	maxZoom: 20,
	attribution: '&copy; CNES, Distribution Airbus DS, © Airbus DS, © PlanetObserver (Contains Copernicus Data) | &copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
	ext: 'jpg'
});

var Esri_WorldGrayCanvas = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
	attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
	maxZoom: 16
});

   // Add OpenStreetMap tile layer
var OpenStreetMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
});

// Base layers object
var baseMaps = {
    "Street Map": OpenStreetMap_HOT,
    "Open Street Map": OpenStreetMap,
    "Satellite": Stadia_AlidadeSatellite,
    "Esri World Gray Canvas" : Esri_WorldGrayCanvas
}

// // Add layer control to the map
// L.control.layers(baseMaps).addTo(map);

L.control.zoom({
    position: 'bottomright'
}).addTo(map);


// Adding OSM layer for groceries
// Function to load OSM data and add to a given layer group
function loadOSMData(query, layerGroup, iconUrl) {
    var endpoint = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    fetch(endpoint)
        .then(response => response.json())
        .then(data => {
            console.log('Data loaded successfully:', data);
            data.elements.forEach(function (element) {
                if (element.type === 'node') {
                    L.marker([element.lat, element.lon], {
                        icon: L.icon({
                            iconUrl: iconUrl,
                            iconSize: [20],
                        })
                    }).addTo(layerGroup);
                }
            });
        })
        .catch(error => console.error('Error loading OSM data:', error));
}

L.control.layers(baseMaps).addTo(map);


////////////////////////////////////////////////////////////////////////////////
// A function to set a location on the map
////////////////////////////////////////////////////////////////////////////////
const customIcon = L.icon({
    iconUrl: '/static/images/pin.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
  
  let marker = null;
  
  function onMapClick(e) {
      if (marker) {
          map.removeLayer(marker);
      }
      marker = L.marker(e.latlng, { icon: customIcon }).addTo(map);
  
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;

    // 1. Perform reverse geocoding with Nominatim
    fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`)
      .then(response => response.json())
      .then(data => {
        // 2. Extract address from the response
        // Nominatim's 'display_name' is a nicely formatted address
        const address = data.display_name || 'Unknown address';
  
        // 3. Bind a popup with the address and lat/lng
        marker.bindPopup(`
          <strong>Address:</strong><br>${address}<br>
          <strong>Latitude:</strong> ${lat}<br>
          <strong>Longitude:</strong> ${lng}
        `).openPopup();
  
        // 4. Optionally, handle any further logic, e.g., storing address in localStorage
        // localStorage.setItem('selectedAddress', address);
      })
      .catch(err => {
        console.error('Error during reverse geocoding:', err);
        // Fallback: just show lat/lng
        marker.bindPopup(`
          Latitude: ${lat}<br>
          Longitude: ${lng}
        `).openPopup();
      });

      // Send coordinates to the Flask backend to get the grid_id
      fetch('/process-location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lng }),
      })
      .then(response => response.json())
      .then(data => {
        console.log('Response from server:', data);
        if (data.status === 'success') {
            localStorage.setItem('from_id', data.grid_id);
            localStorage.setItem('shannon_in', data.shannon_in);
            localStorage.setItem(
                'selectedLocation',
                JSON.stringify({ lat, lng })
            );
        } else {
            // If for some reason the server returns status error on a 200 OK
            alert(data.message || 'This is not a residential area.');
        }
    })
    .catch(error => {
        // For 400 or any fetch-related error
        console.error('Error:', error);
        alert(error.message || 'No overlapping grid found.');
    });
  }
  
  map.on('click', onMapClick);  

////////////////////////////////////////////////////////////////////////////////////

// Get references to the elements
var toolIcon = document.getElementById('icon-map');
var leftPane = document.getElementById('left-pane');

// Add click event listener to the menu bar
toolIcon.addEventListener('click', function() {
    leftPane.classList.toggle('hidden');
});

document.addEventListener('DOMContentLoaded', function() {
    const nextButton = document.getElementById('start-button');
    
    if (nextButton) {
      nextButton.addEventListener('click', function() {
        // Check if localStorage contains the selectedLocation
        const selectedLocation = localStorage.getItem('selectedLocation');
        if (!selectedLocation) {
          alert('Please Drop a point on the Map');
        } else {
          // If the user has selected a point, go to /amenities
          window.location.href = '/amenities';
        }
      });
    }
  });
  

