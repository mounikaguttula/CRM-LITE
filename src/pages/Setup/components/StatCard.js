import React from 'react';
import { ArrowUpRight } from 'lucide-react';

function StatCard({ icon: Icon, iconBg, iconColor, label, value, tab, onNavigate }) {
  return (
    <div
      className="glass glass-hover"
      onClick={() => onNavigate && onNavigate(tab)}
      style={{
        padding: '20px 22px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: 46, height: 46, borderRadius: 12,
          background: iconBg || 'var(--aurora-soft)',
          color: iconColor || 'var(--brand-600)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.6)',
        }}
      >
        <Icon size={20} strokeWidth={2.2} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="font-display" style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-strong)', lineHeight: 1.05, marginBottom: 4, letterSpacing: '-0.02em' }}>
          {value}
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-dim)' }}>
          {label}
        </div>
      </div>

      <ArrowUpRight
        size={16}
        style={{
          color: 'var(--text-faint)',
          opacity: 0.6,
          transition: 'transform 200ms ease, opacity 200ms ease',
        }}
      />
    </div>
  );
}

export default StatCard;
