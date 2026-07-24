const truthyValues = new Set(['true', '1', 'yes', 'y']);

export const parseBooleanEnv = (value, defaultValue = false) => {
  if (value === undefined || value === '') return defaultValue;
  return truthyValues.has(String(value).trim().toLowerCase());
};

export const parseListEnv = (value) => String(value || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const requiredInProduction = [
  'CLIENT_ORIGIN',
  'JWT_SECRET',
  'DB_SERVER',
  'DB_DATABASE',
  'DB_USER',
  'DB_PASSWORD'
];

const positiveIntegerVars = [
  'PORT',
  'JWT_EXPIRES_IN_SECONDS',
  'API_RATE_LIMIT_WINDOW_MS',
  'API_RATE_LIMIT_MAX',
  'AUTH_RATE_LIMIT_WINDOW_MS',
  'AUTH_RATE_LIMIT_MAX',
  'JSON_BODY_LIMIT_KB',
  'MACHINE_IMAGE_MAX_BYTES',
  'MANUALES_VISUALES_MAX_PDF_BYTES',
  'MANUALES_VISUALES_PDF_DPI',
  'SMTP_PORT'
];

export const validateEnvironment = () => {
  const errors = [];
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    requiredInProduction.forEach((name) => {
      if (!process.env[name]) errors.push(`${name} es obligatoria en producción.`);
    });

    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
      errors.push('JWT_SECRET debe tener al menos 32 caracteres en producción.');
    }
  }

  positiveIntegerVars.forEach((name) => {
    const rawValue = process.env[name];
    if (rawValue === undefined || rawValue === '') return;

    const value = Number.parseInt(rawValue, 10);
    if (!Number.isInteger(value) || value <= 0 || String(value) !== String(rawValue).trim()) {
      errors.push(`${name} debe ser un entero positivo.`);
    }
  });

  if (process.env.CORS_CREDENTIALS && !['true', 'false', '1', '0', 'yes', 'no', 'y', 'n'].includes(process.env.CORS_CREDENTIALS.trim().toLowerCase())) {
    errors.push('CORS_CREDENTIALS debe ser true o false.');
  }

  if (errors.length > 0) {
    throw new Error(`Configuración de entorno inválida:\n- ${errors.join('\n- ')}`);
  }
};
