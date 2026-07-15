import React from 'react';
import { ShieldAlert, LogOut, Cpu, Radio } from 'lucide-react';

export default function Navbar({ user, onLogout, wsConnected }) {
  return (
    <nav className="navbar">
      <div className="navbar-logo">
        <Cpu size={24} style={{ color: 'var(--secondary)' }} />
        <span>HyperDetect <span style={{ fontWeight: 300, color: 'var(--text-muted)' }}>AI</span></span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        {/* Real-time connection badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '12px',
          background: wsConnected ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
          border: wsConnected ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
          color: wsConnected ? '#34d399' : '#f87171',
          padding: '4px 10px',
          borderRadius: '20px',
          fontWeight: 600
        }}>
          <Radio size={12} className={wsConnected ? 'float' : ''} />
          <span>{wsConnected ? 'WS LIVE' : 'WS OFFLINE'}</span>
        </div>

        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{user.username}</div>
              <div style={{
                display: 'inline-block',
                fontSize: '10px',
                fontWeight: 700,
                color: user.role === 'admin' ? '#f472b6' : 'var(--secondary)',
                background: user.role === 'admin' ? 'rgba(244, 114, 182, 0.08)' : 'rgba(6, 182, 212, 0.08)',
                border: user.role === 'admin' ? '1px solid rgba(244, 114, 182, 0.2)' : '1px solid rgba(6, 182, 212, 0.2)',
                padding: '1px 6px',
                borderRadius: '4px',
                textTransform: 'uppercase',
                marginTop: '2px'
              }}>
                {user.role}
              </div>
            </div>

            <button
              onClick={onLogout}
              className="btn btn-secondary"
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f87171'
              }}
              title="Logout session"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
