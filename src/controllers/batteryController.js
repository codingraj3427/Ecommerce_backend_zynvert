const nodemailer = require("nodemailer");
// controllers/batteryEstimator.controller.js

exports.calculateBatteryCost = (req, res) => {
  try {
    const { batteryType, cellType, voltage, capacityAh } = req.body;

    // Nominal voltages
    const cellVoltages = {
      "18650": 3.7,
      "32700": 3.2,
      "32140": 3.2
    };

    // Cell capacities (example values, replace with real)
    const cellCapacityAh = {
      "18650": 2.6,
      "32700": 6,
      "32140": 12
    };

    // Cell prices (edit these)
    const cellPrices = {
      "18650": 120,
      "32700": 180,
      "32140": 280
    };

    const cellVoltage = cellVoltages[cellType];
    const cellAh = cellCapacityAh[cellType];
    const cellPrice = cellPrices[cellType];

    // Series and parallel
    const series = Math.round(voltage / cellVoltage);
    const parallel = Math.ceil(capacityAh / cellAh);

    const totalCells = series * parallel;
    const totalCost = totalCells * cellPrice;

    res.json({
      series,
      parallel,
      totalCells,
      totalCost,
      cellType,
      batteryType,
      voltage,
      capacityAh
    });
  } catch (err) {
    res.status(500).json({ error: "Battery cost calculation failed" });
  }
};


// --- ⭐️ NEW: Send Inquiry Email Logic ---
exports.sendInquiry = async (req, res) => {
  try {
    const { userEmail, userName,  specs, estimation } = req.body;

    // 1. Configure the Email Transporter (Sender Details)
    // ⚠️ RECOMMENDATION: Use Environment Variables for these credentials!
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER, // e.g., "your-company-email@gmail.com"
        pass: process.env.EMAIL_PASS, // e.g., "your-gmail-app-password"
      },
    });
     const adminemails=['biswajit05101963@gmail.com','mailtoankan2001@gmail.com'];
    // 2. Format the Email Body
    const mailOptions = {
      from: `"Zynvert Battery Estimator" <${process.env.EMAIL_USER}>`, // Sender
      to: adminemails.join(', '), // Admin receives the inquiry
      replyTo: userEmail, // So Admin can reply directly to the user
      subject: `🔋 New Battery Build Request from ${userName}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2 style="color: #1d4ed8;">New Battery Build Inquiry</h2>
          <p><strong>Customer Name:</strong> ${userName}</p>
          <p><strong>Customer Email:</strong> ${userEmail}</p>
          
          <hr style="border: 1px solid #eee; margin: 20px 0;" />
          
          <h3 style="color: #333;">📋 User Requirements</h3>
          <ul style="line-height: 1.6;">
            <li><strong>Battery Type:</strong> ${specs.batteryType}</li>
            <li><strong>Cell Type:</strong> ${specs.cellType}</li>
            <li><strong>Voltage:</strong> ${specs.voltage}V</li>
            <li><strong>Capacity:</strong> ${specs.capacityAh}Ah</li>
          </ul>

          <h3 style="color: #333;">⚡ Estimated Build</h3>
          <ul style="line-height: 1.6;">
            <li><strong>Series Configuration:</strong> ${estimation.series}S</li>
            <li><strong>Parallel Configuration:</strong> ${estimation.parallel}P</li>
            <li><strong>Total Cells Required:</strong> ${estimation.totalCells}</li>
            <li><strong>Estimated Cost:</strong> <span style="color: #16a34a; font-weight: bold;">₹${estimation.totalCost}</span></li>
          </ul>

          <hr style="border: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #777;">This email was generated automatically from the Zynvert Battery Estimator.</p>
        </div>
      `,
    };

    // 3. Send the Email
    await transporter.sendMail(mailOptions);

    res.status(200).json({ success: true, message: "Inquiry sent successfully!" });

  } catch (error) {
    console.error("Email Error:", error);
    res.status(500).json({ success: false, message: "Failed to send email." });
  }
};