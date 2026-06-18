import { getSqlPool, sql } from '../config/sqlServer.js';
import { ensureUsersTable } from './adminUsersService.js';
import { createAuthToken } from './jwtService.js';
import { verifyPassword } from './passwordService.js';

class AuthValidationError extends Error {
  constructor(message, statusCode = 401) {
    super(message);
    this.name = 'AuthValidationError';
    this.statusCode = statusCode;
  }
}

export { AuthValidationError };

const normalizeText = (value, maxLength) => String(value ?? '').trim().slice(0, maxLength);

const loginUserQuery = `
SELECT TOP (1)
    ID_WebUsuario AS id,
    Nombre AS nombre,
    Email AS email,
    Rol AS rol,
    Estado AS estado,
    PasswordHash AS passwordHash
FROM dbo.WebUsuarios
WHERE Email = @email;
`;

const updateLastAccessQuery = `
UPDATE dbo.WebUsuarios
SET UltimoAcceso = GETDATE(), FechaActualizacion = GETDATE()
WHERE ID_WebUsuario = @id;
`;

export const loginUser = async (payload) => {
  const email = normalizeText(payload?.email, 200).toLowerCase();
  const password = String(payload?.password ?? '');

  if (!email || !password) {
    throw new AuthValidationError('Email y contraseña son requeridos.', 400);
  }

  const pool = await getSqlPool();
  await ensureUsersTable(pool);

  const result = await pool.request()
    .input('email', sql.NVarChar(200), email)
    .query(loginUserQuery);
  const user = result.recordset?.[0];

  if (!user) {
    throw new AuthValidationError('Credenciales inválidas.');
  }

  if (user.estado !== 'Activo') {
    throw new AuthValidationError('El usuario se encuentra inactivo.', 403);
  }

  if (!verifyPassword(password, user.passwordHash)) {
    throw new AuthValidationError('Credenciales inválidas.');
  }

  await pool.request().input('id', sql.Int, user.id).query(updateLastAccessQuery);

  const token = createAuthToken({ userId: user.id, email: user.email, rol: user.rol });

  return {
    id: user.id,
    nombre: user.nombre,
    email: user.email,
    rol: user.rol,
    token
  };
};
