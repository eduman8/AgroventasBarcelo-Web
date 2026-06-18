import { getSqlPool, sql } from '../config/sqlServer.js';

class AdminUserValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AdminUserValidationError';
  }
}

export { AdminUserValidationError };

export const userRoles = ['Admin', 'Cliente'];
export const userStatuses = ['Activo', 'Inactivo'];

const setupUsersQuery = `
IF NOT EXISTS (
    SELECT 1
    FROM sys.tables t
    INNER JOIN sys.schemas s
        ON s.schema_id = t.schema_id
    WHERE t.name = N'WebUsuarios'
      AND s.name = N'dbo'
)
BEGIN
    CREATE TABLE dbo.WebUsuarios (
        ID_WebUsuario INT IDENTITY(1,1) PRIMARY KEY,
        Nombre NVARCHAR(200) NOT NULL,
        Email NVARCHAR(200) NOT NULL,
        Telefono NVARCHAR(80) NULL,
        Empresa NVARCHAR(200) NULL,
        CUIT NVARCHAR(30) NULL,
        Localidad NVARCHAR(150) NULL,
        Cargo NVARCHAR(150) NULL,
        Rol NVARCHAR(50) NOT NULL,
        Estado NVARCHAR(50) NOT NULL,
        PasswordHash NVARCHAR(255) NULL,
        UltimoAcceso DATETIME NULL,
        FechaCreacion DATETIME NOT NULL DEFAULT GETDATE(),
        FechaActualizacion DATETIME NULL,
        CONSTRAINT CK_WebUsuarios_Rol CHECK (Rol IN (N'Admin', N'Cliente')),
        CONSTRAINT CK_WebUsuarios_Estado CHECK (Estado IN (N'Activo', N'Inactivo'))
    );
END;

IF COL_LENGTH(N'dbo.WebUsuarios', N'PasswordHash') IS NULL
BEGIN
    ALTER TABLE dbo.WebUsuarios ADD PasswordHash NVARCHAR(255) NULL;
END;

IF COL_LENGTH(N'dbo.WebUsuarios', N'UltimoAcceso') IS NULL
BEGIN
    ALTER TABLE dbo.WebUsuarios ADD UltimoAcceso DATETIME NULL;
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'UX_WebUsuarios_Email'
      AND object_id = OBJECT_ID(N'dbo.WebUsuarios')
)
AND NOT EXISTS (
    SELECT 1
    FROM dbo.WebUsuarios
    GROUP BY Email
    HAVING COUNT(1) > 1
)
BEGIN
    CREATE UNIQUE INDEX UX_WebUsuarios_Email
    ON dbo.WebUsuarios (Email);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_WebUsuarios_Estado_Rol_FechaCreacion'
      AND object_id = OBJECT_ID(N'dbo.WebUsuarios')
)
BEGIN
    CREATE INDEX IX_WebUsuarios_Estado_Rol_FechaCreacion
    ON dbo.WebUsuarios (Estado, Rol, FechaCreacion DESC);
END;
`;

const userFieldsSelect = `
    ID_WebUsuario AS id,
    Nombre AS nombre,
    Email AS email,
    Telefono AS telefono,
    Empresa AS empresa,
    CUIT AS cuit,
    Localidad AS localidad,
    Cargo AS cargo,
    Rol AS rol,
    Estado AS estado,
    UltimoAcceso AS ultimoAcceso,
    FechaCreacion AS fechaCreacion,
    FechaActualizacion AS fechaActualizacion
`;

const allUsersQuery = `
SELECT${userFieldsSelect}
FROM dbo.WebUsuarios
ORDER BY FechaCreacion DESC, ID_WebUsuario DESC;
`;

const userByIdQuery = `
SELECT TOP (1)${userFieldsSelect}
FROM dbo.WebUsuarios
WHERE ID_WebUsuario = @id;
`;

const userByEmailQuery = `
SELECT TOP (1)${userFieldsSelect}
FROM dbo.WebUsuarios
WHERE Email = @email;
`;

const createUserQuery = `
INSERT INTO dbo.WebUsuarios (
    Nombre,
    Email,
    Telefono,
    Empresa,
    CUIT,
    Localidad,
    Cargo,
    Rol,
    Estado,
    PasswordHash
)
OUTPUT${userFieldsSelect.replaceAll('    ', '    INSERTED.')}
VALUES (
    @nombre,
    @email,
    @telefono,
    @empresa,
    @cuit,
    @localidad,
    @cargo,
    @rol,
    @estado,
    @passwordHash
);
`;

const updateUserStatusQuery = `
UPDATE dbo.WebUsuarios
SET
    Estado = @estado,
    FechaActualizacion = GETDATE()
OUTPUT${userFieldsSelect.replaceAll('    ', '    INSERTED.')}
WHERE ID_WebUsuario = @id;
`;

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

