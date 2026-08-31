import React, { useState, useEffect, useContext } from 'react';
import { apiGet, apiPut } from '../../../api/client';
import {
  Save, Building2, Hash, Calendar, User,
  CheckCircle, RefreshCw, Shield, Zap,
} from 'lucide-react';
import WorkspaceContext from '../../../context/WorkspaceContext';

/* ── tiny helper ── */
const fmt = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '—';

/* ── plan badge colours ── */
const PLAN_COLORS = {
  trial:      { bg: 'rgba(246,211,101,0.12)', border: 'rgba(246,211,101,0.35)', text: '#b45309' },
  basic:      { bg: 'rgba(79,172,254,0.1)',   border: 'rgba(79,172,254,0.35)',  text: '#1d4ed8' },
  pro:        { bg: 'rgba(0,176,155,0.1)',    border: 'rgba(0,176,155,0.35)',   text: '#047857' },
  enterprise: { bg: 'rgba(118,75,162,0.1)',   border: 'rgba(118,75,162,0.35)', text: '#6d28d9' },
};

const STATUS_COLORS = {
  active:    { bg: 'rgba(0,214,153,0.1)',   border: 'rgba(0,214,153,0.3)',  text: '#059669' },
  suspended: { bg: 'rgba(244,63,94,0.1)',   border: 'rgba(244,63,94,0.3)',  text: '#dc2626' },
  cancelled: { bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.3)',text: '#6b7280' },
};

