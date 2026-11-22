import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { apiGet, apiPost, apiDelete } from '../../api/client';
import { EMAIL_TEMPLATES, buildTemplateHtml } from '../../templates/emailTemplates';
import {
  Megaphone, Plus, Search, Trash2, BarChart2, Check, ArrowRight, ArrowLeft,
  X, Send, RefreshCw, Mail, Eye, TrendingUp, Clock,
  CheckCircle2, AlertCircle, AlertTriangle, Code, FileCode,
  Smartphone, Monitor, RotateCcw, Sliders, Layout, Sparkles, Type
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

/* ── Status Badge Config ── */
function getStatusBadge(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('fail')) {
    return { label: 'Failed', icon: '❌', bg: '#fef2f2', color: '#dc2626', border: '#fecaca', dot: '#ef4444' };
  }
  if (s.includes('partial')) {
    return { label: 'Partially Sent', icon: '⚠️', bg: '#fffbeb', color: '#b45309', border: '#fde68a', dot: '#f59e0b' };
  }
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
function CampaignCard({ campaign, onTrack, onDelete, canDelete = true, onCardClick }) {
  const [hov, setHov] = useState(false);
  const badge = getStatusBadge(campaign.status);
  const recipientCount = campaign.target_emails?.length || campaign.total_sent || 0;

  return (
    <div
      onClick={onCardClick}
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
          onClick={(e) => { e.stopPropagation(); onTrack(campaign); }}
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
            onClick={(e) => { e.stopPropagation(); onDelete(campaign, e); }}
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
  const navigate = useNavigate();
  const workspace = useWorkspace() || {};
  const { user } = useAuth() || {};
  const permissions = workspace.permissions;
  const campaignPerm = permissions?.campaign || permissions?.campaigns;

  const canRead = campaignPerm?.canRead !== false;
  const canCreate = campaignPerm?.canCreate !== false && campaignPerm?.canUpdate !== false;
  const canDelete = campaignPerm?.canDelete !== false;

  // Resolve user's actual company / organization name for clean prefilling
  const companyName = (workspace?.company?.name && workspace?.company?.name !== 'Acme Corp')
    ? workspace.company.name
    : (user?.organization_name || user?.company_name || 'TechMantra');

  const resolveCompanyTag = (val) => {
    if (typeof val !== 'string') return val || '';
    return val.replace(/\{\{\s*company\s*\}\}/gi, companyName);
  };

  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState(EMAIL_TEMPLATES[0]);
  const [editorMode, setEditorMode] = useState('form'); // 'form' (structured inputs) | 'code' (raw HTML)
  const [previewDevice, setPreviewDevice] = useState('desktop'); // 'desktop' | 'mobile'

  const initialTemplate = EMAIL_TEMPLATES[0];
  const initialFields = initialTemplate.defaultFields || {};
  const resolvedInitialFields = {
    ...initialFields,
    headline: resolveCompanyTag(initialFields.headline || ''),
    subheadline: resolveCompanyTag(initialFields.subheadline || ''),
    body: resolveCompanyTag(initialFields.body || ''),
    footerSignoff: resolveCompanyTag(initialFields.footerSignoff || ''),
  };

  const [formData, setFormData] = useState({
    name: '',
    subject: resolveCompanyTag(initialTemplate.subject),
    headline: resolvedInitialFields.headline || '',
    subheadline: resolvedInitialFields.subheadline || '',
    body: resolvedInitialFields.body || '',
    buttonText: resolvedInitialFields.buttonText || '',
    buttonUrl: resolvedInitialFields.buttonUrl || '{{form_link}}',
    promoCode: resolvedInitialFields.promoCode || '',
    footerSignoff: resolvedInitialFields.footerSignoff || '',
    custom_html: buildTemplateHtml(initialTemplate.id, resolvedInitialFields),
    target_emails: '',
  });
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [deleteModalCampaign, setDeleteModalCampaign] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

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
    const def = t.defaultFields || {};
    const resolvedDef = {
      ...def,
      headline: resolveCompanyTag(def.headline || ''),
      subheadline: resolveCompanyTag(def.subheadline || ''),
      body: resolveCompanyTag(def.body || ''),
      footerSignoff: resolveCompanyTag(def.footerSignoff || ''),
    };
    setSelectedTemplate(t);
    setEditorMode('form');
    setPreviewDevice('desktop');
    setFormData({
      name: '',
      subject: resolveCompanyTag(t.subject),
      headline: resolvedDef.headline || '',
      subheadline: resolvedDef.subheadline || '',
      body: resolvedDef.body || '',
      buttonText: resolvedDef.buttonText || '',
      buttonUrl: resolvedDef.buttonUrl || '{{form_link}}',
      promoCode: resolvedDef.promoCode || '',
      footerSignoff: resolvedDef.footerSignoff || '',
      custom_html: buildTemplateHtml(t.id, resolvedDef),
      target_emails: '',
    });
    setStep(0);
    setErrorMsg('');
    setSuccessMsg('');
    setModalOpen(true);
  };

  const handleSelectTemplate = (tpl) => {
    setSelectedTemplate(tpl);
    const def = tpl.defaultFields || {};
    const resolvedDef = {
      ...def,
      headline: resolveCompanyTag(def.headline || ''),
      subheadline: resolveCompanyTag(def.subheadline || ''),
      body: resolveCompanyTag(def.body || ''),
      footerSignoff: resolveCompanyTag(def.footerSignoff || ''),
    };
    const compiled = buildTemplateHtml(tpl.id, resolvedDef);
    setFormData(prev => ({
      ...prev,
      subject: resolveCompanyTag(tpl.subject),
      headline: resolvedDef.headline || '',
      subheadline: resolvedDef.subheadline || '',
      body: resolvedDef.body || '',
      buttonText: resolvedDef.buttonText || '',
      buttonUrl: resolvedDef.buttonUrl || '{{form_link}}',
      promoCode: resolvedDef.promoCode || '',
      footerSignoff: resolvedDef.footerSignoff || '',
      custom_html: compiled,
    }));
  };

  const updateFormField = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      // If we are in structured form mode, regenerate custom_html so preview updates live
      if (editorMode === 'form') {
        updated.custom_html = buildTemplateHtml(selectedTemplate.id, {
          headline: updated.headline,
          subheadline: updated.subheadline,
          body: updated.body,
          buttonText: updated.buttonText,
          buttonUrl: updated.buttonUrl,
          promoCode: updated.promoCode,
          footerSignoff: updated.footerSignoff,
        });
      }
      return updated;
    });
  };

  const handleInsertTag = (tag) => {
    if (editorMode === 'code') {
      setFormData(prev => ({
        ...prev,
        custom_html: (prev.custom_html || '') + tag,
      }));
    } else {
      // Append to body by default
      setFormData(prev => {
        const newBody = (prev.body || '') + ' ' + tag;
        return {
          ...prev,
          body: newBody,
          custom_html: buildTemplateHtml(selectedTemplate.id, {
            headline: prev.headline,
            subheadline: prev.subheadline,
            body: newBody,
            buttonText: prev.buttonText,
            buttonUrl: prev.buttonUrl,
            promoCode: prev.promoCode,
            footerSignoff: prev.footerSignoff,
          }),
        };
      });
    }
  };

  const handleResetTemplate = () => {
    if (selectedTemplate) {
      const def = selectedTemplate.defaultFields || {};
      const resolvedDef = {
        ...def,
        headline: resolveCompanyTag(def.headline || ''),
        subheadline: resolveCompanyTag(def.subheadline || ''),
        body: resolveCompanyTag(def.body || ''),
        footerSignoff: resolveCompanyTag(def.footerSignoff || ''),
      };
      const compiled = buildTemplateHtml(selectedTemplate.id, resolvedDef);
      setFormData(prev => ({
        ...prev,
        headline: resolvedDef.headline || '',
        subheadline: resolvedDef.subheadline || '',
        body: resolvedDef.body || '',
        buttonText: resolvedDef.buttonText || '',
        buttonUrl: resolvedDef.buttonUrl || '{{form_link}}',
        promoCode: resolvedDef.promoCode || '',
        footerSignoff: resolvedDef.footerSignoff || '',
        custom_html: compiled,
      }));
    }
  };

  const handleSendCampaign = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.name.trim()) { setErrorMsg('Campaign name is required.'); return; }
    if (!formData.subject || !formData.subject.trim()) { setErrorMsg('Email subject is required.'); return; }
    if (!formData.target_emails || !formData.target_emails.trim()) { setErrorMsg('At least one target email is required.'); return; }

    let finalHtml = formData.custom_html;
    if (!finalHtml || !finalHtml.trim()) {
      finalHtml = buildTemplateHtml(selectedTemplate?.id || 'welcome_email', {
        headline: formData.headline,
        subheadline: formData.subheadline,
        body: formData.body,
        buttonText: formData.buttonText,
        buttonUrl: formData.buttonUrl,
        promoCode: formData.promoCode,
        footerSignoff: formData.footerSignoff,
      });
    }

    if (!finalHtml || !finalHtml.trim()) {
      setErrorMsg('Please select or provide an email template.');
      return;
    }

    setSending(true);
    setErrorMsg('');

    const templateTypeMap = {
      welcome_email: 'Welcome Email',
      product_promo: 'Product Promotion',
      newsletter: 'Monthly Newsletter',
      event_invitation: 'Event Invitation',
      custom_html: 'Custom HTML',
    };
    const campaignType = templateTypeMap[selectedTemplate?.id] || selectedTemplate?.title || 'Welcome Email';

    try {
      await apiPost('/api/campaigns/send', {
        name: formData.name.trim(),
        subject: formData.subject.trim(),
        html: finalHtml,
        type: campaignType,
        template_id: selectedTemplate?.id || 'welcome_email',
        template_name: selectedTemplate?.title || 'Email Campaign',
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

  const handleDeleteCampaign = (campaignOrId, e) => {
    e?.stopPropagation();
    const campaignObj = typeof campaignOrId === 'object' && campaignOrId !== null
      ? campaignOrId
      : campaigns.find(c => c.id === campaignOrId) || { id: campaignOrId, name: 'Campaign' };
    setDeleteModalCampaign(campaignObj);
    setDeleteError(null);
  };

  const confirmDeleteCampaign = async () => {
    if (!deleteModalCampaign) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiDelete(`/api/campaigns/${deleteModalCampaign.id}`);
      setCampaigns(prev => prev.filter(c => c.id !== deleteModalCampaign.id));
      setSuccessMsg(`"${deleteModalCampaign.name || 'Campaign'}" deleted successfully!`);
      setTimeout(() => setSuccessMsg(''), 3500);
      setDeleteModalCampaign(null);
    } catch (err) {
      console.error('Delete campaign error:', err);
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to delete campaign.';
      setDeleteError(errMsg);
    } finally {
      setDeleting(false);
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filtered.map(campaign => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onTrack={setTrackingCampaign}
                onDelete={handleDeleteCampaign}
                canDelete={canDelete}
                onCardClick={() => navigate(`/workspace/object/campaign/${campaign.id}`)}
              />
            ))}
          </div>
      )}

      {/* ══════════════════════════════════════════════
          CAMPAIGN CREATOR MODAL
      ══════════════════════════════════════════════ */}
      {modalOpen && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, zIndex: 1000,
          background: 'rgba(15,23,42,0.7)',
          backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: step === 2 ? 16 : 24,
        }}>
          <div style={{
            background: '#ffffff', borderRadius: 24,
            width: '100%',
            maxWidth: step === 2 ? 1220 : step === 1 ? 840 : 680,
            height: step === 2 ? '92vh' : 'auto',
            maxHeight: '94vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: step === 2 ? 'hidden' : 'auto',
            boxShadow: '0 32px 80px rgba(0,0,0,0.25)',
            padding: step === 2 ? '22px 28px' : 32,
            transition: 'max-width 0.2s ease',
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: step === 2 ? 18 : 28, flexShrink: 0 }}>
              <div>
                <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800, color: '#0f172a' }}>
                  {step === 0 ? 'Select Campaign Type' : step === 1 ? 'Choose Email Template' : 'Design & Dispatch Campaign'}
                </h2>
                <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>
                  {step === 0 ? 'Choose the type of campaign you want to create' : step === 1 ? 'Pick a pre-designed template for your campaign' : 'Customize template copy on the left and preview live rendering on the right'}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Step Indicator */}
                {step > 0 && (
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
                )}
                <button
                  onClick={() => setModalOpen(false)}
                  style={{ width: 34, height: 34, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={16} color="#64748b" />
                </button>
              </div>
            </div>

            {errorMsg && (
              <div style={{ padding: '12px 16px', borderRadius: 12, background: '#fff1f2', border: '1px solid #fecdd3', color: '#be123c', fontSize: 13, fontWeight: 600, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <AlertCircle size={16} /> {errorMsg}
              </div>
            )}

            {/* STEP 0: Campaign Type */}
            {step === 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
                <div
                  onClick={() => setStep(1)}
                  style={{
                    borderRadius: 18, border: '1.5px solid #f1f5f9', background: '#ffffff',
                    padding: 32, cursor: 'pointer', textAlign: 'center',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.04)', transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = '#6366f1'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = '#f1f5f9'}
                >
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(99,102,241,0.1)', color: '#6366f1', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Mail size={28} />
                  </div>
                  <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Email Campaign</h3>
                  <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>Send rich emails and track open rates directly from the CRM.</p>
                </div>

                <div
                  onClick={() => navigate('/workspace/object/campaign/new')}
                  style={{
                    borderRadius: 18, border: '1.5px solid #f1f5f9', background: '#ffffff',
                    padding: 32, cursor: 'pointer', textAlign: 'center',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.04)', transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = '#f1f5f9'}
                >
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircle2 size={28} />
                  </div>
                  <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Standard Campaign (Form)</h3>
                  <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>Create a Salesforce-style campaign object for tracking leads and forms.</p>
                </div>
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
                            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' }}>FounderCRM</span>
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
                    Next: Customize & Preview <ArrowRight size={15} />
                  </button>
                </div>
              </>
            )}

            {/* STEP 2: Two-Panel Campaign Editor & Live Preview */}
            {step === 2 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 24, flex: 1, minHeight: 0, overflow: 'hidden' }}>
                
                {/* ── LEFT PANEL: Form Inputs / Code Editor ── */}
                <form onSubmit={handleSendCampaign} style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
                  <div style={{ flex: 1, overflowY: 'auto', paddingRight: 10, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    
                    {/* Selected Template Pill */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0', flexShrink: 0 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1' }} />
                      <span style={{ fontSize: 12.5, color: '#64748b', fontWeight: 600 }}>Active Template:</span>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>{selectedTemplate.title} {selectedTemplate.emoji}</span>
                      <button type="button" onClick={() => setStep(1)} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 12, fontWeight: 700, color: '#6366f1', cursor: 'pointer' }}>Change</button>
                    </div>

                    {/* Campaign Name & Subject Line */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={labelStyle}>Campaign Name *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Summer Outreach 2026"
                          value={formData.name}
                          onChange={e => setFormData({ ...formData, name: e.target.value })}
                          style={inputBase}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Email Subject Line *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Special Offer from our Team"
                          value={formData.subject}
                          onChange={e => setFormData({ ...formData, subject: e.target.value })}
                          style={inputBase}
                        />
                      </div>
                    </div>

                    {/* Mode Toggle: Visual Form Customizer vs Developer HTML */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 2 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => setEditorMode('form')}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '7px 14px', borderRadius: 9, fontSize: 12, fontWeight: 700,
                            cursor: 'pointer', border: '1.5px solid',
                            background: editorMode === 'form' ? '#eef2ff' : '#ffffff',
                            color: editorMode === 'form' ? '#4f46e5' : '#64748b',
                            borderColor: editorMode === 'form' ? '#6366f1' : '#e2e8f0',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <Sliders size={13} /> Visual Editor
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditorMode('code')}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '7px 14px', borderRadius: 9, fontSize: 12, fontWeight: 700,
                            cursor: 'pointer', border: '1.5px solid',
                            background: editorMode === 'code' ? '#0f172a' : '#ffffff',
                            color: editorMode === 'code' ? '#ffffff' : '#64748b',
                            borderColor: editorMode === 'code' ? '#0f172a' : '#e2e8f0',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <Code size={13} /> Developer HTML
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={handleResetTemplate}
                        style={{
                          background: 'none', border: 'none', fontSize: 11.5, color: '#6366f1',
                          fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                        }}
                        title="Reset template to original defaults"
                      >
                        <RotateCcw size={12} /> Reset
                      </button>
                    </div>

                    {/* ── VISUAL FORM BUILDER MODE ── */}
                    {editorMode === 'form' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, background: '#f8fafc', padding: '16px', borderRadius: 14, border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            Edit Message Copy (Header to Footer)
                          </span>
                          <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>• Real-time Preview Sync</span>
                        </div>

                        {/* 1. Headline */}
                        <div>
                          <label style={labelStyle}>Headline / Main Heading *</label>
                          <input
                            type="text"
                            required
                            value={formData.headline}
                            onChange={e => updateFormField('headline', e.target.value)}
                            placeholder="e.g. Welcome to the community, {{first_name}}!"
                            style={inputBase}
                          />
                        </div>

                        {/* 2. Subheadline */}
                        <div>
                          <label style={labelStyle}>Sub-headline / Greeting</label>
                          <input
                            type="text"
                            value={formData.subheadline}
                            onChange={e => updateFormField('subheadline', e.target.value)}
                            placeholder="e.g. We're thrilled to have you with us on {{company}}."
                            style={inputBase}
                          />
                        </div>

                        {/* 3. Description Box */}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <label style={{ ...labelStyle, marginBottom: 0 }}>Email Body / Message Description *</label>
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>Paragraphs supported</span>
                          </div>
                          <textarea
                            rows={5}
                            required
                            value={formData.body}
                            onChange={e => updateFormField('body', e.target.value)}
                            placeholder="Type your campaign message here. Multiple paragraphs and merge tags are supported..."
                            style={{ ...inputBase, height: 'auto', minHeight: 110, padding: '12px 14px', lineHeight: 1.6 }}
                          />
                        </div>

                        {/* 4. Action Button Section */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <div>
                            <label style={labelStyle}>Button Text / Label *</label>
                            <input
                              type="text"
                              required
                              value={formData.buttonText}
                              onChange={e => updateFormField('buttonText', e.target.value)}
                              placeholder="e.g. Get Started Now &rarr;"
                              style={inputBase}
                            />
                          </div>
                          <div>
                            <label style={labelStyle}>Button Destination URL</label>
                            <input
                              type="text"
                              value={formData.buttonUrl}
                              onChange={e => updateFormField('buttonUrl', e.target.value)}
                              placeholder="{{form_link}} or https://..."
                              style={inputBase}
                            />
                          </div>
                        </div>

                        {/* 5. Promo Code (when available) */}
                        {selectedTemplate.id === 'product_promo' && (
                          <div>
                            <label style={labelStyle}>Promo / Voucher Code</label>
                            <input
                              type="text"
                              value={formData.promoCode}
                              onChange={e => updateFormField('promoCode', e.target.value)}
                              placeholder="e.g. SAVE40"
                              style={{ ...inputBase, fontFamily: 'monospace', letterSpacing: 2, fontWeight: 700 }}
                            />
                          </div>
                        )}

                        {/* 6. Footer Sign-off */}
                        <div>
                          <label style={labelStyle}>Footer Sign-off / Signature</label>
                          <input
                            type="text"
                            value={formData.footerSignoff}
                            onChange={e => updateFormField('footerSignoff', e.target.value)}
                            placeholder="e.g. The {{company}} Team"
                            style={inputBase}
                          />
                        </div>

                        {/* Quick Tags Toolbar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingTop: 2 }}>
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Insert Tags:</span>
                          {[
                            { label: 'First Name', tag: '{{first_name}}' },
                            { label: 'Company', tag: '{{company}}' },
                            { label: 'Recipient Email', tag: '{{email}}' },
                            { label: 'Form Link', tag: '{{form_link}}' },
                          ].map(t => (
                            <button
                              key={t.tag}
                              type="button"
                              onClick={() => handleInsertTag(t.tag)}
                              style={{
                                background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6,
                                padding: '2px 8px', fontSize: 11, fontFamily: 'monospace', color: '#4f46e5',
                                fontWeight: 600, cursor: 'pointer'
                              }}
                            >
                              + {t.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      /* ── DEVELOPER CODE MODE ── */
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '8px 12px', borderRadius: 10, background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Insert Tags:</span>
                          {[
                            { label: 'First Name', tag: '{{first_name}}' },
                            { label: 'Full Name', tag: '{{name}}' },
                            { label: 'Company', tag: '{{company}}' },
                            { label: 'Recipient Email', tag: '{{email}}' },
                            { label: 'RSVP / Form Link', tag: '{{form_link}}' },
                          ].map(t => (
                            <button
                              key={t.tag}
                              type="button"
                              onClick={() => handleInsertTag(t.tag)}
                              style={{
                                background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6,
                                padding: '2px 8px', fontSize: 11, fontFamily: 'monospace', color: '#4f46e5',
                                fontWeight: 600, cursor: 'pointer'
                              }}
                            >
                              + {t.label}
                            </button>
                          ))}
                        </div>

                        <textarea
                          rows={16}
                          required
                          value={formData.custom_html}
                          onChange={e => setFormData({ ...formData, custom_html: e.target.value })}
                          spellCheck={false}
                          placeholder="<!DOCTYPE html><html>...</html>"
                          style={{
                            width: '100%',
                            minHeight: 330,
                            padding: '14px 16px',
                            borderRadius: 12,
                            background: '#090d16',
                            color: '#38bdf8',
                            border: '1.5px solid #1e293b',
                            fontFamily: "'Fira Code', 'Cascadia Code', Consolas, 'Courier New', monospace",
                            fontSize: '12px',
                            lineHeight: 1.6,
                            boxSizing: 'border-box',
                            resize: 'vertical',
                            outline: 'none',
                          }}
                        />
                      </div>
                    )}

                    {/* Target Recipient Emails */}
                    <div>
                      <label style={labelStyle}>Target Recipient Emails *</label>
                      <textarea
                        rows={2}
                        required
                        placeholder="user1@company.com, user2@company.com, user3@company.com"
                        value={formData.target_emails}
                        onChange={e => setFormData({ ...formData, target_emails: e.target.value })}
                        style={{ ...inputBase, height: 'auto', minHeight: 64, padding: '10px 14px' }}
                      />
                      <p style={{ margin: '4px 0 0', fontSize: 11.5, color: '#94a3b8' }}>
                        Separate multiple emails with commas. Each recipient gets a unique trackable form link & open pixel.
                      </p>
                    </div>
                  </div>

                  {/* Left Action Footer */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, borderTop: '1px solid #f1f5f9', marginTop: 10, flexShrink: 0 }}>
                    <button type="button" onClick={() => setStep(1)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 11, fontSize: 13.5, fontWeight: 600, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', cursor: 'pointer' }}>
                      <ArrowLeft size={15} /> Back
                    </button>
                    <button type="submit" disabled={sending} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 12, fontSize: 14, fontWeight: 700, color: '#fff', background: sending ? '#94a3b8' : 'linear-gradient(135deg, #6366f1, #3b82f6)', border: 'none', cursor: sending ? 'not-allowed' : 'pointer', boxShadow: sending ? 'none' : '0 6px 18px rgba(99,102,241,0.35)', transition: 'all 0.2s ease' }}>
                      <Send size={15} /> {sending ? 'Dispatching...' : 'Send Campaign'}
                    </button>
                  </div>
                </form>

                {/* ── RIGHT PANEL: Sticky Live Preview ── */}
                <div style={{
                  background: '#f8fafc',
                  borderRadius: 18,
                  border: '1.5px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  height: '100%',
                  minHeight: 0,
                }}>
                  {/* Preview Header Bar */}
                  <div style={{
                    padding: '10px 16px',
                    background: '#ffffff',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexShrink: 0,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Eye size={15} color="#4f46e5" />
                      <span style={{ fontSize: 12.5, fontWeight: 800, color: '#0f172a' }}>Live Preview</span>
                      <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700, background: '#ecfdf5', padding: '2px 8px', borderRadius: 99, border: '1px solid #a7f3d0' }}>
                        • Instant Sync
                      </span>
                    </div>

                    {/* Desktop / Mobile Switcher */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f1f5f9', padding: 3, borderRadius: 8 }}>
                      <button
                        type="button"
                        onClick={() => setPreviewDevice('desktop')}
                        title="Desktop View"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          padding: '4px 9px', borderRadius: 6, border: 'none', cursor: 'pointer',
                          background: previewDevice === 'desktop' ? '#ffffff' : 'transparent',
                          color: previewDevice === 'desktop' ? '#0f172a' : '#64748b',
                          boxShadow: previewDevice === 'desktop' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                          fontSize: 11.5, fontWeight: 700,
                        }}
                      >
                        <Monitor size={13} /> Desktop
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewDevice('mobile')}
                        title="Mobile View"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          padding: '4px 9px', borderRadius: 6, border: 'none', cursor: 'pointer',
                          background: previewDevice === 'mobile' ? '#ffffff' : 'transparent',
                          color: previewDevice === 'mobile' ? '#0f172a' : '#64748b',
                          boxShadow: previewDevice === 'mobile' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                          fontSize: 11.5, fontWeight: 700,
                        }}
                      >
                        <Smartphone size={13} /> Mobile
                      </button>
                    </div>
                  </div>

                  {/* Preview Canvas */}
                  <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    background: '#f1f5f9',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'flex-start',
                    padding: previewDevice === 'mobile' ? '24px 16px' : '0',
                  }}>
                    {previewDevice === 'mobile' ? (
                      /* Mobile Simulated Device */
                      <div style={{
                        width: 375,
                        minHeight: 620,
                        background: '#ffffff',
                        borderRadius: 36,
                        boxShadow: '0 25px 50px -12px rgba(15,23,42,0.25), 0 0 0 10px #0f172a',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                      }}>
                        <div style={{ background: '#0f172a', padding: '8px 0 6px', textAlign: 'center' }}>
                          <div style={{ width: 110, height: 16, background: '#1e293b', borderRadius: 99, margin: '0 auto' }} />
                        </div>
                        <iframe
                          title="Mobile Email Preview"
                          srcDoc={String(formData.custom_html || '')
                            .replace(/\{\{\s*first[_\s-]?name\s*\}\}/gi, 'Alex')
                            .replace(/\{\{\s*last[_\s-]?name\s*\}\}/gi, 'Morgan')
                            .replace(/\{\{\s*(?:full[_\s-]?)?name\s*\}\}/gi, 'Alex Morgan')
                            .replace(/\{\{\s*(?:company|organization)\s*\}\}/gi, companyName)
                            .replace(/\{\{\s*email\s*\}\}/gi, 'alex@example.com')
                            .replace(/\{\{\s*(?:form|rsvp)[_\s-]?link\s*\}\}/gi, '#')}
                          style={{
                            width: '100%',
                            height: 580,
                            border: 'none',
                            display: 'block',
                            backgroundColor: '#ffffff',
                          }}
                        />
                      </div>
                    ) : (
                      /* Desktop Frame */
                      <iframe
                        title="Desktop Email Preview"
                        srcDoc={String(formData.custom_html || '')
                          .replace(/\{\{\s*first[_\s-]?name\s*\}\}/gi, 'Alex')
                          .replace(/\{\{\s*last[_\s-]?name\s*\}\}/gi, 'Morgan')
                          .replace(/\{\{\s*(?:full[_\s-]?)?name\s*\}\}/gi, 'Alex Morgan')
                          .replace(/\{\{\s*(?:company|organization)\s*\}\}/gi, companyName)
                          .replace(/\{\{\s*email\s*\}\}/gi, 'alex@example.com')
                          .replace(/\{\{\s*(?:form|rsvp)[_\s-]?link\s*\}\}/gi, '#')}
                        style={{
                          width: '100%',
                          height: '100%',
                          minHeight: 520,
                          border: 'none',
                          display: 'block',
                          backgroundColor: '#ffffff',
                        }}
                      />
                    )}
                  </div>

                  {/* Recipient Simulation Status */}
                  <div style={{
                    padding: '8px 16px',
                    background: '#ffffff',
                    borderTop: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 11.5,
                    color: '#64748b',
                    flexShrink: 0,
                  }}>
                    <span>👤 Sample Recipient: <strong>Alex Morgan</strong> (alex@example.com)</span>
                    <span style={{ color: '#94a3b8' }}>Live rendered</span>
                  </div>
                </div>

              </div>
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
                        return { email, status: match?.status || 'Sent', error: match?.error || null };
                      })
                    : tracking.map(t => ({ email: t.email, status: t.status || 'Sent', error: t.error || null }));

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
                          <div style={{ width: 34, height: 34, borderRadius: 10, background: badge.bg, color: badge.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Mail size={15} />
                          </div>
                          <div>
                            <span style={{ fontSize: 13.5, fontWeight: 600, color: '#1e293b' }}>{item.email}</span>
                            {item.error && (
                              <div style={{ fontSize: 11.5, color: '#ef4444', marginTop: 2 }}>{item.error}</div>
                            )}
                          </div>
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

      {/* Delete Campaign Confirmation Custom Modal */}
      {deleteModalCampaign && ReactDOM.createPortal(
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
              onClick={() => { setDeleteModalCampaign(null); setDeleteError(null); }}
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

            <h3 style={{ margin: '0 0 8px 0', fontSize: 19, fontWeight: 700, color: '#0f172a' }}>
              Delete Campaign?
            </h3>

            <p style={{ margin: '0 0 20px 0', fontSize: '0.88rem', color: '#64748b', lineHeight: 1.5 }}>
              Are you sure you want to delete <strong style={{ color: '#0f172a' }}>"{deleteModalCampaign.name || 'this campaign'}"</strong>? This action cannot be undone.
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
                onClick={() => { setDeleteModalCampaign(null); setDeleteError(null); }}
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
                onClick={confirmDeleteCampaign}
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
                    <span>Delete Campaign</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default CampaignsPage;
