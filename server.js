require('dotenv').config();
const app = require('./src/app');
const connectMongoDB = require('./src/config/db.mongo');
const { connectPostgres } = require('./src/config/db.postgres');

const PORT = process.env.PORT || 5000;

// Connect to Databases
const startServer = async () => {
  try {
    // 1. Connect MongoDB
    await connectMongoDB();

    // 2. Connect PostgreSQL
    await connectPostgres();

    // 3. Start Express Server
    app.listen(PORT, () => {
      console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  }
};

startServer();