import { getSqlPool, sql } from '../config/sqlServer.js';
import { ensureUsersTable } from '../services/adminUsersService.js';
import { verifyAuthToken } from '../services/jwtService.js';

export const requireAuth = (request, response, next) => {
  const authorizationHeader = request.get('Authorization') || '';
  const [scheme, token] = authorizationHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    response.status(401).json({ status: 'error', message: 'Token requerido.' });
    return;
  }

  try {
    request.auth = verifyAuthToken(token);
    next();
  } catch {
    response.status(401).json({ status: 'error', message: 'Token inválido o expirado.' });
  }
};


export const requireActiveUser = async (request, response, next) => {
  try {
    const userId = Number(request.auth?.userId);

    if (!Number.isInteger(userId) || userId <= 0) {
      response.status(401).json({ status: 'error', message: 'Token inválido o expirado.' });
      return;
    }

    const pool = await getSqlPool();
    await ensureUsersTable(pool);

    const result = await pool.request()
      .input('id', sql.Int, userId)
      .query(`
        SELECT TOP (1)
          ID_WebUsuario AS id,
          Email AS email,
          Rol AS rol,
          Estado AS estado
        FROM dbo.WebUsuarios
        WHERE ID_WebUsuario = @id;
      `);
    const user = result.recordset?.[0];

    if (!user || user.estado !== 'Activo') {
      response.status(403).json({ status: 'error', message: 'El usuario se encuentra inactivo.' });
      return;
    }

    request.auth.user = {
      id: user.id,
      email: user.email,
      rol: user.rol,
      estado: user.estado
    };
    next();
  } catch (error) {
    next(error);
  }
};
