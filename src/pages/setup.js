import React, { useState, useContext, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ObjectDetail from './Setup/components/ObjectDetail';
import WorkspaceContext, { WorkspaceProvider } from '../context/WorkspaceContext';
import AIChatBotWidget from '../components/AIChatBotWidget';
import ObjectManager from './Setup/components/ObjectManager';
import UserManagement from './Setup/components/UserManagement';
import RoleManagement from './Setup/components/RoleManagement';
import RolesPermissions from './Setup/components/RolesPermissions';
import CompanyInfo from './Setup/components/CompanyInfo';
import Navbar from '../components/navbar';
import ValidationRulesPage from './workspace/ValidationRulesPage';
import FlowAutomations from './Setup/components/FlowAutomations';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Users, Shield, Boxes, Building2,
  FileText, ArrowLeft, Settings, Activity, TrendingUp,
  Clock, CheckCircle, Zap, Globe, Database, Lock,
  ArrowUpRight, Server, Cpu, Layers, ChevronRight, Workflow, LogOut,
} from 'lucide-react';

/* ─── Animated counter hook ─── */
function useCounter(target, duration = 1200, start = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime = null;
    const step = (ts) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return val;
}

/* ─── Animated KPI Card ─── */
function KpiCard({ value, label, sub, icon: Icon, gradient, glow, trend, sparkData, tab, onNavigate, delay = 0, isOrg }) {
  const [hovered, setHovered] = useState(false);
  const [mounted, setMounted] = useState(false);
  const numVal = parseInt(value) || 0;
  const counted = useCounter(numVal, 1200, mounted);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div
      onClick={() => onNavigate(tab)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 16, cursor: 'pointer', position: 'relative',
        background: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(20px)',
        boxShadow: hovered
          ? `0 0 0 2px ${glow}, 0 12px 32px -8px ${glow}35, 0 2px 8px rgba(0,0,0,0.06)`
          : `0 0 0 1.5px ${glow}35, 0 2px 12px -2px ${glow}18, 0 1px 3px rgba(0,0,0,0.04)`,
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'all 0.25s cubic-bezier(0.22,1,0.36,1)',
        animation: `slideUp 0.45s cubic-bezier(0.22,1,0.36,1) ${delay}ms both`,
      }}
    >
      <div style={{ padding: '18px 20px 16px' }}>
        {/* Icon + label row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: gradient,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              boxShadow: `0 4px 10px ${glow}30`,
              transition: 'transform 0.25s ease',
              transform: hovered ? 'scale(1.1)' : 'scale(1)',
            }}>
              <Icon size={15} style={{ color: '#fff' }} />
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6b7280' }}>{label}</span>
          </div>
          {trend && (
            <span style={{
              fontSize: '0.65rem', fontWeight: 700,
              color: '#059669', background: '#ecfdf5',
              padding: '2px 7px', borderRadius: 6,
              border: '1px solid #a7f3d0',
            }}>
              {trend}
            </span>
          )}
        </div>

        {/* Value */}
        {isOrg ? (
          <>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#111827', marginBottom: 2 }}>{value}</div>
            <div style={{ fontSize: '0.68rem', color: '#9ca3af' }}>{sub}</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#111827', lineHeight: 1, fontVariantNumeric: 'tabular-nums', marginBottom: 3 }}>
              {mounted ? counted : 0}
            </div>
            <div style={{ fontSize: '0.68rem', color: '#9ca3af' }}>{sub}</div>
          </>
        )}
      </div>

      {/* Bottom accent glow on hover */}
      {hovered && (
        <div style={{
          position: 'absolute', bottom: 0, left: '10%', right: '10%', height: 1,
          background: `linear-gradient(90deg, transparent, ${glow}60, transparent)`,
        }} />
      )}
    </div>
  );
}


function SignOutIconButton({ onClick }) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="Sign out"
      style={{
        background: hovered ? 'rgba(244,63,94,0.16)' : 'transparent',
        border: 'none',
        borderRadius: 8,
        width: 32,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: hovered ? '#f87185' : 'rgba(255,255,255,0.45)',
        transition: 'all 0.2s ease',
        flexShrink: 0,
      }}
    >
      <LogOut size={16} />
    </button>
  );
}


