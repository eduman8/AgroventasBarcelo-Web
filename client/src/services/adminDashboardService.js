const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const emptyDashboard = {
  consultas: {
    total: 0,
    nuevas: 0,
    enProceso: 0,
    respondidas: 0,
    cerradas: 0
  },
  maquinarias: {
    total: 0,
    disponibles: 0,
    vendidas: 0
  },
  repuestos: {
    total: 0
  },
  ultimasConsultas: []
};

async function parseErrorMessage(response, fallbackMessage) {
  try {
    const errorBody = await response.json();

    return errorBody?.message || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

export async function getAdminDashboard() {
  const response = await fetch(`${apiUrl}/api/admin/dashboard`, {
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'No se pudo cargar el dashboard administrativo.'));
  }

  return {
    ...emptyDashboard,
    ...(await response.json())
  };
}

export { emptyDashboard };
