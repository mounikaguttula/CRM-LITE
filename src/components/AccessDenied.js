import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

function AccessDenied({ message, moduleName }) {
  const navigate = useNavigate();

  return (
    <div style={{ padding: '60px 20px', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{
        maxWidth: 480, margin: '0 auto', padding: '36px 28px', borderRadius: 20,
        background: '#ffffff', border: '1px solid #fecaca',
        boxShadow: '0 20px 40px -10px rgba(239, 68, 68, 0.12)'
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 16, background: '#fef2f2',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px', color: '#dc2626'
        }}>
          <ShieldAlert size={28} />
        </div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', marginBottom: 8 }}>
          Access Denied
        </h3>
        <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: 24, lineHeight: 1.6 }}>
          {message || `You do not have permission to access ${moduleName || 'this module'}. Please check with your administrator.`}
        </p>
        <button
          type="button"
          onClick={() => navigate('/workspace/dashboard')}
          style={{
            padding: '10px 24px', borderRadius: 12,
            background: 'linear-gradient(135deg, #00b09b, #4facfe)',
            color: '#ffffff', fontWeight: 700, border: 'none',
            cursor: 'pointer', fontSize: '0.875rem',
            boxShadow: '0 4px 12px rgba(0, 176, 155, 0.3)'
          }}
        >
          Return to Dashboard
        </button>
      </div>
    </div>
  );
}

export default AccessDenied;
