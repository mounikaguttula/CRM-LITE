import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

function Toast({ message, show, type = 'info', onClose }) {
  if (!show) return null;

  const config = {
    success: { icon: CheckCircle2, color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)' },
    error:   { icon: AlertCircle,  color: '#f43f5e', bg: 'rgba(244,63,94,0.12)',  border: 'rgba(244,63,94,0.35)' },
    info:    { icon: Info,         color: '#6366f1', bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.35)' },
  }[type] || {};
  const Icon = config.icon;

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className="glass-strong rise-in"
      style={{
        position: 'fixed', bottom: 24, right: 24,
        zIndex: 1100, padding: '14px 16px',
        minWidth: 300, maxWidth: 420,
        display: 'flex', alignItems: 'flex-start', gap: 12,
        border: `1px solid ${config.border}`,
      }}
    >
      <div
        style={{
          width: 32, height: 32, borderRadius: 10,
          background: config.bg, color: config.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={18} strokeWidth={2.2} />
      </div>
      <div style={{ flex: 1, fontSize: 13.5, color: 'var(--text-strong)', fontWeight: 500, lineHeight: 1.5 }}>
        {message}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-faint)', padding: 2, borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

export default Toast;
