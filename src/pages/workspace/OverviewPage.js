import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { apiGet, apiPost, apiDelete } from '../../api/client';
import AccessDenied from '../../components/AccessDenied';
import {
  Users,
  Columns3,
  Search,
  TrendingUp,
  TrendingDown,
  MoreHorizontal,
  Mail,
  Phone,
  ArrowUpRight,
  SlidersHorizontal,
  Plus,
  Calendar,
  Download,
  UploadCloud,
  Upload,
  X,
  Check,
  FileSpreadsheet,
  CheckCircle2,
  Camera,
  QrCode,
  User,
  Building2,
  Briefcase,
  Shield,
  FileText,
  AlertTriangle,
  RefreshCw,
  UserPlus,
  Sparkles,
  ArrowRight,
  CheckSquare,
  Trash2,
  PlusCircle,
  Clock,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

/* ---------------------------------- THEME & COLORS ---------------------------------- */

const COLOR = {
  indigo: '#6366f1',
  cyan: '#22d3ee',
  violet: '#a78bfa',
  success: '#34d399',
  warning: '#fbbf24',
  danger: '#fb7185',
  textDim: '#6b7290',
};

const revenueData = [
  { m: 'Feb', v: 62 },
  { m: 'Mar', v: 71 },
  { m: 'Apr', v: 68 },
  { m: 'May', v: 84 },
  { m: 'Jun', v: 90 },
  { m: 'Jul', v: 112 },
];

const stageOrder = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won'];
const stageColors = {
  Lead: COLOR.textDim,
  Qualified: COLOR.violet,
  Proposal: COLOR.indigo,
  Negotiation: COLOR.warning,
  Won: COLOR.success,
};

const BADGE_TEXT = {
  [COLOR.indigo]: '#4338ca',
  [COLOR.cyan]: '#0e7490',
  [COLOR.violet]: '#6d28d9',
  [COLOR.success]: '#047857',
  [COLOR.warning]: '#b45309',
  [COLOR.danger]: '#be123c',
  [COLOR.textDim]: '#4b5170',
};

const Avatar = ({ initials, size = 34 }) => (
  <div
    className="grad-border"
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      background: 'rgba(99,102,241,0.08)',
      fontSize: size * 0.36,
      fontWeight: 600,
    }}
  >
    <div style={{ borderRadius: '50%', position: 'relative', color: '#1c2033' }}>{initials}</div>
  </div>
);

const Badge = ({ color, children }) => (
  <span
    className="badge"
    style={{
      color: BADGE_TEXT[color] || color,
      background: `${color}22`,
      border: `1px solid ${color}45`,
      borderRadius: '20px',
      padding: '4px 12px',
      fontWeight: 600,
      fontSize: '11.5px',
    }}
  >
    {children}
  </span>
);

/* Signature element: Orbit progress ring with orbiting marker */
const OrbitRing = ({ percent = 68, size = 132 }) => {
  const r = size / 2 - 10;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;
  const angle = (percent / 100) * 360 - 90;
  const cx = size / 2,
    cy = size / 2;
  const mx = cx + r * Math.cos((angle * Math.PI) / 180);
  const my = cy + r * Math.sin((angle * Math.PI) / 180);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <linearGradient id="orbitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={COLOR.indigo} />
          <stop offset="55%" stopColor={COLOR.violet} />
          <stop offset="100%" stopColor={COLOR.cyan} />
        </linearGradient>
        <filter id="orbitGlow">
          <feGaussianBlur stdDeviation="3.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(99,102,241,0.12)" strokeWidth="8" />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="url(#orbitGrad)"
        strokeWidth="8"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <circle cx={mx} cy={my} r="6" fill="#fff" filter="url(#orbitGlow)" />
      <text x={cx} y={cy - 3} textAnchor="middle" fontSize="24" fontWeight="700" fill="#1c2033" fontFamily="Inter">
        {percent}%
      </text>
      <text x={cx} y={cy + 16} textAnchor="middle" fontSize="10.5" fill="#6b7290" fontFamily="Inter">
        of Q3 goal
      </text>
    </svg>
  );
};

const StatCard = ({ label, value, delta, up, icon: Icon }) => (
  <div className="glass glass-hover" style={{ padding: '18px 20px', flex: 1, minWidth: 0 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <span style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{label}</span>
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--aurora-soft)',
        }}
      >
        <Icon size={14} style={{ color: COLOR.cyan }} />
      </div>
    </div>
    <div style={{ fontSize: 25, fontWeight: 700, marginTop: 12, letterSpacing: '-0.02em', color: '#1c2033', fontFamily: 'Inter' }}>
      {value}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 12, color: up ? '#047857' : '#be123c' }}>
      {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
      {delta} <span style={{ color: 'var(--text-faint)' }}>vs last month</span>
    </div>
  </div>
);

