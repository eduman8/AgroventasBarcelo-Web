import { getStoredSession } from './authService.js';

export function getAuthHeaders() {
  const token = getStoredSession()?.token;

  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getJsonHeaders(extraHeaders = {}) {
  return {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
    ...extraHeaders
  };
}
