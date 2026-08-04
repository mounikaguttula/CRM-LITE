import React, { useState, useEffect } from 'react';
import { apiGet } from '../../../api/client';
import { Shield, Plus } from 'lucide-react';

function RoleManagement() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadRoles() {
      try {
        setLoading(true);
        const data = await apiGet('/roles').catch(() => []);
        if (isMounted) setRoles(Array.isArray(data) ? data : data?.data || []);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadRoles();
    return () => { isMounted = false; };
  }, []);

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justify: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 className="font-display" style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1c2033', margin: 0 }}>Roles & Security</h2>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-dim)', margin: 0 }}>Define access control levels and permissions for team members.</p>
        </div>
        <button
          className="orbit-btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: '10px', fontSize: '0.85rem', cursor: 'pointer' }}
        >
          <Plus style={{ width: '16px', height: '16px' }} />
          Create Custom Role
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-faint)' }}>
          <div className="spinner-border spinner-border-sm me-2 text-primary" role="status" />
          Loading roles...
        </div>
      ) : roles.length === 0 ? (
        <div className="glass" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-faint)' }}>
          <Shield style={{ width: '32px', height: '32px', marginBottom: '8px' }} />
          <p style={{ margin: 0, fontSize: '0.85rem' }}>No roles configured.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
          {roles.map((r) => (
            <div key={r.id || r.name} className="glass glass-hover" style={{ padding: '20px', display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: 'var(--aurora-soft)',
                    color: '#a78bfa',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Shield style={{ width: '20px', height: '20px' }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#1c2033' }}>{r.name}</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>{r.user_count || 0} assigned users</span>
                </div>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', flex: 1, marginBottom: '16px', lineHeight: 1.4 }}>
                {r.description || 'Standard role permissions.'}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '12px', borderTop: '1px solid var(--panel-border)', fontSize: '0.8rem', color: 'var(--text-faint)' }}>
                <span>Full Access</span>
                <button style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Edit Role</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default RoleManagement;
