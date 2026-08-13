import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useWorkspace } from '../../context/WorkspaceContext';
import { apiGet, apiPost, apiDelete } from '../../api/client';
import {
  Megaphone, Plus, Search, Trash2, BarChart2, Check, ArrowRight, ArrowLeft,
  X, Send, RefreshCw, Mail, Eye, TrendingUp, Clock,
  CheckCircle2, AlertCircle
} from 'lucide-react';

/* ──────────────────────────────────────────
   INLINE STYLES & CONSTANTS
────────────────────────────────────────── */
const labelStyle = {
  display: 'block',
  fontSize: '0.7rem',
  fontWeight: 700,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '6px',
};

const inputBase = {
  width: '100%',
  padding: '0 14px',
  fontSize: '0.875rem',
  fontWeight: 500,
  color: '#0f172a',
  backgroundColor: '#ffffff',
  border: '1.5px solid #e2e8f0',
  borderRadius: '12px',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
  height: '44px',
};

const EMAIL_TEMPLATES = [
  {
    id: 'welcome_email',
    title: 'Welcome Email',
    category: 'Onboarding',
    emoji: '👋',
    accent: '#7c3aed',
    bg: 'linear-gradient(140deg, #1e1b4b 0%, #312e81 60%, #4c1d95 100%)',
    headerText: 'Welcome aboard!',
    headerSub: "We're thrilled to have you",
    subject: 'Welcome to Our Company!',
    body: `Dear [Recipient Name],\n\nWelcome to our company! We're excited to have you as part of our community.\n\nBest regards,\nThe Team`,
  },
  {
    id: 'product_promo',
    title: 'Product Promotion',
    category: 'Special Offer',
    emoji: '🔥',
    accent: '#ea580c',
    bg: 'linear-gradient(140deg, #7c2d12 0%, #c2410c 55%, #ea580c 100%)',
    headerText: 'LIMITED OFFER 40% OFF',
    headerSub: 'Exclusive deal — today only',
    subject: 'Special Offer: 40% Discount!',
    body: `Hi [Recipient Name],\n\nWe are excited to announce a special 40% discount on our premier products! Don't miss out on this limited-time offer.\n\nUse Code: SAVE40`,
  },
  {
    id: 'newsletter',
    title: 'Monthly Newsletter',
    category: 'Update',
    emoji: '📰',
    accent: '#0369a1',
    bg: 'linear-gradient(140deg, #0c4a6e 0%, #0369a1 55%, #0284c7 100%)',
    headerText: 'MONTHLY NEWSLETTER',
    headerSub: 'Latest updates & insights',
    subject: 'CRM Lite Monthly Updates',
    body: `Hello,\n\nHere are the top product updates, features, and community highlights for this month.\n\nThank you for growing with us!`,
  },
  {
    id: 'event_invitation',
    title: 'Event Invitation',
    category: 'VIP Event',
    emoji: '🎟️',
    accent: '#b45309',
    bg: 'linear-gradient(140deg, #1c1917 0%, #292524 55%, #44403c 100%)',
    headerText: 'YOU ARE INVITED',
    headerSub: 'Exclusive VIP Summit',
    subject: 'Exclusive Invitation: VIP Annual Summit',
    body: `Dear Member,\n\nYou are cordially invited to our upcoming Annual VIP Leadership Summit.\n\nPlease RSVP below to confirm your attendance.`,
  },
];

/* ── Status Badge Config ── */
function getStatusBadge(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('submit') || s.includes('form')) {
    return { label: 'Form Submitted', icon: '📝', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', dot: '#3b82f6' };
  }
  if (s.includes('open')) {
    return { label: 'Opened', icon: '👁️', bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', dot: '#22c55e' };
  }
  return { label: 'Sent', icon: '✈️', bg: '#f8fafc', color: '#475569', border: '#e2e8f0', dot: '#94a3b8' };
}

/* ── Metric Card ── */
function MetricCard({ label, value, sub, icon, color, bg }) {
  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: 20,
        padding: '22px 24px',
        border: '1px solid #f1f5f9',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute', top: 0, right: 0,
          width: 120, height: 120,
          background: bg,
          borderRadius: '0 20px 0 100%',
          opacity: 0.45,
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
        <div
          style={{
            width: 36, height: 36, borderRadius: 11,
            background: bg, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            color, fontSize: 16,
          }}
        >
          {icon}
        </div>
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', lineHeight: 1, position: 'relative' }}>{value}</div>
      <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 500, position: 'relative' }}>{sub}</div>
    </div>
  );
}

