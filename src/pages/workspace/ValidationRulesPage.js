import React, { useState, useEffect, useContext } from 'react';
import WorkspaceContext from '../../context/WorkspaceContext';
import api from '../../api';
import { Plus, Trash2, Edit3, ShieldAlert, Check, X, Filter, ChevronDown, ArrowLeft, Lock, RotateCcw, Sliders } from 'lucide-react';

/* ── Canonical System Rule Keys (for detecting tenant overrides) ── */
const CANONICAL_SYSTEM_RULE_KEYS = new Set([
  'lead_company_required_for_qualified_lead',
  'lead_valid_email_format',
  'deal_positive_amount_required',
  'deal_discount_percentage_range',
  'deal_loss_reason_required_on_closed_lost',
  'contact_birth_date_past_only',
]);

/* ── Operator Options ── */
const OPERATORS = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'not equals' },
  { value: 'is_blank', label: 'is_blank' },
  { value: 'is_not_blank', label: 'is_not_blank' },
  { value: 'contains', label: 'contains' },
  { value: 'does_not_contain', label: 'does not contain' },
  { value: 'greater_than', label: 'greater than' },
  { value: 'less_than', label: 'less than' },
  { value: 'regex', label: 'matches regex' },
  { value: 'date_future', label: 'is date in future' },
  { value: 'date_past', label: 'is date in past' },
];

