# Vehicle History Replay System

## Overview

This project simulates real-time vehicle movement using pre-recorded GPS data. Data is streamed packet-by-packet to mimic live tracking.

## Tech Stack

* Node.js (Backend)
* Socket.io (Real-time communication)
* MQTT (Message broker simulation)
* React + Leaflet (Frontend map)

## Features

* Real-time map replay
* Play / Pause functionality
* Adjustable replay speed
* Direction (heading) visualization
* Polyline path tracing

## Architecture

Data → Backend → MQTT → Backend → Socket.io → Frontend

## How to Run

### Backend

```bash
cd backend
npm install
node server.js
```

### Frontend

```bash
cd frontend
npm install
npm start
```

## Notes

* MQTT is used to simulate real-world IoT architecture.
* Data is streamed incrementally using setInterval to mimic live movement.