/* ── Campaign Row Card ── */
function CampaignCard({ campaign, onTrack, onDelete, canDelete = true }) {
  const [hov, setHov] = useState(false);
  const badge = getStatusBadge(campaign.status);
  const recipientCount = campaign.target_emails?.length || campaign.total_sent || 0;

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: '#ffffff',
        borderRadius: 18,
        padding: '18px 22px',
        border: `1px solid ${hov ? '#c7d2fe' : '#f1f5f9'}`,
        boxShadow: hov
          ? '0 8px 32px rgba(99,102,241,0.1)'
          : '0 1px 3px rgba(0,0,0,0.04)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        transition: 'all 0.2s ease',
        transform: hov ? 'translateY(-1px)' : 'none',
      }}
    >
      {/* Left: Icon + Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0, flex: 1 }}>
        <div
          style={{
            width: 46, height: 46, borderRadius: 14, flexShrink: 0,
            background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 16px rgba(99,102,241,0.25)',
          }}
        >
          <Mail size={20} color="#fff" />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240 }}>
              {campaign.name}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', flexShrink: 0 }}>
              {recipientCount} {recipientCount === 1 ? 'recipient' : 'recipients'}
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 340 }}>
            <span style={{ color: '#94a3b8' }}>Subject: </span>
            {campaign.subject || 'No Subject'}
          </div>
          <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 3, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={10} />
            {campaign.sent_at ? new Date(campaign.sent_at).toLocaleString() : 'Sent recently'}
          </div>
        </div>
      </div>

      {/* Right: Badge + Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {/* Status Badge */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 12px', borderRadius: 99,
            background: badge.bg, border: `1px solid ${badge.border}`,
          }}
        >
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: badge.dot }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: badge.color }}>
            {badge.icon} {badge.label}
          </span>
        </div>

        {/* Tracking button */}
        <button
          onClick={() => onTrack(campaign)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '7px 14px', borderRadius: 11,
            fontSize: 12, fontWeight: 700,
            color: '#4f46e5',
            background: 'rgba(99,102,241,0.07)',
            border: '1px solid rgba(99,102,241,0.15)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <BarChart2 size={13} /> Analytics
        </button>

        {/* Delete button */}
        {canDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(campaign.id, e); }}
            style={{
              width: 34, height: 34, borderRadius: 10,
              background: '#fff1f2', border: '1px solid #fecdd3',
              color: '#e11d48',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.15s ease',
            }}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────
   MAIN PAGE COMPONENT
