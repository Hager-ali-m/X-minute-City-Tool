// dashboard.js

// --------------- Leaflet Map Initialization ---------------

// 1) Initialize the map
var map = L.map('map', {
    center: [51.9410, 7.6100], // Münster city center
    zoom: 13,
});

// 2) Add a tile layer
var OpenStreetMap_HOT = L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by <a href="https://www.hotosm.org/" target="_blank">Humanitarian OpenStreetMap Team</a> hosted by <a href="https://openstreetmap.fr/" target="_blank">OpenStreetMap France</a>',
}).addTo(map);

// Create an array to store your markers
const allMarkers = [];

// Retrieve user's chosen location (if any) and place a marker
const selectedLocation = JSON.parse(localStorage.getItem('selectedLocation'));

if (selectedLocation) {
    const { lat, lng } = selectedLocation;
    const customIcon = L.icon({
        iconUrl: '/static/images/pin.png',
        iconSize: [50, 50],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
    });

    // Create the marker
    const userMarker = L.marker([lat, lng], { icon: customIcon })
        .addTo(map)
        .bindPopup('<strong>Your Location</strong>')
        .openPopup();

    // Store it in the array
    allMarkers.push(userMarker);
} else {
    console.log("No location selected.");
}

// Retrieve final filtered destinations from localStorage
const filteredDestinations = JSON.parse(localStorage.getItem('filteredDestinations')) || [];
console.log('Filtered Destinations in Dashboard:', filteredDestinations);

// Add each destination as a marker
filteredDestinations.forEach(dest => {
    const lat = dest.lat;
    const lon = dest.lon;
    const type = dest.type.toLowerCase();
    const name = dest.name;
    const fclass = dest.fclass || 'Unknown'; // Ensure fclass exists

    // Use an icon based on type, or fallback to pin.png
    const iconUrl = `/static/images/${type}.png` || '/static/images/pin.png';
    const icon = L.icon({
        iconUrl: iconUrl,
        iconSize: [25, 25],
        iconAnchor: [12, 25],
        popupAnchor: [0, -25],
    });

    // Create the marker
    const destMarker = L.marker([lat, lon], { icon: icon })
        .bindPopup(`<strong>Name:</strong> ${name || 'Unknown'}<br>
                    <strong>Sub-Category:</strong> ${fclass || 'Unknown'}<br>
                    <strong>Travel Time:</strong> ${dest.travel_time} min`)
        .addTo(map);

    // Push to allMarkers array
    allMarkers.push(destMarker);
});

// After adding all markers, adjust the view if we have at least one
if (allMarkers.length > 0) {
    // Create a Leaflet FeatureGroup from all markers
    const group = L.featureGroup(allMarkers);
    map.fitBounds(group.getBounds().pad(0.5)); // Add padding for better view
}

// --------------- Diversity Index Display ---------------

// Function to display Amenities Diversity Index
function displayDiversityIndex() {
    // Retrieve metrics from localStorage
    const shannon_in = localStorage.getItem('shannon_in');
    const compliance_score = localStorage.getItem('compliance_score'); // Updated ID
    const bike_lanes = localStorage.getItem('bike_lanes'); // Updated ID
    const bikeability_index = localStorage.getItem('bikeability_index'); // Updated ID

    // Display the metrics in the respective HTML elements
    const diversityIndexElement = document.getElementById('diversity-index-value');
    const complianceScoreElement = document.getElementById('compliance-score'); // Updated ID
    const bikeLanesElement = document.getElementById('bike-lanes'); // Updated ID
    const bikeabilityIndexElement = document.getElementById('bikeability-index'); // Updated ID

    if (diversityIndexElement) {
        diversityIndexElement.textContent = shannon_in ? shannon_in : 'N/A';
    } else {
        console.error("Element with ID 'diversity-index-value' not found.");
    }

    if (complianceScoreElement) {
        complianceScoreElement.textContent = compliance_score ? compliance_score : 'N/A';
    } else {
        console.error("Element with ID 'compliance-score' not found.");
    }

    if (bikeLanesElement) {
        bikeLanesElement.textContent = bike_lanes ? bike_lanes : 'N/A';
    } else {
        console.error("Element with ID 'bike-lanes' not found.");
    }

    if (bikeabilityIndexElement) {
        bikeabilityIndexElement.textContent = bikeability_index ? bikeability_index : 'N/A';
    } else {
        console.error("Element with ID 'bikeability-index' not found.");
    }
}

// Ensure displayDiversityIndex is called once the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    displayDiversityIndex();
});

// --------------- Radar Chart Initialization ---------------

// Function to fetch travel data based on rider speed
async function fetchTravelData(riderSpeed) {
    try {
        const response = await fetch('/filter-travel-time', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ riderSpeed })
        });

        const data = await response.json();

        if (data.status === 'success') {
            return data.travel_data; // List of { to_id, travel_time }
        } else {
            console.error('Error fetching travel data:', data.message);
            return [];
        }
    } catch (error) {
        console.error('Fetch error:', error);
        return [];
    }
}

