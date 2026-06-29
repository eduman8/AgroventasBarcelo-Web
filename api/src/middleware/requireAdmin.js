export const requireAdmin = (request, response, next) => {
  const userRole = String(request.auth?.user?.rol ?? '').trim();

  if (userRole !== 'Admin') {
    response.status(403).json({ status: 'error', message: 'Permisos de administrador requeridos.' });
    return;
  }

  next();
};