const RevenueChart = () => (
  <div style={{ height: 190 }}>
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={revenueData} margin={{ top: 6, right: 4, left: -24, bottom: 0 }}>
        <defs>
          <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLOR.indigo} stopOpacity={0.45} />
            <stop offset="100%" stopColor={COLOR.cyan} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="m" tick={{ fill: '#6b7290', fontSize: 11, fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#6b7290', fontSize: 11, fontFamily: 'Inter' }} axisLine={false} tickLine={false} width={28} tickFormatter={(v) => `${v}k`} />
        <Tooltip
          contentStyle={{
            background: '#ffffff',
            border: '1px solid rgba(99,102,241,0.18)',
            borderRadius: 10,
            fontSize: 12,
            boxShadow: '0 8px 24px -6px rgba(76,81,191,0.25)',
            fontFamily: 'Inter',
          }}
          labelStyle={{ color: '#1c2033' }}
          itemStyle={{ color: '#4338ca' }}
          formatter={(v) => [`$${v}k`, 'Revenue']}
        />
        <Area type="monotone" dataKey="v" stroke={COLOR.cyan} strokeWidth={2.4} fill="url(#revFill)" />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

/* ─── Dashboard colour palette ─── */
const D = {
  rose:   '#f43f5e',
  amber:  '#f59e0b',
  jade:   '#10b981',
  sky:    '#38bdf8',
  purple: '#a855f7',
  bg:     '#0f0f1a',
};

/* ─── Animated counter ─── */
function useDCount(target, dur = 1400) {
  const [v, setV] = React.useState(0);
  const [go, setGo] = React.useState(false);
  React.useEffect(() => { const t = setTimeout(() => setGo(true), 200); return () => clearTimeout(t); }, []);
  React.useEffect(() => {
    if (!go) return;
    let s = null;
    const step = (ts) => {
      if (!s) s = ts;
      const p = Math.min((ts - s) / dur, 1);
      setV(Math.floor((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [go, target, dur]);
  return v;
}

/* ─── Dashboard revenue chart with custom colours ─── */
const DRevenueChart = ({ data = [] }) => (
  <div style={{ height: 210 }}>
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data.length > 0 ? data : revenueData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="dRevFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={D.jade} stopOpacity={0.35} />
            <stop offset="100%" stopColor={D.jade} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="m"
          tick={{ fill: '#9ca3af', fontSize: 11, fontFamily: 'Inter' }}
          axisLine={false}
          tickLine={false}
          interval={data.length > 15 ? 4 : 'preserveStartEnd'}
        />
        <YAxis
          tick={{ fill: '#9ca3af', fontSize: 11, fontFamily: 'Inter' }}
          axisLine={false}
          tickLine={false}
          width={40}
          tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`)}
        />
        <Tooltip
          contentStyle={{ background: '#fff', border: `1px solid ${D.jade}25`, borderRadius: 10, fontSize: 12, boxShadow: `0 8px 24px -6px ${D.jade}30`, fontFamily: 'Inter' }}
          labelStyle={{ color: '#111827', fontWeight: 600 }}
          itemStyle={{ color: D.jade }}
          formatter={(v) => [`$${Number(v).toLocaleString()}`, 'Revenue']}
        />
        <Area type="monotone" dataKey="v" stroke={D.jade} strokeWidth={2.5} fill="url(#dRevFill)" />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

/* ─── Goal ring with unique Rose+Amber gradient ─── */
const DGoalRing = ({ percent = 68, size = 130 }) => {
  const r = size / 2 - 10;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;
  const angle = (percent / 100) * 360 - 90;
  const cx = size / 2, cy = size / 2;
  const mx = cx + r * Math.cos((angle * Math.PI) / 180);
  const my = cy + r * Math.sin((angle * Math.PI) / 180);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <linearGradient id="dRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={D.rose} />
          <stop offset="50%" stopColor={D.amber} />
          <stop offset="100%" stopColor={D.purple} />
        </linearGradient>
        <filter id="dRingGlow"><feGaussianBlur stdDeviation="2.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="8" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="url(#dRingGrad)" strokeWidth="8"
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`} />
      <circle cx={mx} cy={my} r="5.5" fill="#fff" stroke={D.amber} strokeWidth="2" filter="url(#dRingGlow)" />
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize="22" fontWeight="800" fill="#111827" fontFamily="Inter">{percent}%</text>
      <text x={cx} y={cy + 15} textAnchor="middle" fontSize="10" fill="#9ca3af" fontFamily="Inter">of Q3 goal</text>
    </svg>
  );
};

function DashboardContent() {
  const { loading, company, currentUser, objectTypes } = useWorkspace();
  const { user } = useAuth();
  const [mounted, setMounted] = React.useState(false);
  const [barLoaded, setBarLoaded] = React.useState(false);
  const [userDeals, setUserDeals] = React.useState([]);
  const [userLeads, setUserLeads] = React.useState([]);
  const [userContacts, setUserContacts] = React.useState([]);
  const [userCompanies, setUserCompanies] = React.useState([]);

  const currentUserId = currentUser?.id || currentUser?.user_id || user?.id || user?.user_id;

  React.useEffect(() => {
    const t1 = setTimeout(() => setMounted(true), 80);
    const t2 = setTimeout(() => setBarLoaded(true), 500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  React.useEffect(() => {
    let isMounted = true;
    async function fetchUserMetrics() {
      try {
        const [dealsRes, leadsRes, contactsRes, companiesRes] = await Promise.all([
          apiGet('/objects/deal?scope=user').catch(() => apiGet('/objects/deals?scope=user')).catch(() => []),
          apiGet('/objects/lead?scope=user').catch(() => apiGet('/objects/leads?scope=user')).catch(() => []),
          apiGet('/objects/contact?scope=user').catch(() => apiGet('/objects/contacts?scope=user')).catch(() => []),
          apiGet('/objects/company?scope=user').catch(() => apiGet('/objects/companies?scope=user')).catch(() => []),
        ]);

        if (!isMounted) return;

        const dealsData = Array.isArray(dealsRes) ? dealsRes : (dealsRes?.data || []);
        const leadsData = Array.isArray(leadsRes) ? leadsRes : (leadsRes?.data || []);
        const contactsData = Array.isArray(contactsRes) ? contactsRes : (contactsRes?.data || []);
        const companiesData = Array.isArray(companiesRes) ? companiesRes : (companiesRes?.data || []);

        setUserDeals(dealsData);
        setUserLeads(leadsData);
        setUserContacts(contactsData);
        setUserCompanies(companiesData);
      } catch (err) {
        console.warn('Dashboard user metrics fetch error:', err.message);
      }
    }

    if (currentUserId) {
      fetchUserMetrics();
    }
    return () => { isMounted = false; };
  }, [currentUserId]);

  const formatRelativeTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    const sec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (sec < 60) return 'Just now';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hrs = Math.floor(min / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return 'Yesterday';
    if (days < 30) return `${days}d ago`;
    const mos = Math.floor(days / 30);
    if (mos < 12) return `${mos}mo ago`;
    return `${Math.floor(mos / 12)}y ago`;
  };

  const derivedActivities = useMemo(() => {
    const rawItems = [
      ...userLeads.map((r) => ({ ...r, _objType: 'Lead' })),
      ...userDeals.map((r) => ({ ...r, _objType: 'Deal' })),
      ...userContacts.map((r) => ({ ...r, _objType: 'Contact' })),
      ...userCompanies.map((r) => ({ ...r, _objType: 'Company' })),
    ];

    const list = [];

    rawItems.forEach((r) => {
      const objType = r._objType || 'Record';
      let name = r.name || r.title || r.lead_name || r.contact_name || r.company_name || r.first_name || (r.data && (r.data.name || r.data.first_name)) || '';
      if (!name || name.trim() === '') name = 'Untitled Record';
      else name = String(name).trim();

      const createdStr = r.created_at || (r.data && r.data.created_at);
      const updatedStr = r.updated_at || (r.data && r.data.updated_at);

      const createdMs = createdStr ? Date.parse(createdStr) : 0;
      const updatedMs = updatedStr ? Date.parse(updatedStr) : 0;

      if (!isNaN(updatedMs) && updatedMs > 0 && updatedMs - createdMs > 60000) {
        list.push({
          id: `${r.id || Math.random()}-updated`,
          type: 'updated',
          text: `${objType} updated — ${name}`,
          timestamp: updatedStr,
          timeMs: updatedMs,
        });
      } else if (!isNaN(createdMs) && createdMs > 0) {
        list.push({
          id: `${r.id || Math.random()}-created`,
          type: 'created',
          text: `New ${objType} created — ${name}`,
          timestamp: createdStr,
          timeMs: createdMs,
        });
      }
    });

    list.sort((a, b) => b.timeMs - a.timeMs);
    return list.slice(0, 5);
  }, [userLeads, userDeals, userContacts, userCompanies]);

  // Dynamic top-right header KPI metrics for current week (7 days)
  const headerKpiMetrics = useMemo(() => {
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const weekAgoMs = now - sevenDaysMs;

    // 1. New Leads created this week
    const newLeads = userLeads.filter((r) => {
      const createdStr = r.created_at || (r.data && r.data.created_at);
      const createdMs = createdStr ? Date.parse(createdStr) : 0;
      return !isNaN(createdMs) && createdMs >= weekAgoMs;
    }).length;

    // 2. New Contacts created this week
    const newContacts = userContacts.filter((r) => {
      const createdStr = r.created_at || (r.data && r.data.created_at);
      const createdMs = createdStr ? Date.parse(createdStr) : 0;
      return !isNaN(createdMs) && createdMs >= weekAgoMs;
    }).length;

    // 3. Recent Updates modified this week across user-scoped records
    const allRecords = [...userLeads, ...userDeals, ...userContacts, ...userCompanies];
    const recentUpdates = allRecords.filter((r) => {
      const updatedStr = r.updated_at || (r.data && r.data.updated_at);
      const updatedMs = updatedStr ? Date.parse(updatedStr) : 0;
      return !isNaN(updatedMs) && updatedMs >= weekAgoMs;
    }).length;

    return {
      newLeads,
      newContacts,
      recentUpdates,
    };
  }, [userLeads, userContacts, userDeals, userCompanies]);

  if (loading) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: '#8990ac' }}>
        <div className="spinner-border spinner-border-sm me-2 text-primary" role="status" />
        Loading dashboard…
      </div>
    );
  }

  const orgName = company?.name || company?.organization_name || company?.company_name || 'Your Organization';
  const userName = currentUser?.name || user?.name || 'User';
  const firstName = userName.split(' ')[0];

  // 1. My Deals (COUNT of user's Deals using owner_id)
  const totalMyDeals = userDeals.length;

  // 2. My Open Deals (user deals where stage/status is not Closed Won/Won/Closed Lost/Lost)
  const isDealOpen = (d) => {
    const s = String(d.stage || d.status || '').trim().toLowerCase();
    return s !== 'closed won' && s !== 'won' && s !== 'closed lost' && s !== 'lost' && s !== 'closedwon' && s !== 'closedlost';
  };
  const totalMyOpenDeals = userDeals.filter(isDealOpen).length;

  // 3. My Active Leads (user leads where status is not Converted/Not Qualified)
  const isLeadActive = (l) => {
    const s = String(l.status || '').trim().toLowerCase();
    return s !== 'converted' && s !== 'not qualified' && s !== 'unqualified';
  };
  const totalMyActiveLeads = userLeads.filter(isLeadActive).length;

  const kpiCards = [
    { label: 'My Deals', raw: totalMyDeals, prefix: '', suffix: '', delta: '+18.4%', up: true, color: '#10b981', glow: '#10b981', icon: Columns3, gradient: 'linear-gradient(135deg, #10b981, #34d399)' },
    { label: 'My Open Deals', raw: totalMyOpenDeals, prefix: '', suffix: '', delta: '+6.1%', up: true, color: '#f59e0b', glow: '#f59e0b', icon: Columns3, gradient: 'linear-gradient(135deg, #f59e0b, #fbbf24)' },
    { label: 'My Active Leads', raw: totalMyActiveLeads, prefix: '', suffix: '', delta: '-2.3%', up: false, color: '#f43f5e', glow: '#f43f5e', icon: Users, gradient: 'linear-gradient(135deg, #f43f5e, #fb7185)' },
    { label: 'Win Rate', raw: 34, prefix: '', suffix: '.8%', delta: '+3.7%', up: true, color: '#a855f7', glow: '#a855f7', icon: TrendingUp, gradient: 'linear-gradient(135deg, #a855f7, #c084fc)' },
  ];

  // Generate 30-day daily aggregated revenue data for user's closed-won deals
  const generate30DayChartData = () => {
    const dateMap = new Map();
    const now = new Date();

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateKey = `${y}-${m}-${day}`;
      const monthLabel = d.toLocaleDateString('en-US', { month: 'short' });
      const displayLabel = `${monthLabel} ${d.getDate()}`;
      dateMap.set(dateKey, { m: displayLabel, v: 0 });
    }

    const closedWonDeals = userDeals.filter((d) => {
      const stg = String(d.stage || d.status || '').trim().toLowerCase();
      return stg === 'closed won' || stg === 'won' || stg === 'closedwon';
    });

    closedWonDeals.forEach((deal) => {
      const dateVal = deal.updated_at || deal.created_at || deal.close_date || deal.expected_close_date;
      if (dateVal) {
        const d = new Date(dateVal);
        if (!isNaN(d.getTime())) {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const dateKey = `${y}-${m}-${day}`;
          if (dateMap.has(dateKey)) {
            const amt = parseFloat(String(deal.amount || deal.value || 0).replace(/[^0-9.]/g, '')) || 0;
            dateMap.get(dateKey).v += amt;
          }
        }
      }
    });

    return Array.from(dateMap.values());
  };

  const chartData = generate30DayChartData();

  // Calculate dynamic user performance metrics from userDeals
  const userClosedWonDeals = userDeals.filter((d) => {
    const stg = String(d.stage || d.status || '').trim().toLowerCase();
    return stg === 'closed won' || stg === 'won' || stg === 'closedwon';
  });

  const dealsWonCount = userClosedWonDeals.length;

  const totalRevenueClosed = userClosedWonDeals.reduce((sum, d) => {
    const amt = parseFloat(String(d.amount || d.value || 0).replace(/[^0-9.]/g, '')) || 0;
    return sum + amt;
  }, 0);

  const avgDealSize = dealsWonCount > 0 ? (totalRevenueClosed / dealsWonCount) : 0;

  // Generate dynamic pipeline stages calculated directly from userDeals using backend field definition picklist
  const generatePipelineStages = () => {
    const dealMeta = objectTypes?.deal || objectTypes?.deals;
    const stageField = dealMeta?.fields?.find(f => (f.name || f.api_name || '').toLowerCase() === 'stage');
    const backendPicklist = stageField?.picklist_values || stageField?.picklistValues || stageField?.options;

    const defaultNames = Array.isArray(backendPicklist) && backendPicklist.length > 0
      ? backendPicklist.map(String)
      : ['Qualification', 'Discovery', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];

    const colors = ['#38bdf8', '#a855f7', '#f59e0b', '#f43f5e', '#10b981', '#64748b'];

    const stageMap = new Map();
    defaultNames.forEach((name, idx) => {
      const col = colors[idx % colors.length];
      stageMap.set(name.toLowerCase(), {
        stage: name,
        total: 0,
        count: 0,
        color: col,
        gradient: `linear-gradient(90deg, ${col}cc, ${col})`,
      });
    });

    userDeals.forEach((deal) => {
      const rawStage = String(deal.stage || deal.status || '').trim();
      if (!rawStage) return;

      let key = rawStage.toLowerCase();
      if (key === 'closed won' || key === 'closedwon' || key === 'won') key = 'closed won';
      if (key === 'closed lost' || key === 'closedlost' || key === 'lost') key = 'closed lost';
      if (key === 'qualification' || key === 'qualified') key = 'qualification';
      if (key === 'discovery') key = 'discovery';

      const amt = parseFloat(String(deal.amount || deal.value || 0).replace(/[^0-9.]/g, '')) || 0;

      if (stageMap.has(key)) {
        const item = stageMap.get(key);
        item.count += 1;
        item.total += amt;
      } else {
        stageMap.set(key, {
          stage: rawStage,
          total: amt,
          count: 1,
          color: '#6366f1',
          gradient: 'linear-gradient(90deg, #6366f1cc, #6366f1)',
        });
      }
    });

    return Array.from(stageMap.values());
  };

  const pipelineStages = generatePipelineStages();
  const maxPipeline = Math.max(...pipelineStages.map((s) => s.total), 0);



  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 18, fontFamily: 'Inter, sans-serif' }}>
      <style>{`
        @keyframes dbSlideUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes dbPulseGlow {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(16,185,129,0.4); }
          50% { opacity: 0.7; box-shadow: 0 0 0 6px rgba(16,185,129,0); }
        }
        @keyframes dbFloat {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33% { transform: translateY(-8px) rotate(1deg); }
          66% { transform: translateY(-4px) rotate(-1deg); }
        }
        @keyframes dbParticleDrift {
          0% { transform: translate(0, 0) scale(1); opacity: 0.6; }
          50% { transform: translate(10px, -20px) scale(1.1); opacity: 0.3; }
          100% { transform: translate(-5px, -35px) scale(0.9); opacity: 0; }
        }
        @keyframes dbFadeSlideIn {
          from { opacity: 0; transform: translateX(-12px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .db-card {
          background: #fff;
          border-radius: 18px;
          border: 1px solid rgba(0,0,0,0.05);
          box-shadow: 0 2px 8px rgba(0,0,0,0.04), 0 12px 40px -12px rgba(0,0,0,0.08);
          transition: all 0.25s cubic-bezier(0.22,1,0.36,1);
        }
        .db-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 28px -6px rgba(0,0,0,0.12), 0 16px 48px -12px rgba(0,0,0,0.08);
          border-color: rgba(99,102,241,0.15);
        }
      `}</style>

      {/* Hero Banner */}
      <div style={{
        borderRadius: 22, position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, #0d1117 0%, #0a1628 30%, #0d2137 55%, #0a2020 80%, #0d1117 100%)',
        padding: '28px 32px 24px',
        boxShadow: '0 20px 60px -16px rgba(16,185,129,0.18), 0 8px 32px -8px rgba(13,17,23,0.4)',
        animation: 'dbSlideUp 0.6s cubic-bezier(0.22,1,0.36,1) both',
      }}>
        {/* Animated particle dots */}
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: i % 2 === 0 ? 6 : 4,
              height: i % 2 === 0 ? 6 : 4,
              borderRadius: '50%',
              background: ['#00b09b', '#4facfe', '#f5576c', '#f6d365', '#a18cd1', '#00d699'][i],
              top: `${[15, 65, 30, 80, 20, 70][i]}%`,
              left: `${[75, 82, 88, 70, 94, 78][i]}%`,
              animation: `dbParticleDrift ${[3, 4, 3.5, 5, 4.5, 3.8][i]}s ease-in-out infinite ${[0, 0.8, 1.2, 0.4, 1.6, 0.2][i]}s`,
              pointerEvents: 'none',
            }}
          />
        ))}

        {/* Glow orbs */}
        <div style={{ position: 'absolute', top: -80, right: 60, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.2), transparent 65%)', animation: 'dbFloat 7s ease-in-out infinite', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, right: 200, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,172,254,0.15), transparent 65%)', animation: 'dbFloat 9s ease-in-out infinite reverse', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 20, right: 340, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,87,108,0.1), transparent 65%)', animation: 'dbFloat 6s ease-in-out infinite 1s', pointerEvents: 'none' }} />

        {/* Grid texture */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.03, backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '48px 48px', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, background: 'rgba(16,185,129,0.12)', backdropFilter: 'blur(12px)', border: '1px solid rgba(16,185,129,0.3)', marginBottom: 12, animation: 'dbFadeSlideIn 0.5s 0.1s both' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00d699', animation: 'dbPulseGlow 2s ease-in-out infinite' }} />
              <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#00d699', letterSpacing: '0.07em', textTransform: 'uppercase' }}>CRM Business Intelligence Dashboard</span>
            </div>
            <h1 style={{ margin: '0 0 8px', fontSize: '1.5rem', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.02em', lineHeight: 1.15, animation: 'dbFadeSlideIn 0.5s 0.2s both' }}>
              Welcome back, <span style={{ background: 'linear-gradient(90deg, #10b981, #38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{firstName}</span>
            </h1>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'rgba(255,255,255,0.48)', maxWidth: 520, lineHeight: 1.65, animation: 'dbFadeSlideIn 0.5s 0.3s both' }}>
              Here's what's happening across {orgName} — track revenue, pipeline, and team performance at a glance.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, animation: 'dbFadeSlideIn 0.5s 0.4s both' }}>
            {[
              { v: headerKpiMetrics.newLeads, l: 'NEW LEADS', sub: 'This week', color: '#10b981' },
              { v: headerKpiMetrics.newContacts, l: 'NEW CONTACTS', sub: 'This week', color: '#f59e0b' },
              { v: headerKpiMetrics.recentUpdates, l: 'RECENT UPDATES', sub: 'This week', color: '#38bdf8' },
            ].map((s) => (
              <div key={s.l} style={{ padding: '10px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', minWidth: 84 }}>
                <div style={{ fontSize: '1.05rem', fontWeight: 900, color: s.color, lineHeight: 1, marginBottom: 3 }}>{s.v}</div>
                <div style={{ fontSize: '0.58rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{s.l}</div>
                <div style={{ fontSize: '0.54rem', fontWeight: 500, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* KPI ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {kpiCards.map((card, i) => (
          <KpiStatCard key={card.label} {...card} delay={i * 60} mounted={mounted} />
        ))}
      </div>

      {/* TWO-COLUMN ANALYTICS ROW: REVENUE TREND + MY PERFORMANCE */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 16 }}>
        <div className="db-card" style={{ padding: '22px 26px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0d1117' }}>My Revenue Trend</div>
              <div style={{ fontSize: '0.72rem', color: '#8990ac', marginTop: 2 }}>Last 30 days · closed-won deals</div>
            </div>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', padding: '4px 10px', borderRadius: 8 }}>+38% growth</span>
          </div>
          <DRevenueChart data={chartData} />
        </div>

        <div className="db-card" style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0d1117' }}>My Performance</div>
              <Sparkles size={17} style={{ color: '#10b981' }} />
            </div>
            <div style={{ fontSize: '0.72rem', color: '#8990ac', marginBottom: 16 }}>Personal deal achievements</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, justifyContent: 'center' }}>
            <div style={{ padding: '12px 16px', borderRadius: 14, background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Deals Won</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0d1117', marginTop: 2 }}>{dealsWonCount}</div>
              </div>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                <CheckCircle2 size={18} />
              </div>
            </div>

            <div style={{ padding: '12px 16px', borderRadius: 14, background: 'rgba(56,189,248,0.04)', border: '1px solid rgba(56,189,248,0.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Revenue Closed</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0d1117', marginTop: 2 }}>
                  ${totalRevenueClosed >= 1000 ? `${(totalRevenueClosed / 1000).toFixed(1)}k` : totalRevenueClosed.toLocaleString()}
                </div>
              </div>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(56,189,248,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
                <TrendingUp size={18} />
              </div>
            </div>

            <div style={{ padding: '12px 16px', borderRadius: 14, background: 'rgba(168,85,247,0.04)', border: '1px solid rgba(168,85,247,0.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Average Deal Size</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0d1117', marginTop: 2 }}>
                  ${avgDealSize >= 1000 ? `${(avgDealSize / 1000).toFixed(1)}k` : (dealsWonCount === 0 ? '0' : avgDealSize.toFixed(0))}
                </div>
              </div>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(168,85,247,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9333ea' }}>
                <Columns3 size={18} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PIPELINE + ACTIVITY */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="db-card" style={{ padding: '22px 26px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0d1117' }}>Pipeline by Stage</div>
            <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#8990ac', background: 'rgba(0,0,0,0.04)', padding: '3px 8px', borderRadius: 6 }}>
              {pipelineStages.length} stages
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {pipelineStages.map((s, i) => {
              const pct = maxPipeline > 0 && s.total > 0 ? Math.max((s.total / maxPipeline) * 100, 3) : 0;
              return (
                <div key={s.stage}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, color: '#374151' }}>
                      {s.stage} <span style={{ color: '#9ca3af', fontWeight: 400 }}>· {s.count}</span>
                    </span>
                    <span style={{ fontWeight: 700, color: '#111827' }}>
                      ${s.total >= 1000 ? `${(s.total / 1000).toFixed(1)}k` : s.total.toLocaleString()}
                    </span>
                  </div>
                  <div style={{ height: 7, borderRadius: 6, background: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 6,
                      background: s.gradient,
                      width: barLoaded ? `${pct}%` : '0%',
                      transition: `width 0.8s cubic-bezier(0.22,1,0.36,1) ${i * 80}ms`,
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="db-card" style={{ padding: '22px 26px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0d1117' }}>Recent Activity</div>
            <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#8990ac', background: 'rgba(0,0,0,0.04)', padding: '3px 8px', borderRadius: 6 }}>Latest Updates</span>
          </div>
          {derivedActivities.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 210, textAlign: 'center', padding: '16px 0' }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(99,102,241,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1', marginBottom: 10 }}>
                <RefreshCw size={20} />
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b' }}>No recent activity</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {derivedActivities.map((act) => {
                const isCreated = act.type === 'created';
                const color = isCreated ? '#10b981' : '#6366f1';
                const bg = isCreated ? 'rgba(16,185,129,0.08)' : 'rgba(99,102,241,0.08)';
                return (
                  <div
                    key={act.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: 12,
                      background: 'rgba(0,0,0,0.02)',
                      border: '1px solid rgba(0,0,0,0.04)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: bg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: color,
                          flexShrink: 0,
                        }}
                      >
                        {isCreated ? <PlusCircle size={15} /> : <Clock size={15} />}
                      </div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {act.text}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.68rem', fontWeight: 500, color: '#8990ac', flexShrink: 0, marginLeft: 8 }}>
                      {formatRelativeTime(act.timestamp)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiStatCard({ label, raw, prefix, suffix, delta, up, color, glow, icon: Icon, gradient, delay, mounted }) {
  const [hov, setHov] = React.useState(false);
  const numTarget = parseFloat(String(raw).replace(/[^0-9.]/g, '')) || 0;
  const counted = useDCount(mounted ? numTarget : 0);
  const display = `${prefix}${typeof raw === 'string' && raw.includes('.') ? counted.toFixed(1) : counted}${suffix}`;

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        borderRadius: 18, cursor: 'default', position: 'relative',
        background: '#fff',
        boxShadow: hov
          ? `0 0 0 2px ${glow}, 0 12px 32px -8px ${glow}35, 0 2px 8px rgba(0,0,0,0.06)`
          : `0 0 0 1.5px ${glow}35, 0 2px 12px -2px ${glow}18, 0 1px 3px rgba(0,0,0,0.04)`,
        transform: hov ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'all 0.25s cubic-bezier(0.22,1,0.36,1)',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '18px 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: gradient,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, boxShadow: `0 4px 10px ${glow}30`,
            }}>
              <Icon size={15} style={{ color: '#fff' }} />
            </div>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
          </div>
          <span style={{
            fontSize: '0.65rem', fontWeight: 700,
            color: up ? '#059669' : '#dc2626',
            background: up ? '#ecfdf5' : '#fef2f2',
            padding: '2px 7px', borderRadius: 6,
            border: `1px solid ${up ? '#a7f3d0' : '#fecaca'}`,
          }}>{delta}</span>
        </div>

        <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#111827', lineHeight: 1, fontVariantNumeric: 'tabular-nums', marginBottom: 4 }}>
          {display}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.68rem' }}>
          {up ? <TrendingUp size={10} style={{ color: '#059669' }} /> : <TrendingDown size={10} style={{ color: '#dc2626' }} />}
          <span style={{ color: '#8990ac' }}>vs last month</span>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════ LEAD QR SCANNER CONTENT ══════════════════════════ */
function LeadQRScannerContent() {
  const navigate = useNavigate();
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraDenied, setCameraDenied] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [rawPayload, setRawPayload] = useState('');
  const [manualPayload, setManualPayload] = useState('');
  const [scannedResult, setScannedResult] = useState('');
  const [captchaChecked, setCaptchaChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (text, type = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const [leadForm, setLeadForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    title: '',
    lead_source: 'QR Scan',
    description: '',
  });

  const toggleCamera = async () => {
    if (cameraActive) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setCameraActive(false);
    } else {
      setCameraError(null);
      setCameraDenied(false);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraActive(true);
      } catch (err) {
        console.warn('Camera stream error:', err);
        setCameraActive(false);
        setCameraDenied(true);
        setCameraError('Camera access denied or unavailable. Please enable camera permissions in your browser settings.');
      }
    }
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const parsePayloadText = (text) => {
    if (!text || !text.trim()) return;
    setRawPayload(text);
    setScannedResult(text);

    let parsed = {
      name: '',
      email: '',
      phone: '',
      company: '',
      title: '',
      lead_source: 'QR Scan',
      description: text,
    };

    try {
      const json = JSON.parse(text);
      if (typeof json === 'object') {
        parsed.name = json.name || `${json.first_name || ''} ${json.last_name || ''}`.trim() || json.fn || '';
        parsed.email = json.email || json.mail || '';
        parsed.phone = json.phone || json.mobile || json.tel || '';
        parsed.company = json.company || json.org || '';
        parsed.title = json.title || json.job_title || json.role || '';
        parsed.description = json.description || json.notes || text;
      }
    } catch {
      const lines = text.split(/\r\n|\n/);
      lines.forEach((line) => {
        const lower = line.toLowerCase();
        if (lower.startsWith('fn:') || lower.startsWith('name:')) {
          parsed.name = line.split(':')[1]?.trim() || '';
        } else if (lower.startsWith('email:') || lower.includes('@')) {
          const matchedEmail = line.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
          if (matchedEmail) parsed.email = matchedEmail[0];
        } else if (lower.startsWith('tel:') || lower.startsWith('phone:')) {
          parsed.phone = line.split(':')[1]?.trim() || '';
        } else if (lower.startsWith('org:') || lower.startsWith('company:')) {
          parsed.company = line.split(':')[1]?.trim() || '';
        } else if (lower.startsWith('title:')) {
          parsed.title = line.split(':')[1]?.trim() || '';
        }
      });

      if (!parsed.name && text.trim().length > 0) {
        parsed.name = text.split('\n')[0].replace(/[^a-zA-Z0-9\s]/g, '').trim().slice(0, 40) || 'Scanned Lead';
      }
    }

    setLeadForm((prev) => ({
      ...prev,
      name: parsed.name || prev.name,
      email: parsed.email || prev.email,
      phone: parsed.phone || prev.phone,
      company: parsed.company || prev.company,
      title: parsed.title || prev.title,
      description: parsed.description || prev.description,
    }));
  };

  const loadDemoQR = () => {
    const demoPayload = JSON.stringify(
      {
        name: 'Sarah Connor',
        email: 'sarah.connor@cyberdyne.io',
        phone: '+1 (555) 234-5678',
        company: 'Cyberdyne Systems',
        title: 'VP of Technology',
        notes: 'Interested in enterprise CRM deployment for Q3.',
      },
      null,
      2
    );
    setManualPayload(demoPayload);
    parsePayloadText(demoPayload);
  };

  const handleSaveLead = async (e) => {
    e.preventDefault();
    if (!leadForm.name || !leadForm.name.trim()) {
      showToast('Please enter Full Name for the lead.', 'error');
      return;
    }

    setSaving(true);
    try {
      await apiPost('/objects/lead', leadForm);
      showToast(`🎉 Lead "${leadForm.name}" created successfully from QR Scan!`, 'success');
      setLeadForm({
        name: '',
        email: '',
        phone: '',
        company: '',
        title: '',
        lead_source: 'QR Scan',
        description: '',
      });
      setRawPayload('');
      setScannedResult('');
      setManualPayload('');
    } catch (err) {
      console.error('Error saving lead from scanner:', err);
      showToast(`⚠️ Failed to save lead: ${err.message || 'An unexpected error occurred.'}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    setLeadForm({
      name: '',
      email: '',
      phone: '',
      company: '',
      title: '',
      lead_source: 'QR Scan',
      description: '',
    });
    setRawPayload('');
    setManualPayload('');
    setScannedResult('');
    setCaptchaChecked(false);
  };

  return (
    <div className="fade-in" style={{ padding: '0 32px 48px' }}>
      <style>{`
        @keyframes scanBeam {
          0%   { top: 10%; opacity: 0.8; }
          50%  { top: 85%; opacity: 0.8; }
          100% { top: 10%; opacity: 0.8; }
        }
      `}</style>

      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 26, fontWeight: 800, margin: '0 0 4px', color: '#1c2033', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 10 }}>
            <QrCode size={26} style={{ color: '#6366f1' }} /> Lead QR Scanner
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-dim)' }}>
            Scan business card QR codes or lead payload QR codes and save directly into Leads.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/workspace/object/lead')}
          className="glass glass-hover"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 18px',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            color: '#4f46e5',
            border: '1px solid rgba(99,102,241,0.22)',
            background: '#ffffff',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(99,102,241,0.08)',
          }}
        >
          <Users size={15} /> Go to Leads
        </button>
      </div>

      {/* Main 2-Column Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24 }}>
        {/* Left Column: Scanner Controls & Manual Payload */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Camera Scanner Card */}
          <div className="glass" style={{ padding: 24, borderRadius: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#1c2033', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Camera size={18} style={{ color: '#6366f1' }} /> Camera Scanner
              </div>
              <span style={{
                fontSize: 11.5, fontWeight: 600,
                color: cameraActive ? '#047857' : (cameraDenied ? '#be123c' : 'var(--text-faint)'),
                background: cameraActive ? 'rgba(52,211,153,0.12)' : (cameraDenied ? '#fef2f2' : 'rgba(0,0,0,0.04)'),
                padding: '3px 10px', borderRadius: 20,
                border: `1px solid ${cameraActive ? 'rgba(52,211,153,0.3)' : (cameraDenied ? '#fecaca' : 'transparent')}`
              }}>
                {cameraActive ? 'Camera Active' : (cameraDenied ? 'Permission Denied' : 'Camera Idle')}
              </span>
            </div>

            {cameraError && (
              <div style={{
                padding: '10px 14px', borderRadius: 10,
                background: '#fef2f2', border: '1px solid #fecaca',
                color: '#be123c', fontSize: 12, fontWeight: 600,
                marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8
              }}>
                <AlertTriangle size={15} flexShrink={0} />
                <span>{cameraError}</span>
              </div>
            )}

            {/* Video Viewport Box */}
            <div
              style={{
                width: '100%',
                height: 280,
                borderRadius: 14,
                background: '#0d1117',
                border: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)',
              }}
            >
              {cameraActive ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  {/* Animated Cyan Scanline */}
                  <div
                    style={{
                      position: 'absolute',
                      left: '10%',
                      right: '10%',
                      height: 2,
                      background: 'linear-gradient(90deg, transparent, #22d3ee, transparent)',
                      boxShadow: '0 0 14px #22d3ee',
                      animation: 'scanBeam 2.5s ease-in-out infinite',
                    }}
                  />
                  {/* Target Crosshairs */}
                  <div style={{ position: 'absolute', width: 140, height: 140, border: '2px dashed rgba(34,211,238,0.6)', borderRadius: 16 }} />
                </>
              ) : (
                <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.45)', padding: 20 }}>
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(255,255,255,0.06)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                    <Camera size={28} color="rgba(255,255,255,0.6)" />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#ffffff' }}>
                    {cameraDenied ? 'Camera Blocked' : 'Camera Preview'}
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4, color: 'rgba(255,255,255,0.4)' }}>
                    {cameraDenied ? 'Please unblock camera in browser settings to scan' : 'Click Start Camera to begin QR code scan'}
                  </div>
                </div>
              )}
            </div>

            {/* Camera Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
              <button
                type="button"
                onClick={toggleCamera}
                disabled={cameraDenied}
                className="orbit-btn-primary"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '9px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                  opacity: cameraDenied ? 0.5 : 1,
                  cursor: cameraDenied ? 'not-allowed' : 'pointer'
                }}
              >
                <Camera size={15} /> {cameraActive ? 'Stop Camera' : (cameraDenied ? 'Camera Blocked' : 'Start Camera')}
              </button>

              <button
                type="button"
                onClick={loadDemoQR}
                className="glass glass-hover"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, fontSize: 12.5, fontWeight: 600, color: '#6366f1', background: '#ffffff', border: '1px solid rgba(99,102,241,0.25)', cursor: 'pointer' }}
              >
                <Sparkles size={14} /> Load Demo QR
              </button>
            </div>

            <p style={{ margin: '14px 0 0', fontSize: 11.5, color: 'var(--text-faint)', lineHeight: 1.5 }}>
              Tip: Keep the QR code inside frame for 1–2 seconds. If detection is unavailable, use manual paste below.
            </p>
          </div>

          {/* Manual QR Payload Card */}
          <div className="glass" style={{ padding: 24, borderRadius: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1c2033', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={18} style={{ color: '#6366f1' }} /> Manual QR Payload
            </div>

            <textarea
              rows={4}
              className="orbit-input"
              placeholder="Paste QR payload text here, then click Parse Payload…"
              value={manualPayload}
              onChange={(e) => setManualPayload(e.target.value)}
              style={{ width: '100%', padding: '12px 14px', fontSize: 13, borderRadius: 10, background: '#ffffff', border: '1px solid rgba(99,102,241,0.18)', marginBottom: 14, resize: 'vertical', boxSizing: 'border-box' }}
            />

            <button
              type="button"
              onClick={() => parsePayloadText(manualPayload)}
              className="orbit-btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 10, fontSize: 12.5, fontWeight: 700 }}
            >
              <QrCode size={14} /> Parse Payload
            </button>
          </div>

          {/* Raw QR Data Display */}
          <div className="glass" style={{ padding: 24, borderRadius: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1c2033', marginBottom: 12 }}>
              Raw QR Data
            </div>

            <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12, fontFamily: 'monospace', color: rawPayload ? '#1e293b' : 'var(--text-faint)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', minHeight: 44 }}>
              {rawPayload || 'No scan captured yet.'}
            </div>
          </div>
        </div>

        {/* Right Column: Lead Preview Form */}
        <div className="glass" style={{ padding: 26, borderRadius: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 800, color: '#1c2033', marginBottom: 20 }}>
            <UserPlus size={18} style={{ color: '#6366f1' }} /> Lead Preview
          </div>

          <form onSubmit={handleSaveLead} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>
                Full Name <span style={{ color: '#fb7185' }}>*</span>
              </label>
              <input
                type="text"
                required
                className="orbit-input"
                placeholder="Full Name"
                value={leadForm.name}
                onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={labelStyle}>Email</label>
                <input
                  type="email"
                  className="orbit-input"
                  placeholder="Email"
                  value={leadForm.email}
                  onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Phone</label>
                <input
                  type="tel"
                  className="orbit-input"
                  placeholder="Phone"
                  value={leadForm.phone}
                  onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={labelStyle}>Company</label>
                <input
                  type="text"
                  className="orbit-input"
                  placeholder="Company"
                  value={leadForm.company}
                  onChange={(e) => setLeadForm({ ...leadForm, company: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Title</label>
                <input
                  type="text"
                  className="orbit-input"
                  placeholder="Job Title"
                  value={leadForm.title}
                  onChange={(e) => setLeadForm({ ...leadForm, title: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Lead Source</label>
              <input
                type="text"
                className="orbit-input"
                placeholder="QR Scan"
                value={leadForm.lead_source}
                onChange={(e) => setLeadForm({ ...leadForm, lead_source: e.target.value })}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Description</label>
              <textarea
                rows={4}
                className="orbit-input"
                placeholder="Scanned notes or raw data…"
                value={leadForm.description}
                onChange={(e) => setLeadForm({ ...leadForm, description: e.target.value })}
                style={{ ...inputStyle, height: 'auto', minHeight: 90, padding: '10px 14px' }}
              />
            </div>

            {/* Captcha Verification Tile */}
            <div
              onClick={() => setCaptchaChecked(!captchaChecked)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 18px',
                borderRadius: 12,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                cursor: 'pointer',
                userSelect: 'none',
                width: 220,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 5,
                    border: captchaChecked ? 'none' : '2px solid #cbd5e1',
                    background: captchaChecked ? '#10b981' : '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {captchaChecked && <Check size={16} strokeWidth={3} />}
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>I'm not a robot</span>
              </div>
              <div style={{ textAlign: 'center', fontSize: 9, color: '#94a3b8', fontWeight: 600 }}>reCAPTCHA</div>
            </div>

            {/* Action Footer Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
              <button
                type="submit"
                disabled={saving}
                className="orbit-btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 22px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}
              >
                <Check size={16} /> {saving ? 'Saving…' : 'Save Lead'}
              </button>

              <button
                type="button"
                onClick={handleClear}
                className="glass glass-hover"
                style={{ padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, color: 'var(--text-dim)', border: '1px solid var(--panel-border)', background: 'transparent', cursor: 'pointer' }}
              >
                Clear
              </button>

              <button
                type="button"
                onClick={() => navigate('/workspace/object/lead')}
                className="glass glass-hover"
                style={{ padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#4f46e5', border: '1px solid rgba(99,102,241,0.2)', background: '#ffffff', cursor: 'pointer' }}
              >
                Go to Leads
              </button>
            </div>
          </form>
        </div>
      </div>

      {toastMessage && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', bottom: 30, right: 30, zIndex: 9999999,
          background: (typeof toastMessage === 'object' && toastMessage.type === 'error') ? '#fef2f2' : '#ffffff',
          color: (typeof toastMessage === 'object' && toastMessage.type === 'error') ? '#991b1b' : '#0f172a',
          padding: '14px 22px', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: (typeof toastMessage === 'object' && toastMessage.type === 'error')
            ? '0 20px 45px -10px rgba(239, 68, 68, 0.3), 0 8px 16px -4px rgba(0, 0, 0, 0.08)'
            : '0 20px 45px -10px rgba(99, 102, 241, 0.3), 0 8px 16px -4px rgba(0, 0, 0, 0.08)',
          border: (typeof toastMessage === 'object' && toastMessage.type === 'error') ? '1.5px solid #fecaca' : '1.5px solid #a7f3d0',
          fontSize: '0.9rem', fontWeight: 700,
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          animation: 'cp-rise .3s cubic-bezier(.2,.7,.3,1) both',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: (typeof toastMessage === 'object' && toastMessage.type === 'error') ? '#fee2e2' : '#d1fae5',
            color: (typeof toastMessage === 'object' && toastMessage.type === 'error') ? '#dc2626' : '#059669',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            {(typeof toastMessage === 'object' && toastMessage.type === 'error') ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          </div>
          <span>{typeof toastMessage === 'object' ? toastMessage.text : toastMessage}</span>
        </div>,
        document.body
      )}
    </div>
  );
}

const labelStyle = {
  display: 'block',
  fontSize: '0.72rem',
  fontWeight: 700,
  color: 'var(--text-faint)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 6,
};

const inputStyle = {
  width: '100%',
  height: 42,
  padding: '0 14px',
  fontSize: '0.875rem',
  fontWeight: 500,
  color: '#1c2033',
  backgroundColor: '#ffffff',
  border: '1px solid rgba(99,102,241,0.2)',
  borderRadius: 10,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'Inter',
};

/* ══════════════════════════ OBJECT LIST CONTENT ══════════════════════════ */
function getModuleSubtitle(key, pluralName) {
  const str = String(key || '').toLowerCase();
  if (str.includes('contact')) return "Every person and company you're building a relationship with.";
  if (str.includes('lead')) return 'Potential clients and prospects in your sales pipeline.';
  if (str.includes('deal')) return 'Active business opportunities, contracts, and revenue.';
  if (str.includes('compan') || str.includes('account')) return 'Accounts, organizations, and corporate partners.';
  return `All records and data managed in ${pluralName}.`;
}
/* ─── UUID format validator helper ──────────────────────────── */
const isUuid = (val) => Boolean(val && typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

/* ─── Format Lookup & Owner IDs to Human Names ───────────────── */
function formatLookupValue(fieldName, val, record, currentUser, organization, company, lookupMap) {
  const nameLower = String(fieldName || '').toLowerCase();

  if (nameLower.includes('owner') || nameLower.includes('created_by') || nameLower.includes('updated_by') || nameLower.includes('user')) {
    if (val && isUuid(val)) {
      if (lookupMap && lookupMap[val]) {
        const u = lookupMap[val];
        const uName = u.name || u.display_name || (`${u.first_name || ''} ${u.last_name || ''}`.trim()) || u.email;
        if (uName) return uName;
      }
      if (lookupMap && lookupMap.users && lookupMap.users[val]) {
        const u = lookupMap.users[val];
        const uName = u.name || u.display_name || (`${u.first_name || ''} ${u.last_name || ''}`.trim()) || u.email;
        if (uName) return uName;
      }
      if (currentUser && (val === currentUser.id || val === currentUser.user_id)) {
        const cName = currentUser.name || (`${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim()) || currentUser.email || 'Admin User';
        return cName;
      }
    }
    if (val && typeof val === 'string' && !isUuid(val)) return val;
    if (record?.created_by_name) return record.created_by_name;
    if (record?.owner_name) return record.owner_name;
    if (record?.owner?.name) return record.owner.name;
    return 'Unassigned';
  }

  if (!val) return '—';

  if (nameLower.includes('company') || nameLower.includes('organization') || nameLower.includes('account')) {
    if (isUuid(val)) {
      const compObj = lookupMap?.[val] || (lookupMap?.companies && lookupMap.companies[val]);
      if (compObj) {
        const compName = compObj.name || compObj.company_name || compObj.account_name;
        if (compName && !isUuid(compName)) return compName;
      }
      if (record?.company_name) return record.company_name;
      if (record?.company?.name) return record.company.name;
      if (record?.data?.company_name) return record.data.company_name;
      if (record?.company && typeof record.company === 'string' && !isUuid(record.company)) return record.company;
      return organization?.name || company?.name || '—';
    }
    return String(val);
  }

  if (isUuid(val)) {
    return record?.[`${fieldName}_name`] || record?.[fieldName?.replace('_id', '')]?.name || '—';
  }

  return String(val);
}

function ObjectListContent({ objectTypeId }) {
  const { objectTypes, permissions, currentUser, organization, company } = useWorkspace();
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');

  // CSV Import/Export States
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [parsedRecords, setParsedRecords] = useState([]);
  const [importing, setImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const [backendFields, setBackendFields] = useState([]);
  const [lookupMap, setLookupMap] = useState({});

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    Promise.all([
      apiGet(`/objects/${objectTypeId}`),
      apiGet(`/metadata/objects/${objectTypeId}/fields`).catch(() => apiGet(`/objects/${objectTypeId}/fields`)).catch(() => null),
      apiGet('/objects/users').catch(() => apiGet('/users')).catch(() => ({ data: [] })),
      apiGet('/objects/companies').catch(() => apiGet('/companies')).catch(() => ({ data: [] })),
      apiGet('/objects/contacts').catch(() => apiGet('/contacts')).catch(() => ({ data: [] })),
    ])
      .then(([recRes, fieldRes, userRes, compRes, contRes]) => {
        if (!isMounted) return;
        const dataList = Array.isArray(recRes) ? recRes : recRes?.data || [];
        setRecords(dataList);

        const fieldsData = Array.isArray(fieldRes) ? fieldRes : fieldRes?.data || [];
        if (fieldsData && fieldsData.length > 0) {
          setBackendFields(fieldsData);
        }

        const map = {};
        const uList = Array.isArray(userRes) ? userRes : userRes?.data || [];
        const cList = Array.isArray(compRes) ? compRes : compRes?.data || [];
        const ctList = Array.isArray(contRes) ? contRes : contRes?.data || [];

        [...uList, ...cList, ...ctList].forEach((item) => {
          const itemId = item.id || item._id || item.user_id || item.company_id || item.contact_id;
          if (itemId) {
            map[itemId] = item;
          }
        });
        setLookupMap(map);
      })
      .catch((err) => {
        console.error(`Error loading records for ${objectTypeId}:`, err);
        if (isMounted) setError(err.message || `Failed to fetch ${objectTypeId} records.`);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [objectTypeId]);

  const rawMeta = objectTypes ? objectTypes[objectTypeId] : null;

  const meta = {
    displayName: rawMeta?.displayName || (objectTypeId ? objectTypeId.charAt(0).toUpperCase() + objectTypeId.slice(1) : 'Record'),
    pluralDisplayName: rawMeta?.pluralDisplayName || (objectTypeId ? objectTypeId.charAt(0).toUpperCase() + objectTypeId.slice(1) : 'Records'),
  };

  const cleanObjKey = String(objectTypeId || '').toLowerCase();
  const keySingular = cleanObjKey.endsWith('s') ? cleanObjKey.slice(0, -1) : cleanObjKey;
  const keyPlural = cleanObjKey.endsWith('s') ? cleanObjKey : `${cleanObjKey}s`;
  const objPerm = permissions ? (permissions[cleanObjKey] || permissions[keySingular] || permissions[keyPlural]) : null;

  const canDeleteRecord = objPerm ? objPerm.canDelete !== false : true;
  const canCreateRecord = objPerm ? objPerm.canCreate !== false : true;
  const canUpdateRecord = objPerm ? (objPerm.canUpdate !== false && objPerm.canEdit !== false) : true;

  const [deleteModalRecord, setDeleteModalRecord] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (text, type = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleDeleteRecordClick = (e, recordId, recordTitle) => {
    e.stopPropagation();
    setDeleteModalRecord({ id: recordId, title: recordTitle || 'this record' });
    setDeleteError(null);
  };

  const confirmDeleteRecord = async () => {
    if (!deleteModalRecord) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiDelete(`/objects/${objectTypeId}/${deleteModalRecord.id}`);
      setRecords((prev) => prev.filter((r) => r.id !== deleteModalRecord.id));
      const deletedTitle = deleteModalRecord.title;
      setDeleteModalRecord(null);
      showToast(`"${deletedTitle}" deleted successfully!`, 'success');
    } catch (err) {
      console.error('Delete record error:', err);
      setDeleteError(err?.message || 'Failed to delete record.');
    } finally {
      setDeleting(false);
    }
  };

  const humanize = (s) => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  const isDealObjList = cleanObjKey.includes('deal') || objectTypeId === 'd3147bfb-5a67-4dc7-8dfd-970041d3e441' || (rawMeta && String(rawMeta.api_name || '').toLowerCase() === 'deal');

  // 1. Map backend metadata fields to column definitions ({ key, label, type })
  const allColumns = useMemo(() => {
    const fieldsList = (backendFields && backendFields.length > 0) ? backendFields : (rawMeta?.fields || meta?.fields || []);
    return fieldsList
      .filter((f) => {
        const fname = f.name || f.api_name;
        if (!fname) return false;
        if (isDealObjList && String(fname).toLowerCase() === 'status') return false;
        if (fname === 'owner_id' || fname === 'owner') return true;
        return !/^id$|^_id$|organization_id|created_by|updated_by|deleted_by|is_deleted|object_type_id/i.test(fname);
      })
      .map((f, idx) => {
        const fname = f.name || f.api_name;
        let label = f.label || f.display_name;
        if (!label || label.toLowerCase() === 'owner_id') {
          label = fname === 'owner_id' ? 'Owner' : humanize(fname);
        }
        return {
          key: fname,
          label: String(label).toUpperCase(),
          type: f.type || f.field_type || 'text',
          isTitle: idx === 0 || f.isTitle || ['name', 'title', 'deal_name'].includes(fname),
        };
      });
  }, [backendFields, rawMeta, meta, isDealObjList]);

  // 2. Select columns specified by backend defaultColumns (rawMeta.views.defaultColumns)
  const columns = useMemo(() => {
    let cols = [];
    const metaDefaultCols = rawMeta?.views?.defaultColumns || rawMeta?.views?.default_columns;
    if (Array.isArray(metaDefaultCols) && metaDefaultCols.length > 0) {
      const matched = allColumns.filter((c) => metaDefaultCols.includes(c.key));
      if (matched.length > 0) {
        if (matched[0]) matched[0].isTitle = true;
        cols = matched;
      }
    }
    if (cols.length === 0 && allColumns.length > 0) {
      cols = allColumns.slice(0, 6);
    }

    if (cols.length === 0 && records && records.length > 0) {
      const sample = records[0];
      const allKeys = Object.keys({ ...(sample || {}), ...(sample.data || {}) });
      cols = allKeys
        .filter((k) => !/^id$|_id$|organization_id|created_by|updated_by|deleted_by|is_deleted|data/i.test(k))
        .slice(0, 6)
        .map((k, idx) => ({
          key: k,
          label: humanize(k).toUpperCase(),
          type: 'text',
          isTitle: idx === 0,
        }));
    }

    if (isDealObjList) {
      cols = cols.filter((c) => String(c.key).toLowerCase() !== 'status');
      cols = cols.filter((c) => String(c.key).toLowerCase() !== 'stage');
      const stageCol = allColumns.find((c) => String(c.key).toLowerCase() === 'stage') || {
        key: 'stage',
        label: 'STAGE',
        type: 'dropdown',
        isTitle: false,
      };
      cols.splice(1, 0, stageCol);
    }

    return cols;
  }, [rawMeta, allColumns, records, isDealObjList]);

  const filteredRecords = records.filter((r) => {
    if (!query) return true;
    return Object.values(r).some((val) =>
      String(val || '').toLowerCase().includes(query.toLowerCase())
    );
  });

  const getInitials = (str) => {
    if (!str) return 'U';
    const parts = String(str).trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : String(str).slice(0, 2).toUpperCase();
  };

  const handleRowClick = (recordId) => {
    navigate(`/workspace/object/${objectTypeId}/${recordId}`);
  };

  const handleNewClick = () => {
    navigate(`/workspace/object/${objectTypeId}/create`);
  };

  const statusColor = {
    Customer: COLOR.success,
    Active: COLOR.cyan,
    Lead: COLOR.warning,
    Qualification: COLOR.cyan,
    Discovery: COLOR.violet,
    Qualified: COLOR.violet,
    Proposal: COLOR.warning,
    Negotiation: COLOR.danger,
    'Closed Won': COLOR.success,
    'Closed Lost': '#64748b',
    Won: COLOR.success,
    Lost: '#64748b',
    New: COLOR.cyan,
    Working: COLOR.warning,
  };

  const IconBtn = ({ icon: Icon, onClick }) => (
    <button
      onClick={onClick}
      style={{
        width: 28,
        height: 28,
        borderRadius: 8,
        border: '1px solid var(--panel-border)',
        background: 'transparent',
        color: 'var(--text-dim)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
      }}
    >
      <Icon size={13} />
    </button>
  );

  const formatDate = (isoStr) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return String(isoStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return String(isoStr);
    }
  };

  const formatValue = (key, val, record) => {
    const keyLower = String(key || '').toLowerCase();

    /* Currency & Amount Formatting with Line Items Fallback */
    if (keyLower.includes('amount') || keyLower.includes('revenue') || keyLower.includes('price') || keyLower.includes('value') || keyLower.includes('profit') || keyLower.includes('total')) {
      let numVal = val;
      if (numVal === undefined || numVal === null || numVal === '') {
        numVal = record?.amount ?? record?.deal_value ?? record?.value ?? (record?.data && (record.data.amount ?? record.data.deal_value ?? record.data.value));
        if ((numVal === undefined || numVal === null || numVal === '') && record?.id) {
          try {
            const saved = localStorage.getItem(`crm_line_items_${record.id}`);
            if (saved) {
              const items = JSON.parse(saved);
              if (Array.isArray(items) && items.length > 0) {
                numVal = items.reduce((s, it) => s + (Number(it.total) || 0), 0);
              }
            }
          } catch (e) { }
        }
      }
      const n = Number(numVal);
      if (!isNaN(n) && numVal !== null && numVal !== '') {
        return `$${n.toLocaleString()}`;
      }
      return '—';
    }

    if (val === undefined || val === null || val === '') {
      if (key === 'title' || key === 'job_title') return record.title || record.job_title || (record.data && (record.data.title || record.data.job_title)) || '—';
      if (key === 'lead_source' || key === 'source') return record.lead_source || record.source || (record.data && (record.data.lead_source || record.data.source)) || '—';
      if (key === 'first_name') return record.first_name || (record.name ? record.name.split(' ')[0] : '—');
      if (key === 'last_name') return record.last_name || (record.name && record.name.split(' ').length > 1 ? record.name.split(' ').slice(1).join(' ') : '—');
      if (key === 'contact_name') return record.contact_name || record.name || `${record.first_name || ''} ${record.last_name || ''}`.trim() || '—';
      return '—';
    }
    const str = String(val).trim();
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str) || /id$/i.test(key)) {
      return '—';
    }
    if (key.includes('created') || key.includes('date') || key.includes('modified') || key.includes('updated')) {
      try {
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
          const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
          return `${datePart}, ${timePart}`;
        }
      } catch {
        return str;
      }
    }
    return str;
  };

  const handleExportCSV = () => {
    const listToExport = filteredRecords && filteredRecords.length > 0 ? filteredRecords : records;
    if (!listToExport || listToExport.length === 0) {
      showToast(`No ${meta.pluralDisplayName.toLowerCase()} records available to export.`, 'error');
      return;
    }

    const exportKeys = columns.map(c => c.key);
    if (!exportKeys.includes('email') && listToExport.some(r => r.email || (r.data && r.data.email))) exportKeys.push('email');
    if (!exportKeys.includes('phone') && listToExport.some(r => r.phone || (r.data && r.data.phone))) exportKeys.push('phone');

    const headers = exportKeys.map(k => humanize(k));
    const csvRows = [headers.join(',')];

    for (const rec of listToExport) {
      const rowVals = exportKeys.map(k => {
        let val = rec[k];
        if (val === undefined || val === null) {
          val = rec.data ? rec.data[k] : '';
        }
        val = String(val || '').replace(/"/g, '""');
        return `"${val}"`;
      });
      csvRows.push(rowVals.join(','));
    }

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${objectTypeId}_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileProcess = (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      showToast('Please select a valid .csv file.', 'error');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split(/\r\n|\n/).filter(line => line.trim());
      if (lines.length < 2) {
        setParsedRecords([]);
        return;
      }

      const rawHeaders = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
      
      const mapHeader = (h) => {
        if (h.includes('first') || h === 'fname') return 'first_name';
        if (h.includes('last') || h === 'lname') return 'last_name';
        if (h.includes('alternate') || h.includes('duplicate') || h.includes('secondary') || h.includes('alt_email')) return 'alternate_email';
        if (h.includes('email')) return 'email';
        if (h.includes('phone') || h.includes('tel') || h.includes('mobile') || h.includes('alt')) return 'phone';
        if (h.includes('company') || h.includes('organization') || h.includes('org')) return 'company';
        if (h.includes('title') || h.includes('job') || h.includes('position')) return 'title';
        if (h.includes('source') || h.includes('lead source')) return 'lead_source';
        if (h.includes('status')) return 'status';
        if (h.includes('description') || h.includes('note') || h.includes('memo')) return 'description';
        if (h === 'name' || h === 'full name') return 'name';
        return h;
      };

      const headers = rawHeaders.map(mapHeader);
      const parsedList = [];

      for (let i = 1; i < lines.length; i++) {
        const currentLine = lines[i];
        if (!currentLine.trim()) continue;

        const rowValues = [];
        let inQuotes = false;
        let val = '';
        for (let c = 0; c < currentLine.length; c++) {
          const char = currentLine[c];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            rowValues.push(val.trim().replace(/^["']|["']$/g, ''));
            val = '';
          } else {
            val += char;
          }
        }
        rowValues.push(val.trim().replace(/^["']|["']$/g, ''));

        const rowObj = {};
        headers.forEach((h, idx) => {
          if (rowValues[idx] !== undefined) {
            rowObj[h] = rowValues[idx];
          }
        });

        const fn = rowObj.first_name || '';
        const ln = rowObj.last_name || '';
        const combinedName = (fn || ln) ? `${fn} ${ln}`.trim() : (rowObj.name || rowObj.email?.split('@')[0] || `Imported Lead ${i}`);

        const payload = {
          name: combinedName,
          first_name: fn,
          last_name: ln,
          email: rowObj.email || '',
          phone: rowObj.phone || '',
          company: rowObj.company || '',
          title: rowObj.title || '',
          lead_source: rowObj.lead_source || 'CSV Import',
          status: rowObj.status || 'New',
          description: rowObj.description || '',
        };

        if (payload.name || payload.email || payload.company) {
          parsedList.push(payload);
        }
      }

      setParsedRecords(parsedList);
    };

    reader.readAsText(file);
  };

  const handleImportSubmit = async () => {
    if (!parsedRecords || parsedRecords.length === 0) return;

    setImporting(true);
    let successCount = 0;
    const newAdded = [];

    for (const recordPayload of parsedRecords) {
      try {
        const created = await apiPost(`/objects/${objectTypeId}`, recordPayload);
        const item = created?.data || created || recordPayload;
        newAdded.push(item);
        successCount++;
      } catch (err) {
        console.error('Import error for row:', err);
      }
    }

    setImporting(false);
    setImportModalOpen(false);
    setSelectedFile(null);
    setParsedRecords([]);

    if (successCount > 0) {
      setRecords((prev) => [...newAdded, ...prev]);
      showToast(`🎉 Successfully imported ${successCount} ${meta.pluralDisplayName.toLowerCase()}!`, 'success');
    } else {
      showToast(`⚠️ Failed to import. Please check CSV format.`, 'error');
    }
  };

  if (!loading && permissions && objPerm && objPerm.canRead === false) {
    return <AccessDenied moduleName={rawMeta?.pluralDisplayName || rawMeta?.displayName || objectTypeId} />;
  }

  return (
    <div className="fade-in" style={{ padding: '0 32px 32px' }}>
      {/* Top Title Bar */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 26, fontWeight: 700, margin: '0 0 4px', color: '#1c2033', letterSpacing: '-0.02em' }}>
            {meta.pluralDisplayName}
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-dim)' }}>
            {records.length > 0 ? `${records.length} ${meta.pluralDisplayName.toLowerCase()}` : getModuleSubtitle(objectTypeId, meta.pluralDisplayName)}
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={handleExportCSV}
            className="glass glass-hover"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 16px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              color: '#334155',
              border: '1px solid rgba(203, 213, 225, 0.8)',
              background: '#ffffff',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
              transition: 'all 0.2s ease',
            }}
          >
            <Download size={14} style={{ color: '#64748b' }} /> Export CSV
          </button>

          {canCreateRecord && (
            <>
              <button
                onClick={() => setImportModalOpen(true)}
                className="glass glass-hover"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 16px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#4f46e5',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  background: '#ffffff',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(99, 102, 241, 0.08)',
                  transition: 'all 0.2s ease',
                }}
              >
                <UploadCloud size={15} style={{ color: '#6366f1' }} /> Import CSV
              </button>

              <button
                onClick={handleNewClick}
                className="orbit-btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 18px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  color: '#ffffff',
                  border: 'none',
                  boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
                }}
              >
                <Plus size={15} /> New {meta.displayName}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Table Panel */}
      <div className="glass" style={{ padding: 8, borderRadius: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--panel-border)' }}>
          <div style={{ position: 'relative' }} className="orbit-search-input-wrapper">
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-faint)',
                pointerEvents: 'none',
                zIndex: 2,
              }}
            />
            <input
              className="orbit-input has-left-icon"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Filter ${meta.pluralDisplayName.toLowerCase()}…`}
              style={{ width: 220, paddingLeft: '36px', borderRadius: 10, fontSize: 12.5 }}
            />
          </div>

          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'transparent',
              border: '1px solid var(--panel-border)',
              color: 'var(--text-dim)',
              padding: '8px 14px',
              borderRadius: 10,
              fontSize: 12.5,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <SlidersHorizontal size={13} /> Filter
          </button>
        </div>

        <div style={{ overflowX: 'auto' }} className="orbit-scrollbar">
          {permissions && permissions.canRead === false ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#be123c', fontSize: 14, fontWeight: 600 }}>
              ⚠️ Access Denied: You do not have permission to read {meta.pluralDisplayName.toLowerCase()} records.
            </div>
          ) : error ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#be123c', fontSize: 13 }}>
              ⚠️ {error}
            </div>
          ) : loading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
              <div className="spinner-border spinner-border-sm me-2 text-primary" role="status" />
              Loading records…
            </div>
          ) : filteredRecords.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
              No {meta.pluralDisplayName.toLowerCase()} found.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <thead>
                <tr style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      style={{
                        textAlign: 'left',
                        padding: '12px 18px',
                        fontWeight: 600,
                        borderBottom: '1px solid var(--panel-border)',
                      }}
                    >
                      {col.label}
                    </th>
                  ))}
                  <th style={{ textAlign: 'right', padding: '12px 18px', borderBottom: '1px solid var(--panel-border)' }} />
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((r) => {
                  const titleVal = r.name || r.lead_name || r.contact_name || r.first_name || 'Untitled Record';
                  const emailVal = r.email || r.email_address || (r.data && r.data.email) || '—';
                  const phoneVal = r.phone || r.mobile || r.phone_number || (r.data && r.data.phone) || '—';
                  const statusVal = r.status || 'New';

                  return (
                    <tr
                      key={r.id}
                      onClick={() => handleRowClick(r.id)}
                      style={{ borderBottom: '1px solid rgba(99,102,241,0.08)', cursor: 'pointer' }}
                      className="glass-hover"
                    >
                      {columns.map((col) => {
                        const raw = r[col.key] !== undefined ? r[col.key] : (r.data && r.data[col.key]);
                        if (col.isTitle) {
                          const val = raw || titleVal;
                          return (
                            <td key={col.key} style={{ padding: '14px 18px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <Avatar initials={getInitials(String(val))} size={34} />
                                <div>
                                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1c2033' }}>{String(val)}</div>
                                </div>
                              </div>
                            </td>
                          );
                        }

                        const keyLower = String(col.key).toLowerCase();
                        if (keyLower.includes('owner')) {
                          const ownerDisplay = formatLookupValue(col.key, raw || r.owner_id || r.owner, r, currentUser, organization, company, lookupMap);
                          return (
                            <td key={col.key} style={{ padding: '14px 18px', fontSize: 13, color: 'var(--text-dim)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Users size={13} style={{ color: 'var(--text-faint)' }} />
                                <span>{ownerDisplay}</span>
                              </div>
                            </td>
                          );
                        }

                        if (keyLower.includes('email')) {
                          const v = raw || emailVal;
                          return (
                            <td key={col.key} style={{ padding: '14px 18px', fontSize: 13, color: 'var(--text-dim)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Mail size={13} style={{ color: 'var(--text-faint)' }} />
                                <span>{String(v || '—')}</span>
                              </div>
                            </td>
                          );
                        }

                        if (keyLower.includes('phone') || keyLower.includes('mobile')) {
                          const v = raw || phoneVal;
                          return (
                            <td key={col.key} style={{ padding: '14px 18px', fontSize: 13, color: 'var(--text-dim)', fontFamily: 'Inter' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Phone size={13} style={{ color: 'var(--text-faint)' }} />
                                <span>{String(v || '—')}</span>
                              </div>
                            </td>
                          );
                        }

                        if (keyLower.includes('company') || keyLower.includes('organization') || keyLower.includes('account')) {
                          let compVal = raw || r.company || r.company_name || r.organization || (r.data && (r.data.company || r.data.company_name || r.data.organization));
                          if (compVal && typeof compVal === 'object') {
                            compVal = compVal.name || compVal.company_name || compVal.organization_name || compVal.display_name;
                          }
                          const compDisplay = formatLookupValue(col.key, compVal, r, currentUser, organization, company);
                          return (
                            <td key={col.key} style={{ padding: '14px 18px', fontSize: 13, color: 'var(--text-dim)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Building2 size={13} style={{ color: 'var(--text-faint)' }} />
                                <span>{compDisplay}</span>
                              </div>
                            </td>
                          );
                        }

                        if (keyLower.includes('stage') || (isDealObjList && (keyLower.includes('stage') || keyLower.includes('status')))) {
                          const stageVal = r.stage || (r.data && r.data.stage) || null;
                          const v = stageVal && String(stageVal).trim() !== '' ? String(stageVal) : '—';
                          return (
                            <td key={col.key} style={{ padding: '14px 18px', textAlign: 'left', verticalAlign: 'middle' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', marginLeft: '-10px' }}>
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 11.5,
                                    fontWeight: 600,
                                    color: statusColor[v] || COLOR.indigo,
                                    background: `${statusColor[v] || COLOR.indigo}15`,
                                    border: `1px solid ${statusColor[v] || COLOR.indigo}30`,
                                    padding: '3px 10px',
                                    borderRadius: 12,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {v}
                                </span>
                              </div>
                            </td>
                          );
                        }

                        if (keyLower.includes('status')) {
                          const v = raw || statusVal;
                          return (
                            <td key={col.key} style={{ padding: '14px 18px', textAlign: 'left', verticalAlign: 'middle' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', marginLeft: '-10px' }}>
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 11.5,
                                    fontWeight: 600,
                                    color: statusColor[v] || COLOR.indigo,
                                    background: `${statusColor[v] || COLOR.indigo}15`,
                                    border: `1px solid ${statusColor[v] || COLOR.indigo}30`,
                                    padding: '3px 10px',
                                    borderRadius: 12,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {String(v)}
                                </span>
                              </div>
                            </td>
                          );
                        }

                        if (keyLower.includes('created') || keyLower.includes('date')) {
                          const v = raw || r.created_at;
                          return (
                            <td key={col.key} style={{ padding: '14px 18px', fontSize: 12.5, color: 'var(--text-dim)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Calendar size={13} style={{ color: 'var(--text-faint)' }} />
                                <span>{formatDate(v)}</span>
                              </div>
                            </td>
                          );
                        }

                        const v = raw !== undefined && raw !== null ? raw : (r.data && r.data[col.key]);
                        return (
                          <td key={col.key} style={{ padding: '14px 18px', fontSize: 13, color: 'var(--text-dim)' }}>
                            <span>{String(formatValue(col.key, v, r) || '—')}</span>
                          </td>
                        );
                      })}

                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                          <IconBtn icon={Mail} />
                          <IconBtn icon={Phone} />
                          {canDeleteRecord && (
                            (() => {
                              const isConvertedLead = String(objectTypeId || '').toLowerCase().includes('lead') && (
                                String(r.status || r.data?.status || r.stage || r.data?.stage || '').toLowerCase() === 'converted' ||
                                Boolean(r.is_converted) || Boolean(r.data?.is_converted)
                              );

                              if (isConvertedLead) {
                                return (
                                  <span
                                    title="Converted leads cannot be deleted because they are preserved for historical tracking and linked to active Company, Contact, and Deal records."
                                    style={{
                                      width: 28,
                                      height: 28,
                                      borderRadius: 8,
                                      border: '1px solid #e2e8f0',
                                      background: '#f8fafc',
                                      color: '#cbd5e1',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'not-allowed',
                                    }}
                                  >
                                    <Trash2 size={13} />
                                  </span>
                                );
                              }

                              return (
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteRecordClick(e, r.id, titleVal)}
                                  title="Delete Record"
                                  style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 8,
                                    border: '1px solid rgba(244,63,94,0.3)',
                                    background: 'rgba(244,63,94,0.08)',
                                    color: '#f43f5e',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                  }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              );
                            })()
                          )}
                          <IconBtn icon={MoreHorizontal} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* CSV Import Modal (Portal with Banner & Unified Design Tokens) */}
      {importModalOpen && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999,
          background: 'rgba(11, 18, 32, 0.65)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px 16px',
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 24,
            width: '100%',
            maxWidth: 720,
            boxShadow: '0 30px 70px -15px rgba(8, 12, 28, 0.45)',
            overflow: 'hidden',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            animation: 'ep-rise .3s cubic-bezier(.2,.7,.3,1) both',
          }}>
            {/* Header Banner */}
            <div style={{
              position: 'relative',
              overflow: 'hidden',
              background: 'linear-gradient(115deg,#0b1220 0%,#0f1c2e 45%,#0a2a2a 100%)',
              padding: '24px 28px',
              borderBottom: '1px solid rgba(255,255,255,.08)',
            }}>
              <div style={{ position: 'absolute', top: -70, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(34,211,238,.2)', filter: 'blur(50px)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', bottom: -80, left: 70, width: 160, height: 160, borderRadius: '50%', background: 'rgba(99,102,241,.25)', filter: 'blur(50px)', pointerEvents: 'none' }} />

              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 16,
                    background: 'linear-gradient(135deg,#6366f1,#22d3ee)',
                    color: '#ffffff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 0 0 2px rgba(255,255,255,.12), 0 12px 24px -10px rgba(34,211,238,.6)',
                    flexShrink: 0,
                  }}>
                    <UploadCloud size={24} />
                  </div>
                  <div>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '3px 9px', borderRadius: 999,
                      background: 'rgba(34,211,238,.14)', border: '1px solid rgba(34,211,238,.32)',
                      color: '#a5f3fc', fontSize: '.6rem', fontWeight: 800, letterSpacing: '.12em',
                      marginBottom: 4,
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22d3ee' }} />
                      IMPORT ENGINE
                    </span>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', margin: 0, letterSpacing: '-0.02em' }}>
                      Import {meta.pluralDisplayName} from CSV
                    </h2>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => { setImportModalOpen(false); setSelectedFile(null); setParsedRecords([]); }}
                  style={{
                    background: 'rgba(255,255,255,.08)',
                    border: '1px solid rgba(255,255,255,.16)',
                    borderRadius: 10,
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#cbd5e1',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,.16)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.color = '#cbd5e1'; e.currentTarget.style.background = 'rgba(255,255,255,.08)'; }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Body Content */}
            <div style={{ padding: '24px 28px 20px' }}>
              {!selectedFile ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleFileProcess(e.dataTransfer.files[0]);
                    }
                  }}
                  style={{
                    border: isDragging ? '2.5px dashed #6366f1' : '2px dashed #cbd5e1',
                    borderRadius: 18,
                    padding: '38px 24px',
                    textAlign: 'center',
                    background: isDragging ? 'rgba(99,102,241,0.04)' : '#f8fafc',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={(e) => e.target.files?.[0] && handleFileProcess(e.target.files[0])}
                    style={{ display: 'none' }}
                  />
                  <div style={{
                    width: 52, height: 52, borderRadius: 16,
                    background: 'rgba(99,102,241,0.1)', color: '#6366f1',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 12,
                  }}>
                    <UploadCloud size={26} />
                  </div>
                  <div style={{ fontSize: '0.96rem', fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
                    Click or Drag &amp; Drop CSV file here
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 500 }}>
                    Upload comma-separated value spreadsheet (.csv)
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* File Info Bar */}
                  <div style={{
                    background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14,
                    padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,0.12)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FileSpreadsheet size={18} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>{selectedFile.name}</div>
                        <div style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 500 }}>{parsedRecords.length} records detected and mapped</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => { setSelectedFile(null); setParsedRecords([]); }}
                      style={{
                        padding: '5px 12px', borderRadius: 999, fontSize: '0.76rem', fontWeight: 700,
                        color: '#fb7185', background: '#fef2f2', border: '1px solid #fecaca', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}
                    >
                      <X size={13} /> Change File
                    </button>
                  </div>

                  {/* Preview Table */}
                  {parsedRecords.length > 0 && (
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden', maxHeight: 220, overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', sticky: 'top' }}>
                            <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>#</th>
                            <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Name</th>
                            <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Email</th>
                            <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Company</th>
                            <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Lead Source</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsedRecords.slice(0, 4).map((r, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                              <td style={{ padding: '10px 14px', fontWeight: 700, color: '#94a3b8' }}>{idx + 1}</td>
                              <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>{r.name || '—'}</td>
                              <td style={{ padding: '10px 14px', color: '#475569' }}>{r.email || '—'}</td>
                              <td style={{ padding: '10px 14px', color: '#475569' }}>{r.company || '—'}</td>
                              <td style={{ padding: '10px 14px' }}>
                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0284c7', background: '#e0f2fe', padding: '2px 8px', borderRadius: 999 }}>
                                  {r.lead_source || 'CSV Import'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Action Bar */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12,
              padding: '16px 28px', background: '#f8fafc', borderTop: '1px solid #e2e8f0',
            }}>
              <button
                type="button"
                onClick={() => { setImportModalOpen(false); setSelectedFile(null); setParsedRecords([]); }}
                style={{
                  padding: '10px 18px', borderRadius: 12, border: '1px solid #cbd5e1',
                  background: '#ffffff', color: '#475569', fontWeight: 600, fontSize: '0.84rem', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportSubmit}
                disabled={!selectedFile || parsedRecords.length === 0 || importing}
                style={{
                  padding: '10px 22px', borderRadius: 12, border: 'none',
                  background: (!selectedFile || parsedRecords.length === 0 || importing)
                    ? '#94a3b8'
                    : 'linear-gradient(135deg, #6366f1 0%, #22d3ee 100%)',
                  color: '#ffffff', fontWeight: 700, fontSize: '0.84rem',
                  cursor: (!selectedFile || parsedRecords.length === 0 || importing) ? 'not-allowed' : 'pointer',
                  boxShadow: (!selectedFile || parsedRecords.length === 0 || importing) ? 'none' : '0 8px 20px -6px rgba(99,102,241,0.5)',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                {importing ? (
                  <>
                    <RefreshCw size={15} style={{ animation: 'ep-spin .8s linear infinite' }} />
                    Importing Records…
                  </>
                ) : (
                  <>
                    <UploadCloud size={15} />
                    {`Import ${parsedRecords.length > 0 ? parsedRecords.length : ''} ${meta.pluralDisplayName}`}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Record Confirmation Custom Modal */}
      {deleteModalRecord && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999999,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            background: '#ffffff', borderRadius: 20, width: '100%', maxWidth: 420,
            padding: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(226, 232, 240, 0.8)', textAlign: 'center',
            position: 'relative',
          }}>
            <button 
              type="button" 
              onClick={() => { setDeleteModalRecord(null); setDeleteError(null); }}
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 6, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <X size={18} />
            </button>

            <div style={{
              width: 56, height: 56, borderRadius: '50%', background: '#ffe4e6',
              color: '#e11d48', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 16, boxShadow: '0 0 0 8px rgba(225, 29, 72, 0.08)'
            }}>
              <AlertTriangle size={28} />
            </div>

            <h3 className="font-display" style={{ margin: '0 0 8px 0', fontSize: 19, fontWeight: 700, color: '#0f172a' }}>
              Delete {meta.displayName}?
            </h3>

            <p style={{ margin: '0 0 20px 0', fontSize: '0.88rem', color: '#64748b', lineHeight: 1.5 }}>
              Are you sure you want to delete <strong style={{ color: '#0f172a' }}>"{deleteModalRecord.title}"</strong>? This action cannot be undone.
            </p>

            {deleteError && (
              <div style={{
                marginBottom: 16, padding: '10px 14px', borderRadius: 10,
                background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
                fontSize: '0.82rem', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8
              }}>
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <span>{deleteError}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={() => { setDeleteModalRecord(null); setDeleteError(null); }}
                disabled={deleting}
                style={{
                  flex: 1, height: 44, borderRadius: 12, border: '1px solid #cbd5e1',
                  background: '#ffffff', color: '#334155', fontWeight: 600, fontSize: '0.88rem',
                  cursor: 'pointer', transition: 'all 0.15s ease'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteRecord}
                disabled={deleting}
                style={{
                  flex: 1, height: 44, borderRadius: 12, border: 'none',
                  background: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
                  color: '#ffffff', fontWeight: 600, fontSize: '0.88rem',
                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: '0 4px 12px rgba(225, 29, 72, 0.25)', transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
                onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
              >
                {deleting ? (
                  <span>Deleting…</span>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>Delete Record</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* In-App Toast Notification Banner */}
      {toastMessage && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', bottom: 30, right: 30, zIndex: 9999999,
          background: (typeof toastMessage === 'object' && toastMessage.type === 'error') ? '#fef2f2' : '#ffffff',
          color: (typeof toastMessage === 'object' && toastMessage.type === 'error') ? '#991b1b' : '#0f172a',
          padding: '14px 22px',
          borderRadius: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: (typeof toastMessage === 'object' && toastMessage.type === 'error')
            ? '0 20px 45px -10px rgba(239, 68, 68, 0.3), 0 8px 16px -4px rgba(0, 0, 0, 0.08)'
            : '0 20px 45px -10px rgba(99, 102, 241, 0.3), 0 8px 16px -4px rgba(0, 0, 0, 0.08)',
          border: (typeof toastMessage === 'object' && toastMessage.type === 'error') ? '1.5px solid #fecaca' : '1.5px solid #a7f3d0',
          fontSize: '0.9rem',
          fontWeight: 700,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          animation: 'cp-rise .3s cubic-bezier(.2,.7,.3,1) both',
        }}>
          <div style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: (typeof toastMessage === 'object' && toastMessage.type === 'error') ? '#fee2e2' : '#d1fae5',
            color: (typeof toastMessage === 'object' && toastMessage.type === 'error') ? '#dc2626' : '#059669',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            {(typeof toastMessage === 'object' && toastMessage.type === 'error') ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          </div>
          <span>{typeof toastMessage === 'object' ? toastMessage.text : toastMessage}</span>
        </div>,
        document.body
      )}
    </div>
  );
}

function OverviewPage() {
  const { objectTypeId } = useParams();
  if (objectTypeId) {
    const keyLower = String(objectTypeId).toLowerCase();
    if (keyLower.includes('qr') || keyLower.includes('scan')) {
      return <LeadQRScannerContent />;
    }
    return <ObjectListContent objectTypeId={objectTypeId} />;
  }
  return <DashboardContent />;
}

export default OverviewPage;
