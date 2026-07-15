import React, { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';

// Register Chart.js components
Chart.register(...registerables);

export default function AnalyticsCharts({ detections }) {
  const pieChartRef = useRef(null);
  const lineChartRef = useRef(null);
  const pieInstance = useRef(null);
  const lineInstance = useRef(null);

  useEffect(() => {
    // Process data for charts
    const anomaliesCount = detections.filter(d => d.detected).length;
    const safeCount = detections.length - anomaliesCount;
    
    // Sort detections by date for chronological graphing
    const sortedDets = [...detections].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    // Group detections by date (YYYY-MM-DD)
    const groupedData = {};
    sortedDets.forEach(det => {
      const dateStr = new Date(det.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      if (!groupedData[dateStr]) {
        groupedData[dateStr] = { total: 0, anomalies: 0 };
      }
      groupedData[dateStr].total += 1;
      if (det.detected) {
        groupedData[dateStr].anomalies += 1;
      }
    });

    const dates = Object.keys(groupedData).slice(-10); // Last 10 days of uploads
    const totalUploads = dates.map(d => groupedData[d].total);
    const anomalyUploads = dates.map(d => groupedData[d].anomalies);

      const totalCount = anomaliesCount + safeCount;
      const anomalyPercent = totalCount > 0 ? Math.round((anomaliesCount / totalCount) * 100) : 0;
      const safePercent = totalCount > 0 ? Math.round((safeCount / totalCount) * 100) : 0;

      // 1. Render Pie / Doughnut Chart
      if (pieChartRef.current) {
        if (pieInstance.current) {
          pieInstance.current.destroy();
        }

        pieInstance.current = new Chart(pieChartRef.current, {
        type: 'doughnut',
        data: {
          labels: [`Anomalous (${anomalyPercent}%)`, `Clear / Safe (${safePercent}%)`],
          datasets: [{
            data: [anomaliesCount, safeCount],
            backgroundColor: ['#ef4444', '#10b981'],
            borderColor: 'rgba(7, 9, 19, 0.8)',
            borderWidth: 2,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            animateRotate: true,
            animateScale: true,
            duration: 800,
            easing: 'easeOutSine'
          },
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: '#f3f4f6',
                font: { family: 'Plus Jakarta Sans', size: 11 }
              }
            }
          },
          cutout: '65%'
        }
      });
    }

    // 2. Render Line/Bar Chart for Trends
    if (lineChartRef.current) {
      if (lineInstance.current) {
        lineInstance.current.destroy();
      }

      lineInstance.current = new Chart(lineChartRef.current, {
        type: 'bar',
        data: {
          labels: dates.length > 0 ? dates : ['No Data'],
          datasets: [
            {
              label: 'Total Scans',
              data: totalUploads.length > 0 ? totalUploads : [0],
              backgroundColor: 'rgba(6, 182, 212, 0.4)',
              borderColor: '#06b6d4',
              borderWidth: 1.5,
              borderRadius: 4
            },
            {
              label: 'Anomalies Detected',
              data: anomalyUploads.length > 0 ? anomalyUploads : [0],
              backgroundColor: 'rgba(239, 68, 68, 0.6)',
              borderColor: '#ef4444',
              borderWidth: 1.5,
              borderRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
              labels: {
                color: '#f3f4f6',
                font: { family: 'Plus Jakarta Sans', size: 11 }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { color: '#9ca3af', stepSize: 1 },
              grid: { color: 'rgba(255, 255, 255, 0.05)' }
            },
            x: {
              ticks: { color: '#9ca3af' },
              grid: { display: false }
            }
          }
        }
      });
    }

    return () => {
      if (pieInstance.current) pieInstance.current.destroy();
      if (lineInstance.current) lineInstance.current.destroy();
    };
  }, [detections]);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr',
      gap: '24px',
      width: '100%'
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: '24px'
      }}>
        {/* Doughnut Chart Box */}
        <div className="glass-card">
          <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', color: 'white' }}>
            Spectral Distribution
          </h4>
          <div style={{ height: '200px', position: 'relative' }}>
            {detections.length === 0 ? (
              <div style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                fontSize: '13px'
              }}>
                Awaiting telemetry...
              </div>
            ) : (
              <canvas ref={pieChartRef} />
            )}
          </div>
        </div>

        {/* Bar Chart Box */}
        <div className="glass-card">
          <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', color: 'white' }}>
            Anomaly Detection Timeline
          </h4>
          <div style={{ height: '220px', position: 'relative' }}>
            {detections.length === 0 ? (
              <div style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                fontSize: '13px'
              }}>
                Awaiting scan events...
              </div>
            ) : (
              <canvas ref={lineChartRef} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
