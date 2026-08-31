import React, { useState, useContext, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { apiGet } from '../api/client';
import ObjectDetail from './Setup/components/ObjectDetail';
import WorkspaceContext, { WorkspaceProvider } from '../context/WorkspaceContext';
import AIChatBotWidget from '../components/AIChatBotWidget';
import ObjectManager from './Setup/components/ObjectManager';
import UserManagement from './Setup/components/UserManagement';
import RolesPermissions from './Setup/components/RolesPermissions';
import CompanyInfo from './Setup/components/CompanyInfo';
import Navbar from '../components/navbar';
import ValidationRulesPage from './workspace/ValidationRulesPage';
import FlowAutomations from './Setup/components/FlowAutomations';
import AccessDenied from '../components/AccessDenied';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Users, Shield, Boxes, Building2,
  FileText, ArrowLeft, Settings, ShieldCheck, Sliders,
  Clock, CheckCircle, Zap, Globe, Database, Lock,
  ArrowUpRight, Server, Cpu, ChevronRight, Workflow, LogOut,
} from 'lucide-react';

/* ─── Format Relative Time ─── */
function formatRelativeTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (isNaN(diffMs)) return '';

  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 60) return 'Just now';

  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/* ─── Helper for formatting activity title, subtitle, color, and icon ─── */
function getActivityMeta(item) {
  const action = String(item.action || 'create').toLowerCase();
  const entityType = String(item.entityType || item.entity_type || 'general').toLowerCase();
  const entityName = item.entityName || item.entity_name || '';
  const moduleName = item.moduleName || item.module_name || '';
  const actorName = item.actorName || item.actor_name || '';

  let title = `${action.toUpperCase()} ${entityType}`;
  let color = '#4facfe';
  let Icon = Database;

  if (entityType === 'module' || entityType === 'object' || entityType === 'custom_module') {
    Icon = Boxes;
    color = '#00b09b';
    if (action === 'create') title = 'Custom module created';
    else if (action === 'update') title = 'Module schema modified';
    else if (action === 'delete') title = 'Custom module deleted';
  } else if (entityType === 'field' || entityType === 'custom_field') {
    Icon = FileText;
    color = '#00b09b';
    if (action === 'create') title = 'Custom field added';
    else if (action === 'update') title = 'Custom field updated';
    else if (action === 'delete') title = 'Custom field removed';
  } else if (entityType === 'user') {
    Icon = Users;
    color = '#f5576c';
    if (action === 'create') title = 'User invited';
    else if (action === 'update') title = 'User profile updated';
    else if (action === 'delete') title = 'User removed';
  } else if (entityType === 'role' || entityType === 'permission') {
    Icon = Shield;
    color = '#764ba2';
    if (action === 'create') title = 'Role created';
    else if (action === 'update') title = 'Role permissions updated';
    else if (action === 'delete') title = 'Role deleted';
  } else if (entityType === 'validation_rule' || entityType === 'rule') {
    Icon = ShieldCheck;
    color = '#a18cd1';
    if (action === 'create') title = 'Validation rule created';
    else if (action === 'update') title = 'Validation rule updated';
    else if (action === 'delete') title = 'Validation rule deleted';
  } else if (entityType === 'flow' || entityType === 'automation') {
    Icon = Workflow;
    color = '#ff9a9e';
    if (action === 'create') title = 'Automation flow created';
    else if (action === 'update') title = 'Automation flow updated';
    else if (action === 'delete') title = 'Automation flow deleted';
  } else if (entityType === 'organization' || entityType === 'company') {
    Icon = Building2;
    color = '#f6d365';
    if (action === 'update' || action === 'save') title = 'Company settings saved';
  }

  // Subtitle / target text
  let target = '';
  if (entityName && moduleName && entityName.toLowerCase() !== moduleName.toLowerCase()) {
    target = `${entityName} (${moduleName})`;
  } else if (entityName) {
    target = entityName;
  } else if (moduleName) {
    target = `${moduleName} module`;
  } else {
    target = 'System';
  }

  if (actorName && actorName !== 'User') {
    target = `${target} • ${actorName}`;
  }

  return { title, target, color, Icon };
}

