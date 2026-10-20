import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { ChevronDown, ChevronUp, Check, Search, X } from 'lucide-react';

export default function CustomPicklist({
  value = '',
  onChange,
  options = [],
  placeholder = 'Select option...',
  hasError = false,
  searchable = true,
  disabled = false,
  style = {},
  isMulti = false,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, maxHeight: 220 });
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  // Normalize options array into [{ value, label }] objects
  const rawNormalized = (options || []).map((opt) => {
    if (typeof opt === 'object' && opt !== null) {
      const val = opt.id || opt.user_id || opt.value || opt.name || opt.label || '';
      const lbl = opt.name || opt.displayName || opt.display_name || opt.label || opt.email || opt.title || String(val);
      return { value: String(val), label: String(lbl) };
    }
    return { value: String(opt), label: String(opt) };
  });

  // Multi-select normalized selected value list
  const selectedValues = isMulti
    ? (Array.isArray(value)
        ? value.map(String)
        : (value && typeof value === 'string'
            ? value.split(/[;,]/).map((s) => s.trim()).filter(Boolean)
            : []))
    : [];

  const selectedMultiOpts = isMulti
    ? selectedValues.map((v) => {
        const found = rawNormalized.find((o) => o.value === v);
        return found || { value: v, label: v };
      })
    : [];

  const isValueConfigured = !isMulti && Boolean(
    value !== undefined &&
    value !== null &&
    String(value).trim() !== '' &&
    rawNormalized.some((o) => o.value === String(value))
  );

  const isLegacyValue = !isMulti && Boolean(
    value !== undefined &&
    value !== null &&
    String(value).trim() !== '' &&
    !isValueConfigured
  );

  const selectedOpt = isValueConfigured
    ? rawNormalized.find((o) => o.value === String(value))
    : null;

  const updateCoords = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      // Only flip upwards if space below is severely constrained (< 140px) AND top space is abundant (> 280px)
      const openUp = spaceBelow < 140 && rect.top > 280;

      const calculatedMaxHeight = openUp
        ? Math.min(220, rect.top - 20)
        : Math.max(140, Math.min(220, window.innerHeight - rect.bottom - 16));

      setCoords({
        top: openUp ? Math.max(10, rect.top - calculatedMaxHeight - 6) : rect.bottom + 6,
        left: rect.left,
        width: rect.width,
        maxHeight: calculatedMaxHeight,
      });
    }
  };

  useEffect(() => {
    if (open) {
      updateCoords();
      window.addEventListener('resize', updateCoords);
      window.addEventListener('scroll', updateCoords, true);
    }
    return () => {
      window.removeEventListener('resize', updateCoords);
      window.removeEventListener('scroll', updateCoords, true);
    };
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        buttonRef.current && !buttonRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = rawNormalized.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          updateCoords();
          setOpen((prev) => !prev);
        }}
        style={{
          width: '100%',
          minHeight: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 14px',
          borderRadius: 12,
          border: open
            ? '1.5px solid #6366f1'
            : hasError
            ? '1.5px solid #ef4444'
            : '1px solid #cbd5e1',
          background: disabled ? '#f1f5f9' : '#ffffff',
          color: (selectedOpt || selectedMultiOpts.length > 0) ? '#0f172a' : isLegacyValue ? '#b45309' : '#94a3b8',
          fontSize: '0.88rem',
          fontWeight: (selectedOpt || selectedMultiOpts.length > 0 || isLegacyValue) ? 600 : 400,
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: open
            ? '0 0 0 3.5px rgba(99, 102, 241, 0.15)'
            : '0 1.5px 4px rgba(0,0,0,0.03)',
          transition: 'all 0.15s ease-in-out',
          ...style,
        }}
      >
        {isMulti ? (
          selectedMultiOpts.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', padding: '2px 0' }}>
              {selectedMultiOpts.map((opt) => (
                <span
                  key={opt.value}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: 'rgba(99,102,241,0.1)',
                    border: '1px solid rgba(99,102,241,0.25)',
                    color: '#4338ca',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!disabled && onChange) {
                      const next = selectedValues.filter((v) => v !== opt.value);
                      onChange(next);
                    }
                  }}
                >
                  <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {opt.label}
                  </span>
                  {!disabled && <X size={12} style={{ cursor: 'pointer', opacity: 0.7 }} />}
                </span>
              ))}
            </div>
          ) : (
            <span style={{ color: '#94a3b8', fontWeight: 400 }}>{placeholder}</span>
          )
        ) : (
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            {selectedOpt ? (
              selectedOpt.label
            ) : isLegacyValue ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span>{String(value)}</span>
                <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: 6, background: '#fef3c7', color: '#92400e', fontWeight: 700 }}>Legacy</span>
              </span>
            ) : (
              placeholder
            )}
          </span>
        )}
        {open ? (
          <ChevronUp size={16} style={{ color: '#6366f1', flexShrink: 0, marginLeft: 6 }} />
        ) : (
          <ChevronDown size={16} style={{ color: '#94a3b8', flexShrink: 0, marginLeft: 6 }} />
        )}
      </button>

      {open &&
        ReactDOM.createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              width: coords.width,
              zIndex: 9999999,
              background: '#ffffff',
              borderRadius: 14,
              border: '1px solid #e2e8f0',
              boxShadow: '0 20px 45px -8px rgba(0, 0, 0, 0.22), 0 8px 16px rgba(0,0,0,0.06)',
              overflow: 'hidden',
            }}
          >
            {/* Search Input Bar (if enabled) */}
            {searchable && (
              <div style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search size={13} style={{ position: 'absolute', left: 10, color: '#94a3b8' }} />
                  <input
                    type="text"
                    placeholder="Search options..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '6px 10px 6px 28px',
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: 12,
                      color: '#1e293b',
                      outline: 'none',
                    }}
                  />
                  {search && (
                    <X
                      size={13}
                      onClick={() => setSearch('')}
                      style={{ position: 'absolute', right: 8, color: '#94a3b8', cursor: 'pointer' }}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Multi-select Header (Clear all & count) */}
            {isMulti && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 14px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', fontSize: 11.5 }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>{selectedValues.length} selected</span>
                {selectedValues.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onChange([])}
                    style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: 11, fontWeight: 700, padding: 0 }}
                  >
                    Clear all
                  </button>
                )}
              </div>
            )}

            {/* Non-selectable legacy notice if current value is unconfigured */}
            {isLegacyValue && (
              <div
                style={{
                  padding: '8px 12px',
                  margin: '8px 10px 4px',
                  fontSize: 11.5,
                  color: '#92400e',
                  backgroundColor: '#fef3c7',
                  border: '1px solid #fde68a',
                  borderRadius: 8,
                  lineHeight: 1.4,
                }}
              >
                Current saved value: <strong>{String(value)}</strong> (legacy). Select an allowed option below:
              </div>
            )}

            {/* Options List */}
            <div className="orbit-scrollbar" style={{ maxHeight: coords.maxHeight || 210, overflowY: 'auto', padding: '4px 0' }}>
              {/* Optional Placeholder / Clear Selection option for single-select */}
              {!isMulti && (
                <div
                  onClick={() => {
                    onChange('');
                    setOpen(false);
                    setSearch('');
                  }}
                  style={{
                    padding: '9px 14px',
                    fontSize: 12.5,
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontStyle: 'italic',
                    background: 'transparent',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {placeholder}
                </div>
              )}

              {filteredOptions.length === 0 ? (
                <div style={{ padding: '12px', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
                  No matching options
                </div>
              ) : (
                filteredOptions.map((o) => {
                  const isSelected = isMulti ? selectedValues.includes(o.value) : o.value === String(value);
                  return (
                    <div
                      key={o.value}
                      onClick={() => {
                        if (isMulti) {
                          const next = isSelected
                            ? selectedValues.filter((v) => v !== o.value)
                            : [...selectedValues, o.value];
                          onChange(next);
                        } else {
                          onChange(o.value);
                          setOpen(false);
                          setSearch('');
                        }
                      }}
                      style={{
                        padding: '9px 14px',
                        fontSize: 13,
                        fontWeight: isSelected ? 600 : 400,
                        color: isSelected ? '#4338ca' : '#1e293b',
                        background: isSelected ? 'rgba(99,102,241,0.08)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'background 0.1s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {o.label}
                      </span>
                      {isSelected ? (
                        <div style={{ width: 16, height: 16, borderRadius: 4, background: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Check size={12} color="#fff" strokeWidth={3} />
                        </div>
                      ) : isMulti ? (
                        <div style={{ width: 16, height: 16, borderRadius: 4, border: '1.5px solid #cbd5e1' }} />
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
