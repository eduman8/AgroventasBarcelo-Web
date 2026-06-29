const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const sessionStorageKey = 'agrobarcelo_session';

async function parseErrorMessage(response, fallbackMessage) {
  try {
    const errorBody = await response.json();

    return errorBody?.message || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

function decodeTokenPayload(token) {
  const encodedPayload = String(token ?? '').split('.')[1];

  if (!encodedPayload) return null;

  try {
    return JSON.parse(window.atob(encodedPayload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

export function isSessionValid(session) {
  if (!session?.token) return false;

  const payload = decodeTokenPayload(session.token);

  return Number(payload?.exp) > Math.floor(Date.now() / 1000);
}

export function getStoredSession() {
  try {
    const session = JSON.parse(window.localStorage.getItem(sessionStorageKey));

    if (!isSessionValid(session)) {
      clearStoredSession();
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export function storeSession(session) {
  window.localStorage.setItem(sessionStorageKey, JSON.stringify(session));
}

export function clearStoredSession() {
  window.localStorage.removeItem(sessionStorageKey);
}

export async function login({ email, password }) {
  const response = await fetch(`${apiUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'No se pudo iniciar sesión.'));
  }

  return response.json();
}
