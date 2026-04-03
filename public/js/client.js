const socket = io();

const map = L.map("map").setView([20.5937, 78.9629], 5);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

const metaEl = document.getElementById("meta");
const trackerSpeedEl = document.getElementById("trackerSpeed");
const computedSpeedEl = document.getElementById("computedSpeed");
const geofenceStatusEl = document.getElementById("geofenceStatus");
const playBtn = document.getElementById("playBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const speedSelect = document.getElementById("speedSelect");

let marker = null;
let trace = null;
let geofenceCircle = null;
let points = [];
let totalPackets = 0;
let seenPackets = 0;
let geofencePassCount = 0;

function renderMeta() {
  metaEl.textContent = `Packets: ${seenPackets}/${totalPackets || "?"}`;
}

function speedLevelClass(speedKmh) {
  if (speedKmh < 20) return "speed-low";
  if (speedKmh < 50) return "speed-medium";
  return "speed-high";
}

function renderSpeed(packet) {
  const trackerSpeed = Number(packet.speed) || 0;
  const computedSpeed = Number(packet.computedSpeedKmh) || 0;

  trackerSpeedEl.classList.remove("speed-low", "speed-medium", "speed-high");
  computedSpeedEl.classList.remove("speed-low", "speed-medium", "speed-high");
  trackerSpeedEl.classList.add(speedLevelClass(trackerSpeed));
  computedSpeedEl.classList.add(speedLevelClass(computedSpeed));

  trackerSpeedEl.textContent = `${trackerSpeed.toFixed(2)} km/h`;
  computedSpeedEl.textContent = `${computedSpeed.toFixed(2)} km/h`;
}

function renderGeofenceStatus(eventType, vehicleId) {
  geofenceStatusEl.textContent = `${eventType} - ${vehicleId} | passes: ${geofencePassCount}`;
  geofenceStatusEl.classList.remove("geo-enter", "geo-exit");
  geofenceStatusEl.classList.add(eventType === "ENTER" ? "geo-enter" : "geo-exit");
}

socket.on("stream:meta", (meta) => {
  totalPackets = meta.totalPackets || 0;
  geofencePassCount = meta.geofencePassCount || 0;
  if (meta.geofence) {
    if (geofenceCircle) {
      map.removeLayer(geofenceCircle);
    }

    geofenceCircle = L.circle([meta.geofence.centerLat, meta.geofence.centerLng], {
      radius: meta.geofence.radiusMeters,
      color: "#8a4f00",
      weight: 2,
      fillColor: "#f2b66d",
      fillOpacity: 0.2,
      dashArray: "6 6",
    }).addTo(map);
  }
  renderMeta();
});

socket.on("geofence:event", (event) => {
  geofencePassCount = event.passCount || geofencePassCount;
  renderGeofenceStatus(event.eventType, event.vehicleId);
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
    marker.bindPopup("");
    map.setView(latlng, 16);
  } else {
    marker.setLatLng(latlng);
  }

  marker.setPopupContent(
    `Speed: ${(Number(packet.speed) || 0).toFixed(2)} km/h<br/>Heading: ${(Number(packet.heading) || 0).toFixed(1)} deg`
  );

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
  trackerSpeedEl.classList.remove("speed-low", "speed-medium", "speed-high");
  computedSpeedEl.classList.remove("speed-low", "speed-medium", "speed-high");
  trackerSpeedEl.textContent = "0 km/h";
  computedSpeedEl.textContent = "0 km/h";
  geofencePassCount = 0;
  geofenceStatusEl.classList.remove("geo-enter", "geo-exit");
  geofenceStatusEl.textContent = "No transition yet | passes: 0";
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
