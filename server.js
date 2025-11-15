import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();

// --- CORS: allow your frontend origin (for debugging you can allow all) ---
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "*";
app.use(
  cors({
    origin: FRONTEND_ORIGIN, // in production set this to "https://your-frontend-domain"
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
app.options("*", cors()); // respond to preflight

app.use(express.json());

// --- Logging middleware ---
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - body:`, req.body);
  next();
});

// --- Create transporter once and verify on startup ---
let transporter;
async function initTransporter() {
  try {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // use App Password for Gmail + 2FA
      },
      // optional timeouts
      socketTimeout: 15_000,
      greetingTimeout: 10_000,
      connectionTimeout: 10_000,
      tls: {
        rejectUnauthorized: false, // avoid TLS issues on some hosts — optional
      },
    });

    // verify connection configuration (throws on error)
    await transporter.verify();
    console.log("✅ Nodemailer transporter verified and ready");
  } catch (err) {
    console.error("❌ Failed to verify transporter:", err);
    // keep going — we'll still attempt to send, but log will show verification failure
  }
}
await initTransporter();

// --- helper: sendMail with timeout ---
function sendMailWithTimeout(mailOptions, timeoutMs = 15000) {
  const sendPromise = transporter.sendMail(mailOptions);
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("sendMail timeout")), timeoutMs)
  );
  return Promise.race([sendPromise, timeoutPromise]);
}

// ✅ Contact API (POST)
app.post("/send", async (req, res) => {
  const { name, email, message } = req.body ?? {};

  if (!name || !email || !message) {
    return res.status(400).json({ success: false, error: "All fields required" });
  }

  if (!transporter) {
    console.error("No transporter available (transporter not initialized)");
    return res.status(500).json({ success: false, error: "Email service not configured" });
  }

  try {
    const mailOptions = {
      from: email,
      to: process.env.EMAIL_USER,
      subject: `Portfolio Contact - Message from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
    };

    console.log("About to send mail...", { to: mailOptions.to, subject: mailOptions.subject });

    // send with timeout so request doesn't hang forever
    await sendMailWithTimeout(mailOptions, 20_000);

    console.log("Mail sent successfully");
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Email Error:", error && (error.stack || error.message || error));
    // provide helpful message to frontend, but don't leak secrets
    return res.status(502).json({ success: false, error: "Failed to send email" });
  }
});

// Root route
app.get("/", (req, res) => {
  res.send("Portfolio Backend Running ✔");
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT} (PORT ${PORT})`);
});
