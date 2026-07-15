import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { AlertOctagon, Terminal, MapPin, Database, Sparkles, LayoutDashboard, Settings } from 'lucide-react';

import Auth from './components/Auth';
import Navbar from './components/Navbar';
import DetectionUpload from './components/DetectionUpload';
import DetectionResult from './components/DetectionResult';
import GeoMap from './components/GeoMap';
import AnalyticsCharts from './components/AnalyticsCharts';
import AdminPanel from './components/AdminPanel';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')));
  const [detections, setDetections] = useState([]);
  const [selectedDetection, setSelectedDetection] = useState(null);
  const [viewTab, setViewTab] = useState('dashboard'); // 'dashboard' or 'admin'
  
  // Real-time states
  const [socket, setSocket] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [toasts, setToasts] = useState([]);

  // Load detections
  useEffect(() => {
    if (token) {
      fetchDetections();
    }
  }, [token]);

  // Set up WebSockets (Socket.io) for real-time notifications
  useEffect(() => {
    if (token) {
      const socketInstance = io('http://localhost:5000', {
        transports: ['websocket'],
        reconnection: true
      });

      socketInstance.on('connect', () => {
        console.log('[WebSocket] Connected to server.');
        setWsConnected(true);
      });

      socketInstance.on('disconnect', () => {
        console.log('[WebSocket] Disconnected from server.');
        setWsConnected(false);
      });

      // Receive real-time alerts
      socketInstance.on('new-detection', (newAlert) => {
        console.log('[WebSocket] Live alert received:', newAlert);
        
        // Add notification toast
        const toastId = Date.now();
        const toast = {
          id: toastId,
          title: newAlert.title,
          detected: newAlert.detected,
          accuracy: newAlert.accuracy,
          operator: newAlert.user,
          lat: newAlert.latitude,
          lon: newAlert.longitude
        };
        
        setToasts(prev => [toast, ...prev]);

        // Auto remove toast after 7 seconds
        setTimeout(() => {
          removeToast(toastId);
        }, 7000);

        // Refresh detections list to sync data in real-time!
        fetchDetections();
      });

      setSocket(socketInstance);

      return () => {
        socketInstance.disconnect();
      };
    }
  }, [token]);

  const fetchDetections = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('http://localhost:5000/api/detections', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setDetections(data);
        // Default select the latest detection if none is selected
        if (data.length > 0 && !selectedDetection) {
          setSelectedDetection(data[0]);
        }
      }
    } catch (err) {
      console.error('[App] Failed to fetch detections:', err.message);
    }
  };

  const handleAuthSuccess = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setDetections([]);
    setSelectedDetection(null);
    setViewTab('dashboard');
  };

  const handleUploadSuccess = (newDetection) => {
    setDetections(prev => [newDetection, ...prev]);
    setSelectedDetection(newDetection);
    
    // Trigger user-upload toast feedback
    const toastId = Date.now();
    const toast = {
      id: toastId,
      title: newDetection.title,
      detected: newDetection.detected,
      accuracy: newDetection.accuracy,
      operator: 'You',
      lat: newDetection.latitude,
      lon: newDetection.longitude,
      isLocalSuccess: true
    };
    setToasts(prev => [toast, ...prev]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toastId));
    }, 7000);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleSelectDetection = (det) => {
    setSelectedDetection(det);
    setViewTab('dashboard'); // Redirect to dashboard tab to inspect the scan details
    // Scroll smoothly to top of dashboard results
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!token) {
    return (
      <>
        <Navbar user={null} wsConnected={false} />
        <Auth onAuthSuccess={handleAuthSuccess} />
      </>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar user={user} onLogout={handleLogout} wsConnected={wsConnected} />

      {/* Real-time Notification Toast Panel */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className="toast" style={{
            borderLeftColor: toast.detected ? 'var(--danger)' : 'var(--success)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: toast.detected ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
              color: toast.detected ? 'var(--danger)' : 'var(--success)'
            }}>
              <AlertOctagon size={16} />
            </div>
            
            <div className="toast-content">
              <div className="toast-title" style={{
                color: toast.detected ? '#f87171' : '#34d399'
              }}>
                {toast.isLocalSuccess 
                  ? (toast.detected ? '🔴 Anomaly detected!' : '🟢 Scan completed successfully')
                  : (toast.detected ? 'CRITICAL: Anomaly Flagged' : 'TELEMETRY: Safe Scan')}
              </div>
              <div className="toast-msg">
                <strong>{toast.title}</strong><br/>
                Scan by {toast.operator} (Conf: {toast.accuracy}%)<br/>
                {toast.lat !== null && toast.lat !== undefined && toast.lon !== null && toast.lon !== undefined ? (
                  <span style={{ fontSize: '10px', color: 'var(--secondary)' }}>GPS: {typeof toast.lat === 'number' ? toast.lat.toFixed(4) : toast.lat}, {typeof toast.lon === 'number' ? toast.lon.toFixed(4) : toast.lon}</span>
                ) : (
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Location optional / skipped</span>
                )}
              </div>
            </div>

            <button onClick={() => removeToast(toast.id)} className="toast-close">×</button>
          </div>
        ))}
      </div>

      {/* Admin Tab Switcher header */}
      {user?.role === 'admin' && (
        <div style={{
          padding: '16px 24px 0 24px',
          maxWidth: '1600px',
          width: '100%',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'flex-start'
        }}>
          <div className="tabs" style={{ width: '300px' }}>
            <div
              className={`tab ${viewTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setViewTab('dashboard')}
            >
              <LayoutDashboard size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
              Analyst Portal
            </div>
            <div
              className={`tab ${viewTab === 'admin' ? 'active' : ''}`}
              onClick={() => setViewTab('admin')}
            >
              <Settings size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
              Operator Console
            </div>
          </div>
        </div>
      )}

      {/* Main Body Grid */}
      <main style={{ maxWidth: '1600px', width: '100%', margin: '0 auto', flexGrow: 1 }}>
        {viewTab === 'admin' && user?.role === 'admin' ? (
          <div style={{ padding: '24px' }}>
            <AdminPanel onSelectDetection={handleSelectDetection} />
          </div>
        ) : (
          <div className="dashboard-grid">
            {/* Left Column: Upload Panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <DetectionUpload onUploadSuccess={handleUploadSuccess} />
              
              {/* Scan Log History in sidebar */}
              <div className="glass-card">
                <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Database size={16} style={{ color: 'var(--secondary)' }} />
                  Scan Telemetry Log
                </h4>
                
                <div style={{
                  maxHeight: '380px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  paddingRight: '4px'
                }}>
                  {detections.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                      No scans loaded.
                    </div>
                  ) : (
                    detections.map(det => (
                      <div
                        key={det._id || det.id}
                        onClick={() => setSelectedDetection(det)}
                        className={`glass-card glass-card-interactive ${selectedDetection?._id === det._id || selectedDetection?.id === det.id ? 'pulse-glow-primary' : ''}`}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '8px',
                          background: selectedDetection?._id === det._id || selectedDetection?.id === det.id ? 'rgba(99, 102, 241, 0.08)' : 'rgba(0,0,0,0.15)',
                          border: selectedDetection?._id === det._id || selectedDetection?.id === det.id ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.03)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
                            {det.title}
                          </span>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            color: det.detected ? '#f87171' : '#34d399',
                            background: det.detected ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                            border: det.detected ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)'
                          }}>
                            {det.detected ? 'ANOMALY' : 'SAFE'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <MapPin size={10} /> {det.latitude.toFixed(3)}, {det.longitude.toFixed(3)}
                          </span>
                          <span>Conf: {det.accuracy}%</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Dynamic Results Dashboard */}
            <div className="main-content two-cols">
              {/* Top Panel: Results Display */}
              <div style={{ gridColumn: '1 / -1' }}>
                <DetectionResult detection={selectedDetection} />
              </div>

              {/* Bottom Left: Interactive Map */}
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MapPin size={16} style={{ color: 'var(--secondary)' }} />
                  Geospatial Anomaly Tracking
                </h4>
                <GeoMap detections={detections} />
              </div>

              {/* Bottom Right: Analytics Charts */}
              <AnalyticsCharts detections={detections} />
            </div>
          </div>
        )}
      </main>

      {/* Sub-footer console brand */}
      <footer style={{
        textAlign: 'center',
        padding: '24px 0',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        fontSize: '12px',
        color: 'var(--text-muted)',
        marginTop: 'auto'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <Sparkles size={12} style={{ color: 'var(--secondary)' }} />
          <span>HyperDetect AI precision environmental systems. Running on local node infrastructure.</span>
        </div>
      </footer>
    </div>
  );
}