// Function to fetch destinations with travel time
async function fetchDestinations(travelData, selectedTypes) {
    try {
        const response = await fetch('/fetch-destinations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                travel_data: travelData, // List of { to_id, travel_time }
                selected_types: selectedTypes // e.g., ["Food Services"]
            })
        });

        const data = await response.json();

        if (data.status === 'success') {
            // Store in localStorage
            localStorage.setItem('filteredDestinations', JSON.stringify(data.destinations));
            return data.destinations;
        } else {
            console.error('Error fetching destinations:', data.message);
            return [];
        }
    } catch (error) {
        console.error('Fetch error:', error);
        return [];
    }
}

// Function to compute average travel time per fclass
function computeAverageTravelTime(destinations) {
    const fclassMap = {};
    const countMap = {};

    destinations.forEach(dest => {
        const fclass = dest.fclass || 'Unknown';
        const travelTime = parseFloat(dest.travel_time);

        if (!isNaN(travelTime)) {
            if (fclassMap[fclass]) {
                fclassMap[fclass] += travelTime;
                countMap[fclass] += 1;
            } else {
                fclassMap[fclass] = travelTime;
                countMap[fclass] = 1;
            }
        }
    });

    const averageTravelTime = {};
    for (const fclass in fclassMap) {
        averageTravelTime[fclass] = (fclassMap[fclass] / countMap[fclass]).toFixed(2);
    }

    return averageTravelTime;
}

// Function to render radar chart
function renderRadarChart(labels, data) {
    const ctx = document.getElementById('radarChart').getContext('2d');

    // Destroy existing chart instance if it exists to avoid duplication
    if (window.radarChartInstance) {
        window.radarChartInstance.destroy();
    }

    window.radarChartInstance = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Average Travel Time (mins)',
                data: data,
                fill: true,
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                borderColor: 'rgba(54, 162, 235, 1)',
                pointBackgroundColor: 'rgba(54, 162, 235, 1)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: 'rgba(54, 162, 235, 1)',
                pointHoverBorderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            layout: {
                padding: 5
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                },
                title: {
                    display: true,
                    text: 'Average Travel Time per Amenity Type'
                },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed.r || 0;
                            return label === 'No Data' ? 'No data available' : `${label}: ${value} min`;
                        }
                    }
                }
            },
            scales: {
                r: {
                    beginAtZero: true,
                    suggestedMax: data.length > 0 ? Math.max(...data) + 5 : 10,
                    angleLines: {
                        display: true
                    },
                    ticks: {
                        backdropPadding: 0,
                        font: {
                            size: 10 
                        },
                        stepSize: 5
                    },
                    pointLabels: {
                        font: {
                            size: 10 
                        }
                    }
                }
            }
        }
    });
}

// Main function to initialize the dashboard
async function initializeDashboard() {
    // Retrieve user selections
    const selectedAmenityType = localStorage.getItem('selectedAmenityType'); // e.g., "Food Services"
    const selectedRiderSpeed = localStorage.getItem('riderSpeed'); // e.g., "slow"

    console.log("Retrieved 'selectedAmenityType':", selectedAmenityType);
    console.log("Retrieved 'riderSpeed':", selectedRiderSpeed);

    if (!selectedAmenityType || !selectedRiderSpeed) {
        console.error('Amenity Type or Rider Speed not selected.');
        alert('Amenity Type or Rider Speed not selected.');
        return;
    }

    // Retrieve filtered destinations from localStorage
    const destinations = JSON.parse(localStorage.getItem('filteredDestinations')) || [];

    console.log("Retrieved 'filteredDestinations':", destinations);

    if (destinations.length === 0) {
        console.warn('No destinations found for the selected criteria.');
    }

    // Compute average travel time per fclass
    const averageTravelTime = computeAverageTravelTime(destinations);

    console.log("Computed Average Travel Time:", averageTravelTime);

    // Prepare data for radar chart
    let radarLabels = Object.keys(averageTravelTime);
    let radarDataValues = Object.values(averageTravelTime).map(time => parseFloat(time));

    // Handle no data scenario
    if (radarLabels.length === 0) {
        radarLabels = ['No Data'];
        radarDataValues = [0];
    }

    // Render radar chart
    renderRadarChart(radarLabels, radarDataValues);

    renderHorizontalBarChart(destinations);
}

// Call initializeDashboard when the dashboard page loads
document.addEventListener('DOMContentLoaded', () => {
    initializeDashboard();
});

// --------------- Additional Charts Initialization ---------------

// Horizontal Bar Chart
// dashboard.js

// --------------- Horizontal Bar Chart Initialization ---------------

/**
 * Renders a horizontal bar chart displaying the number of amenities within specified travel time intervals.
 * 
 * @param {Array} destinations - Array of destination objects with a 'travel_time' property.
 */