──────────────────────────────────────────────────── */
function CampaignsPage() {
  const workspace = useWorkspace() || {};
  const permissions = workspace.permissions;
  const campaignPerm = permissions?.campaign || permissions?.campaigns;

  const canRead = campaignPerm?.canRead !== false;
  const canCreate = campaignPerm?.canCreate !== false && campaignPerm?.canUpdate !== false;
  const canDelete = campaignPerm?.canDelete !== false;

  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState(EMAIL_TEMPLATES[0]);
  const [formData, setFormData] = useState({
    name: '', subject: EMAIL_TEMPLATES[0].subject, body: EMAIL_TEMPLATES[0].body, target_emails: '',
  });
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [trackingCampaign, setTrackingCampaign] = useState(null);

  useEffect(() => { fetchCampaigns(); }, []);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const data = await apiGet('/api/campaigns');
      setCampaigns(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch campaigns:', err);
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = () => {
    if (!canCreate) {
      alert('You do not have permissions to create or send campaigns.');
      return;
    }
    const t = EMAIL_TEMPLATES[0];
    setSelectedTemplate(t);
    setFormData({ name: '', subject: t.subject, body: t.body, target_emails: '' });
    setStep(1);
    setErrorMsg('');
    setSuccessMsg('');
    setModalOpen(true);
  };

  const handleSelectTemplate = (tpl) => {
    setSelectedTemplate(tpl);
    setFormData(prev => ({ ...prev, subject: tpl.subject, body: tpl.body }));
  };

  const handleSendCampaign = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) { setErrorMsg('Campaign name is required.'); return; }
    if (!formData.subject.trim()) { setErrorMsg('Email subject is required.'); return; }
    if (!formData.target_emails.trim()) { setErrorMsg('At least one target email is required.'); return; }

    setSending(true);
    setErrorMsg('');

    try {
      await apiPost('/api/campaigns/send', {
        name: formData.name.trim(),
        subject: formData.subject.trim(),
        body: formData.body,
        template_id: selectedTemplate.id,
        template_name: selectedTemplate.title,
        target_emails: formData.target_emails,
      });
      setModalOpen(false);
      setSuccessMsg('Campaign dispatched successfully!');
      setTimeout(() => setSuccessMsg(''), 3500);
      fetchCampaigns();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to dispatch campaign.');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteCampaign = async (id, e) => {
    e?.stopPropagation();
    if (!window.confirm('Delete this campaign permanently?')) return;
    try {
      await apiDelete(`/api/campaigns/${id}`);
      setCampaigns(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      alert('Delete failed: ' + (err.message || 'Unknown error'));
    }
  };

  /* Metrics */
  const totalSent = campaigns.reduce((a, c) => a + (c.total_sent || c.target_emails?.length || 0), 0);
  const totalOpens = campaigns.reduce((a, c) => a + (c.opened_count || 0), 0);
  const totalSubmissions = campaigns.filter(c => String(c.status || '').toLowerCase().includes('submit')).length;
  const openRate = totalSent > 0 ? Math.round((totalOpens / totalSent) * 100) : 0;

  /* Filtered list */
  const filtered = campaigns.filter(c => {
    const q = searchQuery.toLowerCase();
    const matches = (c.name || '').toLowerCase().includes(q) || (c.subject || '').toLowerCase().includes(q);
    if (!matches) return false;
    const s = String(c.status || '').toLowerCase();
    if (activeTab === 'submitted') return s.includes('submit');
    if (activeTab === 'opened') return s.includes('open');
    if (activeTab === 'sent') return !s.includes('submit') && !s.includes('open');
    return true;
  });

  const TABS = [
    { id: 'all', label: 'All', count: campaigns.length },
    { id: 'submitted', label: 'Form Submitted', count: campaigns.filter(c => String(c.status || '').toLowerCase().includes('submit')).length },
    { id: 'opened', label: 'Opened', count: campaigns.filter(c => String(c.status || '').toLowerCase().includes('open')).length },
    { id: 'sent', label: 'Sent', count: campaigns.filter(c => { const s = String(c.status || '').toLowerCase(); return !s.includes('submit') && !s.includes('open'); }).length },
  ];

  if (permissions && !canRead) {
    return (
      <div style={{ padding: '60px 36px', maxWidth: 800, margin: '0 auto', textAlign: 'center', fontFamily: "'Inter', -apple-system, sans-serif" }}>
        <div style={{
          background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 20,
          padding: '48px 32px', color: '#be123c', boxShadow: '0 8px 24px rgba(225,29,72,0.08)'
        }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: 'rgba(225,29,72,0.1)', color: '#e11d48', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <AlertCircle size={28} />
          </div>
          <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800, color: '#9f1239' }}>Access Denied</h2>
          <p style={{ margin: 0, fontSize: 14, color: '#be123c', fontWeight: 500 }}>
            Please check with your administrator. You do not have permissions to read campaigns.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 36px 48px', maxWidth: 1200, margin: '0 auto', fontFamily: "'Inter', -apple-system, sans-serif" }}>

      {/* ── Success Toast ── */}
      {successMsg && (
        <div style={{
          position: 'fixed', top: 20, right: 24, zIndex: 2000,
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 20px', borderRadius: 14,
          background: '#f0fdf4', border: '1px solid #bbf7d0',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          color: '#15803d', fontWeight: 700, fontSize: 14,
          animation: 'fadeInDown 0.3s ease',
        }}>
          <CheckCircle2 size={18} /> {successMsg}
        </div>
      )}

      {/* ── Page Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 20px rgba(99,102,241,0.3)',
            }}>
              <Megaphone size={22} color="#ffffff" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.025em' }}>Email Campaigns</h1>
              <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>
                Send rich email campaigns, track opens & auto-generate leads.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={fetchCampaigns}
            style={{
              width: 40, height: 40, borderRadius: 12,
              background: '#ffffff', border: '1px solid #e2e8f0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#64748b', transition: 'all 0.15s ease',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
          {canCreate && (
            <button
              onClick={handleOpenModal}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 22px', borderRadius: 13,
                fontSize: 13.5, fontWeight: 700, color: '#ffffff',
                background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
                border: 'none', cursor: 'pointer',
                boxShadow: '0 6px 20px rgba(99,102,241,0.35)',
                transition: 'all 0.2s ease',
              }}
            >
              <Plus size={17} /> New Campaign
            </button>
          )}
        </div>
      </div>

      {/* ── Metrics Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        <MetricCard
          label="Total Campaigns"
          value={campaigns.length}
          sub="Active marketing flows"
          icon={<Megaphone size={16} />}
          color="#6366f1"
          bg="rgba(99,102,241,0.12)"
        />
        <MetricCard
          label="Emails Dispatched"
          value={totalSent}
          sub="Recipients reached"
          icon={<Mail size={16} />}
          color="#3b82f6"
          bg="rgba(59,130,246,0.12)"
        />
        <MetricCard
          label="Email Open Rate"
          value={`${openRate}%`}
          sub={`${totalOpens} link interactions`}
          icon={<Eye size={16} />}
          color="#10b981"
          bg="rgba(16,185,129,0.12)"
        />
        <MetricCard
          label="Leads Captured"
          value={totalSubmissions}
          sub="Form submissions received"
          icon={<TrendingUp size={16} />}
          color="#f59e0b"
          bg="rgba(245,158,11,0.12)"
        />
      </div>

      {/* ── Search + Tab Filters ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', width: 300 }}>
          <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              ...inputBase,
              paddingLeft: 38,
              background: '#ffffff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          />
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 4,
          background: '#f8fafc', padding: '4px',
          borderRadius: 13, border: '1px solid #f1f5f9',
        }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '6px 14px', borderRadius: 10,
                fontSize: 12.5, fontWeight: 700,
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                background: activeTab === t.id ? '#ffffff' : 'transparent',
                color: activeTab === t.id ? '#0f172a' : '#94a3b8',
                boxShadow: activeTab === t.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              {t.label}
              <span style={{
                fontSize: 10.5, fontWeight: 800,
                padding: '1px 6px', borderRadius: 99,
                background: activeTab === t.id ? '#f1f5f9' : 'transparent',
                color: activeTab === t.id ? '#475569' : '#cbd5e1',
              }}>
                {t.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Campaign List ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', background: '#ffffff', borderRadius: 20, border: '1px solid #f1f5f9' }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(99,102,241,0.1)', color: '#6366f1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <RefreshCw size={20} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Loading campaigns...</div>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>Fetching your campaign data</div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '72px 20px', background: '#ffffff', borderRadius: 20, border: '1.5px dashed #e2e8f0' }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: 'rgba(99,102,241,0.08)', color: '#6366f1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Megaphone size={26} />
          </div>
          <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: '#0f172a' }}>
            {campaigns.length === 0
              ? 'No campaigns yet'
              : searchQuery
              ? 'No matching campaigns'
              : `No ${TABS.find(t => t.id === activeTab)?.label || ''} campaigns`}
          </h3>
          <p style={{ margin: '0 0 22px', fontSize: 13.5, color: '#94a3b8', maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}>
            {campaigns.length === 0
              ? 'Create your first campaign and start reaching your audience with beautiful email templates.'
              : searchQuery
              ? `No campaign matches "${searchQuery}".`
              : `There are currently no campaigns with status "${TABS.find(t => t.id === activeTab)?.label}".`}
          </p>
          {campaigns.length === 0 ? (
            canCreate && (
              <button
                onClick={handleOpenModal}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '10px 22px', borderRadius: 12,
                  fontSize: 13.5, fontWeight: 700, color: '#ffffff',
                  background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
                  border: 'none', cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(99,102,241,0.3)',
                }}
              >
                <Plus size={16} /> Create First Campaign
              </button>
            )
          ) : (
            <button
              onClick={() => { setActiveTab('all'); setSearchQuery(''); }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '10px 22px', borderRadius: 12,
                fontSize: 13.5, fontWeight: 700, color: '#6366f1',
                background: 'rgba(99,102,241,0.08)',
                border: '1px solid rgba(99,102,241,0.2)', cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Show All Campaigns ({campaigns.length})
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(c => (
            <CampaignCard
              key={c.id}
              campaign={c}
              onTrack={setTrackingCampaign}
              onDelete={handleDeleteCampaign}
              canDelete={canDelete}
            />
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════
          CAMPAIGN CREATOR MODAL
      ══════════════════════════════════════════════ */}
      {modalOpen && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, left: 260, zIndex: 1000,
          background: 'rgba(15,23,42,0.7)',
          backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}>
          <div style={{
            background: '#ffffff', borderRadius: 24,
            width: '100%', maxWidth: 800,
            maxHeight: '92vh', overflowY: 'auto',
            boxShadow: '0 32px 80px rgba(0,0,0,0.25)',
            padding: 32,
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
              <div>
                <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800, color: '#0f172a' }}>
                  {step === 1 ? 'Choose Email Template' : 'Campaign Details & Recipients'}
                </h2>
                <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>
                  {step === 1 ? 'Pick a pre-designed template for your campaign' : 'Customize your message and add target recipients'}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Step Indicator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {[1, 2].map(s => (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: step >= s ? 'linear-gradient(135deg, #6366f1, #3b82f6)' : '#f1f5f9',
                        color: step >= s ? '#fff' : '#94a3b8',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 800,
                        boxShadow: step >= s ? '0 4px 10px rgba(99,102,241,0.3)' : 'none',
                      }}>
                        {s}
                      </div>
                      {s === 1 && <div style={{ width: 28, height: 2, borderRadius: 99, background: step === 2 ? '#6366f1' : '#e2e8f0' }} />}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setModalOpen(false)}
                  style={{ width: 34, height: 34, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={16} color="#64748b" />
                </button>
              </div>
            </div>

            {errorMsg && (
              <div style={{ padding: '12px 16px', borderRadius: 12, background: '#fff1f2', border: '1px solid #fecdd3', color: '#be123c', fontSize: 13, fontWeight: 600, marginBottom: 22, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={16} /> {errorMsg}
              </div>
            )}

            {/* STEP 1: Template Grid */}
            {step === 1 && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 28 }}>
                  {EMAIL_TEMPLATES.map(tpl => {
                    const sel = selectedTemplate.id === tpl.id;
                    return (
                      <div
                        key={tpl.id}
                        onClick={() => handleSelectTemplate(tpl)}
                        style={{
                          borderRadius: 18,
                          border: sel ? '2.5px solid #6366f1' : '1.5px solid #f1f5f9',
                          background: '#ffffff',
                          padding: 14,
                          cursor: 'pointer',
                          position: 'relative',
                          transition: 'all 0.18s ease',
                          boxShadow: sel ? '0 8px 28px rgba(99,102,241,0.15)' : '0 1px 3px rgba(0,0,0,0.04)',
                          transform: sel ? 'scale(1.01)' : 'scale(1)',
                        }}
                      >
                        {/* Visual Preview */}
                        <div style={{
                          height: 96, borderRadius: 12, background: tpl.bg,
                          padding: '12px 16px', marginBottom: 12, position: 'relative', overflow: 'hidden',
                        }}>
                          <div style={{ position: 'absolute', top: -10, right: -10, width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' }}>CRM Lite</span>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: 'rgba(255,255,255,0.18)', color: '#fff' }}>{tpl.category}</span>
                          </div>
                          <div style={{ position: 'absolute', bottom: 12, left: 16 }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: '#ffffff', lineHeight: 1.2 }}>{tpl.headerText}</div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>{tpl.headerSub}</div>
                          </div>
                          <div style={{ position: 'absolute', bottom: 12, right: 14, fontSize: 22 }}>{tpl.emoji}</div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{tpl.title}</div>
                            <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 1 }}>{tpl.subject}</div>
                          </div>
                          {sel && (
                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Check size={13} color="#fff" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button onClick={() => setModalOpen(false)} style={{ padding: '10px 20px', borderRadius: 11, fontSize: 13.5, fontWeight: 600, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={() => setStep(2)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 24px', borderRadius: 11, fontSize: 13.5, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg, #6366f1, #3b82f6)', border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(99,102,241,0.35)' }}>
                    Next: Fill Details <ArrowRight size={15} />
                  </button>
                </div>
              </>
            )}

            {/* STEP 2: Campaign Details Form */}
            {step === 2 && (
              <form onSubmit={handleSendCampaign} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Selected Template Pill */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1' }} />
                  <span style={{ fontSize: 12.5, color: '#64748b', fontWeight: 600 }}>Template:</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>{selectedTemplate.title} {selectedTemplate.emoji}</span>
                  <button type="button" onClick={() => setStep(1)} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 12, fontWeight: 700, color: '#6366f1', cursor: 'pointer' }}>Change</button>
                </div>

                <div>
                  <label style={labelStyle}>Campaign Name *</label>
                  <input type="text" required placeholder="e.g. Summer Sale 2026" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} style={inputBase} />
                </div>

                <div>
                  <label style={labelStyle}>Email Subject Line *</label>
                  <input type="text" required placeholder="e.g. Exclusive Offer Just for You!" value={formData.subject} onChange={e => setFormData({ ...formData, subject: e.target.value })} style={inputBase} />
                </div>

                <div>
                  <label style={labelStyle}>Email Body Message</label>
                  <textarea
                    rows={4}
                    placeholder="Enter your email content here..."
                    value={formData.body}
                    onChange={e => setFormData({ ...formData, body: e.target.value })}
                    style={{ ...inputBase, height: 'auto', minHeight: 100, padding: '12px 14px', resize: 'vertical', lineHeight: 1.6 }}
                  />
                  <p style={{ margin: '5px 0 0', fontSize: 11.5, color: '#94a3b8' }}>
                    💡 A personalized response form link and open-tracking pixel will be appended automatically.
                  </p>
                </div>

                <div>
                  <label style={labelStyle}>Target Recipient Emails *</label>
                  <textarea
                    rows={2}
                    required
                    placeholder="user1@company.com, user2@company.com, user3@company.com"
                    value={formData.target_emails}
                    onChange={e => setFormData({ ...formData, target_emails: e.target.value })}
                    style={{ ...inputBase, height: 'auto', minHeight: 72, padding: '12px 14px' }}
                  />
                  <p style={{ margin: '5px 0 0', fontSize: 11.5, color: '#94a3b8' }}>
                    Separate multiple emails with commas. Each recipient gets a unique trackable form link.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
                  <button type="button" onClick={() => setStep(1)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 11, fontSize: 13.5, fontWeight: 600, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', cursor: 'pointer' }}>
                    <ArrowLeft size={15} /> Back
                  </button>
                  <button type="submit" disabled={sending} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 12, fontSize: 14, fontWeight: 700, color: '#fff', background: sending ? '#94a3b8' : 'linear-gradient(135deg, #6366f1, #3b82f6)', border: 'none', cursor: sending ? 'not-allowed' : 'pointer', boxShadow: sending ? 'none' : '0 6px 18px rgba(99,102,241,0.35)', transition: 'all 0.2s ease' }}>
                    <Send size={15} /> {sending ? 'Dispatching...' : 'Send Campaign'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      , document.body)}

      {/* ══════════════════════════════════════════════
          TRACKING ANALYTICS MODAL
      ══════════════════════════════════════════════ */}
      {trackingCampaign && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, left: 260, zIndex: 1000,
          background: 'rgba(15,23,42,0.7)',
          backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}>
          <div style={{
            background: '#ffffff', borderRadius: 24,
            width: '100%', maxWidth: 600,
            boxShadow: '0 32px 80px rgba(0,0,0,0.25)',
            overflow: 'hidden',
          }}>
            {/* Modal Header Banner */}
            <div style={{
              background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
              padding: '24px 28px',
              color: '#ffffff',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
                    📊 Campaign Analytics
                  </div>
                  <h3 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
                    {trackingCampaign.name}
                  </h3>
                  <p style={{ margin: 0, fontSize: 12.5, color: 'rgba(255,255,255,0.5)' }}>
                    Dispatched {trackingCampaign.sent_at ? new Date(trackingCampaign.sent_at).toLocaleString() : 'recently'}
                  </p>
                </div>
                <button
                  onClick={() => setTrackingCampaign(null)}
                  style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.12)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Stats Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 20 }}>
                {[
                  { label: 'Sent', value: trackingCampaign.total_sent || trackingCampaign.target_emails?.length || 0, color: 'rgba(255,255,255,0.9)' },
                  { label: 'Opened', value: trackingCampaign.opened_count || 0, color: '#34d399' },
                  { label: 'Status', value: trackingCampaign.status || 'Sent', color: '#93c5fd', isText: true },
                ].map((stat, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: '14px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>{stat.label}</div>
                    <div style={{ fontSize: stat.isText ? 14 : 26, fontWeight: 800, color: stat.color, letterSpacing: stat.isText ? 0 : '-0.02em' }}>{stat.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recipients List */}
            <div style={{ padding: '24px 28px 28px' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>
                Recipient Tracking Status
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
                {(() => {
                  const emails = Array.isArray(trackingCampaign.target_emails) ? trackingCampaign.target_emails : [];
                  const tracking = Array.isArray(trackingCampaign.tracking) ? trackingCampaign.tracking : [];
                  const items = emails.length > 0
                    ? emails.map(email => {
                        const match = tracking.find(t => String(t.email).toLowerCase() === String(email).toLowerCase());
                        return { email, status: match?.status || 'Sent' };
                      })
                    : tracking.map(t => ({ email: t.email, status: t.status || 'Sent' }));

                  if (items.length === 0) {
                    return <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: 13 }}>No recipient data yet.</div>;
                  }

                  return items.map((item, idx) => {
                    const badge = getStatusBadge(item.status);
                    return (
                      <div key={idx} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 16px', borderRadius: 13,
                        background: '#f8fafc', border: '1px solid #f1f5f9',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(99,102,241,0.1)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Mail size={15} />
                          </div>
                          <span style={{ fontSize: 13.5, fontWeight: 600, color: '#1e293b' }}>{item.email}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 99, background: badge.bg, border: `1px solid ${badge.border}` }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: badge.dot }} />
                          <span style={{ fontSize: 12, fontWeight: 700, color: badge.color }}>{badge.icon} {badge.label}</span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              <button
                onClick={() => setTrackingCampaign(null)}
                style={{ marginTop: 20, width: '100%', padding: '12px', borderRadius: 13, fontSize: 14, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg, #6366f1, #3b82f6)', border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(99,102,241,0.3)' }}
              >
                Close Analytics
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
}

export default CampaignsPage;
