import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { clearStoredSession, getStoredSession, isAdminUser, isSessionValid, login, storeSession } from '../services/authService.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => getStoredSession());

  async function signIn(credentials) {
    const nextSession = await login(credentials);
    storeSession(nextSession);
    setSession(nextSession);

    return nextSession;
  }

  function logout() {
    clearStoredSession();
    setSession(null);
  }

  useEffect(() => {
    if (session && !isSessionValid(session)) {
      clearStoredSession();
      setSession(null);
    }
  }, [session]);

  const isAuthenticated = isSessionValid(session);
  const user = isAuthenticated ? {
    id: session.id,
    nombre: session.nombre,
    email: session.email,
    rol: session.rol
  } : null;

  const value = useMemo(() => ({
    session: isAuthenticated ? session : null,
    token: isAuthenticated ? session?.token ?? null : null,
    user,
    isAuthenticated,
    isAdmin: isAdminUser(user),
    signIn,
    logout
  }), [isAuthenticated, session, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider.');
  }

  return context;
}
