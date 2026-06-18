import {
  AccessRequestValidationError,
  createAccessRequest,
  getAdminAccessRequestById,
  getAdminAccessRequests,
  updateAdminAccessRequestStatus
} from '../services/accessRequestsService.js';

const logAccessRequestError = (scope, error) => {
  const diagnosticError = error?.cause || error;

  console.error(`[${scope}] SQL Server query error`, {
    message: diagnosticError?.message,
    code: diagnosticError?.code,
    number: diagnosticError?.number,
    originalErrorMessage: diagnosticError?.originalError?.message,
    originalErrorCode: diagnosticError?.originalError?.code
  });
};

const handleAccessRequestError = (scope, error, response) => {
  if (error instanceof AccessRequestValidationError) {
    response.status(400).json({
      status: 'error',
      message: error.message
    });
    return;
  }

  logAccessRequestError(scope, error);
  response.status(500).json({
    status: 'error',
    message: 'No se pudo procesar la solicitud de acceso.'
  });
};

export const createAccessRequestController = async (request, response) => {
  try {
    const accessRequest = await createAccessRequest(request.body);

    response.status(201).json(accessRequest);
  } catch (error) {
    handleAccessRequestError('create-access-request', error, response);
  }
};

export const getAdminAccessRequestsController = async (request, response) => {
  try {
    const accessRequests = await getAdminAccessRequests();

    response.json(accessRequests);
  } catch (error) {
    handleAccessRequestError('admin-access-requests', error, response);
  }
};


export const getAdminAccessRequestDetailController = async (request, response) => {
  try {
    const accessRequest = await getAdminAccessRequestById(request.params.id);

    if (!accessRequest) {
      response.status(404).json({
        status: 'error',
        message: 'Solicitud de acceso no encontrada.'
      });
      return;
    }

    response.json(accessRequest);
  } catch (error) {
    handleAccessRequestError('admin-access-request-detail', error, response);
  }
};

export const updateAdminAccessRequestStatusController = async (request, response) => {
  try {
    const accessRequest = await updateAdminAccessRequestStatus(
      request.params.id,
      request.body?.estado ?? request.body?.status
    );

    if (!accessRequest) {
      response.status(404).json({
        status: 'error',
        message: 'Solicitud de acceso no encontrada.'
      });
      return;
    }

    response.json(accessRequest);
  } catch (error) {
    handleAccessRequestError('admin-access-request-status-update', error, response);
  }
};
