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

export function getStoredSession() {
  try {
    return JSON.parse(window.localStorage.getItem(sessionStorageKey));
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
