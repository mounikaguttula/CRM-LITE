import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { apiGet, apiPost } from '../../api/client';
import { CheckCircle2, AlertTriangle, Calendar, Clock, Sparkles, Send, Globe, HelpCircle } from 'lucide-react';

const LinkedinIcon = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

const TwitterIcon = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
  </svg>
);

const YoutubeIcon = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
  </svg>
);

function PublicFormPage() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();

  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [focusedFieldId, setFocusedFieldId] = useState(null);

  // Dynamic field responses state
  const [fieldValues, setFieldValues] = useState({});

  // Visitor Inquiry State (for Webinar / Event forms)
  const [inquiryName, setInquiryName] = useState('');
  const [inquiryEmail, setInquiryEmail] = useState('');
  const [inquiryQuestion, setInquiryQuestion] = useState('');
  const [inquirySubmitting, setInquirySubmitting] = useState(false);
  const [inquirySubmitted, setInquirySubmitted] = useState(false);
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [inquiryErrors, setInquiryErrors] = useState({});

  useEffect(() => {
    fetchPublicForm();
  }, [slug]);

  const fetchPublicForm = async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const res = await apiGet(`/api/public/forms/${slug}`);
      if (res && res.data) {
        setForm(res.data);
        const initial = {};
        (res.data.fields_config || []).forEach((f) => {
          initial[f.api_name] = '';
        });
        setFieldValues(initial);
      } else {
        setNotFound(true);
      }
    } catch (err) {
      console.error('Error fetching public form:', err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (apiName, value) => {
    setFieldValues((prev) => ({ ...prev, [apiName]: value }));
    if (formErrors[apiName]) {
      setFormErrors((prev) => ({ ...prev, [apiName]: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form) return;

    const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/;
    const errors = {};
    (form.fields_config || []).forEach((f) => {
      const val = fieldValues[f.api_name];
      const strVal = val !== undefined && val !== null ? String(val).trim() : '';
      if (f.required && !strVal) {
        errors[f.api_name] = `${f.label || f.api_name} is required.`;
      } else if (strVal && (f.type === 'email' || (f.api_name || '').toLowerCase().includes('email') || (f.label || '').toLowerCase().includes('email'))) {
        if (!EMAIL_REGEX.test(strVal)) {
          errors[f.api_name] = `Please enter a valid email address for ${f.label || f.api_name} (e.g. user@company.com).`;
        }
      }
    });

    // Check for duplicate Primary Email and Alternate Email ID
    const primaryEmailKey = Object.keys(fieldValues).find(k => ['email', 'work_email', 'primary_email'].includes(k.toLowerCase())) || 'email';
    const altEmailKey = Object.keys(fieldValues).find(k => ['alternate_email', 'alternate_email_id', 'secondary_email', 'alt_email'].includes(k.toLowerCase()));
    
    if (primaryEmailKey && altEmailKey && fieldValues[primaryEmailKey] && fieldValues[altEmailKey]) {
      const pVal = String(fieldValues[primaryEmailKey]).trim().toLowerCase();
      const aVal = String(fieldValues[altEmailKey]).trim().toLowerCase();
      if (pVal && aVal && pVal === aVal) {
        errors[altEmailKey] = 'Email and Alternate Email ID cannot be the same address.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSubmitting(true);

    const utm_source = searchParams.get('utm_source') || searchParams.get('source') || 'Direct';
    const utm_medium = searchParams.get('utm_medium') || 'Web Form';
    const utm_campaign = searchParams.get('utm_campaign') || form.name;
    const referrer = document.referrer || '';

    try {
      const res = await apiPost(`/api/public/forms/${slug}/submit`, {
        submitted_fields: fieldValues,
        utm_source,
        utm_medium,
        utm_campaign,
        referrer,
      });

      if (res.success) {
        setSubmittedSuccess(true);
        setSubmitMessage(res.message || form.appearance?.success_message || 'Thank you! Your response has been submitted.');
      } else {
        alert(res.message || 'Submission failed. Please try again.');
      }
    } catch (err) {
      console.error('Submission error:', err);
      const msg = err.message || 'An error occurred while submitting the form.';
      if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('duplicate')) {
        const emailFieldKey = Object.keys(fieldValues).find(k => k.toLowerCase().includes('email')) || 'email';
        setFormErrors((prev) => ({ ...prev, [emailFieldKey]: msg }));
      }
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleInquirySubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/;

    if (!inquiryName.trim()) {
      errors.name = 'Name is required.';
    }
    if (!inquiryEmail.trim()) {
      errors.email = 'Email address is required.';
    } else if (!EMAIL_REGEX.test(inquiryEmail.trim())) {
      errors.email = 'Please enter a valid email address.';
    }
    if (!inquiryQuestion.trim()) {
      errors.question = 'Question is required.';
    }

    if (Object.keys(errors).length > 0) {
      setInquiryErrors(errors);
      return;
    }

    setInquiryErrors({});
    setInquirySubmitting(true);

    try {
      const res = await apiPost(`/api/public/forms/${slug}/inquiries`, {
        name: inquiryName.trim(),
        email: inquiryEmail.trim(),
        question: inquiryQuestion.trim(),
      });

      if (res.success) {
        setInquirySubmitted(true);
        setInquiryMessage(res.message || 'Your question has been submitted. Our team will get back to you.');
        setInquiryName('');
        setInquiryEmail('');
        setInquiryQuestion('');
      } else {
        alert(res.message || 'Failed to submit question. Please try again.');
      }
    } catch (err) {
      console.error('Inquiry submission error:', err);
      alert(err.message || 'An error occurred while submitting your question.');
    } finally {
      setInquirySubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#0f172a', color: '#94a3b8'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner-border text-primary me-2" role="status" />
          <div>Loading Form…</div>
        </div>
      </div>
    );
  }

  if (notFound || !form) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#f8fafc', padding: 24
      }}>
        <div style={{
          background: '#fff', padding: 48, borderRadius: 20,
          boxShadow: '0 10px 30px rgba(0,0,0,0.05)', textAlign: 'center',
          maxWidth: 480, width: '100%', border: '1px solid #e2e8f0'
        }}>
          <AlertTriangle size={56} color="#ef4444" style={{ marginBottom: 16 }} />
          <h2 style={{ margin: '0 0 8px', color: '#0f172a', fontWeight: 800 }}>Form Not Found</h2>
          <p style={{ color: '#64748b', margin: 0, fontSize: '0.95rem' }}>
            The form you are trying to access does not exist or is currently inactive.
          </p>
        </div>
      </div>
    );
  }

  const appearance = form.appearance || {};
  const headerContent = form.header_content || {};
  const fields = form.fields_config || [];
  const speakers = headerContent.speakers || [];
  const learnItems = headerContent.learn_items || [];
  const badges = headerContent.badges || [];
  const productBlock = headerContent.product_block || {};
  const faqs = headerContent.faqs || [];
  const footer = headerContent.footer || {};
  const presetLayout = appearance.preset_layout || 'event_registration';
  const formTypeVal = (form.form_type || '').toLowerCase();
  const presetLayoutVal = (appearance.preset_layout || '').toLowerCase();
  const isWebinarForm = formTypeVal === 'webinar_registration' || presetLayoutVal === 'event_registration';
  const primaryColor = appearance.primary_color || '#4f46e5';
  const fontFamily = appearance.font_family || 'Inter';
  const borderRadius = appearance.border_radius || '12px';
  const heroBgImage = headerContent.hero_bg_image || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1200';
  const brandName = headerContent.brand_name !== undefined ? headerContent.brand_name : 'TRACKnow';

  const showNavLinks = headerContent.show_nav_links !== false;
  const navLink1Text = headerContent.nav_link1_text || 'About';
  const navLink1Target = headerContent.nav_link1_target || '#learn';
  const navLink2Text = headerContent.nav_link2_text || 'Speakers';
  const navLink2Target = headerContent.nav_link2_target || '#speakers';
  const speakersTitle = headerContent.speakers_title || 'Featured Speaker';
  const formCardTitle = headerContent.form_card_title || 'Register for the Event';
  const learnItemsTitle = headerContent.learn_items_title || "What You'll Learn";

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: fontFamily, color: '#0f172a', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>

      <div>
        {/* Website Header */}
        <div style={{ height: 60, padding: '0 32px', background: '#ffffff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {headerContent.logo_url ? (
              <img
                src={headerContent.logo_url}
                alt="Logo"
                style={{ height: 46, maxHeight: 48, width: 'auto', objectFit: 'contain', display: 'block', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.15))' }}
              />
            ) : (
              brandName ? (
                <div style={{ padding: '6px 14px', borderRadius: 8, background: primaryColor, color: '#ffffff', fontWeight: 900, fontSize: '0.95rem', letterSpacing: -0.3, boxShadow: `0 3px 10px ${primaryColor}40` }}>
                  {brandName}
                </div>
              ) : null
            )}
            {headerContent.logo_url && brandName && (
              <span style={{ fontWeight: 900, fontSize: '1.1rem', color: '#0f172a', letterSpacing: -0.5 }}>{brandName}</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>
            {showNavLinks && (
              <>
                {navLink1Text && <a href={navLink1Target} style={{ color: '#475569', textDecoration: 'none', transition: 'color 0.15s ease' }}>{navLink1Text}</a>}
                {navLink2Text && <a href={navLink2Target} style={{ color: '#475569', textDecoration: 'none', transition: 'color 0.15s ease' }}>{navLink2Text}</a>}
              </>
            )}
            <a href="#register" style={{ border: 'none', background: primaryColor, color: '#fff', borderRadius: 8, padding: '8px 18px', fontWeight: 800, fontSize: '0.82rem', textDecoration: 'none', transition: 'all 0.15s ease' }}>
              {appearance.submit_button_text || 'Register Now'}
            </a>
          </div>
        </div>

        {presetLayout === 'split_layout' ? (
          /* TRUE 50/50 SIDE-BY-SIDE SPLIT SCREEN VIEW */
          <div style={{ maxWidth: 1140, margin: '0 auto', padding: '40px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 36, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                {badges.map((b, i) => (
                  <span key={i} style={{ background: primaryColor, color: '#ffffff', padding: '4px 12px', borderRadius: 16, fontSize: '0.75rem', fontWeight: 800, letterSpacing: 0.5 }}>
                    {b}
                  </span>
                ))}
              </div>

              <h1 style={{ margin: 0, fontSize: '2.2rem', fontWeight: 900, color: '#0f172a', lineHeight: 1.2 }}>
                {headerContent.title || form.name}
              </h1>

              <p style={{ margin: 0, fontSize: '1.05rem', color: '#475569', lineHeight: 1.6 }}>
                {headerContent.subtitle !== undefined && headerContent.subtitle !== null ? headerContent.subtitle : form.description}
              </p>

              {learnItems.length > 0 && (
                <div
                  id="learn"
                  style={{ background: '#ffffff', borderRadius: borderRadius, padding: 24, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}
                  onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.08)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.03)'; }}
                >
                  <h3 style={{ margin: '0 0 14px', fontSize: '1.05rem', fontWeight: 800 }}>{learnItemsTitle}</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {learnItems.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 10, fontSize: '0.88rem', color: '#334155' }}>
                        <span style={{ color: primaryColor, fontWeight: 900 }}>✓</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {speakers.length > 0 && (
                <div
                  id="speakers"
                  style={{ background: '#ffffff', borderRadius: borderRadius, padding: 24, border: '1px solid #e2e8f0', transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}
                  onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.08)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a', marginBottom: 16 }}>{speakersTitle}</div>
                  {speakers.map((spk, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: idx < speakers.length - 1 ? 20 : 0 }}>
                      <img src={spk.avatar_url} alt={spk.name} style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${primaryColor}`, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>{spk.name}</div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', margin: '2px 0 6px' }}>{spk.title}, {spk.company}</div>
                        {spk.bio && <p style={{ margin: 0, fontSize: '0.82rem', color: '#475569', lineHeight: 1.5, textAlign: 'justify' }}>{spk.bio}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div id="register" style={{ background: '#ffffff', borderRadius: borderRadius, padding: 32, border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.06)', position: 'sticky', top: 24, transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}>
              <h3 style={{ margin: '0 0 20px', fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', borderBottom: '1px solid #f1f5f9', paddingBottom: 12 }}>
                {formCardTitle}
              </h3>

              {submittedSuccess ? (
                <div style={{ textAlign: 'center', padding: '30px 10px' }}>
                  <CheckCircle2 size={56} color="#16a34a" style={{ marginBottom: 16 }} />
                  <h4 style={{ margin: '0 0 10px', fontSize: '1.3rem', fontWeight: 800, color: '#0f172a' }}>Registration Confirmed!</h4>
                  <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: 1.6, margin: 0 }}>
                    {submitMessage}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {fields.map((field) => {
                    const errorMsg = formErrors[field.api_name];
                    const isRequired = field.required;
                    const isFocused = focusedFieldId === field.id;

                    return (
                      <div key={field.id}>
                        <label style={{ display: 'block', fontWeight: 700, color: '#334155', fontSize: '0.85rem', marginBottom: 5 }}>
                          {field.label} {isRequired && <span style={{ color: '#ef4444' }}>*</span>}
                        </label>

                        {field.type === 'textarea' ? (
                          <textarea
                            rows={3}
                            placeholder={field.placeholder || ''}
                            value={fieldValues[field.api_name] || ''}
                            onChange={(e) => handleInputChange(field.api_name, e.target.value)}
                            onFocus={() => setFocusedFieldId(field.id)}
                            onBlur={() => setFocusedFieldId(null)}
                            style={{
                              width: '100%', padding: '10px 14px', borderRadius: 8,
                              border: errorMsg ? '2px solid #ef4444' : isFocused ? `2px solid ${primaryColor}` : '1px solid #cbd5e1',
                              boxShadow: isFocused ? `0 0 0 4px ${primaryColor}25` : 'none',
                              fontSize: '0.88rem', outline: 'none', transition: 'all 0.2s ease', background: '#fff'
                            }}
                          />
                        ) : field.type === 'dropdown' ? (
                          <select
                            value={fieldValues[field.api_name] || ''}
                            onChange={(e) => handleInputChange(field.api_name, e.target.value)}
                            onFocus={() => setFocusedFieldId(field.id)}
                            onBlur={() => setFocusedFieldId(null)}
                            style={{
                              width: '100%', padding: '10px 14px', borderRadius: 8,
                              border: errorMsg ? '2px solid #ef4444' : isFocused ? `2px solid ${primaryColor}` : '1px solid #cbd5e1',
                              boxShadow: isFocused ? `0 0 0 4px ${primaryColor}25` : 'none',
                              fontSize: '0.88rem', outline: 'none', background: '#fff', transition: 'all 0.2s ease'
                            }}
                          >
                            <option value="">Select option…</option>
                            {(field.options || []).map((opt, oIdx) => (
                              <option key={oIdx} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : 'text'}
                            placeholder={field.placeholder || ''}
                            value={fieldValues[field.api_name] || ''}
                            onChange={(e) => handleInputChange(field.api_name, e.target.value)}
                            onFocus={() => setFocusedFieldId(field.id)}
                            onBlur={() => setFocusedFieldId(null)}
                            style={{
                              width: '100%', padding: '10px 14px', borderRadius: 8,
                              border: errorMsg ? '2px solid #ef4444' : isFocused ? `2px solid ${primaryColor}` : '1px solid #cbd5e1',
                              boxShadow: isFocused ? `0 0 0 4px ${primaryColor}25` : 'none',
                              fontSize: '0.88rem', outline: 'none', transition: 'all 0.2s ease', background: '#fff'
                            }}
                          />
                        )}

                        {errorMsg && <div style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: 4 }}>{errorMsg}</div>}
                      </div>
                    );
                  })}

                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      width: '100%', padding: '12px', borderRadius: borderRadius, border: 'none',
                      background: primaryColor, color: '#ffffff', fontWeight: 800, fontSize: '0.95rem',
                      cursor: submitting ? 'not-allowed' : 'pointer', marginTop: 8,
                      boxShadow: `0 4px 14px ${primaryColor}40`, transition: 'all 0.2s ease'
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 6px 20px ${primaryColor}60`; }}
                    onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = `0 4px 14px ${primaryColor}40`; }}
                  >
                    {submitting ? 'Submitting…' : `${appearance.submit_button_text || 'Register Now'} →`}
                  </button>
                </form>
              )}
            </div>
          </div>
        ) : (
          /* EVENT REGISTRATION HEADER BANNER VIEW */
          <>
            <div style={{
              background: `radial-gradient(circle at 50% 20%, rgba(79, 70, 229, 0.45) 0%, rgba(15, 23, 42, 0.95) 75%), url(${heroBgImage}) center/cover`,
              color: '#ffffff', padding: '64px 32px', textAlign: 'center', boxShadow: 'inset 0 -20px 40px rgba(0,0,0,0.3)'
            }}>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 16 }}>
                {badges.map((b, i) => (
                  <span key={i} style={{ background: primaryColor, color: '#ffffff', padding: '5px 14px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 800, letterSpacing: 0.8, boxShadow: `0 4px 14px ${primaryColor}50` }}>
                    {b}
                  </span>
                ))}
              </div>

              <h1 style={{ margin: '0 0 16px', fontSize: '2.4rem', fontWeight: 900, lineHeight: 1.2, maxWidth: 940, marginInline: 'auto', letterSpacing: -0.5 }}>
                {headerContent.title || form.name}
              </h1>

              <p style={{ margin: '0 0 28px', fontSize: '1.1rem', opacity: 0.9, maxWidth: 740, marginInline: 'auto', lineHeight: 1.6, color: '#cbd5e1' }}>
                {headerContent.subtitle !== undefined && headerContent.subtitle !== null ? headerContent.subtitle : form.description}
              </p>

              {(headerContent.event_date || headerContent.event_time || headerContent.event_badge) && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', gap: 20,
                  background: 'rgba(255, 255, 255, 0.08)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: 16, padding: '12px 28px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.2)', fontSize: '0.9rem', fontWeight: 700
                }}>
                  {headerContent.event_date && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Calendar size={18} color="#818cf8" />
                      <span>{headerContent.event_date}</span>
                    </div>
                  )}
                  {headerContent.event_time && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Clock size={18} color="#818cf8" />
                      <span>{headerContent.event_time}</span>
                    </div>
                  )}
                  {headerContent.event_badge && (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)',
                      color: '#fca5a5', padding: '4px 12px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 800
                    }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 10px #ef4444' }} />
                      <span>{headerContent.event_badge}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ maxWidth: 1140, margin: '0 auto', padding: '40px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 32, alignItems: 'start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {learnItems.length > 0 && (
                  <div
                    id="learn"
                    style={{ background: '#ffffff', borderRadius: borderRadius, padding: 28, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}
                    onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.08)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.03)'; }}
                  >
                    <h3 style={{ margin: '0 0 18px', fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>{learnItemsTitle}</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {learnItems.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: '0.9rem', color: '#334155', lineHeight: 1.5 }}>
                          <span style={{ color: primaryColor, fontWeight: 900, fontSize: '1rem' }}>✓</span>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {speakers.length > 0 && (
                  <div
                    id="speakers"
                    style={{ background: '#ffffff', borderRadius: borderRadius, padding: 28, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}
                    onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.08)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.03)'; }}
                  >
                    <h3 style={{ margin: '0 0 18px', fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>{speakersTitle}</h3>
                    {speakers.map((spk, idx) => (
                      <div key={spk.id || idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 18, marginBottom: idx < speakers.length - 1 ? 24 : 0 }}>
                        <img src={spk.avatar_url} alt={spk.name} style={{ width: 68, height: 68, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${primaryColor}`, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>{spk.name}</div>
                          <div style={{ fontSize: '0.85rem', color: '#64748b', margin: '2px 0 8px' }}>{spk.title}, {spk.company}</div>
                          {spk.bio && <p style={{ margin: 0, fontSize: '0.88rem', color: '#475569', lineHeight: 1.6, textAlign: 'justify' }}>{spk.bio}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {productBlock.enabled && (
                  <div
                    style={{ background: '#ffffff', borderRadius: borderRadius, padding: 28, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', display: 'grid', gridTemplateColumns: '1fr 140px', gap: 20, alignItems: 'center', transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}
                    onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.08)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.03)'; }}
                  >
                    <div>
                      <span style={{ background: '#eef2ff', color: primaryColor, padding: '4px 10px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 800 }}>FEATURED PRODUCT</span>
                      <h4 style={{ margin: '8px 0 6px', fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>{productBlock.title}</h4>
                      <p style={{ margin: '0 0 14px', color: '#64748b', fontSize: '0.85rem', lineHeight: 1.5 }}>{productBlock.description}</p>
                      {productBlock.cta_text && (
                        <a href={productBlock.cta_url || '#'} target="_blank" rel="noreferrer" style={{ display: 'inline-block', background: primaryColor, color: '#fff', padding: '7px 16px', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', textDecoration: 'none' }}>
                          {productBlock.cta_text} →
                        </a>
                      )}
                    </div>
                    {productBlock.image_url && (
                      <img src={productBlock.image_url} alt="Product" style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 10 }} />
                    )}
                  </div>
                )}

                {faqs.length > 0 && (
                  <div
                    id="faq"
                    style={{ background: '#ffffff', borderRadius: borderRadius, padding: 28, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', transition: 'all 0.25s ease' }}
                  >
                    <h3 style={{ margin: '0 0 18px', fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>Frequently Asked Questions</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {faqs.map((faq, fIdx) => (
                        <div key={fIdx} style={{ borderBottom: fIdx < faqs.length - 1 ? '1px solid #f1f5f9' : 'none', paddingBottom: fIdx < faqs.length - 1 ? 16 : 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a', marginBottom: 6 }}>Q: {faq.question}</div>
                          <div style={{ fontSize: '0.88rem', color: '#475569', lineHeight: 1.6 }}>{faq.answer}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {isWebinarForm && (
                  <div
                    id="inquiry"
                    style={{ background: '#ffffff', borderRadius: borderRadius, padding: 28, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <HelpCircle size={20} color={primaryColor} />
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>Still have a question?</h3>
                    </div>
                    <p style={{ margin: '0 0 18px', color: '#64748b', fontSize: '0.85rem' }}>
                      Can't find the answer in our FAQs? Ask us about the webinar.
                    </p>

                    {inquirySubmitted ? (
                      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 18, textAlign: 'center' }}>
                        <CheckCircle2 size={36} color="#16a34a" style={{ marginBottom: 8, display: 'inline-block' }} />
                        <div style={{ fontWeight: 800, color: '#166534', fontSize: '0.95rem', marginBottom: 4 }}>Question Received!</div>
                        <div style={{ color: '#15803d', fontSize: '0.85rem' }}>{inquiryMessage}</div>
                        <button
                          type="button"
                          onClick={() => setInquirySubmitted(false)}
                          style={{ marginTop: 12, border: 'none', background: 'transparent', color: primaryColor, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                          Ask another question
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleInquirySubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div>
                          <label style={{ display: 'block', fontWeight: 700, color: '#334155', fontSize: '0.82rem', marginBottom: 4 }}>
                            Your Name <span style={{ color: '#ef4444' }}>*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="John Doe"
                            value={inquiryName}
                            onChange={(e) => { setInquiryName(e.target.value); if (inquiryErrors.name) setInquiryErrors(prev => ({ ...prev, name: null })); }}
                            style={{
                              width: '100%', padding: '9px 12px', borderRadius: 8,
                              border: inquiryErrors.name ? '2px solid #ef4444' : '1px solid #cbd5e1',
                              fontSize: '0.88rem', outline: 'none', background: '#fff'
                            }}
                          />
                          {inquiryErrors.name && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: 3 }}>{inquiryErrors.name}</div>}
                        </div>

                        <div>
                          <label style={{ display: 'block', fontWeight: 700, color: '#334155', fontSize: '0.82rem', marginBottom: 4 }}>
                            Your Email <span style={{ color: '#ef4444' }}>*</span>
                          </label>
                          <input
                            type="email"
                            placeholder="john@example.com"
                            value={inquiryEmail}
                            onChange={(e) => { setInquiryEmail(e.target.value); if (inquiryErrors.email) setInquiryErrors(prev => ({ ...prev, email: null })); }}
                            style={{
                              width: '100%', padding: '9px 12px', borderRadius: 8,
                              border: inquiryErrors.email ? '2px solid #ef4444' : '1px solid #cbd5e1',
                              fontSize: '0.88rem', outline: 'none', background: '#fff'
                            }}
                          />
                          {inquiryErrors.email && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: 3 }}>{inquiryErrors.email}</div>}
                        </div>

                        <div>
                          <label style={{ display: 'block', fontWeight: 700, color: '#334155', fontSize: '0.82rem', marginBottom: 4 }}>
                            Your Question <span style={{ color: '#ef4444' }}>*</span>
                          </label>
                          <textarea
                            rows={3}
                            placeholder="Type your question about the webinar here…"
                            value={inquiryQuestion}
                            onChange={(e) => { setInquiryQuestion(e.target.value); if (inquiryErrors.question) setInquiryErrors(prev => ({ ...prev, question: null })); }}
                            style={{
                              width: '100%', padding: '9px 12px', borderRadius: 8,
                              border: inquiryErrors.question ? '2px solid #ef4444' : '1px solid #cbd5e1',
                              fontSize: '0.88rem', outline: 'none', background: '#fff'
                            }}
                          />
                          {inquiryErrors.question && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: 3 }}>{inquiryErrors.question}</div>}
                        </div>

                        <button
                          type="submit"
                          disabled={inquirySubmitting}
                          style={{
                            padding: '10px 18px', borderRadius: 8, border: 'none',
                            background: primaryColor, color: '#ffffff', fontWeight: 700, fontSize: '0.85rem',
                            cursor: inquirySubmitting ? 'not-allowed' : 'pointer', alignSelf: 'flex-start',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {inquirySubmitting ? 'Submitting…' : 'Submit Question'}
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>

              <div id="register" style={{
                background: '#ffffff', borderRadius: borderRadius, padding: 32,
                border: '1px solid #e2e8f0', boxShadow: '0 15px 35px rgba(0,0,0,0.07)',
                position: 'sticky', top: 24, transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
              }}>
                <h3 style={{ margin: '0 0 20px', fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', borderBottom: '1px solid #f1f5f9', paddingBottom: 12 }}>
                  {formCardTitle}
                </h3>

                {submittedSuccess ? (
                  <div style={{ textAlign: 'center', padding: '30px 10px' }}>
                    <CheckCircle2 size={56} color="#16a34a" style={{ marginBottom: 16 }} />
                    <h4 style={{ margin: '0 0 10px', fontSize: '1.3rem', fontWeight: 800, color: '#0f172a' }}>Registration Confirmed!</h4>
                    <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: 1.6, margin: 0 }}>
                      {submitMessage}
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {fields.map((field) => {
                      const errorMsg = formErrors[field.api_name];
                      const isRequired = field.required;
                      const isFocused = focusedFieldId === field.id;

                      return (
                        <div key={field.id}>
                          <label style={{ display: 'block', fontWeight: 700, color: '#334155', fontSize: '0.85rem', marginBottom: 5 }}>
                            {field.label} {isRequired && <span style={{ color: '#ef4444' }}>*</span>}
                          </label>

                          {field.type === 'textarea' ? (
                            <textarea
                              rows={3}
                              placeholder={field.placeholder || ''}
                              value={fieldValues[field.api_name] || ''}
                              onChange={(e) => handleInputChange(field.api_name, e.target.value)}
                              onFocus={() => setFocusedFieldId(field.id)}
                              onBlur={() => setFocusedFieldId(null)}
                              style={{
                                width: '100%', padding: '10px 14px', borderRadius: 8,
                                border: errorMsg ? '2px solid #ef4444' : isFocused ? `2px solid ${primaryColor}` : '1px solid #cbd5e1',
                                boxShadow: isFocused ? `0 0 0 4px ${primaryColor}25` : 'none',
                                fontSize: '0.88rem', outline: 'none', transition: 'all 0.2s ease', background: '#fff'
                              }}
                            />
                          ) : field.type === 'dropdown' ? (
                            <select
                              value={fieldValues[field.api_name] || ''}
                              onChange={(e) => handleInputChange(field.api_name, e.target.value)}
                              onFocus={() => setFocusedFieldId(field.id)}
                              onBlur={() => setFocusedFieldId(null)}
                              style={{
                                width: '100%', padding: '10px 14px', borderRadius: 8,
                                border: errorMsg ? '2px solid #ef4444' : isFocused ? `2px solid ${primaryColor}` : '1px solid #cbd5e1',
                                boxShadow: isFocused ? `0 0 0 4px ${primaryColor}25` : 'none',
                                fontSize: '0.88rem', outline: 'none', background: '#fff', transition: 'all 0.2s ease'
                              }}
                            >
                              <option value="">Select option…</option>
                              {(field.options || []).map((opt, oIdx) => (
                                <option key={oIdx} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : 'text'}
                              placeholder={field.placeholder || ''}
                              value={fieldValues[field.api_name] || ''}
                              onChange={(e) => handleInputChange(field.api_name, e.target.value)}
                              onFocus={() => setFocusedFieldId(field.id)}
                              onBlur={() => setFocusedFieldId(null)}
                              style={{
                                width: '100%', padding: '10px 14px', borderRadius: 8,
                                border: errorMsg ? '2px solid #ef4444' : isFocused ? `2px solid ${primaryColor}` : '1px solid #cbd5e1',
                                boxShadow: isFocused ? `0 0 0 4px ${primaryColor}25` : 'none',
                                fontSize: '0.88rem', outline: 'none', transition: 'all 0.2s ease', background: '#fff'
                              }}
                            />
                          )}

                          {errorMsg && <div style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: 4 }}>{errorMsg}</div>}
                        </div>
                      );
                    })}

                    <button
                      type="submit"
                      disabled={submitting}
                      style={{
                        width: '100%', padding: '12px', borderRadius: borderRadius, border: 'none',
                        background: primaryColor, color: '#ffffff', fontWeight: 800, fontSize: '0.95rem',
                        cursor: submitting ? 'not-allowed' : 'pointer', marginTop: 8,
                        boxShadow: `0 4px 14px ${primaryColor}40`, transition: 'all 0.2s ease'
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 6px 20px ${primaryColor}60`; }}
                      onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = `0 4px 14px ${primaryColor}40`; }}
                    >
                      {submitting ? 'Submitting…' : `${appearance.submit_button_text || 'Register Now'} →`}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* RICH FOOTER WITH SOCIAL LINKS */}
      <footer style={{
        padding: '24px 32px', background: '#0f172a', color: '#94a3b8',
        borderTop: '1px solid #334155', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', fontSize: '0.82rem'
      }}>
        <div>
          {brandName && <div style={{ color: '#ffffff', fontWeight: 800, fontSize: '0.95rem' }}>{brandName}</div>}
          <div style={{ marginTop: 4, color: '#64748b' }}>
            {footer.copyright_text || '© 2026 TRACKnow Inc. All rights reserved.'} • {' '}
            <a href={footer.privacy_url || 'https://tracknow.com/privacy'} target="_blank" rel="noreferrer" style={{ color: '#818cf8', textDecoration: 'none' }}>
              Privacy Policy
            </a>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {footer.linkedin_url && <a href={footer.linkedin_url} target="_blank" rel="noreferrer" style={{ color: '#94a3b8', transition: 'color 0.15s ease' }}><LinkedinIcon size={18} /></a>}
          {footer.twitter_url && <a href={footer.twitter_url} target="_blank" rel="noreferrer" style={{ color: '#94a3b8', transition: 'color 0.15s ease' }}><TwitterIcon size={18} /></a>}
          {footer.youtube_url && <a href={footer.youtube_url} target="_blank" rel="noreferrer" style={{ color: '#94a3b8', transition: 'color 0.15s ease' }}><YoutubeIcon size={18} /></a>}
          {footer.website_url && <a href={footer.website_url} target="_blank" rel="noreferrer" style={{ color: '#94a3b8', transition: 'color 0.15s ease' }}><Globe size={18} /></a>}
        </div>
      </footer>

    </div>
  );
}

export default PublicFormPage;
