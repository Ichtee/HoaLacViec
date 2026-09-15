import { createContext, useContext, useState, useCallback } from 'react';
import { login as serviceLogin, register as serviceRegister } from '@/services';

/**
 * AuthContext — demo session management
 * NOTE: This is NOT a production authentication system.
 * Sessions are in-memory only. No passwords are stored.
 */
const AuthContext = createContext(null);

const SESSION_KEY = 'hlv_demo_session';

function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(session) {
  if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else sessionStorage.removeItem(SESSION_KEY);
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => loadSession());

  const login = useCallback(async (email, role) => {
    const result = await serviceLogin(email, role);
    const newSession = { user: result.user, profileId: result.profileId };
    setSession(newSession);
    saveSession(newSession);
    return newSession;
  }, []);

  const register = useCallback(async (data) => {
    const result = await serviceRegister(data);
    const newSession = { user: result.user, profileId: result.profileId };
    setSession(newSession);
    saveSession(newSession);
    return newSession;
  }, []);

  const logout = useCallback(() => {
    setSession(null);
    saveSession(null);
  }, []);

  const value = {
    user: session?.user || null,
    profileId: session?.profileId || null,
    role: session?.user?.role || null,
    isAuthenticated: !!session?.user,
    isStudent: session?.user?.role === 'student',
    isEmployer: session?.user?.role === 'employer',
    isAdmin: session?.user?.role === 'admin',
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
