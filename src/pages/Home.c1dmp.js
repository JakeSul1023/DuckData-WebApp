// API Reference: https://www.wix.com/velo/reference/api-overview/introduction
// “Hello, World!” Example: https://learn-code.wix.com/en/article/hello-world

//$w.onReady(function () {
    //Jake sucks
//});



// Jake might not suck so much if this ends up working
//Make sure tania didnt mess this up (test)

//initializing the map and setting its view
const map = L.map('map').setView([51.505, -0.09], 13); // Latitude, Longitude, Zoom level

// Add a tile layer (OpenStreetMap in this case)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19, // Maximum zoom level
  attribution: '© OpenStreetMap contributors',
}).addTo(map);

// Add a marker with a popup
const marker = L.marker([51.505, -0.09]).addTo(map);
marker.bindPopup('Hello, Leaflet!').openPopup();