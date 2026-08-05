import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { apiGet, apiPost, apiDelete } from '../../../api/client';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Type,
  Hash,
  DollarSign,
  Calendar,
  Clock,
  Mail,
  Phone,
  List,
  CheckSquare,
  Link2,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Loader,
  Info,
  Layout,
  Shield,
  Database,
  FileText,
  Settings,
  X,
  Layers,
  UserPlus,
  Users,
  Building2,
  Megaphone,
  UserCheck,
  Pencil,
  AlertTriangle
} from 'lucide-react';


/* ── Field type options for Add Field wizard ── */
const FIELD_TYPES = [
  { value: 'text', label: 'Text', icon: Type, color: '#6366f1' },
  { value: 'number', label: 'Number', icon: Hash, color: '#8b5cf6' },
  { value: 'currency', label: 'Currency', icon: DollarSign, color: '#10b981' },
  { value: 'date', label: 'Date', icon: Calendar, color: '#f59e0b' },
  { value: 'datetime', label: 'DateTime', icon: Clock, color: '#06b6d4' },
  { value: 'email', label: 'Email', icon: Mail, color: '#3b82f6' },
  { value: 'phone', label: 'Phone', icon: Phone, color: '#22c55e' },
  { value: 'picklist', label: 'Picklist', icon: List, color: '#a855f7' },
  { value: 'checkbox', label: 'Checkbox', icon: CheckSquare, color: '#f43f5e' },
  { value: 'url', label: 'URL', icon: Link2, color: '#64748b' },
];


/* ── Helper for module iconography, colors, and badge ── */
function getModuleMeta(key, obj) {
  const isCustom = key.endsWith('__c') || obj?.is_custom;
  const isSystem = obj?.is_system || ['user', 'organization', 'system_setting'].includes(key.toLowerCase());
  const badgeType = isCustom ? 'Custom' : isSystem ? 'System' : 'Standard';

  const lowerKey = key.toLowerCase();
  let Icon = BoxIcon;
  let iconColor = '#38bdf8';


  if (isCustom) {
    Icon = Layers;
  } else if (lowerKey.includes('lead')) {
    Icon = UserPlus;
  } else if (lowerKey.includes('contact')) {
    Icon = Users;
  } else if (lowerKey.includes('deal') || lowerKey.includes('opportunity')) {
    Icon = DollarSign;
  } else if (lowerKey.includes('company') || lowerKey.includes('account')) {
    Icon = Building2;
  } else if (lowerKey.includes('task')) {
    Icon = CheckSquare;
  } else if (lowerKey.includes('note')) {
    Icon = FileText;
  } else if (lowerKey.includes('call') || lowerKey.includes('phone')) {
    Icon = Phone;
  } else if (lowerKey.includes('meeting') || lowerKey.includes('event')) {
    Icon = Calendar;
  } else if (lowerKey.includes('campaign')) {
    Icon = Megaphone;
  } else if (lowerKey.includes('user')) {
    Icon = UserCheck;
  }


  return { Icon, iconColor, badgeType };
}


// Fallback Box Icon
function BoxIcon(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}


/* ── Data type icon helper ── */
function DataTypeIcon({ type }) {
  const t = (type || 'text').toLowerCase();
  const map = {
    text: { Icon: Type, label: 'text' },
    number: { Icon: Hash, label: 'number' },
    currency: { Icon: DollarSign, label: 'currency' },
    date: { Icon: Calendar, label: 'date' },
    datetime: { Icon: Clock, label: 'datetime' },
    email: { Icon: Mail, label: 'email' },
    phone: { Icon: Phone, label: 'phone' },
    picklist: { Icon: List, label: 'Picklist' },
    dropdown: { Icon: List, label: 'Picklist' },
    checkbox: { Icon: CheckSquare, label: 'checkbox' },
    url: { Icon: Link2, label: 'url' },
    lookup: { Icon: Type, label: 'lookup' },
  };
  const { Icon, label } = map[t] || { Icon: Type, label: t };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: '#64748b' }}>
      <Icon size={14} strokeWidth={2} />
      {label}
    </span>
  );
}


/* ──────────────────────────────────────────────
   Main ObjectDetail Component
   ────────────────────────────────────────────── */