const statusAliases = new Map([
  ['activo', 'Activo'],
  ['activa', 'Activo'],
  ['inactivo', 'Inactivo'],
  ['inactiva', 'Inactivo']
]);

export const normalizeUserStatus = (value) => {
  const normalizedValue = normalizeText(value, 50);
  const normalizedStatus = statusAliases.get(normalizedValue.toLocaleLowerCase('es-AR')) ?? normalizedValue;

  if (!userStatuses.includes(normalizedStatus)) {
    throw new AdminUserValidationError('El estado debe ser Activo o Inactivo.');
  }

  return normalizedStatus;
};

const mapUser = (user) => ({
  id: user.id,
  nombre: user.nombre,
  email: user.email,
  telefono: user.telefono,
  empresa: user.empresa,
  cuit: user.cuit,
  localidad: user.localidad,
  cargo: user.cargo,
  rol: user.rol,
  estado: user.estado,
  ultimoAcceso: user.ultimoAcceso,
  fechaCreacion: user.fechaCreacion,
  fechaActualizacion: user.fechaActualizacion
});

export const ensureUsersTable = async (pool) => {
  await pool.request().query(setupUsersQuery);
};

const addUserInputs = (request, user) => {
  request.input('nombre', sql.NVarChar(200), user.nombre);
  request.input('email', sql.NVarChar(200), user.email);
  request.input('telefono', sql.NVarChar(80), user.telefono);
  request.input('empresa', sql.NVarChar(200), user.empresa);
  request.input('cuit', sql.NVarChar(30), user.cuit);
  request.input('localidad', sql.NVarChar(150), user.localidad);
  request.input('cargo', sql.NVarChar(150), user.cargo);
  request.input('rol', sql.NVarChar(50), user.rol);
  request.input('estado', sql.NVarChar(50), user.estado);
  request.input('passwordHash', sql.NVarChar(255), user.passwordHash ?? null);

  return request;
};

export const findUserByEmail = async (email, pool) => {
  const normalizedEmail = normalizeText(email, 200).toLowerCase();

  if (!normalizedEmail) {
    return null;
  }

  const currentPool = pool ?? await getSqlPool();
  await ensureUsersTable(currentPool);

  const result = await currentPool.request()
    .input('email', sql.NVarChar(200), normalizedEmail)
    .query(userByEmailQuery);
  const user = result.recordset?.[0];

  return user ? mapUser(user) : null;
};

export const createClientUserFromAccessRequest = async (accessRequest, pool) => {
  const currentPool = pool ?? await getSqlPool();
  await ensureUsersTable(currentPool);

  const existingUser = await findUserByEmail(accessRequest.email, currentPool);

  if (existingUser) {
    return {
      usuario: existingUser,
      usuarioCreado: false,
      mensaje: 'El usuario ya existía y no fue duplicado.'
    };
  }

  const user = {
    nombre: normalizeText(accessRequest.nombre, 200),
    email: normalizeText(accessRequest.email, 200).toLowerCase(),
    telefono: normalizeText(accessRequest.telefono, 80) || null,
    empresa: normalizeText(accessRequest.empresa, 200) || null,
    cuit: normalizeText(accessRequest.cuit, 30) || null,
    localidad: normalizeText(accessRequest.localidad, 150) || null,
    cargo: normalizeText(accessRequest.cargo, 150) || null,
    rol: 'Cliente',
    estado: 'Activo',
    passwordHash: accessRequest.passwordHash ?? null
  };

  const result = await addUserInputs(currentPool.request(), user).query(createUserQuery);

  return {
    usuario: mapUser(result.recordset[0]),
    usuarioCreado: true,
    mensaje: 'Usuario cliente creado correctamente.'
  };
};

export const getAdminUsers = async () => {
  const pool = await getSqlPool();
  await ensureUsersTable(pool);

  const result = await pool.request().query(allUsersQuery);

  return (result.recordset ?? []).map(mapUser);
};

export const getAdminUserById = async (id) => {
  const userId = parsePositiveInteger(id);

  if (!userId) {
    return null;
  }

  const pool = await getSqlPool();
  await ensureUsersTable(pool);

  const result = await pool.request().input('id', sql.Int, userId).query(userByIdQuery);
  const user = result.recordset?.[0];

  return user ? mapUser(user) : null;
};

export const updateAdminUserStatus = async (id, status) => {
  const userId = parsePositiveInteger(id);

  if (!userId) {
    return null;
  }

  const nextStatus = normalizeUserStatus(status);
  const pool = await getSqlPool();
  await ensureUsersTable(pool);

  const result = await pool.request()
    .input('id', sql.Int, userId)
    .input('estado', sql.NVarChar(50), nextStatus)
    .query(updateUserStatusQuery);
  const user = result.recordset?.[0];

  return user ? mapUser(user) : null;
};

export const setupUsers = async () => {
  const pool = await getSqlPool();
  await ensureUsersTable(pool);
};
