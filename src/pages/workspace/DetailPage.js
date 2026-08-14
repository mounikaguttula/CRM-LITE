import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useWorkspace } from '../../context/WorkspaceContext';
import { apiGet, apiPost, apiPut, apiDelete } from '../../api/client';
import {
  Edit3,
  Mail,
  ArrowLeft,
  ChevronRight,
  Calendar,
  User,
  Building2,
  Hash,
  FileText,
  Briefcase,
  Users,
  ExternalLink,
  Plus,
  Package,
  Trash2,
  Search,
  X,
  Tag,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  RefreshCw,
  Layers,
  AlertTriangle,
  MapPin,
} from 'lucide-react';

/* ═══════════ DASHBOARD COLOR SYSTEM (UI only) ═══════════ */
const C = {
  bannerGrad: 'linear-gradient(115deg,#0b1220 0%,#0f1c2e 45%,#0a2a2a 100%)',
  canvasGrad: 'linear-gradient(135deg,#eef0ff 0%,#f3f6fb 45%,#e6f7f6 100%)',
  primaryGrad: 'linear-gradient(135deg,#6366f1,#22d3ee)',
  indigo: '#6366f1',
  cyan: '#22d3ee',
  success: '#34d399',
  danger: '#fb7185',
  text: '#1c2033',
  dim: '#6b7290',
  border: '#e6e9f2',
  card: '#ffffff',
};

/* ─── Standard Product Catalog ─── */
const DEFAULT_PRODUCTS = [
  { id: 'prod-1', name: 'CRM Starter', code: 'CRM-001', listPrice: 9999, description: 'Basic CRM for small teams', family: 'Software' },
  { id: 'prod-2', name: 'CRM Professional', code: 'CRM-002', listPrice: 29999, description: 'Advanced CRM with automation', family: 'Software' },
  { id: 'prod-3', name: 'CRM Enterprise', code: 'CRM-003', listPrice: 79999, description: 'Full-suite enterprise CRM', family: 'Software' },
  { id: 'prod-4', name: 'Onboarding Pack', code: 'SVC-001', listPrice: 15000, description: 'Dedicated onboarding & training', family: 'Services' },
  { id: 'prod-5', name: 'Priority Support', code: 'SVC-002', listPrice: 12000, description: '24/7 priority support plan', family: 'Services' },
  { id: 'prod-6', name: 'Data Migration', code: 'SVC-003', listPrice: 25000, description: 'Full data migration service', family: 'Services' },
  { id: 'prod-7', name: 'API Add-on', code: 'ADD-001', listPrice: 8000, description: 'Extended API access & webhooks', family: 'Add-ons' },
];

/* ─── Avatar helper ───────────── */
function getInitials(str) {
  if (!str) return 'U';
  const parts = String(str).trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : String(str).slice(0, 2).toUpperCase();
}

const TONES = [
  'linear-gradient(135deg,#6366f1,#a78bfa)',
  'linear-gradient(135deg,#fb7185,#f472b6)',
  'linear-gradient(135deg,#22d3ee,#38bdf8)',
  'linear-gradient(135deg,#34d399,#5eead4)',
  'linear-gradient(135deg,#fbbf24,#fb923c)',
  'linear-gradient(135deg,#818cf8,#c4b5fd)',
];

function avatarFor(name, size = 48, ring) {
  const text = getInitials(name);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size >= 48 ? 18 : 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: TONES[(text.charCodeAt(0) || 0) % TONES.length],
        color: '#fff',
        fontSize: size * 0.34,
        fontWeight: 700,
        flexShrink: 0,
        letterSpacing: '0.02em',
        boxShadow: ring
          ? '0 0 0 3px rgba(255,255,255,0.12), 0 12px 28px -12px rgba(34,211,238,.6)'
          : '0 6px 16px -8px rgba(16,20,40,.45)',
      }}
    >
      {text}
    </div>
  );
}

function smallAvatar(name, size = 26) {
  return avatarFor(name, size);
}

/* ─── Picklist status badge ─── */
function statusBadge(val) {
  if (!val) return <span style={{ color: C.dim }}>—</span>;
  const str = String(val).toLowerCase();
  let color;

  if (['new', 'qualified', 'won', 'active', 'completed', 'closed won'].some((s) => str.includes(s))) {
    color = C.success;
  } else if (['working', 'contacted', 'in progress', 'proposal', 'negotiation', 'needs analysis'].some((s) => str.includes(s))) {
    color = C.indigo;
  } else if (['nurturing', 'unqualified', 'lost', 'inactive', 'canceled', 'closed lost'].some((s) => str.includes(s))) {
    color = C.danger;
  } else {
    color = C.dim;
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '4px 11px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        color,
        background: `${color}1f`,
        border: `1px solid ${color}55`,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      {val}
    </span>
  );
}

/* ─── Product Family Badge Helper ─── */
function familyBadge(family) {
  if (!family) return null;
  const f = String(family).toLowerCase();
  let bg = '#f1f5f9';
  let color = '#475569';
  let border = '#cbd5e1';

  if (f.includes('software')) {
    bg = '#e0e7ff';
    color = '#3730a3';
    border = '#c7d2fe';
  } else if (f.includes('service')) {
    bg = '#d1fae5';
    color = '#065f46';
    border = '#a7f3d0';
  } else if (f.includes('add-on') || f.includes('addon')) {
    bg = '#fef3c7';
    color = '#92400e';
    border = '#fde68a';
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 700,
        background: bg,
        color: color,
        border: `1px solid ${border}`,
      }}
    >
      <Tag size={11} />
      {family}
    </span>
  );
}

