import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { apiGet, apiPost, apiPatch, apiDelete } from '../../api/client';
import {
  ArrowLeft, Users, Mail, Search, Download, Send, RefreshCw,
  ExternalLink, Trash2
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
  const [attendanceFilter, setAttendanceFilter] = useState('ALL');
  const [selectedSubmissions, setSelectedSubmissions] = useState(new Set());
  const [updatingAttendance, setUpdatingAttendance] = useState(false);

  // Email Registrants Modal State
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [targetAudience, setTargetAudience] = useState('unsent'); // 'unsent' | 'all'
  const [emailAttendanceFilter, setEmailAttendanceFilter] = useState('ALL'); // 'ALL' | 'Registered' | 'Attended' | 'No Show' | 'Unknown'
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailResult, setEmailResult] = useState(null);

  const isWebinarForm = (form?.form_type || '').toLowerCase() === 'webinar_registration' ||
    submissions.some((s) => s.attendance_status !== null && s.attendance_status !== undefined);

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

  const handleDeleteSubmission = async (submissionId, registrantName) => {
    if (!window.confirm(`Are you sure you want to delete the submission for "${registrantName || 'this registrant'}"?`)) {
      return;
    }
    try {
      await apiDelete(`/api/forms/${formId}/submissions/${submissionId}`);
      setSelectedSubmissions((prev) => {
        const next = new Set(prev);
        next.delete(submissionId);
        return next;
      });
      await fetchData();
    } catch (err) {
      alert(`Failed to delete submission: ${err.message}`);
    }
  };

  const handleUpdateAttendance = async (submissionIds, newStatus) => {
    if (!submissionIds || submissionIds.length === 0) return;
    setUpdatingAttendance(true);
    try {
      await apiPatch(`/api/forms/${formId}/submissions/attendance`, {
        submission_ids: submissionIds,
        attendance_status: newStatus,
      });
      // Optimistically update local submissions state
      setSubmissions((prev) =>
        prev.map((sub) =>
          submissionIds.includes(sub.id)
            ? { ...sub, attendance_status: newStatus }
            : sub
        )
      );
      // Clear selection if bulk update
      if (submissionIds.length > 1) {
        setSelectedSubmissions(new Set());
      }
    } catch (err) {
      alert(`Failed to update attendance status: ${err.message}`);
    } finally {
      setUpdatingAttendance(false);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allFilteredIds = filteredSubmissions.map((s) => s.id);
      setSelectedSubmissions(new Set(allFilteredIds));
    } else {
      setSelectedSubmissions(new Set());
    }
  };

  const handleToggleSelectRow = (id) => {
    setSelectedSubmissions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleExportCSV = () => {
    if (submissions.length === 0) {
      alert('No submissions available to export.');
      return;
    }

    const headers = ['Submission ID', 'Registrant Name', 'Email', 'Company', 'Phone', 'Source', 'Attendance Status', 'Submitted At', 'Email Sent'];
    const rows = submissions.map((s) => [
      s.id,
      `"${s.name || ''}"`,
      `"${s.email || ''}"`,
      `"${s.company || ''}"`,
      `"${s.phone || ''}"`,
      `"${s.source || ''}"`,
      `"${s.attendance_status || (isWebinarForm ? 'Registered' : '—')}"`,
      `"${s.submitted_at || ''}"`,
      s.email_sent ? 'Yes' : 'No',
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
        targetAudience,
        attendanceFilter: emailAttendanceFilter !== 'ALL' ? emailAttendanceFilter : null,
      });
      setEmailResult(res);
      fetchData(); // Refresh submission email statuses
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

  const unsentCount = submissions.filter((s) => !s.email_sent && !s.data?.email_sent).length;
  const alreadySentCount = submissions.length - unsentCount;

  const registeredCount = submissions.filter((s) => (s.attendance_status || (isWebinarForm ? 'Registered' : null)) === 'Registered').length;
  const attendedCount = submissions.filter((s) => s.attendance_status === 'Attended').length;
  const noShowCount = submissions.filter((s) => s.attendance_status === 'No Show').length;
  const unknownCount = submissions.filter((s) => s.attendance_status === 'Unknown').length;

  const filteredSubmissions = submissions.filter((sub) => {
    const matchesSearch = (sub.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (sub.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (sub.company || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSource = sourceFilter === 'ALL' || (sub.source || '').toLowerCase().includes(sourceFilter.toLowerCase());
    
    let matchesAttendance = true;
    if (attendanceFilter !== 'ALL') {
      const effectiveAttendance = sub.attendance_status || (isWebinarForm ? 'Registered' : '');
      matchesAttendance = effectiveAttendance === attendanceFilter;
    }

    return matchesSearch && matchesSource && matchesAttendance;
  });

  const uniqueSources = Array.from(new Set(submissions.map((s) => s.source).filter(Boolean)));

  // Calculate target audience email count in modal based on combined filters
  const getModalTargetCount = () => {
    let pool = submissions;
    if (emailAttendanceFilter !== 'ALL') {
      pool = pool.filter((s) => (s.attendance_status || (isWebinarForm ? 'Registered' : '')) === emailAttendanceFilter);
    }
    if (targetAudience === 'unsent') {
      pool = pool.filter((s) => !s.email_sent && !s.data?.email_sent);
    }
    return pool.length;
  };

  const getAttendanceBadgeStyle = (status) => {
    switch (status) {
      case 'Attended':
        return { background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' };
      case 'No Show':
        return { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' };
      case 'Registered':
        return { background: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe' };
      case 'Unknown':
      default:
        return { background: '#f8fafc', color: '#64748b', border: '1px solid #cbd5e1' };
    }
  };

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
              {isWebinarForm && (
                <span style={{ marginLeft: 10, background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700 }}>
                  🎓 Webinar Registration Form
                </span>
              )}
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
            onClick={() => { setShowEmailModal(true); setEmailResult(null); setTargetAudience('unsent'); setEmailAttendanceFilter('ALL'); }}
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#fff', padding: 18, borderRadius: 14, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>
            Total Registrants
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#0f172a' }}>{submissions.length}</div>
        </div>

        {isWebinarForm && (
          <>
            <div style={{ background: '#fff', padding: 18, borderRadius: 14, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.78rem', color: '#4f46e5', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>
                Registered
              </div>
              <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#4f46e5' }}>{registeredCount}</div>
            </div>

            <div style={{ background: '#fff', padding: 18, borderRadius: 14, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.78rem', color: '#059669', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>
                Attended
              </div>
              <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#059669' }}>{attendedCount}</div>
            </div>

            <div style={{ background: '#fff', padding: 18, borderRadius: 14, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>
                No Show
              </div>
              <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#dc2626' }}>{noShowCount}</div>
            </div>

            {unknownCount > 0 && (
              <div style={{ background: '#fff', padding: 18, borderRadius: 14, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>
                  Unknown
                </div>
                <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#64748b' }}>{unknownCount}</div>
              </div>
            )}
          </>
        )}

        <div style={{ background: '#fff', padding: 18, borderRadius: 14, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.78rem', color: '#d97706', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>
            Unsent Registrants
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#d97706' }}>{unsentCount}</div>
        </div>

        <div style={{ background: '#fff', padding: 18, borderRadius: 14, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.78rem', color: '#059669', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>
            Emailed Registrants
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#059669' }}>{alreadySentCount}</div>
        </div>
      </div>

      {/* Controls Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        marginBottom: 20, background: '#fff', padding: '14px 20px',
        borderRadius: 12, border: '1px solid #e2e8f0'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: 300 }}>
            <Search size={16} style={{ position: 'absolute', left: 14, top: 11, color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search registrants…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px 8px 38px', borderRadius: 8,
                border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none'
              }}
            />
          </div>

          {isWebinarForm && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>Attendance:</span>
              <select
                value={attendanceFilter}
                onChange={(e) => setAttendanceFilter(e.target.value)}
                style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 600 }}
              >
                <option value="ALL">All Attendance Statuses</option>
                <option value="Registered">Registered</option>
                <option value="Attended">Attended</option>
                <option value="No Show">No Show</option>
                <option value="Unknown">Unknown</option>
              </select>
            </div>
          )}

          {uniqueSources.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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

        {/* Bulk Action Controls */}
        {selectedSubmissions.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f8fafc', padding: '6px 14px', borderRadius: 8, border: '1px solid #cbd5e1' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
              {selectedSubmissions.size} Selected
            </span>
            <div style={{ height: 16, width: 1, background: '#cbd5e1' }} />
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Mark as:</span>
            <button
              type="button"
              disabled={updatingAttendance}
              onClick={() => handleUpdateAttendance(Array.from(selectedSubmissions), 'Attended')}
              style={{
                padding: '4px 10px', borderRadius: 6, border: 'none', background: '#059669',
                color: '#fff', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer'
              }}
            >
              ✓ Attended
            </button>
            <button
              type="button"
              disabled={updatingAttendance}
              onClick={() => handleUpdateAttendance(Array.from(selectedSubmissions), 'No Show')}
              style={{
                padding: '4px 10px', borderRadius: 6, border: 'none', background: '#dc2626',
                color: '#fff', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer'
              }}
            >
              ✕ No Show
            </button>
            <button
              type="button"
              disabled={updatingAttendance}
              onClick={() => handleUpdateAttendance(Array.from(selectedSubmissions), 'Registered')}
              style={{
                padding: '4px 10px', borderRadius: 6, border: 'none', background: '#4f46e5',
                color: '#fff', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer'
              }}
            >
              ● Registered
            </button>
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
            No registrants match your filter criteria.
          </p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                <th style={{ padding: '14px 16px', width: 40, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={filteredSubmissions.length > 0 && selectedSubmissions.size === filteredSubmissions.length}
                    onChange={handleSelectAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th style={{ padding: '14px 20px' }}>Registrant Name</th>
                <th style={{ padding: '14px 20px' }}>Email Address</th>
                <th style={{ padding: '14px 20px' }}>Company</th>
                {isWebinarForm && <th style={{ padding: '14px 20px' }}>Attendance Status</th>}
                <th style={{ padding: '14px 20px' }}>Submission Date</th>
                <th style={{ padding: '14px 20px' }}>Email Status</th>
                <th style={{ padding: '14px 20px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubmissions.map((sub) => {
                const isEmailed = sub.email_sent || sub.data?.email_sent;
                const sentAt = sub.last_email_sent_at || sub.data?.last_email_sent_at;
                const currentAttendance = sub.attendance_status || (isWebinarForm ? 'Registered' : '—');
                const isSelected = selectedSubmissions.has(sub.id);

                return (
                  <tr key={sub.id} style={{ borderBottom: '1px solid #f1f5f9', background: isSelected ? '#f8fafc' : '#fff' }}>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectRow(sub.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '14px 20px', fontWeight: 700, color: '#0f172a' }}>
                      {sub.name || 'Anonymous'}
                    </td>
                    <td style={{ padding: '14px 20px', color: '#4f46e5', fontWeight: 600 }}>
                      {sub.email || '—'}
                    </td>
                    <td style={{ padding: '14px 20px', color: '#334155' }}>
                      {sub.company || '—'}
                    </td>

                    {/* Attendance Status Dropdown Select */}
                    {isWebinarForm && (
                      <td style={{ padding: '14px 20px' }}>
                        <select
                          value={currentAttendance}
                          onChange={(e) => handleUpdateAttendance([sub.id], e.target.value)}
                          style={{
                            padding: '4px 10px', borderRadius: 8, fontSize: '0.8rem',
                            fontWeight: 700, cursor: 'pointer', outline: 'none',
                            ...getAttendanceBadgeStyle(currentAttendance)
                          }}
                        >
                          <option value="Registered">Registered</option>
                          <option value="Attended">Attended</option>
                          <option value="No Show">No Show</option>
                          <option value="Unknown">Unknown</option>
                        </select>
                      </td>
                    )}

                    <td style={{ padding: '14px 20px', color: '#64748b', fontSize: '0.82rem' }}>
                      {new Date(sub.submitted_at).toLocaleString()}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      {isEmailed ? (
                        <span
                          title={sentAt ? `Sent on ${new Date(sentAt).toLocaleString()}` : 'Email sent'}
                          style={{
                            padding: '4px 10px', borderRadius: 6, background: '#ecfdf5',
                            fontSize: '0.75rem', fontWeight: 700, color: '#059669', border: '1px solid #a7f3d0'
                          }}
                        >
                          ✓ Email Sent
                        </span>
                      ) : (
                        <span style={{
                          padding: '4px 10px', borderRadius: 6, background: '#fff7ed',
                          fontSize: '0.75rem', fontWeight: 700, color: '#c2410c', border: '1px solid #ffedd5'
                        }}>
                          ● Pending
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                        <button
                          type="button"
                          onClick={() => handleDeleteSubmission(sub.id, sub.name)}
                          title="Delete Submission"
                          style={{
                            border: 'none', background: '#fef2f2', color: '#dc2626',
                            borderRadius: 6, padding: '6px 8px', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* EMAIL REGISTRANTS MODAL */}
      {showEmailModal && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999, padding: 24
        }}>
          <div style={{
            background: '#fff', borderRadius: 20, width: '100%', maxWidth: 720,
            padding: 32, position: 'relative', maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)'
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
                  Send targeted email updates to registrants for "{form?.name}".
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

            {/* Attendance Status Segment Selection (if Webinar Form) */}
            {isWebinarForm && (
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontWeight: 700, color: '#334155', fontSize: '0.85rem', marginBottom: 8 }}>
                  Attendance Status Filter
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {[
                    { id: 'ALL', label: 'All Statuses', count: submissions.length },
                    { id: 'Registered', label: 'Registered', count: registeredCount },
                    { id: 'Attended', label: 'Attended', count: attendedCount },
                    { id: 'No Show', label: 'No Show', count: noShowCount },
                    { id: 'Unknown', label: 'Unknown', count: unknownCount },
                  ].map((item) => {
                    const isSelected = emailAttendanceFilter === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setEmailAttendanceFilter(item.id)}
                        style={{
                          padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
                          border: isSelected ? '1.5px solid #4f46e5' : '1px solid #cbd5e1',
                          background: isSelected ? '#eef2ff' : '#ffffff',
                          color: isSelected ? '#4f46e5' : '#475569',
                          fontWeight: 700, fontSize: '0.82rem',
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <span>{item.label}</span>
                        <span style={{
                          background: isSelected ? '#4f46e5' : '#f1f5f9',
                          color: isSelected ? '#ffffff' : '#64748b',
                          borderRadius: 10, padding: '1px 7px', fontSize: '0.74rem', fontWeight: 800
                        }}>
                          {item.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Email Status Target Selector */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontWeight: 700, color: '#334155', fontSize: '0.85rem', marginBottom: 8 }}>
                Email Delivery Status Filter
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div
                  onClick={() => setTargetAudience('unsent')}
                  style={{
                    padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                    border: targetAudience === 'unsent' ? '2px solid #4f46e5' : '1px solid #cbd5e1',
                    background: targetAudience === 'unsent' ? '#eef2ff' : '#ffffff',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a', marginBottom: 4 }}>
                    Unsent Only
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                    Send only to registrants who haven't received an email yet.
                  </div>
                </div>

                <div
                  onClick={() => setTargetAudience('all')}
                  style={{
                    padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                    border: targetAudience === 'all' ? '2px solid #4f46e5' : '1px solid #cbd5e1',
                    background: targetAudience === 'all' ? '#eef2ff' : '#ffffff',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a', marginBottom: 4 }}>
                    All Registrants (Include Previously Emailed)
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                    Send to all matching registrants regardless of past email status.
                  </div>
                </div>
              </div>
            </div>

            {/* Combined Audience Summary Banner */}
            <div style={{
              padding: '12px 16px', borderRadius: 10, background: '#f8fafc',
              border: '1px solid #e2e8f0', marginBottom: 20, display: 'flex',
              alignItems: 'center', justifyContent: 'space-between'
            }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                Target Recipients: <strong>{getModalTargetCount()} registrant(s)</strong>
                {emailAttendanceFilter !== 'ALL' && ` [Attendance: ${emailAttendanceFilter}]`}
                {` [Email Status: ${targetAudience === 'unsent' ? 'Unsent Only' : 'All'}]`}
              </span>
              {getModalTargetCount() === 0 && (
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#dc2626' }}>
                  No matching registrants found.
                </span>
              )}
            </div>

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
                disabled={sendingEmail || getModalTargetCount() === 0}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px',
                  borderRadius: 10, border: 'none',
                  background: getModalTargetCount() === 0
                    ? '#cbd5e1'
                    : 'linear-gradient(135deg, #4f46e5, #6366f1)',
                  color: '#fff', fontWeight: 700,
                  cursor: getModalTargetCount() === 0 ? 'not-allowed' : 'pointer',
                  boxShadow: getModalTargetCount() === 0
                    ? 'none'
                    : '0 4px 14px rgba(79, 70, 229, 0.3)'
                }}
              >
                <Send size={16} />
                {sendingEmail
                  ? 'Sending Emails…'
                  : `Send to ${getModalTargetCount()} Registrants`
                }
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default FormSubmissionsPage;
