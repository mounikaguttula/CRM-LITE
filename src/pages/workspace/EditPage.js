import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useWorkspace } from '../../context/WorkspaceContext';
import { apiGet, apiPut } from '../../api/client';
import { ChevronRight, ArrowLeft, Save, X, AlertTriangle } from 'lucide-react';

/* ═══════════ DASHBOARD COLOR SYSTEM (UI only) ═══════════ */
const C = {
  bannerGrad: 'linear-gradient(115deg,#0b1220 0%,#0f1c2e 45%,#0a2a2a 100%)',
  primaryGrad: 'linear-gradient(135deg,#6366f1,#22d3ee)',
  indigo: '#6366f1',
  cyan: '#22d3ee',
  danger: '#fb7185',
  text: '#1c2033',
  dim: '#6b7290',
  border: '#e6e9f2',
  card: '#ffffff',
};

function getInitials(str) {
  if (!str) return 'R';
  const parts = String(str).trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : String(str).slice(0, 2).toUpperCase();
}

const isUuid = (val) => Boolean(val && typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

/* ─── Format Lookup & Owner IDs to Human Names ───────────────── */
function formatLookupValue(fieldName, val, record, currentUser, organization, company) {
  if (!val) return '';
  const nameLower = String(fieldName || '').toLowerCase();

  if (nameLower.includes('owner') || nameLower.includes('created_by') || nameLower.includes('updated_by') || nameLower.includes('user')) {
    if (isUuid(val)) {
      if (currentUser && (val === currentUser.id || val === currentUser.user_id)) {
        return currentUser.name || currentUser.email || '';
      }
      if (record?.owner_name) return record.owner_name;
      if (record?.owner?.name) return record.owner.name;
      return currentUser?.name || '';
    }
    return String(val);
  }

  if (nameLower.includes('company')) {
    if (isUuid(val)) {
      if (record?.company_name) return record.company_name;
      if (record?.company?.name) return record.company.name;
      return organization?.name || company?.name || 'Acme Corp';
    }
    return String(val);
  }

  if (isUuid(val)) {
    return record?.[`${fieldName}_name`] || record?.[fieldName?.replace('_id', '')]?.name || String(val);
  }

  return String(val);
}

function EditPage({ objectTypeId: propObjectTypeId, recordId: propRecordId, onSuccess }) {
  const params = useParams();
  const objectTypeId = propObjectTypeId || params.objectTypeId || 'leads';
  const recordId = propRecordId || params.recordId;

  const { objectTypes, currentUser, organization, company, permissions } = useWorkspace();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({});
  const [fields, setFields] = useState([]);
  const [lookupData, setLookupData] = useState({ users: [], companies: [] });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (!objectTypeId || !recordId) return;

    setLoading(true);
    setSubmitError(null);

    Promise.all([
      apiGet(`/objects/${objectTypeId}/${recordId}`).catch(() => apiGet(`/${objectTypeId}/${recordId}`)),
      apiGet(`/metadata/objects/${objectTypeId}/fields`).catch(() => apiGet(`/objects/${objectTypeId}/fields`)).catch(() => []),
      apiGet('/users').catch(() => apiGet('/user')).catch(() => ({ data: [] })),
      apiGet('/objects/companies').catch(() => apiGet('/objects/company')).catch(() => apiGet('/companies')).catch(() => apiGet('/company')).catch(() => ({ data: [] })),
      apiGet('/objects/contacts').catch(() => apiGet('/objects/contact')).catch(() => apiGet('/contacts')).catch(() => apiGet('/contact')).catch(() => ({ data: [] })),
    ])
      .then(([rec, fList, uRes, cRes, ctRes]) => {
        if (!isMounted) return;
        const recData = rec?.data || rec;

        const fieldsData = Array.isArray(fList) ? fList : (fList?.data || []);
        if (fieldsData.length > 0) setFields(fieldsData);

        const usersList = Array.isArray(uRes) ? uRes : (uRes?.data || uRes?.users || []);
        const compList = Array.isArray(cRes)
          ? cRes
          : (cRes?.data || cRes?.companies || cRes?.results || cRes?.items || []);
        const contactList = Array.isArray(ctRes)
          ? ctRes
          : (ctRes?.data || ctRes?.contacts || ctRes?.results || ctRes?.items || []);

        const finalUsers = usersList.length > 0 ? usersList : (currentUser ? [currentUser] : []);
        const finalCompanies = compList;

        const initialForm = recData ? { ...recData } : {};

        // Resolve company field value to match an existing option value in finalCompanies
        if (initialForm) {
          const compRaw = initialForm.company_id ?? initialForm.company ?? initialForm.account_id ?? initialForm.account ?? initialForm.organization_id ?? initialForm.organization ?? initialForm.company_name ?? initialForm.display_name;
          if (compRaw) {
            const normalizeValue = (val) => {
              const raw = typeof val === 'object' && val !== null
                ? (val.id || val.name || val.company_name || val.organization_name || val.account_name || val.display_name || val.code || '')
                : String(val || '');
              return raw.trim().toLowerCase();
            };
            const compStr = normalizeValue(compRaw);
            const match = finalCompanies.find((c) => {
              const values = [
                c.id,
                c._id,
                c.name,
                c.company_name,
                c.organization_name,
                c.account_name,
                c.display_name,
                c.code,
              ]
                .filter(Boolean)
                .map((v) => String(v).trim().toLowerCase());
              return values.includes(compStr);
            });
            if (match) {
              const companyValue = match.id || match._id || match.name || match.company_name || match.organization_name || match.account_name || match.display_name || match.code;
              initialForm.company_id = companyValue;
              initialForm.company = companyValue;
              if (initialForm.account_id !== undefined) initialForm.account_id = companyValue;
              if (initialForm.account !== undefined) initialForm.account = companyValue;
              if (initialForm.organization_id !== undefined) initialForm.organization_id = companyValue;
              if (initialForm.organization !== undefined) initialForm.organization = companyValue;
            }
          }
        }

        if (initialForm) setFormData(initialForm);

        setLookupData({
          users: finalUsers,
          companies: finalCompanies,
          contacts: contactList,
        });
      })
      .catch((err) => {
        console.error(`Error loading record ${recordId} for edit:`, err);
        if (isMounted) setSubmitError(err.message || 'Failed to fetch record from backend server.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [objectTypeId, recordId]);

  /* ── Metadata Normalization & FLS Read Enforcement ── */
  const rawMeta = objectTypes ? objectTypes[objectTypeId] : null;
  const effectiveFields = fields.length > 0 ? fields : (rawMeta?.fields || []);

  const fpPerms = permissions?.fieldPermissions || {};
  const visibleFields = effectiveFields
    .filter((f) => f.name !== 'id' && f.name !== 'created_at' && f.name !== 'created_by' && f.name !== 'updated_at' && f.name !== 'updated_by')
    .filter((f) => {
      const fp = fpPerms[f.id];
      const canRead = f.canRead !== undefined ? f.canRead : (fp ? fp.canRead !== false : true);
      return canRead !== false;
    });

  const meta = {
    displayName: rawMeta?.displayName || (objectTypeId ? objectTypeId.charAt(0).toUpperCase() + objectTypeId.slice(1).replace(/s$/, '') : 'Record'),
    pluralDisplayName: rawMeta?.pluralDisplayName || (objectTypeId ? objectTypeId.charAt(0).toUpperCase() + objectTypeId.slice(1) : 'Records'),
    fields: visibleFields,
  };

  const handleCancel = () => {
    navigate(`/workspace/object/${objectTypeId}/${recordId}`);
  };

  function handleChange(fieldName, value) {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
    if (errors[fieldName]) {
      setErrors((prev) => ({ ...prev, [fieldName]: null }));
    }
    if (submitError) setSubmitError(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError(null);

    const fieldsList = meta.fields || [];
    const valErrors = {};

    const payload = { ...formData };

    // Resolve company and owner lookup values before validation
    const normalizeString = (value) => String(value || '').trim().toLowerCase();
    if (lookupData.companies && lookupData.companies.length > 0) {
      const currentComp = payload.company || payload.company_id || payload.account || payload.account_id || payload.organization || payload.organization_id || payload.company_name;
      const compMatch = lookupData.companies.find((c) => {
        const normalizedValues = [c.id, c._id, c.name, c.company_name, c.organization_name, c.account_name, c.display_name, c.code]
          .filter(Boolean)
          .map(normalizeString);
        return normalizedValues.includes(normalizeString(currentComp));
      });
      if (compMatch) {
        payload.company = compMatch.id || compMatch._id || compMatch.name;
        payload.company_id = compMatch.id || compMatch._id || compMatch.name;
      }
    }

    if (lookupData.users && lookupData.users.length > 0) {
      const currentOwner = payload.owner_id || payload.owner;
      const ownerMatch = lookupData.users.find((u) => {
        const normalizedValues = [u.id, u._id, u.user_id, u.name, u.email]
          .filter(Boolean)
          .map(normalizeString);
        return normalizedValues.includes(normalizeString(currentOwner));
      });
      if (ownerMatch) {
        payload.owner_id = ownerMatch.id || ownerMatch._id || ownerMatch.user_id || ownerMatch.name;
        payload.owner = ownerMatch.id || ownerMatch._id || ownerMatch.user_id || ownerMatch.name;
      }
    }

    fieldsList.forEach((field) => {
      if (field.required && (!payload[field.name] || String(payload[field.name]).trim() === '')) {
        valErrors[field.name] = `${field.label} is required.`;
      }
    });

    if (Object.keys(valErrors).length > 0) {
      setErrors(valErrors);
      return;
    }

    setSaving(true);
    try {
      // Clean non-editable system properties
      delete payload.id;
      delete payload.created_at;
      delete payload.created_by;
      delete payload.updated_at;
      delete payload.updated_by;

      // Sanitize non-existent UUIDs to null or valid UUIDs for backend
      (meta.fields || []).forEach((field) => {
        const fieldName = field.name;
        const val = payload[fieldName];
        if (field.type === 'lookup' || fieldName?.toLowerCase().includes('company') || fieldName?.toLowerCase().includes('owner')) {
          if (!val || val === '—' || val === 'Select company…') {
            payload[fieldName] = null;
          } else if (fieldName?.toLowerCase().includes('company')) {
            if (!isUuid(val)) {
              const match = (lookupData.companies || []).find((c) => isUuid(c.id) && String(c.name).toLowerCase() === String(val).toLowerCase());
              payload[fieldName] = match ? match.id : null;
            }
          } else if (fieldName?.toLowerCase().includes('owner')) {
            if (!isUuid(val)) {
              payload[fieldName] = (currentUser && isUuid(currentUser.id)) ? currentUser.id : null;
            }
          }
        }
      });

      let res;
      try {
        res = await apiPut(`/objects/${objectTypeId}/${recordId}`, payload);
      } catch (err) {
        if (err.status === 400 || (err.message && (err.message.toLowerCase().includes('validation') || err.message.includes('|')))) {
          throw err;
        }
        res = await apiPut(`/${objectTypeId}/${recordId}`, payload);
      }
      const updatedRecord = res?.data || res;
      if (onSuccess) {
        onSuccess(updatedRecord);
      } else {
        navigate(`/workspace/object/${objectTypeId}/${recordId}`);
      }
    } catch (err) {
      console.error('Failed to update record:', err);
      setSubmitError(err.message || 'Failed to update record on backend server.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          minHeight: '320px',
          gap: '14px',
          background: 'transparent',
        }}
      >
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: '50%',
            border: '3px solid rgba(99,102,241,.18)',
            borderTopColor: C.indigo,
            animation: 'ep-spin .8s linear infinite',
          }}
        />
        <span style={{ color: '#94A3B8', fontWeight: 600, fontSize: '.85rem' }}>Loading record for editing…</span>
        <style>{'@keyframes ep-spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    );
  }

  const recordTitle = formData.name || formData.title || `Record #${recordId}`;

  /* ── Input Styling ── */
  const inputStyle = (hasError) => ({
    width: '100%',
    height: '46px',
    padding: '0 15px',
    fontSize: '0.9rem',
    fontWeight: 500,
    color: C.text,
    backgroundColor: hasError ? '#fff7f8' : '#fbfcff',
    border: `1.5px solid ${hasError ? C.danger : C.border}`,
    borderRadius: '12px',
    outline: 'none',
    transition: 'all .18s cubic-bezier(.4,0,.2,1)',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  });

  const textareaStyle = (hasError) => ({
    ...inputStyle(hasError),
    height: 'auto',
    minHeight: '110px',
    padding: '13px 15px',
    resize: 'vertical',
    lineHeight: 1.6,
  });

  const selectStyle = (hasError) => ({
    ...inputStyle(hasError),
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7290' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 14px center',
    paddingRight: '40px',
    cursor: 'pointer',
  });

  const focusOn = (e) => {
    e.target.style.borderColor = C.indigo;
    e.target.style.backgroundColor = '#ffffff';
    e.target.style.boxShadow = '0 0 0 4px rgba(99,102,241,.12)';
  };
  const focusOff = (hasError) => (e) => {
    e.target.style.borderColor = hasError ? C.danger : C.border;
    e.target.style.backgroundColor = hasError ? '#fff7f8' : '#fbfcff';
    e.target.style.boxShadow = 'none';
  };

  const labelStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '0.7rem',
    fontWeight: 700,
    color: C.dim,
    textTransform: 'uppercase',
    letterSpacing: '0.09em',
    marginBottom: '8px',
  };

  const sectionCardStyle = {
    backgroundColor: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: '22px',
    padding: '0 0 32px',
    boxShadow: '0 1px 2px rgba(16,20,40,.05), 0 24px 50px -30px rgba(16,20,40,.35)',
    marginBottom: '20px',
    overflow: 'hidden',
  };

  /* ── Field Renderers ── */
  const renderField = (f) => {
    const hasError = Boolean(errors[f.name]);
    const isNotes = f.name === 'notes' || f.name === 'description' || f.name === 'note';

    const fp = permissions?.fieldPermissions?.[f.id];
    const canUpdate = f.canUpdate !== undefined ? f.canUpdate : (fp ? fp.canUpdate !== false : true);
    const isReadOnly = canUpdate === false;

    const disabledInputStyle = isReadOnly
      ? { backgroundColor: '#f1f5f9', color: '#64748b', cursor: 'not-allowed', borderColor: '#cbd5e1', opacity: 0.85 }
      : {};

    const rawVal = formData[f.name];
    let valToDisplay = '';

    if (isUuid(rawVal) || f.type === 'lookup' || f.name?.toLowerCase().includes('owner') || f.name?.toLowerCase().includes('company')) {
      valToDisplay = formatLookupValue(f.name, rawVal, formData, currentUser, organization, company);
    } else if (rawVal !== undefined && rawVal !== null) {
      valToDisplay = rawVal;
    } else if (f.name?.toLowerCase() === 'owner' || f.name?.toLowerCase() === 'owner_id') {
      valToDisplay = currentUser?.name || currentUser?.email || '';
    }

    const fieldName = f.name?.toLowerCase() || '';
    const isOwner = fieldName.includes('owner') || fieldName.includes('created_by') || fieldName.includes('updated_by') || fieldName.includes('user');
    const isCompany = fieldName.includes('company') || fieldName.includes('account') || fieldName.includes('organization');
    const isContact = fieldName.includes('contact');

    let fieldEl;

    if (f.type === 'picklist' || f.type === 'dropdown') {
      fieldEl = (
        <select
          disabled={isReadOnly}
          style={{ ...selectStyle(hasError), ...disabledInputStyle }}
          value={formData[f.name] || ''}
          onChange={(e) => handleChange(f.name, e.target.value)}
          onFocus={focusOn}
          onBlur={focusOff(hasError)}
        >
          <option value="">Select {f.label.toLowerCase()}…</option>
          {(f.options || ['Qualification', 'Needs Analysis', 'Proposal/Quote', 'Negotiation/Review', 'Closed Won', 'Closed Lost']).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    } else if (f.type === 'lookup' || isOwner || isCompany || isContact) {
      const options = isOwner
        ? lookupData.users
        : isContact
        ? (lookupData.contacts || [])
        : isCompany
        ? (lookupData.companies || [])
        : [];

      let rawFieldVal = formData[f.name];
      if (rawFieldVal == null && isCompany) {
        rawFieldVal = formData.company_id || formData.company || formData.account_id || formData.account || formData.organization_id || formData.organization;
      }
      if (rawFieldVal == null && isContact) {
        rawFieldVal = formData.contact_id || formData.contact || formData.primary_contact_id || formData.secondary_contact_id;
      }
      if (rawFieldVal && typeof rawFieldVal === 'object') {
        rawFieldVal = rawFieldVal.id || rawFieldVal.name || rawFieldVal.company_name || rawFieldVal.account_name || rawFieldVal.organization_name || rawFieldVal.email || '';
      }

      let currentSelectedVal = rawFieldVal || '';
      if (!currentSelectedVal && isOwner && (currentUser?.id || currentUser?.name)) {
        currentSelectedVal = currentUser?.id || currentUser?.name;
      }

      const matchOptionValue = (value) => {
        const normalized = String(value || '').trim().toLowerCase();
        return options.find((opt) => {
          const optValues = [
            opt && typeof opt === 'object' ? opt.id : opt,
            opt && typeof opt === 'object' ? opt._id : null,
            opt && typeof opt === 'object' ? opt.user_id : null,
            opt && typeof opt === 'object' ? opt.name : null,
            opt && typeof opt === 'object' ? opt.company_name : null,
            opt && typeof opt === 'object' ? opt.organization_name : null,
            opt && typeof opt === 'object' ? opt.account_name : null,
            opt && typeof opt === 'object' ? opt.company : null,
            opt && typeof opt === 'object' ? opt.organization : null,
            opt && typeof opt === 'object' ? opt.display_name : null,
            opt && typeof opt === 'object' ? opt.displayName : null,
            opt && typeof opt === 'object' ? `${opt.first_name || ''} ${opt.last_name || ''}`.trim() : null,
            opt && typeof opt === 'object' ? opt.email : null,
            opt && typeof opt === 'object' ? opt.title : null,
            opt && typeof opt !== 'object' ? opt : null,
          ]
            .filter(Boolean)
            .map((v) => String(v).trim().toLowerCase());
          return optValues.includes(normalized);
        });
      };

      if (currentSelectedVal && options.length > 0) {
        const nameMatch = matchOptionValue(currentSelectedVal);
        if (nameMatch) {
          currentSelectedVal = nameMatch.id || nameMatch.user_id || nameMatch.name || nameMatch.company_name || nameMatch.email;
        }
      }

      fieldEl = (
        <select
          disabled={isReadOnly}
          style={{ ...selectStyle(hasError), ...disabledInputStyle }}
          value={currentSelectedVal || ''}
          onChange={(e) => handleChange(f.name, e.target.value)}
          onFocus={focusOn}
          onBlur={focusOff(hasError)}
        >
          <option value="">Select {f.label.toLowerCase()}…</option>
          {options.map((opt, idx) => {
            const optVal = opt && typeof opt === 'object'
              ? opt.id || opt._id || opt.user_id || opt.company_name || opt.organization_name || opt.account_name || opt.company || opt.organization || opt.display_name || opt.displayName || `${opt.first_name || ''} ${opt.last_name || ''}`.trim() || opt.email || opt.title
              : String(opt || '');
            const safeOptVal = optVal || `option-${idx}`;
            const optLabel = opt && typeof opt === 'object'
              ? opt.name || opt.company_name || opt.organization_name || opt.account_name || opt.company || opt.organization || opt.displayName || opt.display_name || `${opt.first_name || ''} ${opt.last_name || ''}`.trim() || opt.email || opt.title || safeOptVal
              : String(opt || safeOptVal);
            return (
              <option key={safeOptVal} value={safeOptVal}>
                {optLabel}
              </option>
            );
          })}
        </select>
      );
    } else if (isNotes) {
      fieldEl = (
        <textarea
          disabled={isReadOnly}
          rows={3}
          style={{ ...textareaStyle(hasError), ...disabledInputStyle }}
          placeholder={`Enter ${f.label.toLowerCase()}…`}
          value={formData[f.name] !== undefined && formData[f.name] !== null ? formData[f.name] : ''}
          onChange={(e) => handleChange(f.name, e.target.value)}
          onFocus={focusOn}
          onBlur={focusOff(hasError)}
        />
      );
    } else {
      let typeAttr = 'text';
      if (f.type === 'email') typeAttr = 'email';
      else if (f.type === 'phone') typeAttr = 'tel';
      else if (f.type === 'number' || f.type === 'currency') typeAttr = 'number';
      else if (f.type === 'date') typeAttr = 'date';

      fieldEl = (
        <input
          disabled={isReadOnly}
          type={typeAttr}
          style={{ ...inputStyle(hasError), ...disabledInputStyle }}
          placeholder={`Enter ${f.label.toLowerCase()}`}
          value={formData[f.name] !== undefined && formData[f.name] !== null ? formData[f.name] : ''}
          onChange={(e) => handleChange(f.name, e.target.value)}
          onFocus={focusOn}
          onBlur={focusOff(hasError)}
        />
      );
    }

    return (
      <div key={f.name} style={{ gridColumn: isNotes ? '1 / -1' : undefined }}>
        <label style={labelStyle}>
          {f.label}
          {f.required && <span style={{ color: C.danger, marginLeft: '2px' }}>*</span>}
        </label>
        {fieldEl}
        {errors[f.name] && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.74rem', color: C.danger, marginTop: '6px', fontWeight: 600 }}>
            <AlertTriangle style={{ width: 12, height: 12 }} />
            {errors[f.name]}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="animate-fade-in"
      style={{
        background: 'transparent',
        padding: '24px 32px 48px',
        minHeight: '100%',
        boxSizing: 'border-box',
        maxWidth: '1240px',
        margin: '0 auto',
      }}
    >
      <style>{`
        @keyframes ep-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        .ep-rise{animation:ep-rise .5s cubic-bezier(.2,.7,.3,1) both}
        @keyframes ep-spin{to{transform:rotate(360deg)}}
      `}</style>

      {/* ── Breadcrumb ───────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '6px',
          fontSize: '0.8rem',
          color: '#64748B',
          marginBottom: '14px',
        }}
      >
        <Link to="/workspace/dashboard" style={{ color: '#000000', textDecoration: 'none' }}>
          Workspace
        </Link>
        <ChevronRight style={{ width: '13px', height: '13px', color: '#64748B' }} />
        <Link to={`/workspace/object/${objectTypeId}`} style={{ color: '#000000', textDecoration: 'none' }}>
          {meta.pluralDisplayName}
        </Link>
        <ChevronRight style={{ width: '13px', height: '13px', color: '#64748B' }} />
        <Link to={`/workspace/object/${objectTypeId}/${recordId}`} style={{ color: '#000000', textDecoration: 'none' }}>
          {recordTitle}
        </Link>
        <ChevronRight style={{ width: '13px', height: '13px', color: '#64748B' }} />
        <span style={{ color: '#000000', fontWeight: 600 }}>Edit</span>
      </div>

      {/* ── Page Header Banner ───────────────────────────────── */}
      <div
        className="ep-rise"
        style={{
          position: 'relative',
          overflow: 'hidden',
          background: C.bannerGrad,
          borderRadius: '24px',
          padding: '26px 30px',
          marginBottom: '22px',
          boxShadow: '0 30px 60px -34px rgba(8,12,28,.75)',
          border: '1px solid rgba(255,255,255,.06)',
        }}
      >
        <div style={{ position: 'absolute', top: -90, right: -50, width: 240, height: 240, borderRadius: '50%', background: 'rgba(34,211,238,.22)', filter: 'blur(70px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -110, left: 90, width: 220, height: 220, borderRadius: '50%', background: 'rgba(99,102,241,.28)', filter: 'blur(70px)', pointerEvents: 'none' }} />

        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '18px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div
              style={{
                width: 58,
                height: 58,
                borderRadius: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: C.primaryGrad,
                color: '#fff',
                fontSize: '1.2rem',
                fontWeight: 800,
                letterSpacing: '.02em',
                boxShadow: '0 0 0 3px rgba(255,255,255,.10), 0 16px 34px -16px rgba(34,211,238,.65)',
                flexShrink: 0,
              }}
            >
              {getInitials(recordTitle)}
            </div>
            <div>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '4px 11px',
                  borderRadius: 999,
                  background: 'rgba(99,102,241,.16)',
                  border: '1px solid rgba(99,102,241,.35)',
                  color: '#c7d2fe',
                  fontSize: '.62rem',
                  fontWeight: 800,
                  letterSpacing: '.14em',
                  marginBottom: 9,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.cyan }} />
                EDIT MODE
              </span>
              <h1
                style={{
                  margin: '0 0 4px',
                  fontSize: '1.6rem',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  letterSpacing: '-0.025em',
                  lineHeight: 1.2,
                }}
              >
                Edit {meta.displayName}
              </h1>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#9aa6c4', fontWeight: 500 }}>
                Update field information for {recordTitle}.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCancel}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '11px 18px',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: '#e8ecf8',
              backgroundColor: 'rgba(255,255,255,.07)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,.16)',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all .22s cubic-bezier(.4,0,.2,1)',
            }}
            onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'rgba(34,211,238,.5)'; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.16)'; }}
          >
            <ArrowLeft style={{ width: '15px', height: '15px' }} />
            Back to Record
          </button>
        </div>
      </div>

      {/* ── Main Form Layout ──────────────────────────────────── */}
      <form onSubmit={handleSubmit} noValidate className="ep-rise">
        {/* Dynamic Card Container for all fields */}
        <div style={{ ...sectionCardStyle, marginBottom: '22px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '20px 34px',
              borderBottom: `1px solid ${C.border}`,
              background: 'linear-gradient(90deg,rgba(99,102,241,.06),rgba(34,211,238,.05))',
            }}
          >
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(99,102,241,.12)',
                color: C.indigo,
              }}
            >
              <Save style={{ width: 17, height: 17 }} />
            </span>
            <div style={{ fontSize: '0.74rem', fontWeight: 800, color: C.text, letterSpacing: '0.12em' }}>
              RECORD INFORMATION
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '22px 28px',
              padding: '28px 34px 0',
            }}
          >
            {(meta.fields || []).map((f) => renderField(f))}
          </div>
        </div>

        {/* ── Footer Action Bar ───────────────────────────────── */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
            padding: '16px 24px',
            backgroundColor: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: '18px',
            boxShadow: '0 1px 2px rgba(16,20,40,.05), 0 18px 40px -28px rgba(16,20,40,.4)',
          }}
        >
          {submitError && (
            <div style={{
              position: 'absolute',
              bottom: '100%',
              right: '10px',
              marginBottom: '16px',
              width: '420px',
              backgroundColor: '#ffffff',
              border: '1px solid #ea001e',
              borderRadius: '10px',
              boxShadow: '0 18px 44px rgba(11, 23, 39, 0.22)',
              zIndex: 40,
              overflow: 'hidden',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            }}>
              {/* Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'linear-gradient(90deg,#ea001e,#f43f5e)',
                color: '#ffffff',
                padding: '11px 14px',
                fontSize: '14px',
                fontWeight: 'bold',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle style={{ width: 16, height: 16 }} />
                  <span>We hit a snag.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSubmitError(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ffffff',
                    cursor: 'pointer',
                    padding: '0 2px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0.85,
                  }}
                  onMouseOver={(e) => e.currentTarget.style.opacity = 1}
                  onMouseOut={(e) => e.currentTarget.style.opacity = 0.85}
                >
                  <X style={{ width: 15, height: 15 }} />
                </button>
              </div>

              {/* Body */}
              <div style={{
                padding: '14px 16px',
                color: '#080707',
                fontSize: '13px',
                lineHeight: '1.5',
                textAlign: 'left',
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Review the errors on this page.</div>
                <ul style={{ margin: 0, paddingLeft: '20px', listStyleType: 'disc' }}>
                  <li style={{ color: '#080707' }}>
                    {submitError}
                  </li>
                </ul>
              </div>

              {/* Popover Arrow */}
              <div style={{
                position: 'absolute',
                top: '100%',
                right: '40px',
                width: '0',
                height: '0',
                borderLeft: '10px solid transparent',
                borderRight: '10px solid transparent',
                borderTop: '10px solid #ea001e',
              }} />
              <div style={{
                position: 'absolute',
                top: '100%',
                right: '41px',
                width: '0',
                height: '0',
                borderLeft: '9px solid transparent',
                borderRight: '9px solid transparent',
                borderTop: '9px solid #ffffff',
                marginTop: '-1px',
              }} />
            </div>
          )}

          <button
            type="button"
            onClick={handleCancel}
            style={{
              padding: '11px 20px',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: '#475069',
              backgroundColor: '#f7f8fc',
              border: `1.5px solid ${C.border}`,
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all .2s cubic-bezier(.4,0,.2,1)',
            }}
            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#eef1f8'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#f7f8fc'; e.currentTarget.style.transform = 'none'; }}
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '11px 24px',
              fontSize: '0.85rem',
              fontWeight: 700,
              color: '#ffffff',
              background: C.primaryGrad,
              opacity: saving ? 0.65 : 1,
              border: '1px solid transparent',
              borderRadius: '12px',
              cursor: saving ? 'not-allowed' : 'pointer',
              boxShadow: '0 12px 28px -12px rgba(99,102,241,.75)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all .2s cubic-bezier(.4,0,.2,1)',
            }}
            onMouseOver={(e) => { if (!saving) e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; }}
          >
            {saving ? (
              <>
                <span
                  style={{
                    width: '0.85rem',
                    height: '0.85rem',
                    borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,.4)',
                    borderTopColor: '#fff',
                    display: 'inline-block',
                    animation: 'ep-spin .8s linear infinite',
                  }}
                />
                Updating…
              </>
            ) : (
              <>
                <Save style={{ width: 15, height: 15 }} />
                {`Update ${meta.displayName}`}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default EditPage;
