import { getMachineBySlug, getMachines } from '../services/machinesService.js';

const logMachineError = (scope, error) => {
  const diagnosticError = error?.cause || error;

  console.error(`[${scope}] SQL Server query error`, {
    message: diagnosticError?.message,
    code: diagnosticError?.code,
    originalErrorMessage: diagnosticError?.originalError?.message,
    originalErrorCode: diagnosticError?.originalError?.code
  });
};

export const getMachinesController = async (request, response) => {
  try {
    const machines = await getMachines();

    response.json(machines);
  } catch (error) {
    logMachineError('machines', error);

    response.status(500).json({
      status: 'error',
      message: 'No se pudieron obtener las maquinarias.'
    });
  }
};

export const getMachineBySlugController = async (request, response) => {
  try {
    const machine = await getMachineBySlug(request.params.slug);

    if (!machine) {
      response.status(404).json({
        status: 'error',
        message: 'Maquinaria no encontrada.'
      });
      return;
    }

    response.json(machine);
  } catch (error) {
    logMachineError('machine-detail', error);

    response.status(500).json({
      status: 'error',
      message: 'No se pudo obtener el detalle de la maquinaria.'
    });
  }
};
