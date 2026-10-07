/**
 * CSVFieldMappingModal.js
 * Generic, metadata-driven CSV Field Mapping UI for any CRM object type.
 *
 * Flow:
 *  Step 0 – Upload
 *  Step 1 – Map Fields (auto-map suggestion + user review)
 *  Step 2 – Validate relationships (ALL rows, not a sample)
 *  Step 3 – Import (batched)
 *  Step 4 – Result
 *
 * Nothing in here knows a CSV header, an object name or a field name.
 * Everything comes from metadata (see csvImportMapping.js and lookupUtils.js).
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
  X, UploadCloud, AlertTriangle, Check, RefreshCw,
  ChevronDown, Link2, Save, Trash2, Sparkles, ArrowRight,
  CheckCircle2, XCircle, HelpCircle, ChevronUp, Search
} from 'lucide-react';
import { apiGet, apiPost } from '../api/client';
import { mapHeaderToField, buildFieldMetadataList } from '../utils/csvImportMapping';
import {
  listSavedMappings, findMatchingMapping, saveMapping, deleteMapping
} from '../utils/csvSavedMappings';
import {
  getMatchCandidates, suggestMatchField, RECORD_ID_OPTION,
  USER_TARGET, USER_TARGET_LABEL, USER_MATCH_OPTIONS,
} from '../utils/lookupUtils';

// ─── Constants ────────────────────────────────────────────────────────────────

const SAMPLE_ROWS_PREVIEW = 5;     // only used for the sample text in the mapping screen
const BATCH_SIZE = 50;             // records per import request
const RESOLVE_CHUNK = 500;         // values per resolve-relationships request
const PROBE_VALUES = 20;           // values used to suggest a Match By field

// ─── Helpers ──────────────────────────────────────────────────────────────────

const cellValue = (v) => {
  if (v === undefined || v === null) return '';
  let str = String(v).trim();
  if (str.startsWith('="') && str.endsWith('"')) {
    str = str.slice(2, -1);
  } else if (str.startsWith('=')) {
    str = str.replace(/^="?|"?$/g, '');
  }
  str = str.trim();
  if (/^[+-]?\d+(\.\d+)?[eE][+-]?\d+$/.test(str)) {
    const num = Number(str);
    if (!isNaN(num) && Number.isFinite(num)) {
      try {
        if (Math.floor(num) === num || Math.abs(num - Math.round(num)) < 1e-5) {
          if (typeof window !== 'undefined' && typeof window.BigInt === 'function') {
            str = window.BigInt(Math.round(num)).toString();
          } else {
            str = num.toFixed(0);
          }
        } else {
          str = num.toFixed(0);
        }
      } catch (e) {
        str = num.toFixed(0);
      }
    }
  }
  return str;
};

/**
 * RFC-4180 style parser: quoted cells, "" escapes, multiline cells, BOM, CRLF.
 * Duplicate headers are made unique ("Email", "Email (2)") so each column can be mapped separately.
 */
function parseCSVText(text) {
  const src = String(text || '').replace(/^\uFEFF/, '');
  const table = [];
  let row = [], val = '', inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { val += '"'; i++; } else inQuotes = false;
      } else val += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(val.trim()); val = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(val.trim()); val = '';
      table.push(row); row = [];
    } else val += c;
  }
  if (val !== '' || row.length) { row.push(val.trim()); table.push(row); }

  const lines = table.filter((r) => r.some((v) => v !== ''));
  if (lines.length < 2) return { headers: [], rows: [] };

  const seen = {};
  const headers = lines[0].map((h, idx) => {
    const base = h || `Column ${idx + 1}`;
    seen[base] = (seen[base] || 0) + 1;
    return seen[base] === 1 ? base : `${base} (${seen[base]})`;
  });

  const rows = lines.slice(1).map((vals) => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = vals[idx] !== undefined ? vals[idx] : ''; });
    return obj;
  });
  return { headers, rows };
}

/** Builds a mapping entry from a metadata field. Target object comes from metadata, never guessed. */
const mappingFor = (f) => ({
  targetField: f?.key || null,
  isRelationship: !!f?.isRelationship,
  targetObjectType: f?.targetObject || null,
  matchField: null,
  priority: 1,
});

const targetLabel = (key, objectTypes) =>
  key === USER_TARGET
    ? USER_TARGET_LABEL
    : (objectTypes || []).find((o) => o.api_name === key)?.display_name || key;

// Resolve status icon
function StatusIcon({ status, size = 14 }) {
  if (status === 'resolved') return <CheckCircle2 size={size} style={{ color: '#16a34a' }} />;
  if (status === 'not_found') return <XCircle size={size} style={{ color: '#dc2626' }} />;
  if (status === 'ambiguous') return <AlertTriangle size={size} style={{ color: '#d97706' }} />;
  if (status === 'invalid' || status === 'error') return <XCircle size={size} style={{ color: '#9f1239' }} />;
  return <HelpCircle size={size} style={{ color: '#94a3b8' }} />;
}

// ─── Sub-component: SearchableSelect ─────────────────────────────────────────
// A custom dropdown with an inline search input for filtering options.

