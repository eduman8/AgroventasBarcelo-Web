import {
  createAdminMachine,
  getAdminMachines,
  MachineValidationError,
  softDeleteAdminMachine,
  updateAdminMachine
} from '../services/adminMachinesService.js';

const isDuplicateSlugError = (error) => {
  const number = error?.cause?.number ?? error?.number;

  return number === 2601 || number === 2627;
};

const logAdminMachineError = (scope, error) => {
  const diagnosticError = error?.cause || error;

  console.error(`[${scope}] SQL Server query error`, {
    message: diagnosticError?.message,
    code: diagnosticError?.code,
    number: diagnosticError?.number,
    originalErrorMessage: diagnosticError?.originalError?.message,
    originalErrorCode: diagnosticError?.originalError?.code
  });
};

const handleAdminMachineError = (scope, error, response) => {
  if (error instanceof MachineValidationError) {
    response.status(400).json({
      status: 'error',
      message: error.message
    });
    return;
  }

  if (isDuplicateSlugError(error)) {
    response.status(409).json({
      status: 'error',
      message: 'Ya existe una maquinaria con ese slug.'
    });
    return;
  }

  logAdminMachineError(scope, error);
  response.status(500).json({
    status: 'error',
    message: 'No se pudo procesar la maquinaria.'
  });
};

export const getAdminMachinesController = async (request, response) => {
  try {
    const machines = await getAdminMachines();

    response.json(machines);
  } catch (error) {
    handleAdminMachineError('admin-machines', error, response);
  }
};

export const createAdminMachineController = async (request, response) => {
  try {
    const machine = await createAdminMachine(request.body);

    response.status(201).json(machine);
  } catch (error) {
    handleAdminMachineError('admin-machine-create', error, response);
  }
};

export const updateAdminMachineController = async (request, response) => {
  try {
    const machine = await updateAdminMachine(request.params.id, request.body);

    if (!machine) {
      response.status(404).json({
        status: 'error',
        message: 'Maquinaria no encontrada.'
      });
      return;
    }

    response.json(machine);
  } catch (error) {
    handleAdminMachineError('admin-machine-update', error, response);
  }
};

export const deleteAdminMachineController = async (request, response) => {
  try {
    const machine = await softDeleteAdminMachine(request.params.id);

    if (!machine) {
      response.status(404).json({
        status: 'error',
        message: 'Maquinaria no encontrada.'
      });
      return;
    }

    response.json(machine);
  } catch (error) {
    handleAdminMachineError('admin-machine-delete', error, response);
  }
};
