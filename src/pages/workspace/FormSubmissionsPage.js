import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiGet, apiPost } from '../../api/client';
import {
  ArrowLeft, Users, Mail, Search, Download, Send, RefreshCw,
  ExternalLink, CheckCircle, AlertCircle, FileText, Calendar, Filter
} from 'lucide-react';

function FormSubmissionsPage() {
  const { formId } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [selectedSubmission, setSelectedSubmission] = useState(null);

  // Email Registrants Modal State
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailResult, setEmailResult] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [formData, subsData] = await Promise.all([
        apiGet(`/api/forms/${formId}`),
        apiGet(`/api/forms/${formId}/submissions`),
      ]);
      setForm(formData);
      setSubmissions(Array.isArray(subsData) ? subsData : subsData.data || []);
      if (formData?.name) {
        setEmailSubject(`Important Update: ${formData.name}`);
        setEmailBody(`Hi {{FirstName}},\n\nThank you for registering for ${formData.name}.\n\nBest regards,\nThe Team`);
      }
    } catch (err) {
      console.error('Error fetching submissions:', err);
      setError(err.message || 'Failed to load form submissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [formId]);

  const handleExportCSV = () => {
    if (submissions.length === 0) {
      alert('No submissions available to export.');
      return;
    }

    const headers = ['Submission ID', 'Registrant Name', 'Email', 'Company', 'Phone', 'Source', 'Submitted At'];
    const rows = submissions.map((s) => [
      s.id,
      `"${s.name || ''}"`,
      `"${s.email || ''}"`,
      `"${s.company || ''}"`,
      `"${s.phone || ''}"`,
      `"${s.source || ''}"`,
      `"${s.submitted_at || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `form_submissions_${form?.slug || 'export'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSendEmail = async () => {
    if (!emailSubject.trim()) {
      alert('Please enter an email subject.');
      return;
    }
    if (!emailBody.trim()) {
      alert('Please enter email content.');
      return;
    }

    setSendingEmail(true);
    setEmailResult(null);

    try {
      const res = await apiPost(`/api/forms/${formId}/email-registrants`, {
        subject: emailSubject.trim(),
        body: emailBody.trim(),
      });
      setEmailResult(res);
    } catch (err) {
      console.error('Error sending email to registrants:', err);
      setEmailResult({
        success: false,
        message: err.message || 'Failed to dispatch emails.',
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const filteredSubmissions = submissions.filter((sub) => {
    const matchesSearch = (sub.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (sub.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (sub.company || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSource = sourceFilter === 'ALL' || (sub.source || '').toLowerCase().includes(sourceFilter.toLowerCase());
    return matchesSearch && matchesSource;
  });

  const uniqueSources = Array.from(new Set(submissions.map((s) => s.source).filter(Boolean)));

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            type="button"
            onClick={() => navigate('/workspace/forms')}
            style={{
              border: 'none', background: '#f1f5f9', color: '#475569',
              borderRadius: 8, padding: '8px 12px', display: 'flex',
              alignItems: 'center', gap: 6, fontWeight: 600, cursor: 'pointer'
            }}
          >
            <ArrowLeft size={16} />
            Back to Forms
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
              Submissions: {form?.name || 'Form Registrations'}
            </h1>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>
              Public URL: <code style={{ color: '#4f46e5' }}>/forms/{form?.slug}</code>
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            onClick={handleExportCSV}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
              borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff',
              color: '#334155', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer'
            }}
          >
            <Download size={16} />
            Export CSV
          </button>

          <button
            type="button"
            onClick={() => { setShowEmailModal(true); setEmailResult(null); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
              borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
              color: '#fff', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)'
            }}
          >
            <Mail size={18} />
            Email Registrants
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, marginBottom: 24 }}>
        <div style={{ background: '#fff', padding: 20, borderRadius: 14, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>
            Total Registrations
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a' }}>{submissions.length}</div>
        </div>

        <div style={{ background: '#fff', padding: 20, borderRadius: 14, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.8rem', color: '#16a34a', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>
            Unique Registrants
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#16a34a' }}>
            {new Set(submissions.map((s) => (s.email || '').toLowerCase())).size}
          </div>
        </div>

        <div style={{ background: '#fff', padding: 20, borderRadius: 14, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.8rem', color: '#4f46e5', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>
            Leads Created in CRM
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#4f46e5' }}>
            {submissions.filter((s) => s.lead_id).length}
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20, background: '#fff', padding: '14px 20px',
        borderRadius: 12, border: '1px solid #e2e8f0'
      }}>
        <div style={{ position: 'relative', width: 340 }}>
          <Search size={16} style={{ position: 'absolute', left: 14, top: 11, color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search registrants by name, email, or company…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px 8px 38px', borderRadius: 8,
              border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none'
            }}
          />
        </div>

        {uniqueSources.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>Source:</span>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
            >
              <option value="ALL">All Sources</option>
              {uniqueSources.map((src) => (
                <option key={src} value={src}>{src}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Submissions Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
          <RefreshCw size={24} className="spin" style={{ marginBottom: 12 }} />
          <div>Loading Registrations…</div>
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 24px', background: '#fff',
          borderRadius: 16, border: '1px dashed #cbd5e1'
        }}>
          <Users size={44} color="#94a3b8" style={{ marginBottom: 12 }} />
          <h3 style={{ margin: '0 0 6px', color: '#0f172a' }}>No Submissions Found</h3>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.88rem' }}>
            No registrants match your search criteria. Share your public URL <code style={{ color: '#4f46e5' }}>/forms/{form?.slug}</code> to collect submissions.
          </p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                <th style={{ padding: '14px 20px' }}>Registrant Name</th>
                <th style={{ padding: '14px 20px' }}>Email Address</th>
                <th style={{ padding: '14px 20px' }}>Company</th>
                <th style={{ padding: '14px 20px' }}>Phone</th>
                <th style={{ padding: '14px 20px' }}>Submission Date</th>
                <th style={{ padding: '14px 20px' }}>Source</th>
                <th style={{ padding: '14px 20px' }}>Associated Lead</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubmissions.map((sub) => (
                <tr key={sub.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '14px 20px', fontWeight: 700, color: '#0f172a' }}>
                    {sub.name || 'Anonymous'}
                  </td>
                  <td style={{ padding: '14px 20px', color: '#4f46e5', fontWeight: 600 }}>
                    {sub.email || '—'}
                  </td>
                  <td style={{ padding: '14px 20px', color: '#334155' }}>
                    {sub.company || '—'}
                  </td>
                  <td style={{ padding: '14px 20px', color: '#334155' }}>
                    {sub.phone || '—'}
                  </td>
                  <td style={{ padding: '14px 20px', color: '#64748b', fontSize: '0.82rem' }}>
                    {new Date(sub.submitted_at).toLocaleString()}
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{
                      padding: '4px 8px', borderRadius: 6, background: '#f1f5f9',
                      fontSize: '0.75rem', fontWeight: 600, color: '#475569'
                    }}>
                      {sub.source || 'Direct'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    {sub.lead_id ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/workspace/object/lead/${sub.lead_id}`)}
                        style={{
                          border: 'none', background: '#eef2ff', color: '#4f46e5',
                          borderRadius: 6, padding: '4px 10px', fontSize: '0.78rem',
                          fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer'
                        }}
                      >
                        <ExternalLink size={13} />
                        View Lead
                      </button>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* EMAIL REGISTRANTS MODAL */}
      {showEmailModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 24
        }}>
          <div style={{
            background: '#fff', borderRadius: 20, width: '100%', maxWidth: 700,
            padding: 32, position: 'relative'
          }}>
            <button
              type="button"
              onClick={() => setShowEmailModal(false)}
              style={{
                position: 'absolute', top: 20, right: 20, border: 'none',
                background: '#f1f5f9', color: '#475569', borderRadius: 20,
                width: 36, height: 36, fontWeight: 700, cursor: 'pointer'
              }}
            >
              ✕
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, background: '#eef2ff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5'
              }}>
                <Mail size={22} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a' }}>
                  Email Form Registrants
                </h2>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>
                  Send individual email updates to {submissions.length} registrants for "{form?.name}".
                </p>
              </div>
            </div>

            {emailResult && (
              <div style={{
                padding: 16, borderRadius: 12, marginBottom: 20,
                background: emailResult.success ? '#f0fdf4' : '#fef2f2',
                border: emailResult.success ? '1px solid #bbf7d0' : '1px solid #fecaca',
                color: emailResult.success ? '#166534' : '#991b1b'
              }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>
                  {emailResult.success ? 'Email Campaign Complete!' : 'Dispatch Error'}
                </div>
                <div style={{ fontSize: '0.88rem' }}>{emailResult.message}</div>
                {emailResult.success && (
                  <div style={{ fontSize: '0.82rem', marginTop: 6, fontWeight: 600 }}>
                    ● Sent: {emailResult.sent} &nbsp; | &nbsp; Failed: {emailResult.failed} &nbsp; | &nbsp; Invalid: {emailResult.invalid}
                  </div>
                )}
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontWeight: 700, color: '#334155', fontSize: '0.85rem', marginBottom: 6 }}>
                Subject Line *
              </label>
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Reminder - Tomorrow's Event"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontWeight: 700, color: '#334155', fontSize: '0.85rem' }}>
                  Email Message Body *
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['{{FirstName}}', '{{LastName}}', '{{FormName}}'].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setEmailBody((prev) => `${prev} ${tag}`)}
                      style={{
                        border: '1px solid #cbd5e1', background: '#f8fafc',
                        color: '#4f46e5', fontSize: '0.72rem', fontWeight: 700,
                        padding: '3px 8px', borderRadius: 6, cursor: 'pointer'
                      }}
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                rows={8}
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.9rem', lineHeight: 1.6 }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                style={{
                  padding: '10px 20px', borderRadius: 10, border: '1px solid #cbd5e1',
                  background: '#fff', color: '#475569', fontWeight: 600, cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendEmail}
                disabled={sendingEmail}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px',
                  borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                  color: '#fff', fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)'
                }}
              >
                <Send size={16} />
                {sendingEmail ? 'Sending Emails…' : `Send to ${submissions.length} Registrants`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FormSubmissionsPage;
