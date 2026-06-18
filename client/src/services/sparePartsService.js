export const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const buildAuthHeaders = (token) => (token ? { Authorization: `Bearer ${token}` } : {});

async function parseErrorMessage(response, fallbackMessage) {
  try {
    const errorBody = await response.json();

    return errorBody?.message || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

export async function getSpareParts({ page = 1, limit = 50, search = '', token = '' } = {}) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit)
  });

  if (search.trim()) {
    params.set('search', search.trim());
  }

  const response = await fetch(`${apiUrl}/api/repuestos?${params.toString()}`, {
    headers: buildAuthHeaders(token)
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'No se pudieron cargar los repuestos.'));
  }

  return response.json();
}

export async function getSparePartById(id, token = '') {
  const response = await fetch(`${apiUrl}/api/repuestos/${encodeURIComponent(id)}`, {
    headers: buildAuthHeaders(token)
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'No se pudo cargar el detalle del repuesto.'));
  }

  return response.json();
}
