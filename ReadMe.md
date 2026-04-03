# Vehicle History Replay System

## Overview

This project replays pre-recorded GPS data as a live vehicle stream. The backend publishes packets one at a time, and the browser renders the track, speed, and geofence transitions in real time.

## Tech Stack

* Node.js and Express for the backend server
* Socket.IO for live browser updates
* MQTT for packet replay transport
* Leaflet for the map view

## Features

* Real-time map replay
* Play / Pause functionality
* Adjustable replay speed
* Direction (heading) visualization
* Polyline path tracing
* Circle geofence ENTER/EXIT tracking

## Architecture

Raw data → `src/utils/preprocess.js` → `data/processed/data.json` → `src/server.js` → MQTT → Socket.IO → browser

## How to Run

### 1. Prepare the replay data

```bash
npm run preprocess
```

### 2. Start the app

```bash
npm start
```

If port `5000` is already in use, set a different one:

```bash
PORT=5001 npm start
```

## Project Layout

* `src/server.js` - main server, MQTT replay, and geofence logic
* `src/utils/preprocess.js` - converts raw tracker data into replay packets
* `public/index.html` - UI shell
* `public/css/styles.css` - layout and status styles
* `public/js/client.js` - map rendering and socket handlers
* `data/raw/` - source input files
* `data/processed/` - generated replay output

## Notes

* `npm start` expects `data/processed/data.json` to exist.
* The geofence in `src/server.js` is currently hardcoded for the MVP.
