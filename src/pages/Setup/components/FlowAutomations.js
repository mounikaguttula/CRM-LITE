import React from 'react';
import { Workflow, Sparkles, Clock } from 'lucide-react';

function FlowAutomations() {
  return (
    <div style={{ padding: '60px 32px', maxWidth: 800, margin: '0 auto', textAlign: 'center', fontFamily: "'Inter', sans-serif" }}>
      <div
        className="glass"
        style={{
          borderRadius: 24,
          padding: '64px 40px',
          position: 'relative',
          overflow: 'hidden',
          maxWidth: 720,
          margin: '40px auto 0',
        }}
      >
        {/* Background glow orbs */}
        <div style={{ position: 'absolute', top: -60, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,176,155,0.12), transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -40, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,172,254,0.12), transparent 70%)', pointerEvents: 'none' }} />

        {/* Icon Badge */}
        <div
          style={{
            width: 68,
            height: 68,
            borderRadius: 22,
            background: 'linear-gradient(135deg, #00b09b, #4facfe)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            boxShadow: '0 8px 24px rgba(0,176,155,0.3)',
          }}
        >
          <Workflow size={34} color="#ffffff" />
        </div>

        {/* Coming Soon Pill */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 16px',
            borderRadius: 99,
            background: 'rgba(0,176,155,0.1)',
            border: '1px solid rgba(0,176,155,0.3)',
            color: '#00b09b',
            fontSize: '0.75rem',
            fontWeight: 800,
            letterSpacing: '0.08em',
            marginBottom: 18,
          }}
        >
          <Sparkles size={14} />
          COMING SOON
        </div>
      </div>
    </div>
  );
}

export default FlowAutomations;
