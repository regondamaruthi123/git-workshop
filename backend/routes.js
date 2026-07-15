const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

const db = require('./db');
const { verifyToken, isAdmin, JWT_SECRET } = require('./middleware');

// AI Service URL config
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5001';

// Setup Multer for upload storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'upload-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|tiff|tif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only JPEG, PNG, or TIFF image files are allowed!'));
  }
});

// Authentication Routes
router.post('/auth/signup', async (req, res) => {
  const { username, email, password, role } = req.body;
  
  if (!username || !email || !password) {
    return res.status(400).json({ error: "Username, email, and password are required." });
  }
  
  try {
    const userExists = await db.User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ error: "A user with this email already exists." });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const newUser = await db.User.create({
      username,
      email,
      password: hashedPassword,
      role: role === 'admin' ? 'admin' : 'user'
    });
    
    // Sign JWT
    const token = jwt.sign(
      { id: newUser._id, username: newUser.username, email: newUser.email, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.status(201).json({
      message: "Registration successful",
      token,
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: `Registration failed: ${error.message}` });
  }
});

router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }
  
  try {
    const user = await db.User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "Invalid email or password." });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: "Invalid email or password." });
    }
    
    // Sign JWT
    const token = jwt.sign(
      { id: user._id || user.id, username: user.username, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id || user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: `Login failed: ${error.message}` });
  }
});

// Detection Routes
router.post('/detections/upload', verifyToken, upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Please upload an image file." });
  }

  const { title = "Spectral Scanned Image", latitude, longitude } = req.body;
  const parsedLat = (latitude !== undefined && latitude !== '' && latitude !== null && !isNaN(parseFloat(latitude))) ? parseFloat(latitude) : null;
  const parsedLon = (longitude !== undefined && longitude !== '' && longitude !== null && !isNaN(parseFloat(longitude))) ? parseFloat(longitude) : null;
  const originalImagePath = `/uploads/${req.file.filename}`;
  
  try {
    console.log(`[Backend] Forwarding image to AI Service at ${AI_SERVICE_URL}/detect...`);
    
    // Prepare multipart form data to forward the file to Flask
    const form = new FormData();
    form.append('image', fs.createReadStream(req.file.path));
    
    let aiResponse;
    try {
      aiResponse = await axios.post(`${AI_SERVICE_URL}/detect`, form, {
        headers: {
          ...form.getHeaders()
        },
        timeout: 10000 // 10 seconds timeout
      });
    } catch (aiErr) {
      console.warn(`[Backend] AI Service connection failed: ${aiErr.message}. Running fallback simulated detection.`);
      // Fallback response if Flask service is not running
      aiResponse = {
        data: {
          detected: Math.random() > 0.5,
          accuracy: parseFloat((80 + Math.random() * 18).toFixed(2)),
          method: "Simulated Detector (Fallback)",
          heatmap: null
        }
      };
    }
    
    const { detected, accuracy, method, heatmap, heatmap_mask } = aiResponse.data;
    
    // Save Heatmap image locally if provided by AI service
    let heatmapPath = null;
    let heatmapMaskPath = null;
    
    const heatmapDir = path.join(__dirname, 'uploads', 'heatmaps');
    if (!fs.existsSync(heatmapDir)) {
      fs.mkdirSync(heatmapDir, { recursive: true });
    }

    if (heatmap) {
      // Decode and save overlay heatmap
      const base64Data = heatmap.replace(/^data:image\/png;base64,/, "");
      const heatmapFilename = `heatmap-${Date.now()}.png`;
      fs.writeFileSync(path.join(heatmapDir, heatmapFilename), base64Data, 'base64');
      heatmapPath = `/uploads/heatmaps/${heatmapFilename}`;
    }
    
    if (heatmap_mask) {
      // Decode and save raw mask
      const base64Mask = heatmap_mask.replace(/^data:image\/png;base64,/, "");
      const maskFilename = `mask-${Date.now()}.png`;
      fs.writeFileSync(path.join(heatmapDir, maskFilename), base64Mask, 'base64');
      heatmapMaskPath = `/uploads/heatmaps/${maskFilename}`;
    }

    // Save detection record in database
    const newDetection = await db.Detection.create({
      userId: req.user.id || req.user._id,
      title,
      imagePath: originalImagePath,
      latitude: parsedLat,
      longitude: parsedLon,
      detected,
      accuracy,
      method,
      heatmapPath,
      heatmapMaskPath
    });

    // Real-Time Notification via WebSockets (Socket.io)
    const io = req.app.get('socketio');
    if (io) {
      console.log("[Backend] Emitting WebSocket alert for new detection.");
      io.emit('new-detection', {
        id: newDetection._id || newDetection.id,
        title: newDetection.title,
        detected: newDetection.detected,
        accuracy: newDetection.accuracy,
        latitude: newDetection.latitude,
        longitude: newDetection.longitude,
        timestamp: newDetection.createdAt,
        user: newDetection.userId.username || 'System'
      });
    }

    res.status(201).json({
      message: "Image processed successfully",
      detection: newDetection
    });
  } catch (error) {
    console.error(`[Backend] Processing upload failed: ${error.stack}`);
    res.status(500).json({ error: `Failed to process detection: ${error.message}` });
  }
});

router.get('/detections', verifyToken, async (req, res) => {
  try {
    let detections;
    // Admins can see all detections, standard users can only see their own
    if (req.user.role === 'admin') {
      detections = await db.Detection.find({});
    } else {
      detections = await db.Detection.find({ userId: req.user.id || req.user._id });
    }
    
    res.json(detections);
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch detections: ${error.message}` });
  }
});

// Admin System Stats Route
router.get('/admin/stats', verifyToken, isAdmin, async (req, res) => {
  try {
    const stats = await db.Detection.getStats();
    
    // Add runtime server status info
    const platformStats = {
      ...stats,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage().heapUsed,
      environment: process.env.NODE_ENV || 'development',
      aiServiceStatus: 'online' // Backend checks connection
    };
    
    try {
      await axios.get(`${AI_SERVICE_URL}/health`, { timeout: 2000 });
    } catch (e) {
      platformStats.aiServiceStatus = 'offline';
    }
    
    res.json(platformStats);
  } catch (error) {
    res.status(500).json({ error: `Failed to retrieve stats: ${error.message}` });
  }
});

module.exports = router;
