import { getJsonHeaders } from './apiClient.js';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const validUserStatuses = ['Activo', 'Inactivo'];

async function parseErrorMessage(response, fallbackMessage) {
  try {
    const errorBody = await response.json();

    return errorBody?.message || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

async function fetchJson(path, fallbackMessage, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: getJsonHeaders(options.headers)
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, fallbackMessage));
  }

  return response.json();
}

export function getValidUserStatuses() {
  return validUserStatuses;
}

export async function getAdminUsers() {
  return fetchJson('/api/admin/usuarios', 'No se pudieron cargar los usuarios.');
}

export async function getAdminUserDetail(id) {
  const user = await fetchJson(
    `/api/admin/usuarios/${encodeURIComponent(id)}`,
    'No se pudo cargar el detalle del usuario.'
  );

  if (!user) {
    throw new Error('Usuario no encontrado.');
  }

  return user;
}

export async function updateAdminUserStatus(id, estado) {
  const user = await fetchJson(
    `/api/admin/usuarios/${encodeURIComponent(id)}/estado`,
    'No se pudo actualizar el estado del usuario.',
    {
      method: 'PATCH',
      body: JSON.stringify({ estado })
    }
  );

  if (!user) {
    throw new Error('Usuario no encontrado.');
  }

  return user;
}
