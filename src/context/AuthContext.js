import React, { createContext, useContext, useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { apiGet, apiPost } from '../api/client';
import { getAuthToken, setAuthSession, clearAuthSession, getStoredUser } from '../utils/authStorage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function restoreSession() {
      const token = getAuthToken();
      if (!token) {
        if (isMounted) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      try {
        const res = await apiGet('/auth/me');
        const currentUser = res?.data || res?.user || res;

        if (isMounted) {
          if (currentUser && (currentUser.name || currentUser.email || currentUser.first_name)) {
            const userName = currentUser.name || `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || currentUser.email || 'User';
            const initials = userName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
            const formattedUser = {
              ...currentUser,
              name: userName,
              avatar: currentUser.avatar || initials || 'U',
            };
            setUser(formattedUser);
            setAuthSession(token, formattedUser);
          } else {
            clearAuthSession();
            setUser(null);
          }
        }
      } catch (err) {
        console.warn('Session restore error / authentication failed:', err.message);
        if (isMounted) {
          clearAuthSession();
          setUser(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    restoreSession();
    return () => { isMounted = false; };
  }, []);

  async function login(credentials) {
    setLoading(true);
    try {
      const res = await apiPost('/auth/login', credentials);
      const resData = res?.data || res;
      const authUser = resData?.user || res?.user;
      const token = resData?.token || res?.token;

      if (!authUser || !token) {
        throw new Error(res?.message || 'Invalid authentication response from backend server.');
      }

      const userName = authUser.name || `${authUser.first_name || ''} ${authUser.last_name || ''}`.trim() || authUser.email || 'User';
      const initials = userName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
      const formattedUser = {
        ...authUser,
        name: userName,
        avatar: authUser.avatar || initials || 'U',
      };

      setUser(formattedUser);
      setAuthSession(token, formattedUser);
      return { user: formattedUser, token };
    } catch (err) {
      clearAuthSession();
      setUser(null);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      if (user && user.id) {
        localStorage.removeItem(`crm_last_user_activity_${user.id}`);
      }
      await apiPost('/auth/logout', {}).catch(() => null);
    } finally {
      clearAuthSession();
      setUser(null);
    }
  }

  // State for 30-second warning modal
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningRemaining, setWarningRemaining] = useState(30);

  // 5-Minute Per-User Idle Session Timeout & Warning Monitor
  useEffect(() => {
    if (!user || !user.id) return;

    const userId = user.id;
    const userActivityKey = `crm_last_user_activity_${userId}`;
    const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 300,000 ms (5 minutes)
    const WARNING_THRESHOLD_MS = 4.5 * 60 * 1000; // 270,000 ms (4 min 30 s)
    const PING_INTERVAL_MS = 45 * 1000; // 45 seconds

    let warningTimer = null;
    let timeoutTimer = null;
    let countdownInterval = null;
    let lastPingTime = Date.now();
    let lastThrottleTime = 0;
    let isTimingOut = false;

    // Initialize user activity timestamp if missing
    if (!localStorage.getItem(userActivityKey)) {
      localStorage.setItem(userActivityKey, String(Date.now()));
    }

    const performIdleTimeout = async () => {
      if (isTimingOut) return;
      isTimingOut = true;
      try {
        await apiPost('/auth/idle-timeout', {}).catch(() => null);
      } finally {
        clearAuthSession();
        setUser(null);
        localStorage.removeItem(userActivityKey);
        if (typeof window !== 'undefined') {
          window.location.assign('/login?reason=idle_timeout');
        }
      }
    };

    const startWarningState = () => {
      setShowWarningModal(true);
      setWarningRemaining(30);

      if (countdownInterval) clearInterval(countdownInterval);
      let count = 30;
      countdownInterval = setInterval(() => {
        count -= 1;
        if (count >= 0) {
          setWarningRemaining(count);
        } else {
          clearInterval(countdownInterval);
        }
      }, 1000);
    };

    const clearWarningState = () => {
      setShowWarningModal(false);
      if (countdownInterval) clearInterval(countdownInterval);
    };

    const resetTimers = () => {
      clearWarningState();
      if (warningTimer) clearTimeout(warningTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);

      const now = Date.now();
      const lastActivity = parseInt(localStorage.getItem(userActivityKey) || String(now), 10);
      const elapsed = now - lastActivity;
      const remainingWarningMs = Math.max(0, WARNING_THRESHOLD_MS - elapsed);
      const remainingTimeoutMs = Math.max(0, IDLE_TIMEOUT_MS - elapsed);

      if (remainingTimeoutMs <= 0) {
        performIdleTimeout();
        return;
      }

      if (remainingWarningMs <= 0) {
        startWarningState();
      } else {
        warningTimer = setTimeout(() => {
          startWarningState();
        }, remainingWarningMs);
      }

      timeoutTimer = setTimeout(() => {
        performIdleTimeout();
      }, remainingTimeoutMs);
    };

    const handleUserInteraction = () => {
      const now = Date.now();
      if (now - lastThrottleTime < 1000) return; // Throttle to 1 second
      lastThrottleTime = now;

      // Update local storage for multi-tab sync
      localStorage.setItem(userActivityKey, String(now));

      // Reset timers locally
      resetTimers();

      // Throttled backend activity ping (once every 45s of active working)
      if (now - lastPingTime > PING_INTERVAL_MS) {
        lastPingTime = now;
        apiPost('/auth/ping', {}, { isUserActivity: true }).catch((err) => {
          if (err?.status === 401) {
            performIdleTimeout();
          }
        });
      }
    };

    // Storage event for multi-tab sync across tabs for the SAME user
    const handleStorageEvent = (e) => {
      if (e.key === userActivityKey && e.newValue) {
        resetTimers();
      }
    };

    // Listen ONLY to meaningful interaction events (no mousemove or hover)
    const events = ['mousedown', 'click', 'keydown', 'touchstart', 'scroll', 'pointerdown'];
    events.forEach((evt) => window.addEventListener(evt, handleUserInteraction, { passive: true }));
    window.addEventListener('storage', handleStorageEvent);

    // Initial timer setup
    resetTimers();

    return () => {
      if (warningTimer) clearTimeout(warningTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (countdownInterval) clearInterval(countdownInterval);
      events.forEach((evt) => window.removeEventListener(evt, handleUserInteraction));
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [user?.id]);

  const handleStaySignedIn = async () => {
    if (!user || !user.id) return;
    const userActivityKey = `crm_last_user_activity_${user.id}`;
    const now = Date.now();
    localStorage.setItem(userActivityKey, String(now));
    setShowWarningModal(false);

    try {
      await apiPost('/auth/ping', {}, { isUserActivity: true });
    } catch (err) {
      if (err?.status === 401) {
        clearAuthSession();
        setUser(null);
        localStorage.removeItem(userActivityKey);
        if (typeof window !== 'undefined') {
          window.location.assign('/login?reason=idle_timeout');
        }
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userRole: user?.role || (user ? 'admin' : null),
        loading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}

      {/* 30-Second Session Expiry Warning Modal (Portaled directly to document.body) */}
      {showWarningModal && ReactDOM.createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '420px',
              background: '#ffffff',
              borderRadius: '20px',
              padding: '28px 24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              border: '1px solid #e2e8f0',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: '#fef3c7',
                color: '#d97706',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>

            <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: '0 0 8px 0' }}>
              Session Timeout Warning
            </h3>
            <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 20px 0', lineHeight: '1.5' }}>
              Your session will expire soon due to inactivity. You will be logged out in{' '}
              <strong style={{ color: '#ef4444', fontWeight: '700' }}>{warningRemaining} seconds</strong>.
            </p>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={logout}
                style={{
                  flex: 1,
                  height: '44px',
                  borderRadius: '12px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Log out
              </button>
              <button
                type="button"
                onClick={handleStaySignedIn}
                style={{
                  flex: 1,
                  height: '44px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  color: '#ffffff',
                  fontWeight: '700',
                  fontSize: '14px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
                }}
              >
                Stay signed in
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export default AuthContext;
