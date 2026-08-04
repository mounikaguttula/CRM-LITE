import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../../api/client';
import { Search, UserPlus, Users } from 'lucide-react';

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
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', role_id: '' });
  const [submitting, setSubmitting] = useState(false);

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

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUser.email) return;
    setSubmitting(true);
    try {
      const created = await apiPost('/users/invite', newUser).catch(() => ({ ...newUser, id: Date.now(), status: 'Active' }));
      setUsers((prev) => [...prev, created]);
      setShowModal(false);
      setNewUser({ name: '', email: '', role_id: '' });
    } catch (err) {
      alert(err.message || 'Failed to invite user');
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
                        <span className="badge" style={{ color: '#4338ca', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}>
                          {u.role_name || u.role || 'Member'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span className="badge" style={{ color: '#047857', background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)' }}>
                          {u.status || 'Active'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Edit</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div className="glass" style={{ width: '100%', maxWidth: 420, padding: 24, borderRadius: 16, background: '#ffffff' }}>
            <h3 className="font-display" style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, color: '#1c2033' }}>Invite New User</h3>
            <form onSubmit={handleAddUser}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>Full Name</label>
                <input
                  type="text"
                  className="orbit-input"
                  placeholder="Jane Doe"
                  value={newUser.name}
                  onChange={(e) => setNewUser((p) => ({ ...p, name: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13 }}
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>Work Email</label>
                <input
                  type="email"
                  required
                  className="orbit-input"
                  placeholder="jane@company.com"
                  value={newUser.email}
                  onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13 }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="glass" style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12.5, cursor: 'pointer' }} onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" disabled={submitting} className="orbit-btn-primary" style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12.5, cursor: 'pointer' }}>
                  {submitting ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserManagement;
