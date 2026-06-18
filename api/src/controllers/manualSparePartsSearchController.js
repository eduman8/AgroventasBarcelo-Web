import {
  getManualSparePartsDiagnostics,
  searchManualSpareParts,
  searchVisualSpareParts
} from '../services/manualSparePartsSearchService.js';

const sanitizeLogValue = (value) => {
  if (value === undefined || value === null) {
    return value;
  }

  let sanitizedValue = String(value);

  [process.env.DB_USER, process.env.DB_PASSWORD].filter(Boolean).forEach((sensitiveValue) => {
    sanitizedValue = sanitizedValue.replaceAll(sensitiveValue, '[redacted]');
  });

  return sanitizedValue.replace(/user\s+'[^']*'/gi, "user '[redacted]'");
};

export const searchManualSparePartsController = async (request, response) => {
  try {
    const searchResults = await searchManualSpareParts({
      search: request.query.search,
      limit: request.query.limit
    });

    response.json(searchResults);
  } catch (error) {
    const diagnosticError = error?.cause || error;

    console.error('[manual-spare-parts-search] SQL Server query error', {
      message: sanitizeLogValue(diagnosticError?.message),
      code: sanitizeLogValue(diagnosticError?.code),
      originalErrorMessage: sanitizeLogValue(diagnosticError?.originalError?.message),
      originalErrorCode: sanitizeLogValue(diagnosticError?.originalError?.code)
    });

    response.status(500).json({
      status: 'error',
      message: 'No se pudo buscar en los repuestos manuales.'
    });
  }
};

export const searchVisualSparePartsController = async (request, response) => {
  try {
    const searchResults = await searchVisualSpareParts({
      manual: request.query.manual,
      pagina: request.query.pagina,
      elemento: request.query.elemento,
      limit: request.query.limit
    });

    response.json(searchResults);
  } catch (error) {
    const diagnosticError = error?.cause || error;

    console.error('[visual-spare-parts-search] SQL Server query error', {
      message: sanitizeLogValue(diagnosticError?.message),
      code: sanitizeLogValue(diagnosticError?.code),
      originalErrorMessage: sanitizeLogValue(diagnosticError?.originalError?.message),
      originalErrorCode: sanitizeLogValue(diagnosticError?.originalError?.code)
    });

    response.status(500).json({
      status: 'error',
      message: 'No se pudo buscar el repuesto visual en los manuales.'
    });
  }
};

export const getManualSparePartsDiagnosticsController = async (request, response) => {
  try {
    const diagnostics = await getManualSparePartsDiagnostics();

    response.json(diagnostics);
  } catch (error) {
    const diagnosticError = error?.cause || error;

    console.error('[manual-spare-parts-diagnostics] SQL Server query error', {
      message: sanitizeLogValue(diagnosticError?.message),
      code: sanitizeLogValue(diagnosticError?.code),
      originalErrorMessage: sanitizeLogValue(diagnosticError?.originalError?.message),
      originalErrorCode: sanitizeLogValue(diagnosticError?.originalError?.code)
    });

    response.status(500).json({
      status: 'error',
      message: 'No se pudo obtener el diagnóstico de repuestos manuales.'
    });
  }
};
