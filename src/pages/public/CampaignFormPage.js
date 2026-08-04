import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Send, CheckCircle2, Sparkles, ShieldCheck } from 'lucide-react';

const labelStyle = {
  display: 'block',
  fontSize: '0.72rem',
  fontWeight: 800,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '6px',
};

const inputStyle = {
  width: '100%',
  height: '44px',
  padding: '0 14px',
  fontSize: '0.9rem',
  fontWeight: 500,
  color: '#0f172a',
  backgroundColor: '#f8fafc',
  border: '1.5px solid #e2e8f0',
  borderRadius: '12px',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  transition: 'all 0.2s ease',
};

function CampaignFormPage() {
  const [searchParams] = useSearchParams();
  const campaignId = searchParams.get('campaign_id') || '';
  const orgId = searchParams.get('org_id') || '';
  const recipientEmail = searchParams.get('email') || '';

  const [form, setForm] = useState({
    name: '',
    email: recipientEmail,
    phone: '',
    company: '',
    title: '',
    description: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Auto ping open tracking on page load when recipient opens email button
  useEffect(() => {
    if (campaignId) {
      const backendUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      fetch(`${backendUrl}/api/public/track/open?campaign_id=${campaignId}&org_id=${orgId}&email=${encodeURIComponent(recipientEmail)}`).catch((err) =>
        console.warn('Track open ping warning:', err)
      );
    }
    if (recipientEmail) {
      setForm((prev) => ({ ...prev, email: recipientEmail }));
    }
  }, [campaignId, orgId, recipientEmail]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.name.trim()) {
      alert('Please enter your Full Name.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const backendUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const res = await fetch(`${backendUrl}/api/public/campaign-form/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          campaign_id: campaignId,
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          company: form.company.trim(),
          title: form.title.trim(),
          description: form.description.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to submit form.');
      }

      setSubmitted(true);
    } catch (err) {
      console.error('Campaign form submit error:', err);
      setErrorMsg(err.message || 'An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '36px 20px',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 540,
          background: '#ffffff',
          borderRadius: 24,
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          overflow: 'hidden',
        }}
      >
        {/* Header Banner */}
        <div
          style={{
            background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
            padding: '36px 32px 30px',
            color: '#ffffff',
            textAlign: 'center',
            position: 'relative',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(255, 255, 255, 0.2)',
              padding: '5px 14px',
              borderRadius: 99,
              fontSize: 11.5,
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 12,
            }}
          >
            <Sparkles size={13} /> CRM Lite Response Form
          </div>
          <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>
            Get In Touch
          </h1>
          <p style={{ margin: 0, fontSize: 13.5, opacity: 0.9 }}>
            Please fill in your contact details below to connect with our team.
          </p>
        </div>

        {/* Content Body */}
        <div style={{ padding: '32px 36px 36px' }}>
          {submitted ? (
            <div style={{ textAlign: 'center', padding: '24px 12px' }}>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 24,
                  background: '#d1fae5',
                  color: '#10b981',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 20,
                  boxShadow: '0 8px 24px rgba(16, 185, 129, 0.25)',
                }}
              >
                <CheckCircle2 size={42} />
              </div>
              <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800, color: '#0f172a' }}>
                Thank You!
              </h2>
              <p style={{ margin: '0 0 20px', fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>
                Your information has been successfully received and recorded in our CRM system. Our team will reach out shortly!
              </p>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#6366f1',
                  background: 'rgba(99,102,241,0.08)',
                  padding: '8px 16px',
                  borderRadius: 99,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <ShieldCheck size={14} /> Organization Scoped &amp; Encrypted
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {errorMsg && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 12,
                    background: '#fef2f2',
                    border: '1px solid #fca5a5',
                    color: '#991b1b',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {errorMsg}
                </div>
              )}

              <div>
                <label style={labelStyle}>Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="john@company.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Phone Number</label>
                  <input
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Company Name</label>
                  <input
                    type="text"
                    placeholder="Acme Corp"
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Job Title</label>
                  <input
                    type="text"
                    placeholder="Managing Director"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Additional Notes / Interest</label>
                <textarea
                  rows={3}
                  placeholder="Tell us about your requirements..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  style={{ ...inputStyle, height: 'auto', minHeight: 78, padding: '10px 14px' }}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  marginTop: 8,
                  height: 46,
                  borderRadius: 13,
                  fontSize: 14.5,
                  fontWeight: 700,
                  color: '#ffffff',
                  background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
                  border: 'none',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 8px 20px rgba(99,102,241,0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transition: 'all 0.2s ease',
                }}
              >
                <Send size={16} /> {submitting ? 'Submitting Responses...' : 'Submit Details'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default CampaignFormPage;
