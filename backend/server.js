require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const routes = require('./routes');

const app = express();
const server = http.createServer(app);

// Configure CORS to allow frontend connections
const corsOptions = {
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Parsing JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images statically
// Allow files like /uploads/upload-xxx.png and /uploads/heatmaps/heatmap-xxx.png
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Attach Socket.io server
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// Save socketio instance to application settings for access in routes
app.set('socketio', io);

// Mount API routes
app.use('/api', routes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(`[Error] Unhandled error: ${err.message}`);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

// PORT configuration
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hyperdetect';

// Connect to Database and start server
db.connect(MONGO_URI).then(() => {
  server.listen(PORT, () => {
    console.log(`[Server] Express server running on port ${PORT}`);
    console.log(`[Server] WebSocket interface bound and listening`);
  });
}).catch((error) => {
  console.error(`[Server] Critical failure during startup: ${error.message}`);
  process.exit(1);
});
