module.exports = (req, res, next) => {
  try {
    const { method, originalUrl } = req;
    const params = req.params || {};
    const query = req.query || {};
    const body = req.body || {};

    const hasParams = Object.keys(params).length > 0;
    const hasQuery = Object.keys(query).length > 0;
    const hasBody = Object.keys(body).length > 0;

    if (hasParams || hasQuery || hasBody) {
      // Redact Authorization header if present
      const headers = { ...(req.headers || {}) };
      if (headers.authorization) {
        headers.authorization = headers.authorization.replace(/(Bearer\s+)(.+)/i, '$1[REDACTED]');
      }

      console.log(`📥 [Request Logger] ${new Date().toISOString()} ${method} ${originalUrl}`);
      if (hasParams) console.log('  params:', JSON.stringify(params));
      if (hasQuery)  console.log('  query: ', JSON.stringify(query));
      if (hasBody)   console.log('  body:  ', JSON.stringify(body));
      console.log('  headers (partial):', JSON.stringify({
        authorization: headers.authorization,
        'content-type': headers['content-type']
      }));
    }
  } catch (err) {
    console.error('Request Logger Error:', err);
  } finally {
    next();
  }
};
