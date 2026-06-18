import { getSqlPool, sql } from '../config/sqlServer.js';
import { createClientUserFromAccessRequest, ensureUsersTable } from './adminUsersService.js';
import { hashPassword } from './passwordService.js';

class AccessRequestValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AccessRequestValidationError';
  }
}

export { AccessRequestValidationError };

export const accessRequestStatuses = ['Pendiente', 'Aprobado', 'Rechazado'];

const setupAccessRequestsQuery = `
IF NOT EXISTS (
    SELECT 1
    FROM sys.tables t
    INNER JOIN sys.schemas s
        ON s.schema_id = t.schema_id
    WHERE t.name = N'WebSolicitudesAcceso'
      AND s.name = N'dbo'
)
BEGIN
    CREATE TABLE dbo.WebSolicitudesAcceso (
        ID_WebSolicitudAcceso INT IDENTITY(1,1) PRIMARY KEY,
        Nombre NVARCHAR(200) NOT NULL,
        Email NVARCHAR(200) NOT NULL,
        Telefono NVARCHAR(80) NOT NULL,
        Empresa NVARCHAR(200) NOT NULL,
        CUIT NVARCHAR(30) NOT NULL,
        Localidad NVARCHAR(150) NOT NULL,
        Cargo NVARCHAR(150) NULL,
        PasswordHash NVARCHAR(255) NULL,
        Estado NVARCHAR(50) NOT NULL DEFAULT N'Pendiente',
        FechaCreacion DATETIME NOT NULL DEFAULT GETDATE(),
        FechaActualizacion DATETIME NULL,
        CONSTRAINT CK_WebSolicitudesAcceso_Estado CHECK (Estado IN (N'Pendiente', N'Aprobado', N'Rechazado'))
    );
END;

IF COL_LENGTH(N'dbo.WebSolicitudesAcceso', N'PasswordHash') IS NULL
BEGIN
    ALTER TABLE dbo.WebSolicitudesAcceso ADD PasswordHash NVARCHAR(255) NULL;
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_WebSolicitudesAcceso_Estado_FechaCreacion'
      AND object_id = OBJECT_ID(N'dbo.WebSolicitudesAcceso')
)
BEGIN
    CREATE INDEX IX_WebSolicitudesAcceso_Estado_FechaCreacion
    ON dbo.WebSolicitudesAcceso (Estado, FechaCreacion DESC);
END;
`;

const accessRequestFieldsSelect = `
    ID_WebSolicitudAcceso AS id,
    Nombre AS nombre,
    Email AS email,
    Telefono AS telefono,
    Empresa AS empresa,
    CUIT AS cuit,
    Localidad AS localidad,
    Cargo AS cargo,
    Estado AS estado,
    PasswordHash AS passwordHash,
    FechaCreacion AS fechaCreacion,
    FechaActualizacion AS fechaActualizacion
`;

const createAccessRequestQuery = `
INSERT INTO dbo.WebSolicitudesAcceso (
    Nombre,
    Email,
    Telefono,
    Empresa,
    CUIT,
    Localidad,
    Cargo,
    PasswordHash,
    Estado
)
OUTPUT${accessRequestFieldsSelect.replaceAll('    ', '    INSERTED.')}
VALUES (
    @nombre,
    @email,
    @telefono,
    @empresa,
    @cuit,
    @localidad,
    @cargo,
    @passwordHash,
    @estado
);
`;

const allAccessRequestsQuery = `
SELECT${accessRequestFieldsSelect}
FROM dbo.WebSolicitudesAcceso
ORDER BY FechaCreacion DESC, ID_WebSolicitudAcceso DESC;
`;

const accessRequestByIdQuery = `
SELECT TOP (1)${accessRequestFieldsSelect}
FROM dbo.WebSolicitudesAcceso
WHERE ID_WebSolicitudAcceso = @id;
`;

