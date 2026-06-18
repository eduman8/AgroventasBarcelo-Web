const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const fallbackInquiries = [
  {
    id: 'mock-1',
    fecha: '2026-06-12T10:30:00.000Z',
    nombre: 'Juan Pérez',
    email: 'juan@example.com',
    telefono: '+54 9 3471 555555',
    tipoConsulta: 'Consulta por maquinaria',
    estado: 'Nueva',
    mensaje: 'Necesito más información sobre una maquinaria disponible.',
    contexto: { type: 'maquinaria', name: 'Sembradora de ejemplo', brand: 'AgroBarceló' },
    repuestosSeleccionados: [],
    informacionManual: null
  },
  {
    id: 'mock-2',
    fecha: '2026-06-11T14:15:00.000Z',
    nombre: 'María Gómez',
    email: 'maria@example.com',
    telefono: '+54 9 3471 444444',
    tipoConsulta: 'Consulta por repuesto',
    estado: 'En proceso',
    mensaje: 'Busco disponibilidad de un repuesto del manual.',
    contexto: { type: 'repuesto', code: 'REP-001', name: 'Repuesto de ejemplo' },
    repuestosSeleccionados: [],
    informacionManual: { manual: 'Repuestos Rastras', page: '12', code: 'REP-001' }
  }
];

const validInquiryStatuses = ['Nueva', 'En proceso', 'Respondida', 'Cerrada'];

function withFallbackFlag(data) {
  const fallbackData = Array.isArray(data) ? [...data] : { ...data };

  return Object.defineProperty(fallbackData, 'isFallback', {
    value: true,
    enumerable: false
  });
}

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
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {})
    },
    ...options
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, fallbackMessage));
  }

  return response.json();
}

export function getValidInquiryStatuses() {
  return validInquiryStatuses;
}

export async function getAdminInquiries() {
  try {
    return await fetchJson('/api/admin/consultas', 'No se pudieron cargar las consultas del admin.');
  } catch {
    return withFallbackFlag(fallbackInquiries);
  }
}

export async function getAdminInquiryDetail(id) {
  const inquiry = await fetchJson(
    `/api/admin/consultas/${encodeURIComponent(id)}`,
    'No se pudo cargar el detalle de la consulta.'
  );

  if (!inquiry) {
    throw new Error('Consulta no encontrada.');
  }

  return inquiry;
}

export async function updateAdminInquiryStatus(id, estado) {
  const inquiry = await fetchJson(
    `/api/admin/consultas/${encodeURIComponent(id)}/estado`,
    'No se pudo actualizar el estado de la consulta.',
    {
      method: 'PATCH',
      body: JSON.stringify({ estado })
    }
  );

  if (!inquiry) {
    throw new Error('Consulta no encontrada.');
  }

  return inquiry;
}
