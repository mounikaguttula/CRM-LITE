import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
  GripVertical,
  Eye,
  CheckCircle2,
  RotateCcw,
  Search,
  X,
  Layout,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  ArrowLeft,
  Check,
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
  MapPin,
  User,
  FileText,
  FolderPlus,
  AlertTriangle,
} from 'lucide-react';
import {
  buildLayoutFieldList,
  saveStoredLayout,
  resetStoredLayout,
} from '../utils/pageLayoutUtils';

/* Helper for field type badges */
function FieldTypeBadge({ type }) {
  const t = (type || 'text').toLowerCase();
  let Icon = Type;
  let label = type || 'text';
  let color = '#6366f1';
  let bg = 'rgba(99,102,241,0.08)';

  if (t === 'number' || t === 'hash') { Icon = Hash; color = '#8b5cf6'; bg = 'rgba(139,92,246,0.08)'; }
  else if (t === 'currency') { Icon = DollarSign; color = '#10b981'; bg = 'rgba(16,185,129,0.08)'; }
  else if (t === 'date') { Icon = Calendar; color = '#f59e0b'; bg = 'rgba(245,158,11,0.08)'; }
  else if (t === 'datetime') { Icon = Clock; color = '#06b6d4'; bg = 'rgba(6,182,212,0.08)'; }
  else if (t === 'email') { Icon = Mail; color = '#3b82f6'; bg = 'rgba(59,130,246,0.08)'; }
  else if (t === 'phone') { Icon = Phone; color = '#22c55e'; bg = 'rgba(34,197,94,0.08)'; }
  else if (t === 'picklist' || t === 'dropdown') { Icon = List; color = '#a855f7'; bg = 'rgba(168,85,247,0.08)'; label = 'Picklist'; }
  else if (t === 'checkbox') { Icon = CheckSquare; color = '#f43f5e'; bg = 'rgba(244,63,94,0.08)'; }
  else if (t === 'url') { Icon = Link2; color = '#64748b'; bg = 'rgba(100,116,139,0.08)'; }
  else if (t === 'address') { Icon = MapPin; color = '#ec4899'; bg = 'rgba(236,72,153,0.08)'; }
  else if (t === 'lookup' || t === 'user') { Icon = User; color = '#6366f1'; bg = 'rgba(99,102,241,0.08)'; }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 8px',
        borderRadius: 8,
        fontSize: '0.7rem',
        fontWeight: 600,
        color,
        background: bg,
        border: `1px solid ${color}30`,
        whiteSpace: 'nowrap',
      }}
    >
      <Icon size={11} />
      {label}
    </span>
  );
}

