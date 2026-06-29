import { apiUrl } from './sparePartsService.js';
import { getAuthHeaders } from './apiClient.js';

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

export async function getVisualSparePartsPanel({ manualNombre = '', pagina = '', token = '' } = {}) {
  const params = new URLSearchParams({
    manualNombre: String(manualNombre).trim(),
    pagina: String(pagina).trim()
  });

  const response = await fetch(`${apiUrl}/api/buscador-visual-repuestos/panel?${params.toString()}`, {
    headers: buildAuthHeaders(token)
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'No se pudo cargar el panel visual.'));
  }

  return response.json();
}

export async function getAdminVisualPoints({ manualNombre = '', pagina = '' } = {}) {
  const params = new URLSearchParams({ manualNombre: String(manualNombre).trim(), pagina: String(pagina).trim() });
  const response = await fetch(`${apiUrl}/api/admin/repuestos-visuales/puntos?${params.toString()}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response, 'No se pudieron cargar los puntos visuales.'));
  return response.json();
}

export async function createAdminVisualPoint(point) {
  const response = await fetch(`${apiUrl}/api/admin/repuestos-visuales/puntos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(point)
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response, 'No se pudo guardar el punto visual.'));
  return response.json();
}

export async function updateAdminVisualPoint(id, point) {
  const response = await fetch(`${apiUrl}/api/admin/repuestos-visuales/puntos/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(point)
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response, 'No se pudo actualizar el punto visual.'));
  return response.json();
}

export async function deleteAdminVisualPoint(id) {
  const response = await fetch(`${apiUrl}/api/admin/repuestos-visuales/puntos/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response, 'No se pudo eliminar el punto visual.'));
}


export async function uploadVisualManualPdf({ manualNombre = '', archivo } = {}) {
  const formData = new FormData();
  formData.append('manualNombre', String(manualNombre).trim());
  formData.append('archivo', archivo);

  const response = await fetch(`${apiUrl}/api/admin/repuestos-visuales/manuales/upload`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response, 'No se pudieron generar imágenes desde el PDF.'));
  return response.json();
}
