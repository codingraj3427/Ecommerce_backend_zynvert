const express = require('express');
const cors = require('cors');

// Import Routes
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
// const adminRoutes = require('./routes/adminRoutes'); // Uncomment when ready

const requestLogger = require('./middlewares/requestLogger');

const app = express();

// ====================================================================
// 1. MIDDLEWARE
// ====================================================================

// Enable CORS with specific options
app.use(cors({
  origin: 'http://localhost:3000', // Allow your Frontend URL
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allow these HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Allow these headers
  credentials: true // Allow cookies/headers to be sent
}));
// Middleware
app.use(express.json()); // Parse JSON bodies

// Register request logger AFTER express.json so body is available
app.use(requestLogger);

// Route Registration
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
// app.use('/api/admin', adminRoutes); // Uncomment when ready

// Root Route (Health Check)
app.get('/', (req, res) => {
  res.send('API is running...');
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

module.exports = app;