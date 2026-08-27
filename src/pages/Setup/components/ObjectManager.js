import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { apiGet, apiPost, apiDelete } from '../../../api/client';
import { useWorkspace } from '../../../context/WorkspaceContext';
import {
  Box, Plus, X, Loader, Layers, CheckCircle, Search,
  UserPlus, Users,
  DollarSign, Building2, CheckSquare, FileText, Phone, Calendar,
  Megaphone, UserCheck, ChevronRight, RefreshCw, Sparkles,
  Pencil, Trash2, AlertTriangle, MoreHorizontal
} from 'lucide-react';


/* ── Helper for module iconography, colors, and badge ── */
function getModuleMeta(key, obj) {
  const isCustom = key.endsWith('__c') || obj?.is_custom;
  const isSystem = obj?.is_system || ['user', 'organization', 'system_setting'].includes(key.toLowerCase());
  const badgeType = isCustom ? 'Custom' : isSystem ? 'System' : 'Standard';

  const lowerKey = key.toLowerCase();
  let Icon = Box;
  let iconColor = '#6366f1';
  let iconBg = '#f5f3ff';
  let ringColor = 'rgba(99, 102, 241, 0.15)';


  if (isCustom) {
    Icon = Layers;
    iconColor = '#9333ea';
    iconBg = '#faf5ff';
    ringColor = 'rgba(168, 85, 247, 0.15)';
  } else if (lowerKey.includes('lead')) {
    Icon = UserPlus;
    iconColor = '#10b981';
    iconBg = '#ecfdf5';
    ringColor = 'rgba(16, 185, 129, 0.15)';
  } else if (lowerKey.includes('contact')) {
    Icon = Users;
    iconColor = '#3b82f6';
    iconBg = '#eff6ff';
    ringColor = 'rgba(59, 130, 246, 0.15)';
  } else if (lowerKey.includes('deal') || lowerKey.includes('opportunity')) {
    Icon = DollarSign;
    iconColor = '#f59e0b';
    iconBg = '#fffbeb';
    ringColor = 'rgba(245, 158, 11, 0.15)';
  } else if (lowerKey.includes('company') || lowerKey.includes('account')) {
    Icon = Building2;
    iconColor = '#06b6d4';
    iconBg = '#ecfeff';
    ringColor = 'rgba(6, 182, 212, 0.15)';
  } else if (lowerKey.includes('task')) {
    Icon = CheckSquare;
    iconColor = '#ec4899';
    iconBg = '#fdf2f8';
    ringColor = 'rgba(236, 72, 153, 0.15)';
  } else if (lowerKey.includes('note')) {
    Icon = FileText;
    iconColor = '#8b5cf6';
    iconBg = '#f5f3ff';
    ringColor = 'rgba(139, 92, 246, 0.15)';
  } else if (lowerKey.includes('call') || lowerKey.includes('phone')) {
    Icon = Phone;
    iconColor = '#14b8a6';
    iconBg = '#f0fdfa';
    ringColor = 'rgba(20, 184, 166, 0.15)';
  } else if (lowerKey.includes('meeting') || lowerKey.includes('event')) {
    Icon = Calendar;
    iconColor = '#f43f5e';
    iconBg = '#fff1f2';
    ringColor = 'rgba(244, 63, 94, 0.15)';
  } else if (lowerKey.includes('campaign')) {
    Icon = Megaphone;
    iconColor = '#ff5722';
    iconBg = '#fff7ed';
    ringColor = 'rgba(255, 87, 34, 0.15)';
  } else if (lowerKey.includes('user')) {
    Icon = UserCheck;
    iconColor = '#64748b';
    iconBg = '#f8fafc';
    ringColor = 'rgba(100, 116, 139, 0.15)';
  }


  return { Icon, iconColor, iconBg, ringColor, badgeType };
}


