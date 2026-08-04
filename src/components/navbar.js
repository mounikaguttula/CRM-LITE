import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWorkspace } from '../context/WorkspaceContext';
import { Search, Bell, Menu, Settings, Command } from 'lucide-react';

function Navbar({ onMenuToggle }) {
  const { currentUser } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();

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
    if (path.includes('/object/leads'))      return ["Leads", "Manage and track new incoming business leads."];
    if (path.includes('/object/deals'))      return ["Deals", "Track pipeline opportunities and revenue progress."];
    if (path.includes('/object/contacts'))   return ["Contacts", "Every person and relationship in your workspace."];
    if (path.includes('/object/companies'))  return ["Companies", "Accounts, organizations, and corporate partners."];
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
        {/* Enhanced Search Input */}
        <div style={{ position: 'relative' }} className="d-none d-md-block">
          <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#00b09b' }} />
          <input
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
            onFocus={(e) => {
              e.target.style.borderColor = '#00b09b';
              e.target.style.background = '#ffffff';
              e.target.style.boxShadow = '0 0 0 4px rgba(0, 176, 155, 0.15), 0 4px 16px -4px rgba(0, 176, 155, 0.2)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(0, 176, 155, 0.25)';
              e.target.style.background = 'rgba(255, 255, 255, 0.75)';
              e.target.style.boxShadow = '0 2px 10px -3px rgba(0, 176, 155, 0.08)';
            }}
          />
          <kbd
            style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '3px 7px', borderRadius: 6,
              fontSize: 10.5, fontWeight: 700,
              background: 'linear-gradient(135deg, rgba(0,176,155,0.12), rgba(79,172,254,0.12))',
              color: '#00b09b',
              border: '1px solid rgba(0,176,155,0.25)',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            <Command size={10} strokeWidth={2.5} /> K
          </kbd>
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
