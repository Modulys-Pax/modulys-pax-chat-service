module.exports = {
  service: {
    host: process.env.PAX_CHAT_HOST || '0.0.0.0',
    port: parseInt(process.env.PAX_CHAT_PORT || '9001', 10)
  },
  adminApi: {
    url: (process.env.PAX_ADMIN_API_URL || 'http://localhost:3000/api/admin').replace(/\/$/, ''),
    serviceKey: process.env.PAX_SERVICE_KEY || ''
  },
  tenantJwt: {
    secret: process.env.PAX_JWT_SECRET || ''
  },
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    prettyPrint: process.env.NODE_ENV !== 'production'
  }
};
