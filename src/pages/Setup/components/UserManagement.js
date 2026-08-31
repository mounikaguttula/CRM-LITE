import React, { useState, useEffect, useContext, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../api/client';
import { Search, UserPlus, Users, User, Mail, Building2, Lock, CheckCircle2, X, Trash2, AlertTriangle, Shield, ChevronDown, ChevronUp, Check } from 'lucide-react';
import WorkspaceContext from '../../../context/WorkspaceContext';

const Avatar = ({ initials, size = 32 }) => (
  <div
    className="grad-border"
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      background: 'rgba(99,102,241,0.08)',
      fontSize: size * 0.36,
      fontWeight: 600,
    }}
  >
    <div style={{ borderRadius: '50%', position: 'relative', color: '#1c2033' }}>{initials}</div>
  </div>
);

const RolePicklist = ({ roles = [], value = '', onChange, placeholder = 'Select Role...' }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  const selectedRole = roles.find((r) => String(r.id) === String(value));

  const updateCoords = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownHeight = 240;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < dropdownHeight && rect.top > dropdownHeight;

      setCoords({
        top: openUp ? Math.max(10, rect.top - dropdownHeight - 6) : rect.bottom + 6,
        left: rect.left,
        width: rect.width,
        maxHeight: openUp ? Math.min(200, rect.top - 30) : Math.min(200, window.innerHeight - rect.bottom - 20),
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

  const filteredRoles = roles.filter((r) => {
    const name = (r.role_name || r.name || '').toLowerCase();
    const desc = (r.description || '').toLowerCase();
    return name.includes(search.toLowerCase()) || desc.includes(search.toLowerCase());
  });

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          updateCoords();
          setOpen((prev) => !prev);
        }}
        style={{
          width: '100%',
          height: 46,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 14px',
          borderRadius: 12,
          border: open ? '1.5px solid #6366f1' : '1px solid #cbd5e1',
          background: '#f8fafc',
          color: selectedRole ? '#0f172a' : '#94a3b8',
          fontSize: '0.88rem',
          fontWeight: selectedRole ? 600 : 400,
          cursor: 'pointer',
          boxShadow: open ? '0 0 0 3px rgba(99,102,241,0.15)' : 'none',
          transition: 'all 0.15s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
          <Shield size={17} style={{ color: selectedRole ? '#6366f1' : '#94a3b8', flexShrink: 0 }} />
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {selectedRole ? (selectedRole.role_name || selectedRole.name) : placeholder}
          </span>
        </div>
        {open ? <ChevronUp size={16} style={{ color: '#6366f1' }} /> : <ChevronDown size={16} style={{ color: '#94a3b8' }} />}
      </button>

      {open && ReactDOM.createPortal(
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
            boxShadow: '0 20px 45px -8px rgba(0, 0, 0, 0.25), 0 8px 16px rgba(0,0,0,0.08)',
            overflow: 'hidden',
          }}
        >
          {/* Top Search Box */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search role..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
                style={{
                  width: '100%',
                  padding: '6px 10px 6px 30px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: 12.5,
                  color: '#1e293b',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Options List */}
          <div className="orbit-scrollbar" style={{ maxHeight: coords.maxHeight || 200, overflowY: 'auto', padding: '6px 0' }}>
            {filteredRoles.length === 0 ? (
              <div style={{ padding: '14px', textAlign: 'center', fontSize: 12.5, color: '#94a3b8' }}>
                No roles found matching "{search}"
              </div>
            ) : (
              filteredRoles.map((r) => {
                const isSelected = String(r.id) === String(value);
                const roleName = r.role_name || r.name;
                return (
                  <div
                    key={r.id}
                    onClick={() => {
                      onChange(r.id);
                      setOpen(false);
                      setSearch('');
                    }}
                    style={{
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(99,102,241,0.08)' : 'transparent',
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{ paddingRight: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: isSelected ? 700 : 600, color: isSelected ? '#4338ca' : '#1e293b' }}>
                        {roleName}
                      </div>
                      {r.description && (
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {r.description}
                        </div>
                      )}
                    </div>
                    {isSelected && <Check size={16} style={{ color: '#4338ca', flexShrink: 0 }} />}
                  </div>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

function UserManagement() {
  const { company, currentUser } = useContext(WorkspaceContext) || {};
  const orgId = company?.organization_code || company?.code || company?.id || '';

  const getRoleRank = (str) => {
    const s = String(str || '').toLowerCase();
    if (s.includes('admin')) return 1;
    if (s.includes('clone')) return 3;
    if (s.includes('manager') && !s.includes('relationship')) return 2;
    if (s.includes('executive')) return 4;
    if (s.includes('relationship') || s.includes('read only') || s.includes('viewer')) return 5;
    return 5;
  };

  const userRank = getRoleRank(currentUser?.role || currentUser?.role_name);

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);

  // Filter roles that the logged-in user has authority to assign
  const assignableRoles = useMemo(() => {
    if (userRank === 1) return roles;
    if (userRank >= 4) return [];
    return roles.filter((r) => {
      const rRank = getRoleRank(r.role_name || r.name);
      return userRank < rRank;
    });
  }, [roles, userRank]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editModalUser, setEditModalUser] = useState(null);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', confirmPassword: '', role_id: '' });
  const [submitting, setSubmitting] = useState(false);
  const [updatingUser, setUpdatingUser] = useState(false);
  const [deleteModalUser, setDeleteModalUser] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [inviteError, setInviteError] = useState(null);
  const [editError, setEditError] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        setLoading(true);
        const [uData, rData] = await Promise.all([
          apiGet('/users').catch(() => []),
          apiGet('/roles').catch(() => apiGet('/api/roles')).catch(() => []),
        ]);
        if (isMounted) {
          setUsers(Array.isArray(uData) ? uData : uData?.data || []);
          setRoles(Array.isArray(rData) ? rData : rData?.data || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => { isMounted = false; };
  }, []);

  const filteredUsers = users.filter((u) =>
    (u.name || u.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleDeleteClick = (userObj) => {
    setDeleteModalUser(userObj);
    setDeleteError(null);
  };

  const confirmDeleteUser = async () => {
    if (!deleteModalUser) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiDelete(`/users/${deleteModalUser.id}`);
      setUsers((prev) => prev.filter((u) => u.id !== deleteModalUser.id));
      const deletedName = deleteModalUser.name || deleteModalUser.first_name || deleteModalUser.email || 'User';
      setDeleteModalUser(null);
      setToastMessage(`User "${deletedName}" deleted successfully!`);
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err) {
      console.error('Delete user error:', err);
      const msg = err?.message || '';
      if (msg.includes('Cannot DELETE') || msg.includes('404') || msg.includes('permission')) {
        setDeleteError('You cannot delete or edit this user account due to missing permissions or role restrictions.');
      } else {
        setDeleteError(msg || 'You cannot delete or edit this user account due to missing permissions or role restrictions.');
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleEditClick = (u) => {
    setEditModalUser({
      id: u.id,
      name: u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
      email: u.email || '',
      role_id: u.role_id || '',
    });
    setEditError(null);
  };

  const confirmUpdateUser = async (e) => {
    e.preventDefault();
    if (!editModalUser) return;
    setUpdatingUser(true);
    setEditError(null);

    const nameParts = editModalUser.name.trim().split(/\s+/);
    const first_name = nameParts[0] || '';
    const last_name = nameParts.slice(1).join(' ') || '';

    try {
      const updated = await apiPut(`/users/${editModalUser.id}`, {
        first_name,
        last_name,
        email: editModalUser.email,
        role_id: editModalUser.role_id,
      });

      const selectedRole = roles.find((r) => String(r.id) === String(editModalUser.role_id));
      const roleName = updated?.role_name || updated?.role || (selectedRole ? selectedRole.role_name || selectedRole.name : 'Member');

      setUsers((prev) =>
        prev.map((u) =>
          u.id === editModalUser.id
            ? {
              ...u,
              ...updated,
              name: editModalUser.name,
              first_name,
              last_name,
              email: editModalUser.email,
              role_id: editModalUser.role_id,
              role: roleName,
              role_name: roleName,
            }
            : u
        )
      );

      const targetName = editModalUser.name || 'User';
      setEditModalUser(null);
      setToastMessage(`User "${targetName}" updated successfully!`);
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err) {
      console.error('Update user error:', err);
      setEditError(err?.message || 'Failed to update user profile.');
    } finally {
      setUpdatingUser(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setInviteError(null);
    if (!newUser.email || !newUser.name) return;
    if (newUser.password !== newUser.confirmPassword) {
      setInviteError("Passwords do not match!");
      return;
    }
    setSubmitting(true);

    const nameParts = newUser.name.trim().split(/\s+/);
    const first_name = nameParts[0] || '';
    const last_name = nameParts.slice(1).join(' ') || '';

    try {
      const selectedRole = roles.find((r) => String(r.id) === String(newUser.role_id));
      const created = await apiPost('/users/invite', {
        email: newUser.email,
        first_name,
        last_name,
        password: newUser.password,
        role_id: newUser.role_id,
      });

      const roleName = created.role_name || created.role || (selectedRole ? selectedRole.role_name || selectedRole.name : 'Member');

      const normalizedCreated = {
        ...created,
        name: created.name || `${created.first_name || ''} ${created.last_name || ''}`.trim() || created.email,
        role: roleName,
        role_name: roleName,
      };

      setUsers((prev) => [...prev, normalizedCreated]);
      setShowModal(false);
      setNewUser({ name: '', email: '', password: '', confirmPassword: '', role_id: '' });
      setToastMessage(`User "${normalizedCreated.name}" invited successfully!`);
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err) {
      setInviteError(err.message || 'Failed to invite user');
    } finally {
      setSubmitting(false);
    }
  };

  const getInitials = (str) => {
    if (!str) return 'U';
    const parts = String(str).trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : String(str).slice(0, 2).toUpperCase();
  };

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 className="font-display" style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1c2033', margin: 0 }}>User Directory</h2>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-dim)', margin: 0 }}>Manage team members, access roles, and permissions.</p>
        </div>
        {userRank < 4 && (
          <button
            className="orbit-btn-primary"
            onClick={() => setShowModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: '10px', fontSize: '0.85rem', cursor: 'pointer' }}
          >
            <UserPlus style={{ width: '16px', height: '16px' }} />
            Invite User
          </button>
        )}
      </div>

      <div className="glass" style={{ padding: '8px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--panel-border)' }}>
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
            <input
              type="text"
              placeholder="Search team members..."
              className="orbit-input has-left-icon"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', padding: '7px 12px 7px 32px', borderRadius: 9, fontSize: 12.5 }}
            />
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{filteredUsers.length} total users</span>
        </div>

        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-faint)' }}>
            <div className="spinner-border spinner-border-sm me-2 text-primary" role="status" />
            Loading users...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-faint)' }}>
            <Users style={{ width: '32px', height: '32px', marginBottom: '8px' }} />
            <p style={{ margin: 0, fontSize: '0.85rem' }}>No user accounts found.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }} className="orbit-scrollbar">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 500, borderBottom: '1px solid var(--panel-border)' }}>User</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 500, borderBottom: '1px solid var(--panel-border)' }}>Role</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 500, borderBottom: '1px solid var(--panel-border)' }}>Status</th>
                  <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 500, borderBottom: '1px solid var(--panel-border)' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const userName = u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || 'User';
                  const matchedRole = roles.find((r) => String(r.id) === String(u.role_id));
                  const roleTitle = u.role_name || u.role || (matchedRole ? (matchedRole.role_name || matchedRole.name) : 'Member');
                  const isAdmin = String(roleTitle).toLowerCase().includes('admin');
                  return (
                    <tr key={u.id || u.email} style={{ borderBottom: '1px solid rgba(99,102,241,0.08)' }} className="glass-hover">
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Avatar initials={getInitials(userName)} size={32} />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#1c2033' }}>{userName}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span className="badge" style={{ color: isAdmin ? '#4338ca' : '#4338ca', background: isAdmin ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)', fontWeight: isAdmin ? 700 : 500 }}>
                          {roleTitle}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span className="badge" style={{ color: '#047857', background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)' }}>
                          {u.status || 'Active'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        {userRank < 4 ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
                            <button
                              onClick={() => handleEditClick(u)}
                              style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
                            >
                              Edit
                            </button>
                            {!isAdmin && (
                              <button
                                onClick={() => handleDeleteClick(u)}
                                title="Delete User"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#f43f5e',
                                  fontSize: 12.5,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                <Trash2 size={13} /> Delete
                              </button>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: 11.5, color: '#94a3b8', fontWeight: 500 }}>View Only</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invite User Modal */}
      {showModal && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999999,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div className="orbit-scrollbar" style={{
            background: '#ffffff', borderRadius: 20, width: '100%', maxWidth: 440,
            maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(226, 232, 240, 0.8)', position: 'relative',
          }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 className="font-display" style={{ margin: 0, fontSize: 19, fontWeight: 700, color: '#1e293b' }}>Invite New User</h3>
              <button 
                type="button" 
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <X size={18} />
              </button>
            </div>

            {inviteError && (
              <div style={{
                marginBottom: 16, padding: '10px 14px', borderRadius: 10,
                background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
                fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 8
              }}>
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <span>{inviteError}</span>
              </div>
            )}

            <form onSubmit={handleAddUser}>
              {/* Full Name */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: 8 }}>Full Name</label>
                <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: 12, overflow: 'hidden', height: 46, background: '#f8fafc' }}>
                  <div style={{ width: 46, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid #e2e8f0', color: '#64748b', flexShrink: 0, background: '#ffffff' }}>
                    <User size={18} />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="John Doe"
                    value={newUser.name}
                    onChange={(e) => setNewUser((p) => ({ ...p, name: e.target.value }))}
                    style={{ flex: 1, border: 'none', background: 'transparent', height: '100%', padding: '0 14px', fontSize: '0.88rem', color: '#334155', outline: 'none' }}
                  />
                </div>
              </div>

              {/* Email Address */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: 8 }}>Email Address</label>
                <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: 12, overflow: 'hidden', height: 46, background: '#f8fafc' }}>
                  <div style={{ width: 46, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid #e2e8f0', color: '#64748b', flexShrink: 0, background: '#ffffff' }}>
                    <Mail size={17} />
                  </div>
                  <input
                    type="email"
                    required
                    placeholder="name@company.com"
                    value={newUser.email}
                    onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))}
                    style={{ flex: 1, border: 'none', background: 'transparent', height: '100%', padding: '0 14px', fontSize: '0.88rem', color: '#334155', outline: 'none' }}
                  />
                </div>
              </div>

              {/* Role Picklist */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: 8 }}>Assign Role</label>
                <RolePicklist
                  roles={assignableRoles}
                  value={newUser.role_id || ''}
                  onChange={(roleId) => setNewUser((p) => ({ ...p, role_id: roleId }))}
                  placeholder="Select Role..."
                />
              </div>

              {/* Organization ID */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: 8 }}>Organization ID</label>
                <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', height: 46, background: '#f1f5f9' }}>
                  <div style={{ width: 46, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid #e2e8f0', color: '#94a3b8', flexShrink: 0, background: '#f8fafc' }}>
                    <Building2 size={17} />
                  </div>
                  <input
                    type="text"
                    readOnly
                    value={orgId}
                    style={{ flex: 1, border: 'none', background: 'transparent', height: '100%', padding: '0 14px', fontSize: '0.88rem', color: '#64748b', outline: 'none', cursor: 'not-allowed' }}
                  />
                </div>
              </div>

              {/* Create Password */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: 8 }}>Create Password</label>
                <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: 12, overflow: 'hidden', height: 46, background: '#f8fafc' }}>
                  <div style={{ width: 46, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid #e2e8f0', color: '#64748b', flexShrink: 0, background: '#ffffff' }}>
                    <Lock size={17} />
                  </div>
                  <input
                    type="password"
                    required
                    placeholder="Minimum 8 characters"
                    value={newUser.password || ''}
                    onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
                    style={{ flex: 1, border: 'none', background: 'transparent', height: '100%', padding: '0 14px', fontSize: '0.88rem', color: '#334155', outline: 'none' }}
                  />
                </div>
              </div>

              {/* Confirm Password */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: 8 }}>Confirm Password</label>
                <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: 12, overflow: 'hidden', height: 46, background: '#f8fafc' }}>
                  <div style={{ width: 46, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid #e2e8f0', color: '#64748b', flexShrink: 0, background: '#ffffff' }}>
                    <Lock size={17} />
                  </div>
                  <input
                    type="password"
                    required
                    placeholder="Re-enter your password"
                    value={newUser.confirmPassword || ''}
                    onChange={(e) => setNewUser((p) => ({ ...p, confirmPassword: e.target.value }))}
                    style={{ flex: 1, border: 'none', background: 'transparent', height: '100%', padding: '0 14px', fontSize: '0.88rem', color: '#334155', outline: 'none' }}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: '100%',
                  height: 48,
                  borderRadius: 12,
                  border: 'none',
                  background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                  color: '#ffffff',
                  fontSize: '0.92rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
                onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
              >
                <CheckCircle2 size={18} />
                <span>{submitting ? 'Creating User...' : 'Create User'}</span>
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Edit User Modal */}
      {editModalUser && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999999,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div className="orbit-scrollbar" style={{
            background: '#ffffff', borderRadius: 20, width: '100%', maxWidth: 440,
            maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(226, 232, 240, 0.8)', position: 'relative',
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 className="font-display" style={{ margin: 0, fontSize: 19, fontWeight: 700, color: '#1e293b' }}>Edit User & Role</h3>
              <button 
                type="button" 
                onClick={() => setEditModalUser(null)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <X size={18} />
              </button>
            </div>

            {editError && (
              <div style={{
                marginBottom: 16, padding: '10px 14px', borderRadius: 10,
                background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
                fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 8
              }}>
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={confirmUpdateUser}>
              {/* Full Name */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: 8 }}>Full Name</label>
                <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: 12, overflow: 'hidden', height: 46, background: '#f8fafc' }}>
                  <div style={{ width: 46, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid #e2e8f0', color: '#64748b', flexShrink: 0, background: '#ffffff' }}>
                    <User size={18} />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Full Name"
                    value={editModalUser.name || ''}
                    onChange={(e) => setEditModalUser((p) => ({ ...p, name: e.target.value }))}
                    style={{ flex: 1, border: 'none', background: 'transparent', height: '100%', padding: '0 14px', fontSize: '0.88rem', color: '#334155', outline: 'none' }}
                  />
                </div>
              </div>

              {/* Email Address */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: 8 }}>Email Address</label>
                <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: 12, overflow: 'hidden', height: 46, background: '#f8fafc' }}>
                  <div style={{ width: 46, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid #e2e8f0', color: '#64748b', flexShrink: 0, background: '#ffffff' }}>
                    <Mail size={17} />
                  </div>
                  <input
                    type="email"
                    required
                    placeholder="name@company.com"
                    value={editModalUser.email || ''}
                    onChange={(e) => setEditModalUser((p) => ({ ...p, email: e.target.value }))}
                    style={{ flex: 1, border: 'none', background: 'transparent', height: '100%', padding: '0 14px', fontSize: '0.88rem', color: '#334155', outline: 'none' }}
                  />
                </div>
              </div>

              {/* Role Picklist */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: 8 }}>Assigned Role</label>
                {(() => {
                  const currentUserId = currentUser?.id || currentUser?.user_id;
                  const editUserId = editModalUser?.id;
                  const isSelf = Boolean(currentUserId && editUserId && String(currentUserId) === String(editUserId));

                  const targetUserObj = users.find(u => u.id === editModalUser.id);
                  const targetRoleObj = roles.find(r => String(r.id) === String(editModalUser.role_id));
                  const targetRoleTitle = targetRoleObj?.role_name || targetRoleObj?.name || targetUserObj?.role_name || targetUserObj?.role || 'User';
                  const targetRank = getRoleRank(targetRoleTitle);

                  if (isSelf) {
                    return (
                      <div style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.84rem', color: '#64748b', fontWeight: 600 }}>
                        {targetRoleTitle} (Role locked: You cannot change your own assigned role)
                      </div>
                    );
                  }

                  if (userRank > 1 && userRank >= targetRank) {
                    return (
                      <div style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.84rem', color: '#64748b', fontWeight: 600 }}>
                        {targetRoleTitle} (Role locked: You do not have authority to change this user's role.)
                      </div>
                    );
                  }

                  if (userRank >= 4) {
                    return (
                      <div style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.84rem', color: '#64748b', fontWeight: 600 }}>
                        {targetRoleTitle} (Role locked: You do not have authority to change this user's role.)
                      </div>
                    );
                  }

                  return (
                    <RolePicklist
                      roles={assignableRoles}
                      value={editModalUser.role_id || ''}
                      onChange={(roleId) => setEditModalUser((p) => ({ ...p, role_id: roleId }))}
                      placeholder="Select Role..."
                    />
                  );
                })()}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  type="button"
                  onClick={() => setEditModalUser(null)}
                  disabled={updatingUser}
                  style={{
                    flex: 1, height: 44, borderRadius: 12, border: '1px solid #cbd5e1',
                    background: '#ffffff', color: '#334155', fontWeight: 600, fontSize: '0.88rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingUser}
                  style={{
                    flex: 1, height: 44, borderRadius: 12, border: 'none',
                    background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                    color: '#ffffff', fontWeight: 600, fontSize: '0.88rem',
                    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)'
                  }}
                >
                  {updatingUser ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Delete User Custom Modal Overlay */}
      {deleteModalUser && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999999,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            background: '#ffffff', borderRadius: 20, width: '100%', maxWidth: 420,
            padding: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(226, 232, 240, 0.8)', textAlign: 'center',
            position: 'relative',
          }}>
            <button 
              type="button" 
              onClick={() => { setDeleteModalUser(null); setDeleteError(null); }}
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 6, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <X size={18} />
            </button>

            <div style={{
              width: 56, height: 56, borderRadius: '50%', background: '#ffe4e6',
              color: '#e11d48', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 16, boxShadow: '0 0 0 8px rgba(225, 29, 72, 0.08)'
            }}>
              <AlertTriangle size={28} />
            </div>

            <h3 className="font-display" style={{ margin: '0 0 8px 0', fontSize: 19, fontWeight: 700, color: '#0f172a' }}>
              Delete User Account?
            </h3>

            <p style={{ margin: '0 0 20px 0', fontSize: '0.88rem', color: '#64748b', lineHeight: 1.5 }}>
              Are you sure you want to delete <strong style={{ color: '#0f172a' }}>{deleteModalUser.name || deleteModalUser.first_name || deleteModalUser.email}</strong>? This action cannot be undone and will remove their access to the workspace.
            </p>

            {deleteError && (
              <div style={{
                marginBottom: 16, padding: '10px 14px', borderRadius: 10,
                background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
                fontSize: '0.82rem', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8
              }}>
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <span>{deleteError}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={() => { setDeleteModalUser(null); setDeleteError(null); }}
                disabled={deleting}
                style={{
                  flex: 1, height: 44, borderRadius: 12, border: '1px solid #cbd5e1',
                  background: '#ffffff', color: '#334155', fontWeight: 600, fontSize: '0.88rem',
                  cursor: 'pointer', transition: 'all 0.15s ease'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteUser}
                disabled={deleting}
                style={{
                  flex: 1, height: 44, borderRadius: 12, border: 'none',
                  background: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
                  color: '#ffffff', fontWeight: 600, fontSize: '0.88rem',
                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: '0 4px 12px rgba(225, 29, 72, 0.25)', transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
                onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
              >
                {deleting ? (
                  <span>Deleting...</span>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>Delete User</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Success Toast Pop Out Banner */}
      {toastMessage && ReactDOM.createPortal(
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
            <CheckCircle2 size={16} />
          </div>
          <span>{toastMessage}</span>
        </div>,
        document.body
      )}
    </div>
  );
}

export default UserManagement;
