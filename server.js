const express = require('express');
const mqtt = require('mqtt');

const app = express();
const PORT = process.env.PORT || 3000;

const TOPICS = [
  "telemetry/saumy_dc10120/gnss",
  "telemetry/saumy_dc10120/lora_relay"
];

// In-memory latest state per node
const nodes = {};

const client = mqtt.connect("023a1d739888475e9b02e89c89f18aa6.s1.eu.hivemq.cloud:8883", {
  username: "somu_gnss",
  password: "somu_gnss1234"
});

client.on('connect', () => {
  console.log('Connected to MQTT broker');
  TOPICS.forEach(t => client.subscribe(t));
});

client.on('message', (topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    const nodeId = data.node || topic;
    nodes[nodeId] = { ...data, receivedAt: Date.now() };
  } catch (e) {
    console.error('Bad payload', e);
  }
});

app.get('/api/nodes', (req, res) => {
  res.json(nodes);
});

app.get('/', (req, res) => {
  res.send(DASHBOARD_HTML);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

const DASHBOARD_HTML = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>GNSS Multi-Node Dashboard</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  body { margin: 0; font-family: sans-serif; display: flex; height: 100vh; }
  #map { flex: 2; }
  #log { flex: 1; overflow-y: auto; padding: 10px; background: #111; color: #0f0; font-family: monospace; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; }
  td, th { border-bottom: 1px solid #333; padding: 4px; text-align: left; }
</style>
</head>
<body>
<div id="map"></div>
<div id="log">
  <h3 style="color:#fff;">Live Nodes</h3>
  <table>
    <thead><tr><th>Node</th><th>Time</th><th>Lat</th><th>Lon</th><th>Alt</th></tr></thead>
    <tbody id="logBody"></tbody>
  </table>
</div>
<script>
const map = L.map('map').setView([23.0225, 72.5714], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const markers = {};
const colors = { gsm: 'blue', lora: 'red' };

async function poll() {
  try {
    const res = await fetch('/api/nodes');
    const nodes = await res.json();
    const logBody = document.getElementById('logBody');
    logBody.innerHTML = '';

    for (const [id, data] of Object.entries(nodes)) {
      if (!data.fix) continue;
      const lat = data.lat, lon = data.lon, alt = data.alt_gnss_m;

      if (!markers[id]) {
        markers[id] = L.circleMarker([lat, lon], {
          radius: 8, color: colors[id] || 'green'
        }).addTo(map).bindTooltip(id, { permanent: true });
      } else {
        markers[id].setLatLng([lat, lon]);
      }

      const time = new Date(data.receivedAt).toLocaleTimeString();
      const row = document.createElement('tr');
      row.innerHTML = \`<td>\${id}</td><td>\${time}</td><td>\${lat.toFixed(6)}</td><td>\${lon.toFixed(6)}</td><td>\${alt ? alt.toFixed(1) : '-'}</td>\`;
      logBody.appendChild(row);
    }
  } catch (e) {
    console.error(e);
  }
}

setInterval(poll, 1000);
poll();
</script>
</body>
</html>
`;