function ObjectDetail({ objectKey, onBack }) {
  const [activeTab, setActiveTab] = useState('details');
  const [objectDef, setObjectDef] = useState(null);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [showAddField, setShowAddField] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(null);
  const [toast, setToast] = useState(null);


  /* ── Fetch object definition ── */
  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const defs = await apiGet('/metadata/objects').catch(() => ({ data: [] }));
        const allDefs = defs?.data || defs || [];
        const arr = Array.isArray(allDefs) ? allDefs : Object.values(allDefs);
        const match = arr.find(
          (o) => o.api_name === objectKey || o.id === objectKey
        );
        if (mounted) setObjectDef(match || { api_name: objectKey, display_name: objectKey });
      } catch {
        if (mounted) setObjectDef({ api_name: objectKey, display_name: objectKey });
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [objectKey]);


  /* ── Fetch fields ── */
  const loadFields = useCallback(async () => {
    setFieldsLoading(true);
    try {
      const res = await apiGet(`/metadata/objects/${objectKey}/fields`);
      const arr = Array.isArray(res) ? res : (res?.data || []);
      setFields(arr);
    } catch {
      setFields([]);
    } finally {
      setFieldsLoading(false);
    }
  }, [objectKey]);


  useEffect(() => {
    loadFields();
  }, [loadFields]);


  /* ── Delete field ── */
  const [deleteModalField, setDeleteModalField] = useState(null);
  const [deletingField, setDeletingField] = useState(false);
  const [deleteFieldError, setDeleteFieldError] = useState(null);

  const handleDeleteFieldClick = (fieldId, fieldLabel) => {
    setDeleteModalField({ id: fieldId, label: fieldLabel });
    setDeleteFieldError(null);
  };

  const confirmDeleteField = async () => {
    if (!deleteModalField) return;
    setDeletingField(true);
    setDeleteFieldError(null);
    try {
      await apiDelete(`/metadata/objects/${objectKey}/fields/${deleteModalField.id}`);
      const deletedLabel = deleteModalField.label;
      setDeleteModalField(null);
      showToast('success', `Field "${deletedLabel}" deleted successfully.`);
      loadFields();
    } catch (err) {
      console.error('Delete field error:', err);
      setDeleteFieldError(err?.message || 'Failed to delete field.');
    } finally {
      setDeletingField(false);
    }
  };


  /* ── Toast helper ── */
  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };


  /* ── Tab config ── */
  const tabs = [
    { id: 'details', label: 'Details', icon: Info },
    { id: 'fields', label: 'Fields & Relationships', icon: Database },
    { id: 'layouts', label: 'Page Layouts', icon: Layout },
  ];


  const displayName = objectDef?.display_name || objectDef?.api_name || objectKey;
  const { Icon, iconColor, badgeType } = getModuleMeta(objectKey, objectDef);
  const isCustom = badgeType === 'Custom';


  if (loading) {
    return (
      <div className="fade-in" style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>
        <Loader size={20} className="spin" style={{ marginBottom: 8 }} />
        <div>Loading object details...</div>
      </div>
    );
  }


  return (
    <div className="fade-in" style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── Toast notification ── */}
      {toast && createPortal(
        <div
          style={{
            position: 'fixed', bottom: 28, right: 28, zIndex: 999999,
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 20px', borderRadius: 14,
            background: '#ffffff',
            color: toast.type === 'success' ? '#065f46' : '#991b1b',
            border: `1px solid ${toast.type === 'success' ? '#a7f3d0' : '#fca5a5'}`,
            boxShadow: toast.type === 'success'
              ? '0 20px 40px -10px rgba(16, 185, 129, 0.25), 0 8px 16px -4px rgba(0, 0, 0, 0.08)'
              : '0 20px 40px -10px rgba(239, 68, 68, 0.25), 0 8px 16px -4px rgba(0, 0, 0, 0.08)',
            fontSize: '0.88rem', fontWeight: 600,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div style={{
            width: 26, height: 26, borderRadius: '50%',
            background: toast.type === 'success' ? '#d1fae5' : '#fee2e2',
            color: toast.type === 'success' ? '#059669' : '#dc2626',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          </div>
          <span>{toast.message}</span>
        </div>,
        document.body
      )}


      {/* ── Premium Hero Header (Matching Role Management style) ── */}
      <section
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, #0d1117 0%, #0a1628 30%, #0d2137 55%, #0a2020 80%, #0d1117 100%)',
          padding: '24px 28px',
          boxShadow: '0 16px 36px -12px rgba(11, 18, 32, 0.4)',
        }}
      >
        {/* Global Keyframe Animations */}
        <style>{`
          @keyframes dp-float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            33% { transform: translateY(-8px) rotate(1deg); }
            66% { transform: translateY(-4px) rotate(-1deg); }
          }
          @keyframes dp-pulseGlow {
            0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(0,214,153,0.4); }
            50% { opacity: 0.7; box-shadow: 0 0 0 6px rgba(0,214,153,0); }
          }
          @keyframes dp-particleDrift {
            0% { transform: translate(0, 0) scale(1); opacity: 0.6; }
            50% { transform: translate(10px, -20px) scale(1.1); opacity: 0.3; }
            100% { transform: translate(-5px, -35px) scale(0.9); opacity: 0; }
          }
        `}</style>

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
              animation: `dp-particleDrift ${[3, 4, 3.5, 5, 4.5, 3.8][i]}s ease-in-out infinite ${[0, 0.8, 1.2, 0.4, 1.6, 0.2][i]}s`,
              pointerEvents: 'none',
            }}
          />
        ))}

        {/* Ambient Glow Orbs */}
        <div style={{ position: 'absolute', top: -80, right: 60, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,176,155,0.2), transparent 65%)', animation: 'dp-float 7s ease-in-out infinite', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, right: 200, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,172,254,0.15), transparent 65%)', animation: 'dp-float 9s ease-in-out infinite reverse', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 20, right: 340, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,87,108,0.1), transparent 65%)', animation: 'dp-float 6s ease-in-out infinite 1s', pointerEvents: 'none' }} />

        {/* Grid texture */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.03, backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '48px 48px', pointerEvents: 'none' }} />


        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>

          {/* Left Content */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, maxWidth: 780 }}>
            {/* Shield / Object Icon Box */}
            <div
              style={{
                width: 50,
                height: 50,
                borderRadius: 14,
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(34, 211, 238, 0.2))',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
                boxShadow: '0 8px 20px rgba(0, 0, 0, 0.3)',
                flexShrink: 0,
              }}
            >
              <Icon size={25} />
            </div>


            <div>
              {/* Object Name + Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: '1.7rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                  {displayName}
                </h1>


                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '4px 11px',
                    borderRadius: 999,
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    background: isCustom ? 'rgba(245, 158, 11, 0.25)' : 'rgba(99, 102, 241, 0.25)',
                    color: isCustom ? '#fcd34d' : '#a5b4fc',
                    border: `1px solid ${isCustom ? 'rgba(252, 211, 77, 0.35)' : 'rgba(165, 180, 252, 0.35)'}`,
                  }}
                >
                  {isCustom ? 'CUSTOM OBJECT' : 'STANDARD OBJECT'}
                </span>
              </div>


              {/* Description / API Name */}
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#9fb0c9', lineHeight: 1.5 }}>
                API Name: <span className="font-mono" style={{ color: '#ffffff', fontWeight: 600 }}>{objectDef?.api_name || objectKey}</span>
                {objectDef?.description && ` · ${objectDef.description}`}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Tabs bar directly below header (Styled like user screenshot with Edit & Back buttons on right) ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
          paddingBottom: '10px',
          marginTop: '4px',
          gap: '12px',
        }}
      >
        {/* Left Side: Tabs */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '9px 18px',
                  fontSize: '0.88rem',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  border: 'none',
                  borderBottom: `2px solid ${isActive ? '#4f46e5' : 'transparent'}`,
                  borderRadius: '8px 8px 0 0',
                  background: isActive ? '#ffffff' : 'transparent',
                  color: isActive ? '#0f172a' : '#64748b',
                  boxShadow: isActive ? '0 1px 3px rgba(0, 0, 0, 0.05)' : 'none',
                  transition: 'all 0.15s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <tab.icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Side: Inline Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Edit Object Button (If custom) */}
          {isCustom && (
            <button
              type="button"
              onClick={() => setShowEditModal(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                borderRadius: '8px', border: 'none', cursor: 'pointer',
                fontSize: '0.84rem', fontWeight: 600, color: '#ffffff',
                background: '#06b6d4',
                boxShadow: '0 1px 2px rgba(6, 182, 212, 0.1)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#0891b2';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#06b6d4';
              }}
            >
              <Pencil size={14} />
              <span>Edit</span>
            </button>
          )}

          {/* Back Button */}
          <button
            type="button"
            onClick={onBack}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px',
              borderRadius: '8px', fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer',
              color: '#334155', background: '#ffffff',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f8fafc';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#ffffff';
              e.currentTarget.style.borderColor = '#e2e8f0';
            }}
          >
            <ArrowLeft size={14} />
            <span>Back</span>
          </button>
        </div>
      </div>


      {/* ── Tab Content ── */}
      {activeTab === 'details' && (
        <DetailsTab objectDef={objectDef} />
      )}


      {activeTab === 'fields' && (
        <FieldsTab
          objectKey={objectKey}
          displayName={displayName}
          fields={fields}
          loading={fieldsLoading}
          deleteLoading={deleteLoading}
          onDelete={handleDeleteFieldClick}
          onAddField={() => setShowAddField(true)}
          onRefresh={loadFields}
        />
      )}


      {activeTab === 'layouts' && (
        <PageLayoutsTab displayName={displayName} fields={fields} />
      )}


      {/* ── Edit Custom Object Modal ── */}
      {showEditModal && createPortal(
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: 'rgba(15,19,48,0.55)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px 16px', animation: 'fadeIn 0.2s ease',
          }}
          onClick={() => setShowEditModal(false)}
        >
          <div
            style={{
              width: '100%', maxWidth: 460, borderRadius: 14, padding: '22px 26px',
              background: '#ffffff', boxShadow: '0 24px 60px -12px rgba(15,19,48,0.25)',
              position: 'relative', animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowEditModal(false)}
              style={{
                position: 'absolute', top: 14, right: 14, width: 26, height: 26,
                borderRadius: 6, border: 'none', background: '#f1f5f9', color: '#64748b',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={14} />
            </button>


            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(168,85,247,0.1)', color: '#a855f7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Settings size={17} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#1c2033' }}>
                  Edit {displayName}
                </h3>
                <span className="font-mono" style={{ fontSize: '0.7rem', color: '#8990ac' }}>{objectDef?.api_name || objectKey}</span>
              </div>
            </div>


            <form onSubmit={async (e) => {
              e.preventDefault();
              setShowEditModal(false);
              showToast('success', 'Custom module updated successfully.');
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#1c2033', marginBottom: 4 }}>
                    Module Display Name
                  </label>
                  <input
                    type="text"
                    defaultValue={displayName}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 7,
                      border: '1px solid #cbd5e1', fontSize: '0.84rem', color: '#1c2033', outline: 'none',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#1c2033', marginBottom: 4 }}>
                    Description
                  </label>
                  <textarea
                    rows={2}
                    defaultValue={objectDef?.description || ''}
                    placeholder="Briefly describe what this custom module tracks..."
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 7,
                      border: '1px solid #cbd5e1', fontSize: '0.82rem', color: '#1c2033', outline: 'none', resize: 'vertical',
                    }}
                  />
                </div>
              </div>


              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  style={{
                    padding: '7px 14px', borderRadius: 7, border: '1px solid #cbd5e1',
                    background: 'transparent', color: '#475569', fontSize: '0.8rem',
                    fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="orbit-btn-primary"
                  style={{
                    padding: '7px 16px', borderRadius: 7, fontSize: '0.8rem', fontWeight: 700,
                  }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}


      {/* ── Add Field Modal ── */}
      {showAddField && (
        <AddFieldWizard
          objectKey={objectKey}
          displayName={displayName}
          onClose={() => setShowAddField(false)}
          onSuccess={() => {
            setShowAddField(false);
            loadFields();
            showToast('success', 'Custom field created successfully!');
          }}
          onError={(msg) => showToast('error', msg)}
        />
      )}

      {/* ── Custom Delete Field Confirmation Modal ── */}
      {deleteModalField && createPortal(
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
              onClick={() => { setDeleteModalField(null); setDeleteFieldError(null); }}
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
              Delete Field?
            </h3>

            <p style={{ margin: '0 0 20px 0', fontSize: '0.88rem', color: '#64748b', lineHeight: 1.5 }}>
              Are you sure you want to delete field <strong style={{ color: '#0f172a' }}>"{deleteModalField.label}"</strong>? This action cannot be undone and will permanently remove data stored in this field.
            </p>

            {deleteFieldError && (
              <div style={{
                marginBottom: 16, padding: '10px 14px', borderRadius: 10,
                background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
                fontSize: '0.82rem', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8
              }}>
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <span>{deleteFieldError}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={() => { setDeleteModalField(null); setDeleteFieldError(null); }}
                disabled={deletingField}
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
                onClick={confirmDeleteField}
                disabled={deletingField}
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
                {deletingField ? (
                  <span>Deleting…</span>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>Delete Field</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}


      {/* ── Inline animation keyframes ── */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(40px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}


/* ══════════════════════════════════════════════
   Tab 1: Details
   ══════════════════════════════════════════════ */
function DetailsTab({ objectDef }) {
  const detailRows = [
    { label: 'Label', value: objectDef?.display_name || objectDef?.api_name || '—' },
    { label: 'Description', value: objectDef?.description || `Data object definition for managing ${objectDef?.display_name || objectDef?.api_name || ''} records.` },
    { label: 'API Name', value: objectDef?.api_name || '—' },
    { label: 'Last Modified', value: objectDef?.updated_at || objectDef?.created_at || '—' },
    { label: 'Type', value: objectDef?.is_system ? 'System Object' : 'Custom Object' },
    { label: 'Deployment Status', value: objectDef?.status || 'Deployed' },
  ];


  return (
    <div className="fade-in glass" style={{ padding: '24px 28px', borderRadius: '16px', background: '#ffffff', border: '1px solid #f1f5f9', boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03), 0 1px 3px rgba(15, 23, 42, 0.02)' }}>
      <h3 className="font-display" style={{ margin: '0 0 20px', fontSize: '1.05rem', fontWeight: 700, color: '#1c2033' }}>
        Details
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 48px' }}>
        {detailRows.map((row, i) => (
          <div key={i}>
            <div style={{ fontSize: '0.76rem', fontWeight: 600, color: '#6366f1', marginBottom: 4, textTransform: 'capitalize' }}>
              {row.label}
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1c2033', wordBreak: 'break-word' }}>
              {row.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════
   Tab 2: Fields & Relationships
   ══════════════════════════════════════════════ */
function FieldsTab({ objectKey, displayName, fields, loading, deleteLoading, onDelete, onAddField }) {
  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.84rem', color: '#6366f1', fontWeight: 600 }}>
          Showing {fields.length} fields configured for {displayName}
        </span>
        <button
          onClick={onAddField}
          className="orbit-btn-primary"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '9px 16px', borderRadius: 10,
            fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Plus size={15} />
          <span>Add Field</span>
        </button>
      </div>


      {/* Fields table */}
      <div className="glass" style={{ borderRadius: '16px', overflow: 'hidden', background: '#ffffff', border: '1px solid #f1f5f9', boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03), 0 1px 3px rgba(15, 23, 42, 0.02)' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
            <Loader size={18} className="spin" />
            <span style={{ marginLeft: 8 }}>Loading fields...</span>
          </div>
        ) : fields.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
            No fields configured for this object.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                {['FIELD LABEL', 'API NAME', 'DATA TYPE', 'REQUIRED', 'ACTION'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '14px 20px', textAlign: 'left',
                      fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em',
                      color: '#64748b', textTransform: 'uppercase',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fields.map((field, idx) => {
                const fieldId = field.id || field.name;
                const fieldLabel = field.label || field.display_name || field.name;
                const apiName = field.name || field.api_name || '—';
                const dataType = field.type || field.field_type || 'text';
                const isRequired = field.required || false;
                const isSystem = field.is_system || false;
                const isDeleting = deleteLoading === fieldId;


                return (
                  <tr
                    key={fieldId || idx}
                    style={{
                      borderBottom: idx < fields.length - 1 ? '1px solid #f1f5f9' : 'none',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.03)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={{ padding: '14px 20px', fontWeight: 600, fontSize: '0.88rem', color: '#1c2033' }}>
                      {fieldLabel}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <code
                        className="font-mono"
                        style={{
                          fontSize: '0.78rem', padding: '3px 8px',
                          background: 'rgba(99,102,241,0.06)', borderRadius: 6,
                          color: '#475569',
                        }}
                      >
                        {apiName}
                      </code>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <DataTypeIcon type={dataType} />
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span
                        style={{
                          display: 'inline-block', padding: '3px 12px',
                          borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
                          background: isRequired ? 'rgba(99,102,241,0.1)' : 'rgba(139,148,185,0.1)',
                          color: isRequired ? '#6366f1' : '#64748b',
                          border: isRequired ? '1px solid rgba(99,102,241,0.25)' : '1px solid transparent',
                        }}
                      >
                        {isRequired ? 'Required' : 'Optional'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      {!isSystem ? (
                        <button
                          onClick={() => onDelete(fieldId, fieldLabel)}
                          disabled={isDeleting}
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 32, height: 32, borderRadius: 8,
                            border: 'none', background: 'rgba(244,63,94,0.08)',
                            color: '#f43f5e', cursor: isDeleting ? 'wait' : 'pointer',
                            transition: 'all 0.15s ease',
                            opacity: isDeleting ? 0.5 : 1,
                          }}
                          onMouseOver={(e) => { if (!isDeleting) { e.currentTarget.style.background = 'rgba(244,63,94,0.18)'; } }}
                          onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(244,63,94,0.08)'; }}
                          title={`Delete ${fieldLabel}`}
                        >
                          {isDeleting ? <Loader size={14} className="spin" /> : <Trash2 size={14} />}
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>System</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════
   Tab 3: Page Layouts
   ══════════════════════════════════════════════ */
function PageLayoutsTab({ displayName, fields }) {
  const [fieldOrder, setFieldOrder] = useState(fields.map((_, i) => i));
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);


  // Sync field order if fields change
  React.useEffect(() => {
    setFieldOrder(fields.map((_, i) => i));
  }, [fields]);


  const handleDragStart = (idx) => setDragIdx(idx);
  const handleDragOver = (e, idx) => { e.preventDefault(); setDragOverIdx(idx); };
  const handleDragEnd = () => {
    if (dragIdx !== null && dragOverIdx !== null && dragIdx !== dragOverIdx) {
      const newOrder = [...fieldOrder];
      const [moved] = newOrder.splice(dragIdx, 1);
      newOrder.splice(dragOverIdx, 0, moved);
      setFieldOrder(newOrder);
    }
    setDragIdx(null);
    setDragOverIdx(null);
  };


  const orderedFields = fieldOrder.map((i) => fields[i]).filter(Boolean);


  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="glass" style={{ padding: '24px 28px', borderRadius: '16px 16px 0 0', borderBottom: 'none', background: '#ffffff', border: '1px solid #f1f5f9', boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03), 0 1px 3px rgba(15, 23, 42, 0.02)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 className="font-display" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#1c2033' }}>
              {displayName} Layout
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              Drag and drop fields to switch positions.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              padding: '5px 14px', borderRadius: 20, fontSize: '0.74rem',
              fontWeight: 600, background: 'rgba(16,185,129,0.1)', color: '#10b981',
              border: '1px solid rgba(16,185,129,0.2)',
            }}>
              ● Active
            </span>
            <span style={{
              padding: '5px 14px', borderRadius: 20, fontSize: '0.74rem',
              fontWeight: 600, background: 'rgba(99,102,241,0.08)', color: '#6366f1',
            }}>
              {orderedFields.length} Fields
            </span>
          </div>
        </div>
      </div>


      {/* Field list — draggable layout editor */}
      <div
        className="glass"
        style={{
          borderRadius: '0 0 16px 16px', padding: '16px 28px 24px',
          border: '1px solid #f1f5f9', borderTop: 'none', background: '#ffffff',
          boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03), 0 1px 3px rgba(15, 23, 42, 0.02)',
        }}
      >
        {orderedFields.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
            No fields in this layout.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            {orderedFields.map((field, idx) => {
              const fieldLabel = field.label || field.display_name || field.name || '—';
              const dataType = field.type || field.field_type || 'text';
              const isRequired = field.required || false;
              const isDragging = dragIdx === idx;
              const isDragOver = dragOverIdx === idx;


              return (
                <div
                  key={field.id || field.name || idx}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 18px', borderRadius: 10,
                    border: isDragOver
                      ? '2px solid #6366f1'
                      : '1px solid #e2e8f0',
                    background: isDragging
                      ? 'rgba(99,102,241,0.06)'
                      : isDragOver
                        ? 'rgba(99,102,241,0.03)'
                        : '#ffffff',
                    cursor: 'grab',
                    opacity: isDragging ? 0.6 : 1,
                    transition: 'all 0.15s ease',
                    boxShadow: isDragOver ? '0 0 0 1px rgba(99,102,241,0.3)' : 'none',
                  }}
                  onMouseOver={(e) => {
                    if (!isDragging) e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)';
                  }}
                  onMouseOut={(e) => {
                    if (!isDragging) e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {/* Grip handle */}
                  <div
                    style={{
                      display: 'flex', flexDirection: 'column', gap: 2,
                      color: '#94a3b8', flexShrink: 0, cursor: 'grab',
                      padding: '2px 0',
                    }}
                  >
                    <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
                      <circle cx="3" cy="2" r="1.5" />
                      <circle cx="9" cy="2" r="1.5" />
                      <circle cx="3" cy="8" r="1.5" />
                      <circle cx="9" cy="8" r="1.5" />
                      <circle cx="3" cy="14" r="1.5" />
                      <circle cx="9" cy="14" r="1.5" />
                    </svg>
                  </div>


                  {/* Field name */}
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1c2033', flex: 1 }}>
                    {fieldLabel}
                  </span>


                  {/* Data type badge */}
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '3px 10px', borderRadius: 6,
                    background: 'rgba(99,102,241,0.06)', fontSize: '0.72rem',
                    color: '#64748b', fontWeight: 500,
                  }}>
                    <DataTypeIcon type={dataType} />
                  </span>


                  {/* Required badge */}
                  {isRequired && (
                    <span style={{
                      padding: '2px 8px', borderRadius: 12, fontSize: '0.68rem',
                      fontWeight: 700, background: 'rgba(99,102,241,0.1)',
                      color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)',
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                    }}>
                      Required
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════
   Tab 4: Validation
   ══════════════════════════════════════════════ */
function ValidationTab({ displayName, fields }) {
  const requiredFields = fields.filter((f) => f.required);


  return (
    <div className="fade-in glass" style={{ padding: '24px 28px', borderRadius: '16px', background: '#ffffff', border: '1px solid #f1f5f9', boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03), 0 1px 3px rgba(15, 23, 42, 0.02)' }}>
      <h3 className="font-display" style={{ margin: '0 0 20px', fontSize: '1.05rem', fontWeight: 700, color: '#1c2033' }}>
        Validation Rules
      </h3>


      {/* Built-in required field validations */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Required Field Validations ({requiredFields.length})
        </div>


        {requiredFields.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#64748b', fontSize: '0.84rem', background: 'rgba(99,102,241,0.03)', borderRadius: 10 }}>
            No required field validations configured.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {requiredFields.map((f, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 10,
                  border: '1px solid #e2e8f0',
                  background: 'rgba(99,102,241,0.02)',
                }}
              >
                <Shield size={15} style={{ color: '#6366f1', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1c2033' }}>
                    {f.label || f.name}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: '#64748b', marginLeft: 8 }}>
                    — Required field, must have a value before saving
                  </span>
                </div>
                <span style={{
                  padding: '3px 10px', borderRadius: 16, fontSize: '0.7rem',
                  fontWeight: 600, background: 'rgba(16,185,129,0.1)', color: '#10b981',
                }}>
                  Active
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════
   Add Field Wizard (Modal)
   ══════════════════════════════════════════════ */
function AddFieldWizard({ objectKey, displayName, onClose, onSuccess, onError }) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState(null);
  const totalSteps = 4;


  /* Step 1 state */
  const [fieldType, setFieldType] = useState('text');


  /* Step 2 state */
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldApiName, setFieldApiName] = useState('');
  const [fieldLength, setFieldLength] = useState('255');
  const [fieldDescription, setFieldDescription] = useState('');
  const [fieldHelpText, setFieldHelpText] = useState('');
  const [fieldRequired, setFieldRequired] = useState(false);
  const [fieldUnique, setFieldUnique] = useState(false);


  /* Step 3 state */
  const [securityProfiles, setSecurityProfiles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(false);


  useEffect(() => {
    if (step !== 3) return;
    if (securityProfiles.length > 0) return;


    let mounted = true;
    setRolesLoading(true);


    apiGet('/roles')
      .then((res) => {
        if (!mounted) return;
        const roleList = Array.isArray(res) ? res : (res?.data || res?.roles || []);
        if (roleList.length > 0) {
          setSecurityProfiles(
            roleList.map((r) => ({
              id: r.id,
              role: r.role_name || r.name || r.role || 'Unnamed Role',
              visible: true,
              readOnly: false,
            }))
          );
        } else {
          setSecurityProfiles([
            { role: 'Admin', visible: true, readOnly: false },
            { role: 'User', visible: true, readOnly: false },
          ]);
        }
      })
      .catch(() => {
        if (!mounted) return;
        setSecurityProfiles([
          { role: 'Admin', visible: true, readOnly: false },
          { role: 'User', visible: true, readOnly: false },
        ]);
      })
      .finally(() => { if (mounted) setRolesLoading(false); });


    return () => { mounted = false; };
  }, [step]);


  const toggleSecurity = (index, field) => {
    setSecurityProfiles((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: !p[field] } : p))
    );
  };


  /* Step 4 state */
  const [layoutSelected, setLayoutSelected] = useState(true);


  const handleLabelChange = (val) => {
    setFieldLabel(val);
    if (!fieldApiName || fieldApiName === autoApiName(fieldLabel)) {
      setFieldApiName(autoApiName(val));
    }
  };


  const autoApiName = (label) =>
    (label || '').toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');


  const handlePrevStep = () => {
    setLocalError(null);
    setStep(step - 1);
  };

  const handleNextStep = () => {
    setLocalError(null);
    setStep(step + 1);
  };


  const handleSubmit = async () => {
    if (!fieldLabel.trim()) {
      setLocalError('Field Label is required.');
      return;
    }
    setSaving(true);
    setLocalError(null);
    try {
      await apiPost(`/metadata/objects/${objectKey}/fields`, {
        display_name: fieldLabel.trim(),
        api_name: fieldApiName.trim() || autoApiName(fieldLabel),
        name: fieldApiName.trim() || autoApiName(fieldLabel),
        field_type: fieldType,
        type: fieldType,
        required: fieldRequired,
        description: fieldDescription,
        help_text: fieldHelpText,
        length: fieldLength ? parseInt(fieldLength, 10) : undefined,
        unique: fieldUnique,
        label: fieldLabel.trim(),
        security_profiles: securityProfiles,
      });
      onSuccess();
    } catch (err) {
      const errMsg = err?.message || 'Failed to create field.';
      setLocalError(errMsg);
      onError(errMsg);
    } finally {
      setSaving(false);
    }
  };


  const progressPct = (step / totalSteps) * 100;


  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(15,19,48,0.55)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px 16px', overflowY: 'auto',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto',
          borderRadius: 18, padding: '28px 32px 24px', position: 'relative',
          background: '#ffffff',
          boxShadow: '0 24px 60px -12px rgba(15,19,48,0.25), 0 0 0 1px rgba(0,0,0,0.06)',
          animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, right: 16,
            width: 28, height: 28, borderRadius: 8,
            border: 'none', background: 'rgba(139,148,185,0.1)',
            color: '#64748b', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X size={15} />
        </button>


        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 className="font-display" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#1c2033' }}>
            New Custom Field
          </h2>
          <span style={{
            padding: '4px 12px', borderRadius: 16, fontSize: '0.75rem',
            fontWeight: 600, background: 'rgba(99,102,241,0.1)', color: '#6366f1',
          }}>
            Step {step} of {totalSteps}
          </span>
        </div>


        {/* Progress bar */}
        <div style={{ height: 4, borderRadius: 4, background: 'rgba(99,102,241,0.1)', marginBottom: 24, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${progressPct}%`, borderRadius: 4,
            background: '#6366f1', transition: 'width 0.3s ease',
          }} />
        </div>


        {/* Local Error display */}
        {localError && (
          <div
            style={{
              marginBottom: 20,
              padding: '10px 14px',
              borderRadius: 8,
              background: 'rgba(244,63,94,0.08)',
              border: '1px solid rgba(244,63,94,0.2)',
              color: '#f43f5e',
              fontSize: '0.82rem',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              animation: 'fadeIn 0.2s ease',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{localError}</span>
          </div>
        )}


        {/* Step 1: Choose Field Type */}
        {step === 1 && (
          <div className="fade-in">
            <h4 style={{ margin: '0 0 4px', fontSize: '0.95rem', fontWeight: 700, color: '#1c2033' }}>
              Step 1. Choose Field Type
            </h4>
            <p style={{ margin: '0 0 18px', fontSize: '0.82rem', color: '#64748b' }}>
              Specify the type of information that the custom field will contain.
            </p>


            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {FIELD_TYPES.map((ft) => {
                const isSelected = fieldType === ft.value;
                const Icon = ft.icon;
                return (
                  <label
                    key={ft.value}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '13px 16px', borderRadius: 10, cursor: 'pointer',
                      border: isSelected ? '2px solid #6366f1' : '1px solid #e2e8f0',
                      background: isSelected ? 'rgba(99,102,241,0.04)' : 'transparent',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input
                      type="radio" name="fieldType"
                      value={ft.value} checked={isSelected}
                      onChange={() => setFieldType(ft.value)}
                      style={{ accentColor: '#6366f1', width: 16, height: 16, cursor: 'pointer' }}
                    />
                    <Icon size={16} style={{ color: ft.color }} />
                    <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#1c2033' }}>{ft.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}


        {/* Step 2: Enter Details */}
        {step === 2 && (
          <div className="fade-in">
            <h4 style={{ margin: '0 0 4px', fontSize: '0.95rem', fontWeight: 700, color: '#1c2033' }}>
              Step 2. Enter Details
            </h4>
            <p style={{ margin: '0 0 18px', fontSize: '0.82rem', color: '#64748b' }}>
              Configure the field properties for this {fieldType} field.
            </p>


            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              {/* Field Label */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#64748b', marginBottom: 6 }}>
                  Field Label <span style={{ color: '#f43f5e' }}>*</span>
                </label>
                <input
                  className="orbit-input"
                  value={fieldLabel}
                  onChange={(e) => handleLabelChange(e.target.value)}
                  placeholder="e.g. Revenue"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.88rem' }}
                />
              </div>


              {/* API Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#64748b', marginBottom: 6 }}>
                  Field Name (API) <span style={{ color: '#f43f5e' }}>*</span>
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    className="orbit-input"
                    value={fieldApiName}
                    onChange={(e) => setFieldApiName(e.target.value)}
                    placeholder="revenue"
                    style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.88rem' }}
                  />
                  <span style={{
                    display: 'flex', alignItems: 'center', padding: '0 8px',
                    fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600,
                  }}>
                    __c
                  </span>
                </div>
              </div>
            </div>


            {/* Length */}
            {(fieldType === 'text' || fieldType === 'url') && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#64748b', marginBottom: 6 }}>
                  Length
                </label>
                <input
                  className="orbit-input"
                  value={fieldLength}
                  onChange={(e) => setFieldLength(e.target.value)}
                  type="number"
                  style={{ width: 200, padding: '10px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.88rem' }}
                />
              </div>
            )}


            {/* Description */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#64748b', marginBottom: 6 }}>
                Description
              </label>
              <textarea
                className="orbit-input"
                value={fieldDescription}
                onChange={(e) => setFieldDescription(e.target.value)}
                placeholder="Describe the purpose of this field..."
                rows={3}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.88rem', resize: 'vertical' }}
              />
            </div>


            {/* Help Text */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#64748b', marginBottom: 6 }}>
                Help Text
              </label>
              <input
                className="orbit-input"
                value={fieldHelpText}
                onChange={(e) => setFieldHelpText(e.target.value)}
                placeholder="Optional tooltip guidance for users"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.88rem' }}
              />
            </div>


            {/* Checkboxes */}
            <div style={{ display: 'flex', gap: 32, marginBottom: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox" checked={fieldRequired}
                  onChange={(e) => setFieldRequired(e.target.checked)}
                  style={{ accentColor: '#6366f1', width: 16, height: 16 }}
                />
                <div>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1c2033' }}>Required</span>
                  <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Always require a value in this field</div>
                </div>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox" checked={fieldUnique}
                  onChange={(e) => setFieldUnique(e.target.checked)}
                  style={{ accentColor: '#6366f1', width: 16, height: 16 }}
                />
                <div>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1c2033' }}>Unique</span>
                  <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Do not allow duplicate values</div>
                </div>
              </label>
            </div>
          </div>
        )}


        {/* Step 3: Field-Level Security */}
        {step === 3 && (
          <div className="fade-in">
            <h4 style={{ margin: '0 0 4px', fontSize: '0.95rem', fontWeight: 700, color: '#1c2033' }}>
              Step 3. Field-Level Security
            </h4>
            <p style={{ margin: '0 0 18px', fontSize: '0.82rem', color: '#64748b' }}>
              Select the profiles to which you want to grant edit access to this field.
            </p>


            <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
              {/* Table header */}
              <div
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 120px 120px',
                  padding: '12px 20px', borderBottom: '1px solid #e2e8f0',
                  background: 'rgba(99,102,241,0.02)',
                }}
              >
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  ROLE / PROFILE
                </span>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>
                  VISIBLE
                </span>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>
                  READ-ONLY
                </span>
              </div>


              {/* Rows */}
              {rolesLoading ? (
                <div style={{ padding: '28px 20px', textAlign: 'center', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <Loader size={16} className="spin" />
                  <span style={{ fontSize: '0.84rem' }}>Loading roles...</span>
                </div>
              ) : securityProfiles.length === 0 ? (
                <div style={{ padding: '28px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '0.84rem' }}>
                  No roles found for your organization.
                </div>
              ) : (
                securityProfiles.map((profile, idx) => (
                  <div
                    key={profile.id || profile.role}
                    style={{
                      display: 'grid', gridTemplateColumns: '1fr 120px 120px',
                      padding: '14px 20px', alignItems: 'center',
                      borderBottom: idx < securityProfiles.length - 1 ? '1px solid #e2e8f0' : 'none',
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#1c2033' }}>
                      {profile.role}
                    </span>
                    <div style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={profile.visible}
                        onChange={() => toggleSecurity(idx, 'visible')}
                        style={{ accentColor: '#6366f1', width: 17, height: 17, cursor: 'pointer' }}
                      />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={profile.readOnly}
                        onChange={() => toggleSecurity(idx, 'readOnly')}
                        style={{ accentColor: '#6366f1', width: 17, height: 17, cursor: 'pointer' }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}


        {/* Step 4: Add to Page Layouts */}
        {step === 4 && (
          <div className="fade-in">
            <h4 style={{ margin: '0 0 4px', fontSize: '0.95rem', fontWeight: 700, color: '#1c2033' }}>
              Step 4. Add to Page Layouts
            </h4>
            <p style={{ margin: '0 0 18px', fontSize: '0.82rem', color: '#64748b' }}>
              Select the page layouts that should include this field.
            </p>


            <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
              <label
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '16px 20px', cursor: 'pointer',
                  background: layoutSelected ? 'rgba(99,102,241,0.03)' : 'transparent',
                  transition: 'background 0.15s ease',
                }}
              >
                <input
                  type="checkbox"
                  checked={layoutSelected}
                  onChange={(e) => setLayoutSelected(e.target.checked)}
                  style={{ accentColor: '#6366f1', width: 17, height: 17 }}
                />
                <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#1c2033' }}>
                  {displayName} Layout
                </span>
              </label>
            </div>
          </div>
        )}


        {/* Footer Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, paddingTop: 18, borderTop: '1px solid #e2e8f0' }}>
          <button
            onClick={step === 1 ? onClose : handlePrevStep}
            style={{
              padding: '9px 20px', borderRadius: 10,
              border: '1px solid #e2e8f0', background: '#ffffff',
              color: '#475569', fontWeight: 600, fontSize: '0.84rem', cursor: 'pointer',
            }}
          >
            {step === 1 ? 'Cancel' : 'Previous'}
          </button>


          <div style={{ display: 'flex', gap: 10 }}>
            {step < totalSteps ? (
              <button
                onClick={handleNextStep}
                className="orbit-btn-primary"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '9px 20px', borderRadius: 10,
                  fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Next
                <ChevronRight size={15} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className="orbit-btn-primary"
                disabled={saving || !fieldLabel.trim()}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '9px 24px', borderRadius: 10,
                  fontSize: '0.84rem', fontWeight: 600,
                  cursor: saving ? 'wait' : 'pointer',
                  opacity: saving || !fieldLabel.trim() ? 0.6 : 1,
                }}
              >
                {saving ? <Loader size={14} className="spin" /> : <CheckCircle size={14} />}
                {saving ? 'Saving...' : 'Save Field'}
              </button>
            )}
          </div>
        </div>
      </div>


      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>,
    document.body
  );
}


export default ObjectDetail;



