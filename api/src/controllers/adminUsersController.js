import {
  AdminUserValidationError,
  getAdminUserById,
  getAdminUsers,
  updateAdminUserStatus
} from '../services/adminUsersService.js';

const logAdminUserError = (scope, error) => {
  const diagnosticError = error?.cause || error;

  console.error(`[${scope}] SQL Server query error`, {
    message: diagnosticError?.message,
    code: diagnosticError?.code,
    number: diagnosticError?.number,
    originalErrorMessage: diagnosticError?.originalError?.message,
    originalErrorCode: diagnosticError?.originalError?.code
  });
};

const handleAdminUserError = (scope, error, response) => {
  if (error instanceof AdminUserValidationError) {
    response.status(400).json({
      status: 'error',
      message: error.message
    });
    return;
  }

  logAdminUserError(scope, error);
  response.status(500).json({
    status: 'error',
    message: 'No se pudo procesar la operación de usuarios.'
  });
};

export const getAdminUsersController = async (request, response) => {
  try {
    const users = await getAdminUsers();

    response.json(users);
  } catch (error) {
    handleAdminUserError('admin-users', error, response);
  }
};

export const getAdminUserDetailController = async (request, response) => {
  try {
    const user = await getAdminUserById(request.params.id);

    if (!user) {
      response.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado.'
      });
      return;
    }

    response.json(user);
  } catch (error) {
    handleAdminUserError('admin-user-detail', error, response);
  }
};

export const updateAdminUserStatusController = async (request, response) => {
  try {
    const user = await updateAdminUserStatus(
      request.params.id,
      request.body?.estado ?? request.body?.status
    );

    if (!user) {
      response.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado.'
      });
      return;
    }

    response.json(user);
  } catch (error) {
    handleAdminUserError('admin-user-status-update', error, response);
  }
};
