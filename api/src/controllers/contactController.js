import { sendContactEmail } from '../services/contactEmailService.js';
import { createInquiry, InquiryValidationError } from '../services/adminInquiriesService.js';

const requiredFieldsMessage = 'Completá todos los campos obligatorios.';
const emailFormatRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isBlank(value) {
  return typeof value !== 'string' || value.trim() === '';
}

function normalizeSelectedParts(selectedParts) {
  if (!Array.isArray(selectedParts)) {
    return [];
  }

  return selectedParts
    .filter((selectedPart) => selectedPart && typeof selectedPart === 'object')
    .map((selectedPart) => ({
      id: selectedPart.id === null || selectedPart.id === undefined ? '' : String(selectedPart.id).trim(),
      name: selectedPart.name === null || selectedPart.name === undefined ? '' : String(selectedPart.name).trim(),
      code: selectedPart.code === null || selectedPart.code === undefined ? '' : String(selectedPart.code).trim()
    }))
    .filter((selectedPart) => selectedPart.id || selectedPart.name || selectedPart.code);
}

function normalizeContext(context) {
  if (!context || typeof context !== 'object') {
    return null;
  }

  return {
    type: context.type ? String(context.type).trim() : '',
    id: context.id ? String(context.id).trim() : '',
    name: context.name ? String(context.name).trim() : '',
    code: context.code ? String(context.code).trim() : '',
    brand: context.brand ? String(context.brand).trim() : ''
  };
}

function normalizeManualInfo(manualInfo) {
  if (!manualInfo || typeof manualInfo !== 'object') {
    return null;
  }

  const normalizedManualInfo = {
    manual: manualInfo.manual === null || manualInfo.manual === undefined ? '' : String(manualInfo.manual).trim(),
    page: manualInfo.page === null || manualInfo.page === undefined ? '' : String(manualInfo.page).trim(),
    code: manualInfo.code === null || manualInfo.code === undefined ? '' : String(manualInfo.code).trim()
  };

  return normalizedManualInfo.manual || normalizedManualInfo.page || normalizedManualInfo.code
    ? normalizedManualInfo
    : null;
}

async function persistContactInquiry(contactData) {
  try {
    await createInquiry(contactData);
  } catch (error) {
    if (error instanceof InquiryValidationError) {
      console.warn('Consulta de contacto no persistida por validación:', error.message);
      return;
    }

    const diagnosticError = error?.cause || error;

    console.error('No se pudo persistir la consulta de contacto:', {
      message: diagnosticError?.message,
      code: diagnosticError?.code,
      number: diagnosticError?.number,
      originalErrorMessage: diagnosticError?.originalError?.message
    });
  }
}

function validateContactData({ name, phone, email, subject, message }) {
  return !(
    isBlank(name) ||
    isBlank(phone) ||
    isBlank(email) ||
    !emailFormatRegex.test(email.trim()) ||
    isBlank(subject) ||
    isBlank(message)
  );
}

export async function createContactRequest(request, response) {
  const { name, phone, email, subject, message, context, selectedParts, manualInfo } = request.body || {};

  if (!validateContactData({ name, phone, email, subject, message })) {
    return response.status(400).json({
      status: 'error',
      message: requiredFieldsMessage
    });
  }

  const contactData = {
    name: name.trim(),
    phone: phone.trim(),
    email: email.trim(),
    subject: subject.trim(),
    message: message.trim(),
    context: normalizeContext(context),
    selectedParts: normalizeSelectedParts(selectedParts),
    manualInfo: normalizeManualInfo(manualInfo)
  };

  try {
    await sendContactEmail(contactData);
    await persistContactInquiry(contactData);

    return response.json({
      status: 'ok',
      message: 'Consulta enviada correctamente.'
    });
  } catch (error) {
    console.error('Error enviando consulta de contacto:', {
      message: error.message,
      code: error.code,
      command: error.command,
      responseCode: error.responseCode,
      stack: error.stack
    });

    return response.status(500).json({
      status: 'error',
      message: 'No se pudo enviar la consulta. Intentá nuevamente más tarde.'
    });
  }
}
