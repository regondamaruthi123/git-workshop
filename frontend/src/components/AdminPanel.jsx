import React, { useState, useEffect } from 'react';
import { Users, Files, AlertTriangle, Cpu, Terminal, Eye, Layers } from 'lucide-react';

export default function AdminPanel({ onSelectDetection }) {
  const [stats, setStats] = useState(null);
  const [detections, setDetections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    setLoading(true);
    setError('');
    
    const token = localStorage.getItem('token');
    
    try {
      // 1. Fetch system stats
      const statsRes = await fetch('http://localhost:5000/api/admin/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const statsData = await statsRes.json();
      if (!statsRes.ok) throw new Error(statsData.error || 'Failed to fetch admin stats');
      setStats(statsData);

      // 2. Fetch detections list
      const detsRes = await fetch('http://localhost:5000/api/detections', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const detsData = await detsRes.json();
      if (!detsRes.ok) throw new Error(detsData.error || 'Failed to fetch detections');
      setDetections(detsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <div className="float" style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>
            <Layers size={32} />
          </div>
          <p style={{ marginTop: '16px', fontSize: '14px' }}>Loading Administration Console...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {error && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: '#ff6b6b',
          borderRadius: '8px',
          fontSize: '13px'
        }}>
          <strong>Console Error:</strong> {error}
        </div>
      )}

      {/* Stats Counter Row */}
      <div className="stats-row">
        {/* Total Users */}
        <div className="glass-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '10px',
            background: 'rgba(6, 182, 212, 0.08)', border: '1px solid rgba(6, 182, 212, 0.2)',
            display: 'flex', alignItems: 'center', justifyOrigin: 'center', justifyContent: 'center', color: '#06b6d4'
          }}>
            <Users size={22} />
          </div>
          <div>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Total Accounts</span>
            <h3 style={{ fontSize: '24px', fontWeight: 800, color: 'white', marginTop: '2px' }}>{stats?.totalUsers || 0}</h3>
          </div>
        </div>

        {/* Total Scans */}
        <div className="glass-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '10px',
            background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)',
            display: 'flex', alignItems: 'center', justifyOrigin: 'center', justifyContent: 'center', color: '#6366f1'
          }}>
            <Files size={22} />
          </div>
          <div>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Total Scans</span>
            <h3 style={{ fontSize: '24px', fontWeight: 800, color: 'white', marginTop: '2px' }}>{stats?.totalDetections || 0}</h3>
          </div>
        </div>

        {/* Anomalies Detected */}
        <div className="glass-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '10px',
            background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)',
            display: 'flex', alignItems: 'center', justifyOrigin: 'center', justifyContent: 'center', color: '#ef4444'
          }}>
            <AlertTriangle size={22} />
          </div>
          <div>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Anomalies Flagged</span>
            <h3 style={{ fontSize: '24px', fontWeight: 800, color: '#ef4444', marginTop: '2px' }}>{stats?.detectedCount || 0}</h3>
          </div>
        </div>

        {/* AI Health Uptime */}
        <div className="glass-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '10px',
            background: stats?.aiServiceStatus === 'online' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
            border: stats?.aiServiceStatus === 'online' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
            display: 'flex', alignItems: 'center', justifyOrigin: 'center', justifyContent: 'center',
            color: stats?.aiServiceStatus === 'online' ? '#10b981' : '#ef4444'
          }}>
            <Cpu size={22} />
          </div>
          <div>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>AI Core Status</span>
            <h3 style={{
              fontSize: '15px', fontWeight: 800,
              color: stats?.aiServiceStatus === 'online' ? '#10b981' : '#ef4444',
              marginTop: '4px'
            }}>
              {stats?.aiServiceStatus === 'online' ? 'ONLINE (Port 5001)' : 'OFFLINE'}
            </h3>
          </div>
        </div>
      </div>

      {/* System diagnostics information */}
      <div className="glass-card">
        <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'white', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Terminal size={18} style={{ color: 'var(--secondary)' }} /> Engine Hardware Telemetry
        </h4>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          fontSize: '13px'
        }}>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Backend Uptime:</span>{' '}
            <span style={{ fontFamily: 'monospace', color: 'white' }}>{stats ? Math.round(stats.uptime) : 0}s</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Memory Overhead:</span>{' '}
            <span style={{ fontFamily: 'monospace', color: 'white' }}>{stats ? Math.round(stats.memoryUsage / 1024 / 1024) : 0} MB</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Active Environment:</span>{' '}
            <span style={{ fontFamily: 'monospace', color: 'white', textTransform: 'uppercase' }}>{stats?.environment || 'N/A'}</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Avg Anomaly Confidence:</span>{' '}
            <span style={{ fontFamily: 'monospace', color: 'white' }}>{stats?.avgAccuracy || 0}%</span>
          </div>
        </div>
      </div>

      {/* Table grid of records */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'white' }}>System Audit Logs</h4>
          <button
            onClick={fetchAdminData}
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '12px' }}
          >
            Refresh Logs
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)', fontWeight: 600 }}>
                <th style={{ padding: '12px 16px' }}>Date</th>
                <th style={{ padding: '12px 16px' }}>Operator</th>
                <th style={{ padding: '12px 16px' }}>Description</th>
                <th style={{ padding: '12px 16px' }}>GPS Telemetry</th>
                <th style={{ padding: '12px 16px' }}>Classification</th>
                <th style={{ padding: '12px 16px' }}>Score</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {detections.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No audit records stored in database.
                  </td>
                </tr>
              ) : (
                detections.map((det) => (
                  <tr
                    key={det._id || det.id}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      color: 'var(--text-main)',
                      transition: 'background 0.2s',
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                  >
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                      {new Date(det.createdAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                      {det.userId?.username || 'System Admin'}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                      {det.title}
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: 'var(--secondary)' }}>
                      {det.latitude?.toFixed(4)}, {det.longitude?.toFixed(4)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontWeight: 700,
                        fontSize: '11px',
                        background: det.detected ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                        border: det.detected ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)',
                        color: det.detected ? '#f87171' : '#34d399'
                      }}>
                        {det.detected ? 'ANOMALY' : 'SAFE'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 700 }}>
                      {det.accuracy}%
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button
                        onClick={() => onSelectDetection(det)}
                        className="btn btn-secondary"
                        style={{
                          padding: '4px 8px',
                          fontSize: '11px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Eye size={12} /> Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
    </div>
  );
}
