import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiPost } from '../api/client';
import { setAuthSession } from '../utils/authStorage';
import {
  AlertCircle, Sparkles, ShieldCheck, TrendingUp, Users,
  User, Mail, Lock, Building2, ArrowLeft, UserPlus, CheckCircle2,
  Eye, EyeOff
} from 'lucide-react';

function Login() {
  const navigate = useNavigate();
  const { login, user } = useAuth();

  // Parse URL search parameters for resetToken on mount
  const [verifyingToken, setVerifyingToken] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const [tempSession, setTempSession] = useState(null);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resetToken = params.get('resetToken');

    if (resetToken) {
      setVerifyingToken(true);
      setVerificationError('');
      
      apiPost('/auth/verify-reset-token', { token: resetToken })
        .then((res) => {
          const resData = res?.data || res;
          const sessionToken = resData?.token;
          const sessionUser = resData?.user;

          if (sessionToken && sessionUser) {
            setTempSession({ token: sessionToken, user: sessionUser });
            setMode('reset-password');
            setVerifyingToken(false);
          } else {
            setVerificationError('Invalid session payload received.');
            setVerifyingToken(false);
          }
        })
        .catch((err) => {
          console.error('Password reset link verification failed:', err);
          setVerificationError(err.message || 'Invalid or expired password reset link. Please request a new one.');
          setVerifyingToken(false);
        });
    }
  }, []);

  React.useEffect(() => {
    if (user) {
      navigate('/workspace/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const [isIdleTimeoutReason] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const reason = params.get('reason');
      return reason === 'idle_timeout' || reason === 'session_expired';
    }
    return false;
  });

  // Mode: 'login' | 'register' | 'forgot-password' | 'reset-password'
  const [mode, setMode] = useState('login');

  // Forgot Password Form state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

  // Reset Password Form state
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!forgotEmail) {
      setForgotError('Please enter your work email.');
      return;
    }
    setForgotLoading(true);
    setForgotError('');
    setForgotSuccess('');

    try {
      await apiPost('/auth/forgot-password', { email: forgotEmail });
      setForgotSuccess(true);
      setForgotEmail('');
    } catch (err) {
      console.error('Password recovery request failed:', err);
      setForgotError(err.message || 'An error occurred. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (!resetPassword || !resetConfirmPassword) {
      setResetError('All fields are required.');
      return;
    }
    if (resetPassword !== resetConfirmPassword) {
      setResetError('Passwords do not match.');
      return;
    }
    if (resetPassword.length < 6) {
      setResetError('Password must be at least 6 characters.');
      return;
    }
    if (!tempSession || !tempSession.token) {
      setResetError('No active recovery session found. Please request a new magic link.');
      return;
    }

    setResetLoading(true);
    setResetError('');

    try {
      await apiPost('/auth/reset-password', { password: resetPassword }, {
        headers: {
          'Authorization': `Bearer ${tempSession.token}`
        }
      });
      // Save session now that password has been reset
      setAuthSession(tempSession.token, tempSession.user);
      // Redirect to dashboard
      window.location.href = '/workspace/dashboard';
    } catch (err) {
      console.error('Password reset failed:', err);
      setResetError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };



  // Login Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Register Form state
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regOrgId, setRegOrgId] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');

  // Reset Password visibility state
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);

  // Focus tracking for input styling
  const [focusedField, setFocusedField] = useState(null);

  const switchToRegister = () => {
    setRegFullName('');
    setRegEmail('');
    setRegOrgId('');
    setRegPassword('');
    setRegConfirmPassword('');
    setRegError('');
    setRegSuccess('');
    setMode('register');
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in both email and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login({ email, password });
      navigate('/workspace/dashboard', { replace: true });
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setRegError('');
    setRegSuccess('');

    if (!regFullName || !regEmail || !regOrgId || !regPassword || !regConfirmPassword) {
      setRegError('All fields including Organization ID are required.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setRegError('Passwords do not match. Please verify.');
      return;
    }

    if (regPassword.length < 6) {
      setRegError('Password must be at least 6 characters long.');
      return;
    }

    setRegLoading(true);
    try {
      const nameParts = String(regFullName || '').trim().split(/\s+/);
      const firstName = nameParts[0] || regFullName;
      const lastName = nameParts.slice(1).join(' ') || '';

      const payload = {
        fullName: regFullName,
        firstName,
        first_name: firstName,
        lastName,
        last_name: lastName,
        email: regEmail,
        organizationId: regOrgId,
        organization_id: regOrgId,
        orgId: regOrgId,
        password: regPassword,
      };

      const res = await apiPost('/auth/request-access', payload);
      const successMsg = res?.message || 'Access request submitted! An email notification has been sent to your organization admin for approval.';

      setRegSuccess(successMsg);
      // Prefill login email
      setEmail(regEmail);

      // Reset form
      setRegFullName('');
      setRegEmail('');
      setRegOrgId('');
      setRegPassword('');
      setRegConfirmPassword('');

      // Auto switch back to login after 3 seconds
      setTimeout(() => {
        setMode('login');
        setRegSuccess('');
      }, 3000);

    } catch (err) {
      console.error('Registration error:', err);
      if (err.message && err.message.includes('Unable to connect')) {
        setRegSuccess('Access request registered! Please ask your organization administrator to approve your access.');
        setEmail(regEmail);
        setTimeout(() => setMode('login'), 2500);
      } else {
        setRegError(err.message || 'Registration request failed. Please verify your Organization ID.');
      }
    } finally {
      setRegLoading(false);
    }
  };

  const getInputGroupStyle = (fieldName) => {
    const isFocused = focusedField === fieldName;
    return {
      display: 'flex',
      alignItems: 'center',
      borderRadius: 10,
      border: isFocused ? '1px solid #6366f1' : '1px solid #e2e8f0',
      background: isFocused ? '#ffffff' : '#f8fafc',
      boxShadow: isFocused ? '0 0 0 3px rgba(99, 102, 241, 0.15)' : '0 1px 2px rgba(0,0,0,0.02)',
      overflow: 'hidden',
      transition: 'all 0.2s ease',
    };
  };

  const getIconContainerStyle = (fieldName) => {
    const isFocused = focusedField === fieldName;
    return {
      width: 44,
      height: 42,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: isFocused ? 'rgba(99, 102, 241, 0.08)' : '#ffffff',
      borderRight: '1px solid #e2e8f0',
      flexShrink: 0,
      transition: 'all 0.2s ease',
    };
  };

  return (
    <div className="orbit-root" style={{ minHeight: '100vh', display: 'flex' }}>
      <div className="orbit-bg-mesh" />

      {/* Brand panel */}
      <div
        className="auth-brand-panel d-none d-md-flex"
        style={{
          flex: 1.15,
          padding: '56px 56px',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            className="grad-border"
            style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'var(--aurora)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 12px 30px -8px rgba(99,102,241,0.55)',
            }}
          >
            <Sparkles size={20} color="#fff" strokeWidth={2.4} />
          </div>
          <span className="font-display" style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-strong)' }}>
            CRM Lite
          </span>
        </div>

        <div style={{ maxWidth: 520 }}>
          <div className="badge" style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--brand-700)', border: '1px solid rgba(99,102,241,0.25)', marginBottom: 22 }}>
            <span className="dot" style={{ background: 'var(--brand-500)' }} /> Enterprise CRM Lite
          </div>
          <h1 className="font-display" style={{ fontSize: 44, lineHeight: 1.08, fontWeight: 800, color: 'var(--text-strong)', margin: '0 0 20px' }}>
            Where every relationship <span className="aurora-text">compounds into revenue</span>.
          </h1>
          <p style={{ fontSize: 15.5, color: 'var(--text-dim)', lineHeight: 1.6, margin: 0 }}>
            Unify pipeline, contacts, and activity in one command surface — engineered for high-performance enterprise teams.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 36 }}>
            {[
              { icon: TrendingUp, title: 'Real-time pipeline intelligence', text: 'Forecast with confidence — every stage, every rep.' },
              { icon: Users,      title: 'Unified customer graph',          text: 'One record of truth across every team touchpoint.' },
              { icon: ShieldCheck,title: 'Enterprise-grade security',       text: 'Granular roles, multi-tenant isolation, and audit trail.' },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="glass" style={{ padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'var(--aurora-soft)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--brand-600)', flexShrink: 0,
                }}>
                  <Icon size={17} strokeWidth={2.2} />
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)' }}>{title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 2 }}>{text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div
        className="auth-form-panel d-flex align-items-center justify-content-center"
        style={{ flex: 1, padding: '40px 32px', minHeight: '100vh' }}
      >
        <div
          className="glass-strong rise-in"
          style={{
            width: '100%',
            maxWidth: 450,
            padding: '36px 32px',
            borderRadius: 24,
            background: '#ffffff',
            boxShadow: '0 20px 50px -12px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(226, 232, 240, 0.8)',
            position: 'relative',
          }}
        >
          {verifyingToken ? (
            /* ───────────────────── VERIFYING TOKEN VIEW ───────────────────── */
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div className="spinner-border" style={{ width: '3rem', height: '3rem', color: '#6366f1', marginBottom: 20 }} role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <h1 className="font-display" style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Verifying Login Link
              </h1>
              <p style={{ fontSize: 13.5, color: '#64748b', margin: '8px 0 0' }}>
                Please wait while we establish your secure session...
              </p>
            </div>
          ) : verificationError ? (
            /* ───────────────────── VERIFICATION ERROR VIEW ───────────────────── */
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  background: 'rgba(239, 68, 68, 0.08)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                  color: '#ef4444',
                }}
              >
                <AlertCircle size={26} strokeWidth={2.2} />
              </div>
              <h1 className="font-display" style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Link Verification Failed
              </h1>
              <div className="alert alert-danger" style={{ padding: '12px 14px', fontSize: 13, marginTop: 16, marginBottom: 20, borderRadius: 10, textAlign: 'left' }}>
                {verificationError}
              </div>
              <button
                type="button"
                onClick={() => {
                  setVerificationError('');
                  const url = new URL(window.location.href);
                  url.searchParams.delete('magicToken');
                  window.history.replaceState({}, '', url.pathname);
                  setMode('login');
                }}
                style={{
                  width: '100%',
                  height: 44,
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  color: '#0f172a',
                  fontWeight: 600,
                  fontSize: 13.5,
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'all 0.2s ease',
                }}
              >
                Back to Login
              </button>
            </div>
          ) : mode === 'login' ? (
            /* ───────────────────── LOGIN VIEW ───────────────────── */
            <div>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div
                  className="d-inline-flex d-md-none"
                  style={{
                    width: 48, height: 48, borderRadius: 14, background: 'var(--aurora)',
                    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
                    boxShadow: '0 12px 30px -8px rgba(99,102,241,0.5)',
                  }}
                >
                  <Sparkles size={22} color="#fff" />
                </div>
                <h1 className="font-display" style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Welcome back
                </h1>
                <p style={{ fontSize: 13.5, color: '#64748b', margin: '6px 0 0' }}>
                  Sign in to your workspace to continue.
                </p>
              </div>

              {isIdleTimeoutReason && (
                <div
                  className="alert alert-warning d-flex align-items-center gap-2"
                  style={{
                    padding: '12px 14px',
                    fontSize: 13,
                    marginBottom: 18,
                    borderRadius: 10,
                    background: '#fffbeb',
                    color: '#b45309',
                    border: '1px solid #fde68a',
                  }}
                >
                  <AlertCircle size={18} style={{ flexShrink: 0 }} />
                  <span>Your session has expired due to inactivity. Please log in again.</span>
                </div>
              )}

              {error && (
                <div className="alert alert-danger d-flex align-items-center gap-2" style={{ padding: '10px 12px', fontSize: 13, marginBottom: 18, borderRadius: 10 }}>
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit}>
                <div className="mb-3">
                  <label className="form-label" style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 6 }}>Work Email</label>
                  <input
                    type="email"
                    required
                    className="form-control"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      height: 44,
                      borderRadius: 10,
                      border: '1px solid #e2e8f0',
                      padding: '0 14px',
                      fontSize: 13.5,
                      outline: 'none',
                      boxShadow: 'none',
                    }}
                  />
                </div>

                <div className="mb-3">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label className="form-label" style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', margin: 0 }}>Password</label>
                    <button type="button" onClick={() => setMode('forgot-password')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#6366f1', outline: 'none' }}>Forgot?</button>
                  </div>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      className="form-control"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={{
                        height: 44,
                        borderRadius: 10,
                        border: '1px solid #e2e8f0',
                        padding: '0 40px 0 14px',
                        fontSize: 13.5,
                        outline: 'none',
                        boxShadow: 'none',
                        width: '100%',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: 12,
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        color: '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    height: 46,
                    borderRadius: 12,
                    border: 'none',
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: 'pointer',
                    marginTop: 8,
                    boxShadow: '0 8px 20px -6px rgba(99,102,241,0.5)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {loading ? 'Signing in…' : 'Sign In to Workspace'}
                </button>

                {/* Contact Admin / Register Option */}
                <div style={{ textAlign: 'center', marginTop: 22, paddingTop: 16, borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, color: '#64748b' }}>
                  <span>Don't have an account?</span>
                  <button
                    type="button"
                    onClick={switchToRegister}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: '#6366f1',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: 13,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    Contact Admin / Request Access
                  </button>
                </div>
              </form>
            </div>
          ) : mode === 'forgot-password' ? (
            /* ───────────────────── FORGOT PASSWORD VIEW ───────────────────── */
            <div>
              {/* Top back button */}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setForgotError('');
                  setForgotSuccess('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#64748b',
                  cursor: 'pointer',
                  marginBottom: 16,
                  transition: 'color 0.2s ease',
                }}
                onMouseEnter={(e) => e.target.style.color = '#0f172a'}
                onMouseLeave={(e) => e.target.style.color = '#64748b'}
              >
                <ArrowLeft size={15} /> Back to login
              </button>

              {/* Top Icon Box */}
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 16,
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 14,
                    boxShadow: '0 10px 24px -6px rgba(99, 102, 241, 0.4)',
                  }}
                >
                  <Mail size={24} color="#ffffff" strokeWidth={2.2} />
                </div>
                <h1 className="font-display" style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Password Recovery
                </h1>
                <p style={{ fontSize: 13, color: '#64748b', margin: '6px 0 0', lineHeight: 1.4 }}>
                  Enter your work email and we'll send you a password reset link.
                </p>
              </div>

              {forgotError && (
                <div className="alert alert-danger d-flex align-items-center gap-2" style={{ padding: '10px 12px', fontSize: 12.5, marginBottom: 16, borderRadius: 10 }}>
                  <AlertCircle size={15} />
                  <span>{forgotError}</span>
                </div>
              )}

              {forgotSuccess ? (
                /* Success State Card */
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                  <div className="alert alert-success d-flex align-items-start gap-3 text-start" style={{ padding: '16px', fontSize: 13.5, marginBottom: 24, borderRadius: 12, background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>
                    <CheckCircle2 size={20} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <strong style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>Check your inbox!</strong>
                      If an account exists for this email, a password reset link has been sent. The link will expire in 15 minutes.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setForgotSuccess('');
                      setForgotError('');
                    }}
                    style={{
                      width: '100%',
                      height: 44,
                      borderRadius: 12,
                      border: '1px solid #e2e8f0',
                      background: '#ffffff',
                      color: '#0f172a',
                      fontWeight: 600,
                      fontSize: 13.5,
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    Return to Login
                  </button>
                </div>
              ) : (
                /* Input Form */
                <form onSubmit={handleForgotSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 5 }}>
                      Work Email
                    </label>
                    <div style={getInputGroupStyle('forgotEmail')}>
                      <div style={getIconContainerStyle('forgotEmail')}>
                        <Mail size={16} color={focusedField === 'forgotEmail' ? '#6366f1' : '#94a3b8'} />
                      </div>
                      <input
                        type="email"
                        required
                        placeholder="name@company.com"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        onFocus={() => setFocusedField('forgotEmail')}
                        onBlur={() => setFocusedField(null)}
                        style={{
                          flex: 1,
                          border: 'none',
                          background: 'transparent',
                          padding: '0 14px',
                          height: 42,
                          fontSize: 13.5,
                          color: '#0f172a',
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    style={{
                      width: '100%',
                      height: 46,
                      borderRadius: 12,
                      border: 'none',
                      background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: 'pointer',
                      boxShadow: '0 8px 20px -6px rgba(99, 102, 241, 0.45)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {forgotLoading ? 'Sending Link…' : 'Send Password Reset Link'}
                  </button>
                </form>
              )}
            </div>
          ) : mode === 'reset-password' ? (
            /* ───────────────────── RESET PASSWORD VIEW ───────────────────── */
            <div>
              {/* Top Icon Box */}
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 16,
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 14,
                    boxShadow: '0 10px 24px -6px rgba(99, 102, 241, 0.4)',
                  }}
                >
                  <Lock size={24} color="#ffffff" strokeWidth={2.2} />
                </div>
                <h1 className="font-display" style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Reset Password
                </h1>
                <p style={{ fontSize: 13, color: '#64748b', margin: '6px 0 0', lineHeight: 1.4 }}>
                  Choose a new password for your account, or skip to go directly to your dashboard.
                </p>
              </div>

              {resetError && (
                <div className="alert alert-danger d-flex align-items-center gap-2" style={{ padding: '10px 12px', fontSize: 12.5, marginBottom: 16, borderRadius: 10 }}>
                  <AlertCircle size={15} />
                  <span>{resetError}</span>
                </div>
              )}

              <form onSubmit={handleResetSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* 1. New Password */}
                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 5 }}>
                    New Password
                  </label>
                  <div style={getInputGroupStyle('resetPassword')}>
                    <div style={getIconContainerStyle('resetPassword')}>
                      <Lock size={16} color={focusedField === 'resetPassword' ? '#6366f1' : '#94a3b8'} />
                    </div>
                    <input
                      type={showResetPassword ? 'text' : 'password'}
                      required
                      placeholder="Minimum 6 characters"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      onFocus={() => setFocusedField('resetPassword')}
                      onBlur={() => setFocusedField(null)}
                      style={{
                        flex: 1,
                        border: 'none',
                        background: 'transparent',
                        padding: '0 14px',
                        height: 42,
                        fontSize: 13.5,
                        color: '#0f172a',
                        outline: 'none',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPassword(!showResetPassword)}
                      style={{ background: 'none', border: 'none', padding: '0 12px', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}
                      title={showResetPassword ? 'Hide password' : 'Show password'}
                    >
                      {showResetPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* 2. Confirm Password */}
                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 5 }}>
                    Confirm Password
                  </label>
                  <div style={getInputGroupStyle('resetConfirmPassword')}>
                    <div style={getIconContainerStyle('resetConfirmPassword')}>
                      <Lock size={16} color={focusedField === 'resetConfirmPassword' ? '#6366f1' : '#94a3b8'} />
                    </div>
                    <input
                      type={showResetConfirmPassword ? 'text' : 'password'}
                      required
                      placeholder="Re-enter your password"
                      value={resetConfirmPassword}
                      onChange={(e) => setResetConfirmPassword(e.target.value)}
                      onFocus={() => setFocusedField('resetConfirmPassword')}
                      onBlur={() => setFocusedField(null)}
                      style={{
                        flex: 1,
                        border: 'none',
                        background: 'transparent',
                        padding: '0 14px',
                        height: 42,
                        fontSize: 13.5,
                        color: '#0f172a',
                        outline: 'none',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetConfirmPassword(!showResetConfirmPassword)}
                      style={{ background: 'none', border: 'none', padding: '0 12px', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}
                      title={showResetConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showResetConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    style={{
                      width: '100%',
                      height: 46,
                      borderRadius: 12,
                      border: 'none',
                      background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: 'pointer',
                      boxShadow: '0 8px 20px -6px rgba(99, 102, 241, 0.45)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {resetLoading ? 'Resetting…' : 'Reset Password & Log In'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* ───────────────────── REQUEST ACCESS / REGISTER VIEW ───────────────────── */
            <div>
              {/* Top back button */}
              <button
                type="button"
                onClick={() => setMode('login')}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#64748b',
                  cursor: 'pointer',
                  marginBottom: 16,
                  transition: 'color 0.2s ease',
                }}
                onMouseEnter={(e) => e.target.style.color = '#0f172a'}
                onMouseLeave={(e) => e.target.style.color = '#64748b'}
              >
                <ArrowLeft size={15} /> Back to login
              </button>

              {/* Top Icon Box */}
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 16,
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 14,
                    boxShadow: '0 10px 24px -6px rgba(99, 102, 241, 0.4)',
                  }}
                >
                  <UserPlus size={24} color="#ffffff" strokeWidth={2.2} />
                </div>
                <h1 className="font-display" style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Request Access
                </h1>
                <p style={{ fontSize: 13, color: '#64748b', margin: '6px 0 0', lineHeight: 1.4 }}>
                  Fill in details to request a CRM login from the administrator
                </p>
              </div>

              {regError && (
                <div className="alert alert-danger d-flex align-items-center gap-2" style={{ padding: '10px 12px', fontSize: 12.5, marginBottom: 16, borderRadius: 10 }}>
                  <AlertCircle size={15} />
                  <span>{regError}</span>
                </div>
              )}

              {regSuccess && (
                <div className="alert alert-success d-flex align-items-center gap-2" style={{ padding: '10px 12px', fontSize: 12.5, marginBottom: 16, borderRadius: 10, background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
                  <CheckCircle2 size={16} />
                  <span>{regSuccess}</span>
                </div>
              )}

              <form onSubmit={handleRegisterSubmit} autoComplete="off" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Hidden dummy fields to prevent browser password manager from autofilling Organization ID */}
                <input type="text" style={{ display: 'none' }} tabIndex={-1} aria-hidden="true" />
                <input type="password" style={{ display: 'none' }} tabIndex={-1} aria-hidden="true" />

                {/* 1. Full Name */}
                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 5 }}>
                    Full Name
                  </label>
                  <div style={getInputGroupStyle('fullName')}>
                    <div style={getIconContainerStyle('fullName')}>
                      <User size={16} color={focusedField === 'fullName' ? '#6366f1' : '#94a3b8'} />
                    </div>
                    <input
                      type="text"
                      required
                      autoComplete="off"
                      name="req_user_name"
                      placeholder="John Doe"
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      onFocus={() => setFocusedField('fullName')}
                      onBlur={() => setFocusedField(null)}
                      style={{
                        flex: 1,
                        border: 'none',
                        background: 'transparent',
                        padding: '0 14px',
                        height: 42,
                        fontSize: 13.5,
                        color: '#0f172a',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                {/* 2. Email Address */}
                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 5 }}>
                    Email Address
                  </label>
                  <div style={getInputGroupStyle('email')}>
                    <div style={getIconContainerStyle('email')}>
                      <Mail size={16} color={focusedField === 'email' ? '#6366f1' : '#94a3b8'} />
                    </div>
                    <input
                      type="email"
                      required
                      autoComplete="off"
                      name="req_user_email"
                      placeholder="name@company.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      style={{
                        flex: 1,
                        border: 'none',
                        background: 'transparent',
                        padding: '0 14px',
                        height: 42,
                        fontSize: 13.5,
                        color: '#0f172a',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                {/* 3. Organization ID */}
                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 5 }}>
                    Organization ID
                  </label>
                  <div style={getInputGroupStyle('orgId')}>
                    <div style={getIconContainerStyle('orgId')}>
                      <Building2 size={16} color={focusedField === 'orgId' ? '#6366f1' : '#94a3b8'} />
                    </div>
                    <input
                      type="text"
                      required
                      autoComplete="off"
                      name="req_org_code"
                      placeholder="e.g. ORG-1001 or AcmeCorp"
                      value={regOrgId}
                      onChange={(e) => setRegOrgId(e.target.value)}
                      onFocus={() => setFocusedField('orgId')}
                      onBlur={() => setFocusedField(null)}
                      style={{
                        flex: 1,
                        border: 'none',
                        background: 'transparent',
                        padding: '0 14px',
                        height: 42,
                        fontSize: 13.5,
                        color: '#0f172a',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                {/* 4. Create Password */}
                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 5 }}>
                    Create Password
                  </label>
                  <div style={getInputGroupStyle('password')}>
                    <div style={getIconContainerStyle('password')}>
                      <Lock size={16} color={focusedField === 'password' ? '#6366f1' : '#94a3b8'} />
                    </div>
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      name="req_new_password"
                      placeholder="Minimum 8 characters"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      style={{
                        flex: 1,
                        border: 'none',
                        background: 'transparent',
                        padding: '0 14px',
                        height: 42,
                        fontSize: 13.5,
                        color: '#0f172a',
                        outline: 'none',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      style={{ background: 'none', border: 'none', padding: '0 12px', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}
                      title={showRegPassword ? 'Hide password' : 'Show password'}
                    >
                      {showRegPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* 5. Confirm Password */}
                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 5 }}>
                    Confirm Password
                  </label>
                  <div style={getInputGroupStyle('confirmPassword')}>
                    <div style={getIconContainerStyle('confirmPassword')}>
                      <Lock size={16} color={focusedField === 'confirmPassword' ? '#6366f1' : '#94a3b8'} />
                    </div>
                    <input
                      type={showRegConfirmPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      name="req_confirm_password"
                      placeholder="Re-enter your password"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      onFocus={() => setFocusedField('confirmPassword')}
                      onBlur={() => setFocusedField(null)}
                      style={{
                        flex: 1,
                        border: 'none',
                        background: 'transparent',
                        padding: '0 14px',
                        height: 42,
                        fontSize: 13.5,
                        color: '#0f172a',
                        outline: 'none',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                      style={{ background: 'none', border: 'none', padding: '0 12px', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}
                      title={showRegConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showRegConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={regLoading}
                  style={{
                    width: '100%',
                    height: 46,
                    borderRadius: 12,
                    border: 'none',
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: 'pointer',
                    marginTop: 6,
                    boxShadow: '0 8px 20px -6px rgba(99, 102, 241, 0.45)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <CheckCircle2 size={18} />
                  {regLoading ? 'Creating Request…' : 'Create Account Request'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;