function SearchableSelect({ value, onChange, options, placeholder = '— Unmapped —', disabled = false, style = {} }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Find selected label
  const selectedOption = options.find((o) => o.value === value);
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  // Filter options
  const query = search.toLowerCase().trim();
  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query) || (o.value || '').toLowerCase().includes(query))
    : options;

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch('');
        setHighlightIdx(-1);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIdx >= 0 && listRef.current) {
      const item = listRef.current.children[highlightIdx + 1]; // +1 for the unmapped option
      if (item) item.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIdx]);

  const handleOpen = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
    setSearch('');
    setHighlightIdx(-1);
  };

  const handleSelect = (val) => {
    onChange({ target: { value: val } });
    setIsOpen(false);
    setSearch('');
    setHighlightIdx(-1);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearch('');
      setHighlightIdx(-1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIdx === -1) {
        handleSelect('');
      } else if (filtered[highlightIdx]) {
        handleSelect(filtered[highlightIdx].value);
      }
    }
  };

  const baseStyle = {
    padding: '6px 10px', borderRadius: 8, border: '1px solid #e2e8f0',
    background: '#fff', fontSize: '0.8rem', color: '#0f172a', width: '100%',
    cursor: disabled ? 'not-allowed' : 'pointer',
    outline: 'none', position: 'relative',
    userSelect: 'none',
    ...style,
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Trigger */}
      <div
        onClick={handleOpen}
        style={{
          ...baseStyle,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          border: isOpen ? '1px solid #8b5cf6' : baseStyle.border,
          boxShadow: isOpen ? '0 0 0 2px rgba(139,92,246,0.15)' : 'none',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <span style={{
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          color: value ? '#0f172a' : '#94a3b8', fontWeight: value ? 500 : 400,
        }}>
          {displayLabel}
        </span>
        <ChevronDown size={13} style={{ color: '#94a3b8', flexShrink: 0, marginLeft: 4,
          transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          marginTop: 4, background: '#fff',
          border: '1px solid #e2e8f0', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
          zIndex: 9999, maxHeight: 300, display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Search input */}
          <div style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setHighlightIdx(-1); }}
              onKeyDown={handleKeyDown}
              placeholder="Search fields…"
              style={{
                width: '100%', padding: '6px 10px', borderRadius: 6,
                border: '1px solid #e2e8f0', fontSize: '0.78rem',
                outline: 'none', background: '#f8fafc', color: '#0f172a',
                transition: 'border 0.15s',
              }}
              onFocus={(e) => { e.target.style.borderColor = '#8b5cf6'; }}
              onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; }}
            />
          </div>

          {/* Options list */}
          <div ref={listRef} style={{ overflowY: 'auto', maxHeight: 240 }}>
            {/* Unmapped option */}
            <div
              onClick={() => handleSelect('')}
              style={{
                padding: '7px 12px', fontSize: '0.78rem', cursor: 'pointer',
                color: '#94a3b8', fontStyle: 'italic',
                background: highlightIdx === -1 && !value ? '#f5f3ff' : 'transparent',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f3ff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = highlightIdx === -1 && !value ? '#f5f3ff' : 'transparent'; }}
            >
              {placeholder}
            </div>

            {filtered.length === 0 && (
              <div style={{ padding: '12px', fontSize: '0.76rem', color: '#94a3b8', textAlign: 'center' }}>
                No fields match "{search}"
              </div>
            )}

            {filtered.map((o, idx) => {
              const isHighlighted = idx === highlightIdx;
              const isSelected = o.value === value;
              return (
                <div
                  key={o.value}
                  onClick={() => handleSelect(o.value)}
                  style={{
                    padding: '7px 12px', fontSize: '0.78rem', cursor: 'pointer',
                    background: isHighlighted ? '#ede9fe' : isSelected ? '#f5f3ff' : 'transparent',
                    color: isSelected ? '#6d28d9' : '#0f172a',
                    fontWeight: isSelected ? 600 : 400,
                    display: 'flex', alignItems: 'center', gap: 6,
                    transition: 'background 0.08s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#ede9fe'; setHighlightIdx(idx); }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = isSelected ? '#f5f3ff' : 'transparent'; }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
                  {isSelected && <Check size={13} style={{ color: '#6d28d9', flexShrink: 0, marginLeft: 'auto' }} />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-component: FieldMappingRow ──────────────────────────────────────────

function FieldMappingRow({
  header, sampleValues, mapping, fieldMetadataList, lookupFieldOptions,
  onMappingChange, isDisabled, allMappings
}) {
  const [expanded, setExpanded] = useState(false);

  const currentMapping = mapping || mappingFor(null);
  const selectedField = fieldMetadataList.find((f) => f.key === currentMapping.targetField) || null;
  const isLookup = !!selectedField?.isRelationship;
  const objectTypes = lookupFieldOptions.__objectTypes || [];

  // Several CSV columns can feed the same relationship; then priority decides which one wins
  const sameFieldCount = Object.values(allMappings).filter((m) => m?.targetField === currentMapping.targetField).length;
  const hasPriorityConflict = sameFieldCount > 1 && isLookup;

  const sampleText = sampleValues.filter(Boolean).slice(0, 2).join(', ') || '—';

  const handleFieldChange = (e) => {
    const field = fieldMetadataList.find((f) => f.key === (e.target.value || null)) || null;
    onMappingChange(header, { ...mappingFor(field), priority: currentMapping.priority || 1 });
    if (field?.isRelationship) setExpanded(true);
  };
  const handleMatchFieldChange = (e) =>
    onMappingChange(header, { ...currentMapping, matchField: e.target.value || null });
  const handleTargetObjectChange = (e) =>
    onMappingChange(header, { ...currentMapping, targetObjectType: e.target.value || null, matchField: null });
  const handlePriorityChange = (e) =>
    onMappingChange(header, { ...currentMapping, priority: parseInt(e.target.value, 10) || 1 });

  // Resolve lookup opts by trying the raw targetObjectType, then its canonical api_name.
  // This handles cases where targetObject is stored as 'company' but cache was keyed as 'companies' or vice-versa.
  const currentLookupOpts = (() => {
    if (!currentMapping.targetObjectType) return [];
    const direct = lookupFieldOptions[currentMapping.targetObjectType];
    if (direct && direct.length > 0) return direct;
    // Try canonical api_name match from objectTypes
    const matched = objectTypes.find((o) =>
      o.api_name === currentMapping.targetObjectType ||
      o.id === currentMapping.targetObjectType ||
      o.api_name?.toLowerCase() === currentMapping.targetObjectType?.toLowerCase()
    );
    if (matched) {
      return (
        lookupFieldOptions[matched.api_name] ||
        lookupFieldOptions[matched.id] ||
        []
      );
    }
    return [];
  })();

  const selectStyle = {
    padding: '6px 10px', borderRadius: 8, border: '1px solid #e2e8f0',
    background: '#fff', fontSize: '0.8rem', color: '#0f172a', width: '100%',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    outline: 'none', appearance: 'auto'
  };
  const purpleSelect = { ...selectStyle, border: '1px solid #c4b5fd' };
  const labelStyle = { display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#4c1d95', marginBottom: 4 };

  return (
    <div style={{
      borderBottom: '1px solid #f1f5f9',
      padding: '10px 14px',
      background: currentMapping.targetField ? '#ffffff' : '#fafbfc',
      transition: 'background 0.15s',
    }}>
      {/* Main Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 28px 1fr 36px', gap: 8, alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>{header}</div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 400 }} title={sampleText}>
            {sampleText.length > 40 ? sampleText.slice(0, 40) + '…' : sampleText}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <ArrowRight size={14} style={{ color: '#cbd5e1' }} />
        </div>

        {/* CRM Field Dropdown — searchable (comes entirely from metadata) */}
        <SearchableSelect
          value={currentMapping.targetField || ''}
          onChange={handleFieldChange}
          disabled={isDisabled}
          options={fieldMetadataList.map((f) => ({
            value: f.key,
            label: `${f.label || f.key}${f.isRelationship ? ' 🔗' : ''}`,
          }))}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}>
          {currentMapping.targetField
            ? <Check size={14} style={{ color: '#16a34a' }} />
            : <HelpCircle size={14} style={{ color: '#d1d5db' }} />
          }
          {isLookup && (
            <button
              type="button"
              onClick={() => setExpanded((x) => !x)}
              style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: '#6366f1', display: 'flex' }}
              title="Configure relationship"
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>
      </div>

      {/* Linked Record Matching: only for fields that are relationships in metadata */}
      {isLookup && expanded && (
        <div style={{
          marginTop: 10, padding: '12px 14px', background: '#f5f3ff',
          borderRadius: 12, border: '1px solid #ddd6fe',
          boxShadow: 'inset 0 1px 3px rgba(124, 58, 237, 0.05)',
          display: 'flex', flexDirection: 'column', gap: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em',
              background: '#8b5cf6', color: '#fff', padding: '2px 8px', borderRadius: 6
            }}>
              🔗 Linked Record Matching
            </span>
            <span style={{ fontSize: '0.74rem', color: '#6d28d9', fontWeight: 500 }}>
              How should we find the matching record in CRM?
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: hasPriorityConflict ? '1fr 1fr 100px' : '1fr 1fr', gap: 10, alignItems: 'end' }}>
            {/* Target Object: read-only when metadata knows it, dropdown only when it doesn't */}
            <div>
              <label style={labelStyle}>
                Target Object <span style={{ color: '#9333ea', fontWeight: 400 }}>(Where to look up)</span>
              </label>
              {selectedField.targetObject ? (
                <div style={{ ...purpleSelect, background: '#ede9fe', fontWeight: 600, cursor: 'default' }}>
                  {targetLabel(selectedField.targetObject, objectTypes)}
                </div>
              ) : (
                <select value={currentMapping.targetObjectType || ''} onChange={handleTargetObjectChange} disabled={isDisabled} style={purpleSelect}>
                  <option value="">— Select Target Object —</option>
                  {objectTypes.map((obj) => (
                    <option key={obj.api_name} value={obj.api_name}>{obj.display_name || obj.api_name}</option>
                  ))}
                  <option value={USER_TARGET}>{USER_TARGET_LABEL}</option>
                </select>
              )}
            </div>

            {/* Match By: fields of the TARGET object, never CSV columns */}
            <div>
              <label style={labelStyle}>
                Match By <span style={{ color: '#9333ea', fontWeight: 400 }}>(Field in target object)</span>
              </label>
              <select value={currentMapping.matchField || ''} onChange={handleMatchFieldChange} disabled={isDisabled || !currentMapping.targetObjectType} style={purpleSelect}>
                <option value="">— Select Field to Compare —</option>
                {currentLookupOpts.map((f) => (
                  <option key={f.key} value={f.key}>{f.label || f.key}</option>
                ))}
              </select>
            </div>

            {hasPriorityConflict && (
              <div>
                <label style={labelStyle}>Priority</label>
                <input
                  type="number" min="1" max="99"
                  value={currentMapping.priority || 1}
                  onChange={handlePriorityChange}
                  disabled={isDisabled}
                  style={purpleSelect}
                  title="Several CSV columns feed this field. The lowest number that has a value is used."
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CSVFieldMappingModal({
  open, onClose, objectTypeId, objectDisplayName, orgId,
  onImportComplete
}) {
  // 0 = Upload, 1 = Map, 2 = Validate, 3 = Importing, 4 = Result
  const [step, setStep] = useState(0);

  // ── Upload state ───────────────────────────────────────────────────────────
  const [isDragging, setIsDragging] = useState(false);
  const [, setSelectedFile] = useState(null);
  const [fileParsing, setFileParsing] = useState(false);
  const [parseError, setParseError] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [sampleRows, setSampleRows] = useState([]);
  const [allRows, setAllRows] = useState([]);
  const fileInputRef = useRef(null);

  // ── Metadata ───────────────────────────────────────────────────────────────
  const [fieldMetadataList, setFieldMetadataList] = useState([]);
  const [lookupFieldOptions, setLookupFieldOptions] = useState({ __objectTypes: [] });
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState(null);
  const objectTypesRef = useRef([]);        // latest object list, safe to read inside callbacks
  const matchOptionsCache = useRef({});     // targetObject → Match By options

  // ── Mapping state ──────────────────────────────────────────────────────────
  // mappings: { [csvHeader]: { targetField, isRelationship, targetObjectType, matchField, priority } }
  const [mappings, setMappings] = useState({});
  const [rowSearchTerm, setRowSearchTerm] = useState('');

  // ── Saved mappings ─────────────────────────────────────────────────────────
  const [savedMappings, setSavedMappings] = useState([]);
  const [foundSavedMapping, setFoundSavedMapping] = useState(null);
  const [saveMappingName, setSaveMappingName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  // ── Validation state ───────────────────────────────────────────────────────
  const [relationshipPreviews, setRelationshipPreviews] = useState({}); // { header: { value: { status, resolvedId, resolvedName, reason } } }
  const [validating, setValidating] = useState(false);

  // ── Import state ───────────────────────────────────────────────────────────
  const [importProgress, setImportProgress] = useState('');
  const [importReport, setImportReport] = useState(null);

  // ── Reset ──────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setStep(0);
    setIsDragging(false);
    setSelectedFile(null);
    setFileParsing(false);
    setParseError(null);
    setHeaders([]);
    setSampleRows([]);
    setAllRows([]);
    setMappings({});
    setRowSearchTerm('');
    setRelationshipPreviews({});
    setValidating(false);
    setImportProgress('');
    setImportReport(null);
    setFoundSavedMapping(null);
    setSaveMappingName('');
    setShowSaveInput(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  // Saved mappings list is available on the upload step, before any file is parsed
  useEffect(() => {
    if (open) setSavedMappings(listSavedMappings(orgId, objectTypeId));
  }, [open, orgId, objectTypeId]);

  // ── Load field metadata ────────────────────────────────────────────────────
  useEffect(() => {
    if (!open || !objectTypeId) return;
    setMetaLoading(true);
    setMetaError(null);

    // Accepts [], {data: []}, {fields: []}, {data: {fields: []}}, {data: {data: []}}
    const toArray = (res) => {
      if (Array.isArray(res)) return res;
      for (const v of [res?.data, res?.fields, res?.data?.fields, res?.data?.data]) {
        if (Array.isArray(v)) return v;
      }
      return [];
    };

    (async () => {
      try {
        const objList = toArray(await apiGet('/metadata/objects').catch(() => []));

        // The app calls the fields endpoint with whatever objectTypeId the page passes (api_name or id).
        // Try that first, then the other form, so either route style works.
        const obj = objList.find((o) => o.id === objectTypeId || o.api_name === objectTypeId);
        const candidates = [...new Set([objectTypeId, obj?.api_name, obj?.id].filter(Boolean))];

        let rawFields = [];
        for (const key of candidates) {
          rawFields = toArray(await apiGet(`/metadata/objects/${key}/fields`).catch(() => null));
          if (rawFields.length) break;
          rawFields = toArray(await apiGet(`/objects/${key}/fields`).catch(() => null));
          if (rawFields.length) break;
        }
        if (rawFields.length === 0) throw new Error('Field metadata response was empty');

        const normalized = buildFieldMetadataList(rawFields, objList);
        if (normalized.length === 0) {
          console.error('[CSV import] 0 usable fields. First raw field:', rawFields[0]);
          throw new Error(`0 usable fields out of ${rawFields.length} returned`);
        }

        objectTypesRef.current = objList;
        setFieldMetadataList(normalized);
        setLookupFieldOptions((prev) => ({ ...prev, __objectTypes: objList }));
      } catch (err) {
        console.error('[CSV import] metadata load failed', { objectTypeId, err });
        setMetaError(err?.message || 'Could not load field metadata');
      } finally {
        setMetaLoading(false);
      }
    })();
  }, [open, objectTypeId]);

  // Match By options for a target object, loaded on demand and cached.
  // Normalizes the targetObj to its canonical api_name and caches under all alias keys
  // so lookupFieldOptions[currentMapping.targetObjectType] always resolves.
  const loadLookupOptions = useCallback(async (targetObj) => {
    if (!targetObj) return [];
    if (matchOptionsCache.current[targetObj]) return matchOptionsCache.current[targetObj];

    let opts;
    if (targetObj === USER_TARGET) {
      opts = USER_MATCH_OPTIONS;
      matchOptionsCache.current[targetObj] = opts;
      setLookupFieldOptions((prev) => ({ ...prev, [targetObj]: opts }));
      return opts;
    }

    // Resolve to canonical api_name + id from the known object list.
    // Match is: UUID id, exact api_name, case-insensitive api_name, or stripped singular/plural.
    const objList = objectTypesRef.current || [];
    const tLower = String(targetObj).toLowerCase();
    const matched = objList.find((o) => {
      if (!o) return false;
      if (o.id === targetObj) return true;
      const api = (o.api_name || '').toLowerCase();
      if (api === tLower) return true;
      // plural → singular: 'companies' matches 'company', 'leads' matches 'lead'
      if (api.endsWith('y') && `${api.slice(0, -1)}ies` === tLower) return true;
      if (!api.endsWith('s') && `${api}s` === tLower) return true;
      // singular → plural: 'company' matches 'companies', 'lead' matches 'leads'
      if (tLower.endsWith('ies') && api === `${tLower.slice(0, -3)}y`) return true;
      if (tLower.endsWith('s') && api === tLower.slice(0, -1)) return true;
      return false;
    });
    const canonicalKey = matched?.api_name || targetObj;
    const objId = matched?.id;

    // If canonical result already cached, alias and return it
    if (matchOptionsCache.current[canonicalKey]) {
      const cachedOpts = matchOptionsCache.current[canonicalKey];
      matchOptionsCache.current[targetObj] = cachedOpts;
      const extras = [targetObj, canonicalKey, objId].filter(Boolean);
      setLookupFieldOptions((prev) => {
        const patch = {};
        extras.forEach((k) => { patch[k] = cachedOpts; });
        return { ...prev, ...patch };
      });
      return cachedOpts;
    }

    // Fetch from the API, trying canonical then original key
    opts = [RECORD_ID_OPTION];
    try {
      const keysToTry = [...new Set([canonicalKey, targetObj, objId].filter(Boolean))];
      let rawFields = [];
      for (const k of keysToTry) {
        const res = await apiGet(`/metadata/objects/${k}/fields`).catch(() => null);
        const arr = Array.isArray(res) ? res : (res?.data || res?.fields || res?.data?.fields || []);
        if (arr.length > 0) { rawFields = arr; break; }
      }
      if (rawFields.length === 0) {
        for (const k of keysToTry) {
          const res = await apiGet(`/objects/${k}/fields`).catch(() => null);
          const arr = Array.isArray(res) ? res : (res?.data || res?.fields || res?.data?.fields || []);
          if (arr.length > 0) { rawFields = arr; break; }
        }
      }
      if (rawFields.length > 0) {
        opts = getMatchCandidates(buildFieldMetadataList(rawFields, objectTypesRef.current));
      }
    } catch { /* keep Record ID only */ }

    // Cache under all aliases so any variant of the key resolves
    const allKeys = [...new Set([targetObj, canonicalKey, objId].filter(Boolean))];
    allKeys.forEach((k) => { matchOptionsCache.current[k] = opts; });
    setLookupFieldOptions((prev) => {
      const patch = {};
      allKeys.forEach((k) => { patch[k] = opts; });
      return { ...prev, ...patch };
    });
    return opts;
  }, []);

  // Picks the Match By field by probing the resolve endpoint with real values from this column.
  // An empty column is skipped entirely: nothing to configure.
  const autoPickMatchField = useCallback(async (header, m, rows) => {
    if (!m?.isRelationship || !m.targetObjectType || m.matchField) return;
    const values = [...new Set(rows.map((r) => cellValue(r[header])).filter(Boolean))].slice(0, PROBE_VALUES);
    if (!values.length) return;
    const options = await loadLookupOptions(m.targetObjectType);
    const best = await suggestMatchField(m.targetObjectType, options, values);
    if (best) {
      setMappings((prev) =>
        prev[header]?.targetField === m.targetField && !prev[header].matchField
          ? { ...prev, [header]: { ...prev[header], matchField: best } }
          : prev
      );
    }
  }, [loadLookupOptions]);

  // ── File handling ──────────────────────────────────────────────────────────
  const handleFileProcess = useCallback((file) => {
    if (!file || !file.name.toLowerCase().endsWith('.csv')) {
      setParseError('Please upload a valid .csv file.');
      return;
    }
    setParseError(null);
    setSelectedFile(file);
    setFileParsing(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      setTimeout(() => {
        const { headers: h, rows } = parseCSVText(e.target.result);
        if (h.length === 0 || rows.length === 0) {
          setParseError('The CSV file is empty or has no data rows.');
          setSelectedFile(null);
          setFileParsing(false);
          return;
        }
        setHeaders(h);
        setSampleRows(rows.slice(0, SAMPLE_ROWS_PREVIEW));
        setAllRows(rows);

        setSavedMappings(listSavedMappings(orgId, objectTypeId));
        setFoundSavedMapping(findMatchingMapping(orgId, objectTypeId, h));

        // Auto-map is only a suggestion. A plain field can take one CSV column;
        // relationship fields may take several (priority decides).
        const autoMapped = {};
        const usedPlain = new Set();
        h.forEach((header) => {
          const f = mapHeaderToField(header, fieldMetadataList);
          if (f && !f.isRelationship && usedPlain.has(f.key)) {
            autoMapped[header] = mappingFor(null);
            return;
          }
          if (f && !f.isRelationship) usedPlain.add(f.key);
          autoMapped[header] = mappingFor(f);
        });
        setMappings(autoMapped);
        setFileParsing(false);
        setStep(1);

        h.forEach((header) => autoPickMatchField(header, autoMapped[header], rows));
      }, 100);
    };
    reader.onerror = () => {
      setParseError('Failed to read CSV file.');
      setFileParsing(false);
    };
    reader.readAsText(file);
  }, [fieldMetadataList, orgId, objectTypeId, autoPickMatchField]);

  // ── Apply a saved mapping (re-validated against current metadata) ──────────
  const applyMapping = useCallback((savedMapping) => {
    const applied = {};
    headers.forEach((h) => {
      const saved = savedMapping.mappingConfig[h];
      const f = saved?.targetField && fieldMetadataList.find((x) => x.key === saved.targetField);
      applied[h] = f
        ? { ...saved, isRelationship: f.isRelationship, targetObjectType: f.targetObject || saved.targetObjectType || null }
        : mappingFor(mapHeaderToField(h, fieldMetadataList)); // field no longer exists → fall back to auto-map
    });
    setMappings(applied);
    setFoundSavedMapping(null);
    headers.forEach((h) => {
      if (applied[h].targetObjectType) loadLookupOptions(applied[h].targetObjectType);
      autoPickMatchField(h, applied[h], allRows);
    });
  }, [headers, fieldMetadataList, allRows, loadLookupOptions, autoPickMatchField]);

  // ── Mapping change ─────────────────────────────────────────────────────────
  const handleMappingChange = useCallback((header, newMapping) => {
    setMappings((prev) => ({ ...prev, [header]: newMapping }));
    setRelationshipPreviews({}); // mapping changed, previous validation no longer applies
    if (newMapping.targetObjectType) loadLookupOptions(newMapping.targetObjectType);
    autoPickMatchField(header, newMapping, allRows);
  }, [loadLookupOptions, autoPickMatchField, allRows]);

  // ── Relationship columns that have data and are fully configured ───────────
  const columnHasValues = useCallback(
    (h) => allRows.some((row) => cellValue(row[h]) !== ''),
    [allRows]
  );

  // ── Validate: resolve unique values from ALL rows, in chunks ───────────────
  //
  // Only EXPLICITLY MAPPED lookup columns are validated.
  // Unmapped lookup/relationship columns (e.g. "Associated Contact IDs") are
  // completely ignored — no Match By, no validation, no resolve-relationships call.
  const handleValidate = useCallback(async () => {
    setValidating(true);
    const previews = {};

    // Only relationship columns that are explicitly mapped, configured, and have values
    const lookupHeaders = headers.filter((h) => {
      const cfg = mappings[h];
      return cfg?.isRelationship && cfg.targetField && cfg.targetObjectType && cfg.matchField && columnHasValues(h);
    });

    // Group by (targetObjectType, matchField) so we batch the resolver calls
    const groupMap = {};
    lookupHeaders.forEach((h) => {
      const cfg = mappings[h];
      const gKey = `${cfg.targetObjectType}::${cfg.matchField}`;
      if (!groupMap[gKey]) {
        groupMap[gKey] = {
          targetObjectType: cfg.targetObjectType,
          matchField: cfg.matchField,
          valueSet: new Set(),
          headers: new Set(),
        };
      }
      groupMap[gKey].headers.add(h);
      allRows.forEach((row) => {
        const val = cellValue(row[h]);
        if (val) groupMap[gKey].valueSet.add(val);
      });
    });

    // Resolve each (targetObjectType, matchField) group
    await Promise.all(Object.entries(groupMap).map(async ([, group]) => {
      const values = [...group.valueSet];
      const results = {};
      for (let i = 0; i < values.length; i += RESOLVE_CHUNK) {
        const slice = values.slice(i, i + RESOLVE_CHUNK);
        try {
          const res = await apiPost('/import/resolve-relationships', {
            targetObjectType: group.targetObjectType,
            matchField: group.matchField,
            values: slice,
          });
          slice.forEach((v) => { results[v] = res?.results?.[v] || { status: 'not_found' }; });
        } catch (err) {
          slice.forEach((v) => { results[v] = { status: 'error', reason: err?.message || 'Lookup failed' }; });
        }
      }

      // Store results under each header that feeds into this group
      group.headers.forEach((h) => {
        previews[h] = previews[h] || {};
        values.forEach((v) => { previews[h][v] = results[v]; });
      });
    }));

    setRelationshipPreviews(previews);
    setValidating(false);
    setStep(2);
  }, [headers, mappings, allRows, columnHasValues]);


  // ── Import ─────────────────────────────────────────────────────────────────
  const handleImport = useCallback(async () => {
    setStep(3);
    setImportProgress('Preparing records…');

    const relErrors = new Map(); // rowNum → reason (rows that cannot be linked are not sent)

    // First mapped plain field is used to label rows in the result table
    const identifierField = mappings[headers.find((h) => mappings[h]?.targetField && !mappings[h].isRelationship)]?.targetField;

    const mappedRows = allRows.map((row, idx) => {
      const record = { __rowNum: idx + 2 }; // row 1 is the header
      const lookupGroups = {};              // targetField → [{ header, cfg }]

      headers.forEach((h) => {
        const cfg = mappings[h];
        if (!cfg?.targetField) return;
        if (cfg.isRelationship) {
          (lookupGroups[cfg.targetField] = lookupGroups[cfg.targetField] || []).push({ header: h, cfg });
        } else {
          const val = cellValue(row[h]);
          if (val) record[cfg.targetField] = val;
        }
      });

      // Relationship: the first NON-EMPTY explicitly mapped value by priority decides.
      // Only columns that were mapped + validated are considered.
      Object.entries(lookupGroups).forEach(([targetField, entries]) => {
        const sorted = [...entries].sort((a, b) =>
          ((a.cfg.priority || 1) - (b.cfg.priority || 1)) ||
          ((b.cfg.matchField === RECORD_ID_OPTION.key) - (a.cfg.matchField === RECORD_ID_OPTION.key))
        );
        for (const { header, cfg } of sorted) {
          const val = cellValue(row[header]);
          if (!val) continue; // blank → try the next priority
          if (!cfg.targetObjectType || !cfg.matchField) {
            relErrors.set(record.__rowNum, `${targetField}: "${val}" has no Match By configured`);
            break;
          }
          // Look up the validation result directly from previews for this mapped column
          const r = relationshipPreviews[header]?.[val];
          if (r?.status === 'resolved' && r.resolvedId) {
            record[targetField] = r.resolvedId;
          } else {
            relErrors.set(record.__rowNum, `${targetField}: "${val}" → ${r?.reason || r?.status || 'not validated'}`);
          }
          break;
        }
      });


      return record;
    });

    // Rows with nothing mapped are dropped
    const validRows = mappedRows.filter((r) => {
      const { __rowNum, ...fields } = r;
      return Object.values(fields).some((v) => v !== null && v !== undefined && String(v).trim() !== '');
    });
    const sendRows = validRows.filter((r) => !relErrors.has(r.__rowNum));

    const successRowNums = new Set();
    const backendErrors = [];
    const totalBatches = Math.ceil(sendRows.length / BATCH_SIZE);

    for (let i = 0; i < sendRows.length; i += BATCH_SIZE) {
      const batchIndex = Math.floor(i / BATCH_SIZE);
      const batch = sendRows.slice(i, i + BATCH_SIZE);
      setImportProgress(`Processing batch ${batchIndex + 1} of ${totalBatches} (${Math.min(i + batch.length, sendRows.length)} / ${sendRows.length} records)…`);

      try {
        const res = await apiPost(`/objects/${objectTypeId}`, batch, { isUserActivity: true });
        const bulkData = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
        bulkData.forEach((item) => { if (item?.__rowNum) successRowNums.add(item.__rowNum); });
        if (Array.isArray(res?.results)) {
          res.results.forEach((r) => {
            if (r.status === 'imported' && r.rowNumber) successRowNums.add(r.rowNumber);
            if (r.status === 'failed') backendErrors.push({ rowNum: r.rowNumber, reason: r.error });
          });
        }
        if (Array.isArray(res?.errors)) backendErrors.push(...res.errors);

        // Request succeeded but the response carries no per-row detail → the whole batch succeeded
        const hasRowInfo = Array.isArray(res?.results) || Array.isArray(res?.errors) || bulkData.some((x) => x?.__rowNum);
        if (!hasRowInfo) batch.forEach((r) => successRowNums.add(r.__rowNum));
      } catch (err) {
        if (err?.status === 401) break;
        const errData = err?.data || {};
        if (errData?.data?.length) errData.data.forEach((item) => { if (item.__rowNum) successRowNums.add(item.__rowNum); });
        if (errData?.errors) backendErrors.push(...errData.errors);
        batch.forEach((r) => {
          if (!successRowNums.has(r.__rowNum) && !backendErrors.some((e) => e.rowNum === r.__rowNum)) {
            backendErrors.push({ rowNum: r.__rowNum, reason: err?.message || 'Import failed' });
          }
        });
      }
    }

    const rows = validRows.map((r) => {
      const isSuccess = successRowNums.has(r.__rowNum);
      const errObj = backendErrors.find((e) => e.rowNum === r.__rowNum);
      return {
        rowNum: r.__rowNum,
        identifier: (identifierField && r[identifierField]) || `Row ${r.__rowNum}`,
        status: isSuccess ? 'imported' : 'failed',
        reason: isSuccess ? '—' : (relErrors.get(r.__rowNum) || errObj?.reason || 'Validation error'),
      };
    });
    const report = {
      totalProcessed: rows.length,
      createdCount: rows.filter((r) => r.status === 'imported').length,
      failedCount: rows.filter((r) => r.status === 'failed').length,
      rows,
    };

    setImportReport(report);
    setImportProgress('');
    setStep(4);
    if (onImportComplete) onImportComplete(report);
  }, [allRows, headers, mappings, objectTypeId, relationshipPreviews, onImportComplete]);

  // ── Counts ─────────────────────────────────────────────────────────────────
  const { mappedCount, unmappedCount, lookupCount } = useMemo(() => {
    let mc = 0, uc = 0, lc = 0;
    headers.forEach((h) => {
      const m = mappings[h];
      if (m?.targetField) {
        mc++;
        if (m.isRelationship) lc++;
      } else uc++;
    });
    return { mappedCount: mc, unmappedCount: uc, lookupCount: lc };
  }, [headers, mappings]);

  // ── Filter headers by rowSearchTerm ─────────────────────────────────────────
  const filteredHeaders = useMemo(() => {
    if (!rowSearchTerm.trim()) return headers;
    const term = rowSearchTerm.toLowerCase();
    return headers.filter((h) => {
      const targetKey = mappings[h]?.targetField || '';
      const meta = fieldMetadataList.find((f) => f.key === targetKey);
      const targetLabel = meta?.label || targetKey;
      return (
        h.toLowerCase().includes(term) ||
        targetKey.toLowerCase().includes(term) ||
        targetLabel.toLowerCase().includes(term)
      );
    });
  }, [headers, rowSearchTerm, mappings, fieldMetadataList]);

  // ── Validation issues ──────────────────────────────────────────────────────
  const validationIssues = useMemo(() => {
    const issues = [];

    // Required fields nobody mapped
    const mappedKeys = new Set(Object.values(mappings).map((m) => m?.targetField).filter(Boolean));
    fieldMetadataList
      .filter((f) => f.isRequired && !mappedKeys.has(f.key))
      .forEach((f) => issues.push({ type: 'warning', msg: `Required field "${f.label}" is not mapped.` }));

    // Relationship columns that have data but no Match By
    headers.forEach((h) => {
      const m = mappings[h];
      if (m?.isRelationship && columnHasValues(h) && (!m.targetObjectType || !m.matchField)) {
        issues.push({ type: 'error', msg: `"${h}" is mapped to a relationship but has no Match By configured. Its rows will fail.` });
      }
    });

    // Resolution results across all rows
    Object.entries(relationshipPreviews).forEach(([h, preview]) => {
      const entries = Object.values(preview);
      const notFound = entries.filter((r) => r.status === 'not_found').length;
      const ambiguous = entries.filter((r) => r.status === 'ambiguous').length;
      const other = entries.filter((r) => ['invalid', 'error'].includes(r.status)).length;
      if (notFound) issues.push({ type: 'error', msg: `"${h}": ${notFound} value(s) not found in the target object.` });
      if (ambiguous) issues.push({ type: 'error', msg: `"${h}": ${ambiguous} value(s) match multiple records (ambiguous).` });
      if (other) issues.push({ type: 'error', msg: `"${h}": ${other} value(s) could not be checked.` });
    });
    return issues;
  }, [headers, mappings, fieldMetadataList, relationshipPreviews, columnHasValues]);

  // ── Save mapping ───────────────────────────────────────────────────────────
  const handleSaveMapping = () => {
    const name = saveMappingName.trim() || `${objectDisplayName} Import`;
    saveMapping(orgId, objectTypeId, name, headers, mappings);
    setSavedMappings(listSavedMappings(orgId, objectTypeId));
    setShowSaveInput(false);
    setSaveMappingName('');
  };

  if (!open) return null;

  // ── Styles ─────────────────────────────────────────────────────────────────
  const STEP_LABELS = ['Upload', 'Map Fields', 'Validate', 'Importing', 'Result'];
  const btnPrimary = {
    padding: '10px 22px', borderRadius: 12, border: 'none',
    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
    color: '#fff', fontWeight: 700, fontSize: '0.84rem', cursor: 'pointer',
    boxShadow: '0 6px 18px -4px rgba(99,102,241,0.5)', display: 'flex', alignItems: 'center', gap: 6,
  };
  const btnSecondary = {
    padding: '10px 18px', borderRadius: 12, border: '1px solid #cbd5e1',
    background: '#fff', color: '#475569', fontWeight: 600, fontSize: '0.84rem', cursor: 'pointer',
  };
  const sectionTitle = { fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 };
  const uploadBlocked = fileParsing || metaLoading || !!metaError;
  const errorCount = validationIssues.filter((i) => i.type === 'error').length;

  return ReactDOM.createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(11, 18, 32, 0.65)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 16px',
    }}>
      <div style={{
        background: '#fff', borderRadius: 24, width: '100%',
        maxWidth: step === 1 ? 860 : 720,
        maxHeight: 'calc(100vh - 40px)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 30px 80px -15px rgba(8,12,28,0.5)', border: '1px solid rgba(226,232,240,0.8)',
        animation: 'ep-rise .3s cubic-bezier(.2,.7,.3,1) both',
      }}>

        {/* ── Header Banner ── */}
        <div style={{
          position: 'relative', overflow: 'hidden', flexShrink: 0,
          background: 'linear-gradient(115deg, #0b1220 0%, #0f1c2e 45%, #0a1e2a 100%)',
          padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,.08)',
        }}>
          <div style={{ position: 'absolute', top: -60, right: -30, width: 160, height: 160, borderRadius: '50%', background: 'rgba(34,211,238,.18)', filter: 'blur(50px)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -60, left: 60, width: 140, height: 140, borderRadius: '50%', background: 'rgba(99,102,241,.22)', filter: 'blur(50px)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 14, flexShrink: 0,
                background: 'linear-gradient(135deg,#6366f1,#22d3ee)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 0 2px rgba(255,255,255,.12), 0 10px 24px -8px rgba(34,211,238,.5)',
              }}>
                <UploadCloud size={20} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '.12em', color: '#a5f3fc', marginBottom: 2 }}>
                  IMPORT ENGINE
                </div>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
                  Import {objectDisplayName} from CSV
                </h2>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 40 }}>
              {STEP_LABELS.map((label, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <div style={{ width: 16, height: 1, background: 'rgba(255,255,255,.2)' }} />}
                  <div style={{
                    fontSize: '0.62rem', fontWeight: 700, letterSpacing: '.06em',
                    color: i === step ? '#22d3ee' : (i < step ? '#6ee7b7' : 'rgba(255,255,255,.35)'),
                    transition: 'color 0.2s',
                  }}>
                    {label.toUpperCase()}
                  </div>
                </React.Fragment>
              ))}
            </div>

            <button
              type="button" onClick={onClose}
              style={{
                position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)',
                background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.16)',
                borderRadius: 10, width: 30, height: 30, display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: '#cbd5e1', cursor: 'pointer',
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,.16)'; e.currentTarget.style.color = '#fff'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,.08)'; e.currentTarget.style.color = '#cbd5e1'; }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* STEP 0: Upload */}
          {step === 0 && (
            <div>
              {parseError && (
                <div style={{ marginBottom: 14, padding: '12px 16px', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 12, color: '#9f1239', fontSize: '0.82rem', display: 'flex', gap: 10, alignItems: 'center' }}>
                  <AlertTriangle size={16} style={{ flexShrink: 0 }} /> {parseError}
                </div>
              )}
              {metaError && (
                <div style={{ marginBottom: 14, padding: '12px 16px', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 12, color: '#9f1239', fontSize: '0.82rem', display: 'flex', gap: 10, alignItems: 'center' }}>
                  <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                  Could not load CRM fields ({metaError}). Close and reopen the import, or check the browser console.
                </div>
              )}
              {metaLoading && (
                <div style={{ textAlign: 'center', padding: '12px 0', color: '#6366f1', fontSize: '0.82rem' }}>
                  <RefreshCw size={14} style={{ animation: 'ep-spin .8s linear infinite', marginRight: 6 }} />
                  Loading field metadata…
                </div>
              )}
              <div
                onClick={() => !uploadBlocked && fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); if (!uploadBlocked) setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (!uploadBlocked && e.dataTransfer.files?.[0]) handleFileProcess(e.dataTransfer.files[0]); }}
                style={{
                  border: isDragging ? '2.5px dashed #6366f1' : '2px dashed #cbd5e1',
                  borderRadius: 18, padding: '40px 24px', textAlign: 'center',
                  background: fileParsing ? 'rgba(99,102,241,0.06)' : (isDragging ? 'rgba(99,102,241,0.04)' : '#f8fafc'),
                  cursor: fileParsing ? 'wait' : (metaLoading ? 'not-allowed' : 'pointer'),
                  opacity: metaLoading ? 0.6 : 1, transition: 'all 0.2s ease',
                }}
              >
                <input ref={fileInputRef} type="file" accept=".csv"
                  onChange={(e) => { if (e.target.files?.[0]) handleFileProcess(e.target.files[0]); }}
                  style={{ display: 'none' }}
                  disabled={uploadBlocked}
                />
                {fileParsing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(99,102,241,0.12)', color: '#6366f1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                      <RefreshCw size={26} style={{ animation: 'ep-spin 0.8s linear infinite' }} />
                    </div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#4f46e5', marginBottom: 4 }}>Processing CSV File…</div>
                    <div style={{ fontSize: '0.82rem', color: '#64748b' }}>Reading columns &amp; suggesting CRM fields</div>
                  </div>
                ) : (
                  <>
                    <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(99,102,241,0.1)', color: '#6366f1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                      <UploadCloud size={26} />
                    </div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>Click or Drag &amp; Drop CSV</div>
                    <div style={{ fontSize: '0.82rem', color: '#64748b' }}>Upload a comma-separated values file (.csv)</div>
                  </>
                )}
              </div>

              {savedMappings.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={sectionTitle}>Saved Mappings</div>
                  {savedMappings.map((m) => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 6 }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e293b' }}>{m.name}</span>
                      <button type="button" onClick={() => { deleteMapping(orgId, objectTypeId, m.id); setSavedMappings(listSavedMappings(orgId, objectTypeId)); }}
                        style={{ background: 'none', border: 'none', color: '#fb7185', cursor: 'pointer', padding: 4, display: 'flex' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 1: Map Fields */}
          {step === 1 && (
            <div>
              {foundSavedMapping && (
                <div style={{ marginBottom: 14, padding: '12px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Sparkles size={16} style={{ color: '#3b82f6' }} />
                    <div style={{ fontSize: '0.82rem', color: '#1e40af' }}>
                      <strong>Previous mapping found:</strong> "{foundSavedMapping.name}"
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => applyMapping(foundSavedMapping)}
                      style={{ padding: '5px 12px', borderRadius: 8, background: '#3b82f6', border: 'none', color: '#fff', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer' }}>
                      Apply
                    </button>
                    <button type="button" onClick={() => setFoundSavedMapping(null)}
                      style={{ padding: '5px 10px', borderRadius: 8, background: 'transparent', border: '1px solid #93c5fd', color: '#3b82f6', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer' }}>
                      Review
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ padding: '6px 12px', borderRadius: 20, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: '0.74rem', fontWeight: 700, color: '#16a34a' }}>
                  ✓ {mappedCount} mapped
                </div>
                {unmappedCount > 0 && (
                  <div style={{ padding: '6px 12px', borderRadius: 20, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '0.74rem', fontWeight: 700, color: '#94a3b8' }}>
                    — {unmappedCount} unmapped (will be skipped)
                  </div>
                )}
                {lookupCount > 0 && (
                  <div style={{ padding: '6px 12px', borderRadius: 20, background: '#f5f3ff', border: '1px solid #ddd6fe', fontSize: '0.74rem', fontWeight: 700, color: '#7c3aed' }}>
                    <Link2 size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    {lookupCount} relationship{lookupCount > 1 ? 's' : ''}
                  </div>
                )}

                {/* Search Bar for filtering CSV Column Rows */}
                <div style={{ position: 'relative', flex: 1, minWidth: 180, maxWidth: 280, display: 'flex', alignItems: 'center' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, color: '#94a3b8', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    placeholder="Search columns or fields…"
                    value={rowSearchTerm}
                    onChange={(e) => setRowSearchTerm(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 28px 6px 30px',
                      fontSize: '0.78rem',
                      borderRadius: 20,
                      border: '1px solid #cbd5e1',
                      background: '#f8fafc',
                      color: '#1e293b',
                      outline: 'none',
                      transition: 'all 0.15s ease',
                    }}
                    onFocus={(e) => { e.target.style.borderColor = '#6366f1'; e.target.style.background = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#cbd5e1'; e.target.style.background = '#f8fafc'; e.target.style.boxShadow = 'none'; }}
                  />
                  {rowSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setRowSearchTerm('')}
                      style={{
                        position: 'absolute', right: 8, background: 'none', border: 'none',
                        color: '#94a3b8', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center'
                      }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: 20, background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: '0.74rem', fontWeight: 700, color: '#2563eb' }}>
                  {allRows.length} records
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 28px 1fr 36px', gap: 8, padding: '6px 14px', background: '#f8fafc', borderRadius: '10px 10px 0 0', border: '1px solid #e2e8f0', borderBottom: 'none' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.07em' }}>CSV Column / Sample</div>
                <div />
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.07em' }}>CRM Field</div>
                <div />
              </div>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: '0 0 12px 12px', overflow: 'hidden', maxHeight: 380, overflowY: 'auto' }}>
                {filteredHeaders.length === 0 ? (
                  <div style={{ padding: '36px 16px', textAlign: 'center', color: '#64748b', fontSize: '0.84rem' }}>
                    No CSV columns or mapped fields match "<strong>{rowSearchTerm}</strong>"
                  </div>
                ) : (
                  filteredHeaders.map((header) => (
                    <FieldMappingRow
                      key={header}
                      header={header}
                      sampleValues={sampleRows.map((r) => r[header]).filter(Boolean)}
                      mapping={mappings[header]}
                      fieldMetadataList={fieldMetadataList}
                      lookupFieldOptions={lookupFieldOptions}
                      onMappingChange={handleMappingChange}
                      isDisabled={validating}
                      allMappings={mappings}
                    />
                  ))
                )}
              </div>

              <div style={{ marginTop: 14 }}>
                {showSaveInput ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="text" placeholder={`${objectDisplayName} Import`}
                      value={saveMappingName} onChange={(e) => setSaveMappingName(e.target.value)}
                      style={{ flex: 1, padding: '7px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.82rem' }}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveMapping(); }}
                    />
                    <button type="button" onClick={handleSaveMapping}
                      style={{ ...btnPrimary, padding: '7px 14px', fontSize: '0.78rem' }}>
                      <Save size={13} /> Save
                    </button>
                    <button type="button" onClick={() => setShowSaveInput(false)}
                      style={{ ...btnSecondary, padding: '7px 14px', fontSize: '0.78rem' }}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setShowSaveInput(true)}
                    style={{ padding: '6px 14px', borderRadius: 8, background: 'none', border: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Save size={12} /> Save this mapping
                  </button>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: Validate */}
          {step === 2 && (
            <div>
              {validationIssues.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={sectionTitle}>Validation Issues</div>
                  {validationIssues.map((issue, i) => (
                    <div key={i} style={{
                      padding: '8px 12px', borderRadius: 10, marginBottom: 6, display: 'flex', alignItems: 'flex-start', gap: 8,
                      background: issue.type === 'error' ? '#fff1f2' : '#fffbeb',
                      border: `1px solid ${issue.type === 'error' ? '#fecdd3' : '#fde68a'}`,
                      color: issue.type === 'error' ? '#9f1239' : '#78350f',
                      fontSize: '0.8rem',
                    }}>
                      <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                      {issue.msg}
                    </div>
                  ))}
                </div>
              )}

              {Object.keys(relationshipPreviews).length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={sectionTitle}>Relationship Check (all rows)</div>
                  {Object.entries(relationshipPreviews).map(([header, preview]) => {
                    const entries = Object.entries(preview);
                    const ok = entries.filter(([, r]) => r.status === 'resolved').length;
                    // problems first so they are never hidden below the fold
                    const sorted = [...entries].sort(([, a], [, b]) => (a.status === 'resolved') - (b.status === 'resolved'));
                    const matchLabel = (lookupFieldOptions[mappings[header]?.targetObjectType] || []).find((o) => o.key === mappings[header]?.matchField)?.label || mappings[header]?.matchField;
                    return (
                      <div key={header} style={{ marginBottom: 10, border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                        <div style={{ padding: '8px 12px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '0.76rem', fontWeight: 700, color: '#334155', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <span>
                            {header} → {fieldMetadataList.find((f) => f.key === mappings[header]?.targetField)?.label} (match by {matchLabel})
                          </span>
                          <span style={{ color: ok === entries.length ? '#16a34a' : '#d97706' }}>{ok} / {entries.length} found</span>
                        </div>
                        <div style={{ maxHeight: 160, overflowY: 'auto' }}>
                          {sorted.slice(0, 50).map(([val, result]) => (
                            <div key={val} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', borderBottom: '1px solid #f1f5f9', fontSize: '0.78rem' }}>
                              <StatusIcon status={result.status} />
                              <span style={{ flex: 1, color: '#334155', fontWeight: 500 }}>{val}</span>
                              <span style={{ color: result.status === 'resolved' ? '#16a34a' : (result.status === 'ambiguous' ? '#d97706' : '#dc2626'), fontSize: '0.74rem', fontWeight: 600 }}>
                                {result.status === 'resolved' ? (result.resolvedName || 'Found') : (result.reason || result.status.replace('_', ' '))}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ padding: '14px 16px', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', fontSize: '0.82rem', color: '#334155' }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Ready to import</div>
                <div><strong>{allRows.length}</strong> records · <strong>{mappedCount}</strong> mapped fields · <strong>{lookupCount}</strong> relationship fields</div>
                {errorCount > 0 && (
                  <div style={{ marginTop: 6, color: '#dc2626', fontWeight: 600 }}>
                    ⚠ {errorCount} issue(s) found. Rows whose relationship cannot be resolved will not be imported and will be listed as failed.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: Importing */}
          {step === 3 && (
            <div style={{ textAlign: 'center', padding: '40px 24px' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(99,102,241,0.1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <RefreshCw size={26} style={{ color: '#6366f1', animation: 'ep-spin .8s linear infinite' }} />
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>Importing…</div>
              <div style={{ fontSize: '0.82rem', color: '#64748b' }}>{importProgress}</div>
            </div>
          )}

          {/* STEP 4: Result */}
          {step === 4 && importReport && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1, padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14 }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Total</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a' }}>{importReport.totalProcessed}</div>
                </div>
                <div style={{ flex: 1, padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 14 }}>
                  <div style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 700, textTransform: 'uppercase' }}>✓ Imported</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#16a34a' }}>{importReport.createdCount}</div>
                </div>
                <div style={{ flex: 1, padding: '12px 16px', background: importReport.failedCount > 0 ? '#fff1f2' : '#f8fafc', border: `1px solid ${importReport.failedCount > 0 ? '#fecdd3' : '#e2e8f0'}`, borderRadius: 14 }}>
                  <div style={{ fontSize: '0.72rem', color: importReport.failedCount > 0 ? '#9f1239' : '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>✕ Failed</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: importReport.failedCount > 0 ? '#e11d48' : '#0f172a' }}>{importReport.failedCount}</div>
                </div>
              </div>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', maxHeight: 300, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0 }}>
                      <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569', width: 70 }}>Row</th>
                      <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569' }}>Record</th>
                      <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569', width: 100 }}>Status</th>
                      <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569' }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importReport.rows.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: r.status === 'failed' ? '#fff1f210' : '#fff' }}>
                        <td style={{ padding: '8px 12px', color: '#94a3b8', fontWeight: 700 }}>{r.rowNum}</td>
                        <td style={{ padding: '8px 12px', color: '#0f172a', fontWeight: 600 }}>{r.identifier}</td>
                        <td style={{ padding: '8px 12px' }}>
                          {r.status === 'imported'
                            ? <span style={{ color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700 }}>✓ Imported</span>
                            : <span style={{ color: '#e11d48', background: '#fff1f2', border: '1px solid #fecdd3', padding: '2px 8px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700 }}>✕ Failed</span>
                          }
                        </td>
                        <td style={{ padding: '8px 12px', color: r.status === 'failed' ? '#dc2626' : '#64748b', fontSize: '0.76rem', fontWeight: r.status === 'failed' ? 600 : 400 }}>{r.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10,
          padding: '14px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', flexShrink: 0,
        }}>
          {step === 0 && (
            <button type="button" onClick={onClose} style={btnSecondary}>Cancel</button>
          )}

          {step === 1 && (
            <>
              <button type="button" onClick={reset} style={btnSecondary}>← Change File</button>
              {/* Validation is always the next step, with or without relationships */}
              <button
                type="button"
                onClick={handleValidate}
                disabled={mappedCount === 0 || validating}
                style={{ ...btnPrimary, opacity: (mappedCount === 0 || validating) ? 0.5 : 1 }}
              >
                {validating
                  ? <><RefreshCw size={14} style={{ animation: 'ep-spin .8s linear infinite' }} /> Validating…</>
                  : <><Check size={14} /> {lookupCount > 0 ? 'Validate Relationships' : 'Validate Mapping'}</>}
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <button type="button" onClick={() => setStep(1)} style={btnSecondary}>← Edit Mapping</button>
              <button type="button" onClick={handleImport} style={btnPrimary}>
                <UploadCloud size={14} /> Import {allRows.length} Records
              </button>
            </>
          )}

          {step === 3 && (
            <div style={{ fontSize: '0.82rem', color: '#6366f1', fontWeight: 600 }}>{importProgress}</div>
          )}

          {step === 4 && (
            <>
              <button type="button" onClick={reset} style={btnSecondary}>Import Another File</button>
              <button type="button" onClick={onClose} style={btnPrimary}><Check size={14} /> Done</button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}