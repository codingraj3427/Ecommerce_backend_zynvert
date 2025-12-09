// src/middlewares/auditLogMiddleware.js

// You will need a simple AuditLog model to store this data. 
// MongoDB is excellent for logs due to its flexible schema, 
// but we'll use a simple console log for now, assuming future Mongo storage.

/**
 * Middleware to log successful administrative actions.
 * Assumes req.user is set by authMiddleware and res.statusCode is 200/201/204.
 */
const auditLogger = (actionType) => (req, res, next) => {
    // 1. Skip if the request method isn't one we need to audit (POST, PUT, DELETE)
    const auditMethods = ['POST', 'PUT', 'DELETE'];
    if (!auditMethods.includes(req.method)) {
        return next();
    }

    // 2. Log on response finish (i.e., after the route handler is done)
    res.on('finish', () => {
        // We only log successful operations (2xx codes)
        if (res.statusCode >= 200 && res.statusCode < 300) {
            
            // Define the data to log
            const logEntry = {
                timestamp: new Date().toISOString(),
                adminId: req.user ? req.user.id : 'UNKNOWN', // Get ID from authentication layer
                method: req.method,
                route: req.baseUrl + req.path,
                action: actionType,
                statusCode: res.statusCode,
                details: req.body, // Log the input data (CAUTION: don't log passwords!)
                targetId: req.params.id || req.params.productId || req.body.product_id || 'N/A' // ID of the affected resource
            };

            // 3. Output the log
            // In a production environment, this would save to a MongoDB collection
            // or a dedicated logging service (e.g., AWS CloudWatch, Winston, etc.)
            console.log('\n--- AUDIT LOG SUCCESS ---');
            console.log(JSON.stringify(logEntry, null, 2));
            console.log('-------------------------\n');
        }
    });

    next();
};

module.exports = auditLogger;