function CompanyInfo() {
  const ctx = useContext(WorkspaceContext) || {};
  const { currentUser } = ctx;

  const [org, setOrg] = useState({
    id: '', name: '', code: '',
    subscription_plan: '', status: '',
    created_at: '', updated_at: '', created_by_name: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState(null);

  /* ── fetch org on mount with metadata fallback ── */
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);

        // Try the direct company endpoint first
        let data = null;
        try {
          data = await apiGet('/company');
        } catch (e) {
          data = null;
        }

        // Fallback: workspace metadata or generic metadata endpoints
        if (!data) {
          try {
            const md = await apiGet('/workspace/metadata').catch(() => apiGet('/metadata'));
            data = md?.data?.company || md?.company || md?.organization || null;
          } catch (e) {
            data = null;
          }
        }

        if (alive) {
          if (data) {
            setOrg(data);
          } else {
            setError('Organization details not available from API. Check backend or authentication.');
          }
        }
      } catch (err) {
        if (alive) setError(err.message || 'Failed to load organization details.');
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, []);

  /* ── save handler ── */
  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = await apiPut('/company', { name: org.name, code: org.code });
      if (updated) setOrg((prev) => ({ ...prev, ...updated }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  /* ── shared styles ── */
  const labelSt = {
    display: 'block', fontSize: 11, fontWeight: 700,
    color: '#9ca3af', marginBottom: 6,
    textTransform: 'uppercase', letterSpacing: '0.07em',
  };

  const inputSt = {
    width: '100%', padding: '10px 14px 10px 40px',
    borderRadius: 10, border: '1.5px solid rgba(0,176,155,0.2)',
    background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(12px)',
    fontSize: 13.5, color: '#0f1330', outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s', fontFamily: 'inherit',
  };

  const focusIn  = (e) => { e.target.style.borderColor = '#00b09b'; e.target.style.boxShadow = '0 0 0 3px rgba(0,176,155,0.12)'; };
  const focusOut = (e) => { e.target.style.borderColor = 'rgba(0,176,155,0.2)'; e.target.style.boxShadow = 'none'; };

  /* ── loading state ── */
  if (loading) {
    return (
      <div style={{ padding: '72px', textAlign: 'center' }}>
        <div className="spinner-border spinner-border-sm me-2 text-primary" role="status" />
        <span style={{ color: '#6b7280', fontSize: 14 }}>Loading organization details…</span>
      </div>
    );
  }

  const planColor   = PLAN_COLORS[org.subscription_plan]   || PLAN_COLORS.trial;
  const statusColor = STATUS_COLORS[org.status] || STATUS_COLORS.active;

  const userRoleStr = String(currentUser?.role || currentUser?.role_name || '').toLowerCase();
  const isUserAdmin = userRoleStr.includes('admin') || userRoleStr.includes('administrator');

  return (
    <div className="fade-in" style={{ maxWidth: 820, margin: '0 auto' }}>

      {/* ══ Hero banner ══ */}
      <div style={{
        borderRadius: 22, marginBottom: 26, overflow: 'hidden', position: 'relative',
        background: 'linear-gradient(135deg, #0d1117 0%, #0a1628 45%, #0d2137 100%)',
        padding: '28px 32px',
        boxShadow: '0 20px 56px -14px rgba(0,176,155,0.16)',
        animation: 'slideUp 0.5s cubic-bezier(0.22,1,0.36,1) both',
      }}>
        {/* glow orbs */}
        <div style={{ position:'absolute', top:-50, right:50,  width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle,rgba(0,176,155,0.18),transparent 65%)',  pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:-30, right:200, width:160, height:160, borderRadius:'50%', background:'radial-gradient(circle,rgba(79,172,254,0.12),transparent 65%)', pointerEvents:'none' }} />

        <div style={{ position:'relative', zIndex:1, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:16 }}>
          {/* left */}
          <div>
            <div style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'4px 12px', borderRadius:20, background:'rgba(0,176,155,0.1)', border:'1px solid rgba(0,176,155,0.25)', marginBottom:12 }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:'#00d699', animation:'pulseGlow 2s ease-in-out infinite' }} />
              <span style={{ fontSize:'0.62rem', fontWeight:700, color:'#00d699', textTransform:'uppercase', letterSpacing:'0.09em' }}>Organization Settings</span>
            </div>
            <h2 style={{ margin:'0 0 6px', fontSize:'1.55rem', fontWeight:900, color:'#fff', letterSpacing:'-0.025em', lineHeight:1.1 }}>
              {org.name || 'Your Organization'}
            </h2>
            <p style={{ margin:0, fontSize:'0.8rem', color:'rgba(255,255,255,0.4)' }}>
              Workspace code: <span style={{ color:'rgba(255,255,255,0.7)', fontWeight:600, fontFamily:"'JetBrains Mono', monospace" }}>{org.code || '—'}</span>
            </p>
          </div>

          {/* right: badges */}
          <div style={{ display:'flex', gap:10 }}>
            <div style={{ padding:'10px 18px', borderRadius:12, background: statusColor.bg, border:`1px solid ${statusColor.border}`, textAlign:'center', minWidth:90 }}>
              <div style={{ fontSize:'0.6rem', fontWeight:700, color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:'0.07em' }}>Status</div>
              <div style={{ fontSize:'0.9rem', fontWeight:800, color: statusColor.text, marginTop:3, textTransform:'capitalize' }}>{org.status || 'Active'}</div>
            </div>
            <div style={{ padding:'10px 18px', borderRadius:12, background: planColor.bg, border:`1px solid ${planColor.border}`, textAlign:'center', minWidth:90 }}>
              <div style={{ fontSize:'0.6rem', fontWeight:700, color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:'0.07em' }}>Plan</div>
              <div style={{ fontSize:'0.9rem', fontWeight:800, color: planColor.text, marginTop:3, textTransform:'capitalize' }}>{org.subscription_plan || 'Trial'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ Toast messages ══ */}
      {saved && (
        <div style={{ display:'flex', alignItems:'center', gap:9, padding:'12px 18px', borderRadius:12, background:'rgba(0,214,153,0.08)', border:'1px solid rgba(0,214,153,0.25)', marginBottom:18, fontSize:13.5, color:'#059669', animation:'slideUp 0.3s ease both' }}>
          <CheckCircle size={15} style={{ color:'#00d699' }} />
          Organization details updated successfully!
        </div>
      )}
      {error && (
        <div style={{ padding:'12px 18px', borderRadius:12, background:'rgba(244,63,94,0.08)', border:'1px solid rgba(244,63,94,0.25)', marginBottom:18, fontSize:13.5, color:'#f43f5e', animation:'slideUp 0.3s ease both' }}>
          {error}
        </div>
      )}

      {/* ══ Read-only info cards ══ */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:14, marginBottom:22 }}>
        {[
          {
            label:'Subscription Plan',
            value: org.subscription_plan ? org.subscription_plan.charAt(0).toUpperCase() + org.subscription_plan.slice(1) : '—',
            icon: Zap, color:'#f6d365',
          },
          { label:'Created',     value: fmt(org.created_at),                      icon: Calendar,   color:'#4facfe' },
          { label:'Last Updated',value: fmt(org.updated_at),                      icon: RefreshCw,  color:'#00b09b' },
          { label:'Created By',  value: org.created_by_name || currentUser?.name || '—', icon: User, color:'#f5576c' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              style={{
                padding:'14px 16px', borderRadius:14,
                background:'rgba(255,255,255,0.88)', backdropFilter:'blur(20px)',
                border:'1px solid rgba(255,255,255,0.9)',
                boxShadow:'0 2px 10px rgba(0,0,0,0.04)',
                animation:'slideUp 0.4s ease both',
              }}
            >
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                <div style={{ width:26, height:26, borderRadius:8, background:`${item.color}18`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Icon size={12} style={{ color:item.color }} />
                </div>
                <span style={{ fontSize:'0.68rem', fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.07em' }}>{item.label}</span>
              </div>
              <div style={{
                fontSize: '0.82rem',
                fontWeight: 700,
                color: '#111827',
                wordBreak: 'break-word'
              }}>{item.value}</div>
            </div>
          );
        })}
      </div>

      {/* ══ Editable plan / status info (read-only display) ══ */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:22 }}>
        {[
          {
            label:'Org ID',
            value: org.id || '—',
            icon: Hash, color:'#764ba2',
            desc: 'Your unique workspace identification token.',
            isMonospace: true,
          },
          {
            label:'Account Status',
            value: org.status ? org.status.charAt(0).toUpperCase() + org.status.slice(1) : '—',
            icon: Shield, color:'#00d699',
            desc: 'Managed by platform administrators.',
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              style={{
                padding:'18px 20px', borderRadius:16,
                background:'rgba(255,255,255,0.88)', backdropFilter:'blur(20px)',
                border:'1px solid rgba(255,255,255,0.9)',
                boxShadow:'0 2px 10px rgba(0,0,0,0.04)',
                display:'flex', alignItems:'center', gap:16,
              }}
            >
              <div style={{ width:42, height:42, borderRadius:13, background:`${item.color}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, border:`1px solid ${item.color}25` }}>
                <Icon size={18} style={{ color:item.color }} />
              </div>
              <div>
                <div style={{ fontSize:'0.7rem', fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:3 }}>{item.label}</div>
                <div style={{
                  fontSize: item.isMonospace ? '0.86rem' : '1rem',
                  fontWeight: 800,
                  color: '#111827',
                  fontFamily: item.isMonospace ? "'JetBrains Mono', monospace" : 'inherit',
                  letterSpacing: item.isMonospace ? '-0.02em' : 'normal',
                }}>{item.value}</div>
                <div style={{ fontSize:'0.7rem', color:'#c4cdd6', marginTop:2 }}>{item.desc}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ══ Editable form ══ */}
      <form
        onSubmit={isUserAdmin ? handleSave : (e) => e.preventDefault()}
        style={{
          background:'rgba(255,255,255,0.88)', backdropFilter:'blur(24px)',
          border:'1px solid rgba(255,255,255,0.9)',
          boxShadow:'0 4px 24px rgba(0,0,0,0.06)',
          borderRadius:20, padding:'28px 30px',
          animation:'slideUp 0.5s 0.12s cubic-bezier(0.22,1,0.36,1) both',
        }}
      >
        <div style={{ marginBottom:22 }}>
          <div style={{ fontSize:'0.98rem', fontWeight:800, color:'#0d1117', marginBottom:3 }}>
            {isUserAdmin ? 'Edit Organization Details' : 'Organization Details'}
          </div>
          <div style={{ fontSize:'0.78rem', color:'#9ca3af' }}>
            {isUserAdmin ? 'Update the organization name and workspace code' : 'View organization profile details'}
          </div>
        </div>

        {/* Organization Name */}
        <div style={{ marginBottom:20 }}>
          <label style={labelSt}>Organization Name</label>
          <div style={{ position:'relative' }}>
            <Building2 size={14} style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:'#00b09b', pointerEvents:'none' }} />
            <input
              type="text"
              required
              readOnly={!isUserAdmin}
              value={org.name || ''}
              onChange={(e) => setOrg((p) => ({ ...p, name: e.target.value }))}
              style={{
                ...inputSt,
                cursor: !isUserAdmin ? 'default' : 'text',
                background: !isUserAdmin ? '#f8fafc' : 'rgba(255,255,255,0.88)',
              }}
              placeholder="e.g. Acme Corporation"
              onFocus={isUserAdmin ? focusIn : undefined}
              onBlur={isUserAdmin ? focusOut : undefined}
            />
          </div>
        </div>

        {/* Workspace Code */}
        <div style={{ marginBottom:28 }}>
          <label style={labelSt}>Workspace Code</label>
          <div style={{ position:'relative' }}>
            <Hash size={14} style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:'#00b09b', pointerEvents:'none' }} />
            <input
              type="text"
              required
              readOnly={!isUserAdmin}
              value={org.code || ''}
              onChange={(e) => setOrg((p) => ({ ...p, code: e.target.value }))}
              style={{
                ...inputSt,
                cursor: !isUserAdmin ? 'default' : 'text',
                background: !isUserAdmin ? '#f8fafc' : 'rgba(255,255,255,0.88)',
              }}
              placeholder="e.g. ACME-001"
              onFocus={isUserAdmin ? focusIn : undefined}
              onBlur={isUserAdmin ? focusOut : undefined}
            />
          </div>
          <div style={{ fontSize:11.5, color:'#c4cdd6', marginTop:5, paddingLeft:2 }}>
            Must be unique across the platform.
          </div>
        </div>

        {/* Footer */}
        <div style={{ display:'flex', justifyContent:'flex-end', paddingTop:18, borderTop:'1px solid rgba(0,0,0,0.06)' }}>
          {isUserAdmin ? (
            <button
              type="submit"
              disabled={saving}
              style={{
                display:'inline-flex', alignItems:'center', gap:8,
                padding:'10px 24px', borderRadius:11, fontSize:13.5, fontWeight:700,
                cursor: saving ? 'not-allowed' : 'pointer', border:'none',
                background: saving ? '#e5e7eb' : 'linear-gradient(135deg, #00b09b, #4facfe)',
                color: saving ? '#9ca3af' : '#fff',
                boxShadow: saving ? 'none' : '0 4px 16px rgba(0,176,155,0.32)',
                transition:'all 0.2s ease',
              }}
            >
              <Save size={14} />
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          ) : (
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#94a3b8', padding: '6px 12px', background: '#f1f5f9', borderRadius: 8 }}>
              Read Only (Administrator Managed)
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

export default CompanyInfo;