export default function PageLayoutModal({
  isOpen,
  onClose,
  objectTypeId,
  displayName = 'Record',
  availableFields = [],
  onLayoutSaved,
}) {
  const [fields, setFields] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [warningMsg, setWarningMsg] = useState(null);

  const showWarning = (msg) => {
    setWarningMsg(msg);
    setTimeout(() => setWarningMsg(null), 4000);
  };

  useEffect(() => {
    if (isOpen && objectTypeId) {
      const initialList = buildLayoutFieldList(objectTypeId, availableFields);
      setFields(initialList);
      setSearchQuery('');
      setSavedSuccess(false);
      setWarningMsg(null);
    }
  }, [isOpen, objectTypeId, availableFields]);

  if (!isOpen) return null;

  /* Drag Handlers */
  const handleDragStart = (idx) => setDragIdx(idx);
  const handleDragOver = (e, idx) => {
    e.preventDefault();
    if (dragOverIdx !== idx) setDragOverIdx(idx);
  };
  const handleDragEnd = () => {
    if (dragIdx !== null && dragOverIdx !== null && dragIdx !== dragOverIdx) {
      const sourceSection = fields[dragIdx]?.section || 'details';
      const targetSection = fields[dragOverIdx]?.section || 'details';

      if (sourceSection !== 'details' && targetSection === 'details') {
        const detailsCount = fields.filter((f) => (f.section || 'details') === 'details').length;
        if (detailsCount >= 15) {
          showWarning('Details Tab limit reached! Maximum 15 fields allowed in the Details Tab.');
          setDragIdx(null);
          setDragOverIdx(null);
          return;
        }
      }

      setFields((prev) => {
        const next = [...prev];
        const [moved] = next.splice(dragIdx, 1);
        moved.section = targetSection;
        next.splice(dragOverIdx, 0, moved);
        return next;
      });
    }
    setDragIdx(null);
    setDragOverIdx(null);
  };

  /* Move field between left (details) and right (additional) sections */
  const moveSection = (idx, targetSection) => {
    if (targetSection === 'details') {
      const detailsCount = fields.filter((f) => (f.section || 'details') === 'details').length;
      if (detailsCount >= 15) {
        showWarning('Details Tab limit reached! A maximum of 15 fields are allowed in the Details tab.');
        return;
      }
    }
    setFields((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], section: targetSection };
      return next;
    });
  };

  /* Re-order up/down within same section */
  const moveItemWithinSection = (fieldItem, direction) => {
    const sectionFields = fields.filter((f) => f.section === fieldItem.section);
    const currSecIdx = sectionFields.findIndex((f) => f.name === fieldItem.name);
    const targetSecIdx = currSecIdx + direction;
    if (targetSecIdx < 0 || targetSecIdx >= sectionFields.length) return;

    const targetField = sectionFields[targetSecIdx];
    const fullIdx1 = fields.findIndex((f) => f.name === fieldItem.name);
    const fullIdx2 = fields.findIndex((f) => f.name === targetField.name);

    setFields((prev) => {
      const next = [...prev];
      const temp = next[fullIdx1];
      next[fullIdx1] = next[fullIdx2];
      next[fullIdx2] = temp;
      return next;
    });
  };

  /* Toggle field visibility */
  const toggleVisibility = (idx) => {
    setFields((prev) => {
      const next = [...prev];
      const item = next[idx];
      if (item.required && item.visible) return next;
      next[idx] = { ...item, visible: !item.visible };
      return next;
    });
  };

  const handleSelectAll = (visibleState) => {
    setFields((prev) => prev.map((f) => ({ ...f, visible: f.required ? true : visibleState })));
  };

  const handleResetDefault = () => {
    resetStoredLayout(objectTypeId);
    const defaultList = buildLayoutFieldList(objectTypeId, availableFields).map((f) => ({ ...f, visible: true }));
    setFields(defaultList);
    setWarningMsg(null);
  };

  const handleSave = () => {
    setSaving(true);
    const layoutConfig = {
      objectTypeId,
      fields: fields.map((f) => ({
        name: f.name,
        label: f.label,
        visible: f.visible,
        section: f.section || 'details',
      })),
    };

    saveStoredLayout(objectTypeId, layoutConfig);
    setSaving(false);
    setSavedSuccess(true);
    if (onLayoutSaved) onLayoutSaved(layoutConfig);

    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  const detailsList = fields.filter((f) => f.section === 'details' || !f.section);
  const additionalList = fields.filter((f) => f.section === 'additional');
  const isDetailsFull = detailsList.length >= 15;

  const filterFn = (f) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (f.label || '').toLowerCase().includes(q) ||
      (f.name || '').toLowerCase().includes(q) ||
      (f.type || '').toLowerCase().includes(q)
    );
  };

  const filteredDetails = detailsList.filter(filterFn);
  const filteredAdditional = additionalList.filter(filterFn);
  const visibleCount = fields.filter((f) => f.visible).length;

  const renderFieldCard = (field, originalIdx) => {
    const isDragging = dragIdx === originalIdx;
    const isDragOver = dragOverIdx === originalIdx;
    const inDetails = (field.section || 'details') === 'details';

    return (
      <div
        key={field.name}
        draggable
        onDragStart={() => handleDragStart(originalIdx)}
        onDragOver={(e) => handleDragOver(e, originalIdx)}
        onDragEnd={handleDragEnd}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          borderRadius: 12,
          border: isDragOver
            ? '2px solid #6366f1'
            : field.visible
              ? '1.5px solid #e2e8f0'
              : '1.5px dashed #cbd5e1',
          background: isDragging
            ? '#eef2ff'
            : isDragOver
              ? '#f5f3ff'
              : field.visible
                ? '#ffffff'
                : '#f8fafc',
          boxShadow: field.visible ? '0 2px 5px rgba(0,0,0,0.02)' : 'none',
          opacity: isDragging ? 0.5 : field.visible ? 1 : 0.6,
          transition: 'all 0.15s ease',
        }}
      >
        <div style={{ cursor: 'grab', color: '#94a3b8', display: 'flex', alignItems: 'center' }} title="Drag to reorder or move section">
          <GripVertical size={16} />
        </div>

        <input
          type="checkbox"
          checked={field.visible}
          disabled={field.required && field.visible}
          onChange={() => toggleVisibility(originalIdx)}
          style={{ width: 16, height: 16, accentColor: '#6366f1', cursor: field.required ? 'not-allowed' : 'pointer' }}
          title={field.required ? 'Required field' : 'Toggle view mode visibility'}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 700, fontSize: '0.84rem', color: field.visible ? '#0f172a' : '#64748b', textDecoration: field.visible ? 'none' : 'line-through' }}>
              {field.label}
            </span>
            {field.required && (
              <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: '0.62rem', fontWeight: 800, background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca' }}>
                REQ
              </span>
            )}
          </div>
          <code style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{field.name}</code>
        </div>

        <FieldTypeBadge type={field.type} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <button
            type="button"
            onClick={() => moveItemWithinSection(field, -1)}
            style={{ padding: '3px 5px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
            title="Move Up"
          >
            <ArrowUp size={12} color="#475569" />
          </button>
          <button
            type="button"
            onClick={() => moveItemWithinSection(field, 1)}
            style={{ padding: '3px 5px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
            title="Move Down"
          >
            <ArrowDown size={12} color="#475569" />
          </button>

          {inDetails ? (
            <button
              type="button"
              onClick={() => moveSection(originalIdx, 'additional')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                padding: '4px 8px', borderRadius: 8, fontSize: '0.72rem', fontWeight: 700,
                color: '#6366f1', background: '#eef2ff', border: '1px solid #c7d2fe', cursor: 'pointer'
              }}
              title="Move field to More Details tab"
            >
              More Details <ArrowRight size={12} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => moveSection(originalIdx, 'details')}
              disabled={isDetailsFull}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                padding: '4px 8px', borderRadius: 8, fontSize: '0.72rem', fontWeight: 700,
                color: isDetailsFull ? '#94a3b8' : '#059669',
                background: isDetailsFull ? '#f1f5f9' : '#ecfdf5',
                border: isDetailsFull ? '1px solid #cbd5e1' : '1.5px solid #a7f3d0',
                cursor: isDetailsFull ? 'not-allowed' : 'pointer',
                opacity: isDetailsFull ? 0.6 : 1,
              }}
              title={isDetailsFull ? 'Details Tab full (Max 15 fields allowed)' : 'Move field to Details tab'}
            >
              <ArrowLeft size={12} /> Details
            </button>
          )}
        </div>
      </div>
    );
  };

  return ReactDOM.createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 999999,
        background: 'rgba(15, 23, 42, 0.68)', backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%', maxWidth: '1080px', maxHeight: '90vh',
          background: '#ffffff', borderRadius: 24,
          boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.35)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <header style={{ padding: '20px 28px 18px', background: 'linear-gradient(135deg, #0d1117 0%, #0a1628 40%, #0d2137 100%)', color: '#ffffff' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ position: 'absolute', top: 18, right: 18, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer' }}
          >
            <X size={16} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #6366f1, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layout size={20} color="#fff" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>
                Page Layout Customizer (Two-Column Tab Sections)
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'rgba(255,255,255,0.68)' }}>
                Organize fields between the <strong style={{ color: '#60a5fa' }}>Details Tab (Max 15)</strong> and the <strong style={{ color: '#34d399' }}>More Details Tab</strong> for {displayName}.
              </p>
            </div>
          </div>
        </header>

        {/* Toolbar */}
        <div style={{ padding: '12px 28px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ position: 'relative', width: 260 }}>
            <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search fields by name or type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '7px 12px 7px 34px', fontSize: '0.82rem', borderRadius: 10, border: '1px solid #cbd5e1', outline: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" onClick={() => handleSelectAll(true)} style={{ padding: '6px 12px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600, background: '#fff', border: '1px solid #cbd5e1', cursor: 'pointer' }}>
              Show All
            </button>
            <button type="button" onClick={() => handleSelectAll(false)} style={{ padding: '6px 12px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600, background: '#fff', border: '1px solid #cbd5e1', cursor: 'pointer' }}>
              Hide Optional
            </button>
            <button type="button" onClick={handleResetDefault} style={{ padding: '6px 12px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600, background: '#fff', border: '1px solid #fca5a5', color: '#dc2626', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <RotateCcw size={12} /> Reset Default
            </button>
          </div>
        </div>

        {/* Warning Banner */}
        {warningMsg && (
          <div style={{ margin: '14px 28px 0', padding: '10px 16px', borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '0.84rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={18} color="#ef4444" />
            <span>{warningMsg}</span>
          </div>
        )}

        {/* Two Columns Container */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, background: '#f1f5f9' }}>
          {/* Left Column: Details Tab */}
          <div style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1.5px solid #6366f1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={18} color="#6366f1" />
                <span style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a' }}>1. Details Tab Fields</span>
              </div>
              <span
                style={{
                  padding: '2px 9px', borderRadius: 12,
                  background: isDetailsFull ? 'rgba(239,68,68,0.12)' : 'rgba(99,102,241,0.1)',
                  color: isDetailsFull ? '#ef4444' : '#6366f1',
                  border: isDetailsFull ? '1px solid #fecaca' : '1px solid rgba(99,102,241,0.2)',
                  fontSize: '0.75rem', fontWeight: 800
                }}
              >
                {filteredDetails.length} / 15 Max Fields
              </span>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 180 }}>
              {filteredDetails.length === 0 ? (
                <div style={{ padding: '30px 10px', textAlign: 'center', color: '#94a3b8', fontSize: '0.84rem' }}>
                  No fields assigned to Details tab. Drag or click move buttons to add fields here.
                </div>
              ) : (
                filteredDetails.map((f) => renderFieldCard(f, fields.findIndex((item) => item.name === f.name)))
              )}
            </div>
          </div>

          {/* Right Column: More Details Tab */}
          <div style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1.5px solid #10b981' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FolderPlus size={18} color="#10b981" />
                <span style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a' }}>2. More Details Tab Fields</span>
              </div>
              <span style={{ padding: '2px 8px', borderRadius: 12, background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: '0.75rem', fontWeight: 800 }}>
                {filteredAdditional.length} Fields
              </span>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 180 }}>
              {filteredAdditional.length === 0 ? (
                <div style={{ padding: '30px 10px', textAlign: 'center', color: '#94a3b8', fontSize: '0.84rem' }}>
                  No fields assigned to More Details tab. Use the "More Details →" button on any field to send it here.
                </div>
              ) : (
                filteredAdditional.map((f) => renderFieldCard(f, fields.findIndex((item) => item.name === f.name)))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer style={{ padding: '16px 28px', background: '#ffffff', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            {visibleCount} total fields visible across both tabs.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" onClick={onClose} style={{ padding: '9px 18px', borderRadius: 12, fontSize: '0.85rem', fontWeight: 600, background: '#fff', border: '1.5px solid #cbd5e1', color: '#475569', cursor: 'pointer' }}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '9px 22px', borderRadius: 12, fontSize: '0.85rem', fontWeight: 700, color: '#fff',
                background: savedSuccess ? '#16a34a' : 'linear-gradient(135deg, #6366f1, #3b82f6)',
                border: 'none', cursor: saving ? 'wait' : 'pointer', boxShadow: '0 6px 18px rgba(99,102,241,0.35)',
                display: 'inline-flex', alignItems: 'center', gap: 7,
              }}
            >
              {savedSuccess ? <><CheckCircle2 size={16} /> Saved!</> : <><Check size={16} /> Save Layout</>}
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body
  );
}