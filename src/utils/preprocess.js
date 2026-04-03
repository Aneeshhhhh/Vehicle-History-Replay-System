const fs = require("fs");
const path = require("path");
const RAW_FILE = path.join(
  __dirname,
  "../../data/raw/location-1767022742000-655373818600132608-953665129122103296-undefined.json"
);
const OUTPUT_FILE = path.join(__dirname, "../../data/processed/data.json");

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function distanceMeters(lat1, lng1, lat2, lng2) {
  const earthRadiusMeters = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
}

function toPacket(row) {
  const coords = row?.loc?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) {
    return null;
  }

  const [lat, lng] = coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  const trackerSpeed = Number(row.sp ?? row.speed) || 0;

  return {
    vehicleId: row.vehicle_id || null,
    timestamp: Number(row.timestamp) || null,
    lat,
    lng,
    heading: Number(row.hd) || 0,
    speed: trackerSpeed,
  };
}

function main() {
  const raw = JSON.parse(fs.readFileSync(RAW_FILE, "utf8"));
  const packets = raw
    .map(toPacket)
    .filter(Boolean)
    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  const packetsWithComputedSpeed = packets.map((packet, index) => {
    if (index === 0) {
      return {
        ...packet,
        segmentDistanceMeters: 0,
        segmentDurationSeconds: 0,
        computedSpeedKmh: 0,
      };
    }

    const prev = packets[index - 1];
    const durationSeconds = Math.max(
      0,
      ((packet.timestamp || 0) - (prev.timestamp || 0)) / 1000
    );
    const segmentDistance = distanceMeters(
      prev.lat,
      prev.lng,
      packet.lat,
      packet.lng
    );

    const computedSpeedKmh =
      durationSeconds > 0 ? (segmentDistance / durationSeconds) * 3.6 : 0;

    return {
      ...packet,
      segmentDistanceMeters: Number(segmentDistance.toFixed(2)),
      segmentDurationSeconds: Number(durationSeconds.toFixed(2)),
      computedSpeedKmh: Number(computedSpeedKmh.toFixed(2)),
    };
  });

  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(packetsWithComputedSpeed, null, 2)
  );
  console.log(
    `Wrote ${packetsWithComputedSpeed.length} packets to ${OUTPUT_FILE}`
  );
}

main();
