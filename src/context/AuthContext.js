import React, { createContext, useContext, useState, useEffect } from 'react';
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
      await apiPost('/auth/logout', {}).catch(() => null);
    } finally {
      clearAuthSession();
      setUser(null);
    }
  }

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
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export default AuthContext;
