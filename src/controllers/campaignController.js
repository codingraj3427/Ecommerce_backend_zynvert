const nodemailer = require("nodemailer");
const { User, Order } = require("../models/postgres"); // adjust if needed
const { Sequelize } = require("sequelize");

exports.getCustomersForCampaign = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: [
        "user_id",
        "first_name",
        "last_name",
        "email",
        [
          Sequelize.fn("COUNT", Sequelize.col("Orders.order_id")),
          "totalOrders",
        ],
      ],
      include: [
        {
          model: Order,
          attributes: [],
        },
      ],
      group: ["User.user_id"],
    });

    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch customers" });
  }
};

exports.sendEmailCampaign = async (req, res) => {
  const { subject, message, selectedUserIds } = req.body;

  try {
    if (!subject || !message) {
      return res.status(400).json({ error: "Subject and message required" });
    }

    // 🔥 If selected users provided → send only to them
    let users;

    if (selectedUserIds && selectedUserIds.length > 0) {
      users = await User.findAll({
        where: {
          user_id: selectedUserIds,
        },
      });
    } else {
      // Default → send to all
      users = await User.findAll();
    }

    if (!users.length) {
      return res.status(404).json({ error: "No customers found" });
    }

    // 2️⃣ Create transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // 3️⃣ Send emails (parallel for faster sending)
    await Promise.all(
      users.map(async (user) => {
        if (!user.email) return;

        const fullName = `${user.first_name || ""} ${
          user.last_name || ""
        }`.trim();

        return transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: user.email,
          subject: subject,
          html: `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:20px 0;">
    <tr>
      <td align="center">

        <table width="600" cellpadding="0" cellspacing="0" 
          style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(90deg,#4f46e5,#6366f1);padding:25px;text-align:center;color:white;">
              <h1 style="margin:0;font-size:22px;">⚡ Zynvert Technologies</h1>
              <p style="margin:5px 0 0;font-size:14px;opacity:0.9;">
                Powering the Future
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:30px;">
              
              <h3 style="margin-top:0;color:#111827;">
                Hi ${fullName || "Valued Customer"},
              </h3>

              <h2 style="color:#111827;">
                ${subject}
              </h2>

              <p style="color:#374151;font-size:15px;line-height:1.6;">
                ${message}
              </p>

              <div style="text-align:center;margin:30px 0;">
                <a href="http://192.168.1.19:3000"
                  style="
                    background:#4f46e5;
                    color:white;
                    padding:12px 25px;
                    text-decoration:none;
                    border-radius:6px;
                    font-weight:bold;
                    display:inline-block;
                  ">
                  Shop Now
                </a>
              </div>

              <p style="color:#6b7280;font-size:13px;">
                Thank you for being part of our journey.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f3f4f6;padding:20px;text-align:center;font-size:12px;color:#6b7280;">
              © ${new Date().getFullYear()} Zynvert Technologies <br/>
              You received this email because you registered with us.
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
`,
        });
      }),
    );

    return res.json({
      success: true,
      message: `Campaign sent to ${users.length} customers`,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to send campaign" });
  }
};
