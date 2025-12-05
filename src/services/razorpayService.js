// const Razorpay = require('razorpay');
// const crypto = require('crypto');
// require('dotenv').config();

// const razorpay = new Razorpay({
//   key_id: process.env.RAZORPAY_KEY_ID,
//   key_secret: process.env.RAZORPAY_KEY_SECRET,
// });

// exports.createRazorpayOrder = async (amount, currency = 'INR') => {
//   const options = {
//     amount: amount * 100, // Amount in paise
//     currency,
//     receipt: `receipt_${Date.now()}`,
//   };
//   return await razorpay.orders.create(options);
// };

// exports.verifySignature = (orderId, paymentId, signature) => {
//   const generatedSignature = crypto
//     .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
//     .update(orderId + '|' + paymentId)
//     .digest('hex');
//   return generatedSignature === signature;
// };