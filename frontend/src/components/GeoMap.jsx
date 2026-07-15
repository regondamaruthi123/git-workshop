import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

export default function GeoMap({ detections }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersGroupRef = useRef([]);

  useEffect(() => {
    if (!mapInstanceRef.current && mapContainerRef.current) {
      // Initialize map centered on global coordinates
      mapInstanceRef.current = L.map(mapContainerRef.current, {
        zoomControl: true,
        fadeAnimation: true
      }).setView([20, 0], 2);
      
      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 18
      }).addTo(mapInstanceRef.current);
    }

    return () => {
      // Map cleanup is handled on system level if needed, but we keep instance active
    };
  }, []);

  useEffect(() => {
    if (mapInstanceRef.current) {
      // Clear all existing markers
      markersGroupRef.current.forEach(marker => marker.remove());
      markersGroupRef.current = [];

      // Add markers for all detections with coordinates
      detections.forEach(det => {
        const { latitude, longitude, title, detected, accuracy, _id } = det;
        
        // Skip invalid coordinates
        if (latitude === undefined || latitude === null || longitude === undefined || longitude === null || isNaN(latitude) || isNaN(longitude)) return;
        if (latitude === 0 && longitude === 0) return;

        const pulseColor = detected ? 'var(--danger)' : 'var(--success)';
        const pulseGlow = detected ? 'var(--danger-glow)' : 'var(--success-glow)';
        
        // Create premium custom glowing divIcon
        const customIcon = L.divIcon({
          className: 'leaflet-custom-marker-wrapper',
          html: `
            <div style="
              width: 14px; 
              height: 14px; 
              background-color: ${pulseColor}; 
              border: 2px solid white; 
              border-radius: 50%; 
              box-shadow: 0 0 10px 3px ${pulseGlow};
              cursor: pointer;
            "></div>
          `,
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        });

        const dateStr = det.createdAt ? new Date(det.createdAt).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }) : 'N/A';

        const popupContent = `
          <div style="font-family: 'Plus Jakarta Sans', sans-serif; width: 180px; padding: 4px;">
            <h5 style="margin: 0 0 6px 0; font-size: 13px; font-weight: 700; color: white;">${title}</h5>
            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
              <span style="color: var(--text-muted);">Status:</span>
              <span style="font-weight: 700; color: ${pulseColor};">
                ${detected ? '🔴 ANOMALOUS' : '🟢 SAFE'}
              </span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
              <span style="color: var(--text-muted);">Confidence:</span>
              <span style="font-weight: 700; color: white;">${accuracy}%</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
              <span style="color: var(--text-muted);">Time:</span>
              <span style="font-weight: 600; color: white; font-size: 10px;">${dateStr}</span>
            </div>
            <div style="font-size: 9px; color: #888; margin-top: 6px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 4px;">
              Lat: ${latitude.toFixed(4)}, Lon: ${longitude.toFixed(4)}
            </div>
          </div>
        `;

        const marker = L.marker([latitude, longitude], { icon: customIcon })
          .addTo(mapInstanceRef.current)
          .bindPopup(popupContent);
          
        markersGroupRef.current.push(marker);
      });

      // Pan to the latest upload if available
      if (detections.length > 0) {
        const latest = detections[0];
        if (latest.latitude && latest.longitude && latest.latitude !== 0 && latest.longitude !== 0) {
          mapInstanceRef.current.setView([latest.latitude, latest.longitude], 5);
        }
      }
    }
  }, [detections]);

  const latestDet = detections[0];
  const isLocationMissing = latestDet && (latestDet.latitude === null || latestDet.longitude === null || latestDet.latitude === undefined || latestDet.longitude === undefined);

  return (
    <div style={{ position: 'relative' }}>
      <div ref={mapContainerRef} className="dark-leaflet-map" />
      
      {isLocationMissing && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: '1000',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#f87171',
          borderRadius: '6px',
          padding: '6px 12px',
          fontSize: '11px',
          fontWeight: 600,
          pointerEvents: 'none',
          backdropFilter: 'blur(4px)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
        }}>
          Latest Scan: Location not available
        </div>
      )}

      <div style={{
        position: 'absolute',
        bottom: '10px',
        left: '10px',
        zIndex: '1000',
        background: 'rgba(7, 9, 19, 0.85)',
        border: '1px solid var(--panel-border)',
        borderRadius: '6px',
        padding: '6px 10px',
        fontSize: '10px',
        color: 'var(--text-muted)',
        pointerEvents: 'none',
        display: 'flex',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--danger)' }} /> Anomaly
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--success)' }} /> Clean / Safe
        </div>
      </div>
    </div>
  );
}
