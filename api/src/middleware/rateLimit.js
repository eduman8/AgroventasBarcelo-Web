const stores = new Map();

const getClientKey = (request) => request.ip || request.headers['x-forwarded-for'] || request.socket?.remoteAddress || 'unknown';

export const createRateLimit = ({ windowMs, max, message }) => {
  const storeKey = `${windowMs}:${max}:${message}`;
  if (!stores.has(storeKey)) stores.set(storeKey, new Map());
  const requests = stores.get(storeKey);

  return (request, response, next) => {
    const now = Date.now();
    const resetAt = now + windowMs;
    const key = getClientKey(request);
    const current = requests.get(key);

    if (!current || current.resetAt <= now) {
      requests.set(key, { count: 1, resetAt });
      response.setHeader('RateLimit-Limit', String(max));
      response.setHeader('RateLimit-Remaining', String(Math.max(max - 1, 0)));
      response.setHeader('RateLimit-Reset', String(Math.ceil(resetAt / 1000)));
      return next();
    }

    current.count += 1;
    response.setHeader('RateLimit-Limit', String(max));
    response.setHeader('RateLimit-Remaining', String(Math.max(max - current.count, 0)));
    response.setHeader('RateLimit-Reset', String(Math.ceil(current.resetAt / 1000)));

    if (current.count > max) {
      response.setHeader('Retry-After', String(Math.ceil((current.resetAt - now) / 1000)));
      return response.status(429).json({ message });
    }

    return next();
  };
};

setInterval(() => {
  const now = Date.now();
  stores.forEach((requests) => {
    requests.forEach((entry, key) => {
      if (entry.resetAt <= now) requests.delete(key);
    });
  });
}, 60000).unref();
