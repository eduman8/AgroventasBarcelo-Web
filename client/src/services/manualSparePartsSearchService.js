import { apiUrl } from './sparePartsService.js';

const buildAuthHeaders = (token) => (token ? { Authorization: `Bearer ${token}` } : {});

async function parseErrorMessage(response, fallbackMessage) {
  try {
    const errorBody = await response.json();

    return errorBody?.message || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

export async function searchManualSpareParts({ search = '', limit = 25, token = '' } = {}) {
  const params = new URLSearchParams({
    limit: String(limit)
  });
  const normalizedSearch = search.trim();

  if (normalizedSearch) {
    params.set('search', normalizedSearch);
  }

  const response = await fetch(`${apiUrl}/api/buscador-repuestos?${params.toString()}`, {
    headers: buildAuthHeaders(token)
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'No se pudo buscar en los repuestos manuales.'));
  }

  return response.json();
}

export async function getManualSparePartsDiagnostics(token = '') {
  const response = await fetch(`${apiUrl}/api/buscador-repuestos/diagnostico`, {
    headers: buildAuthHeaders(token)
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'No se pudo obtener el estado de datos de repuestos manuales.'));
  }

  return response.json();
}

export async function searchVisualSpareParts({ manual = '', pagina = '', elemento = '', limit = 25, token = '' } = {}) {
  const params = new URLSearchParams({
    manual: String(manual).trim(),
    pagina: String(pagina).trim(),
    elemento: String(elemento).trim(),
    limit: String(limit)
  });

  const response = await fetch(`${apiUrl}/api/buscador-visual-repuestos?${params.toString()}`, {
    headers: buildAuthHeaders(token)
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'No se pudo buscar el repuesto visual en los manuales.'));
  }

  return response.json();
}
