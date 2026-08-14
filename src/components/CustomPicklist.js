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
      const lbl = opt.name || opt.displayName || opt.label || opt.email || opt.title || String(val);
      return { value: String(val), label: String(lbl) };
    }
    return { value: String(opt), label: String(opt) };
  });

  const normalizedOptions = [...rawNormalized];
  if (value && String(value).trim() !== '' && !normalizedOptions.some((o) => o.value === String(value))) {
    normalizedOptions.unshift({ value: String(value), label: String(value) });
  }

  const selectedOpt = normalizedOptions.find((o) => o.value === String(value));

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

  const filteredOptions = normalizedOptions.filter((o) =>
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
          padding: '0 14px',
          borderRadius: 12,
          border: open
            ? '1.5px solid #6366f1'
            : hasError
            ? '1.5px solid #ef4444'
            : '1px solid #cbd5e1',
          background: disabled ? '#f1f5f9' : '#ffffff',
          color: selectedOpt ? '#0f172a' : '#94a3b8',
          fontSize: '0.88rem',
          fontWeight: selectedOpt ? 600 : 400,
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: open
            ? '0 0 0 3.5px rgba(99, 102, 241, 0.15)'
            : '0 1.5px 4px rgba(0,0,0,0.03)',
          transition: 'all 0.15s ease-in-out',
          ...style,
        }}
      >
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 8 }}>
          {selectedOpt ? selectedOpt.label : placeholder}
        </span>
        {open ? (
          <ChevronUp size={16} style={{ color: '#6366f1', flexShrink: 0 }} />
        ) : (
          <ChevronDown size={16} style={{ color: '#94a3b8', flexShrink: 0 }} />
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
            {/* Search Input Bar (if enabled and options > 5) */}
            {searchable && normalizedOptions.length > 5 && (
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

            {/* Options List */}
            <div className="orbit-scrollbar" style={{ maxHeight: coords.maxHeight || 210, overflowY: 'auto', padding: '4px 0' }}>
              {/* Optional Placeholder / Clear Selection option */}
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

              {filteredOptions.length === 0 ? (
                <div style={{ padding: '12px', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
                  No matching options
                </div>
              ) : (
                filteredOptions.map((o) => {
                  const isSelected = o.value === String(value);
                  return (
                    <div
                      key={o.value}
                      onClick={() => {
                        onChange(o.value);
                        setOpen(false);
                        setSearch('');
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
                      {isSelected && <Check size={15} style={{ color: '#4338ca', flexShrink: 0 }} />}
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
