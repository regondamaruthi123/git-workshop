# HyperDetect AI

**HyperDetect AI** is a precision-driven anomaly detection platform for hyperspectral imaging and environmental monitoring. The system incorporates a React dashboard, a Node.js + Express API server, and a Python Flask AI classification engine.

---

## 🧩 System Architecture

The platform runs as a multi-service stack:
1. **Frontend**: React + Vite SPA with Leaflet spatial maps, Chart.js analytics, and Glassmorphism neon-dark styling.
2. **Backend**: Express.js server on port 5000 managing file storage, JWT credentials, MongoDB data storage (with SQLite automatic fallback), and Socket.io WebSocket triggers.
3. **AI Service**: Flask microservice on port 5001 running CNN reconstruction error models or high-precision Ensemble (RX + PCA) spectral target detection.

```
hyperdetect-ai/
├── ai-service/          # Python Flask AI engine (Port 5001)
│   ├── app.py           # Core detection model & heatmap generator
│   └── requirements.txt # Python package dependencies
├── backend/             # Express.js REST API Server (Port 5000)
│   ├── db.js            # DB client supporting MongoDB & SQLite file fallback
│   ├── server.js        # Server socket/HTTP orchestration
│   ├── routes.js        # Account & upload endpoint controllers
│   ├── middleware.js    # JWT authorization validator
│   └── .env             # Server configurations
└── frontend/            # React Client SPA (Port 5173)
    ├── index.html       # Vite HTML template (w/ Leaflet CSS)
    ├── package.json     # Frontend dependencies
    └── src/             # React dashboard components
```

---

## ⚡ Quick Start: How to Run Locally

### 1. Run the Python AI Service (`ai-service/`)
Navigate to `ai-service/`, configure a virtual environment, install dependencies, and run:
```bash
cd ai-service
python -m venv venv
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
python app.py
```
*The AI service will run at `http://localhost:5001`.*

### 2. Run the Node.js Server (`backend/`)
Navigate to `backend/`, install NPM modules, and start the API engine:
```bash
cd backend
npm install
npm run start
```
*The server will run on `http://localhost:5000`. By default, if local MongoDB is not running, it automatically mounts a local SQLite file (`hyperdetect.sqlite`) so you can run it immediately without setting up external databases.*

### 3. Run the React Client Dashboard (`frontend/`)
Navigate to `frontend/`, install NPM modules, and spin up the Vite development server:
```bash
cd frontend
npm install
npm run dev
```
*Open `http://localhost:5173` in your browser.*

---

## 🧪 Default Test Accounts

Use the quick-select sandbox buttons on the login screen or enter the credentials manually:

| Email | Password | Role | Description |
| :--- | :--- | :--- | :--- |
| `admin@hyperdetect.ai` | `admin123` | **Admin** | Full access to operator telemetry controls, server stats, and global audit logs. |
| `user@hyperdetect.ai` | `user123` | **User** | Access to run uploads, GPS capturing, and inspect personal scan history. |

---

## 🧠 AI Processing Pipeline details

1. **Pre-processing**: Decodes JPEG/PNG/TIFF bands, normalizes pixels to `[0.0, 1.0]`.
2. **Model Processing**: 
   - Uses PyTorch **CNN Autoencoder** if available to reconstruct spatial components and map anomalies.
   - Falls back to **Ensemble Reed-Xiaoli (RX) Spectral Detector + PCA Reconstruction** if PyTorch is absent, guaranteeing execution.
3. **Color Mapping**: Normalizes reconstruction error, filters using OTSU thresholding, and overlays a Jet colormap on target anomalies to generate detailed visual heatmaps.
