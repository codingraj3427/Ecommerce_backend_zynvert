const axios = require('axios');
require('dotenv').config();

// Configuration for Shipping Aggregator (e.g., AfterShip, ClickPost, ShipStation)
const SHIPPING_API_KEY = process.env.SHIPPING_API_KEY;
const SHIPPING_API_URL = process.env.SHIPPING_API_URL || 'https://api.aftership.com/v4'; // Example default

// Helper to check if service is enabled
const isEnabled = () => !!SHIPPING_API_KEY;

/**
 * 1. Register a new shipment for tracking
 * Tells the aggregator: "Start tracking this tracking number for me."
 * * @param {string} trackingNumber - The ID from the carrier (e.g. FedEx123)
 * @param {string} carrierCode - The slug for the carrier (e.g. 'fedex', 'bluedart')
 * @param {object} orderDetails - Optional info (orderID, customer email/phone)
 */
exports.registerShipment = async (trackingNumber, carrierCode, orderDetails = {}) => {
  // MOCK MODE: If no API key, just log and return fake success
  if (!isEnabled()) {
    console.log(`🚚 [MOCK SHIPPING] Registered tracking: ${trackingNumber} (${carrierCode}) for Order ${orderDetails.orderId}`);
    return {
      id: `ship_${Date.now()}`,
      tracking_number: trackingNumber,
      slug: carrierCode,
      active: true,
      mock: true
    };
  }

  // REAL MODE: Call External API (Example using AfterShip format)
  try {
    const payload = {
      tracking: {
        slug: carrierCode,
        tracking_number: trackingNumber,
        title: `Order #${orderDetails.orderId}`,
        emails: orderDetails.email ? [orderDetails.email] : [],
        smses: orderDetails.phone ? [orderDetails.phone] : [],
      }
    };

    const response = await axios.post(`${SHIPPING_API_URL}/trackings`, payload, {
      headers: { 'aftership-api-key': SHIPPING_API_KEY, 'Content-Type': 'application/json' }
    });

    return response.data.data.tracking;
  } catch (error) {
    console.error('❌ Shipping Service Error (Register):', error.response?.data || error.message);
    throw new Error('Failed to register shipment tracking');
  }
};

/**
 * 2. Get latest tracking status manually
 * Useful if the webhook hasn't fired or user clicks "Refresh" on UI.
 */
exports.getTrackingStatus = async (trackingNumber, carrierCode) => {
  // MOCK MODE
  if (!isEnabled()) {
    console.log(`🚚 [MOCK SHIPPING] Fetching status for: ${trackingNumber}`);
    return {
      tracking_number: trackingNumber,
      carrier: carrierCode,
      status: 'In Transit',
      checkpoints: [
        { message: 'Shipment created', time: new Date().toISOString() },
        { message: 'Picked up by courier', time: new Date().toISOString() }
      ],
      mock: true
    };
  }

  // REAL MODE
  try {
    const response = await axios.get(`${SHIPPING_API_URL}/trackings/${carrierCode}/${trackingNumber}`, {
      headers: { 'aftership-api-key': SHIPPING_API_KEY }
    });

    return response.data.data.tracking;
  } catch (error) {
    // If not found (404), return null instead of throwing
    if (error.response && error.response.status === 404) {
      return null; 
    }
    console.error('❌ Shipping Service Error (Get):', error.message);
    throw new Error('Failed to fetch tracking status');
  }
};