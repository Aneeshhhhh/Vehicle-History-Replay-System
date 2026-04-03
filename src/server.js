const express = require("express");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");
const mqtt = require("mqtt");

const PORT = process.env.PORT || 5000;
const DATA_FILE = path.join(__dirname, "../data/processed/data.json");
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://broker.hivemq.com";
const MQTT_TOPIC = process.env.MQTT_TOPIC || "vehicle/replay/demo";
const geoFence = {
  centerLatitude: 28.275,
  centerLongitude: 76.845,
  radius: 200,
};
const vehicleState = new Map();
let geofencePassCount = 0;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "../public")));

let packets = [];
try {
  packets = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
} catch (error) {
  console.error("Unable to read data.json. Run: node src/utils/preprocess.js");
  process.exit(1);
}

const mqttClient = mqtt.connect(MQTT_BROKER_URL);

let timer = null;
let cursor = 0;
let intervalMs = 400;

const stopStream = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
};

const publishNextPacket = () => {
  if (cursor >= packets.length) {
    stopStream();
    io.emit("stream:end");
    return;
  }

  const packet = packets[cursor];
  mqttClient.publish(MQTT_TOPIC, JSON.stringify(packet));
  cursor += 1;
};

const startStream = () => {
  if (timer) {
    return;
  }
  timer = setInterval(publishNextPacket, intervalMs);
};

function radians(value) {
  return (value * Math.PI) / 180;
}

function distMtrs(lat1, lng1, lat2, lng2) {
  const earthRadiusMtrs = 6371000;
  const dLat = radians(lat2 - lat1);
  const dLng = radians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(lat1)) *
      Math.cos(radians(lat2)) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusMtrs * c;
}

mqttClient.on("connect", () => {
  console.log(`MQTT connected: ${MQTT_BROKER_URL}`);
  mqttClient.subscribe(MQTT_TOPIC, (error) => {
    if (error) {
      console.error("Failed to subscribe MQTT topic:", error.message);
      return;
    }
    console.log(`MQTT subscribed: ${MQTT_TOPIC}`);
  });
});

mqttClient.on("message", (topic, message) => {
  if (topic !== MQTT_TOPIC) {
    return;
  }

  try {
    const packet = JSON.parse(message.toString());
    const vehicleId = packet.vehicleId || packet.vehicle_id;
    const lat = Number(packet.lat);
    const lng = Number(packet.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      io.emit("location", packet);
      return;
    }

    const distance = distMtrs(
      lat,
      lng,
      geoFence.centerLatitude,
      geoFence.centerLongitude
    );
    const isInside = distance <= geoFence.radius;
    const previousState = vehicleState.get(vehicleId);

    if (previousState === undefined) {
      vehicleState.set(vehicleId, isInside);
      io.emit("location", packet);
      return;
    }

    if (previousState !== isInside) {
      let eventType;
      if (isInside) {
        eventType = "ENTER";
      } else {
        eventType = "EXIT";
      }

      geofencePassCount += 1;

      io.emit("geofence:event", {
        vehicleId,
        eventType,
        passCount: geofencePassCount,
      });
    }

    vehicleState.set(vehicleId, isInside);

    io.emit("location", packet);
  } catch (error) {
    console.error("Invalid MQTT payload received:", error.message);
  }
});

mqttClient.on("error", (error) => {
  console.error("MQTT error:", error.message);
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.emit("stream:meta", {
    totalPackets: packets.length,
    defaultIntervalMs: intervalMs,
    mqttBroker: MQTT_BROKER_URL,
    mqttTopic: MQTT_TOPIC,

    geofence: {
      centerLat: geoFence.centerLatitude,
      centerLng: geoFence.centerLongitude,
      radiusMeters: geoFence.radius,
    },
    geofencePassCount,
  });

  socket.on("stream:play", startStream);

  socket.on("stream:pause", () => {
    stopStream();
  });

  socket.on("stream:speed", (nextIntervalMs) => {
    const parsed = Number(nextIntervalMs);
    if (!Number.isFinite(parsed) || parsed < 50) {
      return;
    }
    intervalMs = parsed;
    if (timer) {
      stopStream();
      startStream();
    }
  });

  socket.on("stream:reset", () => {
    stopStream();
    cursor = 0;
    vehicleState.clear();
    geofencePassCount = 0;
    io.emit("stream:reset");
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
