import { getSqlPool } from '../config/sqlServer.js';

const sanitizeDiagnosticValue = (value) => {
  if (value === undefined || value === null) {
    return value;
  }

  let sanitizedValue = String(value);

  [process.env.DB_USER, process.env.DB_PASSWORD].filter(Boolean).forEach((sensitiveValue) => {
    sanitizedValue = sanitizedValue.replaceAll(sensitiveValue, '[redacted]');
  });

  return sanitizedValue.replace(/user\s+'[^']*'/gi, "user '[redacted]'");
};

const getDiagnosticValue = (error, property) => sanitizeDiagnosticValue(error?.[property]);

export const getDbHealth = async (request, response) => {
  try {
    const pool = await getSqlPool();
    const queryResult = await pool.request().query('SELECT 1 AS ok');
    const result = queryResult.recordset?.[0]?.ok;

    response.json({
      status: 'ok',
      database: process.env.DB_DATABASE,
      result
    });
  } catch (error) {
    const diagnosticError = error?.cause || error;
    const errorMessage = getDiagnosticValue(diagnosticError, 'message') || 'No se pudo validar la conexión con SQL Server.';
    const errorCode = getDiagnosticValue(diagnosticError, 'code');

    console.error('[db-health] SQL Server connection error', {
      message: errorMessage,
      code: errorCode,
      originalErrorMessage: sanitizeDiagnosticValue(diagnosticError?.originalError?.message),
      originalErrorCode: sanitizeDiagnosticValue(diagnosticError?.originalError?.code)
    });

    response.status(500).json({
      status: 'error',
      message: 'No se pudo validar la conexión con SQL Server.',
      ...(process.env.NODE_ENV === 'development' && {
        errorMessage,
        errorCode
      })
    });
  }
};
