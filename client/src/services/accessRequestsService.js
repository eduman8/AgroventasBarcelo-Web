const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function parseErrorMessage(response, fallbackMessage) {
  try {
    const errorBody = await response.json();

    return errorBody?.message || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

export async function createAccessRequest(accessRequest) {
  const response = await fetch(`${apiUrl}/api/solicitudes-acceso`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(accessRequest)
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'No se pudo enviar la solicitud de acceso.'));
  }

  return response.json();
}


const validAccessRequestStatuses = ['Pendiente', 'Aprobado', 'Rechazado'];

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

export function getValidAccessRequestStatuses() {
  return validAccessRequestStatuses;
}

export async function getAdminAccessRequests() {
  return fetchJson('/api/admin/solicitudes-acceso', 'No se pudieron cargar las solicitudes de acceso.');
}

export async function getAdminAccessRequestDetail(id) {
  const accessRequest = await fetchJson(
    `/api/admin/solicitudes-acceso/${encodeURIComponent(id)}`,
    'No se pudo cargar el detalle de la solicitud de acceso.'
  );

  if (!accessRequest) {
    throw new Error('Solicitud de acceso no encontrada.');
  }

  return accessRequest;
}

export async function updateAdminAccessRequestStatus(id, estado) {
  const accessRequest = await fetchJson(
    `/api/admin/solicitudes-acceso/${encodeURIComponent(id)}/estado`,
    'No se pudo actualizar el estado de la solicitud de acceso.',
    {
      method: 'PATCH',
      body: JSON.stringify({ estado })
    }
  );

  if (!accessRequest) {
    throw new Error('Solicitud de acceso no encontrada.');
  }

  return accessRequest;
}
