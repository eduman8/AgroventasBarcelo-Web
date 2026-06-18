import {
  getAdminInquiries,
  getAdminInquiryById,
  InquiryValidationError,
  updateAdminInquiryStatus
} from '../services/adminInquiriesService.js';

const logAdminInquiryError = (scope, error) => {
  const diagnosticError = error?.cause || error;

  console.error(`[${scope}] SQL Server query error`, {
    message: diagnosticError?.message,
    code: diagnosticError?.code,
    number: diagnosticError?.number,
    originalErrorMessage: diagnosticError?.originalError?.message,
    originalErrorCode: diagnosticError?.originalError?.code
  });
};

const handleAdminInquiryError = (scope, error, response) => {
  if (error instanceof InquiryValidationError) {
    response.status(400).json({
      status: 'error',
      message: error.message
    });
    return;
  }

  logAdminInquiryError(scope, error);
  response.status(500).json({
    status: 'error',
    message: 'No se pudo procesar la consulta.'
  });
};

export const getAdminInquiriesController = async (request, response) => {
  try {
    const inquiries = await getAdminInquiries();

    response.json(inquiries);
  } catch (error) {
    handleAdminInquiryError('admin-inquiries', error, response);
  }
};

export const getAdminInquiryDetailController = async (request, response) => {
  try {
    const inquiry = await getAdminInquiryById(request.params.id);

    if (!inquiry) {
      response.status(404).json({
        status: 'error',
        message: 'Consulta no encontrada.'
      });
      return;
    }

    response.json(inquiry);
  } catch (error) {
    handleAdminInquiryError('admin-inquiry-detail', error, response);
  }
};

export const updateAdminInquiryStatusController = async (request, response) => {
  try {
    const inquiry = await updateAdminInquiryStatus(request.params.id, request.body?.estado ?? request.body?.status);

    if (!inquiry) {
      response.status(404).json({
        status: 'error',
        message: 'Consulta no encontrada.'
      });
      return;
    }

    response.json(inquiry);
  } catch (error) {
    handleAdminInquiryError('admin-inquiry-status-update', error, response);
  }
};
