import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiDelete } from '../../api/client';
import {
  FileText, Plus, Search, Copy, Check, ExternalLink,
  Users, Edit, Trash2, Eye, ShieldCheck, RefreshCw, BarChart2
} from 'lucide-react';

function FormsPage() {
  const navigate = useNavigate();
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [copiedSlug, setCopiedSlug] = useState(null);
  const [deleteLoadingId, setDeleteLoadingId] = useState(null);

  const fetchForms = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet('/api/forms');
      const data = Array.isArray(res) ? res : res.data || [];
      setForms(data);
    } catch (err) {
      console.error('Error fetching forms:', err);
      setError(err.message || 'Failed to load forms.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForms();
  }, []);

  const handleCopyLink = (slug) => {
    const origin = window.location.origin;
    const url = `${origin}/forms/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2500);
  };

  const handleDeleteForm = async (formId, formName) => {
    if (!window.confirm(`Are you sure you want to delete the form "${formName}"?`)) {
      return;
    }
    setDeleteLoadingId(formId);
    try {
      await apiDelete(`/api/forms/${formId}`);
      setForms((prev) => prev.filter((f) => f.id !== formId));
    } catch (err) {
      alert(`Failed to delete form: ${err.message}`);
    } finally {
      setDeleteLoadingId(null);
    }
  };

  const filteredForms = forms.filter((form) => {
    const matchesSearch = (form.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (form.slug || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || (form.status || 'Draft').toUpperCase() === statusFilter.toUpperCase();
    return matchesSearch && matchesStatus;
  });

  const totalForms = forms.length;
  const activeForms = forms.filter((f) => (f.status || '').toLowerCase() === 'active').length;
  const totalSubmissions = forms.reduce((acc, f) => acc + (f.total_submissions || 0), 0);

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #4f46e5, #818cf8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
            }}>
              <FileText size={20} />
            </div>
            <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>
              Forms Engine
            </h1>
          </div>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
            HubSpot-style dynamic form builder for Lead capture, Webinars, Demo Requests & Contact Us forms.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="button"
            onClick={fetchForms}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
              borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff',
              color: '#475569', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer'
            }}
          >
            <RefreshCw size={15} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => navigate('/workspace/forms/new')}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
              borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
              color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)'
            }}
          >
            <Plus size={18} />
            Create Form
          </button>
        </div>
      </div>

      {/* Metrics Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, marginBottom: 28 }}>
        <div style={{
          background: '#fff', borderRadius: 16, padding: '20px 24px',
          border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
        }}>
          <div style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Total Forms
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a' }}>{totalForms}</div>
        </div>

        <div style={{
          background: '#fff', borderRadius: 16, padding: '20px 24px',
          border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
        }}>
          <div style={{ color: '#16a34a', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Active Published Forms
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#16a34a' }}>{activeForms}</div>
        </div>

        <div style={{
          background: '#fff', borderRadius: 16, padding: '20px 24px',
          border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
        }}>
          <div style={{ color: '#4f46e5', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Total Submissions Collected
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#4f46e5' }}>{totalSubmissions}</div>
        </div>
      </div>

      {/* Controls Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16, marginBottom: 24, background: '#fff', padding: '16px 20px',
        borderRadius: 14, border: '1px solid #e2e8f0'
      }}>
        {/* Search */}
        <div style={{ position: 'relative', width: 340 }}>
          <Search size={16} style={{ position: 'absolute', left: 14, top: 12, color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search forms by name or slug…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%', padding: '9px 12px 9px 38px', borderRadius: 10,
              border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none'
            }}
          />
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>Status:</span>
          {['ALL', 'ACTIVE', 'DRAFT', 'INACTIVE'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600,
                border: statusFilter === st ? '1px solid #4f46e5' : '1px solid #e2e8f0',
                background: statusFilter === st ? '#eef2ff' : '#fff',
                color: statusFilter === st ? '#4f46e5' : '#64748b', cursor: 'pointer'
              }}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
          <RefreshCw size={24} className="spin" style={{ marginBottom: 12 }} />
          <div>Loading Forms…</div>
        </div>
      ) : error ? (
        <div style={{
          padding: 24, borderRadius: 12, background: '#fef2f2',
          border: '1px solid #fecaca', color: '#991b1b', textAlign: 'center'
        }}>
          {error}
        </div>
      ) : filteredForms.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 24px', background: '#fff',
          borderRadius: 16, border: '1px dashed #cbd5e1'
        }}>
          <FileText size={48} color="#94a3b8" style={{ marginBottom: 16 }} />
          <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem', color: '#0f172a' }}>
            {searchTerm || statusFilter !== 'ALL' ? 'No matching forms found' : 'No forms created yet'}
          </h3>
          <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: '0.9rem' }}>
            {searchTerm || statusFilter !== 'ALL'
              ? 'Try updating your search query or filter options.'
              : 'Create your first generic CRM Form to capture leads from your website, campaigns, or social channels.'}
          </p>
          {!searchTerm && statusFilter === 'ALL' && (
            <button
              type="button"
              onClick={() => navigate('/workspace/forms/new')}
              style={{
                padding: '10px 24px', borderRadius: 10, border: 'none',
                background: '#4f46e5', color: '#fff', fontWeight: 700, cursor: 'pointer'
              }}
            >
              Create Your First Form
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 24 }}>
          {filteredForms.map((form) => {
            const isCopied = copiedSlug === form.slug;
            const statusUpper = (form.status || 'DRAFT').toUpperCase();
            const statusColor = statusUpper === 'ACTIVE' ? '#16a34a' : statusUpper === 'DRAFT' ? '#d97706' : '#64748b';
            const statusBg = statusUpper === 'ACTIVE' ? '#f0fdf4' : statusUpper === 'DRAFT' ? '#fffbeb' : '#f1f5f9';

            return (
              <div
                key={form.id}
                style={{
                  background: '#fff', borderRadius: 16, padding: '24px',
                  border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                  display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                  transition: 'all 0.2s ease'
                }}
              >
                <div>
                  {/* Top Status & Submissions Pill */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <span style={{
                      padding: '4px 10px', borderRadius: 20, fontSize: '0.72rem',
                      fontWeight: 700, color: statusColor, background: statusBg,
                      textTransform: 'uppercase', letterSpacing: 0.5
                    }}>
                      ● {statusUpper}
                    </span>

                    <span style={{
                      display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem',
                      fontWeight: 700, color: '#4f46e5', background: '#eef2ff',
                      padding: '4px 12px', borderRadius: 20
                    }}>
                      <Users size={14} />
                      {form.total_submissions || 0} Submissions
                    </span>
                  </div>

                  {/* Form Title */}
                  <h3 style={{ margin: '0 0 8px', fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                    {form.name}
                  </h3>

                  {/* Description */}
                  <p style={{
                    margin: '0 0 16px', color: '#64748b', fontSize: '0.85rem',
                    lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical', overflow: 'hidden'
                  }}>
                    {form.description || 'Generic CRM lead capture form.'}
                  </p>

                  {/* Public Link Pill */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10,
                    padding: '8px 12px', marginBottom: 20
                  }}>
                    <span style={{
                      fontSize: '0.78rem', color: '#475569', fontFamily: 'monospace',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220
                    }}>
                      /forms/{form.slug}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyLink(form.slug)}
                      title="Copy Public Form URL"
                      style={{
                        border: 'none', background: isCopied ? '#16a34a' : '#e2e8f0',
                        color: isCopied ? '#fff' : '#475569', borderRadius: 6,
                        padding: '4px 8px', fontSize: '0.75rem', fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer'
                      }}
                    >
                      {isCopied ? <Check size={13} /> : <Copy size={13} />}
                      {isCopied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* Actions Footer */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
                  borderTop: '1px solid #f1f5f9', paddingTop: 16
                }}>
                  <button
                    type="button"
                    onClick={() => navigate(`/workspace/forms/${form.id}/submissions`)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '9px 12px', borderRadius: 8, border: '1px solid #4f46e5',
                      background: '#eef2ff', color: '#4f46e5', fontSize: '0.82rem',
                      fontWeight: 700, cursor: 'pointer'
                    }}
                  >
                    <BarChart2 size={15} />
                    Submissions
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate(`/workspace/forms/${form.id}/edit`)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1',
                      background: '#fff', color: '#334155', fontSize: '0.82rem',
                      fontWeight: 600, cursor: 'pointer'
                    }}
                  >
                    <Edit size={15} />
                    Edit Form
                  </button>

                  <a
                    href={`/forms/${form.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0',
                      background: '#f8fafc', color: '#475569', fontSize: '0.78rem',
                      fontWeight: 600, textDecoration: 'none'
                    }}
                  >
                    <ExternalLink size={14} />
                    Open Public Page
                  </a>

                  <button
                    type="button"
                    onClick={() => handleDeleteForm(form.id, form.name)}
                    disabled={deleteLoadingId === form.id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '8px 12px', borderRadius: 8, border: '1px solid #fecaca',
                      background: '#fff5f5', color: '#dc2626', fontSize: '0.78rem',
                      fontWeight: 600, cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default FormsPage;
