const axios = require("axios");

let cachedToken = null;
let tokenExpiry = null;

// 🔐 Get Token
async function getToken() {
  if (cachedToken && tokenExpiry > Date.now()) {
    return cachedToken;
  }

  const res = await axios.post(
    "https://apiv2.shiprocket.in/v1/external/auth/login",
    {
      email: process.env.SHIPROCKET_EMAIL,
      password: process.env.SHIPROCKET_PASSWORD
    }
  );

  cachedToken = res.data.token;

  // Token valid ~240 hours → set safe expiry
  tokenExpiry = Date.now() + (23 * 60 * 60 * 1000);

  return cachedToken;
}

// 📦 Check Serviceability
async function checkServiceability(pincode,weight) {
  try {
    const token = await getToken();

    const res = await axios.get(
      "https://apiv2.shiprocket.in/v1/external/courier/serviceability/",
      {
        params: {
          pickup_postcode: "743273", // your location
          delivery_postcode: pincode,
          weight: weight || 0.5, // default weight if not provided
          cod: 1
        },
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const couriers = res.data?.data?.available_courier_companies;

    if (couriers && couriers.length > 0) {
      return {
        success: true,
        eta: couriers[0].etd,
        courier: couriers[0].courier_name
      };
    }

    return { success: false };

  } catch (error) {
    console.error("Shiprocket Error:", error.message);
    return { success: false };
  }
}

module.exports = { checkServiceability };