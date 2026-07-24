export const securityHeaders = (request, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'SAMEORIGIN');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('X-DNS-Prefetch-Control', 'off');
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  response.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  response.setHeader('Origin-Agent-Cluster', '?1');

  if (request.secure || request.headers['x-forwarded-proto'] === 'https') {
    response.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }

  next();
};
