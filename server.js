
const express = require('express');
const mqtt = require('mqtt');

const app = express();
const PORT = process.env.PORT || 3000;

const TOPICS = [
  "telemetry/saumy_dc10120/gnss",
  "telemetry/saumy_dc10120/lora_relay"
];

const nodes = {};

const client = mqtt.connect("mqtt://broker.hivemq.com:1883");

client.on('connect', () => {
  console.log("Connected to MQTT broker");

  TOPICS.forEach(topic => {
    client.subscribe(topic, err => {
      if (err)
        console.error("Subscribe failed:", topic);
      else
        console.log("Subscribed:", topic);
    });
  });
});

client.on('error', err => {
  console.error("MQTT Error:", err.message);
});

client.on('message', (topic, message) => {
  console.log("--------------------------------");
  console.log("Topic:", topic);
  console.log("Payload:", message.toString());

  try {
    const data = JSON.parse(message.toString());

    const nodeId = data.node || topic;

    nodes[nodeId] = {
      ...data,
      receivedAt: Date.now()
    };

    console.log("Stored node:", nodeId);

  } catch (err) {
    console.error("Invalid JSON:", err);
  }
});

app.get('/api/nodes', (req, res) => {
  res.json(nodes);
});

app.get('/', (req, res) => {
  res.send(DASHBOARD_HTML);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const DASHBOARD_HTML = `
<!DOCTYPE html>
<html>
<head>

<meta charset="utf-8">
<title>GNSS Dashboard</title>

<link rel="stylesheet"
href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

<style>

body{
margin:0;
display:flex;
height:100vh;
font-family:sans-serif;
}

#map{
flex:2;
}

#log{
flex:1;
overflow-y:auto;
padding:10px;
background:#111;
color:white;
}

table{
width:100%;
border-collapse:collapse;
}

th,td{
border-bottom:1px solid #333;
padding:6px;
text-align:left;
font-size:13px;
}

</style>

</head>

<body>

<div id="map"></div>

<div id="log">

<h2>Live Nodes</h2>

<table>

<thead>

<tr>
<th>Node</th>
<th>Fix</th>
<th>Time</th>
<th>Latitude</th>
<th>Longitude</th>
<th>Altitude</th>
</tr>

</thead>

<tbody id="logBody"></tbody>

</table>

</div>

<script>

const map = L.map("map").setView([23.0225,72.5714],13);

L.tileLayer(
"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
{
attribution:"© OpenStreetMap contributors"
}).addTo(map);

const markers={};

const colors={
gsm:"blue",
lora:"red"
};

async function poll(){

const res=await fetch("/api/nodes");
const nodes=await res.json();

const body=document.getElementById("logBody");
body.innerHTML="";

for(const [id,data] of Object.entries(nodes)){

const tr=document.createElement("tr");

const time=new Date(data.receivedAt).toLocaleTimeString();

tr.innerHTML=\`
<td>\${id}</td>
<td>\${data.fix ? "✅" : "❌"}</td>
<td>\${time}</td>
<td>\${data.fix && data.lat!=null ? Number(data.lat).toFixed(6) : "-"}</td>
<td>\${data.fix && data.lon!=null ? Number(data.lon).toFixed(6) : "-"}</td>
<td>\${data.fix && data.alt_gnss_m!=null ? Number(data.alt_gnss_m).toFixed(1) : "-"}</td>
\`;

body.appendChild(tr);

if(data.fix){

const lat=Number(data.lat);
const lon=Number(data.lon);

if(!markers[id]){

markers[id]=L.circleMarker(
[lat,lon],
{
radius:8,
color:colors[id]||"green"
})
.addTo(map)
.bindTooltip(id,{permanent:true});

}
else{

markers[id].setLatLng([lat,lon]);

}

}

}

}

setInterval(poll,1000);

poll();

</script>

</body>

</html>
`;
