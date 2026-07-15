import React from 'react';
import { AlertTriangle, CheckCircle, Cpu, MapPin, Layers } from 'lucide-react';

export default function DetectionResult({ detection }) {
  if (!detection) {
    return (
      <div className="glass-card" style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-muted)',
        textAlign: 'center',
        minHeight: '350px'
      }}>
        <Layers size={48} style={{ color: 'rgba(255,255,255,0.08)', marginBottom: '16px' }} />
        <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'white', marginBottom: '8px' }}>
          No Scan Selected
        </h3>
        <p style={{ maxWidth: '300px', fontSize: '13px' }}>
          Upload a spectral source image on the left, or select an event from the log to display analysis details.
        </p>
      </div>
    );
  }

  const { title, imagePath, latitude, longitude, detected, accuracy, method, heatmapPath, createdAt } = detection;
  
  // Format dates
  const scanDate = new Date(createdAt).toLocaleString();
  
  // Resolve base urls for backend upload images
  const originalUrl = `http://localhost:5000${imagePath}`;
  const heatmapUrl = heatmapPath ? `http://localhost:5000${heatmapPath}` : null;

  return (
    <div className="glass-card" style={{ height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
        <div>
          <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'white', marginBottom: '6px' }}>{title}</h3>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Cpu size={12} /> {method}
            </span>
            <span>•</span>
            <span>{scanDate}</span>
          </div>
        </div>

        {/* Status Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          borderRadius: '10px',
          fontWeight: 700,
          fontSize: '14px',
          background: detected ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
          border: detected ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)',
          color: detected ? '#f87171' : '#34d399',
          boxShadow: detected ? '0 0 15px rgba(239, 68, 68, 0.15)' : '0 0 15px rgba(16, 185, 129, 0.15)',
        }}>
          {detected ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
          <span>{detected ? 'ANOMALOUS' : 'SAFE'}</span>
        </div>
      </div>

      {/* Numerical Stats Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {/* Confidence Card */}
        <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '16px', border: '1px solid rgba(255,255,255,0.03)' }}>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
            Detection Confidence
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '24px', fontWeight: 800, color: 'white' }}>{accuracy}%</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>probability</span>
          </div>
          {/* Progress bar */}
          <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', marginTop: '12px', overflow: 'hidden' }}>
            <div style={{
              width: `${accuracy}%`,
              height: '100%',
              background: detected ? 'linear-gradient(90deg, #ef4444, #f87171)' : 'linear-gradient(90deg, #10b981, #34d399)',
              borderRadius: '2px'
            }} />
          </div>
        </div>

        {/* GPS location card */}
        <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '16px', border: '1px solid rgba(255,255,255,0.03)' }}>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <MapPin size={11} style={{ color: 'var(--secondary)' }} /> Spatial Telemetry
          </span>
          {latitude !== null && latitude !== undefined && longitude !== null && longitude !== undefined ? (
            <>
              <div style={{ fontSize: '13px', color: 'white', fontWeight: 700, marginTop: '6px' }}>
                Lat: <span style={{ fontFamily: 'monospace', color: 'var(--secondary)' }}>{typeof latitude === 'number' ? latitude.toFixed(6) : latitude}</span>
              </div>
              <div style={{ fontSize: '13px', color: 'white', fontWeight: 700, marginTop: '4px' }}>
                Lon: <span style={{ fontFamily: 'monospace', color: 'var(--secondary)' }}>{typeof longitude === 'number' ? longitude.toFixed(6) : longitude}</span>
              </div>
            </>
          ) : (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '10px' }}>
              Location not available
            </div>
          )}
        </div>
      </div>

      {/* Diagnostic Explanation */}
      <div style={{
        background: 'rgba(0,0,0,0.2)',
        borderRadius: '10px',
        padding: '16px',
        border: '1px solid rgba(255,255,255,0.03)',
        marginBottom: '24px',
        fontSize: '13px',
        lineHeight: '1.6'
      }}>
        <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
          Diagnostic Explanation
        </span>
        {detected ? (
          <div style={{ color: '#f87171', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span><strong>High anomaly detected:</strong> Spectral deviation highlights localized anomaly spots in the target region.</span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Reflectance patterns deviate significantly from background baseline parameters, indicating probable contamination, plant decay, or anomalous target occurrences.</span>
          </div>
        ) : (
          <div style={{ color: '#34d399', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span><strong>No anomaly detected:</strong> The spatial-spectral signature matches clean control benchmarks.</span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Spectral reflectance metrics remain fully within natural background variation parameters.</span>
          </div>
        )}
      </div>

      {/* Image displays side-by-side */}
      <div>
        <h4 style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px', letterSpacing: '0.05em' }}>
          Visual Telemetry Analysis
        </h4>
        
        <div className="heatmap-display-grid">
          {/* Original Image */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{
              borderRadius: '10px',
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.08)',
              height: '240px',
              background: '#04050b'
            }}>
              <img
                src={originalUrl}
                alt="Original spectral scan"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', fontWeight: 600 }}>Original Image</span>
          </div>

          {/* Anomaly Heatmap */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{
              borderRadius: '10px',
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.08)',
              height: '240px',
              background: '#04050b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {heatmapUrl ? (
                <img
                  src={heatmapUrl}
                  alt="Anomaly heatmap visualization"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '16px', textAlign: 'center' }}>
                  No Heatmap generated.<br/>
                  <span style={{ fontSize: '10px' }}>(Check AI service log output)</span>
                </div>
              )}
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', fontWeight: 600 }}>
              Anomaly Overlay Heatmap
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
