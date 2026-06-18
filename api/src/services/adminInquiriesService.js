import { getSqlPool, sql } from '../config/sqlServer.js';

class InquiryValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InquiryValidationError';
  }
}

export { InquiryValidationError };

export const inquiryStatuses = ['Nueva', 'En proceso', 'Respondida', 'Cerrada'];

const inquiryFieldsSelect = `
    ID_WebConsulta AS id,
    FechaAlta AS fecha,
    Nombre AS nombre,
    Email AS email,
    Telefono AS telefono,
    TipoConsulta AS tipoConsulta,
    Estado AS estado,
    Mensaje AS mensaje,
    Contexto AS contexto,
    RepuestosSeleccionados AS repuestosSeleccionados,
    InformacionManual AS informacionManual,
    FechaModificacion AS fechaModificacion
`;

const allInquiriesQuery = `
SELECT${inquiryFieldsSelect}
FROM dbo.WebConsultas
ORDER BY FechaAlta DESC, ID_WebConsulta DESC;
`;

const inquiryByIdQuery = `
SELECT TOP (1)${inquiryFieldsSelect}
FROM dbo.WebConsultas
WHERE ID_WebConsulta = @id;
`;

const createInquiryQuery = `
INSERT INTO dbo.WebConsultas (
    Nombre,
    Email,
    Telefono,
    TipoConsulta,
    Estado,
    Mensaje,
    Contexto,
    RepuestosSeleccionados,
    InformacionManual
)
OUTPUT
    INSERTED.ID_WebConsulta AS id,
    INSERTED.FechaAlta AS fecha,
    INSERTED.Nombre AS nombre,
    INSERTED.Email AS email,
    INSERTED.Telefono AS telefono,
    INSERTED.TipoConsulta AS tipoConsulta,
    INSERTED.Estado AS estado,
    INSERTED.Mensaje AS mensaje,
    INSERTED.Contexto AS contexto,
    INSERTED.RepuestosSeleccionados AS repuestosSeleccionados,
    INSERTED.InformacionManual AS informacionManual,
    INSERTED.FechaModificacion AS fechaModificacion
VALUES (
    @nombre,
    @email,
    @telefono,
    @tipoConsulta,
    @estado,
    @mensaje,
    @contexto,
    @repuestosSeleccionados,
    @informacionManual
);
`;

const updateInquiryStatusQuery = `
UPDATE dbo.WebConsultas
SET
    Estado = @estado,
    FechaModificacion = GETDATE()
OUTPUT
    INSERTED.ID_WebConsulta AS id,
    INSERTED.FechaAlta AS fecha,
    INSERTED.Nombre AS nombre,
    INSERTED.Email AS email,
    INSERTED.Telefono AS telefono,
    INSERTED.TipoConsulta AS tipoConsulta,
    INSERTED.Estado AS estado,
    INSERTED.Mensaje AS mensaje,
    INSERTED.Contexto AS contexto,
    INSERTED.RepuestosSeleccionados AS repuestosSeleccionados,
    INSERTED.InformacionManual AS informacionManual,
    INSERTED.FechaModificacion AS fechaModificacion
WHERE ID_WebConsulta = @id;
`;

const statusAliases = new Map([
  ['nueva', 'Nueva'],
  ['nuevo', 'Nueva'],
  ['en proceso', 'En proceso'],
  ['proceso', 'En proceso'],
  ['procesando', 'En proceso'],
  ['respondida', 'Respondida'],
  ['respondido', 'Respondida'],
  ['cerrada', 'Cerrada'],
  ['cerrado', 'Cerrada']
]);

const parsePositiveInteger = (value) => {
  const parsedValue = Number.parseInt(value, 10);

  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
};

const normalizeText = (value, maxLength) => {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim().slice(0, maxLength);
};

const serializeJson = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  return JSON.stringify(value);
};

const parseJsonField = (value, fallbackValue) => {
  if (!value) {
    return fallbackValue;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallbackValue;
  }
};

export const normalizeInquiryStatus = (value) => {
  const normalizedValue = normalizeText(value, 50);
  const normalizedStatus = statusAliases.get(normalizedValue.toLocaleLowerCase('es-AR')) ?? normalizedValue;

  if (!inquiryStatuses.includes(normalizedStatus)) {
    throw new InquiryValidationError('El estado debe ser Nueva, En proceso, Respondida o Cerrada.');
  }

  return normalizedStatus;
};