function ValidationRulesPage({ initialObject }) {
  const workspaceContext = useContext(WorkspaceContext);
  const objectTypes = workspaceContext?.objectTypes || {};

  /* ── Page Mode: 'list' | 'builder' ── */
  const [viewMode, setViewMode] = useState('list');
  const [selectedObject, setSelectedObject] = useState(initialObject || 'lead');

  /* ── Data States ── */
  const [objectList, setObjectList] = useState([]);
  const [rules, setRules] = useState([]);
  const [fields, setFields] = useState([]);
  const [loadingRules, setLoadingRules] = useState(true);
  const [loadingFields, setLoadingFields] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [savingRule, setSavingRule] = useState(false);

  /* ── Rule Builder Form State ── */
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [overrideRuleKey, setOverrideRuleKey] = useState(null);
  const [ruleName, setRuleName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [conditionGroups, setConditionGroups] = useState([]);

  /* ── Fetch Object Definitions from API ── */
  useEffect(() => {
    let isMounted = true;
    api.get('/metadata/objects')
      .catch(() => api.get('/objects'))
      .then((res) => {
        if (!isMounted) return;
        const list = Array.isArray(res) ? res : (res?.data || []);
        if (list.length > 0) {
          setObjectList(list);
        }
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, []);

  /* ── Available Objects for Dropdown ── */
  const availableObjects = React.useMemo(() => {
    if (objectList.length > 0) {
      return objectList.map((obj) => {
        const key = obj.api_name || obj.id || obj.name;
        const displayName = obj.display_name || obj.displayName || key;
        return {
          key,
          label: `${displayName} (${key})`,
          displayName,
        };
      });
    }

    if (Object.keys(objectTypes || {}).length > 0) {
      return Object.entries(objectTypes).map(([key, obj]) => ({
        key,
        label: `${obj.displayName || key} (${key})`,
        displayName: obj.displayName || key,
      }));
    }

    return [
      { key: 'lead', label: 'Lead (lead)', displayName: 'Lead' },
      { key: 'company', label: 'Company (company)', displayName: 'Company' },
      { key: 'contact', label: 'Contact (contact)', displayName: 'Contact' },
      { key: 'deal', label: 'Deal (deal)', displayName: 'Deal' },
    ];
  }, [objectList, objectTypes]);

  const currentObjMeta = availableObjects.find((o) => o.key === selectedObject) || availableObjects[0] || { displayName: selectedObject };

  /* ── Fetch Rules for Selected Object ── */
  const fetchRulesForObject = React.useCallback(() => {
    setLoadingRules(true);
    api.get(`/validation-rules?object_name=${selectedObject}`)
      .then((res) => {
        setRules(Array.isArray(res) ? res : res?.data || []);
      })
      .catch(() => {
        setRules([]);
      })
      .finally(() => {
        setLoadingRules(false);
      });
  }, [selectedObject]);

  useEffect(() => {
    fetchRulesForObject();
  }, [fetchRulesForObject]);

  /* ── Fetch Object Fields Metadata for Condition Dropdown ── */
  useEffect(() => {
    let isMounted = true;
    setLoadingFields(true);
    api.get(`/metadata/objects/${selectedObject}/fields`)
      .catch(() => api.get(`/objects/${selectedObject}/fields`))
      .then((res) => {
        if (!isMounted) return;
        const fieldList = Array.isArray(res) ? res : res?.data || [];
        if (fieldList.length > 0) {
          setFields(fieldList);
        }
      })
      .finally(() => {
        if (isMounted) setLoadingFields(false);
      });
    return () => { isMounted = false; };
  }, [selectedObject]);

  /* ── Open Builder for New Rule ── */
  const handleOpenNewRule = () => {
    setEditingRuleId(null);
    setOverrideRuleKey(null);
    setRuleName('');
    setErrorMessage('');
    setIsActive(true);
    setConditionGroups([]);
    setSubmitError(null);
    setViewMode('builder');
  };

  /* ── Open Builder for Edit Rule ── */
  const handleOpenEditRule = (rule) => {
    setEditingRuleId(rule.id);
    setOverrideRuleKey(null);
    setRuleName(rule.rule_name || '');
    setErrorMessage(rule.error_message || '');
    setIsActive(rule.is_active !== undefined ? rule.is_active : true);
    setConditionGroups(rule.condition_groups || []);
    setSubmitError(null);
    setViewMode('builder');
  };

  /* ── Open Builder for Customizing System Rule ── */
  const handleOpenCustomizeRule = (rule) => {
    setEditingRuleId(null);
    setOverrideRuleKey(rule.rule_key);
    setRuleName(rule.rule_name || '');
    setErrorMessage(rule.error_message || '');
    setIsActive(rule.is_active !== undefined ? rule.is_active : true);
    setConditionGroups(rule.condition_groups || []);
    setSubmitError(null);
    setViewMode('builder');
  };

  /* ── Toggle Active Switch in List View ── */
  const handleToggleRule = async (ruleId, currentStatus) => {
    const nextStatus = !currentStatus;
    setRules((prev) => prev.map((r) => (r.id === ruleId ? { ...r, is_active: nextStatus } : r)));

    try {
      await api.put(`/validation-rules/${ruleId}`, { is_active: nextStatus }).catch(() =>
        api.post(`/validation-rules/${ruleId}/toggle`, { is_active: nextStatus })
      );
    } catch (err) {
      console.error('Failed to toggle rule active state:', err);
      // Revert local state on error
      setRules((prev) => prev.map((r) => (r.id === ruleId ? { ...r, is_active: currentStatus } : r)));
    }
  };

  /* ── Delete Rule (Only updates state on successful API response) ── */
  const handleDeleteRule = async (ruleId) => {
    if (!window.confirm('Are you sure you want to delete this validation rule?')) return;
    try {
      await api.delete(`/validation-rules/${ruleId}`);
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
    } catch (err) {
      console.error('Failed to delete validation rule:', err);
      setSubmitError(err.response?.data?.message || err.message || 'Failed to delete validation rule.');
    }
  };

  /* ── Reset Override to Default (Deletes override & re-fetches system rule) ── */
  const handleResetToDefault = async (overrideRuleId) => {
    if (!window.confirm('Reset this rule to system default? Your customizations will be removed.')) return;
    try {
      await api.delete(`/validation-rules/${overrideRuleId}`);
      // Re-fetch from backend so system default rule resurfaces naturally
      fetchRulesForObject();
    } catch (err) {
      console.error('Failed to reset validation rule to default:', err);
      setSubmitError(err.response?.data?.message || err.message || 'Failed to reset rule to default.');
    }
  };

  /* ── Condition Group Helper Functions ── */
  const handleAddGroup = () => {
    setConditionGroups((prev) => [
      ...prev,
      {
        group_order: prev.length + 1,
        group_logic: 'OR',
        conditions: [
          {
            field_name: fields[0]?.name || 'name',
            operator: 'equals',
            value: '',
            row_logic: 'AND',
          },
        ],
      },
    ]);
  };

  const handleDeleteGroup = (groupIndex) => {
    setConditionGroups((prev) => prev.filter((_, idx) => idx !== groupIndex));
  };

  const handleAddCondition = (groupIndex) => {
    setConditionGroups((prev) => {
      const copy = [...prev];
      const grp = { ...copy[groupIndex] };
      grp.conditions = [
        ...(grp.conditions || []),
        {
          field_name: fields[0]?.name || 'name',
          operator: 'equals',
          value: '',
          row_logic: 'AND',
        },
      ];
      copy[groupIndex] = grp;
      return copy;
    });
  };

  const handleDeleteCondition = (groupIndex, condIndex) => {
    setConditionGroups((prev) => {
      const copy = [...prev];
      const grp = { ...copy[groupIndex] };
      grp.conditions = grp.conditions.filter((_, idx) => idx !== condIndex);
      copy[groupIndex] = grp;
      return copy;
    });
  };

  const handleUpdateCondition = (groupIndex, condIndex, key, val) => {
    setConditionGroups((prev) => {
      const copy = [...prev];
      const grp = { ...copy[groupIndex] };
      const conds = [...grp.conditions];
      conds[condIndex] = { ...conds[condIndex], [key]: val };
      grp.conditions = conds;
      copy[groupIndex] = grp;
      return copy;
    });
  };

  const handleUpdateGroupLogic = (groupIndex, logicVal) => {
    setConditionGroups((prev) => {
      const copy = [...prev];
      copy[groupIndex] = { ...copy[groupIndex], group_logic: logicVal };
      return copy;
    });
  };

  /* ── Generate Live Human-Readable Logic Preview String ── */
  const generateLogicPreview = () => {
    if (!conditionGroups || conditionGroups.length === 0) {
      return 'Rule fires on every save (unconditional)';
    }

    const groupStrings = conditionGroups.map((grp, gIdx) => {
      const conds = grp.conditions || [];
      if (conds.length === 0) return 'empty group';

      const condStr = conds
        .map((c, cIdx) => {
          const fLabel = fields.find((f) => f.name === c.field_name)?.label || c.field_name || '?';
          const opLabel = c.operator || 'equals';
          const valLabel = c.value !== '' && c.value !== undefined ? `"${c.value}"` : '""';
          const prefix = cIdx > 0 ? ` ${c.row_logic || 'AND'} ` : '';
          return `${prefix}${fLabel} ${opLabel} ${valLabel}`;
        })
        .join('');

      const gPrefix = gIdx > 0 ? ` ${grp.group_logic || 'OR'} ` : '';
      return `${gPrefix}(${condStr})`;
    });

    return `IF ${groupStrings.join('')} → VALIDATE`;
  };

  /* ── Generate "Fires when" Pill Summary for List Cards ── */
  const renderFiresWhenSummary = (rule) => {
    const grps = rule.condition_groups || [];
    if (!grps || grps.length === 0) return <span style={{ color: '#64748B' }}>Fires on every save</span>;

    const firstCond = grps[0]?.conditions?.[0];
    if (!firstCond) return <span style={{ color: '#64748B' }}>Fires on every save</span>;

    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#475569' }}>
        Fires when:
        <code style={{
          backgroundColor: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '6px',
          padding: '2px 8px', color: '#0F172A', fontWeight: 600, fontSize: '0.75rem',
        }}>
          {firstCond.field_name} {firstCond.operator} "{firstCond.value || 'null'}"
        </code>
      </span>
    );
  };

  /* ── Save Rule Submit Handler ── */
  const handleSaveRule = async (e) => {
    e.preventDefault();
    setSubmitError(null);

    if (!ruleName.trim()) {
      setSubmitError('Rule Name is required.');
      return;
    }
    if (!errorMessage.trim()) {
      setSubmitError('Error Message is required.');
      return;
    }

    setSavingRule(true);
    const payload = {
      object_name: selectedObject,
      rule_name: ruleName.trim(),
      error_message: errorMessage.trim(),
      is_active: isActive,
      condition_groups: conditionGroups,
    };

    if (overrideRuleKey && !editingRuleId) {
      payload.rule_key = overrideRuleKey;
    }

    try {
      if (editingRuleId) {
        const res = await api.put(`/validation-rules/${editingRuleId}`, payload);
        const updated = res?.data || res;
        setRules((prev) => prev.map((r) => (r.id === editingRuleId ? updated : r)));
      } else {
        const res = await api.post('/validation-rules', payload);
        const created = res?.data || res;
        setRules((prev) => [created, ...prev]);
      }
      setViewMode('list');
    } catch (err) {
      console.error('Failed to save validation rule:', err);
      setSubmitError(err.message || 'Failed to save validation rule to backend.');
    } finally {
      setSavingRule(false);
    }
  };

  return (
    <div className="fade-in">

      {/* ── Top Header Toolbar ────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>
            Validation Rules
          </h1>
          <p style={{ margin: 0, fontSize: '0.84rem', color: '#64748B', fontWeight: 500 }}>
            Define and manage field validation rules per object
          </p>
        </div>

        {viewMode === 'list' && (
          <button
            type="button"
            onClick={handleOpenNewRule}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 20px',
              fontSize: '0.84rem', fontWeight: 700, color: '#ffffff',
              backgroundColor: '#06b6d4', border: 'none', borderRadius: '10px',
              cursor: 'pointer', boxShadow: '0 4px 12px rgba(6, 182, 212, 0.2)',
              transition: 'all 0.2s cubic-bezier(0.22,1,0.36,1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#0891b2';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#06b6d4';
            }}
          >
            <Plus style={{ width: 16, height: 16 }} /> New Rule
          </button>
        )}
      </div>

      {/* ── Object Selector Card Header ───────────────── */}
      <div
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.72)',
          backdropFilter: 'blur(20px)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.85)',
          padding: '16px 24px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 700, color: '#1E293B' }}>
            <Filter style={{ width: 16, height: 16, color: '#6366f1' }} />
            Select Object
          </div>

          <div style={{ position: 'relative' }}>
            <select
              value={selectedObject}
              onChange={(e) => setSelectedObject(e.target.value)}
              style={{
                height: '40px',
                padding: '0 36px 0 14px',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#4f46e5',
                backgroundColor: 'rgba(99, 102, 241, 0.04)',
                border: '1.5px solid rgba(99, 102, 241, 0.25)',
                borderRadius: '10px',
                outline: 'none',
                appearance: 'none',
                cursor: 'pointer',
              }}
            >
              {availableObjects.map((obj) => (
                <option key={obj.key} value={obj.key}>{obj.label}</option>
              ))}
            </select>
            <ChevronDown style={{ width: 14, height: 14, color: '#4f46e5', position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>

          <span style={{ fontSize: '0.78rem', color: '#64748B', backgroundColor: '#F8FAFC', padding: '4px 10px', borderRadius: '8px', border: '1px solid #E2E8F0', fontWeight: 600 }}>
            📁 {fields.length} fields
          </span>
          <span style={{ fontSize: '0.78rem', color: '#0891b2', backgroundColor: 'rgba(6, 182, 212, 0.12)', padding: '4px 10px', borderRadius: '8px', fontWeight: 700 }}>
            Deployed
          </span>
          <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}>
            {rules.length} rules
          </span>
        </div>
      </div>

      {/* LIST VIEW */}
      {viewMode === 'list' && (
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.72)', backdropFilter: 'blur(20px)', borderRadius: '18px', border: '1px solid rgba(255, 255, 255, 0.85)',
          padding: '28px 32px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
        }}>
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ margin: '0 0 4px', fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>
              Rules for <span style={{ color: '#4f46e5' }}>{currentObjMeta.displayName}</span>
            </h2>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B' }}>
              Rules are evaluated in order when a record is saved.
            </p>
          </div>

          {loadingRules ? (
            <div style={{ padding: '48px 0', textAlign: 'center', color: '#94A3B8', fontSize: '0.875rem' }}>
              Loading validation rules…
            </div>
          ) : rules.length === 0 ? (
            <div style={{
              padding: '48px 24px', textAlign: 'center', backgroundColor: '#F8FAFC',
              border: '1.5px dashed #CBD5E1', borderRadius: '14px', color: '#64748B',
            }}>
              <ShieldAlert style={{ width: 32, height: 32, color: '#94A3B8', marginBottom: '8px' }} />
              <p style={{ margin: '0 0 12px', fontWeight: 600, fontSize: '0.9rem' }}>No validation rules configured for {currentObjMeta.displayName}.</p>
              <button
                type="button"
                onClick={handleOpenNewRule}
                style={{
                  padding: '8px 16px', fontSize: '0.82rem', fontWeight: 700, color: '#06b6d4',
                  backgroundColor: 'rgba(6, 182, 212, 0.08)', border: '1px solid rgba(6, 182, 212, 0.25)', borderRadius: '8px', cursor: 'pointer',
                }}
              >
                + Create First Validation Rule
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {rules.map((rule) => {
                const isSystemRule = rule.organization_id === null;
                const isOverrideRule =
                  rule.organization_id !== null &&
                  CANONICAL_SYSTEM_RULE_KEYS.has(rule.rule_key);
                const isCustomRule =
                  rule.organization_id !== null &&
                  !CANONICAL_SYSTEM_RULE_KEYS.has(rule.rule_key);

                return (
                  <div
                    key={rule.id}
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.65)',
                      backdropFilter: 'blur(12px)',
                      border: '1px solid rgba(255, 255, 255, 0.8)',
                      borderRadius: '14px',
                      padding: '20px 24px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {/* Top Row: Indicator + Name + Badges + Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span style={{
                          width: '8px', height: '8px', borderRadius: '50%',
                          backgroundColor: rule.is_active ? (isSystemRule ? '#06b6d4' : isOverrideRule ? '#6366f1' : '#10b981') : '#94A3B8',
                          boxShadow: rule.is_active ? (isSystemRule ? '0 0 8px #06b6d4' : isOverrideRule ? '0 0 8px #6366f1' : '0 0 8px #10b981') : 'none',
                        }} />
                        <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.01em' }}>
                          {rule.rule_name}
                        </span>

                        {isSystemRule && (
                          <span style={{
                            fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px',
                            backgroundColor: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0',
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                          }}>
                            <Lock style={{ width: 10, height: 10 }} /> System Default
                          </span>
                        )}

                        {isOverrideRule && (
                          <span style={{
                            fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px',
                            backgroundColor: '#EEF2FF', color: '#4F46E5', border: '1px solid #C7D2FE',
                          }}>
                            Customized Override
                          </span>
                        )}

                        {isCustomRule && (
                          <span style={{
                            fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px',
                            backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0',
                          }}>
                            Custom Rule
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {isSystemRule ? (
                          <button
                            type="button"
                            onClick={() => handleOpenCustomizeRule(rule)}
                            style={{
                              padding: '6px 14px', fontSize: '0.78rem', fontWeight: 700, color: '#0891b2',
                              backgroundColor: 'rgba(6, 182, 212, 0.08)', border: '1px solid rgba(6, 182, 212, 0.25)',
                              borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px',
                            }}
                          >
                            <Sliders style={{ width: 13, height: 13 }} /> Customize
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleToggleRule(rule.id, rule.is_active)}
                              style={{
                                width: '40px', height: '22px', borderRadius: '12px',
                                backgroundColor: rule.is_active ? '#06b6d4' : '#CBD5E1',
                                border: 'none', padding: '2px', cursor: 'pointer',
                                transition: 'background-color 0.2s', position: 'relative',
                              }}
                            >
                              <div style={{
                                width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#ffffff',
                                transform: rule.is_active ? 'translateX(18px)' : 'translateX(0)',
                                transition: 'transform 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                              }} />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenEditRule(rule)}
                              title="Edit Validation Rule"
                              style={{
                                width: '32px', height: '32px', borderRadius: '8px',
                                border: '1px solid #E2E8F0', backgroundColor: '#ffffff',
                                color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                              }}
                            >
                              <Edit3 style={{ width: 14, height: 14 }} />
                            </button>

                            {isOverrideRule ? (
                              <button
                                type="button"
                                onClick={() => handleResetToDefault(rule.id)}
                                title="Reset to System Default"
                                style={{
                                  padding: '6px 12px', fontSize: '0.75rem', fontWeight: 700, color: '#4F46E5',
                                  backgroundColor: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: '8px',
                                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px',
                                }}
                              >
                                <RotateCcw style={{ width: 13, height: 13 }} /> Reset to Default
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleDeleteRule(rule.id)}
                                title="Delete Validation Rule"
                                style={{
                                  width: '32px', height: '32px', borderRadius: '8px',
                                  border: '1px solid #FECACA', backgroundColor: '#FEF2F2',
                                  color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                }}
                              >
                                <Trash2 style={{ width: 14, height: 14 }} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Error Message */}
                    <div style={{ fontSize: '0.84rem', color: '#DC2626', fontWeight: 500, marginBottom: '8px', paddingLeft: '18px' }}>
                      "{rule.error_message}"
                    </div>

                    {/* Fires When Summary Badge */}
                    <div style={{ paddingLeft: '18px' }}>
                      {renderFiresWhenSummary(rule)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* BUILDER / EDIT VIEW */}
      {viewMode === 'builder' && (
        <form onSubmit={handleSaveRule} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              style={{
                background: 'none', border: 'none', color: '#4f46e5', fontSize: '0.84rem',
                fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: 0,
              }}
            >
              <ArrowLeft style={{ width: 14, height: 14 }} /> Back to Validation Rules
            </button>
          </div>

          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>
              {editingRuleId ? 'Edit Validation Rule' : overrideRuleKey ? 'Customize System Rule' : 'New Validation Rule'}
            </h2>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748B' }}>
              {overrideRuleKey
                ? `Creating an organization override for system rule [${overrideRuleKey}]. Your changes will replace the default system behavior for your organization.`
                : 'Define when this rule fires and what error to show. Add condition groups to make it conditional.'}
            </p>
          </div>

          {submitError && (
            <div style={{
              padding: '12px 18px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA',
              borderRadius: '10px', color: '#DC2626', fontSize: '0.84rem', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <ShieldAlert style={{ width: 16, height: 16 }} /> {submitError}
            </div>
          )}

          {/* Rule Definition Card */}
          <div style={{
            backgroundColor: '#ffffff', border: '1px solid #E2E8F0', borderRadius: '16px',
            padding: '28px 32px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '0.9rem', fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Rule Definition
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                  Rule Name <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Amount required for Closed Won"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  style={{
                    width: '100%', height: '44px', padding: '0 14px', fontSize: '0.875rem',
                    color: '#0F172A', backgroundColor: '#ffffff', border: '1.5px solid #E2E8F0',
                    borderRadius: '10px', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                  Error Message <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Message shown to the user when this validation fails..."
                  value={errorMessage}
                  onChange={(e) => setErrorMessage(e.target.value)}
                  style={{
                    width: '100%', height: '44px', padding: '0 14px', fontSize: '0.875rem',
                    color: '#0F172A', backgroundColor: '#ffffff', border: '1.5px solid #E2E8F0',
                    borderRadius: '10px', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  style={{
                    width: '40px', height: '22px', borderRadius: '12px',
                    backgroundColor: isActive ? '#06b6d4' : '#CBD5E1',
                    border: 'none', padding: '2px', cursor: 'pointer',
                    transition: 'background-color 0.2s', position: 'relative',
                  }}
                >
                  <div style={{
                    width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#ffffff',
                    transform: isActive ? 'translateX(18px)' : 'translateX(0)',
                    transition: 'transform 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                  }} />
                </button>
                <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#475569' }}>
                  Active — rule will run on every save
                </span>
              </div>
            </div>
          </div>

          {/* Condition Groups Card */}
          <div style={{
            backgroundColor: '#ffffff', border: '1px solid #E2E8F0', borderRadius: '16px',
            padding: '28px 32px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '0.9rem', fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Condition Groups
                </h3>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748B' }}>
                  Leave empty to always fire. Conditions within a group use row <strong>AND / OR</strong>. Groups are joined by group <strong>AND / OR</strong>.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddGroup}
                style={{
                  padding: '8px 16px', fontSize: '0.8rem', fontWeight: 700, color: '#475569',
                  backgroundColor: '#F8FAFC', border: '1.5px solid #CBD5E1', borderRadius: '8px', cursor: 'pointer',
                }}
              >
                + Add Group
              </button>
            </div>

            {conditionGroups.length === 0 ? (
              <div style={{
                padding: '40px 24px', textAlign: 'center', backgroundColor: '#F8FAFC',
                border: '1.5px dashed #E2E8F0', borderRadius: '12px', color: '#64748B',
              }}>
                <Filter style={{ width: 24, height: 24, color: '#94A3B8', marginBottom: '6px' }} />
                <p style={{ margin: 0, fontSize: '0.84rem', fontWeight: 500 }}>No conditions — rule always fires on save.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {conditionGroups.map((grp, gIdx) => (
                  <React.Fragment key={gIdx}>
                    {gIdx > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'center', margin: '-8px 0' }}>
                        <div style={{ display: 'inline-flex', backgroundColor: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '2px' }}>
                          <button
                            type="button"
                            onClick={() => handleUpdateGroupLogic(gIdx, 'AND')}
                            style={{
                              padding: '3px 12px', fontSize: '0.72rem', fontWeight: 800,
                              borderRadius: '6px', border: 'none', cursor: 'pointer',
                              backgroundColor: (grp.group_logic || 'OR') === 'AND' ? '#2563EB' : 'transparent',
                              color: (grp.group_logic || 'OR') === 'AND' ? '#ffffff' : '#64748B',
                            }}
                          >
                            AND
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateGroupLogic(gIdx, 'OR')}
                            style={{
                              padding: '3px 12px', fontSize: '0.72rem', fontWeight: 800,
                              borderRadius: '6px', border: 'none', cursor: 'pointer',
                              backgroundColor: (grp.group_logic || 'OR') === 'OR' ? '#7C3AED' : 'transparent',
                              color: (grp.group_logic || 'OR') === 'OR' ? '#ffffff' : '#64748B',
                            }}
                          >
                            OR
                          </button>
                        </div>
                      </div>
                    )}

                    <div style={{
                      backgroundColor: '#FAFAFA', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '20px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          GROUP {gIdx + 1}
                        </span>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => handleAddCondition(gIdx)}
                            style={{
                              padding: '5px 12px', fontSize: '0.75rem', fontWeight: 700, color: '#475569',
                              backgroundColor: '#ffffff', border: '1px solid #CBD5E1', borderRadius: '6px', cursor: 'pointer',
                            }}
                          >
                            + Add Condition
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteGroup(gIdx)}
                            style={{
                              padding: '5px 8px', color: '#EF4444', backgroundColor: '#FEF2F2',
                              border: '1px solid #FECACA', borderRadius: '6px', cursor: 'pointer',
                            }}
                          >
                            <Trash2 style={{ width: 14, height: 14 }} />
                          </button>
                        </div>
                      </div>

                      {(!grp.conditions || grp.conditions.length === 0) ? (
                        <div style={{ padding: '16px', textAlign: 'center', color: '#94A3B8', fontSize: '0.8rem' }}>
                          No conditions in this group.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {grp.conditions.map((cond, cIdx) => (
                            <React.Fragment key={cIdx}>
                              {cIdx > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'center', margin: '-4px 0' }}>
                                  <div style={{ display: 'inline-flex', backgroundColor: '#E2E8F0', borderRadius: '6px', padding: '2px' }}>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateCondition(gIdx, cIdx, 'row_logic', 'AND')}
                                      style={{
                                        padding: '2px 10px', fontSize: '0.68rem', fontWeight: 800, borderRadius: '4px', border: 'none', cursor: 'pointer',
                                        backgroundColor: (cond.row_logic || 'AND') === 'AND' ? '#2563EB' : 'transparent',
                                        color: (cond.row_logic || 'AND') === 'AND' ? '#ffffff' : '#64748B',
                                      }}
                                    >
                                      AND
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateCondition(gIdx, cIdx, 'row_logic', 'OR')}
                                      style={{
                                        padding: '2px 10px', fontSize: '0.68rem', fontWeight: 800, borderRadius: '4px', border: 'none', cursor: 'pointer',
                                        backgroundColor: (cond.row_logic || 'AND') === 'OR' ? '#7C3AED' : 'transparent',
                                        color: (cond.row_logic || 'AND') === 'OR' ? '#ffffff' : '#64748B',
                                      }}
                                    >
                                      OR
                                    </button>
                                  </div>
                                </div>
                              )}

                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <select
                                  value={cond.field_name}
                                  onChange={(e) => handleUpdateCondition(gIdx, cIdx, 'field_name', e.target.value)}
                                  style={{
                                    flex: '1 1 180px', height: '40px', padding: '0 12px', fontSize: '0.84rem',
                                    fontWeight: 600, color: '#0F172A', backgroundColor: '#ffffff',
                                    border: '1.5px solid #CBD5E1', borderRadius: '8px', outline: 'none',
                                  }}
                                >
                                  {fields.map((f) => (
                                    <option key={f.name} value={f.name}>{f.label || f.name}</option>
                                  ))}
                                </select>

                                <select
                                  value={cond.operator}
                                  onChange={(e) => handleUpdateCondition(gIdx, cIdx, 'operator', e.target.value)}
                                  style={{
                                    flex: '1 1 140px', height: '40px', padding: '0 12px', fontSize: '0.84rem',
                                    fontWeight: 500, color: '#0F172A', backgroundColor: '#ffffff',
                                    border: '1.5px solid #CBD5E1', borderRadius: '8px', outline: 'none',
                                  }}
                                >
                                  {OPERATORS.map((op) => (
                                    <option key={op.value} value={op.value}>{op.label}</option>
                                  ))}
                                </select>

                                {!['is_blank', 'is_not_blank', 'is_empty', 'is_not_empty'].includes(cond.operator) && (
                                  <input
                                    type="text"
                                    placeholder="value..."
                                    value={cond.value || ''}
                                    onChange={(e) => handleUpdateCondition(gIdx, cIdx, 'value', e.target.value)}
                                    style={{
                                      flex: '1 1 180px', height: '40px', padding: '0 12px', fontSize: '0.84rem',
                                      color: '#0F172A', backgroundColor: '#ffffff', border: '1.5px solid #CBD5E1',
                                      borderRadius: '8px', outline: 'none',
                                    }}
                                  />
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleDeleteCondition(gIdx, cIdx)}
                                  style={{
                                    width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #FECACA',
                                    backgroundColor: '#FEF2F2', color: '#EF4444', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', cursor: 'pointer',
                                  }}
                                >
                                  <X style={{ width: 14, height: 14 }} />
                                </button>
                              </div>
                            </React.Fragment>
                          ))}
                        </div>
                      )}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>

          {/* Logic Preview Box */}
          <div style={{
            backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '14px',
            padding: '16px 24px', fontSize: '0.82rem', fontFamily: 'monospace',
          }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
              LOGIC PREVIEW
            </div>
            <div style={{ color: '#0891b2', fontWeight: 700, wordBreak: 'break-all' }}>
              {generateLogicPreview()}
            </div>
          </div>

          {/* Footer Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="submit"
              disabled={savingRule}
              style={{
                padding: '10px 24px', fontSize: '0.85rem', fontWeight: 700, color: '#ffffff',
                backgroundColor: savingRule ? '#93C5FD' : '#2563EB', border: 'none',
                borderRadius: '10px', cursor: savingRule ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)', display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              {savingRule ? 'Saving Rule…' : '✓ Save Rule'}
            </button>

            <button
              type="button"
              onClick={() => setViewMode('list')}
              style={{
                padding: '10px 20px', fontSize: '0.85rem', fontWeight: 600, color: '#475569',
                backgroundColor: '#ffffff', border: '1.5px solid #E2E8F0', borderRadius: '10px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default ValidationRulesPage;
