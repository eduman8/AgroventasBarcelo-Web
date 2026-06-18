import { createContext, useContext, useMemo, useState } from 'react';
import { clearStoredSession, getStoredSession, login, storeSession } from '../services/authService.js';

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

  const value = useMemo(() => ({
    session,
    token: session?.token ?? null,
    user: session ? {
      id: session.id,
      nombre: session.nombre,
      email: session.email,
      rol: session.rol
    } : null,
    isAuthenticated: Boolean(session?.token),
    signIn,
    logout
  }), [session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider.');
  }

  return context;
}