const updateAccessRequestStatusQuery = `
UPDATE dbo.WebSolicitudesAcceso
SET
    Estado = @estado,
    FechaActualizacion = GETDATE()
OUTPUT${accessRequestFieldsSelect.replaceAll('    ', '    INSERTED.')}
WHERE ID_WebSolicitudAcceso = @id;
`;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const statusAliases = new Map([
  ['pendiente', 'Pendiente'],
  ['aprobado', 'Aprobado'],
  ['aprobada', 'Aprobado'],
  ['rechazado', 'Rechazado'],
  ['rechazada', 'Rechazado']
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

const normalizeAccessRequestPayload = (payload) => {
  const nombre = normalizeText(payload?.Nombre ?? payload?.nombre, 200);
  const email = normalizeText(payload?.Email ?? payload?.email, 200).toLowerCase();
  const telefono = normalizeText(payload?.Telefono ?? payload?.telefono, 80);
  const empresa = normalizeText(payload?.Empresa ?? payload?.empresa, 200);
  const cuit = normalizeText(payload?.CUIT ?? payload?.cuit, 30);
  const localidad = normalizeText(payload?.Localidad ?? payload?.localidad, 150);
  const cargo = normalizeText(payload?.Cargo ?? payload?.cargo, 150);
  const password = String(payload?.Password ?? payload?.password ?? '');

  if (!nombre) {
    throw new AccessRequestValidationError('El nombre es requerido.');
  }

  if (!email || !emailPattern.test(email)) {
    throw new AccessRequestValidationError('El email es requerido y debe ser válido.');
  }

  if (!telefono) {
    throw new AccessRequestValidationError('El teléfono es requerido.');
  }

  if (!empresa) {
    throw new AccessRequestValidationError('La empresa es requerida.');
  }

  if (!cuit) {
    throw new AccessRequestValidationError('El CUIT es requerido.');
  }

  if (!localidad) {
    throw new AccessRequestValidationError('La localidad es requerida.');
  }

  if (password.length < 8) {
    throw new AccessRequestValidationError('La contraseña debe tener al menos 8 caracteres.');
  }

  return {
    nombre,
    email,
    telefono,
    empresa,
    cuit,
    localidad,
    cargo: cargo || null,
    passwordHash: hashPassword(password),
    estado: normalizeAccessRequestStatus('Pendiente')
  };
};

export const normalizeAccessRequestStatus = (value) => {
  const normalizedValue = normalizeText(value, 50);
  const normalizedStatus = statusAliases.get(normalizedValue.toLocaleLowerCase('es-AR')) ?? normalizedValue;

  if (!accessRequestStatuses.includes(normalizedStatus)) {
    throw new AccessRequestValidationError('El estado debe ser Pendiente, Aprobado o Rechazado.');
  }

  return normalizedStatus;
};

const mapAccessRequest = (accessRequest) => ({
  id: accessRequest.id,
  nombre: accessRequest.nombre,
  email: accessRequest.email,
  telefono: accessRequest.telefono,
  empresa: accessRequest.empresa,
  cuit: accessRequest.cuit,
  localidad: accessRequest.localidad,
  cargo: accessRequest.cargo,
  estado: accessRequest.estado,
  fechaCreacion: accessRequest.fechaCreacion,
  fechaActualizacion: accessRequest.fechaActualizacion
});

const ensureAccessRequestsTable = async (pool) => {
  await pool.request().query(setupAccessRequestsQuery);
  await ensureUsersTable(pool);
};

const addAccessRequestInputs = (request, accessRequest) => {
  request.input('nombre', sql.NVarChar(200), accessRequest.nombre);
  request.input('email', sql.NVarChar(200), accessRequest.email);
  request.input('telefono', sql.NVarChar(80), accessRequest.telefono);
  request.input('empresa', sql.NVarChar(200), accessRequest.empresa);
  request.input('cuit', sql.NVarChar(30), accessRequest.cuit);
  request.input('localidad', sql.NVarChar(150), accessRequest.localidad);
  request.input('cargo', sql.NVarChar(150), accessRequest.cargo);
  request.input('passwordHash', sql.NVarChar(255), accessRequest.passwordHash);
  request.input('estado', sql.NVarChar(50), accessRequest.estado);

  return request;
};

export const createAccessRequest = async (payload) => {
  const accessRequest = normalizeAccessRequestPayload(payload);
  const pool = await getSqlPool();

  await ensureAccessRequestsTable(pool);

  const result = await addAccessRequestInputs(pool.request(), accessRequest).query(createAccessRequestQuery);

  return mapAccessRequest(result.recordset[0]);
};

export const getAdminAccessRequests = async () => {
  const pool = await getSqlPool();

  await ensureAccessRequestsTable(pool);

  const result = await pool.request().query(allAccessRequestsQuery);

  return (result.recordset ?? []).map(mapAccessRequest);
};

export const getAdminAccessRequestById = async (id) => {
  const accessRequestId = parsePositiveInteger(id);

  if (!accessRequestId) {
    return null;
  }

  const pool = await getSqlPool();

  await ensureAccessRequestsTable(pool);

  const result = await pool.request().input('id', sql.Int, accessRequestId).query(accessRequestByIdQuery);
  const accessRequest = result.recordset?.[0];

  return accessRequest ? mapAccessRequest(accessRequest) : null;
};

export const updateAdminAccessRequestStatus = async (id, status) => {
  const accessRequestId = parsePositiveInteger(id);

  if (!accessRequestId) {
    return null;
  }

  const nextStatus = normalizeAccessRequestStatus(status);
  const pool = await getSqlPool();

  await ensureAccessRequestsTable(pool);

  const result = await pool.request()
    .input('id', sql.Int, accessRequestId)
    .input('estado', sql.NVarChar(50), nextStatus)
    .query(updateAccessRequestStatusQuery);
  const accessRequest = result.recordset?.[0];

  if (!accessRequest) {
    return null;
  }

  const mappedAccessRequest = mapAccessRequest(accessRequest);
  const accessRequestForUserCreation = {
    ...mappedAccessRequest,
    passwordHash: accessRequest.passwordHash
  };

  if (nextStatus !== 'Aprobado') {
    return mappedAccessRequest;
  }

  const userCreationResult = await createClientUserFromAccessRequest(accessRequestForUserCreation, pool);

  return {
    ...mappedAccessRequest,
    usuario: userCreationResult.usuario,
    usuarioCreado: userCreationResult.usuarioCreado,
    mensajeUsuario: userCreationResult.mensaje
  };
};

export const setupAccessRequests = async () => {
  const pool = await getSqlPool();

  await ensureAccessRequestsTable(pool);
};