function renderHorizontalBarChart(destinations) {
    // Define the time intervals in minutes
    const timeIntervals = [
        { label: '0-5min', min: 0, max: 5 },
        { label: '>5-10min', min: 5, max: 10 },
        { label: '>10-15min', min: 10, max: 15 }
    ];

    // Initialize counts for each interval
    const counts = {
        '0-5min': 0,
        '>5-10min': 0,
        '>10-15min': 0
    };

    // Iterate through each destination to count amenities within each time interval
    destinations.forEach(dest => {
        const travelTime = parseFloat(dest.travel_time);

        // Ensure travelTime is a valid number
        if (!isNaN(travelTime)) {
            if (travelTime <= 5) {
                counts['0-5min'] += 1;
            } else if (travelTime > 5 && travelTime <= 10) {
                counts['>5-10min'] += 1;
            } else if (travelTime > 10 && travelTime <= 15) {
                counts['>10-15min'] += 1;
            }
            // Amenities with travelTime >15min are not counted
        }
    });

    // Prepare the data for the chart
    const labels = timeIntervals.map(interval => interval.label); // ['5min', '10min', '15min']
    const data = timeIntervals.map(interval => counts[interval.label]); // [count_5min, count_10min, count_15min]

    // Define colors for each bar corresponding to the time intervals
    const backgroundColors = [
        'rgba(135, 111, 180, 0.7)', // 5min
        'rgba(135, 164, 219, 0.7)', // 10min
        'rgba(133, 189, 167, 0.7)'  // 15min
    ];

    const borderColors = [
        'rgba(135, 111, 180, 1)', // 5min
        'rgba(135, 164, 219, 1)', // 10min
        'rgba(133, 189, 167, 1)'  // 15min
    ];

    // Get the context of the canvas element where the chart will be rendered
    const ctx_hrz = document.getElementById('horizontalChart').getContext('2d');

    // Check if the chart instance already exists to prevent duplication
    if (window.horizontalChartInstance) {
        window.horizontalChartInstance.destroy();
    }

    // Create the horizontal bar chart using Chart.js
    window.horizontalChartInstance = new Chart(ctx_hrz, {
        type: 'bar',
        data: {
            labels: labels, // ['5min', '10min', '15min']
            datasets: [{
                label: 'Number of Amenities',
                data: data, // [count_5min, count_10min, count_15min]
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 1,
                barThickness: 20, // Adjusts the thickness of the bars
                maxBarThickness: 20,
                minBarLength: 2 // Ensures visibility even for small counts
            }]
        },
        options: {
            indexAxis: 'y', // Makes the chart horizontal
            responsive: true,
            maintainAspectRatio: false, // Allows the chart to adjust based on container size
            plugins: {
                legend: {
                    display: false // Hides the legend since there's only one dataset
                },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        label: function(context) {
                            const label = context.dataset.label || '';
                            const value = context.parsed.x;
                            return `${label}: ${value}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Amenities'
                    },
                    ticks: {
                        precision: 0 // Ensures whole numbers on the x-axis
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Travel Time'
                    },
                    ticks: {
                        // Customize y-axis ticks if needed
                    }
                }
            }
        }
    });

    console.log('Horizontal Bar Chart rendered with labels:', labels, 'and data:', data);
}


// Bar Chart with Normal Distribution Curve
// Function to calculate normal distribution
function normalDistribution(x, mean, stdDev) {
    const exponent = -((x - mean) ** 2) / (2 * stdDev ** 2);
    return (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(exponent);
}

// Data setup
const labelsDist = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; // Bar labels
const mean = 5; // Mean of the distribution
const stdDev = 1.5; // Standard deviation

// Bar values
const barDataDist = [1, 3, 5, 7, 6, 4, 2, 1, 0.5, 0.2];

// Highlight a specific bar (e.g., label = 5)
const areaIndex = labelsDist.indexOf(5);

// Calculate normal distribution values for the curve
const normalDistData = labelsDist.map(label => normalDistribution(label, mean, stdDev) * 10); // Scale for visualization

// Chart.js configuration
const ctx_dist = document.getElementById('barWithNormalDist').getContext('2d');
new Chart(ctx_dist, {
    type: 'bar', // Base chart type
    data: {
        labels: labelsDist,
        datasets: [
            {
                type: 'bar', // Bars
                label: '15-min Index',
                data: barDataDist,
                backgroundColor: labelsDist.map((label, index) =>
                    index === areaIndex ? 'rgba(255, 200, 59, 0.7)' : 'rgba(135, 164, 219, 0.7)'
                ), // Highlight specific bar
                borderColor: labelsDist.map((label, index) =>
                    index === areaIndex ? 'rgba(255, 200, 59, 1)' : 'rgba(135, 164, 219, 1)'
                ),
                borderWidth: 1,
                barThickness: 20,
                maxBarThickness: 20,
                minBarLength: 2
            },
            {
                type: 'line', // Normal distribution curve
                label: 'Normal Distribution',
                data: normalDistData,

                fill: false, // No fill under the curve
                tension: 0.4, // Smooth the curve
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 0,
            }
        ]
    },
    options: {
        responsive: true,
        plugins: {
            legend: {
                position: 'top'
            },
            tooltip: {
                mode: 'index'
            }
        },
        scales: {
            x: {
                title: {
                    display: true,
                    text: '15-minute city compliance compared to Münster'
                }
            },
            y: {
                title: {
                    display: true,
                    text: 'Values'
                },
                beginAtZero: true
            }
        }
    }
});
