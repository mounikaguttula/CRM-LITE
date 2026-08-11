import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWorkspace } from '../context/WorkspaceContext';
import { Search, Bell, Menu, Settings, Command, ArrowRight, Sparkles, Layers } from 'lucide-react';

function Navbar({ onMenuToggle }) {
  const { currentUser } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();

  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const searchInputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Keyboard shortcut listener (Cmd + K or Ctrl + K) & Outside Click listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          setIsOpen(true);
        }
      }
    };

    const handleClickOutside = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Predefined CRM Navigation Routes for Instant Search
  const NAVIGATION_ITEMS = [
    { label: 'Deals Workspace', route: '/workspace/object/deal', keywords: ['deal', 'deals', 'opportunity', 'pipeline', 'revenue'], category: 'CRM Modules' },
    { label: 'Leads Workspace', route: '/workspace/object/lead', keywords: ['lead', 'leads', 'prospect', 'incoming'], category: 'CRM Modules' },
    { label: 'Contacts Directory', route: '/workspace/object/contact', keywords: ['contact', 'contacts', 'people', 'person', 'email'], category: 'CRM Modules' },
    { label: 'Companies Directory', route: '/workspace/object/company', keywords: ['company', 'companies', 'account', 'accounts', 'org'], category: 'CRM Modules' },
    { label: 'Campaigns & Marketing', route: '/workspace/campaigns', keywords: ['campaign', 'campaigns', 'marketing', 'outreach'], category: 'CRM Modules' },
    { label: 'Lead QR & Barcode Scanner', route: '/workspace/lead-scanner', keywords: ['scan', 'scanner', 'qr', 'barcode', 'vcard'], category: 'Tools' },
    { label: 'Validation Rules Policy', route: '/setup?tab=validation', keywords: ['validation', 'rule', 'rules', 'policy', 'data'], category: 'Settings' },
    { label: 'CRM Executive Dashboard', route: '/workspace/dashboard', keywords: ['dashboard', 'overview', 'stats', 'analytics', 'home'], category: 'Navigation' },
    { label: 'Setup & System Admin', route: '/setup', keywords: ['setup', 'admin', 'users', 'roles', 'modules', 'settings'], category: 'Settings' },
  ];

  // Filter matching results based on search input
  const filteredResults = searchTerm.trim() === ''
    ? NAVIGATION_ITEMS
    : NAVIGATION_ITEMS.filter((item) => {
        const query = searchTerm.toLowerCase().trim();
        return (
          item.label.toLowerCase().includes(query) ||
          item.keywords.some((kw) => kw.toLowerCase().includes(query))
        );
      });

  const handleSelectRoute = (route) => {
    navigate(route);
    setSearchTerm('');
    setIsOpen(false);
    if (searchInputRef.current) searchInputRef.current.blur();
  };

  const handleKeyDownInput = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredResults.length > 0) {
        handleSelectRoute(filteredResults[0].route);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      if (searchInputRef.current) searchInputRef.current.blur();
    }
  };

  const getPageTitles = () => {
    const path = location.pathname;
    const search = location.search;
    const params = new URLSearchParams(search);
    const tab = params.get('tab');

    if (path.startsWith('/setup')) {
      if (tab === 'company' || tab === 'general') return ['Company Info', 'Manage your organization profile and settings.'];
      if (tab === 'users')   return ['User Management', 'Manage team members and their access.'];
      if (tab === 'roles')   return ['Roles & Permissions', 'Configure security roles and policies.'];
      if (tab === 'modules') return ['Module Manager', 'Customize objects, fields, and schemas.'];
      if (tab === 'validation') return ['Validation Rules', 'Configure field-level data policies.'];
      if (tab === 'automations') return ['Flow Automations', 'Automate business workflows.'];
      return ['Setup & Administration', 'Configure your CRM platform.'];
    }
    if (path.includes('/dashboard'))         return ["Dashboard", "Welcome back — here's how the business is performing today."];
    if (path.includes('/object/leads') || path.includes('/object/lead'))      return ["Leads", "Manage and track new incoming business leads."];
    if (path.includes('/object/deals') || path.includes('/object/deal'))      return ["Deals", "Track pipeline opportunities and revenue progress."];
    if (path.includes('/object/contacts') || path.includes('/object/contact'))   return ["Contacts", "Every person and relationship in your workspace."];
    if (path.includes('/object/companies') || path.includes('/object/company'))  return ["Companies", "Accounts, organizations, and corporate partners."];
    return ["CRM Workspace", "Manage business operations and performance."];
  };

  const [title, subtitle] = getPageTitles();

  const iconBtn = {
    width: 40, height: 40, borderRadius: 12,
    border: '1px solid var(--panel-border)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', position: 'relative',
  };

  return (
    <header
      className="top-navbar-container"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 32px 14px', gap: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        <button
          type="button"
          className="btn d-lg-none p-0 border-0 bg-transparent text-dark"
          onClick={onMenuToggle}
          aria-label="Toggle navigation"
        >
          <Menu style={{ width: 22, height: 22 }} />
        </button>

        <div style={{ minWidth: 0 }}>
          <h1 className="font-display" style={{ fontSize: 21, fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: '#0f1330' }}>
            {title}
          </h1>
          <p style={{ fontSize: 12.5, color: '#8990ac', margin: '2px 0 0' }}>
            {subtitle}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Enhanced Universal Search Input & Dropdown */}
        <div style={{ position: 'relative' }} className="d-none d-md-block">
          <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#00b09b', zIndex: 2 }} />
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsOpen(true);
            }}
            onFocus={(e) => {
              setIsOpen(true);
              e.target.style.borderColor = '#00b09b';
              e.target.style.background = '#ffffff';
              e.target.style.boxShadow = '0 0 0 4px rgba(0, 176, 155, 0.15), 0 4px 16px -4px rgba(0, 176, 155, 0.2)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(0, 176, 155, 0.25)';
              e.target.style.background = 'rgba(255, 255, 255, 0.75)';
              e.target.style.boxShadow = '0 2px 10px -3px rgba(0, 176, 155, 0.08)';
            }}
            onKeyDown={handleKeyDownInput}
            placeholder="Search contacts, deals, leads…"
            style={{
              width: 320,
              padding: '9px 62px 9px 38px',
              fontSize: 13,
              borderRadius: 12,
              border: '1px solid rgba(0, 176, 155, 0.25)',
              background: 'rgba(255, 255, 255, 0.75)',
              backdropFilter: 'blur(16px)',
              color: '#0f1330',
              outline: 'none',
              transition: 'all 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
              boxShadow: '0 2px 10px -3px rgba(0, 176, 155, 0.08)',
            }}
          />
          <kbd
            onClick={() => {
              if (searchInputRef.current) {
                searchInputRef.current.focus();
                setIsOpen(true);
              }
            }}
            style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '3px 7px', borderRadius: 6,
              fontSize: 10.5, fontWeight: 700,
              background: 'linear-gradient(135deg, rgba(0,176,155,0.12), rgba(79,172,254,0.12))',
              color: '#00b09b',
              border: '1px solid rgba(0,176,155,0.25)',
              fontFamily: 'JetBrains Mono, monospace',
              cursor: 'pointer',
              zIndex: 2,
            }}
          >
            <Command size={10} strokeWidth={2.5} /> K
          </kbd>

          {/* Floating Search Results Dropdown */}
          {isOpen && (
            <div
              ref={dropdownRef}
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: 360,
                backgroundColor: '#ffffff',
                borderRadius: 16,
                padding: '12px',
                boxShadow: '0 20px 40px -10px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(0, 176, 155, 0.15)',
                zIndex: 9999,
                animation: 'fadeInDown 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
              }}
            >
              <style>{`
                @keyframes fadeInDown {
                  from { opacity: 0; transform: translateY(-8px); }
                  to { opacity: 1; transform: translateY(0); }
                }
              `}</style>

              <div style={{ fontSize: 10.5, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '6px 10px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{searchTerm.trim() ? `Search Results (${filteredResults.length})` : 'Quick Navigation'}</span>
                <span>Press Enter ↵</span>
              </div>

              {filteredResults.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflowY: 'auto' }}>
                  {filteredResults.map((item, idx) => (
                    <div
                      key={item.route}
                      onClick={() => handleSelectRoute(item.route)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: 10,
                        cursor: 'pointer',
                        background: idx === 0 && searchTerm.trim() ? 'rgba(0, 176, 155, 0.08)' : 'transparent',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0, 176, 155, 0.1)'}
                      onMouseOut={(e) => e.currentTarget.style.background = idx === 0 && searchTerm.trim() ? 'rgba(0, 176, 155, 0.08)' : 'transparent'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(0, 176, 155, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00b09b' }}>
                          <Layers size={14} />
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f1330' }}>
                            {item.label}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>
                            Category: {item.category}
                          </div>
                        </div>
                      </div>
                      <ArrowRight size={14} color="#00b09b" />
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '16px 12px', textAlign: 'center', color: '#64748b', fontSize: 12.5 }}>
                  No matching workspace modules for "{searchTerm}".
                </div>
              )}
            </div>
          )}
        </div>

        <button type="button" className="glass glass-hover" style={iconBtn} title="Notifications">
          <Bell size={16} style={{ color: '#0f1330' }} />
          <span
            style={{
              position: 'absolute', top: 8, right: 8,
              width: 8, height: 8, borderRadius: '50%',
              background: '#f43f5e',
              boxShadow: '0 0 0 3px rgba(255,255,255,0.9), 0 0 12px rgba(244,63,94,0.6)',
              animation: 'pulseGlow 2s infinite',
            }}
          />
        </button>

        <button
          type="button"
          onClick={() =>
            location.pathname.startsWith('/setup')
              ? navigate('/workspace/dashboard')
              : navigate('/setup')
          }
          className="glass glass-hover"
          style={iconBtn}
          title={location.pathname.startsWith('/setup') ? 'Back to Workspace' : 'Setup & Administration'}
        >
          <Settings size={16} style={{ color: '#0f1330' }} />
        </button>
      </div>
    </header>
  );
}

export default Navbar;