function ObjectManager({ onSelectObject }) {
  const { permissions } = useWorkspace();
  const objDefPerm = permissions ? (permissions['object_definition'] || permissions['object'] || permissions['custom_module'] || permissions['module']) : null;
  const canCreateModule = objDefPerm ? objDefPerm.canCreate !== false : true;
  const canUpdateModule = objDefPerm ? (objDefPerm.canUpdate !== false && objDefPerm.canEdit !== false) : true;
  const canDeleteModule = objDefPerm ? objDefPerm.canDelete !== false : true;

  const [objectTypes, setObjectTypes] = useState({});
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'standard', 'custom', 'recently_updated'

  /* Dropdown & Modals State */
  const [openMenuKey, setOpenMenuKey] = useState(null);
  const [editCustomModule, setEditCustomModule] = useState(null);
  const [deleteConfirmModule, setDeleteConfirmModule] = useState(null);


  /* Hover & Active Card Animation States */
  const [hoveredKey, setHoveredKey] = useState(null);
  const [activeKey, setActiveKey] = useState(null);


  /* Form State */
  const [label, setLabel] = useState('');
  const [pluralLabel, setPluralLabel] = useState('');
  const [isPluralAutofilled, setIsPluralAutofilled] = useState(true);
  const [apiName, setApiName] = useState('');
  const [description, setDescription] = useState('');
  const [recordNameLabel, setRecordNameLabel] = useState('');
  const [isRecordNameAutofilled, setIsRecordNameAutofilled] = useState(true);
  const [recordNameType, setRecordNameType] = useState('text');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [toastMessage, setToastMessage] = useState(null);


  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuKey(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);


  const loadMeta = async (force = false) => {
    try {
      setLoading(true);
      const url = force ? '/workspace/metadata?refresh=true' : '/workspace/metadata';
      const data = await apiGet(url).catch(() => ({}));
      setObjectTypes(data?.objectTypes || {});
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    loadMeta();
  }, []);


  const handleLabelChange = (e) => {
    const val = e.target.value;
    setLabel(val);
    const clean = val.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (clean) {
      setApiName(`${clean}__c`);
    } else {
      setApiName('');
    }
    if (isPluralAutofilled) {
      setPluralLabel(val ? (val.endsWith('s') || val.endsWith('y') ? `${val}es` : `${val}s`) : '');
    }
    if (isRecordNameAutofilled) {
      setRecordNameLabel(val ? `${val} Name` : '');
    }
  };

  const handleOpenNewModal = () => {
    setLabel('');
    setPluralLabel('');
    setIsPluralAutofilled(true);
    setApiName('');
    setDescription('');
    setRecordNameLabel('');
    setIsRecordNameAutofilled(true);
    setRecordNameType('text');
    setErrorMsg('');
    setIsModalOpen(true);
  };


  const handleCreateObject = async (e) => {
    e.preventDefault();
    if (!label.trim()) {
      setErrorMsg('Module Label (Singular) is required.');
      return;
    }


    const finalApi = apiName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const cleanApi = finalApi.endsWith('__c') ? finalApi : `${finalApi}__c`;


    setSaving(true);
    setErrorMsg('');


    try {
      await apiPost('/metadata/objects', {
        display_name: label.trim(),
        label: label.trim(),
        plural_display_name: pluralLabel.trim() || `${label.trim()}s`,
        api_name: cleanApi,
        description: description.trim(),
        record_name_label: recordNameLabel.trim() || `${label.trim()} Name`,
        record_name_type: recordNameType,
      });


      setIsModalOpen(false);
      setLabel('');
      setPluralLabel('');
      setIsPluralAutofilled(true);
      setApiName('');
      setDescription('');
      setRecordNameLabel('');
      setIsRecordNameAutofilled(true);
      setRecordNameType('text');


      await loadMeta(true);
    } catch (err) {
      console.error('Error creating custom module:', err);
      setErrorMsg(err?.message || err?.error || 'Failed to create custom module.');
    } finally {
      setSaving(false);
    }
  };


  const keys = Object.keys(objectTypes);


  const { filteredKeys, stats } = useMemo(() => {
    let standardCount = 0;
    let customCount = 0;


    const list = keys.map((key) => {
      const obj = objectTypes[key];
      const displayName = obj?.displayName || obj?.pluralDisplayName || key;
      const { Icon, iconColor, iconBg, ringColor, badgeType } = getModuleMeta(key, obj);

      const fieldsCount = Array.isArray(obj?.fields) ? obj.fields.length : 0;


      if (badgeType === 'Custom') customCount++;
      else standardCount++;


      const layoutsCount = obj?.layouts?.length || 1;
      const validationRulesCount = obj?.validationRules?.length || (Array.isArray(obj?.fields) ? obj.fields.filter(f => f.required).length : 0);


      return {
        key,
        obj,
        displayName,
        Icon,
        iconColor,
        iconBg,
        ringColor,
        badgeType,
        fieldsCount,
        layoutsCount,
        validationRulesCount,
        updated_at: obj?.updated_at || obj?.created_at || '',
      };
    });


    let filtered = list.filter((item) => {
      if (activeFilter === 'standard') return item.badgeType === 'Standard' || item.badgeType === 'System';
      if (activeFilter === 'custom') return item.badgeType === 'Custom';
      if (activeFilter === 'recently_updated') return Boolean(item.updated_at);
      return true;
    });


    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (item) => item.displayName.toLowerCase().includes(q) || item.key.toLowerCase().includes(q)
      );
    }


    return {
      filteredKeys: filtered,
      stats: {
        totalModules: keys.length,
        standardCount,
        customCount,
      },
    };
  }, [objectTypes, keys, activeFilter, searchQuery]);


  return (
    <div className="fade-in" style={{ paddingBottom: '32px' }}>

      {/* ── Enterprise Header Bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 className="font-display" style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', margin: 0, lineHeight: 1.2, letterSpacing: '-0.02em' }}>
              Modules
            </h2>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '12px',
                background: 'rgba(99, 102, 241, 0.06)',
                color: '#4f46e5',
                border: '1px solid rgba(99, 102, 241, 0.15)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Sparkles size={11} />
              <span>{stats.totalModules} Active</span>
            </span>
          </div>
          <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '4px 0 0', lineHeight: 1.4 }}>
            Configure CRM standard modules, create custom data structures, and manage layouts.
          </p>
        </div>


        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ position: 'relative', height: '36px', display: 'flex', alignItems: 'center' }}>
            <Search size={14} style={{ position: 'absolute', left: '11px', color: '#94a3b8', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Search modules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '200px', height: '100%', padding: '0 12px 0 32px', borderRadius: '8px',
                border: '1px solid #e2e8f0', background: '#ffffff',
                fontSize: '0.8rem', color: '#0f172a', outline: 'none',
                transition: 'all 0.2s ease',
              }}
              onFocus={(e) => { e.target.style.borderColor = '#6366f1'; e.target.style.width = '240px'; }}
              onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.width = '200px'; }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute', right: '8px', border: 'none', background: 'transparent',
                  color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center',
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>


          <button
            onClick={() => loadMeta(true)}
            title="Refresh metadata"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '36px', height: '36px', borderRadius: '8px',
              border: '1px solid #e2e8f0', background: '#ffffff',
              color: '#64748b', cursor: 'pointer', transition: 'all 0.15s ease',
            }}
            onMouseOver={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#f8fafc'; }}
            onMouseOut={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#ffffff'; }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} style={{ display: 'block' }} />
          </button>


          {canCreateModule && (
            <button
              onClick={handleOpenNewModal}
              className="orbit-btn-primary"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                height: '36px', padding: '0 14px', borderRadius: '8px', fontSize: '0.8rem',
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Plus style={{ width: '15px', height: '15px', display: 'block' }} />
              <span>New Custom Module</span>
            </button>
          )}
        </div>
      </div>


      {/* ── Filter Control Bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', marginBottom: '24px', paddingBottom: '4px' }}>
        {[
          { id: 'all', label: 'All Modules', count: stats.totalModules },
          { id: 'standard', label: 'Standard', count: stats.standardCount },
          { id: 'custom', label: 'Custom', count: stats.customCount },
        ].map((tab) => {
          const isActive = activeFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                height: '30px', padding: '0 12px', borderRadius: '8px', border: 'none',
                fontSize: '0.8rem', fontWeight: isActive ? 600 : 500,
                cursor: 'pointer', whiteSpace: 'nowrap',
                background: isActive ? '#f1f5f9' : 'transparent',
                color: isActive ? '#0f172a' : '#64748b',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = '#f8fafc'; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span style={{
                  fontSize: '0.68rem', fontWeight: 600, padding: '1px 6px',
                  borderRadius: '10px', lineHeight: 1,
                  background: isActive ? '#e2e8f0' : '#f1f5f9',
                  color: isActive ? '#0f172a' : '#64748b',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>


      {/* ── Enterprise Module Cards Grid (Consistent 24px Spacing) ── */}
      {loading ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8', background: '#ffffff', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
          <Loader size={22} className="spin" style={{ color: '#6366f1', marginBottom: '12px', display: 'inline-block' }} />
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>Loading CRM Modules...</div>
        </div>
      ) : filteredKeys.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8', background: '#ffffff', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
          <Box style={{ width: '36px', height: '36px', color: '#94a3b8', marginBottom: '12px', display: 'inline-block' }} />
          <h3 style={{ margin: '0 0 4px', fontSize: '0.92rem', fontWeight: 700, color: '#0f172a' }}>No modules found</h3>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
            No modules match your current search or filter criteria.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
          {filteredKeys.map((item) => {
            const { key, displayName, Icon, iconColor, iconBg, ringColor, badgeType, fieldsCount, layoutsCount, validationRulesCount } = item;
            const isCustom = badgeType === 'Custom';
            const isMenuOpen = openMenuKey === key;
            const isHovered = hoveredKey === key;
            const isActive = activeKey === key;


            return (
              <div
                key={key}
                onClick={() => onSelectObject && onSelectObject(key)}
                onMouseEnter={() => setHoveredKey(key)}
                onMouseLeave={() => {
                  setHoveredKey(null);
                  setActiveKey(null);
                }}
                onMouseDown={() => setActiveKey(key)}
                onMouseUp={() => setActiveKey(null)}
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid',
                  borderColor: isHovered ? '#6366f1' : '#f1f5f9',
                  padding: '18px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justify: 'space-between',
                  minHeight: '120px',
                  height: '100%',
                  position: 'relative',
                  boxShadow: isHovered
                    ? '0 20px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.03)'
                    : '0 4px 18px rgba(15, 23, 42, 0.03), 0 1px 3px rgba(15, 23, 42, 0.02)',
                  transform: isHovered
                    ? (isActive ? 'translateY(-4px) scale(0.985)' : 'translateY(-4px)')
                    : (isActive ? 'scale(0.985)' : 'translateY(0)'),
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                {/* ── Top Row (Icon, Title, API, Badge) ── */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '10px',
                          background: iconBg,
                          color: iconColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          boxShadow: isHovered ? `inset 0 0 0 1px ${iconColor}, 0 0 12px ${iconColor}20` : `inset 0 0 0 1px ${ringColor}`,
                          transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                      >
                        <Icon size={18} style={{ display: 'block' }} />
                      </div>


                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <h3
                          style={{
                            margin: 0,
                            fontSize: '0.94rem',
                            fontWeight: 600,
                            color: '#0f172a',
                            lineHeight: 1.25,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {displayName}
                        </h3>
                        <span className="font-mono" style={{ fontSize: '0.72rem', color: '#64748b', lineHeight: 1.25, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {key}
                        </span>
                      </div>
                    </div>


                    {/* Badge */}
                    <span
                      style={{
                        fontSize: '0.62rem',
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        letterSpacing: '0.03em',
                        textTransform: 'uppercase',
                        flexShrink: 0,
                        lineHeight: 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justify: 'center',
                        background: badgeType === 'Custom' ? '#f5f3ff' : badgeType === 'System' ? '#f8fafc' : '#eff6ff',
                        color: badgeType === 'Custom' ? '#7c3aed' : badgeType === 'System' ? '#64748b' : '#2563eb',
                        border: `1px solid ${badgeType === 'Custom' ? (isHovered ? '#7c3aed' : '#ddd6fe') : badgeType === 'System' ? (isHovered ? '#64748b' : '#e2e8f0') : (isHovered ? '#2563eb' : '#bfdbfe')}`,
                        transform: isHovered ? 'scale(1.02)' : 'scale(1)',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                    >
                      {badgeType}
                    </span>
                  </div>
                </div>

                {/* ── Bottom Row (Primary Button & Overflow) ── */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'space-between',
                    gap: '8px',
                    marginTop: '16px',
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      height: '32px',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      background: isHovered ? '#f8fafc' : '#ffffff',
                      color: isHovered ? '#0f172a' : '#334155',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                      borderColor: isHovered ? '#cbd5e1' : '#e2e8f0',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>Manage Fields</span>
                    <ChevronRight size={13} style={{ display: 'block' }} />
                  </div>


                  {/* Dropdown Menu for Custom modules only */}
                  {isCustom && (
                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuKey(isMenuOpen ? null : key);
                        }}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          background: '#ffffff',
                          color: '#64748b',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = '#f8fafc';
                          e.currentTarget.style.borderColor = '#cbd5e1';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = '#ffffff';
                          e.currentTarget.style.borderColor = '#e2e8f0';
                        }}
                      >
                        <MoreHorizontal size={14} />
                      </button>


                      {isMenuOpen && (
                        <div
                          style={{
                            position: 'absolute',
                            right: 0,
                            bottom: '100%',
                            marginBottom: '6px',
                            width: '130px',
                            background: '#ffffff',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 10px 25px -5px rgba(15, 19, 48, 0.12)',
                            padding: '4px',
                            zIndex: 100,
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuKey(null);
                              setEditCustomModule({ key, displayName, description: item.obj?.description || '' });
                            }}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 8px',
                              borderRadius: '5px',
                              border: 'none',
                              background: 'transparent',
                              color: '#1c2033',
                              fontSize: '0.74rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <Pencil size={12} style={{ color: '#7c3aed' }} />
                            <span>Edit Module</span>
                          </button>


                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuKey(null);
                              setDeleteConfirmModule({ key, displayName });
                            }}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 8px',
                              borderRadius: '5px',
                              border: 'none',
                              background: 'transparent',
                              color: '#e11d48',
                              fontSize: '0.74rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = '#fff1f2'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <Trash2 size={12} style={{ color: '#e11d48' }} />
                            <span>Delete Module</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>


              </div>
            );
          })}
        </div>
      )}


      {/* ── DELETE CONFIRMATION MODAL ── */}
      {deleteConfirmModule && createPortal(
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: 'rgba(15,19,48,0.55)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px 16px', animation: 'fadeIn 0.2s ease',
          }}
          onClick={() => setDeleteConfirmModule(null)}
        >
          <div
            style={{
              width: '100%', maxWidth: 420, borderRadius: 14, padding: '22px 24px',
              background: '#ffffff', boxShadow: '0 24px 60px -12px rgba(15,19,48,0.25)',
              position: 'relative', animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setDeleteConfirmModule(null)}
              style={{
                position: 'absolute', top: 14, right: 14, width: 26, height: 26,
                borderRadius: 6, border: 'none', background: '#f1f5f9', color: '#64748b',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={14} />
            </button>


            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fff1f2', color: '#e11d48', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={18} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#1c2033' }}>
                  Delete {deleteConfirmModule.displayName}?
                </h3>
                <span className="font-mono" style={{ fontSize: '0.7rem', color: '#8990ac' }}>{deleteConfirmModule.key}</span>
              </div>
            </div>


            <p style={{ fontSize: '0.82rem', color: '#4b5170', margin: '0 0 18px', lineHeight: 1.4 }}>
              Are you sure you want to delete custom module <strong>{deleteConfirmModule.displayName}</strong>? This action cannot be undone.
            </p>


            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmModule(null)}
                style={{
                  padding: '7px 14px', borderRadius: 7, border: '1px solid #cbd5e1',
                  background: 'transparent', color: '#475569', fontSize: '0.8rem',
                  fontWeight: 600, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!deleteConfirmModule?.key) return;
                  try {
                    const modKey = deleteConfirmModule.key;
                    const modName = deleteConfirmModule.displayName;
                    setDeleteConfirmModule(null);
                    await apiDelete(`/metadata/objects/${modKey}`);
                    await loadMeta(true);
                    setToastMessage(`Custom Module "${modName}" deleted successfully!`);
                    setTimeout(() => setToastMessage(null), 3500);
                  } catch (err) {
                    console.error('Delete module error:', err);
                    alert(err?.message || err?.error || 'Failed to delete custom module.');
                  }
                }}
                style={{
                  padding: '7px 16px', borderRadius: 7, border: 'none',
                  background: '#e11d48', color: '#ffffff', fontSize: '0.8rem',
                  fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(225,29,72,0.3)',
                }}
              >
                Delete Custom Module
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}


      {/* ── EDIT CUSTOM MODULE MODAL ── */}
      {editCustomModule && createPortal(
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: 'rgba(15,19,48,0.55)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px 16px', animation: 'fadeIn 0.2s ease',
          }}
          onClick={() => setEditCustomModule(null)}
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
              onClick={() => setEditCustomModule(null)}
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
                <Pencil size={17} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#1c2033' }}>
                  Edit {editCustomModule.displayName}
                </h3>
                <span className="font-mono" style={{ fontSize: '0.7rem', color: '#8990ac' }}>{editCustomModule.key}</span>
              </div>
            </div>


            <form onSubmit={async (e) => {
              e.preventDefault();
              setEditCustomModule(null);
              await loadMeta(true);
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#1c2033', marginBottom: 4 }}>
                    Module Display Name
                  </label>
                  <input
                    type="text"
                    defaultValue={editCustomModule.displayName}
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
                    defaultValue={editCustomModule.description}
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
                  onClick={() => setEditCustomModule(null)}
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


      {/* ── NEW CUSTOM MODULE MODAL (PORTAL TO DOCUMENT.BODY) ── */}
      {isModalOpen && createPortal(
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: 'rgba(15,19,48,0.55)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px 16px', overflowY: 'auto',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <div
            style={{
              width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto',
              borderRadius: 16, padding: '24px 28px 20px', position: 'relative',
              background: '#ffffff',
              boxShadow: '0 24px 60px -12px rgba(15,19,48,0.25), 0 0 0 1px rgba(0,0,0,0.06)',
              animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Close button */}
            <button
              onClick={() => !saving && setIsModalOpen(false)}
              style={{
                position: 'absolute', top: 16, right: 16,
                width: 26, height: 26, borderRadius: 6,
                border: 'none', background: 'rgba(139,148,185,0.12)',
                color: '#64748b', cursor: saving ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 10,
              }}
            >
              <X size={14} />
            </button>


            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(168,85,247,0.1)', color: '#a855f7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Layers size={18} />
              </div>
              <div style={{ flex: 1, paddingRight: 20 }}>
                <h3 className="font-display" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#1c2033', lineHeight: 1.2 }}>
                  Create Custom Module
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Define a new custom CRM object, record structure, and permissions.
                </p>
              </div>
            </div>


            {errorMsg && (
              <div style={{ marginBottom: 14, padding: '9px 12px', borderRadius: 7, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: '0.8rem' }}>
                {errorMsg}
              </div>
            )}


            <form onSubmit={handleCreateObject}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>


                {/* Singular & Plural Labels */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#1c2033', marginBottom: 4 }}>
                      Label (Singular) *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Invoice, Ticket"
                      value={label}
                      onChange={handleLabelChange}
                      required
                      style={{
                        width: '100%', padding: '8px 10px', borderRadius: 7,
                        border: '1px solid #cbd5e1', background: '#ffffff',
                        fontSize: '0.84rem', color: '#1c2033', outline: 'none',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#1c2033', marginBottom: 4 }}>
                      Plural Label *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Invoices, Tickets"
                      value={pluralLabel}
                      onChange={(e) => {
                        setPluralLabel(e.target.value);
                        setIsPluralAutofilled(false);
                      }}
                      required
                      style={{
                        width: '100%', padding: '8px 10px', borderRadius: 7,
                        border: '1px solid #cbd5e1', background: '#ffffff',
                        fontSize: '0.84rem', color: '#1c2033', outline: 'none',
                      }}
                    />
                  </div>
                </div>


                {/* Module API Name */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#1c2033', marginBottom: 4 }}>
                    Module API Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. invoice__c"
                    value={apiName}
                    onChange={(e) => setApiName(e.target.value)}
                    required
                    className="font-mono"
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 7,
                      border: '1px solid #c7d2fe', background: '#f5f3ff',
                      fontSize: '0.82rem', color: '#6366f1', outline: 'none', fontWeight: 600,
                    }}
                  />
                  <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 3 }}>
                    Custom modules automatically end with <code style={{ color: '#a855f7', fontWeight: 700 }}>__c</code>.
                  </div>
                </div>


                {/* Description */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#1c2033', marginBottom: 4 }}>
                    Description
                  </label>
                  <textarea
                    placeholder="Briefly describe what this custom module tracks..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    style={{
                      width: '100%', padding: '7px 10px', borderRadius: 7,
                      border: '1px solid #cbd5e1', background: '#ffffff',
                      fontSize: '0.82rem', color: '#1c2033', outline: 'none', resize: 'vertical',
                    }}
                  />
                </div>


                {/* Primary Record Name Field */}
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12, marginTop: 2 }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#1c2033', marginBottom: 6 }}>
                    Primary Record Name Field
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: 10 }}>
                    <div>
                      <input
                        type="text"
                        placeholder="Name field label (e.g. Invoice Name)"
                        value={recordNameLabel}
                        onChange={(e) => {
                          setRecordNameLabel(e.target.value);
                          setIsRecordNameAutofilled(false);
                        }}
                        style={{
                          width: '100%', padding: '8px 10px', borderRadius: 7,
                          border: '1px solid #cbd5e1', background: '#ffffff',
                          fontSize: '0.82rem', color: '#1c2033', outline: 'none',
                        }}
                      />
                    </div>
                    <div>
                      <select
                        value={recordNameType}
                        onChange={(e) => setRecordNameType(e.target.value)}
                        style={{
                          width: '100%', padding: '8px 10px', borderRadius: 7,
                          border: '1px solid #cbd5e1', background: '#ffffff',
                          fontSize: '0.82rem', color: '#1c2033', outline: 'none',
                        }}
                      >
                        <option value="text">Text</option>
                        <option value="number">Auto-Number</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 6, lineHeight: 1.3 }}>
                    {recordNameType === 'text' ? (
                      <span><strong>Text:</strong> Users manually enter the record identifier (e.g., "Acme Corp", "Deal 100"). Label this on the left (e.g., <code>{label ? `${label} Name` : 'Name'}</code>).</span>
                    ) : (
                      <span><strong>Auto-Number:</strong> System automatically generates sequential numbers (e.g., #001, #002) for new records. Label this on the left (e.g., <code>{label ? `${label} Number` : 'Number'}</code>).</span>
                    )}
                  </div>
                </div>


              </div>


              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: '1px solid #cbd5e1',
                    background: 'transparent', color: '#475569', fontSize: '0.82rem',
                    fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="orbit-btn-primary"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 18px', borderRadius: 8, fontSize: '0.82rem',
                    fontWeight: 700, cursor: saving ? 'wait' : 'pointer',
                  }}
                >
                  {saving ? (
                    <>
                      <Loader size={14} className="spin" />
                      Creating Object...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={14} />
                      Save Custom Module
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Success Toast Pop Out Banner */}
      {toastMessage && createPortal(
        <div style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 999999,
          background: '#ffffff',
          color: '#065f46',
          padding: '12px 20px',
          borderRadius: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          boxShadow: '0 20px 40px -10px rgba(16, 185, 129, 0.25), 0 8px 16px -4px rgba(0, 0, 0, 0.08)',
          border: '1px solid #a7f3d0',
          fontSize: '0.88rem',
          fontWeight: 600,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          <div style={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: '#d1fae5',
            color: '#059669',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <CheckCircle size={16} />
          </div>
          <span>{toastMessage}</span>
        </div>,
        document.body
      )}
    </div>
  );
}


export default ObjectManager;



