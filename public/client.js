const socket = io();

const map = L.map("map").setView([20.5937, 78.9629], 5);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

const metaEl = document.getElementById("meta");
const trackerSpeedEl = document.getElementById("trackerSpeed");
const computedSpeedEl = document.getElementById("computedSpeed");
const playBtn = document.getElementById("playBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const speedSelect = document.getElementById("speedSelect");

let marker = null;
let trace = null;
let points = [];
let totalPackets = 0;
let seenPackets = 0;

function renderMeta() {
  metaEl.textContent = `Packets: ${seenPackets}/${totalPackets || "?"}`;
}

function renderSpeed(packet) {
  const trackerSpeed = Number(packet.speed) || 0;
  const computedSpeed = Number(packet.computedSpeedKmh) || 0;
  trackerSpeedEl.textContent = `${trackerSpeed.toFixed(2)} km/h`;
  computedSpeedEl.textContent = `${computedSpeed.toFixed(2)} km/h`;
}

socket.on("stream:meta", (meta) => {
  totalPackets = meta.totalPackets || 0;
  renderMeta();
});

socket.on("location", (packet) => {
  const latlng = [packet.lat, packet.lng];
  points.push(latlng);
  seenPackets += 1;

  if (!marker) {
    marker = L.circleMarker(latlng, {
      radius: 8,
      color: "#0b84f3",
      fillColor: "#0b84f3",
      fillOpacity: 0.8,
    }).addTo(map);
    map.setView(latlng, 16);
  } else {
    marker.setLatLng(latlng);
  }

  if (!trace) {
    trace = L.polyline(points, {
      color: "#ff5e3a",
      weight: 4,
      opacity: 0.85,
    }).addTo(map);
  } else {
    trace.setLatLngs(points);
  }

  renderSpeed(packet);
  renderMeta();
});

socket.on("stream:end", () => {
  metaEl.textContent = "Replay complete. Click Reset to replay.";
});

socket.on("stream:reset", () => {
  points = [];
  seenPackets = 0;
  if (marker) {
    map.removeLayer(marker);
    marker = null;
  }
  if (trace) {
    map.removeLayer(trace);
    trace = null;
  }
  trackerSpeedEl.textContent = "0 km/h";
  computedSpeedEl.textContent = "0 km/h";
  renderMeta();
});

playBtn.addEventListener("click", () => {
  socket.emit("stream:play");
});

pauseBtn.addEventListener("click", () => {
  socket.emit("stream:pause");
});

resetBtn.addEventListener("click", () => {
  socket.emit("stream:reset");
});

speedSelect.addEventListener("change", (event) => {
  socket.emit("stream:speed", Number(event.target.value));
});
