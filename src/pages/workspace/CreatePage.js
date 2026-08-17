import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import { useWorkspace } from '../../context/WorkspaceContext';
import { apiGet, apiPost } from '../../api/client';
import { ChevronRight, ArrowLeft, Save, Plus, X, AlertTriangle, MapPin, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import CustomPicklist from '../../components/CustomPicklist';

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

function CreatePage({ objectTypeId: propObjectTypeId, onSuccess }) {
  const params = useParams();
  const location = useLocation();
  const objectTypeId = propObjectTypeId || params.objectTypeId || 'leads';
  const { objectTypes, currentUser, permissions } = useWorkspace();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({});
  const [fields, setFields] = useState([]);
  const [lookupData, setLookupData] = useState({ users: [], companies: [], contacts: [] });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savingAnother, setSavingAnother] = useState(false);
  const [addressExpanded, setAddressExpanded] = useState(true);
  const [descriptionExpanded, setDescriptionExpanded] = useState(true);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      apiGet(`/metadata/objects/${objectTypeId}/fields`).catch(() => apiGet(`/objects/${objectTypeId}/fields`)).catch(() => []),
      apiGet('/users').catch(() => ({ data: [] })),
      apiGet('/objects/companies').catch(() => apiGet('/companies')).catch(() => ({ data: [] })),
      apiGet('/objects/contacts').catch(() => apiGet('/contacts')).catch(() => ({ data: [] })),
    ]).then(([fList, uRes, cRes, ctRes]) => {
      if (!isMounted) return;
      const fieldsData = Array.isArray(fList) ? fList : (fList?.data || []);
      if (fieldsData.length > 0) setFields(fieldsData);

      const usersList = Array.isArray(uRes) ? uRes : (uRes?.data || []);
      const compList = Array.isArray(cRes) ? cRes : (cRes?.data || []);
      const contactList = Array.isArray(ctRes) ? ctRes : (ctRes?.data || []);

      setLookupData({
        users: usersList.length > 0 ? usersList : (currentUser ? [currentUser] : []),
        companies: compList,
        contacts: contactList,
      });

      // Parse query params for pre-filled lookup values
      const queryParams = new URLSearchParams(location.search);
      const prefill = {};
      queryParams.forEach((value, key) => {
        prefill[key] = value;
      });
      if (Object.keys(prefill).length > 0) {
        setFormData((prev) => ({ ...prefill, ...prev }));
      }
    });

    return () => { isMounted = false; };
  }, [objectTypeId, location.search, currentUser]);

  const rawMeta = objectTypes ? objectTypes[objectTypeId] : null;
  const effectiveFields = fields.length > 0 ? [...fields] : [...(rawMeta?.fields || [])];

  const lowerObj = String(objectTypeId || '').toLowerCase();
  if (lowerObj.includes('company') || lowerObj.includes('account')) {
    const stdCompFields = [
      { id: 'f_billing_address', name: 'billing_address', label: 'Billing Address', type: 'address' },
      { id: 'f_shipping_address', name: 'shipping_address', label: 'Shipping Address', type: 'address' },
    ];
    stdCompFields.forEach((scf) => {
      if (!effectiveFields.some((existing) => (existing.name || '').toLowerCase() === scf.name)) {
        effectiveFields.push(scf);
      }
    });
  }

  const createFields = effectiveFields.filter((f) => {
    const fp = permissions?.fieldPermissions?.[f.id];
    const canCreate = f.canCreate !== undefined ? f.canCreate : (fp ? fp.canCreate !== false : true);
    return canCreate !== false;
  });

  const meta = {
    displayName: rawMeta?.displayName || (objectTypeId ? objectTypeId.charAt(0).toUpperCase() + objectTypeId.slice(1).replace(/s$/, '') : 'Record'),
    pluralDisplayName: rawMeta?.pluralDisplayName || (objectTypeId ? objectTypeId.charAt(0).toUpperCase() + objectTypeId.slice(1) : 'Records'),
    fields: effectiveFields.filter((f) => f.name !== 'id' && f.name !== 'created_at' && f.name !== 'created_by' && f.name !== 'updated_at' && f.name !== 'updated_by'),
  };

  const handleCancel = () => {
    navigate(`/workspace/object/${objectTypeId}`);
  };

  function handleChange(fieldName, value) {
    setFormData((prev) => {
      const next = { ...prev, [fieldName]: value };
      if (fieldName === 'lead_source' || fieldName === 'source') {
        next.lead_source = value;
        next.source = value;
      }
      if (fieldName === 'title' || fieldName === 'job_title') {
        next.title = value;
        next.job_title = value;
      }
      return next;
    });
    if (errors[fieldName]) {
      setErrors((prev) => ({ ...prev, [fieldName]: null }));
    }
    if (submitError) setSubmitError(null);
  }

  async function executeSave(createAnother = false) {
    setSubmitError(null);
    const fieldsList = meta.fields || [];
    const valErrors = {};

    const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/;

    fieldsList.forEach((field) => {
      const val = (formData[field.name] !== undefined && formData[field.name] !== null) ? String(formData[field.name]).trim() : '';
      if (field.required && !val) {
        valErrors[field.name] = `${field.label} is required.`;
      } else if (val && (field.type === 'email' || (field.name || '').toLowerCase().includes('email') || (field.label || '').toLowerCase().includes('email'))) {
        if (!EMAIL_REGEX.test(val)) {
          valErrors[field.name] = `Please enter a valid email address for ${field.label} (e.g. user@company.com).`;
        }
      }
    });

    // Check for duplicate Primary Email and Alternate Email ID
    const primaryEmail = (formData.email || formData.work_email || formData.primary_email || '').trim().toLowerCase();
    const altEmail = (formData.alternate_email || formData.alternate_email_id || formData.secondary_email || formData.alt_email || '').trim().toLowerCase();

    if (primaryEmail && altEmail && primaryEmail === altEmail) {
      const emailFieldKey = fieldsList.find(f => ['alternate_email', 'alternate_email_id', 'secondary_email', 'alt_email'].includes(f.name))?.name || 'alternate_email';
      valErrors[emailFieldKey] = 'Email and Alternate Email ID cannot be the same address.';
    }

    if (Object.keys(valErrors).length > 0) {
      setErrors(valErrors);
      const firstErrMsg = Object.values(valErrors)[0];
      setSubmitError(firstErrMsg ? `Validation Error: ${firstErrMsg}` : 'Validation Error: Please review the errors on this page.');
      return;
    }

    if (createAnother) {
      setSavingAnother(true);
    } else {
      setSaving(true);
    }

    try {
      const savedRecord = await apiPost(`/objects/${objectTypeId}`, formData);
      const newId = savedRecord?.id || savedRecord?._id;

      if (createAnother) {
        setFormData({});
        setErrors({});
      } else if (onSuccess) {
        onSuccess(savedRecord);
      } else if (newId) {
        navigate(`/workspace/object/${objectTypeId}/${newId}`);
      } else {
        navigate(`/workspace/object/${objectTypeId}`);
      }
    } catch (err) {
      console.error('Failed to create record:', err);
      setSubmitError(err.message || 'Failed to create record.');
    } finally {
      setSaving(false);
      setSavingAnother(false);
    }
  }

  /* ═══════════ STYLES (presentation only) ═══════════ */
  const inputStyle = (hasError) => ({
    width: '100%',
    height: '48px',
    padding: '0 15px',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: C.text,
    backgroundColor: '#fbfcff',
    border: `1.5px solid ${hasError ? '#f43f5e' : C.border}`,
    borderRadius: '13px',
    outline: 'none',
    transition: 'border-color .18s ease, box-shadow .18s ease, background-color .18s ease',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  });

  const textareaStyle = (hasError) => ({
    width: '100%',
    minHeight: '128px',
    padding: '14px 16px',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: C.text,
    backgroundColor: '#fbfcff',
    border: `1.5px solid ${hasError ? '#f43f5e' : C.border}`,
    borderRadius: '13px',
    outline: 'none',
    resize: 'vertical',
    lineHeight: 1.6,
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    transition: 'border-color .18s ease, box-shadow .18s ease, background-color .18s ease',
  });

  const selectStyle = (hasError) => ({
    ...inputStyle(hasError),
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236366f1' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 14px center',
    paddingRight: '44px',
    cursor: 'pointer',
  });

  const focusOn = (e) => {
    e.currentTarget.style.borderColor = C.indigo;
    e.currentTarget.style.backgroundColor = '#ffffff';
    e.currentTarget.style.boxShadow = '0 0 0 4px rgba(99,102,241,.14)';
  };
  const focusOff = (hasError) => (e) => {
    e.currentTarget.style.borderColor = hasError ? '#f43f5e' : C.border;
    e.currentTarget.style.backgroundColor = '#fbfcff';
    e.currentTarget.style.boxShadow = 'none';
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.68rem',
    fontWeight: 800,
    color: C.dim,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: '8px',
  };

  const sectionCardStyle = {
    backgroundColor: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: '22px',
    padding: '0 0 30px',
    boxShadow: '0 1px 2px rgba(16,20,40,.05), 0 22px 48px -34px rgba(16,20,40,.45)',
    overflow: 'hidden',
  };

  const renderField = (f) => {
    const hasError = Boolean(errors[f.name]);
    const isNotes = f.name === 'notes' || f.name === 'description' || f.name === 'note' || f.type === 'address' || (f.name || '').toLowerCase().includes('address') || (f.name || '').toLowerCase().includes('street');
    const isOwner = f.name?.toLowerCase().includes('owner') || f.name?.toLowerCase().includes('created_by');
    const isCompany = f.name?.toLowerCase().includes('company');
    const isContact = f.name?.toLowerCase().includes('contact');

    let fieldEl;

    if (f.type === 'picklist' || f.type === 'dropdown') {
      const rawOptions = (Array.isArray(f.options) && f.options.length > 0)
        ? f.options
        : (Array.isArray(f.picklist_values) && f.picklist_values.length > 0)
        ? f.picklist_values
        : (Array.isArray(f.picklistValues) && f.picklistValues.length > 0)
        ? f.picklistValues
        : null;

      let optionsList = rawOptions;
      if (!optionsList || optionsList.length === 0) {
        const name = (f.name || '').toLowerCase();
        const label = (f.label || '').toLowerCase();
        if (name.includes('industry') || label.includes('industry')) {
          optionsList = ['Manufacturing', 'Retail', 'Healthcare', 'Education', 'Financial Services', 'IT / Software', 'Telecommunications', 'Construction', 'Real Estate', 'Transportation', 'Energy / Utilities', 'Government', 'Agriculture', 'Hospitality', 'Professional Services'];
        } else if (name.includes('score') || label.includes('score')) {
          optionsList = ['1', '2', '3', '4', '5'];
        } else if (name.includes('contact') || label.includes('preferred contact')) {
          optionsList = ['Email', 'Mobile'];
        } else if (name === 'source' || name === 'lead_source' || label.includes('source')) {
          optionsList = ['QR Scan', 'Website', 'Referral', 'Cold Outbound', 'Partner', 'Trade Show', 'Webinar Registration', 'Form Submission', 'CSV Import', 'Other'];
        } else if (name === 'status' || label.includes('status')) {
          optionsList = ['New', 'Qualified', 'Not Qualified', 'Converted'];
        } else if (name === 'stage' || label.includes('stage')) {
          optionsList = ['Qualification', 'Needs Analysis', 'Proposal/Quote', 'Negotiation/Review', 'Closed Won', 'Closed Lost'];
        } else {
          optionsList = ['Active', 'Inactive'];
        }
      }

      fieldEl = (
        <CustomPicklist
          options={optionsList}
          value={formData[f.name] || ''}
          onChange={(val) => handleChange(f.name, val)}
          placeholder={`Select ${f.label.toLowerCase()}…`}
          hasError={hasError}
        />
      );
    } else if (f.type === 'lookup' || isOwner || isCompany || isContact) {
      const options = isOwner
        ? lookupData.users
        : isContact
        ? lookupData.contacts
        : isCompany
        ? lookupData.companies
        : [];

      fieldEl = (
        <CustomPicklist
          options={options}
          value={formData[f.name] || ''}
          onChange={(val) => handleChange(f.name, val)}
          placeholder={`-- Select ${f.label} --`}
          hasError={hasError}
        />
      );
    } else if (isNotes) {
      fieldEl = (
        <textarea
          rows={3}
          style={textareaStyle(hasError)}
          placeholder={`Enter ${f.label.toLowerCase()}…`}
          value={formData[f.name] || ''}
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
          type={typeAttr}
          style={inputStyle(hasError)}
          placeholder={`Enter ${f.label.toLowerCase()}`}
          value={formData[f.name] !== undefined ? formData[f.name] : ''}
          onChange={(e) => handleChange(f.name, e.target.value)}
          onFocus={focusOn}
          onBlur={focusOff(hasError)}
        />
      );
    }

    return (
      <div key={f.name}>
        <label style={labelStyle}>
          {f.label}
          {f.required && <span style={{ color: C.danger, marginLeft: '3px' }}>*</span>}
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
        @keyframes cp-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        .cp-rise{animation:cp-rise .5s cubic-bezier(.2,.7,.3,1) both}
        @keyframes cp-spin{to{transform:rotate(360deg)}}
      `}</style>

      {/* ── Breadcrumb ───────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '6px',
          fontSize: '0.8rem',
          color: '#475569',
          marginBottom: '14px',
        }}
      >
        <Link to="/workspace/dashboard" style={{ color: '#475569', textDecoration: 'none', fontWeight: 500 }}>
          Workspace
        </Link>
        <ChevronRight style={{ width: '13px', height: '13px', color: '#64748B' }} />
        <Link to={`/workspace/object/${objectTypeId}`} style={{ color: '#475569', textDecoration: 'none', fontWeight: 500 }}>
          {meta.pluralDisplayName}
        </Link>
        <ChevronRight style={{ width: '13px', height: '13px', color: '#64748B' }} />
        <span style={{ color: '#0F172A', fontWeight: 700 }}>Create {meta.displayName}</span>
      </div>

      {/* ── Page Header Banner ───────────────────────────────── */}
      <div
        className="cp-rise"
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
                boxShadow: '0 0 0 3px rgba(255,255,255,.10), 0 16px 34px -16px rgba(34,211,238,.65)',
                flexShrink: 0,
              }}
            >
              <Plus style={{ width: 26, height: 26 }} />
            </div>
            <div>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '4px 11px',
                  borderRadius: 999,
                  background: 'rgba(34,211,238,.14)',
                  border: '1px solid rgba(34,211,238,.32)',
                  color: '#a5f3fc',
                  fontSize: '.62rem',
                  fontWeight: 800,
                  letterSpacing: '.14em',
                  marginBottom: 9,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.cyan }} />
                NEW RECORD
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
                Create {meta.displayName}
              </h1>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#9aa6c4', fontWeight: 500 }}>
                Fill in the details below to create a new {meta.displayName.toLowerCase()} record.
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
            Cancel
          </button>
        </div>
      </div>

      {/* ── Main Form Layout ──────────────────────────────────── */}
      {(() => {
        const allFormFields = meta.fields || [];
        const isAddressField = (f) => f.type === 'address' || (f.name || '').toLowerCase().includes('address') || (f.name || '').toLowerCase().includes('street');
        const isDescriptionField = (f) => (f.name || '').toLowerCase() === 'description' || (f.name || '').toLowerCase() === 'notes' || (f.name || '').toLowerCase() === 'note';

        const addressFields = allFormFields.filter(isAddressField);
        const descriptionFields = allFormFields.filter(isDescriptionField);
        const standardFields = allFormFields.filter((f) => !isAddressField(f) && !isDescriptionField(f));

        return (
          <form onSubmit={(e) => { e.preventDefault(); executeSave(false); }} noValidate className="cp-rise">
            {/* Single Unified Master Card Container */}
            <div style={{ ...sectionCardStyle, marginBottom: '22px' }}>
              {/* 1. Primary Record Information Header */}
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

              {/* Standard Fields Grid */}
              {standardFields.length > 0 && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '22px 28px',
                    padding: '28px 34px 20px',
                  }}
                >
                  {standardFields.map((f) => renderField(f))}
                </div>
              )}

              {/* 2. Expandable Address Information Accordion */}
              {addressFields.length > 0 && (
                <div style={{ borderTop: `1px solid ${C.border}` }}>
                  <button
                    type="button"
                    onClick={() => setAddressExpanded((prev) => !prev)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '18px 34px',
                      background: '#ffffff',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.18s ease',
                      outline: 'none',
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.03)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.background = '#ffffff'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'rgba(34,211,238,.14)',
                          color: '#0891b2',
                        }}
                      >
                        <MapPin style={{ width: 17, height: 17 }} />
                      </span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: C.text, letterSpacing: '0.12em' }}>
                        ADDRESS INFORMATION
                      </span>
                    </div>

                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: addressExpanded ? 'rgba(99,102,241,0.12)' : '#f1f5f9',
                        color: addressExpanded ? C.indigo : '#64748b',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                      }}
                    >
                      {addressExpanded ? <ChevronUp size={22} strokeWidth={2.5} /> : <ChevronDown size={22} strokeWidth={2.5} />}
                    </div>
                  </button>

                  {addressExpanded && (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                        gap: '22px 28px',
                        padding: '24px 34px 20px',
                        animation: 'cp-rise .3s cubic-bezier(.2,.7,.3,1) both',
                      }}
                    >
                      {addressFields.map((f) => renderField(f))}
                    </div>
                  )}
                </div>
              )}

              {/* 3. Expandable Description Information Accordion */}
              {descriptionFields.length > 0 && (
                <div style={{ borderTop: `1px solid ${C.border}` }}>
                  <button
                    type="button"
                    onClick={() => setDescriptionExpanded((prev) => !prev)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '18px 34px',
                      background: '#ffffff',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.18s ease',
                      outline: 'none',
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.03)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.background = '#ffffff'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'rgba(99,102,241,.12)',
                          color: C.indigo,
                        }}
                      >
                        <FileText style={{ width: 17, height: 17 }} />
                      </span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: C.text, letterSpacing: '0.12em' }}>
                        DESCRIPTION INFORMATION
                      </span>
                    </div>

                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: descriptionExpanded ? 'rgba(99,102,241,0.12)' : '#f1f5f9',
                        color: descriptionExpanded ? C.indigo : '#64748b',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                      }}
                    >
                      {descriptionExpanded ? <ChevronUp size={22} strokeWidth={2.5} /> : <ChevronDown size={22} strokeWidth={2.5} />}
                    </div>
                  </button>

                  {descriptionExpanded && (
                    <div style={{ padding: '24px 34px 20px', animation: 'cp-rise .3s cubic-bezier(.2,.7,.3,1) both' }}>
                      {descriptionFields.map((f) => renderField(f))}
                    </div>
                  )}
                </div>
              )}
            </div>

        {/* ── Footer Action Bar ───────────────────────────────── */}
        <div style={{ position: 'relative', marginTop: '24px', zIndex: 30 }}>
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
                borderTopLeftRadius: '9px',
                borderTopRightRadius: '9px',
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

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
              padding: '16px 24px',
              backgroundColor: 'rgba(255,255,255,.92)',
              backdropFilter: 'blur(14px)',
              border: `1px solid ${C.border}`,
              borderRadius: '18px',
              boxShadow: '0 1px 2px rgba(16,20,40,.05), 0 18px 40px -28px rgba(16,20,40,.4)',
            }}
          >
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
              type="button"
              disabled={saving || savingAnother}
              onClick={() => executeSave(true)}
              style={{
                padding: '11px 18px',
                fontSize: '0.85rem',
                fontWeight: 700,
                color: C.indigo,
                background: 'rgba(99,102,241,.08)',
                border: '1.5px solid rgba(99,102,241,.28)',
                borderRadius: '12px',
                opacity: saving || savingAnother ? 0.65 : 1,
                cursor: saving || savingAnother ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all .2s cubic-bezier(.4,0,.2,1)',
              }}
              onMouseOver={(e) => { if (!(saving || savingAnother)) { e.currentTarget.style.background = 'rgba(99,102,241,.15)'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,.08)'; e.currentTarget.style.transform = 'none'; }}
            >
              {savingAnother ? (
                <>
                  <span
                    style={{
                      width: '0.85rem',
                      height: '0.85rem',
                      borderRadius: '50%',
                      border: `2px solid rgba(99,102,241,.35)`,
                      borderTopColor: C.indigo,
                      display: 'inline-block',
                      animation: 'cp-spin .8s linear infinite',
                    }}
                  />
                  Saving…
                </>
              ) : (
                <>
                  <Plus style={{ width: 15, height: 15 }} />
                  Save &amp; Create Another
                </>
              )}
            </button>

            <button
              type="submit"
              disabled={saving || savingAnother}
              style={{
                padding: '11px 24px',
                fontSize: '0.85rem',
                fontWeight: 700,
                color: '#ffffff',
                background: C.primaryGrad,
                opacity: saving || savingAnother ? 0.65 : 1,
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
                      animation: 'cp-spin .8s linear infinite',
                    }}
                  />
                  Saving…
                </>
              ) : (
                <>
                  <Save style={{ width: 15, height: 15 }} />
                  {`Save ${meta.displayName}`}
                </>
              )}
            </button>
          </div>
        </div>
      </form>
        );
      })()}
    </div>
  );
}

export default CreatePage;