/* ─── UUID format validator ─── */
const isUuid = (val) =>
  Boolean(val && typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

/* ─── Format Lookup & Owner IDs to Human Names ─── */
function formatLookupValue(fieldName, val, record, currentUser, organization, company, lookupMap = {}) {
  const nameLower = String(fieldName || '').toLowerCase();

  if (nameLower.includes('owner') || nameLower.includes('created_by') || nameLower.includes('updated_by') || nameLower.includes('user')) {
    if (val && isUuid(val)) {
      if (lookupMap && lookupMap[val]) {
        const u = lookupMap[val];
        const uName = u.name || u.display_name || (`${u.first_name || ''} ${u.last_name || ''}`.trim()) || u.email;
        if (uName) return uName;
      }
      if (lookupMap.users?.[val]) {
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
    if (record?.created_by_user?.name) return record.created_by_user.name;
    if (record?.owner_name) return record.owner_name;
    if (record?.owner?.name) return record.owner.name;
    const cName = currentUser?.name || (`${currentUser?.first_name || ''} ${currentUser?.last_name || ''}`.trim()) || currentUser?.email || 'Admin User';
    return cName;
  }

  if (!val) return '—';

  if (nameLower.includes('company') || nameLower.includes('organization') || nameLower.includes('account')) {
    if (isUuid(val)) {
      if (lookupMap.companies?.[val]) return lookupMap.companies[val].name || lookupMap.companies[val].company_name;
      if (record?.company_name) return record.company_name;
      if (record?.company?.name) return record.company.name;
      return organization?.name || company?.name || '—';
    }
    return String(val);
  }

  if (nameLower.includes('contact')) {
    if (isUuid(val)) {
      if (lookupMap.contacts?.[val]) return lookupMap.contacts[val].name || lookupMap.contacts[val].first_name;
      if (record?.contact_name) return record.contact_name;
      if (record?.contact?.name) return record.contact.name;
    }
    return String(val);
  }

  if (isUuid(val)) {
    if (lookupMap.all?.[val]) return lookupMap.all[val].name;
    return record?.[`${fieldName}_name`] || record?.[fieldName?.replace('_id', '')]?.name || '—';
  }

  return String(val);
}

/* ─── Clean Date Formatter ─── */
function formatDateValue(val) {
  if (!val) return '—';
  const str = String(val).trim();
  if (str.includes('T') || str.includes('-') || !isNaN(Date.parse(str))) {
    try {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        const datePart = d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        const hasTime = str.includes('T') || str.includes(':');
        if (hasTime) {
          const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
          return `${datePart}, ${timePart}`;
        }
        return datePart;
      }
    } catch (e) { }
  }
  return str;
}

/* ─── Field Icon Helper ─── */
function fieldIcon(fieldName, fieldType) {
  const n = (fieldName || '').toLowerCase();
  const p = { size: 14, color: '#9aa1bb' };
  if (n.includes('date') || fieldType === 'datetime' || fieldType === 'date') return <Calendar {...p} />;
  if (n.includes('owner') || n.includes('user') || n.includes('created_by') || n.includes('updated_by')) return <User {...p} />;
  if (n.includes('company') || n.includes('account') || n.includes('organization')) return <Building2 {...p} />;
  if (n.includes('contact')) return <User {...p} />;
  if (n.includes('email')) return <Mail {...p} />;
  if (n.includes('address') || fieldType === 'address' || n.includes('street') || n.includes('city') || n.includes('state') || n.includes('country') || n.includes('zip')) return <MapPin {...p} />;
  if (n.includes('note') || n.includes('description')) return <FileText {...p} />;
  if (fieldType === 'number' || fieldType === 'currency' || n.includes('amount')) return <Hash {...p} />;
  return null;
}

/* ─── Merge Record Details & System Information fields (Created & Modified pushed to END) ─── */
function getAllMergedFields(fields, record, objectTypeId) {
  const f = fields ? [...fields] : [];

  const lowerObj = String(objectTypeId || '').toLowerCase();
  if (lowerObj.includes('company') || lowerObj.includes('account')) {
    const stdCompFields = [
      { id: 'f_billing_address', name: 'billing_address', label: 'Billing Address', type: 'address' },
      { id: 'f_shipping_address', name: 'shipping_address', label: 'Shipping Address', type: 'address' },
    ];
    stdCompFields.forEach((scf) => {
      if (!f.some((existing) => (existing.name || '').toLowerCase() === scf.name)) {
        f.push(scf);
      }
    });
  }

  const detailsFields = [];
  const sysFieldsMap = new Map();

  f.forEach((x) => {
    const n = (x.name || '').toLowerCase();
    if (n !== 'id' && n !== 'organization_id' && n !== 'is_deleted') {
      if (n.includes('created') || n.includes('updated') || n.includes('modified')) {
        sysFieldsMap.set(n, x);
      } else {
        detailsFields.push(x);
      }
    }
  });

  if (!sysFieldsMap.has('created_at') && !sysFieldsMap.has('created_date') && (record?.created_at || record?.created_date)) {
    sysFieldsMap.set('created_at', { name: 'created_at', label: 'Created Date', type: 'datetime' });
  }
  if (!sysFieldsMap.has('created_by') && (record?.created_by || record?.owner_name)) {
    sysFieldsMap.set('created_by', { name: 'created_by', label: 'Created By', type: 'user' });
  }
  if (!sysFieldsMap.has('updated_at') && !sysFieldsMap.has('modified_date') && (record?.updated_at || record?.modified_date)) {
    sysFieldsMap.set('updated_at', { name: 'updated_at', label: 'Modified Date', type: 'datetime' });
  }
  if (!sysFieldsMap.has('updated_by') && record?.updated_by) {
    sysFieldsMap.set('updated_by', { name: 'updated_by', label: 'Modified By', type: 'user' });
  }

  const sysFields = Array.from(sysFieldsMap.values());

  // Push created & modified fields to the very end of layout
  return [...detailsFields, ...sysFields];
}

/* ─── Object Badge Icon Helper ─── */
function objectIcon(objectTypeId) {
  const t = String(objectTypeId || '').toLowerCase();
  if (t.includes('deal')) return <DollarSign size={12} style={{ color: '#00d699' }} />;
  if (t.includes('lead') || t.includes('contact')) return <User size={12} style={{ color: '#00d699' }} />;
  if (t.includes('company') || t.includes('account')) return <Building2 size={12} style={{ color: '#00d699' }} />;
  if (t.includes('project')) return <Briefcase size={12} style={{ color: '#00d699' }} />;
  return <Layers size={12} style={{ color: '#00d699' }} />;
}

/* ─── Derive Rich Left-side Header Sub-metadata ─── */
function deriveHeaderMetadata(objectTypeId, record, currentUser, organization, company, lookupMap) {
  if (!record) return [];
  const items = [];

  const email = record.email || (record.data && record.data.email);
  if (email) {
    items.push({ icon: 'email', label: email });
  }

  const ownerVal = formatLookupValue('owner', record.owner_id || record.owner, record, currentUser, organization, company, lookupMap);
  if (ownerVal && ownerVal !== '—') {
    items.push({ icon: 'user', label: `Owner: ${ownerVal}` });
  }

  const createdDate = record.created_at || record.created_date;
  if (createdDate) {
    items.push({ icon: 'calendar', label: `Created: ${formatDateValue(createdDate)}` });
  }

  return items;
}

/* ─── Number & Currency Formatter for KPI tiles ─── */
function formatKPIValue(val, isCurrency = false) {
  if (!val) return '—';
  const num = Number(String(val).replace(/[^0-9.-]+/g, ''));
  if (isNaN(num)) return String(val);
  if (num >= 1_000_000_000) return isCurrency ? `$${(num / 1_000_000_000).toFixed(1)}B` : `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return isCurrency ? `$${(num / 1_000_000).toFixed(1)}M` : `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return isCurrency ? `$${(num / 1_000).toFixed(0)}K` : `${(num / 1_000).toFixed(0)}K`;
  return isCurrency ? `$${num.toLocaleString()}` : num.toLocaleString();
}

/* ─── Derive 3 dynamic KPI glassmorphism stat tiles for Header Banner (Strict Empirical Data) ─── */
function deriveHeaderTiles(objectTypeId, record, currentUser, organization, company, lookupMap) {
  if (!record) return [];
  const type = String(objectTypeId || '').toLowerCase();

  const getRealVal = (keys) => {
    for (const k of keys) {
      if (record[k] !== undefined && record[k] !== null && record[k] !== '') return String(record[k]);
      if (record.data && record.data[k] !== undefined && record.data[k] !== null && record.data[k] !== '') return String(record.data[k]);
    }
    return null;
  };

  const tiles = [];

  if (type.includes('deal')) {
    const val = getRealVal(['amount', 'value', 'deal_value', 'total']);
    if (val) tiles.push({ label: 'Value', value: formatKPIValue(val, true), color: '#00b09b' });

    const stage = getRealVal(['stage', 'status']);
    if (stage) tiles.push({ label: 'Stage', value: stage, color: '#4facfe' });

    const target = getRealVal(['close_date', 'expected_close_date', 'target_date']);
    if (target) tiles.push({ label: 'Target', value: formatDateValue(target), color: '#a18cd1' });
  } else if (type.includes('lead')) {
    const status = getRealVal(['status', 'lead_status']);
    if (status) tiles.push({ label: 'Status', value: status, color: '#00b09b' });

    const source = getRealVal(['source', 'lead_source']);
    if (source) tiles.push({ label: 'Source', value: source, color: '#4facfe' });

    const priority = getRealVal(['rating', 'priority', 'score']);
    if (priority) tiles.push({ label: 'Priority', value: priority, color: '#f6d365' });
  } else if (type.includes('contact')) {
    const role = getRealVal(['title', 'job_title', 'role']);
    if (role) tiles.push({ label: 'Role', value: role, color: '#a18cd1' });

    const phone = getRealVal(['phone', 'mobile']);
    if (phone) tiles.push({ label: 'Contact', value: phone, color: '#4facfe' });

    const ownerVal = formatLookupValue('owner', record.owner_id || record.owner, record, currentUser, organization, company, lookupMap);
    if (ownerVal && ownerVal !== '—') tiles.push({ label: 'Owner', value: ownerVal, color: '#00b09b' });
  } else if (type.includes('company') || type.includes('account')) {
    const industry = getRealVal(['industry', 'sector']);
    if (industry) tiles.push({ label: 'Industry', value: industry, color: '#4facfe' });

    const size = getRealVal(['employees', 'size', 'number_of_employees']);
    if (size) tiles.push({ label: 'Size', value: size, color: '#00b09b' });

    const rev = getRealVal(['annual_revenue', 'revenue']);
    if (rev) tiles.push({ label: 'Revenue', value: formatKPIValue(rev, true), color: '#f6d365' });
  }

  // Fallback to real fields if tiles list has < 3 items
  if (tiles.length < 3) {
    const status = getRealVal(['status', 'state', 'stage']);
    if (status && !tiles.some((t) => t.label === 'Status' || t.label === 'Stage')) {
      tiles.push({ label: 'Status', value: status, color: '#00b09b' });
    }

    const created = record.created_at || record.created_date;
    if (created && !tiles.some((t) => t.label === 'Created' || t.label === 'Target')) {
      tiles.push({ label: 'Created', value: formatDateValue(created), color: '#4facfe' });
    }

    const ownerVal = formatLookupValue('owner', record.owner_id || record.owner, record, currentUser, organization, company, lookupMap);
    if (ownerVal && ownerVal !== '—' && !tiles.some((t) => t.label === 'Owner')) {
      tiles.push({ label: 'Owner', value: ownerVal, color: '#a18cd1' });
    }
  }

  return tiles.slice(0, 3);
}

/* ═══════════════════════════════════════════════════════════════
   StageProgress  (Interactive Deal & Lead Stage Pipeline)
   ═══════════════════════════════════════════════════════════════ */
function StageProgress({ record, meta, objectTypeId, recordId, onRecordUpdated, onEdit, emailVal }) {
  const stageField =
    meta?.fields?.find((f) => (f.name || '').toLowerCase() === 'stage') ||
    meta?.fields?.find((f) => (f.name || '').toLowerCase() === 'status');

  let defaultStages = ['Qualification', 'Discovery', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];

  if (stageField) {
    if (Array.isArray(stageField.options) && stageField.options.length > 0) {
      defaultStages = stageField.options.map((o) => (typeof o === 'object' ? o.value || o.label : String(o)));
    } else if (Array.isArray(stageField.picklistValues) && stageField.picklistValues.length > 0) {
      defaultStages = stageField.picklistValues.map(String);
    }
  }

  const currentVal =
    record?.stage ||
    (record?.data && record.data.stage) ||
    record?.status ||
    (record?.data && record.data.status) ||
    defaultStages[0];

  const currentIdx = defaultStages.findIndex(
    (s) => String(s).trim().toLowerCase() === String(currentVal).trim().toLowerCase()
  );
  const activeIndex = currentIdx >= 0 ? currentIdx : 0;

  const [selectedIdx, setSelectedIdx] = useState(activeIndex);
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    setSelectedIdx(activeIndex);
  }, [activeIndex]);

  const handleSaveStage = async (targetStage) => {
    setSaving(true);
    // Synchronize both `stage` and `status` fields in payload so backend and state are 100% in sync
    const payload = {
      stage: targetStage,
      status: targetStage,
    };
    if (stageField?.name && stageField.name !== 'stage' && stageField.name !== 'status') {
      payload[stageField.name] = targetStage;
    }

    try {
      let res;
      try {
        res = await apiPut(`/objects/${objectTypeId}/${recordId}`, payload);
      } catch (err) {
        res = await apiPut(`/${objectTypeId}/${recordId}`, payload);
      }

      const resObj = res?.data || res || {};
      const updatedRecord = {
        ...record,
        ...resObj,
        stage: targetStage,
        status: targetStage,
        data: {
          ...(record?.data || {}),
          ...(resObj.data || {}),
          stage: targetStage,
          status: targetStage,
        },
      };

      const newIdx = defaultStages.findIndex(
        (s) => String(s).trim().toLowerCase() === String(targetStage).trim().toLowerCase()
      );
      if (newIdx >= 0) {
        setSelectedIdx(newIdx);
      }

      if (onRecordUpdated) onRecordUpdated(updatedRecord);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
    } catch (err) {
      console.error('Failed to update stage:', err);
      alert('Failed to update stage: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handleAction = () => {
    if (selectedIdx === activeIndex) {
      if (activeIndex < defaultStages.length - 1) {
        handleSaveStage(defaultStages[activeIndex + 1]);
      }
    } else {
      handleSaveStage(defaultStages[selectedIdx]);
    }
  };

  const isSelectedCurrent = selectedIdx === activeIndex;
  const isLastStage = activeIndex === defaultStages.length - 1;
  const targetStageName = defaultStages[selectedIdx];
  const progressPct = Math.round(((activeIndex + 1) / defaultStages.length) * 100);

  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: 22,
        padding: '22px 26px',
        border: '1.5px solid #e2e8f0',
        boxShadow: '0 4px 20px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.03)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        margin: '8px 0',
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      {/* Top Header Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 38, height: 38, borderRadius: 12,
              background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
              color: '#ffffff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(99,102,241,0.3)',
            }}
          >
            <TrendingUp size={19} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
              Stage Progress
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b', fontWeight: 500 }}>
              Current Stage: <strong style={{ color: '#0f172a' }}>{currentVal}</strong>
            </p>
          </div>
        </div>

        {/* Dynamic Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {justSaved && (
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 5 }}>
              <CheckCircle2 size={16} /> Updated!
            </span>
          )}

          <button
            onClick={handleAction}
            disabled={saving || (isSelectedCurrent && isLastStage)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 22px', borderRadius: 12,
              fontSize: 13.5, fontWeight: 700, color: '#ffffff',
              background: saving || (isSelectedCurrent && isLastStage)
                ? '#94a3b8'
                : 'linear-gradient(135deg, #6366f1, #3b82f6)',
              border: 'none', cursor: saving || (isSelectedCurrent && isLastStage) ? 'not-allowed' : 'pointer',
              boxShadow: saving || (isSelectedCurrent && isLastStage) ? 'none' : '0 6px 18px rgba(99,102,241,0.35)',
              transition: 'all 0.2s ease',
            }}
          >
            {saving ? (
              <>
                <RefreshCw size={15} style={{ animation: 'dp-spin 0.8s linear infinite' }} /> Updating...
              </>
            ) : isSelectedCurrent ? (
              isLastStage ? (
                <>
                  <CheckCircle2 size={16} /> Stage Completed
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} /> Mark Stage as Complete
                </>
              )
            ) : (
              <>
                <CheckCircle2 size={16} /> Mark as {targetStageName}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stage Flow Pills */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          overflowX: 'auto',
          padding: '4px 2px',
          scrollbarWidth: 'thin',
        }}
      >
        {defaultStages.map((stgName, idx) => {
          const isPassed = idx < activeIndex;
          const isActive = idx === activeIndex;
          const isSelected = idx === selectedIdx;
          const isHovered = idx === hoveredIdx;
          const isWon = String(stgName).toLowerCase().includes('won');
          const isLost = String(stgName).toLowerCase().includes('lost');

          let bg = '#f8fafc';
          let border = '1.5px solid #e2e8f0';
          let color = '#64748b';
          let badgeBg = '#e2e8f0';
          let badgeColor = '#475569';
          let icon = null;

          if (isPassed) {
            bg = '#f0fdf4';
            border = '1.5px solid #a7f3d0';
            color = '#15803d';
            badgeBg = '#dcfce7';
            badgeColor = '#166534';
            icon = '✓';
          } else if (isActive) {
            if (isWon) {
              bg = 'linear-gradient(135deg, #10b981, #047857)';
              border = 'none';
              color = '#ffffff';
              badgeBg = 'rgba(255,255,255,0.25)';
              badgeColor = '#fff';
              icon = '🏆';
            } else if (isLost) {
              bg = 'linear-gradient(135deg, #f43f5e, #be123c)';
              border = 'none';
              color = '#ffffff';
              badgeBg = 'rgba(255,255,255,0.25)';
              badgeColor = '#fff';
              icon = '✕';
            } else {
              bg = 'linear-gradient(135deg, #6366f1, #3b82f6)';
              border = 'none';
              color = '#ffffff';
              badgeBg = 'rgba(255,255,255,0.22)';
              badgeColor = '#fff';
              icon = '★';
            }
          }

          return (
            <div
              key={stgName}
              onClick={() => setSelectedIdx(idx)}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{
                flex: 1,
                minWidth: 128,
                display: 'flex',
                alignItems: 'center',
                justifyContent: icon ? 'flex-start' : 'center',
                gap: 8,
                padding: '11px 14px',
                borderRadius: 14,
                background: isHovered && !isActive ? '#f1f5f9' : bg,
                border: isSelected && !isActive ? '2.5px solid #6366f1' : border,
                boxShadow: isActive
                  ? '0 8px 22px rgba(99,102,241,0.35)'
                  : isSelected
                    ? '0 4px 14px rgba(99,102,241,0.2)'
                    : isHovered
                      ? '0 4px 12px rgba(0,0,0,0.06)'
                      : 'none',
                color,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                userSelect: 'none',
                transform: isHovered || isSelected ? 'translateY(-2px)' : 'none',
              }}
            >
              {icon && (
                <div
                  style={{
                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: badgeBg, color: badgeColor,
                    fontSize: 11, fontWeight: 800,
                  }}
                >
                  {icon}
                </div>
              )}
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: isActive ? 800 : isSelected ? 700 : 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {stgName}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DetailPage
   ═══════════════════════════════════════════════════════════════ */
function DetailPage({ recordId: propRecordId, objectTypeId: propObjectTypeId, onClose, onEdit }) {
  const params = useParams();
  const objectTypeId = propObjectTypeId || params.objectTypeId;
  const recordId = propRecordId || params.recordId;

  const { objectTypes, permissions, currentUser, organization, company } = useWorkspace();
  const navigate = useNavigate();

  const [record, setRecord] = useState(null);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('Overview');
  const [converting, setConverting] = useState(false);

  /* Lookup Data Stores for Related Records & Lookup Resolution */
  const [lookupMap, setLookupMap] = useState({ users: {}, companies: {}, contacts: {}, deals: {}, all: {} });
  const [relatedDeals, setRelatedDeals] = useState([]);
  const [relatedContacts, setRelatedContacts] = useState([]);
  const [parentCompany, setParentCompany] = useState(null);
  const [primaryContact, setPrimaryContact] = useState(null);

  /* Products & Line Items state */
  const [lineItems, setLineItems] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [selectedFamilyFilter, setSelectedFamilyFilter] = useState('All');
  const [selectedProdIds, setSelectedProdIds] = useState([]);
  const [editLineItems, setEditLineItems] = useState([]);

  useEffect(() => {
    let isMounted = true;
    if (!objectTypeId || !recordId) return;

    setLoading(true);
    setError(null);

    Promise.all([
      apiGet(`/objects/${objectTypeId}/${recordId}`).catch(() => apiGet(`/${objectTypeId}/${recordId}`)),
      apiGet(`/metadata/objects/${objectTypeId}/fields`).catch(() => apiGet(`/objects/${objectTypeId}/fields`)).catch(() => []),
      apiGet('/objects/companies').catch(() => apiGet('/companies')).catch(() => []),
      apiGet('/objects/contacts').catch(() => apiGet('/contacts')).catch(() => []),
      apiGet('/objects/deals').catch(() => apiGet('/deals')).catch(() => []),
      apiGet('/users').catch(() => []),
    ])
      .then(([rec, fList, compListRes, contactListRes, dealListRes, userListRes]) => {
        if (!isMounted) return;
        const recData = rec?.data || rec;
        setRecord(recData);

        const fieldsData = Array.isArray(fList) ? fList : fList?.data || [];
        if (fieldsData && fieldsData.length > 0) setFields(fieldsData);

        const compList = Array.isArray(compListRes) ? compListRes : compListRes?.data || [];
        const contactList = Array.isArray(contactListRes) ? contactListRes : contactListRes?.data || [];
        const dealList = Array.isArray(dealListRes) ? dealListRes : dealListRes?.data || [];
        const userList = Array.isArray(userListRes) ? userListRes : userListRes?.data || [];

        // Build lookup maps
        const compMap = {};
        compList.forEach((c) => { compMap[c.id] = c; });

        const contMap = {};
        contactList.forEach((ct) => { contMap[ct.id] = ct; });

        const dlMap = {};
        dealList.forEach((d) => { dlMap[d.id] = d; });

        const uMap = {};
        userList.forEach((u) => { uMap[u.id] = u; });

        setLookupMap({
          companies: compMap,
          contacts: contMap,
          deals: dlMap,
          users: uMap,
          all: { ...compMap, ...contMap, ...dlMap, ...uMap },
        });

        const currentObjKey = String(objectTypeId).toLowerCase();
        const curId = recData?.id || recordId;
        const compId = recData?.company_id || recData?.company || recData?.parent_id;
        const contactId = recData?.contact_id || recData?.contact || recData?.secondary_parent_id;

        // Resolve Parent Company & Primary Contact for Deals / Contacts
        if (compId && compMap[compId]) setParentCompany(compMap[compId]);
        if (contactId && contMap[contactId]) setPrimaryContact(contMap[contactId]);

        // Calculate Related Lists based on object type
        if (currentObjKey.includes('company') || currentObjKey.includes('account')) {
          const matchedDeals = dealList.filter(
            (d) =>
              String(d.company_id) === String(curId) ||
              String(d.company) === String(curId) ||
              String(d.parent_id) === String(curId) ||
              (recData?.name && String(d.company_name || d.company).toLowerCase() === String(recData.name).toLowerCase())
          );
          const matchedContacts = contactList.filter(
            (ct) =>
              String(ct.company_id) === String(curId) ||
              String(ct.company) === String(curId) ||
              String(ct.parent_id) === String(curId) ||
              (recData?.name && String(ct.company_name || ct.company).toLowerCase() === String(recData.name).toLowerCase())
          );
          setRelatedDeals(matchedDeals);
          setRelatedContacts(matchedContacts);
        } else if (currentObjKey.includes('contact')) {
          const matchedDeals = dealList.filter(
            (d) =>
              String(d.contact_id) === String(curId) ||
              String(d.secondary_parent_id) === String(curId) ||
              (compId && (String(d.company_id) === String(compId) || String(d.parent_id) === String(compId)))
          );
          setRelatedDeals(matchedDeals);
        } else if (currentObjKey.includes('deal')) {
          if (compId && compMap[compId]) setParentCompany(compMap[compId]);
          if (contactId && contMap[contactId]) setPrimaryContact(contMap[contactId]);

          // Load Line Items for Deal (DB state as primary source of truth)
          let loadedItems = [];
          if (recData?.line_items && Array.isArray(recData.line_items)) {
            loadedItems = recData.line_items;
          } else if (recData?.data?.line_items && Array.isArray(recData.data.line_items)) {
            loadedItems = recData.data.line_items;
          } else {
            try {
              const saved = localStorage.getItem(`crm_line_items_${curId}`);
              if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) loadedItems = parsed;
              }
            } catch (e) { }
          }

          setLineItems(loadedItems);

          if (currentObjKey.includes('deal') && loadedItems && loadedItems.length > 0) {
            const calcTotal = loadedItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
            setRecord((prev) => (prev ? { ...prev, amount: calcTotal } : prev));
            if (recData?.amount !== calcTotal) {
              const payloadToSync = {
                ...(recData || {}),
                amount: calcTotal,
                line_items: loadedItems,
              };
              apiPut(`/objects/${objectTypeId}/${curId}`, payloadToSync)
                .catch(() => apiPut(`/deals/${curId}`, payloadToSync))
                .catch((err) => console.warn('Auto-syncing deal amount failed soft:', err));
            }
          }
        }
      })
      .catch((err) => {
        console.error(`Error loading record ${recordId}:`, err);
        if (isMounted) setError(err.message || 'Failed to fetch record from backend server.');
      })
      .finally(() => { if (isMounted) setLoading(false); });

    return () => { isMounted = false; };
  }, [objectTypeId, recordId]);

  /* Synchronize line items & update Deal Amount conditionally */
  const syncLineItemsAndAmount = (newItems) => {
    setLineItems(newItems);
    if (recordId) {
      try {
        localStorage.setItem(`crm_line_items_${recordId}`, JSON.stringify(newItems));
        localStorage.setItem(`crm_line_items_visited_${recordId}`, 'true');
      } catch (e) { }
    }

    const currentObjKey = String(objectTypeId).toLowerCase();
    if (newItems && newItems.length > 0) {
      const grandTotal = newItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
      setRecord((prev) => (prev ? { ...prev, amount: grandTotal } : prev));

      if (recordId && currentObjKey.includes('deal')) {
        const updatedPayload = {
          ...(record || {}),
          amount: grandTotal,
          line_items: newItems,
        };
        apiPut(`/objects/${objectTypeId}/${recordId}`, updatedPayload)
          .catch(() => apiPut(`/deals/${recordId}`, updatedPayload))
          .catch((err) => console.warn('Syncing deal amount failed soft:', err));
      }
    } else {
      // If all line items are removed, line_items is empty.
      // Retain current manually set amount and preserve editability.
      if (recordId && currentObjKey.includes('deal')) {
        const updatedPayload = {
          ...(record || {}),
          line_items: [],
        };
        apiPut(`/objects/${objectTypeId}/${recordId}`, updatedPayload)
          .catch(() => apiPut(`/deals/${recordId}`, updatedPayload))
          .catch((err) => console.warn('Syncing empty line items failed soft:', err));
      }
    }
  };

  const handleClose = () => (onClose ? onClose() : navigate(`/workspace/object/${objectTypeId}`));
  const handleEditClick = () => {
    if (onEdit) return onEdit();
    navigate(`/workspace/object/${objectTypeId}/${recordId}/edit`);
  };

  const pluralize = (word) => {
    if (!word) return word;
    const lower = String(word).toLowerCase();
    if (lower.endsWith('y') && !lower.endsWith('ay') && !lower.endsWith('ey') && !lower.endsWith('iy') && !lower.endsWith('oy') && !lower.endsWith('uy')) {
      return `${lower.slice(0, -1)}ies`;
    }
    if (lower.endsWith('s')) return lower;
    return `${lower}s`;
  };

  const fillRequiredFields = (objectType, payload = {}, extras = {}) => {
    const meta = objectTypes?.[objectType];
    if (!meta?.fields || !Array.isArray(meta.fields)) return { ...payload, ...extras };

    const result = { ...payload, ...extras };
    const companyName = String(record?.company || record?.company_name || record?.account || `${record?.name || record?.title || 'Company'} Company`).trim();
    const contactName = String(record?.name || `${record?.first_name || ''} ${record?.last_name || ''}`.trim() || record?.email || 'Contact').trim();

    for (const field of meta.fields) {
      if (!field.required) continue;
      const key = field.name;
      const value = result[key];
      if (value !== undefined && String(value).trim() !== '') continue;

      switch (key) {
        case 'name':
        case 'company_name':
        case 'account_name':
          result[key] = result.name || companyName;
          break;
        case 'title':
          result[key] = result.title || result.name || companyName;
          break;
        case 'profit':
          result.profit = record?.profit ?? record?.amount ?? 0;
          break;
        case 'amount':
          result.amount = record?.amount ?? 0;
          break;
        case 'industry':
          result.industry = record?.industry || record?.company_industry || 'General';
          break;
        case 'website':
          result.website = record?.website || record?.web || `https://www.${companyName.replace(/\s+/g, '').toLowerCase()}.com`;
          break;
        case 'phone':
          result.phone = result.phone || result.mobile || record?.phone || record?.mobile || '0000000000';
          break;
        case 'email':
          result.email = record?.email || record?.email_address || `${contactName.replace(/\s+/g, '.').toLowerCase()}@example.com`;
          break;
        case 'company_id':
        case 'company':
          result[key] = result.company_id || result.company || extras.companyId || undefined;
          break;
        case 'contact_id':
        case 'contact':
          result[key] = result.contact_id || result.contact || extras.contactId || undefined;
          break;
        default:
          if (key.endsWith('_id') && key.includes('company')) {
            result[key] = extras.companyId || result[key] || undefined;
          } else if (key.endsWith('_id') && key.includes('contact')) {
            result[key] = extras.contactId || result[key] || undefined;
          } else if (key.endsWith('_id') && key.includes('deal')) {
            result[key] = extras.dealId || result[key] || undefined;
          }
          break;
      }
    }

    return result;
  };

  const createObjectRecord = async (baseType, payload) => {
    const candidates = [
      baseType,
      pluralize(baseType),
      `${baseType}__c`,
      `${pluralize(baseType)}__c`,
      baseType === 'company' ? 'account' : null,
      baseType === 'company' ? 'accounts' : null,
      baseType === 'contact' ? 'person' : null,
      baseType === 'contact' ? 'people' : null,
      baseType === 'deal' ? 'opportunity' : null,
      baseType === 'deal' ? 'opportunities' : null,
    ].filter(Boolean);

    let firstError = null;
    for (const candidate of candidates) {
      const paths = [`/objects/${candidate}`, `/${candidate}`];
      for (const path of paths) {
        try {
          const res = await apiPost(path, payload);
          return res?.data || res;
        } catch (err) {
          if (!firstError) firstError = { path, message: err.message, status: err.status, data: err.data };
          continue;
        }
      }
    }

    const errMsg = firstError
      ? `Unable to create record. Tried ${candidates.join(', ')}. First failure: ${firstError.path} => ${firstError.message}`
      : `Unable to create record for candidates: ${candidates.join(', ')}`;
    throw new Error(errMsg);
  };

  const currentLeadStatus = String(record?.status || record?.data?.status || record?.stage || record?.data?.stage || '').toLowerCase();
  const isAlreadyConverted = currentLeadStatus === 'converted' || Boolean(record?.is_converted) || Boolean(record?.data?.is_converted);

  const handleConvertLead = async () => {
    if (!record || converting) return;

    if (isAlreadyConverted) {
      alert('This Lead has already been converted into a Company, Contact, and Deal.');
      return;
    }

    if (!window.confirm('Convert this lead into Company, Contact and Deal?')) return;

    setConverting(true);
    setError(null);

    try {
      const companyName = String(record.company || record.company_name || record.account || `${record.name || record.title || 'Company'} Company`).trim();
      const contactName = String(record.name || `${record.first_name || ''} ${record.last_name || ''}`.trim() || record.email || 'Contact').trim();
      const dealName = String(record.title || `${contactName} Opportunity`).trim();

      const companyPayload = fillRequiredFields('company', {
        name: companyName || 'New Company',
        industry: record.industry || record.company_industry || null,
        phone: record.phone || record.mobile || null,
        website: record.website || record.web || null,
      });
      const companyRecord = await createObjectRecord('company', companyPayload);
      const companyId = companyRecord?.id || companyRecord?._id || companyRecord?.company_id || null;

      const contactPayload = fillRequiredFields('contact', {
        name: contactName,
        email: record.email || record.email_address || null,
        phone: record.phone || record.mobile || null,
        company_id: companyId || undefined,
        company: companyId || undefined,
      }, { companyId });
      const contactRecord = await createObjectRecord('contact', contactPayload);
      const contactId = contactRecord?.id || contactRecord?._id || contactRecord?.contact_id || null;

      const dealPayload = fillRequiredFields('deal', {
        name: dealName,
        company_id: companyId || undefined,
        contact_id: contactId || undefined,
        amount: record.amount || record.value || null,
        stage: 'Qualification',
        status: 'New',
      }, { companyId, contactId });
      const dealRecord = await createObjectRecord('deal', dealPayload);
      const dealId = dealRecord?.id || dealRecord?._id || dealRecord?.deal_id || null;

      const leadPayload = {
        status: 'Converted',
        stage: 'Converted',
        company_id: companyId || undefined,
        company: companyId || undefined,
        contact_id: contactId || undefined,
        contact: contactId || undefined,
      };
      await apiPut(`/objects/${objectTypeId}/${recordId}`, leadPayload).catch(() => apiPut(`/${objectTypeId}/${recordId}`, leadPayload));

      setRecord((prev) => ({ ...prev, ...leadPayload }));
      if (dealId) {
        navigate(`/workspace/object/deal/${dealId}`);
      } else if (companyId) {
        navigate(`/workspace/object/company/${companyId}`);
      }
    } catch (err) {
      console.error('Lead conversion failed:', err);
      setError(err.message || 'Lead conversion failed.');
    } finally {
      setConverting(false);
    }
  };

  const rawMeta = objectTypes ? objectTypes[objectTypeId] : null;
  const rawEffectiveFields = fields.length > 0 ? fields : (rawMeta?.fields || []);

  const readableFields = rawEffectiveFields.filter((f) => {
    const fp = permissions?.fieldPermissions?.[f.id];
    const canRead = f.canRead !== undefined ? f.canRead : (fp ? fp.canRead !== false : true);
    return canRead !== false;
  });

  const meta = {
    displayName: rawMeta?.displayName || (objectTypeId ? objectTypeId.charAt(0).toUpperCase() + objectTypeId.slice(1).replace(/s$/, '') : 'Record'),
    pluralDisplayName: rawMeta?.pluralDisplayName || (objectTypeId ? objectTypeId.charAt(0).toUpperCase() + objectTypeId.slice(1) : 'Records'),
    fields: readableFields,
  };

  const cleanObjKey = String(objectTypeId || '').toLowerCase();
  const canDeleteRecord = permissions?.canDelete !== false && permissions?.[objectTypeId]?.canDelete !== false && permissions?.[cleanObjKey]?.canDelete !== false;

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState(false);
  const [deleteRecordError, setDeleteRecordError] = useState(null);

  const confirmDeleteDetailPageRecord = async () => {
    setDeletingRecord(true);
    setDeleteRecordError(null);
    try {
      await apiDelete(`/objects/${objectTypeId}/${recordId}`);
      setShowDeleteModal(false);
      handleClose();
    } catch (err) {
      console.error('Delete record error:', err);
      setDeleteRecordError(err?.message || 'Failed to delete record.');
    } finally {
      setDeletingRecord(false);
    }
  };

  const pageWrap = {
    background: C.canvasGrad,
    minHeight: '100%',
    padding: '14px 24px 28px',
  };

  if (error) {
    return (
      <div style={pageWrap}>
        <div style={{
          maxWidth: 720, margin: '40px auto', padding: '22px 24px', borderRadius: 18,
          background: 'rgba(251,113,133,.08)', border: '1px solid rgba(251,113,133,.35)',
          color: '#b4324a', fontWeight: 600,
        }}>
          Error: {error}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ ...pageWrap, display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, color: C.dim }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            border: '3px solid rgba(99,102,241,.2)', borderTopColor: C.indigo,
            animation: 'dp-spin 0.8s linear infinite',
          }} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>Loading record details…</span>
        </div>
        <style>{`@keyframes dp-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!record) {
    return (
      <div style={{ ...pageWrap, display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
        <div style={{
          textAlign: 'center', padding: '48px 40px', borderRadius: 22, background: C.card,
          border: `1px solid ${C.border}`, boxShadow: '0 18px 40px -26px rgba(20,26,50,.35)',
        }}>
          <p style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: C.text }}>Record not found.</p>
          <button
            onClick={handleClose}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px',
              borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700,
              color: '#fff', background: C.primaryGrad,
            }}
          >
            <ArrowLeft size={16} /> Back to {meta.pluralDisplayName}
          </button>
        </div>
      </div>
    );
  }

  /* Derive titles & subtitles */
  const titleField = meta.fields?.find((f) => f.isTitle || f.name === 'name' || f.name === 'title' || f.name === 'company_name' || f.name === 'subject');
  const titleCandidate = (titleField && titleField.name !== 'id' && record[titleField.name])
    ? record[titleField.name]
    : (record.name || record.company_name || record.company || record.title || record.subject || record.display_name || record.account_name);
  const recordTitle = (titleCandidate && !isUuid(titleCandidate))
    ? titleCandidate
    : (record.name || record.company_name || record.title || record.subject || `Record #${recordId}`);

  /* ── Fully Dynamic Field Value Lookup from Universal Table Record ── */
  const getRecordValue = (fName, rec) => {
    if (!rec || !fName) return undefined;

    const aliasesMap = {
      title: ['title', 'job_title', 'role'],
      job_title: ['job_title', 'title', 'role'],
      lead_source: ['lead_source', 'source'],
      source: ['source', 'lead_source'],
      billing_address: ['billing_address', 'address', 'billing_street', 'street'],
      shipping_address: ['shipping_address', 'address', 'shipping_street', 'street'],
      address: ['address', 'billing_address', 'shipping_address', 'street'],
    };

    const searchKeys = aliasesMap[(fName || '').toLowerCase()] || [fName];

    for (const key of searchKeys) {
      if (rec[key] !== undefined && rec[key] !== null && rec[key] !== '') {
        return rec[key];
      }
      if (rec.data && typeof rec.data === 'object' && rec.data[key] !== undefined && rec.data[key] !== null && rec.data[key] !== '') {
        return rec.data[key];
      }
    }

    for (const key of searchKeys) {
      const targetClean = String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
      const sources = [rec, rec.data || {}];

      for (const src of sources) {
        if (!src || typeof src !== 'object') continue;
        for (const [k, v] of Object.entries(src)) {
          if (k === 'data') continue;
          const kClean = String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
          if (kClean === targetClean && v !== undefined && v !== null && v !== '') {
            return v;
          }
        }
      }
    }

    return undefined;
  };

  const subtitleField = meta.fields?.find((f) => f.name === 'email' || f.name === 'company' || f.name === 'company_name' || f.name === 'account');
  let rawSubtitleVal = subtitleField
    ? getRecordValue(subtitleField.name, record)
    : (record.email || record.company_name || getRecordValue('email', record) || getRecordValue('company', record) || '');
  if (rawSubtitleVal && typeof rawSubtitleVal === 'object') {
    rawSubtitleVal = rawSubtitleVal.name || rawSubtitleVal.company_name || rawSubtitleVal.display_name || '';
  }
  let subtitleVal = isUuid(rawSubtitleVal)
    ? formatLookupValue(subtitleField?.name || 'company', rawSubtitleVal, record, currentUser, organization, company, lookupMap)
    : String(rawSubtitleVal || '');
  if (subtitleVal === '—' || isUuid(subtitleVal)) subtitleVal = '';

  const emailField = meta.fields?.find((f) => f.type === 'email');
  const emailVal = emailField ? getRecordValue(emailField.name, record) : (record.email || getRecordValue('email', record));

  /* ── Render Field Value ── */
  const renderFieldValue = (f) => {
    const val = getRecordValue(f.name, record);
    const fNameLower = (f.name || '').toLowerCase();

    if (f.type === 'picklist' || fNameLower === 'status' || fNameLower === 'stage') {
      return statusBadge(val);
    }

    if (fNameLower.includes('amount') || f.type === 'currency' || fNameLower.includes('revenue') || fNameLower.includes('value')) {
      const targetVal = val !== undefined && val !== null && val !== '' ? val : (record?.amount ?? (grandTotalAmount > 0 ? grandTotalAmount : undefined));
      const numVal = Number(targetVal);
      if (!isNaN(numVal) && targetVal !== null && targetVal !== undefined && targetVal !== '') {
        return <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '1.05rem' }}>${numVal.toLocaleString()}</span>;
      }
    }

    /* Owner / Created By / User Lookups */
    if (fNameLower.includes('owner') || fNameLower.includes('created_by') || fNameLower.includes('updated_by')) {
      const ownerVal = formatLookupValue(f.name, val, record, currentUser, organization, company, lookupMap);
      const hasVal = ownerVal && ownerVal !== '—';
      if (hasVal) {
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontWeight: 600, color: C.text }}>
            {smallAvatar(String(ownerVal), 26)}
            {ownerVal}
          </span>
        );
      }
      return <span style={{ color: C.dim }}>—</span>;
    }

    /* Company / Account Lookup Field */
    if (fNameLower.includes('company') || fNameLower.includes('account')) {
      const compId = isUuid(val) ? val : (record.company_id || record.company || record.parent_id);
      const companyVal = formatLookupValue(f.name, val, record, currentUser, organization, company, lookupMap);
      const targetId = isUuid(compId) ? compId : (parentCompany ? parentCompany.id : null);

      if (targetId) {
        return (
          <Link
            to={`/workspace/object/company/${targetId}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontWeight: 700,
              color: C.indigo,
              textDecoration: 'none',
              padding: '2px 8px',
              borderRadius: 6,
              background: 'rgba(99,102,241,0.08)',
              transition: 'all .15s ease',
            }}
          >
            <Building2 size={15} />
            {companyVal !== '—' ? companyVal : (parentCompany?.name || 'View Company')}
            <ExternalLink size={13} style={{ opacity: 0.7 }} />
          </Link>
        );
      }
      return <span style={{ fontWeight: 600, color: C.text }}>{companyVal}</span>;
    }

    /* Contact Lookup Field */
    if (fNameLower.includes('contact')) {
      const contactIdVal = isUuid(val) ? val : (record.contact_id || record.contact || record.secondary_parent_id);
      const contactVal = formatLookupValue(f.name, val, record, currentUser, organization, company, lookupMap);
      const targetId = isUuid(contactIdVal) ? contactIdVal : (primaryContact ? primaryContact.id : null);

      if (targetId) {
        return (
          <Link
            to={`/workspace/object/contact/${targetId}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontWeight: 700,
              color: C.indigo,
              textDecoration: 'none',
              padding: '2px 8px',
              borderRadius: 6,
              background: 'rgba(99,102,241,0.08)',
              transition: 'all .15s ease',
            }}
          >
            <User size={15} />
            {contactVal !== '—' ? contactVal : (primaryContact?.name || 'View Contact')}
            <ExternalLink size={13} style={{ opacity: 0.7 }} />
          </Link>
        );
      }
      return <span style={{ fontWeight: 600, color: C.text }}>{contactVal}</span>;
    }

    if (f.type === 'datetime' || f.type === 'date' || fNameLower.includes('date') || fNameLower.includes('created_at') || fNameLower.includes('updated_at')) {
      return <span style={{ fontWeight: 600, color: C.text }}>{formatDateValue(val)}</span>;
    }

    if (f.type === 'email' && val) {
      return (
        <a href={`mailto:${val}`} style={{ fontWeight: 600, color: C.indigo, textDecoration: 'none' }}>
          {String(val)}
        </a>
      );
    }

    if (f.type === 'address' || fNameLower.includes('address') || fNameLower.includes('street')) {
      if (!val || val === '—') return <span style={{ fontWeight: 600, color: C.dim }}>—</span>;
      const addrStr = String(val).trim();
      const encodedMaps = encodeURIComponent(addrStr);
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontWeight: 600, color: C.text, whiteSpace: 'pre-line', lineHeight: 1.45 }}>{addrStr}</span>
          <a
            href={`https://maps.google.com/?q=${encodedMaps}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.76rem', color: C.indigo, fontWeight: 700, textDecoration: 'none', marginTop: 2 }}
          >
            <MapPin size={12} /> View on Google Maps <ExternalLink size={10} />
          </a>
        </div>
      );
    }

    const rawDisplayVal = val !== undefined && val !== null && val !== '' ? String(val) : '—';
    const displayVal = isUuid(rawDisplayVal)
      ? formatLookupValue(f.name, rawDisplayVal, record, currentUser, organization, company, lookupMap)
      : rawDisplayVal;
    return <span style={{ fontWeight: 600, color: displayVal === '—' ? C.dim : C.text }}>{displayVal}</span>;
  };

  const tabs = ['Details', 'Related'];
  const currentObjKey = String(objectTypeId).toLowerCase();

  /* All fields with Created Date/By, Modified Date/By pushed to VERY END */
  const mergedFields = getAllMergedFields(meta.fields, record, objectTypeId);

  const ghostBtn = {
    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px',
    borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer',
    color: '#e8ecf7', background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.14)', backdropFilter: 'blur(8px)', textDecoration: 'none',
  };

  /* Open Step 1 Add Products Modal */
  const handleOpenAddProducts = () => {
    const existingIds = lineItems.map((item) => item.productId);
    setSelectedProdIds(existingIds);
    setProductSearch('');
    setSelectedFamilyFilter('All');
    setIsAddModalOpen(true);
  };

  /* Proceed to Step 2 Edit Selected Products Modal */
  const handleProceedToEditProducts = () => {
    const existingMap = {};
    lineItems.forEach((item) => { existingMap[item.productId] = item; });

    const newEditList = selectedProdIds.map((id) => {
      if (existingMap[id]) return { ...existingMap[id] };
      const prod = DEFAULT_PRODUCTS.find((p) => p.id === id);
      return {
        productId: prod.id,
        name: prod.name,
        code: prod.code,
        quantity: 1,
        salesPrice: prod.listPrice,
        discount: 0,
        total: prod.listPrice,
        date: '',
        description: prod.description || '',
      };
    });

    setEditLineItems(newEditList);
    setIsAddModalOpen(false);
    setIsEditModalOpen(true);
  };

  /* Save Line Items from Step 2 Modal */
  const handleSaveLineItems = () => {
    syncLineItemsAndAmount(editLineItems);
    setIsEditModalOpen(false);
  };

  /* Delete line item from Related tab table */
  const handleDeleteLineItem = (productId) => {
    const updated = lineItems.filter((item) => item.productId !== productId);
    syncLineItemsAndAmount(updated);
  };

  /* Calculate Grand Total for Deal Line Items */
  const grandTotalAmount = lineItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0);

  /* Filter products for Step 1 modal search & family tabs */
  const filteredCatalogProducts = DEFAULT_PRODUCTS.filter((prod) => {
    if (selectedFamilyFilter !== 'All' && String(prod.family).toLowerCase() !== selectedFamilyFilter.toLowerCase()) {
      return false;
    }
    if (!productSearch) return true;
    const q = productSearch.toLowerCase();
    return (
      prod.name.toLowerCase().includes(q) ||
      prod.code.toLowerCase().includes(q) ||
      (prod.family || '').toLowerCase().includes(q) ||
      (prod.description || '').toLowerCase().includes(q)
    );
  });

  return (
    <>
      <div style={pageWrap}>
        <div style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>

          {/* ── Breadcrumb ── */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, color: C.dim }}>
            <span style={{ cursor: 'pointer' }} onClick={() => navigate('/workspace')}>Workspace</span>
            <ChevronRight size={15} style={{ opacity: 0.5 }} />
            <span style={{ cursor: 'pointer' }} onClick={handleClose}>{meta.pluralDisplayName}</span>
            <ChevronRight size={15} style={{ opacity: 0.5 }} />
            <span style={{ fontWeight: 700, color: C.text }}>{String(recordTitle)}</span>
          </nav>

          {/* ── Header Banner ── 
        <section style={{
          position: 'relative', overflow: 'hidden', borderRadius: 24,
          background: C.bannerGrad, padding: 28,
          boxShadow: '0 30px 60px -30px rgba(11,18,32,.65)',
        }}>
          <div style={{ position: 'absolute', right: -70, top: -110, width: 260, height: 260, borderRadius: '50%', background: 'rgba(34,211,238,.20)', filter: 'blur(70px)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', left: 90, bottom: -120, width: 240, height: 240, borderRadius: '50%', background: 'rgba(99,102,241,.28)', filter: 'blur(70px)', pointerEvents: 'none' }} />

          <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              {avatarFor(String(recordTitle), 66, true)}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
                  padding: '5px 12px', borderRadius: 999, fontSize: 10.5, fontWeight: 800,
                  letterSpacing: '0.14em', color: C.success,
                  background: 'rgba(52,211,153,.12)', border: '1px solid rgba(52,211,153,.32)',
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.success }} />
                  {String(meta.displayName).toUpperCase()} RECORD
                </span>
                <h2 style={{ margin: 0, fontSize: 30, fontWeight: 800, color: '#f4f7ff', letterSpacing: '-0.02em' }}>
                  {String(recordTitle)}
                </h2>
                {subtitleVal && <p style={{ margin: 0, fontSize: 14, color: '#9fb0c9' }}>{subtitleVal}</p>}
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
              {emailVal && (
                <a href={`mailto:${emailVal}`} style={ghostBtn}>
                  <Mail size={16} /> Email
                </a>
              )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {emailVal && (
              <a
                href={`mailto:${emailVal}`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '8px 16px', borderRadius: 11,
                  fontSize: 13, fontWeight: 700, color: '#475569',
                  background: '#ffffff', border: '1.5px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  textDecoration: 'none', transition: 'all 0.15s ease',
                }}
              >
                <Mail size={15} color="#6366f1" /> Email
              </a>
            )}
          </div>
        </div>

        {/* ── Header banner (Exact Setup.js Hero Banner Theme, Height & Animations) ── */}
          <section
            style={{
              borderRadius: 22,
              position: 'relative',
              overflow: 'hidden',
              background: 'linear-gradient(135deg, #0d1117 0%, #0a1628 30%, #0d2137 55%, #0a2020 80%, #0d1117 100%)',
              padding: '38px 40px 34px',
              minHeight: 145,
              boxShadow: '0 20px 60px -16px rgba(0,176,155,0.18), 0 8px 32px -8px rgba(13,17,23,0.4)',
              animation: 'dp-slideUp 0.6s cubic-bezier(0.22,1,0.36,1) both',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {/* Global Keyframe Animations */}
            <style>{`
            @keyframes dp-slideUp {
              from { opacity: 0; transform: translateY(24px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes dp-float {
              0%, 100% { transform: translateY(0px) rotate(0deg); }
              33% { transform: translateY(-8px) rotate(1deg); }
              66% { transform: translateY(-4px) rotate(-1deg); }
            }
            @keyframes dp-pulseGlow {
              0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(0,214,153,0.4); }
              50% { opacity: 0.7; box-shadow: 0 0 0 6px rgba(0,214,153,0); }
            }
            @keyframes dp-fadeSlideIn {
              from { opacity: 0; transform: translateX(-12px); }
              to { opacity: 1; transform: translateX(0); }
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

            {/* Glow orbs */}
            <div style={{ position: 'absolute', top: -80, right: 60, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,176,155,0.2), transparent 65%)', animation: 'dp-float 7s ease-in-out infinite', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: -60, right: 200, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,172,254,0.15), transparent 65%)', animation: 'dp-float 9s ease-in-out infinite reverse', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: 20, right: 340, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,87,108,0.1), transparent 65%)', animation: 'dp-float 6s ease-in-out infinite 1s', pointerEvents: 'none' }} />

            {/* Grid texture */}
            <div style={{ position: 'absolute', inset: 0, opacity: 0.03, backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '48px 48px', pointerEvents: 'none' }} />

            <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24, width: '100%' }}>
              {/* Left: Avatar + Badge + Title + Rich Metadata */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, minWidth: 0, flex: 1 }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  {avatarFor(String(recordTitle), 72, true)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 20, background: 'rgba(0,176,155,0.14)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0,176,155,0.35)', alignSelf: 'flex-start', animation: 'dp-fadeSlideIn 0.5s 0.1s both' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00d699', animation: 'dp-pulseGlow 2s ease-in-out infinite' }} />
                    {objectIcon(objectTypeId)}
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#00d699', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      {String(meta.displayName).toUpperCase()} RECORD
                    </span>
                  </div>
                  <h2 style={{ margin: '2px 0 0', fontSize: '1.65rem', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.025em', lineHeight: 1.15, animation: 'dp-fadeSlideIn 0.5s 0.2s both', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {String(recordTitle)}
                  </h2>

                  {subtitleVal && (
                    <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', fontWeight: 500, animation: 'dp-fadeSlideIn 0.5s 0.3s both' }}>
                      {subtitleVal}
                    </p>
                  )}
                </div>
              </div>

              {/* Right: Stat Tiles */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', animation: 'dp-fadeSlideIn 0.5s 0.4s both', justifyContent: 'flex-end' }}>
                {deriveHeaderTiles(objectTypeId, record, currentUser, organization, company, lookupMap).map((tile, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '14px 18px',
                      borderRadius: 15,
                      background: 'rgba(255,255,255,0.05)',
                      backdropFilter: 'blur(12px)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      textAlign: 'center',
                      minWidth: 84,
                    }}
                  >
                    <div style={{ fontSize: '1.05rem', fontWeight: 900, color: tile.color, lineHeight: 1, marginBottom: 4 }}>
                      {tile.value}
                    </div>
                    <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {tile.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Stage Progress Pipeline (Deals Only) ── */}
          {String(objectTypeId || '').toLowerCase().includes('deal') && (
            <StageProgress
              record={record}
              meta={meta}
              objectTypeId={objectTypeId}
              recordId={recordId}
              onRecordUpdated={(updatedRec) => setRecord(updatedRec)}
              onEdit={handleEditClick}
              emailVal={emailVal}
            />
          )}

          {/* ── Tab strip ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', gap: 8 }}> 
              {tabs.map((tab) => {
                const on = activeTab === tab || (activeTab === 'Overview' && tab === 'Details');
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      marginBottom: -1, padding: '10px 22px', fontSize: 14, cursor: 'pointer',
                      border: 'none', borderBottom: `2px solid ${on ? C.indigo : 'transparent'}`,
                      borderRadius: '12px 12px 0 0',
                      background: on ? 'rgba(99,102,241,.08)' : 'transparent',
                      color: on ? C.text : C.dim, fontWeight: on ? 700 : 500,
                      transition: 'all .2s ease',
                    }}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {String(objectTypeId || '').toLowerCase().includes('lead') && (
                isAlreadyConverted ? (
                  <span
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '8px 16px', borderRadius: 12,
                      fontSize: 13, fontWeight: 700, color: '#059669',
                      background: '#ecfdf5', border: '1.5px solid #a7f3d0',
                    }}
                  >
                    <CheckCircle2 size={15} /> Lead Converted
                  </span>
                ) : (
                  <button
                    onClick={handleConvertLead}
                    disabled={converting}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 7,
                      padding: '10px 18px', borderRadius: 12,
                      fontSize: 13, fontWeight: 700, color: '#fff',
                      background: converting ? '#94a3b8' : 'linear-gradient(135deg, #f97316, #ef4444)',
                      border: 'none', cursor: converting ? 'not-allowed' : 'pointer',
                      boxShadow: converting ? 'none' : '0 8px 20px -10px rgba(249,115,22,0.55)',
                    }}
                  >
                    {converting ? 'Converting…' : 'Convert'}
                  </button>
                )
              )}
              <button
                onClick={handleEditClick}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '10px 18px', borderRadius: 12,
                  fontSize: 13, fontWeight: 700, color: '#fff',
                  background: 'linear-gradient(135deg, #00b09b, #4facfe)',
                  border: 'none', cursor: 'pointer', boxShadow: '0 8px 20px -10px rgba(0,176,155,0.55)',
                }}
              >
                <Edit3 size={15} /> Edit
              </button>
              {canDeleteRecord && (
                <button
                  onClick={() => { setShowDeleteModal(true); setDeleteRecordError(null); }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    padding: '10px 18px', borderRadius: 12,
                    fontSize: 13, fontWeight: 700, color: '#ffffff',
                    background: 'linear-gradient(135deg, #f43f5e, #e11d48)',
                    border: 'none', cursor: 'pointer',
                    boxShadow: '0 8px 20px -10px rgba(244,63,94,0.55)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Trash2 size={15} /> Delete
                </button>
              )}
              <button
                onClick={handleClose}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '10px 18px', borderRadius: 12,
                  fontSize: 13, fontWeight: 700, color: '#475569',
                  background: '#ffffff', border: '1.5px solid #e2e8f0',
                  cursor: 'pointer', transition: 'all 0.15s ease',
                }}
              >
                <ArrowLeft size={15} /> Back
              </button>
            </div>
          </div>

          {/* ── DETAILS TAB (Plain View - Merged Record & System Information at END) ── */}
          {(activeTab === 'Details' || activeTab === 'Overview') && (
            <section
              style={{
                borderRadius: 22, border: `1px solid ${C.border}`, background: C.card,
                boxShadow: '0 18px 40px -30px rgba(20,26,50,.25)', overflow: 'hidden',
              }}
            >
              <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 24px', borderBottom: `1px solid ${C.border}`, background: 'linear-gradient(90deg,rgba(99,102,241,.06),rgba(34,211,238,.03))' }}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 10, background: 'rgba(99,102,241,.12)', color: C.indigo }}>
                  <FileText size={16} />
                </span>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, letterSpacing: '.1em', color: C.text }}>
                  RECORD DETAILS
                </h3>
                <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: C.dim }}>
                  {mergedFields.length} fields
                </span>
              </header>

              {/* Flat / Plain Key-Value Grid Layout (Created & Modified pushed to END) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: '20px 32px',
                  padding: '24px 28px',
                }}
              >
                {mergedFields.map((f) => {
                  const isSystemField = (f.name || '').toLowerCase().includes('created') || (f.name || '').toLowerCase().includes('updated') || (f.name || '').toLowerCase().includes('modified');
                  const renderedVal = renderFieldValue(f);
                  const strVal = typeof renderedVal === 'string' || typeof renderedVal === 'number' ? String(renderedVal) : '';
                  const isLongVal = strVal.length > 40 || strVal.includes('\n');
                  return (
                    <div
                      key={f.name}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        paddingBottom: '14px',
                        background: isSystemField ? 'rgba(248,250,252,0.6)' : 'transparent',
                        padding: isSystemField ? '10px 12px 14px 12px' : '0 0 14px 0',
                        borderRadius: isSystemField ? 10 : 0,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        {fieldIcon(f.name, f.type)}
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.08em', color: isSystemField ? '#475569' : '#64748b' }}>
                          {String(f.label || f.name).toUpperCase()}
                        </span>
                      </div>
                      <div style={{ fontSize: isLongVal ? '0.8rem' : '0.94rem', fontWeight: isLongVal ? 500 : 600, color: '#0f172a', lineHeight: isLongVal ? 1.4 : 1.5, wordBreak: 'break-word' }}>
                        {renderedVal}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── RELATED TAB CONTENT ── */}
          {activeTab === 'Related' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* 1. Products / Line Items Section (For Deals / Opportunities) */}
              {currentObjKey.includes('deal') && (
                <section style={{
                  borderRadius: 22, border: `1px solid ${C.border}`, background: C.card,
                  boxShadow: '0 18px 40px -30px rgba(20,26,50,.35)', overflow: 'hidden',
                }}>
                  <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: `1px solid ${C.border}`, background: 'linear-gradient(90deg,rgba(99,102,241,.06),rgba(34,211,238,.03))' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,.12)', color: C.indigo }}>
                        <Package size={20} />
                      </span>
                      <div>
                        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                          Products / Line Items <span style={{ fontSize: 13, fontWeight: 600, color: C.dim }}>({lineItems.length} items)</span>
                        </h3>
                      </div>
                    </div>

                    <button
                      onClick={handleOpenAddProducts}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px',
                        borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: 700,
                        color: '#fff', background: '#2563eb', boxShadow: '0 8px 18px -8px rgba(37,99,235,.6)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      + Add Products
                    </button>
                  </header>

                  {lineItems.length > 0 ? (
                    <>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13.5 }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: `1px solid ${C.border}`, color: C.dim, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                              <th style={{ padding: '14px 20px' }}>Product</th>
                              <th style={{ padding: '14px 16px' }}>Code</th>
                              <th style={{ padding: '14px 16px' }}>Qty</th>
                              <th style={{ padding: '14px 16px' }}>Unit Price</th>
                              <th style={{ padding: '14px 16px' }}>Discount</th>
                              <th style={{ padding: '14px 16px' }}>Total</th>
                              <th style={{ padding: '14px 20px', textAlign: 'right' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lineItems.map((item) => (
                              <tr key={item.productId} style={{ borderBottom: `1px solid ${C.border}` }}>
                                <td style={{ padding: '14px 20px', fontWeight: 800, color: C.text }}>
                                  {item.name}
                                </td>
                                <td style={{ padding: '14px 16px', color: '#64748b', fontWeight: 600 }}>
                                  {item.code || '—'}
                                </td>
                                <td style={{ padding: '14px 16px', fontWeight: 700, color: C.text }}>
                                  {item.quantity}
                                </td>
                                <td style={{ padding: '14px 16px', fontWeight: 600, color: C.text }}>
                                  ${Number(item.salesPrice).toLocaleString()}
                                </td>
                                <td style={{ padding: '14px 16px', color: C.dim }}>
                                  {item.discount ? `$${item.discount}` : '-'}
                                </td>
                                <td style={{ padding: '14px 16px', fontWeight: 800, color: C.text }}>
                                  ${Number(item.total).toLocaleString()}
                                </td>
                                <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                                  <button
                                    onClick={() => handleDeleteLineItem(item.productId)}
                                    title="Delete Line Item"
                                    style={{
                                      border: 'none', background: '#fef2f2', color: '#ef4444',
                                      borderRadius: '50%', width: 32, height: 32, display: 'inline-flex',
                                      alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                      transition: 'all .15s ease',
                                    }}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Grand Total Footer */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', gap: 14, padding: '20px 24px', background: '#fafafc', borderTop: `1px solid ${C.border}` }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                          Grand Total
                        </span>
                        <span style={{ fontSize: 26, fontWeight: 900, color: C.text, letterSpacing: '-0.02em' }}>
                          ${grandTotalAmount.toLocaleString()}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div style={{ padding: '40px 24px', textAlign: 'center', color: C.dim, fontSize: 14 }}>
                      No products added to this deal yet. Click <strong>"+ Add Products"</strong> to add line items.
                    </div>
                  )}
                </section>
              )}

              {/* 2. Related Sections for COMPANY / ACCOUNT */}
              {(currentObjKey.includes('company') || currentObjKey.includes('account')) && (
                <>
                  {/* Related Deals */}
                  <section style={{
                    borderRadius: 22, border: `1px solid ${C.border}`, background: C.card,
                    boxShadow: '0 18px 40px -30px rgba(20,26,50,.35)', overflow: 'hidden',
                  }}>
                    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: `1px solid ${C.border}`, background: 'linear-gradient(90deg,rgba(99,102,241,.06),rgba(34,211,238,.03))' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 10, background: 'rgba(99,102,241,.12)', color: C.indigo }}>
                          <Briefcase size={18} />
                        </span>
                        <div>
                          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, letterSpacing: '.05em', color: C.text }}>
                            DEALS
                          </h3>
                          <span style={{ fontSize: 12, color: C.dim }}>Deals linked to {recordTitle}</span>
                        </div>
                        <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 800, background: 'rgba(99,102,241,.12)', color: C.indigo }}>
                          {relatedDeals.length}
                        </span>
                      </div>

                      <button
                        onClick={() => navigate(`/workspace/object/deal/new?company_id=${recordId}`)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                          borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                          color: '#fff', background: C.primaryGrad, boxShadow: '0 8px 18px -8px rgba(99,102,241,.6)',
                        }}
                      >
                        <Plus size={15} /> New Deal
                      </button>
                    </header>

                    {relatedDeals.length > 0 ? (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13.5 }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: `1px solid ${C.border}`, color: C.dim, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                              <th style={{ padding: '12px 20px' }}>Deal Name</th>
                              <th style={{ padding: '12px 16px' }}>Stage</th>
                              <th style={{ padding: '12px 16px' }}>Amount</th>
                              <th style={{ padding: '12px 16px' }}>Primary Contact</th>
                              <th style={{ padding: '12px 20px', textAlign: 'right' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {relatedDeals.map((deal) => (
                              <tr key={deal.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                                <td style={{ padding: '14px 20px', fontWeight: 700 }}>
                                  <Link to={`/workspace/object/deal/${deal.id}`} style={{ color: C.indigo, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    <Briefcase size={14} />
                                    {deal.name || deal.title || 'Untitled Deal'}
                                  </Link>
                                </td>
                                <td style={{ padding: '14px 16px' }}>{statusBadge(deal.stage || deal.status)}</td>
                                <td style={{ padding: '14px 16px', fontWeight: 700, color: C.text }}>
                                  {deal.amount ? `$${Number(deal.amount).toLocaleString()}` : '—'}
                                </td>
                                <td style={{ padding: '14px 16px', color: C.dim }}>
                                  {deal.contact_id && lookupMap.contacts[deal.contact_id] ? (
                                    <Link to={`/workspace/object/contact/${deal.contact_id}`} style={{ color: C.text, textDecoration: 'none', fontWeight: 600 }}>
                                      {lookupMap.contacts[deal.contact_id].name}
                                    </Link>
                                  ) : '—'}
                                </td>
                                <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                                  <Link to={`/workspace/object/deal/${deal.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8, background: '#f1f5f9', color: C.text, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                                    View <ChevronRight size={14} />
                                  </Link>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div style={{ padding: '36px 24px', textAlign: 'center', color: C.dim, fontSize: 13.5 }}>
                        No deals created for this company yet. Click <strong>"+ New Deal"</strong> above to add one.
                      </div>
                    )}
                  </section>

                  {/* Related Contacts */}
                  <section style={{
                    borderRadius: 22, border: `1px solid ${C.border}`, background: C.card,
                    boxShadow: '0 18px 40px -30px rgba(20,26,50,.35)', overflow: 'hidden',
                  }}>
                    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: `1px solid ${C.border}`, background: 'linear-gradient(90deg,rgba(99,102,241,.06),rgba(34,211,238,.03))' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 10, background: 'rgba(34,211,238,.14)', color: C.cyan }}>
                          <Users size={18} />
                        </span>
                        <div>
                          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, letterSpacing: '.05em', color: C.text }}>
                            CONTACTS
                          </h3>
                          <span style={{ fontSize: 12, color: C.dim }}>People associated with {recordTitle}</span>
                        </div>
                        <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 800, background: 'rgba(34,211,238,.14)', color: '#0891b2' }}>
                          {relatedContacts.length}
                        </span>
                      </div>

                      <button
                        onClick={() => navigate(`/workspace/object/contact/new?company_id=${recordId}`)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                          borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                          color: '#fff', background: C.primaryGrad, boxShadow: '0 8px 18px -8px rgba(34,211,238,.6)',
                        }}
                      >
                        <Plus size={15} /> New Contact
                      </button>
                    </header>

                    {relatedContacts.length > 0 ? (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13.5 }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: `1px solid ${C.border}`, color: C.dim, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                              <th style={{ padding: '12px 20px' }}>Contact Name</th>
                              <th style={{ padding: '12px 16px' }}>Email</th>
                              <th style={{ padding: '12px 16px' }}>Phone</th>
                              <th style={{ padding: '12px 16px' }}>Title</th>
                              <th style={{ padding: '12px 20px', textAlign: 'right' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {relatedContacts.map((ct) => (
                              <tr key={ct.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                                <td style={{ padding: '14px 20px', fontWeight: 700 }}>
                                  <Link to={`/workspace/object/contact/${ct.id}`} style={{ color: C.indigo, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                    {smallAvatar(ct.name || ct.first_name, 24)}
                                    {ct.name || `${ct.first_name || ''} ${ct.last_name || ''}`.trim() || 'Untitled Contact'}
                                  </Link>
                                </td>
                                <td style={{ padding: '14px 16px', color: C.dim }}>
                                  {ct.email ? <a href={`mailto:${ct.email}`} style={{ color: C.indigo, textDecoration: 'none' }}>{ct.email}</a> : '—'}
                                </td>
                                <td style={{ padding: '14px 16px', color: C.text }}>{ct.phone || '—'}</td>
                                <td style={{ padding: '14px 16px', color: C.dim }}>{ct.title || '—'}</td>
                                <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                                  <Link to={`/workspace/object/contact/${ct.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8, background: '#f1f5f9', color: C.text, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                                    View <ChevronRight size={14} />
                                  </Link>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div style={{ padding: '36px 24px', textAlign: 'center', color: C.dim, fontSize: 13.5 }}>
                        No contacts associated with this company yet. Click <strong>"+ New Contact"</strong> above to add one.
                      </div>
                    )}
                  </section>
                </>
              )}

              {/* 3. Related Sections for CONTACT */}
              {currentObjKey.includes('contact') && (
                <>
                  {/* Parent Company Card */}
                  {parentCompany ? (
                    <section style={{
                      borderRadius: 22, border: `1px solid ${C.border}`, background: C.card,
                      boxShadow: '0 18px 40px -30px rgba(20,26,50,.35)', padding: 22,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: 14, background: 'rgba(99,102,241,.12)', color: C.indigo }}>
                          <Building2 size={22} />
                        </span>
                        <div>
                          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.12em', color: C.dim }}>LINKED COMPANY</span>
                          <h4 style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 800, color: C.text }}>
                            {parentCompany.name || parentCompany.company_name}
                          </h4>
                        </div>
                      </div>
                      <Link
                        to={`/workspace/object/company/${parentCompany.id}`}
                        style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 16px',
                          borderRadius: 12, fontSize: 13, fontWeight: 700, color: '#fff',
                          background: C.primaryGrad, textDecoration: 'none',
                        }}
                      >
                        View Company Record <ExternalLink size={14} />
                      </Link>
                    </section>
                  ) : null}

                  {/* Related Deals for Contact */}
                  <section style={{
                    borderRadius: 22, border: `1px solid ${C.border}`, background: C.card,
                    boxShadow: '0 18px 40px -30px rgba(20,26,50,.35)', overflow: 'hidden',
                  }}>
                    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: `1px solid ${C.border}`, background: 'linear-gradient(90deg,rgba(99,102,241,.06),rgba(34,211,238,.03))' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 10, background: 'rgba(99,102,241,.12)', color: C.indigo }}>
                          <Briefcase size={18} />
                        </span>
                        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, letterSpacing: '.05em', color: C.text }}>
                          DEALS
                        </h3>
                        <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 800, background: 'rgba(99,102,241,.12)', color: C.indigo }}>
                          {relatedDeals.length}
                        </span>
                      </div>

                      <button
                        onClick={() => navigate(`/workspace/object/deal/new?contact_id=${recordId}${record.company_id ? `&company_id=${record.company_id}` : ''}`)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                          borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                          color: '#fff', background: C.primaryGrad,
                        }}
                      >
                        <Plus size={15} /> New Deal
                      </button>
                    </header>

                    {relatedDeals.length > 0 ? (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13.5 }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: `1px solid ${C.border}`, color: C.dim, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                              <th style={{ padding: '12px 20px' }}>Deal Name</th>
                              <th style={{ padding: '12px 16px' }}>Stage</th>
                              <th style={{ padding: '12px 16px' }}>Amount</th>
                              <th style={{ padding: '12px 20px', textAlign: 'right' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {relatedDeals.map((deal) => (
                              <tr key={deal.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                                <td style={{ padding: '14px 20px', fontWeight: 700 }}>
                                  <Link to={`/workspace/object/deal/${deal.id}`} style={{ color: C.indigo, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    <Briefcase size={14} />
                                    {deal.name || deal.title || 'Untitled Deal'}
                                  </Link>
                                </td>
                                <td style={{ padding: '14px 16px' }}>{statusBadge(deal.stage || deal.status)}</td>
                                <td style={{ padding: '14px 16px', fontWeight: 700, color: C.text }}>
                                  {deal.amount ? `$${Number(deal.amount).toLocaleString()}` : '—'}
                                </td>
                                <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                                  <Link to={`/workspace/object/deal/${deal.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8, background: '#f1f5f9', color: C.text, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                                    View <ChevronRight size={14} />
                                  </Link>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div style={{ padding: '36px 24px', textAlign: 'center', color: C.dim, fontSize: 13.5 }}>
                        No deals associated with this contact yet.
                      </div>
                    )}
                  </section>
                </>
              )}

              {/* 4. Linked Cards for DEAL (OPPORTUNITY) */}
              {currentObjKey.includes('deal') && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
                  {/* Linked Company Card */}
                  <section style={{
                    borderRadius: 22, border: `1px solid ${C.border}`, background: C.card,
                    boxShadow: '0 18px 40px -30px rgba(20,26,50,.35)', padding: 24,
                    display: 'flex', flexDirection: 'column', gap: 14,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 12, background: 'rgba(99,102,241,.12)', color: C.indigo }}>
                        <Building2 size={20} />
                      </span>
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.12em', color: C.dim }}>LINKED COMPANY</span>
                        <h4 style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 800, color: C.text }}>
                          {parentCompany ? parentCompany.name : (record.company_name || 'No Company Linked')}
                        </h4>
                      </div>
                    </div>
                    {parentCompany ? (
                      <Link
                        to={`/workspace/object/company/${parentCompany.id}`}
                        style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 16px',
                          borderRadius: 12, fontSize: 13, fontWeight: 700, color: '#fff',
                          background: C.primaryGrad, textDecoration: 'none', marginTop: 6, width: 'fit-content',
                        }}
                      >
                        Open Company Page <ExternalLink size={14} />
                      </Link>
                    ) : null}
                  </section>

                  {/* Linked Primary Contact Card */}
                  <section style={{
                    borderRadius: 22, border: `1px solid ${C.border}`, background: C.card,
                    boxShadow: '0 18px 40px -30px rgba(20,26,50,.35)', padding: 24,
                    display: 'flex', flexDirection: 'column', gap: 14,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 12, background: 'rgba(34,211,238,.14)', color: C.cyan }}>
                        <User size={20} />
                      </span>
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.12em', color: C.dim }}>PRIMARY CONTACT</span>
                        <h4 style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 800, color: C.text }}>
                          {primaryContact ? primaryContact.name : (record.contact_name || 'No Contact Linked')}
                        </h4>
                      </div>
                    </div>
                    {primaryContact ? (
                      <Link
                        to={`/workspace/object/contact/${primaryContact.id}`}
                        style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 16px',
                          borderRadius: 12, fontSize: 13, fontWeight: 700, color: '#fff',
                          background: C.primaryGrad, textDecoration: 'none', marginTop: 6, width: 'fit-content',
                        }}
                      >
                        Open Contact Page <ExternalLink size={14} />
                      </Link>
                    ) : null}
                  </section>
                </div>
              )}

              {/* Fallback for standard/custom objects */}
              {!currentObjKey.includes('company') && !currentObjKey.includes('account') && !currentObjKey.includes('contact') && !currentObjKey.includes('deal') && (
                <section style={{
                  borderRadius: 22, border: `1px dashed ${C.border}`, background: 'rgba(255,255,255,.6)',
                  padding: '64px 26px', textAlign: 'center', color: C.dim, fontSize: 14,
                }}>
                  No related records configured for {meta.displayName}.
                </section>
              )}

            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
         STEP 1 MODAL: ADD PRODUCTS (Enhanced Premium UI)
         ═══════════════════════════════════════════════════════════════ */}
      {isAddModalOpen && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          animation: 'mod-fade-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          <div style={{
            background: '#ffffff', borderRadius: 24, width: '100%', maxWidth: 920,
            boxShadow: '0 30px 60px -15px rgba(15,23,42,0.3)', border: '1px solid rgba(226,232,240,0.9)',
            overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh',
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '24px 32px 18px', borderBottom: '1px solid #f1f5f9',
              background: 'linear-gradient(180deg,#ffffff 0%,#f8fafc 100%)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 14,
                  background: 'linear-gradient(135deg,#3b82f6,#2563eb)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#ffffff', boxShadow: '0 8px 16px -4px rgba(37,99,235,0.4)',
                }}>
                  <Package size={22} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
                      Add Products
                    </h3>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '3px 10px', borderRadius: 999, fontSize: 11.5,
                      fontWeight: 700, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe',
                    }}>
                      Price Book: Standard
                    </span>
                  </div>
                  <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b', fontWeight: 500 }}>
                    Select products from your standard catalog to add line items to this deal.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsAddModalOpen(false)}
                style={{
                  border: 'none', background: '#f1f5f9', cursor: 'pointer', color: '#64748b',
                  width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', transition: 'all 0.15s ease',
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#0f172a'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Search & Family Filter Bar */}
            <div style={{ padding: '20px 32px 14px', background: '#fafafc', borderBottom: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: 16, top: 13, color: '#94a3b8' }} />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search products by name, product code, description, or family..."
                  style={{
                    width: '100%', padding: '12px 16px 12px 46px', borderRadius: 14,
                    border: '1.5px solid #cbd5e1', fontSize: 14, fontWeight: 500, outline: 'none',
                    background: '#ffffff', boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
                    transition: 'all 0.2s ease',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#cbd5e1'; e.target.style.boxShadow = '0 2px 8px rgba(15,23,42,0.04)'; }}
                />
              </div>

              {/* Family Filter Pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em', marginRight: 4 }}>
                  Family:
                </span>
                {['All', 'Software', 'Services', 'Add-ons'].map((family) => {
                  const on = selectedFamilyFilter === family;
                  return (
                    <button
                      key={family}
                      onClick={() => setSelectedFamilyFilter(family)}
                      style={{
                        padding: '6px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: on ? 800 : 600,
                        border: `1px solid ${on ? '#2563eb' : '#e2e8f0'}`,
                        background: on ? '#eff6ff' : '#ffffff', color: on ? '#1d4ed8' : '#475569',
                        cursor: 'pointer', transition: 'all 0.15s ease',
                      }}
                    >
                      {family}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Counter & Table Container */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#2563eb', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={16} /> Selected ({selectedProdIds.length})
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>
                  Showing {filteredCatalogProducts.length} of {DEFAULT_PRODUCTS.length} products
                </span>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13.5 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    <th style={{ padding: '12px 10px', width: 44 }}>
                      <input
                        type="checkbox"
                        checked={filteredCatalogProducts.length > 0 && filteredCatalogProducts.every((p) => selectedProdIds.includes(p.id))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const allIds = Array.from(new Set([...selectedProdIds, ...filteredCatalogProducts.map((p) => p.id)]));
                            setSelectedProdIds(allIds);
                          } else {
                            const filteredIds = filteredCatalogProducts.map((p) => p.id);
                            setSelectedProdIds(selectedProdIds.filter((id) => !filteredIds.includes(id)));
                          }
                        }}
                        style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#2563eb' }}
                      />
                    </th>
                    <th style={{ padding: '12px 14px' }}>Product Name</th>
                    <th style={{ padding: '12px 14px' }}>Product Code</th>
                    <th style={{ padding: '12px 14px' }}>List Price</th>
                    <th style={{ padding: '12px 14px' }}>Description</th>
                    <th style={{ padding: '12px 14px' }}>Family</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCatalogProducts.map((prod) => {
                    const isChecked = selectedProdIds.includes(prod.id);
                    return (
                      <tr
                        key={prod.id}
                        onClick={() => {
                          if (isChecked) {
                            setSelectedProdIds(selectedProdIds.filter((id) => id !== prod.id));
                          } else {
                            setSelectedProdIds([...selectedProdIds, prod.id]);
                          }
                        }}
                        style={{
                          borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                          background: isChecked ? 'rgba(37,99,235,0.05)' : 'transparent',
                          transition: 'background 0.15s ease',
                        }}
                        onMouseOver={(e) => { if (!isChecked) e.currentTarget.style.background = '#f8fafc'; }}
                        onMouseOut={(e) => { if (!isChecked) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <td style={{ padding: '14px 10px' }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedProdIds([...selectedProdIds, prod.id]);
                              } else {
                                setSelectedProdIds(selectedProdIds.filter((id) => id !== prod.id));
                              }
                            }}
                            style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#2563eb' }}
                          />
                        </td>
                        <td style={{ padding: '14px 14px', fontWeight: 800, color: '#1d4ed8', fontSize: '0.95rem' }}>
                          {prod.name}
                        </td>
                        <td style={{ padding: '14px 14px', color: '#64748b', fontWeight: 600, fontFamily: 'monospace', fontSize: 13 }}>
                          {prod.code}
                        </td>
                        <td style={{ padding: '14px 14px', fontWeight: 800, color: '#0f172a' }}>
                          ${prod.listPrice.toLocaleString()}
                        </td>
                        <td style={{ padding: '14px 14px', color: '#475569' }}>
                          {prod.description}
                        </td>
                        <td style={{ padding: '14px 14px' }}>
                          {familyBadge(prod.family)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '20px 32px', borderTop: '1px solid #e2e8f0', background: '#fafafc',
            }}>
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
                {selectedProdIds.length} product(s) selected
              </span>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  style={{
                    padding: '10px 24px', borderRadius: 12, border: '1px solid #cbd5e1',
                    background: '#ffffff', fontSize: 14, fontWeight: 700, color: '#334155', cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  disabled={selectedProdIds.length === 0}
                  onClick={handleProceedToEditProducts}
                  style={{
                    padding: '10px 28px', borderRadius: 12, border: 'none',
                    background: selectedProdIds.length === 0 ? '#93c5fd' : 'linear-gradient(135deg,#2563eb,#3b82f6)',
                    fontSize: 14, fontWeight: 700, color: '#ffffff',
                    cursor: selectedProdIds.length === 0 ? 'not-allowed' : 'pointer',
                    boxShadow: selectedProdIds.length === 0 ? 'none' : '0 10px 22px -6px rgba(37,99,235,0.5)',
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ═══════════════════════════════════════════════════════════════
         STEP 2 MODAL: EDIT SELECTED PRODUCTS (Enhanced Premium UI)
         ═══════════════════════════════════════════════════════════════ */}
      {isEditModalOpen && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          animation: 'mod-fade-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          <div style={{
            background: '#ffffff', borderRadius: 24, width: '100%', maxWidth: 980,
            boxShadow: '0 30px 60px -15px rgba(15,23,42,0.3)', border: '1px solid rgba(226,232,240,0.9)',
            overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh',
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '24px 32px 18px', borderBottom: '1px solid #f1f5f9',
              background: 'linear-gradient(180deg,#ffffff 0%,#f8fafc 100%)',
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
                  Edit Selected Products
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b', fontWeight: 500 }}>
                  Adjust quantities, sales prices, line descriptions, and dates before saving.
                </p>
              </div>

              <button
                onClick={() => setIsEditModalOpen(false)}
                style={{
                  border: 'none', background: '#f1f5f9', cursor: 'pointer', color: '#64748b',
                  width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', transition: 'all 0.15s ease',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Editable Table */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 32px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13.5 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    <th style={{ padding: '12px 8px', width: 30 }}>#</th>
                    <th style={{ padding: '12px 12px' }}>*Product</th>
                    <th style={{ padding: '12px 12px', width: 130 }}>*Quantity</th>
                    <th style={{ padding: '12px 12px', width: 160 }}>*Sales Price</th>
                    <th style={{ padding: '12px 12px', width: 160 }}>Date</th>
                    <th style={{ padding: '12px 12px' }}>Line Description</th>
                    <th style={{ padding: '12px 8px', width: 44, textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {editLineItems.map((item, idx) => (
                    <tr key={item.productId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '14px 8px', color: '#64748b', fontWeight: 700 }}>{idx + 1}</td>
                      <td style={{ padding: '14px 12px', fontWeight: 800, color: '#1d4ed8' }}>{item.name}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => {
                            const q = Math.max(1, parseInt(e.target.value, 10) || 1);
                            const updated = editLineItems.map((it) =>
                              it.productId === item.productId
                                ? { ...it, quantity: q, total: q * Number(it.salesPrice) }
                                : it
                            );
                            setEditLineItems(updated);
                          }}
                          style={{
                            width: '100%', padding: '9px 12px', borderRadius: 10,
                            border: '1px solid #cbd5e1', fontSize: 14, outline: 'none', fontWeight: 700,
                          }}
                        />
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <input
                          type="number"
                          value={item.salesPrice}
                          onChange={(e) => {
                            const sp = parseFloat(e.target.value) || 0;
                            const updated = editLineItems.map((it) =>
                              it.productId === item.productId
                                ? { ...it, salesPrice: sp, total: Number(it.quantity) * sp }
                                : it
                            );
                            setEditLineItems(updated);
                          }}
                          style={{
                            width: '100%', padding: '9px 12px', borderRadius: 10,
                            border: '1px solid #cbd5e1', fontSize: 14, outline: 'none', fontWeight: 700,
                          }}
                        />
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <input
                          type="date"
                          value={item.date || ''}
                          onChange={(e) => {
                            const d = e.target.value;
                            const updated = editLineItems.map((it) =>
                              it.productId === item.productId ? { ...it, date: d } : it
                            );
                            setEditLineItems(updated);
                          }}
                          style={{
                            width: '100%', padding: '9px 12px', borderRadius: 10,
                            border: '1px solid #cbd5e1', fontSize: 13, outline: 'none',
                          }}
                        />
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <input
                          type="text"
                          value={item.description || ''}
                          onChange={(e) => {
                            const desc = e.target.value;
                            const updated = editLineItems.map((it) =>
                              it.productId === item.productId ? { ...it, description: desc } : it
                            );
                            setEditLineItems(updated);
                          }}
                          style={{
                            width: '100%', padding: '9px 12px', borderRadius: 10,
                            border: '1px solid #cbd5e1', fontSize: 13, outline: 'none',
                          }}
                        />
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        <button
                          onClick={() => {
                            setEditLineItems(editLineItems.filter((it) => it.productId !== item.productId));
                          }}
                          title="Remove item"
                          style={{
                            border: 'none', background: '#fef2f2', color: '#ef4444',
                            borderRadius: '50%', width: 34, height: 34, display: 'inline-flex',
                            alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '20px 32px', borderTop: '1px solid #e2e8f0', background: '#fafafc',
            }}>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setIsAddModalOpen(true);
                }}
                style={{
                  padding: '10px 24px', borderRadius: 12, border: '1px solid #cbd5e1',
                  background: '#ffffff', fontSize: 14, fontWeight: 700, color: '#334155', cursor: 'pointer',
                }}
              >
                Back
              </button>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  style={{
                    padding: '10px 24px', borderRadius: 12, border: '1px solid #cbd5e1',
                    background: '#ffffff', fontSize: 14, fontWeight: 700, color: '#334155', cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveLineItems}
                  style={{
                    padding: '10px 28px', borderRadius: 12, border: 'none',
                    background: 'linear-gradient(135deg,#2563eb,#3b82f6)', fontSize: 14,
                    fontWeight: 700, color: '#ffffff', cursor: 'pointer',
                    boxShadow: '0 10px 22px -6px rgba(37,99,235,0.5)',
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Custom Delete Record Modal Portal for Detail Page */}
      {showDeleteModal && ReactDOM.createPortal(
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
              onClick={() => { setShowDeleteModal(false); setDeleteRecordError(null); }}
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
              Are you sure you want to delete <strong style={{ color: '#0f172a' }}>"{recordTitle}"</strong>? This action cannot be undone.
            </p>

            {deleteRecordError && (
              <div style={{
                marginBottom: 16, padding: '10px 14px', borderRadius: 10,
                background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
                fontSize: '0.82rem', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8
              }}>
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <span>{deleteRecordError}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={() => { setShowDeleteModal(false); setDeleteRecordError(null); }}
                disabled={deletingRecord}
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
                onClick={confirmDeleteDetailPageRecord}
                disabled={deletingRecord}
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
                {deletingRecord ? (
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
    </>
  );
}

export default DetailPage;

