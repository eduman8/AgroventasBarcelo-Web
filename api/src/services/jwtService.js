import { createHmac, timingSafeEqual } from 'node:crypto';

const tokenTtlSeconds = Number.parseInt(process.env.JWT_EXPIRES_IN_SECONDS || '86400', 10);

const base64UrlEncode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const base64UrlDecode = (value) => JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET no está configurado. Definí JWT_SECRET en el entorno (por ejemplo, JWT_SECRET=change_me_in_production) y reiniciá el backend.');
  }

  return secret;
};

const sign = (input) => createHmac('sha256', getJwtSecret()).update(input).digest('base64url');

export const createAuthToken = ({ userId, email, rol }) => {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    userId,
    email,
    rol,
    iat: now,
    exp: now + (Number.isInteger(tokenTtlSeconds) && tokenTtlSeconds > 0 ? tokenTtlSeconds : 86400)
  };
  const encodedToken = `${base64UrlEncode(header)}.${base64UrlEncode(payload)}`;

  return `${encodedToken}.${sign(encodedToken)}`;
};

export const verifyAuthToken = (token) => {
  const [encodedHeader, encodedPayload, signature] = String(token || '').split('.');

  if (!encodedHeader || !encodedPayload || !signature) {
    throw new Error('Token inválido.');
  }

  const signedContent = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = sign(signedContent);
  const signatureBuffer = Buffer.from(signature, 'base64url');
  const expectedSignatureBuffer = Buffer.from(expectedSignature, 'base64url');

  if (signatureBuffer.length !== expectedSignatureBuffer.length || !timingSafeEqual(signatureBuffer, expectedSignatureBuffer)) {
    throw new Error('Token inválido.');
  }

  const header = base64UrlDecode(encodedHeader);
  const payload = base64UrlDecode(encodedPayload);

  if (header.alg !== 'HS256' || header.typ !== 'JWT') {
    throw new Error('Token inválido.');
  }

  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expirado.');
  }

  return payload;
};
