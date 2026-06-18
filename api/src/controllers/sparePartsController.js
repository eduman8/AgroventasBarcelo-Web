import { getSparePartById, getSpareParts, getSparePartsCount } from '../services/sparePartsService.js';

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

export const getSparePartsCountController = async (request, response) => {
  try {
    const sparePartsCount = await getSparePartsCount();

    response.json(sparePartsCount);
  } catch (error) {
    const diagnosticError = error?.cause || error;

    console.error('[spare-parts-count] SQL Server query error', {
      message: sanitizeLogValue(diagnosticError?.message),
      code: sanitizeLogValue(diagnosticError?.code),
      originalErrorMessage: sanitizeLogValue(diagnosticError?.originalError?.message),
      originalErrorCode: sanitizeLogValue(diagnosticError?.originalError?.code)
    });

    response.status(500).json({
      status: 'error',
      message: 'No se pudo obtener el total de repuestos.'
    });
  }
};

export const getSparePartByIdController = async (request, response) => {
  try {
    const sparePart = await getSparePartById(request.params.id);

    if (!sparePart) {
      response.status(404).json({
        status: 'error',
        message: 'Repuesto no encontrado.'
      });
      return;
    }

    response.json(sparePart);
  } catch (error) {
    const diagnosticError = error?.cause || error;

    console.error('[spare-part-detail] SQL Server query error', {
      message: sanitizeLogValue(diagnosticError?.message),
      code: sanitizeLogValue(diagnosticError?.code),
      originalErrorMessage: sanitizeLogValue(diagnosticError?.originalError?.message),
      originalErrorCode: sanitizeLogValue(diagnosticError?.originalError?.code)
    });

    response.status(500).json({
      status: 'error',
      message: 'No se pudo obtener el detalle del repuesto.'
    });
  }
};

export const getSparePartsController = async (request, response) => {
  try {
    const spareParts = await getSpareParts({
      page: request.query.page,
      limit: request.query.limit,
      search: request.query.search
    });

    response.json(spareParts);
  } catch (error) {
    const diagnosticError = error?.cause || error;

    console.error('[spare-parts] SQL Server query error', {
      message: sanitizeLogValue(diagnosticError?.message),
      code: sanitizeLogValue(diagnosticError?.code),
      originalErrorMessage: sanitizeLogValue(diagnosticError?.originalError?.message),
      originalErrorCode: sanitizeLogValue(diagnosticError?.originalError?.code)
    });

    response.status(500).json({
      status: 'error',
      message: 'No se pudieron obtener los repuestos.'
    });
  }
};
