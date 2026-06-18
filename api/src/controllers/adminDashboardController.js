import { getAdminDashboard } from '../services/adminDashboardService.js';

export const getAdminDashboardController = async (request, response) => {
  try {
    const dashboard = await getAdminDashboard();

    response.json(dashboard);
  } catch (error) {
    const diagnosticError = error?.cause || error;

    console.error('[admin-dashboard] SQL Server query error', {
      message: diagnosticError?.message,
      code: diagnosticError?.code,
      number: diagnosticError?.number,
      originalErrorMessage: diagnosticError?.originalError?.message,
      originalErrorCode: diagnosticError?.originalError?.code
    });

    response.status(500).json({
      status: 'error',
      message: 'No se pudo cargar el dashboard administrativo.'
    });
  }
};
