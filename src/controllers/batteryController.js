const nodemailer = require("nodemailer");

// ==========================================
// 🔋 BATTERY COST CALCULATION
// ==========================================
exports.calculateBatteryCost = (req, res) => {
  try {
    const {
      batteryType,
      cellType,
      voltage,
      capacityAh,

      // NEW FIELDS
      applicationType,
      outerMaterial,
      buildQuality,
    } = req.body;

    // -------------------------------
    // 🔧 VALIDATION
    // -------------------------------
    if (!batteryType || !cellType || !voltage || !capacityAh) {
      return res.status(400).json({
        error: "Missing required fields",
      });
    }

    // -------------------------------
    // 🔋 CELL CONFIG DATA
    // -------------------------------
    const cellVoltages = {
      18650: 3.7,
      32700: 3.2,
      32140: 3.2,
    };

    const cellCapacityAh = {
      18650: 2.6,
      32700: 6,
      32140: 12,
    };

    const cellPrices = {
      18650: 120,
      32700: 180,
      32140: 280,
    };

    const cellVoltage = cellVoltages[cellType];
    const cellAh = cellCapacityAh[cellType];
    const cellPrice = cellPrices[cellType];

    if (!cellVoltage || !cellAh || !cellPrice) {
      return res.status(400).json({
        error: "Invalid cell type",
      });
    }

    // -------------------------------
    // 🔢 CALCULATIONS
    // -------------------------------
    const series = Math.round(voltage / cellVoltage);
    const parallel = Math.ceil(capacityAh / cellAh);

    const totalCells = series * parallel;
    let totalCost = totalCells * cellPrice;

    // -------------------------------
    // ⚡ APPLICATION MULTIPLIER
    // -------------------------------
    const applicationMultiplier = {
      inverter: 1.0,
      solar: 1.1,
      ebike: 1.2,
    };

    totalCost *= applicationMultiplier[applicationType] || 1;

    // -------------------------------
    // 🧱 OUTER MATERIAL COST
    // -------------------------------
    if (outerMaterial === "metal") {
      totalCost += 1500;
    } else if (outerMaterial === "epoxy") {
      totalCost += 700;
    }

    // -------------------------------
    // ⭐ BUILD QUALITY
    // -------------------------------
    if (buildQuality === "premium") {
      totalCost *= 1.25;
    }

    // Round final cost
    totalCost = Math.round(totalCost);

    // -------------------------------
    // 📦 RESPONSE
    // -------------------------------
    res.json({
      success: true,
      series,
      parallel,
      totalCells,
      totalCost,
      batteryType,
      cellType,
      voltage,
      capacityAh,
      applicationType,
      outerMaterial,
      buildQuality,
    });
  } catch (err) {
    console.error("Calculation Error:", err);
    res.status(500).json({
      success: false,
      error: "Battery cost calculation failed",
    });
  }
};

// ==========================================
// 📩 SEND INQUIRY EMAIL
// ==========================================
exports.sendInquiry = async (req, res) => {
  try {
    const { userEmail, userName, specs, estimation } = req.body;

    if (!userEmail || !specs || !estimation) {
      return res.status(400).json({
        success: false,
        message: "Missing required data",
      });
    }

    // -------------------------------
    // 📧 EMAIL CONFIG
    // -------------------------------
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const adminEmails = [
      "biswajit05101963@gmail.com",
      "mailtoankan2001@gmail.com",
    ];

    // -------------------------------
    // 📨 EMAIL CONTENT
    // -------------------------------
    const mailOptions = {
      from: `"Zynvert Battery Estimator" <${process.env.EMAIL_USER}>`,
      to: adminEmails.join(", "),
      replyTo: userEmail,
      subject: `🔋 New Battery Build Request from ${userName}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2 style="color: #1d4ed8;">New Battery Build Inquiry</h2>
          
          <p><strong>Customer Name:</strong> ${userName}</p>
          <p><strong>Customer Email:</strong> ${userEmail}</p>

          <hr style="margin: 20px 0;" />

          <h3>📋 Battery Requirements</h3>
          <ul>
            <li><strong>Battery Type:</strong> ${specs.batteryType}</li>
            <li><strong>Cell Type:</strong> ${specs.cellType}</li>
            <li><strong>Voltage:</strong> ${specs.voltage}V</li>
            <li><strong>Capacity:</strong> ${specs.capacityAh}Ah</li>
          </ul>

          <h3>⚙️ Configuration</h3>
          <ul>
            <li><strong>Application:</strong> ${specs.applicationType}</li>
            <li><strong>Outer Material:</strong> ${specs.outerMaterial}</li>
            <li><strong>Build Quality:</strong> ${specs.buildQuality}</li>
          </ul>

          <h3>⚡ Estimated Build</h3>
          <ul>
            <li><strong>Series:</strong> ${estimation.series}S</li>
            <li><strong>Parallel:</strong> ${estimation.parallel}P</li>
            <li><strong>Total Cells:</strong> ${estimation.totalCells}</li>
            <li><strong>Estimated Cost:</strong> ₹${estimation.totalCost}</li>
          </ul>

          <hr style="margin: 20px 0;" />
          <p style="font-size: 12px; color: #777;">
            Generated from Zynvert Battery Estimator
          </p>
        </div>
      `,
    };

    // -------------------------------
    // 🚀 SEND EMAIL
    // -------------------------------
    await transporter.sendMail(mailOptions);

    res.status(200).json({
      success: true,
      message: "Inquiry sent successfully!",
    });
  } catch (error) {
    console.error("Email Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send email.",
    });
  }
};
