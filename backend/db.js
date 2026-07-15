const mongoose = require('mongoose');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

let isMongo = false;
let sqliteDb = null;

// Helper to run SQLite queries with Promises
const sqliteRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    sqliteDb.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

const sqliteGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    sqliteDb.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const sqliteAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    sqliteDb.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Define MongoDB Schemas
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  createdAt: { type: Date, default: Date.now }
});

const DetectionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  imagePath: { type: String, required: true },
  latitude: { type: Number },
  longitude: { type: Number },
  detected: { type: Boolean, required: true },
  accuracy: { type: Number, required: true },
  method: { type: String, required: true },
  heatmapPath: { type: String },
  heatmapMaskPath: { type: String },
  createdAt: { type: Date, default: Date.now }
});

let MongoUser = null;
let MongoDetection = null;

const db = {
  isMongo: () => isMongo,
  
  connect: async (mongoUri) => {
    console.log('[Database] Connecting...');
    try {
      // Set short connection timeout for faster fallback if Mongo is offline
      await mongoose.connect(mongoUri || 'mongodb://localhost:27017/hyperdetect', {
        serverSelectionTimeoutMS: 3000
      });
      isMongo = true;
      MongoUser = mongoose.model('User', UserSchema);
      MongoDetection = mongoose.model('Detection', DetectionSchema);
      console.log('[Database] Successfully connected to MongoDB.');

      // Seed MongoDB default admin
      const adminExists = await MongoUser.findOne({ email: 'admin@hyperdetect.ai' });
      if (!adminExists) {
        const bcrypt = require('bcryptjs');
        const hashedAdminPassword = await bcrypt.hash('admin123', 10);
        await MongoUser.create({
          username: 'System Admin',
          email: 'admin@hyperdetect.ai',
          password: hashedAdminPassword,
          role: 'admin'
        });
        console.log('[Database] MongoDB seeded with default admin: admin@hyperdetect.ai / admin123');
      }

      // Seed MongoDB default user
      const userExists = await MongoUser.findOne({ email: 'user@hyperdetect.ai' });
      if (!userExists) {
        const bcrypt = require('bcryptjs');
        const hashedUserPassword = await bcrypt.hash('user123', 10);
        await MongoUser.create({
          username: 'Field Analyst',
          email: 'user@hyperdetect.ai',
          password: hashedUserPassword,
          role: 'user'
        });
        console.log('[Database] MongoDB seeded with default user: user@hyperdetect.ai / user123');
      }
    } catch (mongoError) {
      console.warn(`[Database] MongoDB connection failed: ${mongoError.message}`);
      console.log('[Database] Falling back to SQLite database...');
      
      const dbPath = path.join(__dirname, 'hyperdetect.sqlite');
      sqliteDb = new sqlite3.Database(dbPath, async (err) => {
        if (err) {
          console.error(`[Database] Failed to open SQLite DB: ${err.message}`);
          process.exit(1);
        }
        console.log(`[Database] Connected to SQLite database at: ${dbPath}`);
        
        // Initialize SQLite Tables
        try {
          await sqliteRun(`
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              username TEXT NOT NULL,
              email TEXT NOT NULL UNIQUE,
              password TEXT NOT NULL,
              role TEXT NOT NULL DEFAULT 'user',
              createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `);
          
          await sqliteRun(`
            CREATE TABLE IF NOT EXISTS detections (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              userId TEXT NOT NULL,
              title TEXT NOT NULL,
              imagePath TEXT NOT NULL,
              latitude REAL,
              longitude REAL,
              detected INTEGER NOT NULL,
              accuracy REAL NOT NULL,
              method TEXT NOT NULL,
              heatmapPath TEXT,
              heatmapMaskPath TEXT,
              createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `);
          
          const bcrypt = require('bcryptjs');
          
          // Add default admin user if none exists
          const adminExists = await sqliteGet("SELECT * FROM users WHERE email = 'admin@hyperdetect.ai'");
          if (!adminExists) {
            const hashedAdminPassword = await bcrypt.hash('admin123', 10);
            await sqliteRun(
              "INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)",
              ['System Admin', 'admin@hyperdetect.ai', hashedAdminPassword, 'admin']
            );
            console.log('[Database] SQLite initialized with default admin: admin@hyperdetect.ai / admin123');
          }

          // Add default regular user if none exists
          const userExists = await sqliteGet("SELECT * FROM users WHERE email = 'user@hyperdetect.ai'");
          if (!userExists) {
            const hashedUserPassword = await bcrypt.hash('user123', 10);
            await sqliteRun(
              "INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)",
              ['Field Analyst', 'user@hyperdetect.ai', hashedUserPassword, 'user']
            );
            console.log('[Database] SQLite initialized with default user: user@hyperdetect.ai / user123');
          }
        } catch (sqliteInitError) {
          console.error(`[Database] SQLite table initialization failed: ${sqliteInitError.message}`);
        }
      });
      
      isMongo = false;
    }
  },

  // Repository Methods for User
  User: {
    findOne: async (query) => {
      if (isMongo) {
        return MongoUser.findOne(query);
      } else {
        if (query.email) {
          const row = await sqliteGet("SELECT * FROM users WHERE email = ?", [query.email]);
          return row ? { ...row, _id: row.id.toString() } : null;
        }
        if (query.username) {
          const row = await sqliteGet("SELECT * FROM users WHERE username = ?", [query.username]);
          return row ? { ...row, _id: row.id.toString() } : null;
        }
        return null;
      }
    },
    
    findById: async (id) => {
      if (isMongo) {
        return MongoUser.findById(id);
      } else {
        const row = await sqliteGet("SELECT * FROM users WHERE id = ?", [id]);
        return row ? { ...row, _id: row.id.toString() } : null;
      }
    },
    
    create: async (data) => {
      if (isMongo) {
        return MongoUser.create(data);
      } else {
        const { username, email, password, role = 'user' } = data;
        const result = await sqliteRun(
          "INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)",
          [username, email, password, role]
        );
        return { _id: result.id.toString(), username, email, role };
      }
    }
  },

  // Repository Methods for Detection
  Detection: {
    find: async (query = {}, sort = { createdAt: -1 }) => {
      if (isMongo) {
        // Resolve user reference if queried
        return MongoDetection.find(query).populate('userId', 'username email').sort(sort);
      } else {
        let sql = `
          SELECT d.*, u.username as user_name, u.email as user_email 
          FROM detections d 
          LEFT JOIN users u ON d.userId = u.id
        `;
        const params = [];
        
        if (query.userId) {
          sql += " WHERE d.userId = ?";
          params.push(query.userId);
        }
        
        sql += " ORDER BY d.createdAt DESC";
        
        const rows = await sqliteAll(sql, params);
        return rows.map(r => ({
          ...r,
          _id: r.id.toString(),
          detected: !!r.detected,
          userId: { _id: r.userId, username: r.user_name, email: r.user_email }
        }));
      }
    },

    create: async (data) => {
      if (isMongo) {
        const doc = await MongoDetection.create(data);
        return doc.populate('userId', 'username email');
      } else {
        const { userId, title, imagePath, latitude, longitude, detected, accuracy, method, heatmapPath, heatmapMaskPath } = data;
        const result = await sqliteRun(
          `INSERT INTO detections (userId, title, imagePath, latitude, longitude, detected, accuracy, method, heatmapPath, heatmapMaskPath) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [userId, title, imagePath, latitude, longitude, detected ? 1 : 0, accuracy, method, heatmapPath, heatmapMaskPath]
        );
        
        const user = await sqliteGet("SELECT username, email FROM users WHERE id = ?", [userId]);
        
        return {
          _id: result.id.toString(),
          userId: { _id: userId, username: user ? user.username : '', email: user ? user.email : '' },
          title,
          imagePath,
          latitude,
          longitude,
          detected,
          accuracy,
          method,
          heatmapPath,
          heatmapMaskPath,
          createdAt: new Date()
        };
      }
    },

    // Aggregates for Admin Dashboard
    getStats: async () => {
      if (isMongo) {
        const totalUsers = await MongoUser.countDocuments();
        const totalDetections = await MongoDetection.countDocuments();
        const detectedCount = await MongoDetection.countDocuments({ detected: true });
        
        const avgAccuracy = await MongoDetection.aggregate([
          { $group: { _id: null, avg: { $avg: "$accuracy" } } }
        ]);
        
        // Distribution of methods
        const methods = await MongoDetection.aggregate([
          { $group: { _id: "$method", count: { $sum: 1 } } }
        ]);

        return {
          totalUsers,
          totalDetections,
          detectedCount,
          safeCount: totalDetections - detectedCount,
          avgAccuracy: avgAccuracy.length > 0 ? Math.round(avgAccuracy[0].avg * 10) / 10 : 0,
          methodDistribution: methods.reduce((acc, m) => {
            acc[m._id] = m.count;
            return acc;
          }, {})
        };
      } else {
        const userCountRow = await sqliteGet("SELECT COUNT(*) as count FROM users");
        const detCountRow = await sqliteGet("SELECT COUNT(*) as count FROM detections");
        const detectedCountRow = await sqliteGet("SELECT COUNT(*) as count FROM detections WHERE detected = 1");
        const avgAccuracyRow = await sqliteGet("SELECT AVG(accuracy) as avg FROM detections");
        const methodRows = await sqliteAll("SELECT method, COUNT(*) as count FROM detections GROUP BY method");
        
        const totalUsers = userCountRow ? userCountRow.count : 0;
        const totalDetections = detCountRow ? detCountRow.count : 0;
        const detectedCount = detectedCountRow ? detectedCountRow.count : 0;
        const avgAccuracy = avgAccuracyRow && avgAccuracyRow.avg ? Math.round(avgAccuracyRow.avg * 10) / 10 : 0;
        
        const methodDistribution = {};
        methodRows.forEach(r => {
          methodDistribution[r.method] = r.count;
        });

        return {
          totalUsers,
          totalDetections,
          detectedCount,
          safeCount: totalDetections - detectedCount,
          avgAccuracy,
          methodDistribution
        };
      }
    }
  }
};

module.exports = db;
