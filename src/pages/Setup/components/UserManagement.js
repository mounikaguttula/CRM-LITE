import React, { useState, useEffect, useContext } from 'react';
import ReactDOM from 'react-dom';
import { apiGet, apiPost, apiDelete } from '../../../api/client';
import { Search, UserPlus, Users, User, Mail, Building2, Lock, CheckCircle2, X, Trash2, AlertTriangle } from 'lucide-react';
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

function UserManagement() {
  const { company } = useContext(WorkspaceContext) || {};
  const orgId = company?.organization_code || company?.code || company?.id || '';

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [submitting, setSubmitting] = useState(false);
  const [deleteModalUser, setDeleteModalUser] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [inviteError, setInviteError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        setLoading(true);
        const uData = await apiGet('/users').catch(() => []);
        if (isMounted) {
          setUsers(Array.isArray(uData) ? uData : uData?.data || []);
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

  const [toastMessage, setToastMessage] = useState(null);

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
      const created = await apiPost('/users/invite', {
        email: newUser.email,
        first_name,
        last_name,
        password: newUser.password,
      });

      const normalizedCreated = {
        ...created,
        name: created.name || `${created.first_name || ''} ${created.last_name || ''}`.trim() || created.email
      };

      setUsers((prev) => [...prev, normalizedCreated]);
      setShowModal(false);
      setNewUser({ name: '', email: '', password: '', confirmPassword: '' });
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
        <button
          className="orbit-btn-primary"
          onClick={() => setShowModal(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: '10px', fontSize: '0.85rem', cursor: 'pointer' }}
        >
          <UserPlus style={{ width: '16px', height: '16px' }} />
          Invite User
        </button>
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
                  const userName = u.name || u.email || 'User';
                  const roleTitle = u.role_name || u.role || 'Member';
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
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
                          <button style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Edit</button>
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