/* ─── Setup Component ─── */
function Setup() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedObject, setSelectedObject] = useState(null);
  const [dashboardMounted, setDashboardMounted] = useState(false);
  const location = useLocation();
  const ctx = useContext(WorkspaceContext) || {};
  const { company, currentUser } = ctx;
  const { logout, user } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

  // Read ?tab=xxx query param on load to jump directly to a tab
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [location.search]);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      const t = setTimeout(() => setDashboardMounted(true), 50);
      return () => clearTimeout(t);
    } else {
      setDashboardMounted(false);
    }
  }, [activeTab]);

  const handleNavigate = (tab) => {
    setActiveTab(tab);
    setSelectedObject(null);
  };

  const navGroups = [
    { id: 'main', items: [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
    {
      id: 'org', title: 'ORG SETTINGS',
      items: [
        { id: 'users', label: 'Users', icon: Users },
        { id: 'roles', label: 'Roles', icon: Shield },
        { id: 'general', label: 'General', icon: Settings },
      ],
    },
    {
      id: 'data', title: 'DATA MANAGEMENT',
      items: [
        { id: 'modules', label: 'Modules', icon: Boxes },
        { id: 'validation', label: 'Record Rules', icon: FileText },
        { id: 'automations', label: 'Flow Automations', icon: Workflow },
      ],
    },
  ];

  const kpiCards = [
    {
      value: company?.name || company?.company_name || 'Organization', label: 'Organization', sub: 'Enterprise · Active',
      icon: Building2, gradient: 'linear-gradient(135deg, #667eea, #764ba2)',
      glow: '#764ba2', tab: 'company', isOrg: true, delay: 0,
    },
    {
      value: '5', label: 'Custom Modules', sub: '+2 this quarter',
      icon: Boxes, gradient: 'linear-gradient(135deg, #00b09b, #96c93d)',
      glow: '#00b09b', tab: 'modules', trend: '+40%',
      sparkData: [3, 2, 4, 3, 5, 4, 5], delay: 80,
    },
    {
      value: '12', label: 'Team Members', sub: '3 online now',
      icon: Users, gradient: 'linear-gradient(135deg, #f093fb, #f5576c)',
      glow: '#f5576c', tab: 'users', trend: '+3',
      sparkData: [9, 11, 8, 13, 10, 14, 12], delay: 160,
    },
    {
      value: '3', label: 'Security Roles', sub: 'All policies active',
      icon: Shield, gradient: 'linear-gradient(135deg, #4facfe, #00f2fe)',
      glow: '#00f2fe', tab: 'roles', trend: '100%',
      sparkData: [2, 3, 1, 3, 2, 3, 3], delay: 240,
    },
  ];

  const quickActions = [
    { label: 'Manage Modules', desc: 'Fields & schemas', icon: Boxes, color: '#00b09b', bg: 'rgba(0,176,155,0.07)', tab: 'modules' },
    { label: 'User Management', desc: 'Roles & access', icon: Users, color: '#f5576c', bg: 'rgba(245,87,108,0.07)', tab: 'users' },
    { label: 'Security Roles', desc: 'Permissions', icon: Shield, color: '#4facfe', bg: 'rgba(79,172,254,0.07)', tab: 'roles' },
    { label: 'Company Profile', desc: 'Org settings', icon: Building2, color: '#764ba2', bg: 'rgba(118,75,162,0.07)', tab: 'company' },
    { label: 'Record Rules', desc: 'Field policies', icon: CheckCircle, color: '#f6d365', bg: 'rgba(246,211,101,0.07)', tab: 'validation' },
    { label: 'General Config', desc: 'Workspace prefs', icon: Settings, color: '#a18cd1', bg: 'rgba(161,140,209,0.07)', tab: 'general' },
  ];

  const healthItems = [
    { label: 'API Gateway', value: 'Operational', icon: Server, ok: true },
    { label: 'Database', value: 'Connected', icon: Database, ok: true },
    { label: 'Auth & SSO', value: 'Active', icon: Lock, ok: true },
    { label: 'CDN & Edge', value: 'Healthy', icon: Globe, ok: true },
  ];

  const activityFeed = [
    { action: 'Custom field added', target: 'Lead module', time: '2m ago', color: '#00b09b', icon: Boxes },
    { action: 'User invited', target: 'developer@team.io', time: '15m ago', color: '#f5576c', icon: Users },
    { action: 'Role permissions updated', target: 'Manager role', time: '1h ago', color: '#764ba2', icon: Shield },
    { action: 'Module schema modified', target: 'Deal module', time: '3h ago', color: '#4facfe', icon: Database },
    { action: 'Company settings saved', target: 'Org profile', time: 'Yesterday', color: '#f6d365', icon: Building2 },
  ];

  return (
    <WorkspaceProvider>
      <div className="orbit-root">
      <div className="orbit-bg-mesh" />
      <div className="app-shell">
        {/* ── Sidebar ── */}
        <aside style={{
          width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column',
          padding: '28px 16px', height: '100vh', position: 'sticky', top: 0,
          background: 'linear-gradient(180deg, #0d1117 0%, #0d1420 40%, #111827 100%)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          overflow: 'hidden', zIndex: 100
        }}>
        {/* Sidebar glow orb */}
        <div style={{ position: 'absolute', top: -60, left: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,176,155,0.12), transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,172,254,0.08), transparent 70%)', pointerEvents: 'none' }} />

        {/* Logo / Back */}
        <div style={{ padding: '0 8px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 20, position: 'relative', zIndex: 1 }}>
          <Link to="/workspace/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: '#fff', textDecoration: 'none', fontSize: '0.88rem', fontWeight: 700 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg, #00b09b, #4facfe)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowLeft size={15} style={{ color: '#fff' }} />
            </div>
            <span>CRM Setup Admin</span>
          </Link>
        </div>

        {/* Nav */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, overflowY: 'auto', position: 'relative', zIndex: 1 }}>
          {navGroups.map((group) => (
            <div key={group.id} style={{ marginBottom: 8 }}>
              {group.title && (
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '6px 12px', marginBottom: 4 }}>
                  {group.title}
                </div>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavigate(item.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 11,
                      padding: '10px 14px', borderRadius: 12, border: 'none',
                      width: '100%', textAlign: 'left', cursor: 'pointer',
                      fontSize: '0.85rem', fontWeight: isActive ? 600 : 400,
                      color: isActive ? '#fff' : 'rgba(255,255,255,0.55)',
                      background: isActive
                        ? 'linear-gradient(135deg, rgba(0,176,155,0.25), rgba(79,172,254,0.15))'
                        : 'transparent',
                      borderLeft: isActive ? '2px solid #00b09b' : '2px solid transparent',
                      transition: 'all 0.22s ease',
                      position: 'relative', overflow: 'hidden',
                    }}
                    onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; }}}
                    onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; }}}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                      background: isActive ? 'linear-gradient(135deg, #00b09b, #4facfe)' : 'rgba(255,255,255,0.06)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: isActive ? '0 4px 12px rgba(0,176,155,0.35)' : 'none',
                      transition: 'all 0.22s ease',
                    }}>
                      <Icon size={15} style={{ color: isActive ? '#fff' : 'rgba(255,255,255,0.5)' }} />
                    </div>
                    <span>{item.label}</span>
                    {isActive && <ChevronRight size={13} style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.4)' }} />}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar footer */}
        <div style={{ position: 'relative', zIndex: 1, padding: '16px 12px', borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #667eea, #764ba2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem', color: '#fff', flexShrink: 0 }}>
              {(() => {
                const name = user?.name || currentUser?.name || '';
                return name ? name.split(' ').filter(Boolean).map((n) => n[0]).join('').slice(0, 2).toUpperCase() : 'U';
              })()}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name || currentUser?.name || 'User'}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00d699', boxShadow: '0 0 6px rgba(0,214,153,0.6)' }} />
                <span style={{ fontSize: '0.7rem', color: '#00d699' }}>Online</span>
              </div>
            </div>
            <SignOutIconButton onClick={handleLogout} />
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="app-main">
        {/* Shared Navbar Header — same as workspace */}
        <header className="app-header">
          <Navbar onMenuToggle={() => {}} />
        </header>
        <main className="app-content orbit-scrollbar fade-in">
        {/* Global CSS animations */}
        <style>{`
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(24px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
          @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            33% { transform: translateY(-8px) rotate(1deg); }
            66% { transform: translateY(-4px) rotate(-1deg); }
          }
          @keyframes pulseGlow {
            0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(0,214,153,0.4); }
            50% { opacity: 0.7; box-shadow: 0 0 0 6px rgba(0,214,153,0); }
          }
          @keyframes rotateSlow {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes fadeSlideIn {
            from { opacity: 0; transform: translateX(-12px); }
            to { opacity: 1; transform: translateX(0); }
          }
          @keyframes particleDrift {
            0% { transform: translate(0, 0) scale(1); opacity: 0.6; }
            50% { transform: translate(10px, -20px) scale(1.1); opacity: 0.3; }
            100% { transform: translate(-5px, -35px) scale(0.9); opacity: 0; }
          }
        `}</style>

        {activeTab === 'dashboard' && (
          <div>
            {/* ══ Hero Banner ══ */}
            <div style={{
              borderRadius: 22, marginBottom: 24, position: 'relative', overflow: 'hidden',
              background: 'linear-gradient(135deg, #0d1117 0%, #0a1628 30%, #0d2137 55%, #0a2020 80%, #0d1117 100%)',
              padding: '28px 32px 24px',
              boxShadow: '0 20px 60px -16px rgba(0,176,155,0.18), 0 8px 32px -8px rgba(13,17,23,0.4)',
              animation: 'slideUp 0.6s cubic-bezier(0.22,1,0.36,1) both',
            }}>
              {/* Animated particle dots */}
              {[...Array(6)].map((_, i) => (
                <div key={i} style={{
                  position: 'absolute',
                  width: i % 2 === 0 ? 6 : 4,
                  height: i % 2 === 0 ? 6 : 4,
                  borderRadius: '50%',
                  background: ['#00b09b','#4facfe','#f5576c','#f6d365','#a18cd1','#00d699'][i],
                  top: `${[15, 65, 30, 80, 20, 70][i]}%`,
                  left: `${[75, 82, 88, 70, 94, 78][i]}%`,
                  animation: `particleDrift ${[3, 4, 3.5, 5, 4.5, 3.8][i]}s ease-in-out infinite ${[0, 0.8, 1.2, 0.4, 1.6, 0.2][i]}s`,
                }} />
              ))}
              {/* Glow orbs */}
              <div style={{ position: 'absolute', top: -80, right: 60, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,176,155,0.2), transparent 65%)', animation: 'float 7s ease-in-out infinite' }} />
              <div style={{ position: 'absolute', bottom: -60, right: 200, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,172,254,0.15), transparent 65%)', animation: 'float 9s ease-in-out infinite reverse' }} />
              <div style={{ position: 'absolute', top: 20, right: 340, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,87,108,0.1), transparent 65%)', animation: 'float 6s ease-in-out infinite 1s' }} />
              {/* Grid texture */}
              <div style={{ position: 'absolute', inset: 0, opacity: 0.03, backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

              <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  {/* Badge */}
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, background: 'rgba(0,176,155,0.12)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0,176,155,0.3)', marginBottom: 12, animation: 'fadeSlideIn 0.5s 0.1s both' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00d699', animation: 'pulseGlow 2s ease-in-out infinite' }} />
                    <Cpu size={11} style={{ color: '#00b09b' }} />
                    <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#00d699', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Enterprise Administration Console</span>
                  </div>
                  <h1 style={{ margin: '0 0 8px', fontSize: '1.5rem', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.02em', lineHeight: 1.15, animation: 'fadeSlideIn 0.5s 0.2s both' }}>
                    Setup & <span style={{ background: 'linear-gradient(90deg, #00b09b, #4facfe)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Administration</span>
                  </h1>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'rgba(255,255,255,0.48)', maxWidth: 480, lineHeight: 1.65, animation: 'fadeSlideIn 0.5s 0.3s both' }}>
                    Manage your CRM platform — configure modules, schemas, users, roles, and workspace settings.
                  </p>
                </div>

                {/* Right side stats */}
                <div style={{ display: 'flex', gap: 10, animation: 'fadeSlideIn 0.5s 0.4s both' }}>
                  {[
                    { v: '99.9%', l: 'Uptime', color: '#00b09b' },
                    { v: '24/7', l: 'Support', color: '#4facfe' },
                    { v: 'v2.4', l: 'Version', color: '#a18cd1' },
                  ].map((s) => (
                    <div key={s.l} style={{ padding: '12px 16px', borderRadius: 14, background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', minWidth: 72 }}>
                      <div style={{ fontSize: '1rem', fontWeight: 900, color: s.color, lineHeight: 1, marginBottom: 3 }}>{s.v}</div>
                      <div style={{ fontSize: '0.6rem', fontWeight: 600, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{s.l}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ══ KPI Row ══ */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, marginBottom: 24 }}>
              {kpiCards.map((card) => (
                <KpiCard key={card.label} {...card} onNavigate={handleNavigate} />
              ))}
            </div>

            {/* ══ Middle: Quick Actions + System ══ */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.45fr 1fr', gap: 20, marginBottom: 22 }}>
              {/* Quick Actions */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.78)', borderRadius: 22,
                backdropFilter: 'blur(24px)',
                border: '1px solid rgba(255,255,255,0.8)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 12px 40px -12px rgba(0,0,0,0.08)',
                padding: '26px 30px',
                animation: 'slideUp 0.6s 0.3s cubic-bezier(0.22,1,0.36,1) both',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
                  <div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0d1117' }}>Quick Actions</div>
                    <div style={{ fontSize: '0.75rem', color: '#8a9bb0', marginTop: 2 }}>Jump to common admin tasks</div>
                  </div>
                  <div style={{ width: 36, height: 36, borderRadius: 11, background: 'linear-gradient(135deg, #f6d365, #fda085)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(246,211,101,0.35)' }}>
                    <Zap size={16} style={{ color: '#fff' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {quickActions.map((a, i) => {
                    const Icon = a.icon;
                    return (
                      <div
                        key={a.label}
                        onClick={() => handleNavigate(a.tab)}
                        style={{
                          padding: '16px 18px', borderRadius: 16, cursor: 'pointer',
                          border: '1px solid rgba(0,0,0,0.05)',
                          background: a.bg,
                          display: 'flex', alignItems: 'center', gap: 13,
                          transition: 'all 0.25s cubic-bezier(0.22,1,0.36,1)',
                          animation: `slideUp 0.5s ${0.4 + i * 0.06}s cubic-bezier(0.22,1,0.36,1) both`,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 8px 24px ${a.color}20`; e.currentTarget.style.borderColor = `${a.color}30`; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.05)'; }}
                      >
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${a.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${a.color}20` }}>
                          <Icon size={18} style={{ color: a.color }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0d1117' }}>{a.label}</div>
                          <div style={{ fontSize: '0.7rem', color: '#8a9bb0', marginTop: 1 }}>{a.desc}</div>
                        </div>
                        <ArrowUpRight size={14} style={{ color: a.color, opacity: 0.5, flexShrink: 0 }} />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* System Health */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.78)', borderRadius: 22,
                backdropFilter: 'blur(24px)',
                border: '1px solid rgba(255,255,255,0.8)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 12px 40px -12px rgba(0,0,0,0.08)',
                padding: '26px 28px', display: 'flex', flexDirection: 'column',
                animation: 'slideUp 0.6s 0.4s cubic-bezier(0.22,1,0.36,1) both',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
                  <div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0d1117' }}>System Health</div>
                    <div style={{ fontSize: '0.75rem', color: '#8a9bb0', marginTop: 2 }}>Real-time status monitoring</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, background: 'rgba(0,214,153,0.08)', border: '1px solid rgba(0,214,153,0.2)' }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#00d699', animation: 'pulseGlow 2s ease-in-out infinite' }} />
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#00d699' }}>All Systems Go</span>
                  </div>
                </div>

                {/* Uptime ring */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '18px 20px', borderRadius: 16, background: 'linear-gradient(135deg, #f0fdf9, #e8f8ff)', border: '1px solid rgba(0,176,155,0.12)', marginBottom: 18 }}>
                  <div style={{ position: 'relative', width: 68, height: 68, flexShrink: 0 }}>
                    <svg width="68" height="68" viewBox="0 0 68 68">
                      <defs>
                        <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#00b09b" />
                          <stop offset="100%" stopColor="#4facfe" />
                        </linearGradient>
                      </defs>
                      <circle cx="34" cy="34" r="28" fill="none" stroke="rgba(0,176,155,0.12)" strokeWidth="6" />
                      <circle cx="34" cy="34" r="28" fill="none" stroke="url(#ringGrad)" strokeWidth="6"
                        strokeLinecap="round" strokeDasharray={`${0.999 * 175.93} 175.93`}
                        transform="rotate(-90 34 34)" />
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 900, color: '#0d1117' }}>99.9%</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0d1117' }}>Platform Uptime</div>
                    <div style={{ fontSize: '0.75rem', color: '#8a9bb0', marginTop: 3 }}>Last 30 days · 0 incidents</div>
                  </div>
                </div>

                {/* Status rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                  {healthItems.map((item, i) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '11px 14px', borderRadius: 13,
                          border: '1px solid rgba(0,0,0,0.04)',
                          background: '#fafcff',
                          transition: 'all 0.2s ease',
                          animation: `slideUp 0.4s ${0.5 + i * 0.06}s both`,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#fafcff'; e.currentTarget.style.boxShadow = 'none'; }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Icon size={14} style={{ color: '#8a9bb0' }} />
                          <span style={{ fontSize: '0.82rem', fontWeight: 500, color: '#374151' }}>{item.label}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#00d699', boxShadow: '0 0 6px rgba(0,214,153,0.5)' }} />
                          <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#00b09b' }}>{item.value}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ══ Bottom: Activity + Admin ══ */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.45fr 1fr', gap: 20 }}>
              {/* Activity Timeline */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.78)', borderRadius: 22,
                backdropFilter: 'blur(24px)',
                border: '1px solid rgba(255,255,255,0.8)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 12px 40px -12px rgba(0,0,0,0.08)',
                padding: '26px 30px',
                animation: 'slideUp 0.6s 0.5s cubic-bezier(0.22,1,0.36,1) both',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
                  <div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0d1117' }}>Recent Activity</div>
                    <div style={{ fontSize: '0.75rem', color: '#8a9bb0', marginTop: 2 }}>Latest admin operations</div>
                  </div>
                  <div style={{ width: 36, height: 36, borderRadius: 11, background: 'linear-gradient(135deg, #667eea, #764ba2)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(102,126,234,0.35)' }}>
                    <Clock size={16} style={{ color: '#fff' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {activityFeed.map((ev, idx) => {
                    const Icon = ev.icon;
                    return (
                      <div key={idx} style={{ display: 'flex', gap: 16, paddingBottom: idx < activityFeed.length - 1 ? 16 : 0, animation: `fadeSlideIn 0.4s ${0.6 + idx * 0.08}s both` }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 36, flexShrink: 0 }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: 11,
                            background: `${ev.color}10`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: `1.5px solid ${ev.color}25`, zIndex: 1,
                          }}>
                            <Icon size={15} style={{ color: ev.color }} />
                          </div>
                          {idx < activityFeed.length - 1 && (
                            <div style={{ width: 2, flex: 1, background: `linear-gradient(to bottom, ${ev.color}30, transparent)`, marginTop: 6, borderRadius: 1 }} />
                          )}
                        </div>
                        <div style={{ flex: 1, paddingTop: 6, paddingBottom: idx < activityFeed.length - 1 ? 8 : 0 }}>
                          <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#0d1117', lineHeight: 1.3 }}>{ev.action}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                            <span style={{ fontSize: '0.74rem', color: '#5a6b7e' }}>{ev.target}</span>
                            <span style={{ fontSize: '0.65rem', color: '#c4cdd6' }}>•</span>
                            <span style={{ fontSize: '0.72rem', color: '#a0acba' }}>{ev.time}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Admin + Environment */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {/* Admin Card */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.78)', borderRadius: 22,
                  backdropFilter: 'blur(24px)',
                  border: '1px solid rgba(255,255,255,0.8)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 12px 40px -12px rgba(0,0,0,0.08)',
                  padding: '26px 28px', position: 'relative', overflow: 'hidden',
                  animation: 'slideUp 0.6s 0.55s cubic-bezier(0.22,1,0.36,1) both',
                }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #00b09b, #4facfe, #f5576c)' }} />
                  <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,176,155,0.06), transparent 70%)' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: 18,
                      background: 'linear-gradient(135deg, #667eea, #764ba2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 900, fontSize: '1.1rem', color: '#fff',
                      boxShadow: '0 8px 24px rgba(102,126,234,0.4)', flexShrink: 0,
                    }}>
                      {(() => {
                        const name = user?.name || currentUser?.name || '';
                        return name ? name.split(' ').filter(Boolean).map((n) => n[0]).join('').slice(0, 2).toUpperCase() : 'U';
                      })()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 800, fontSize: '1rem', color: '#0d1117' }}>{user?.name || currentUser?.name || 'User'}</span>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00d699', boxShadow: '0 0 8px rgba(0,214,153,0.6)' }} />
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#8a9bb0', marginTop: 2 }}>{currentUser?.email || 'admin@org.com'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[
                      { k: 'Role', v: currentUser?.role || 'Administrator', color: '#667eea' },
                      { k: 'Status', v: '● Online', color: '#00d699' },
                    ].map((r) => (
                      <div key={r.k} style={{ padding: '12px 14px', borderRadius: 12, background: '#f8faff', border: '1px solid rgba(0,0,0,0.04)' }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#a0acba', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{r.k}</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: r.color, marginTop: 3 }}>{r.v}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Environment Card */}
                <div style={{
                  background: 'linear-gradient(135deg, #0d1117, #0a1628)',
                  borderRadius: 22, border: '1px solid rgba(255,255,255,0.06)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2), 0 12px 40px -12px rgba(0,0,0,0.3)',
                  padding: '22px 26px', flex: 1,
                  animation: 'slideUp 0.6s 0.6s cubic-bezier(0.22,1,0.36,1) both',
                  position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{ position: 'absolute', bottom: -30, right: -20, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,172,254,0.08), transparent 70%)' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <Layers size={16} style={{ color: '#4facfe' }} />
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff' }}>Environment</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      { k: 'Version', v: 'v2.4.1', color: '#00b09b' },
                      { k: 'Environment', v: 'Production', color: '#00d699' },
                      { k: 'Region', v: 'US-East-1', color: '#4facfe' },
                      { k: 'Last Deploy', v: 'Today, 11:30 AM', color: '#a18cd1' },
                    ].map((r) => (
                      <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <span style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.35)' }}>{r.k}</span>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: r.color, fontFamily: "'JetBrains Mono', monospace" }}>{r.v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {(activeTab === 'objects' || activeTab === 'deals' || activeTab === 'modules') && (
          selectedObject
            ? <ObjectDetail objectKey={selectedObject} onBack={() => setSelectedObject(null)} />
            : <ObjectManager onSelectObject={(key) => setSelectedObject(key)} />
        )}
        {activeTab === 'users' && <UserManagement />}
        {(activeTab === 'roles' || activeTab === 'profiles') && <RolesPermissions />}
        {activeTab === 'company' && <CompanyInfo />}
        {activeTab === 'general' && <CompanyInfo />}
        {activeTab === 'validation' && <ValidationRulesPage />}
        {activeTab === 'automations' && <FlowAutomations />}
      </main>
    </div>
  </div>
</div>

        {/* Global AI Chatbot Widget — Admin Setup Dashboard */}
        <AIChatBotWidget />
    </WorkspaceProvider>
  );
}

export default Setup;
