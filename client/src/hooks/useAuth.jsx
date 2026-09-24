import { createContext, useContext, useState, useCallback } from 'react';
import { login as serviceLogin, register as serviceRegister, googleLogin as serviceGoogleLogin } from '@/services';

/**
 * AuthContext — Authentication & session management
 */
const AuthContext = createContext(null);

const SESSION_KEY = 'hlv_auth_session';

function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(session) {
  if (session) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('token');
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => loadSession());

  const handleAuthResult = useCallback((result) => {
    const user = result?.user || result;
    const profileId = result?.profileId || user?.profileId || user?.profile?._id || user?.profile?.id || null;
    const newSession = { user, profileId };
    setSession(newSession);
    saveSession(newSession);
    return newSession;
  }, []);

  const login = useCallback(async (email, password) => {
    const result = await serviceLogin(email, password);
    return handleAuthResult(result);
  }, [handleAuthResult]);

  const googleLogin = useCallback(async (credential) => {
    const result = await serviceGoogleLogin(credential);
    return handleAuthResult(result);
  }, [handleAuthResult]);

  const register = useCallback(async (data) => {
    const result = await serviceRegister(data);
    return handleAuthResult(result);
  }, [handleAuthResult]);

  const updateUser = useCallback((updatedUser) => {
    setSession((prev) => {
      if (!prev) return null;
      const mergedUser = { ...prev.user, ...updatedUser };
      const profileId = updatedUser?.profileId || updatedUser?.profile?._id || prev.profileId;
      const newSession = {
        ...prev,
        user: mergedUser,
        profileId,
      };
      saveSession(newSession);
      return newSession;
    });
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
    isPending: session?.user?.status === 'pending' || session?.user?.role === 'pending',
    login,
    googleLogin,
    register,
    updateUser,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
