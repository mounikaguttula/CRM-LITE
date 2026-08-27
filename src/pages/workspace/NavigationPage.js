import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, Target, Briefcase, Users, Building2,
  Megaphone, FileText, QrCode, Folder, LogOut,
  ChevronRight, Sparkles, ChevronDown, ChevronUp,
} from 'lucide-react';

function getModuleIcon(name, size = 15) {
  const str = String(name || '').toLowerCase();
  const props = { size, color: '#fff' };
  if (str.includes('lead') || str.includes('target'))            return <Target {...props} />;
  if (str.includes('deal') || str.includes('opp') || str.includes('pipel')) return <Briefcase {...props} />;
  if (str.includes('contact') || str.includes('person'))         return <Users {...props} />;
  if (str.includes('compan') || str.includes('account'))         return <Building2 {...props} />;
  if (str.includes('campaign') || str.includes('market'))        return <Megaphone {...props} />;
  if (str.includes('form') || str.includes('doc'))               return <FileText {...props} />;
  if (str.includes('qr') || str.includes('scan'))                return <QrCode {...props} />;
  return <Folder {...props} />;
}

/* Module icon gradients by type */
function getModuleGradient(name) {
  const str = String(name || '').toLowerCase();
  if (str.includes('lead'))    return 'linear-gradient(135deg,#f59e0b,#ef4444)';
  if (str.includes('deal'))    return 'linear-gradient(135deg,#10b981,#06b6d4)';
  if (str.includes('contact')) return 'linear-gradient(135deg,#8b5cf6,#ec4899)';
  if (str.includes('compan'))  return 'linear-gradient(135deg,#3b82f6,#6366f1)';
  if (str.includes('campaign'))return 'linear-gradient(135deg,#f97316,#f59e0b)';
  return 'linear-gradient(135deg,#00b09b,#4facfe)';
}

function SignOutIconButton({ onClick }) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="Sign out"
      style={{
        background: hovered ? 'rgba(244,63,94,0.16)' : 'transparent',
        border: 'none',
        borderRadius: 8,
        width: 32,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: hovered ? '#f87185' : 'rgba(255,255,255,0.45)',
        transition: 'all 0.2s ease',
        flexShrink: 0,
      }}
    >
      <LogOut size={16} />
    </button>
  );
}

