import { AuthValidationError, loginUser } from '../services/authService.js';

export const loginController = async (request, response) => {
  try {
    const session = await loginUser(request.body);

    response.json(session);
  } catch (error) {
    if (error instanceof AuthValidationError) {
      response.status(error.statusCode).json({ status: 'error', message: error.message });
      return;
    }

    console.error('[auth-login] error', error);
    response.status(500).json({ status: 'error', message: 'No se pudo iniciar sesión.' });
  }
};
