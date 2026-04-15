const express = require("express");
const cors = require("cors");

// Import Routes
const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");
// In src/app.js (or equivalent):
const profileRoutes = require("./routes/profileRoutes");
const adminRoutes = require("./routes/adminRoutes"); // Uncomment when ready
const cartRoutes = require("./routes/cartRoutes");
const paymentRoutes = require("./routes/paymentRoute");
const batteryRoutes = require("./routes/batteryRoute");
const searchRoutes = require("./routes/searchRoutes");
const requestLogger = require("./middlewares/requestLogger");
const reviewRoutes = require("./routes/reviewRoute");
const campaignRoutes = require("./routes/campaignRoute");
const favouriteRoutes = require("./routes/favouriteRoute");
const couponRoutes = require("./routes/couponRoutes");
const pincodeRoutes = require("./routes/pincode");
// Inside server.js or app.js where your other routes are
const warrantyRoutes = require("./routes/warrantyRoutes");
const otpRoutes = require("./routes/otpRoutes");

const app = express();

// ====================================================================
// 1. MIDDLEWARE
// ====================================================================

// Enable CORS with specific options
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://192.168.1.13:3000",
      "https://zynvert-technologies.netlify.app",
      "https://zynventics.com",
    ], // Allow your Frontend URL
    methods: ["GET", "POST", "PUT", "DELETE"], // Allow these HTTP methods
    allowedHeaders: ["Content-Type", "Authorization"], // Allow these headers
    credentials: true, // Allow cookies/headers to be sent
  }),
);
// Middleware
app.use(express.json()); // Parse JSON bodies

// Register request logger AFTER express.json so body is available
app.use(requestLogger);

// Route Registration
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes); // Uncomment when ready
app.use("/api/battery", batteryRoutes);
app.use("/api/send-inquiry", batteryRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/admin/campaign", campaignRoutes);
app.use("/api/favourites", favouriteRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/pincode", pincodeRoutes);
app.use("/api/warranty", warrantyRoutes);
app.use("/api/otp", otpRoutes);

// ====================================================================
// 2. ROUTES
// ====================================================================

// Root Route (Health Check)
app.get("/", (req, res) => {
  res.send("API is running...");
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

module.exports = app;
