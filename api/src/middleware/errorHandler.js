export const notFoundHandler = (request, response) => {
  response.status(404).json({ message: 'Recurso no encontrado.' });
};

export const errorHandler = (error, request, response, next) => {
  if (response.headersSent) return next(error);

  const statusCode = error.status || error.statusCode || (error.type === 'entity.too.large' ? 413 : 500);
  const safeStatusCode = statusCode >= 400 && statusCode < 600 ? statusCode : 500;
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    console.error('[api-error]', error);
  }

  response.status(safeStatusCode).json({
    message: safeStatusCode === 500 ? 'Error interno del servidor.' : error.message,
    ...(isProduction ? {} : { stack: error.stack })
  });
};