function NavigationPage({ onNavigate }) {
  const { navigation, company, currentUser, objectTypes, permissions, loading } = useWorkspace();
  const { logout, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

  const displayName = user?.name || currentUser?.full_name || currentUser?.name || user?.email || 'User';
  const companyName = company?.name || 'CRM Workspace';
  const userInitials = displayName && displayName !== 'User'
    ? displayName.split(' ').filter(Boolean).map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  /* Build nav items from backend, applying strict fail-closed canRead permission check */
  const hasNav = Array.isArray(navigation) && navigation.length > 0;
  const hasObj = objectTypes && Object.keys(objectTypes).length > 0;
  const rawNavItems = (hasNav
    ? navigation
    : hasObj
      ? Object.keys(objectTypes).map((key) => ({
          id: `nav_${key}`,
          displayName: objectTypes[key].pluralDisplayName || objectTypes[key].displayName || key,
          route: `/workspace/object/${key}`,
          icon: key,
        }))
      : []
  ).filter((item) => {
    const rawKey = String(item.id || item.icon || item.displayName || '').replace(/^nav_/, '').toLowerCase();
    if (rawKey.includes('form')) return false;

    if (permissions) {
      const keySingular = rawKey.endsWith('s') ? rawKey.slice(0, -1) : rawKey;
      const keyPlural = rawKey.endsWith('s') ? rawKey : `${rawKey}s`;
      const perm = permissions[rawKey] || permissions[keySingular] || permissions[keyPlural];
      if (!perm || perm.canRead !== true) return false;
    }
    return true;
  });


  const getNavOrder = (item) => {
    const val = String(item.id || item.displayName || item.icon || '').toLowerCase();
    if (/(lead[\s_-]*captcha|captcha[\s_-]*lead)/.test(val)) return 5;
    if (/(lead|leads)/.test(val) && !/(captcha|scan|scanner|qr)/.test(val)) return 0;
    if (/(company|account|organization)/.test(val)) return 1;
    if (/(contact|person)/.test(val)) return 2;
    if (/(deal|opp|pipeline|pipel)/.test(val)) return 3;
    if (/(campaign|market)/.test(val)) return 6;
    if (/(captcha|scan|scanner|qr)/.test(val)) return 5;
    return 4;
  };

  const navItems = rawNavItems
    .map((item) => ({
      ...item,
      _order: getNavOrder(item),
      _label: String(item.displayName || item.id || item.icon || '').trim(),
    }))
    .sort((a, b) => {
      if (a._order !== b._order) return a._order - b._order;
      return a._label.localeCompare(b._label, undefined, { sensitivity: 'base' });
    });

  const [isStandardOpen, setIsStandardOpen] = React.useState(() => {
    const saved = localStorage.getItem('crm_nav_standard_open');
    return saved !== null ? saved === 'true' : true;
  });

  const [isCustomOpen, setIsCustomOpen] = React.useState(() => {
    const saved = localStorage.getItem('crm_nav_custom_open');
    return saved !== null ? saved === 'true' : false;
  });

  const toggleStandard = () => {
    setIsStandardOpen((prev) => {
      const next = !prev;
      localStorage.setItem('crm_nav_standard_open', String(next));
      return next;
    });
  };

  const toggleCustom = () => {
    setIsCustomOpen((prev) => {
      const next = !prev;
      localStorage.setItem('crm_nav_custom_open', String(next));
      return next;
    });
  };

  const standardNavItems = [];
  const customNavItems = [];

  navItems.forEach((item) => {
    const rawKey = String(item.id || item.icon || item.displayName || '').replace(/^nav_/, '').toLowerCase();
    const keySingular = rawKey.endsWith('s') ? rawKey.slice(0, -1) : rawKey;
    const keyPlural = rawKey.endsWith('s') ? rawKey : `${rawKey}s`;

    const objMeta = objectTypes
      ? (objectTypes[rawKey] || objectTypes[keySingular] || objectTypes[keyPlural] || Object.values(objectTypes).find((o) => String(o.api_name || '').toLowerCase() === rawKey))
      : null;

    const isCustom = Boolean(
      objMeta?.is_custom === true ||
      objMeta?.is_system === false ||
      rawKey.endsWith('__c') ||
      (objMeta && !objMeta.is_system && objMeta.organization_id !== null)
    );

    if (isCustom) {
      customNavItems.push(item);
    } else {
      standardNavItems.push(item);
    }
  });

  const canReadForms = !permissions || (permissions.form?.canRead !== false && permissions.forms?.canRead !== false);
  const canReadLeadScanner = !permissions || (permissions.lead?.canRead !== false && permissions.leads?.canRead !== false);

  const totalStandardCount = standardNavItems.length + (canReadForms ? 1 : 0) + (canReadLeadScanner ? 1 : 0);
  const totalCustomCount = customNavItems.length;

  const SidebarNavItem = ({ to, label, icon, gradient, isActive, onClick, hideArrow }) => {
    const [hov, setHov] = React.useState(false);
    return (
      <NavLink
        to={to}
        onClick={onClick}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 11,
          padding: '9px 12px', borderRadius: 12, border: 'none',
          textDecoration: 'none', cursor: 'pointer',
          fontSize: '0.84rem', fontWeight: isActive ? 600 : 400,
          color: isActive ? '#fff' : hov ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.55)',
          background: isActive
            ? 'linear-gradient(135deg,rgba(0,176,155,0.22),rgba(79,172,254,0.14))'
            : hov ? 'rgba(255,255,255,0.05)' : 'transparent',
          borderLeft: isActive ? '2px solid #00b09b' : '2px solid transparent',
          transition: 'all 0.2s ease',
        }}
      >
        <div style={{
          width: 30, height: 30, borderRadius: 9, flexShrink: 0,
          background: isActive ? gradient : 'rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: isActive ? `0 4px 12px rgba(0,176,155,0.3)` : 'none',
          transition: 'all 0.2s ease',
        }}>
          {icon}
        </div>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
        {isActive && !hideArrow && <ChevronRight size={13} style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />}
      </NavLink>
    );
  };

  const SectionLabel = ({ children }) => (
    <div style={{
      fontSize: '0.62rem', fontWeight: 700, color: 'rgba(255,255,255,0.28)',
      letterSpacing: '0.1em', textTransform: 'uppercase',
      padding: '10px 14px 4px',
    }}>
      {children}
    </div>
  );

  const CollapsibleSectionHeader = ({ title, isOpen, onToggle }) => (
    <button
      type="button"
      onClick={onToggle}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'transparent',
        border: 'none',
        padding: '10px 14px 4px',
        cursor: 'pointer',
        color: 'rgba(255,255,255,0.38)',
        fontSize: '0.62rem',
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        transition: 'color 0.2s ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.75)')}
      onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.38)')}
    >
      <span>{title}</span>
      {isOpen ? (
        <ChevronDown size={12} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
      ) : (
        <ChevronUp size={12} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
      )}
    </button>
  );

  const ScrollableNavGroup = ({ children, itemCount }) => {
    const containerRef = React.useRef(null);
    const [showFade, setShowFade] = React.useState(false);

    const checkScrollState = React.useCallback(() => {
      const el = containerRef.current;
      if (!el) return;
      const isOverflowing = el.scrollHeight > el.clientHeight + 4;
      const isAtBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 6;
      setShowFade(isOverflowing && !isAtBottom);
    }, []);

    React.useEffect(() => {
      checkScrollState();
    }, [itemCount, checkScrollState]);

    return (
      <div style={{ position: 'relative', width: '100%', flexShrink: 0 }}>
        <div
          ref={containerRef}
          onScroll={checkScrollState}
          className="ultra-subtle-scrollbar"
          style={{
            maxHeight: '196px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            scrollBehavior: 'smooth',
            paddingRight: 2,
          }}
        >
          {children}
        </div>

        {/* Subtle bottom fade overlay when more content exists below */}
        {showFade && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 18,
              background: 'linear-gradient(to bottom, rgba(13,17,23,0), rgba(13,17,23,0.92))',
              pointerEvents: 'none',
              borderRadius: '0 0 8px 8px',
              transition: 'opacity 0.2s ease',
            }}
          />
        )}
      </div>
    );
  };

  const isDashboardActive = location.pathname === '/workspace' || location.pathname === '/workspace/dashboard';

  return (
    <aside style={{
      width: '100%', flexShrink: 0, display: 'flex', flexDirection: 'column',
      padding: '24px 14px 20px', height: '100vh', position: 'sticky', top: 0,
      background: 'linear-gradient(180deg,#0d1117 0%,#0d1420 45%,#111827 100%)',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      overflow: 'hidden',
    }}>
      {/* Glow orbs */}
      <div style={{ position:'absolute', top:-50, left:-40, width:180, height:180, borderRadius:'50%', background:'radial-gradient(circle,rgba(0,176,155,0.1),transparent 65%)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:60, right:-40, width:140, height:140, borderRadius:'50%', background:'radial-gradient(circle,rgba(79,172,254,0.07),transparent 65%)', pointerEvents:'none' }} />

      {/* Brand */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'0 6px 20px', borderBottom:'1px solid rgba(255,255,255,0.07)', marginBottom:10, position:'relative', zIndex:1 }}>
        <div style={{
          width:34, height:34, borderRadius:11, flexShrink:0,
          background:'linear-gradient(135deg,#00b09b,#4facfe)',
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow:'0 4px 14px rgba(0,176,155,0.35)',
        }}>
          <Sparkles size={18} color="#fff" />
        </div>
        <div style={{ minWidth:0, flex:1 }}>
          <div style={{ fontSize:'0.9rem', fontWeight:800, color:'#fff', letterSpacing:'-0.01em', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            CRM Lite
          </div>
          <div style={{ fontSize:'0.7rem', color:'rgba(255,255,255,0.4)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {companyName}
          </div>
        </div>
      </div>

      {/* Nav List */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, position: 'relative', zIndex: 1, overflow: 'hidden', minHeight: 0 }}>
        {/* Dashboard (FIXED) */}
        <div style={{ flexShrink: 0 }}>
          <SectionLabel>Main</SectionLabel>
          <SidebarNavItem
            to="/workspace/dashboard"
            label="Dashboard"
            icon={<LayoutDashboard size={15} color="#fff" />}
            gradient="linear-gradient(135deg,#00b09b,#4facfe)"
            isActive={isDashboardActive}
            onClick={onNavigate}
            hideArrow={true}
          />
        </div>

        {/* STANDARD MODULES SECTION */}
        <div style={{ flexShrink: 0 }}>
          <CollapsibleSectionHeader
            title="Standard"
            isOpen={isStandardOpen}
            onToggle={toggleStandard}
          />
        </div>
        {isStandardOpen && (
          <ScrollableNavGroup itemCount={totalStandardCount}>
            {loading ? (
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', padding: '6px 14px', fontStyle: 'italic' }}>Loading modules…</div>
            ) : standardNavItems.length === 0 ? (
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', padding: '6px 14px', fontStyle: 'italic' }}>No standard modules</div>
            ) : (
              standardNavItems.map((item) => {
                const isActive = location.pathname.startsWith(item.route);
                const grad = getModuleGradient(`${item.icon || ''} ${item.displayName || ''}`);
                const icon = getModuleIcon(`${item.icon || ''} ${item.displayName || ''}`);
                return (
                  <SidebarNavItem
                    key={item.id}
                    to={item.route}
                    label={item.displayName}
                    icon={icon}
                    gradient={grad}
                    isActive={isActive}
                    onClick={onNavigate}
                  />
                );
              })
            )}

            {canReadForms && (
              <SidebarNavItem
                to="/workspace/forms"
                label="Forms"
                icon={<FileText size={15} color="#fff" />}
                gradient="linear-gradient(135deg,#4f46e5,#818cf8)"
                isActive={location.pathname.startsWith('/workspace/forms')}
                onClick={onNavigate}
              />
            )}

            {canReadLeadScanner && (
              <SidebarNavItem
                to="/workspace/lead-scanner"
                label="Lead QR Scanner"
                icon={<QrCode size={15} color="#fff" />}
                gradient="linear-gradient(135deg,#6366f1,#22d3ee)"
                isActive={location.pathname === '/workspace/lead-scanner'}
                onClick={onNavigate}
              />
            )}
          </ScrollableNavGroup>
        )}

        {/* CUSTOM MODULES SECTION */}
        <div style={{ flexShrink: 0 }}>
          <CollapsibleSectionHeader
            title="Custom"
            isOpen={isCustomOpen}
            onToggle={toggleCustom}
          />
        </div>
        {isCustomOpen && (
          <ScrollableNavGroup itemCount={totalCustomCount}>
            {loading ? (
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', padding: '6px 14px', fontStyle: 'italic' }}>Loading modules…</div>
            ) : customNavItems.length === 0 ? (
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', padding: '6px 14px', fontStyle: 'italic' }}>No custom modules</div>
            ) : (
              customNavItems.map((item) => {
                const isActive = location.pathname.startsWith(item.route);
                const grad = getModuleGradient(`${item.icon || ''} ${item.displayName || ''}`);
                const icon = getModuleIcon(`${item.icon || ''} ${item.displayName || ''}`);
                return (
                  <SidebarNavItem
                    key={item.id}
                    to={item.route}
                    label={item.displayName}
                    icon={icon}
                    gradient={grad}
                    isActive={isActive}
                    onClick={onNavigate}
                  />
                );
              })
            )}
          </ScrollableNavGroup>
        )}

      </div>

      {/* Footer */}
      <div style={{ position:'relative', zIndex:1, marginTop:'auto', flexShrink: 0 }}>
        <div style={{ height:'1px', background:'rgba(255,255,255,0.07)', marginBottom:10 }} />
        <div style={{
          display:'flex', alignItems:'center', gap:10, padding:'8px 10px',
          borderRadius:12, background:'rgba(255,255,255,0.04)',
          border:'1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{
            width:32, height:32, borderRadius:10, flexShrink:0,
            background:'linear-gradient(135deg,#6366f1,#8b5cf6)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:'0.75rem', fontWeight:700, color:'#fff',
          }}>
            {userInitials}
          </div>
          <div style={{ minWidth:0, flex:1 }}>
            <div style={{ fontSize:'0.8rem', fontWeight:600, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {displayName}
            </div>
            <div style={{ fontSize:'0.68rem', color:'#10b981', display:'flex', alignItems:'center', gap:4 }}>
              <span style={{ width:5, height:5, borderRadius:'50%', background:'#10b981', display:'inline-block' }} />
              Online
            </div>
          </div>
          <SignOutIconButton onClick={handleLogout} />
        </div>
      </div>
    </aside>
  );
}

export default NavigationPage;
