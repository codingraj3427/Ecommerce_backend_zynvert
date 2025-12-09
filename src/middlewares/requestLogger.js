// src/middlewares/requestLogger.js

/**
 * Middleware to log incoming requests.
 * Logs method, URL, timestamp, and duration for every API call.
 */
const requestLogger = (req, res, next) => {
  const start = process.hrtime();
  const timestamp = new Date().toISOString();

  // Log request details when it arrives
  console.log(`[${timestamp}] Incoming Request: ${req.method} ${req.originalUrl}`);

  // Attach a listener to log response details when the request is finished
  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationInMilliseconds = diff[0] * 1000 + diff[1] / 1e6;

    const logData = {
      timestamp,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${durationInMilliseconds.toFixed(2)}ms`,
      ip: req.ip || req.headers['x-forwarded-for'],
      userAgent: req.get('User-Agent'),
    };

    console.log(
      `[${logData.timestamp}] Response Sent: ${logData.method} ${logData.url} | Status: ${logData.status} | Duration: ${logData.duration}`
    );
  });

  next();
};

module.exports = requestLogger;