const normalizeInquiryPayload = (payload) => {
  const nombre = normalizeText(payload?.name ?? payload?.nombre, 200);
  const email = normalizeText(payload?.email, 200);
  const telefono = normalizeText(payload?.phone ?? payload?.telefono, 80);
  const tipoConsulta = normalizeText(payload?.subject ?? payload?.tipoConsulta, 150);
  const mensaje = normalizeText(payload?.message ?? payload?.mensaje, 4000);

  if (!nombre || !email || !telefono || !tipoConsulta || !mensaje) {
    throw new InquiryValidationError('La consulta debe incluir nombre, email, teléfono, tipo y mensaje.');
  }

  return {
    nombre,
    email,
    telefono,
    tipoConsulta,
    estado: normalizeInquiryStatus(payload?.estado ?? 'Nueva'),
    mensaje,
    contexto: serializeJson(payload?.context ?? payload?.contexto ?? null),
    repuestosSeleccionados: serializeJson(payload?.selectedParts ?? payload?.repuestosSeleccionados ?? []),
    informacionManual: serializeJson(payload?.manualInfo ?? payload?.informacionManual ?? null)
  };
};

const mapInquiry = (inquiry) => ({
  id: inquiry.id,
  fecha: inquiry.fecha,
  nombre: inquiry.nombre,
  email: inquiry.email,
  telefono: inquiry.telefono,
  tipoConsulta: inquiry.tipoConsulta,
  estado: inquiry.estado,
  mensaje: inquiry.mensaje,
  contexto: parseJsonField(inquiry.contexto, null),
  repuestosSeleccionados: parseJsonField(inquiry.repuestosSeleccionados, []),
  informacionManual: parseJsonField(inquiry.informacionManual, null),
  fechaModificacion: inquiry.fechaModificacion
});

const addInquiryInputs = (request, inquiry) => {
  request.input('nombre', sql.NVarChar(200), inquiry.nombre);
  request.input('email', sql.NVarChar(200), inquiry.email);
  request.input('telefono', sql.NVarChar(80), inquiry.telefono);
  request.input('tipoConsulta', sql.NVarChar(150), inquiry.tipoConsulta);
  request.input('estado', sql.NVarChar(50), inquiry.estado);
  request.input('mensaje', sql.NVarChar(4000), inquiry.mensaje);
  request.input('contexto', sql.NVarChar(sql.MAX), inquiry.contexto);
  request.input('repuestosSeleccionados', sql.NVarChar(sql.MAX), inquiry.repuestosSeleccionados);
  request.input('informacionManual', sql.NVarChar(sql.MAX), inquiry.informacionManual);

  return request;
};

export const createInquiry = async (payload) => {
  const inquiry = normalizeInquiryPayload(payload);
  const pool = await getSqlPool();
  const result = await addInquiryInputs(pool.request(), inquiry).query(createInquiryQuery);

  return mapInquiry(result.recordset[0]);
};

export const getAdminInquiries = async () => {
  const pool = await getSqlPool();
  const result = await pool.request().query(allInquiriesQuery);

  return (result.recordset ?? []).map(mapInquiry);
};

export const getAdminInquiryById = async (id) => {
  const inquiryId = parsePositiveInteger(id);

  if (!inquiryId) {
    return null;
  }

  const pool = await getSqlPool();
  const result = await pool.request().input('id', sql.Int, inquiryId).query(inquiryByIdQuery);
  const inquiry = result.recordset?.[0];

  return inquiry ? mapInquiry(inquiry) : null;
};

export const updateAdminInquiryStatus = async (id, status) => {
  const inquiryId = parsePositiveInteger(id);

  if (!inquiryId) {
    return null;
  }

  const nextStatus = normalizeInquiryStatus(status);
  const pool = await getSqlPool();
  const result = await pool.request()
    .input('id', sql.Int, inquiryId)
    .input('estado', sql.NVarChar(50), nextStatus)
    .query(updateInquiryStatusQuery);
  const inquiry = result.recordset?.[0];

  return inquiry ? mapInquiry(inquiry) : null;
};
