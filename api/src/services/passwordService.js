import { randomBytes, pbkdf2Sync, timingSafeEqual } from 'node:crypto';

const passwordHashVersion = 'pbkdf2_sha256';
const iterations = 120000;
const keyLength = 32;
const digest = 'sha256';

export const hashPassword = (password) => {
  const salt = randomBytes(16).toString('base64url');
  const derivedKey = pbkdf2Sync(String(password), salt, iterations, keyLength, digest).toString('base64url');

  return `${passwordHashVersion}$${iterations}$${salt}$${derivedKey}`;
};

export const verifyPassword = (password, storedHash) => {
  const [version, storedIterations, salt, storedDerivedKey] = String(storedHash || '').split('$');

  if (version !== passwordHashVersion || !storedIterations || !salt || !storedDerivedKey) {
    return false;
  }

  const parsedIterations = Number.parseInt(storedIterations, 10);

  if (!Number.isInteger(parsedIterations) || parsedIterations <= 0) {
    return false;
  }

  const derivedKey = pbkdf2Sync(String(password), salt, parsedIterations, keyLength, digest);
  const storedKeyBuffer = Buffer.from(storedDerivedKey, 'base64url');

  return storedKeyBuffer.length === derivedKey.length && timingSafeEqual(storedKeyBuffer, derivedKey);
};