/* ─── Interactive Gravitational Particle Field Canvas for Hero Banner ─── */
function HeroParticleCanvas({ containerRef }) {
  const canvasRef = React.useRef(null);
  const particlesRef = React.useRef([]);
  const animFrameIdRef = React.useRef(null);
  const mousePosRef = React.useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    // Respect prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');

    const colors = [
      { r: 0, g: 176, b: 155 },   // cyan/teal
      { r: 0, g: 214, b: 153 },   // mint
      { r: 79, g: 172, b: 254 },  // blue
      { r: 161, g: 140, b: 209 }, // purple
      { r: 255, g: 255, b: 255 }, // subtle white
    ];

    let dpr = window.devicePixelRatio || 1;
    let cssWidth = container.offsetWidth;
    let cssHeight = container.offsetHeight;

    const initParticles = () => {
      cssWidth = container.offsetWidth;
      cssHeight = container.offsetHeight;
      dpr = window.devicePixelRatio || 1;

      canvas.width = cssWidth * dpr;
      canvas.height = cssHeight * dpr;
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;

      // Distribute ~45 small round particles across the hero grid
      const count = 45;
      const newParticles = [];

      for (let i = 0; i < count; i++) {
        const ox = 24 + Math.random() * (cssWidth - 48);
        const oy = 18 + Math.random() * (cssHeight - 36);
        const color = colors[Math.floor(Math.random() * colors.length)];
        const radius = Math.random() * 1.5 + 1.2;

        newParticles.push({
          originX: ox,
          originY: oy,
          x: ox,
          y: oy,
          vx: 0,
          vy: 0,
          radius,
          color,
          baseAlpha: Math.random() * 0.25 + 0.2,
        });
      }

      particlesRef.current = newParticles;
    };

    initParticles();

    const handleResize = () => {
      initParticles();
    };

    window.addEventListener('resize', handleResize);

    const handleMouseMove = (e) => {
      const rect = container.getBoundingClientRect();
      mousePosRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const handleMouseLeave = () => {
      mousePosRef.current = { x: -9999, y: -9999 };
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);

    const influenceRadius = 140;

    const render = () => {
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, cssWidth, cssHeight);

      const mouse = mousePosRef.current;
      const mouseIn = mouse.x >= 0 && mouse.y >= 0;
      const particles = particlesRef.current;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        let targetX = p.originX;
        let targetY = p.originY;
        let influence = 0;

        if (mouseIn) {
          const dx = mouse.x - p.originX;
          const dy = mouse.y - p.originY;
          const distFromOrigin = Math.hypot(dx, dy);

          if (distFromOrigin < influenceRadius && distFromOrigin > 0.1) {
            influence = 1 - distFromOrigin / influenceRadius;
            // Smooth displacement toward cursor, scaled gracefully to avoid clustering
            const pullPower = Math.min(distFromOrigin * 0.45, influence * influence * 32);
            targetX = p.originX + (dx / distFromOrigin) * pullPower;
            targetY = p.originY + (dy / distFromOrigin) * pullPower;
          }
        }

        // Damped spring physics toward target position
        const ax = (targetX - p.x) * 0.08;
        const ay = (targetY - p.y) * 0.08;

        p.vx = (p.vx + ax) * 0.78;
        p.vy = (p.vy + ay) * 0.78;

        p.x += p.vx;
        p.y += p.vy;

        // Dynamic alpha glow when influenced by cursor
        const currentAlpha = Math.min(0.9, p.baseAlpha + influence * 0.45);
        const currentRadius = p.radius + influence * 0.5;

        ctx.beginPath();
        ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${currentAlpha})`;

        if (influence > 0.15) {
          ctx.shadowColor = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, 0.6)`;
          ctx.shadowBlur = 6 * influence;
        } else {
          ctx.shadowBlur = 0;
        }

        ctx.fill();
      }

      ctx.restore();
      animFrameIdRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [containerRef]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
        borderRadius: 22,
      }}
    />
  );
}

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
function KpiCard({ value, label, sub, icon: Icon, gradient, glow, tab, onNavigate, delay = 0 }) {
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
        </div>

        {/* Value */}
        <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#111827', lineHeight: 1, fontVariantNumeric: 'tabular-nums', marginBottom: 4 }}>
          {mounted ? counted : (parseInt(value) || 0)}
        </div>
        <div style={{ fontSize: '0.68rem', color: '#9ca3af' }}>{sub}</div>
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
  const [setupStats, setSetupStats] = useState({
    userCount: null,
    customModuleCount: null,
    customFieldCount: null,
    roleCount: null,
  });
  const [activities, setActivities] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState(null);

  const fetchRecentActivity = useCallback(async () => {
    try {
      setActivityLoading(true);
      setActivityError(null);
      const res = await apiGet('/setup/recent-activity').catch(() => apiGet('/api/setup/recent-activity'));
      const items = Array.isArray(res) ? res : (res?.activities || res?.data || []);
      setActivities(items);
    } catch (err) {
      console.error('Failed to load recent activity:', err);
      setActivityError('Unable to load recent activity');
      setActivities([]);
    } finally {
      setActivityLoading(false);
    }
  }, []);

  const location = useLocation();
  const navigate = useNavigate();
  const heroBannerRef = React.useRef(null);

  const [configData, setConfigData] = useState(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState(null);

  const fetchConfigurationOverview = useCallback(async () => {
    try {
      setConfigLoading(true);
      setConfigError(null);
      const res = await apiGet('/setup/configuration-overview').catch(() => apiGet('/api/setup/configuration-overview'));
      setConfigData(res || {});
    } catch (err) {
      console.error('Failed to load configuration overview:', err);
      setConfigError('Unable to load configuration');
      setConfigData(null);
    } finally {
      setConfigLoading(false);
    }
  }, []);

  const [userProfileData, setUserProfileData] = useState(null);
  const [userProfileLoading, setUserProfileLoading] = useState(true);
  const [userProfileError, setUserProfileError] = useState(null);

  const fetchCurrentUserProfile = useCallback(async () => {
    try {
      setUserProfileLoading(true);
      setUserProfileError(null);
      const res = await apiGet('/setup/current-user').catch(() => apiGet('/api/setup/current-user'));
      setUserProfileData(res || {});
    } catch (err) {
      console.error('Failed to load current user profile:', err);
      setUserProfileError('Unable to load user profile');
      setUserProfileData(null);
    } finally {
      setUserProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigurationOverview();
    fetchRecentActivity();
    fetchCurrentUserProfile();
  }, [fetchConfigurationOverview, fetchRecentActivity, fetchCurrentUserProfile]);
  const ctx = useContext(WorkspaceContext) || {};
  const { currentUser } = ctx;
  const { logout, user } = useAuth();
  const userRole = String(user?.role || currentUser?.role || '').toLowerCase();
  const isAdmin = userRole.includes('admin') || userRole.includes('administrator');

  useEffect(() => {
    let isMounted = true;
    async function loadSetupCounts() {
      try {
        const [uData, rData, metaData] = await Promise.all([
          apiGet('/users').catch(() => []),
          apiGet('/roles').catch(() => apiGet('/api/roles')).catch(() => []),
          apiGet('/workspace/metadata').catch(() => ({})),
        ]);

        if (!isMounted) return;

        const userList = Array.isArray(uData) ? uData : uData?.data || [];
        const roleList = Array.isArray(rData) ? rData : rData?.data || [];
        const objectsObj = metaData?.objectTypes || {};

        let customModCount = 0;
        let customFldCount = 0;

        Object.keys(objectsObj).forEach((key) => {
          const obj = objectsObj[key];
          const lowerKey = key.toLowerCase();

          const isCustomMod = Boolean(
            obj?.is_custom === true ||
            lowerKey.endsWith('__c') ||
            (obj && !obj.is_system && obj.organization_id !== null && !['lead', 'company', 'contact', 'deal'].includes(lowerKey))
          );

          if (isCustomMod) {
            customModCount++;
          }

          if (Array.isArray(obj?.fields)) {
            obj.fields.forEach((f) => {
              const fName = String(f.api_name || f.name || '').toLowerCase();
              if (f.is_custom === true || fName.endsWith('__c')) {
                customFldCount++;
              }
            });
          }
        });

        setSetupStats({
          userCount: userList.length,
          roleCount: roleList.length,
          customModuleCount: customModCount,
          customFieldCount: customFldCount,
        });
      } catch (err) {
        console.warn('Failed to load setup KPI counts:', err);
      }
    }
    loadSetupCounts();
    return () => { isMounted = false; };
  }, []);

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

  const userVal = setupStats.userCount ?? 0;
  const customModVal = setupStats.customModuleCount ?? 0;
  const customFldVal = setupStats.customFieldCount ?? 0;
  const roleVal = setupStats.roleCount ?? 0;

  const userRoleStr = String(user?.role || currentUser?.role || currentUser?.role_name || userProfileData?.role_name || userProfileData?.role || '').toLowerCase();
  const isAdministrator = userRoleStr.includes('admin') || userRoleStr.includes('administrator');
  const isCrmManager = userRoleStr === 'crm manager' || (userRoleStr.includes('manager') && !userRoleStr.includes('clone') && !userRoleStr.includes('relationship'));
  const isCrmManagerClone = userRoleStr.includes('clone');
  const isCrmExecutive = userRoleStr.includes('executive');
  const isRelationshipManager = userRoleStr.includes('relationship');
  const isReadOnlyUser = userRoleStr.includes('read only') || userRoleStr.includes('viewer');

  const kpiCards = [
    {
      value: String(userVal),
      label: 'Team Members',
      sub: setupStats.userCount !== null ? `${userVal} users configured` : 'Users configured',
      icon: Users,
      gradient: 'linear-gradient(135deg, #f093fb, #f5576c)',
      glow: '#f5576c',
      tab: 'users',
      delay: 0,
    },
    {
      value: String(customModVal),
      label: 'Custom Modules',
      sub: 'Custom modules',
      icon: Boxes,
      gradient: 'linear-gradient(135deg, #00b09b, #96c93d)',
      glow: '#00b09b',
      tab: 'modules',
      delay: 80,
    },
    {
      value: String(customFldVal),
      label: 'Custom Fields',
      sub: 'Across all modules',
      icon: FileText,
      gradient: 'linear-gradient(135deg, #667eea, #764ba2)',
      glow: '#764ba2',
      tab: 'modules',
      delay: 160,
    },
    {
      value: String(roleVal),
      label: 'Security Roles',
      sub: 'Configured roles',
      icon: Shield,
      gradient: 'linear-gradient(135deg, #4facfe, #00f2fe)',
      glow: '#00f2fe',
      tab: 'roles',
      delay: 240,
    },
  ];

  const getQuickActionsForRole = () => {
    if (isAdministrator) {
      return [
        { label: 'Manage Modules', desc: 'Fields & schemas', icon: Boxes, color: '#00b09b', bg: 'rgba(0,176,155,0.07)', tab: 'modules', badge: 'Full Access' },
        { label: 'User Management', desc: 'Roles & access', icon: Users, color: '#f5576c', bg: 'rgba(245,87,108,0.07)', tab: 'users', badge: 'Full Access' },
        { label: 'Security Roles', desc: 'Permissions & hierarchy', icon: Shield, color: '#4facfe', bg: 'rgba(79,172,254,0.07)', tab: 'roles', badge: 'Full Access' },
        { label: 'Company Profile', desc: 'Org settings', icon: Building2, color: '#764ba2', bg: 'rgba(118,75,162,0.07)', tab: 'company', badge: 'Admin' },
        { label: 'Record Rules', desc: 'Field policies', icon: CheckCircle, color: '#f6d365', bg: 'rgba(246,211,101,0.07)', tab: 'validation', badge: 'Full Access' },
        { label: 'General Config', desc: 'Workspace prefs', icon: Settings, color: '#a18cd1', bg: 'rgba(161,140,209,0.07)', tab: 'general', badge: 'Admin' },
      ];
    } else if (isCrmManager || isCrmManagerClone) {
      return [
        { label: 'User Management', desc: 'Manage subordinate users', icon: Users, color: '#f5576c', bg: 'rgba(245,87,108,0.07)', tab: 'users', badge: 'Subordinate Scope' },
        { label: 'Security Roles', desc: 'Subordinate permissions', icon: Shield, color: '#4facfe', bg: 'rgba(79,172,254,0.07)', tab: 'roles', badge: 'Subordinate Scope' },
        { label: 'Manage Modules', desc: 'Fields & schemas', icon: Boxes, color: '#00b09b', bg: 'rgba(0,176,155,0.07)', tab: 'modules', badge: 'Custom Fields' },
        { label: 'Record Rules', desc: 'Field policies', icon: CheckCircle, color: '#f6d365', bg: 'rgba(246,211,101,0.07)', tab: 'validation', badge: 'Manager' },
        { label: 'Company Profile', desc: 'Org profile', icon: Building2, color: '#764ba2', bg: 'rgba(118,75,162,0.07)', tab: 'company', badge: 'Read Only' },
        { label: 'General Config', desc: 'Workspace prefs', icon: Settings, color: '#a18cd1', bg: 'rgba(161,140,209,0.07)', tab: 'general', badge: 'Read Only' },
      ];
    } else if (isCrmExecutive || isRelationshipManager) {
      return [
        { label: 'User Directory', desc: 'View team members', icon: Users, color: '#f5576c', bg: 'rgba(245,87,108,0.07)', tab: 'users', badge: 'View Only' },
        { label: 'Security Roles', desc: 'View role hierarchy', icon: Shield, color: '#4facfe', bg: 'rgba(79,172,254,0.07)', tab: 'roles', badge: 'View Only' },
        { label: 'Modules & Fields', desc: 'View schema definitions', icon: Boxes, color: '#00b09b', bg: 'rgba(0,176,155,0.07)', tab: 'modules', badge: 'View Only' },
        { label: 'Record Rules', desc: 'View validation rules', icon: CheckCircle, color: '#f6d365', bg: 'rgba(246,211,101,0.07)', tab: 'validation', badge: 'View Only' },
        { label: 'Company Profile', desc: 'Org profile details', icon: Building2, color: '#764ba2', bg: 'rgba(118,75,162,0.07)', tab: 'company', badge: 'Read Only' },
      ];
    } else {
      // Read Only User
      return [
        { label: 'User Directory', desc: 'View team directory', icon: Users, color: '#f5576c', bg: 'rgba(245,87,108,0.07)', tab: 'users', badge: 'Read Only' },
        { label: 'Security Roles', desc: 'View role structure', icon: Shield, color: '#4facfe', bg: 'rgba(79,172,254,0.07)', tab: 'roles', badge: 'Read Only' },
        { label: 'Modules', desc: 'View active modules', icon: Boxes, color: '#00b09b', bg: 'rgba(0,176,155,0.07)', tab: 'modules', badge: 'Read Only' },
        { label: 'Record Rules', desc: 'View active rules', icon: CheckCircle, color: '#f6d365', bg: 'rgba(246,211,101,0.07)', tab: 'validation', badge: 'Read Only' },
        { label: 'Company Profile', desc: 'Org info', icon: Building2, color: '#764ba2', bg: 'rgba(118,75,162,0.07)', tab: 'company', badge: 'Read Only' },
      ];
    }
  };

  const quickActions = getQuickActionsForRole();

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
                    {isActive && item.id !== 'dashboard' && <ChevronRight size={13} style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.4)' }} />}
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
            <div
              ref={heroBannerRef}
              style={{
                borderRadius: 22, marginBottom: 24, position: 'relative', overflow: 'hidden',
                background: 'linear-gradient(135deg, #0d1117 0%, #0a1628 30%, #0d2137 55%, #0a2020 80%, #0d1117 100%)',
                padding: '28px 32px 24px',
                boxShadow: '0 20px 60px -16px rgba(0,176,155,0.18), 0 8px 32px -8px rgba(13,17,23,0.4)',
                animation: 'slideUp 0.6s cubic-bezier(0.22,1,0.36,1) both',
              }}
            >
              {/* Interactive cursor-following canvas particle field */}
              <HeroParticleCanvas containerRef={heroBannerRef} />

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
                    <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#00d699', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                      {userRoleStr ? `${userRoleStr.toUpperCase()} CONSOLE` : 'ADMINISTRATION CONSOLE'}
                    </span>
                  </div>
                  <h1 style={{ margin: '0 0 8px', fontSize: '1.5rem', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.02em', lineHeight: 1.15, animation: 'fadeSlideIn 0.5s 0.2s both' }}>
                    Setup & <span style={{ background: 'linear-gradient(90deg, #00b09b, #4facfe)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Administration</span>
                  </h1>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'rgba(255,255,255,0.48)', maxWidth: 480, lineHeight: 1.65, animation: 'fadeSlideIn 0.5s 0.3s both' }}>
                    Manage your CRM platform — configure modules, schemas, users, roles, and workspace settings.
                  </p>
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0d1117' }}>{a.label}</div>
                            {a.badge && (
                              <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: `${a.color}18`, color: a.color, border: `1px solid ${a.color}30` }}>
                                {a.badge}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#8a9bb0', marginTop: 1 }}>{a.desc}</div>
                        </div>
                        <ArrowUpRight size={14} style={{ color: a.color, opacity: 0.5, flexShrink: 0 }} />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Configuration Overview */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.78)', borderRadius: 22,
                backdropFilter: 'blur(24px)',
                border: '1px solid rgba(255,255,255,0.8)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 12px 40px -12px rgba(0,0,0,0.08)',
                padding: '26px 28px', display: 'flex', flexDirection: 'column',
                animation: 'slideUp 0.6s 0.4s cubic-bezier(0.22,1,0.36,1) both',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0d1117' }}>Configuration Overview</div>
                    <div style={{ fontSize: '0.75rem', color: '#8a9bb0', marginTop: 2 }}>Current CRM configuration</div>
                  </div>
                  <div style={{
                    width: 36, height: 36, borderRadius: 11,
                    background: 'linear-gradient(135deg, #00b09b, #4facfe)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 14px rgba(0,176,155,0.3)'
                  }}>
                    <Sliders size={16} style={{ color: '#fff' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                  {configLoading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 0' }}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <div key={n} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 13, background: '#f8fafc' }}>
                          <div style={{ height: 14, width: '40%', borderRadius: 4, background: '#e2e8f0' }} />
                          <div style={{ height: 14, width: '15%', borderRadius: 4, background: '#cbd5e1' }} />
                        </div>
                      ))}
                    </div>
                  ) : configError ? (
                    <div style={{ padding: '24px 16px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: '0.85rem', color: '#ef4444', fontWeight: 600 }}>{configError}</span>
                      <button
                        type="button"
                        onClick={fetchConfigurationOverview}
                        style={{
                          padding: '6px 14px', borderRadius: 8, border: '1px solid #cbd5e1',
                          background: '#fff', fontSize: '0.78rem', fontWeight: 600, color: '#475569', cursor: 'pointer'
                        }}
                      >
                        Retry
                      </button>
                    </div>
                  ) : (
                    [
                      { label: 'Modules', key: 'modules', icon: Boxes, color: '#00b09b', onClick: () => setActiveTab('modules') },
                      { label: 'Fields', key: 'fields', icon: FileText, color: '#4facfe', onClick: () => setActiveTab('modules') },
                      { label: 'Record Rules', key: 'recordRules', icon: ShieldCheck, color: '#a18cd1', onClick: () => setActiveTab('validation') },
                      { label: 'Automations', key: 'automations', icon: Workflow, color: '#ff9a9e', onClick: () => setActiveTab('automations') },
                      { label: 'Forms', key: 'forms', icon: FileText, color: '#f5576c', onClick: () => navigate('/forms') },
                    ].map((item) => {
                      const Icon = item.icon;
                      const val = configData?.[item.key] ?? 0;
                      return (
                        <div
                          key={item.label}
                          onClick={item.onClick}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '11px 14px', borderRadius: 13,
                            border: '1px solid rgba(0,0,0,0.04)',
                            background: '#fafcff',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#ffffff';
                            e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)';
                            e.currentTarget.style.borderColor = `${item.color}40`;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#fafcff';
                            e.currentTarget.style.boxShadow = 'none';
                            e.currentTarget.style.borderColor = 'rgba(0,0,0,0.04)';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 28, height: 28, borderRadius: 8,
                              background: `${item.color}12`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                              <Icon size={14} style={{ color: item.color }} />
                            </div>
                            <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#1e293b' }}>{item.label}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>{val}</span>
                            <ChevronRight size={14} style={{ color: '#94a3b8' }} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* ══ Bottom: Activity + Current User ══ */}
            <div className="setup-lower-grid">
              {/* Activity Timeline (~60-65% width on desktop) */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.78)', borderRadius: 22,
                backdropFilter: 'blur(24px)',
                border: '1px solid rgba(255,255,255,0.8)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 12px 40px -12px rgba(0,0,0,0.08)',
                padding: '26px 28px',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                animation: 'slideUp 0.6s 0.5s cubic-bezier(0.22,1,0.36,1) both',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0d1117' }}>Recent Activity</div>
                    <div style={{ fontSize: '0.75rem', color: '#8a9bb0', marginTop: 2 }}>Latest admin operations</div>
                  </div>
                  <div style={{ width: 36, height: 36, borderRadius: 11, background: 'linear-gradient(135deg, #667eea, #764ba2)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(102,126,234,0.35)' }}>
                    <Clock size={16} style={{ color: '#fff' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
                  {activityLoading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '8px 0' }}>
                      {[1, 2, 3, 4].map((n) => (
                        <div key={n} style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                          <div style={{ width: 32, height: 32, borderRadius: 10, background: '#f1f5f9' }} />
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                            <div style={{ height: 13, width: '55%', borderRadius: 4, background: '#f1f5f9' }} />
                            <div style={{ height: 10, width: '40%', borderRadius: 4, background: '#f8fafc' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : activityError ? (
                    <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 500 }}>
                      {activityError}
                    </div>
                  ) : activities.length === 0 ? (
                    <div style={{ padding: '28px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>
                      No recent activity
                    </div>
                  ) : (
                    activities.slice(0, 4).map((item, idx, list) => {
                      const { title, target, actorName, color, Icon } = getActivityMeta(item);
                      const relativeTime = formatRelativeTime(item.createdAt || item.created_at);
                      const metaText = [target, actorName && actorName !== 'User' ? actorName : null, relativeTime].filter(Boolean).join(' • ');

                      return (
                        <div key={item.id || idx} style={{ display: 'flex', gap: 14, paddingBottom: idx < list.length - 1 ? 14 : 0, animation: `fadeSlideIn 0.4s ${0.1 + idx * 0.05}s both` }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 32, flexShrink: 0 }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: 10,
                              background: `${color}10`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              border: `1.5px solid ${color}25`, zIndex: 1,
                            }}>
                              <Icon size={14} style={{ color: color }} />
                            </div>
                            {idx < list.length - 1 && (
                              <div style={{ width: 2, flex: 1, background: `linear-gradient(to bottom, ${color}30, transparent)`, marginTop: 4, borderRadius: 1 }} />
                            )}
                          </div>
                          <div style={{ flex: 1, paddingTop: 3, paddingBottom: idx < list.length - 1 ? 6 : 0, minWidth: 0 }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0d1117', lineHeight: 1.3 }}>{title}</div>
                            <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {metaText}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Current User Card (~35-40% width on desktop) */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.78)', borderRadius: 22,
                backdropFilter: 'blur(24px)',
                border: '1px solid rgba(255,255,255,0.8)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 12px 40px -12px rgba(0,0,0,0.08)',
                padding: '24px 26px', position: 'relative', overflow: 'hidden',
                display: 'flex', flexDirection: 'column', gap: 14,
                animation: 'slideUp 0.6s 0.55s cubic-bezier(0.22,1,0.36,1) both',
              }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #00b09b, #4facfe, #764ba2)' }} />
                
                {userProfileLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0' }}>
                    <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                      <div style={{ width: 44, height: 44, borderRadius: 14, background: '#f1f5f9' }} />
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ height: 14, width: '60%', borderRadius: 4, background: '#f1f5f9' }} />
                        <div style={{ height: 10, width: '40%', borderRadius: 4, background: '#f8fafc' }} />
                      </div>
                    </div>
                    <div style={{ height: 32, borderRadius: 8, background: '#f1f5f9' }} />
                    <div style={{ height: 32, borderRadius: 8, background: '#f1f5f9' }} />
                  </div>
                ) : userProfileError ? (
                  <div style={{ padding: '18px 16px', textAlign: 'center', color: '#ef4444', fontSize: '0.85rem', fontWeight: 500 }}>
                    {userProfileError}
                  </div>
                ) : (
                  <>
                    <div>
                      <div style={{ fontSize: '0.70rem', fontWeight: 800, color: '#8a9bb0', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                        CURRENT USER & ACCESS
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{
                          width: 46, height: 46, borderRadius: 14,
                          background: 'linear-gradient(135deg, #667eea, #764ba2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 800, fontSize: '0.98rem', color: '#fff',
                          boxShadow: '0 6px 18px rgba(102,126,234,0.35)', flexShrink: 0,
                        }}>
                          {userProfileData?.avatar || 'U'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontWeight: 800, fontSize: '0.96rem', color: '#0d1117', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {userProfileData?.name || user?.name || currentUser?.name || 'User'}
                            </span>
                            <div style={{
                              width: 7, height: 7, borderRadius: '50%',
                              background: userProfileData?.status === 'inactive' ? '#ef4444' : '#00d699',
                              boxShadow: `0 0 6px ${userProfileData?.status === 'inactive' ? 'rgba(239,68,68,0.5)' : 'rgba(0,214,153,0.5)'}`,
                              flexShrink: 0
                            }} />
                          </div>
                          <div style={{ fontSize: '0.76rem', color: '#8a9bb0', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {userProfileData?.email || user?.email || currentUser?.email || ''}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, background: '#fafcff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.04)', padding: '11px 13px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#8a9bb0' }}>Role</span>
                        <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#667eea', background: 'rgba(102,126,234,0.08)', padding: '2px 8px', borderRadius: 6 }}>
                          {userProfileData?.roleName || 'User'}
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#8a9bb0' }}>Account Status</span>
                        <span style={{ fontSize: '0.76rem', fontWeight: 700, color: userProfileData?.status === 'inactive' ? '#ef4444' : '#00b09b', textTransform: 'capitalize' }}>
                          ● {userProfileData?.status ? (userProfileData.status.charAt(0).toUpperCase() + userProfileData.status.slice(1)) : 'Active'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#8a9bb0' }}>Record Access</span>
                        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#1e293b', textAlign: 'right', maxWidth: '62%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {userProfileData?.recordAccess || 'Assigned Records'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#8a9bb0' }}>Configuration</span>
                        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#1e293b', textAlign: 'right', maxWidth: '62%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {userProfileData?.configurationAccess || 'Restricted'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#8a9bb0' }}>Last Login</span>
                        <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b' }}>
                          {formatRelativeTime(userProfileData?.lastLoginAt) || 'Just now'}
                        </span>
                      </div>
                    </div>
                  </>
                )}
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
