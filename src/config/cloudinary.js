// config/cloudinary.js
const cloudinary = require("cloudinary").v2;

// This automatically reads CLOUDINARY_URL from process.env
cloudinary.config({
  secure: true, // forces https urls
});

module.exports = cloudinary;
