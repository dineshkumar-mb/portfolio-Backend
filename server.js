import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();

// --- CORS Configuration ---
const allowedOrigins = [
  "*",
  "https://portfolio-five-chi-11.vercel.app",
  "https://dineshkumarfsdportfolio.netlify.app",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000"
];

if (process.env.FRONTEND_ORIGIN) {
  const envOrigins = process.env.FRONTEND_ORIGIN.split(",").map(o => o.trim().replace(/\/$/, ""));
  allowedOrigins.push(...envOrigins);
}

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      const normalizedOrigin = origin.replace(/\/$/, "");
      if (allowedOrigins.includes("*") || allowedOrigins.includes(normalizedOrigin)) {
        callback(null, true);
      } else {
        console.warn(`⚠️ CORS blocked origin: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.options("*", cors());
app.use(express.json());

// --- Request Logging ---
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// --- Nodemailer Setup ---
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // Use SSL
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  connectionTimeout: 10000, // 10 seconds to connect
  greetingTimeout: 10000,   // 10 seconds to greet
  socketTimeout: 15000,     // 15 seconds socket inactivity timeout
});

transporter.verify((error, success) => {
  if (error) {
    console.warn("⚠️ Nodemailer configuration error:", error);
  } else {
    console.log("✅ Nodemailer configured successfully and ready to send emails");
  }
});

// ✅ Contact API (POST)
app.post("/send", async (req, res) => {
  const { name, email, message } = req.body ?? {};

  if (!name || !email || !message) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields: name, email, and message are all required."
    });
  }

  try {
    const mailOptions = {
      to: process.env.RECEIVER_EMAIL || process.env.EMAIL_USER, // Destination email
      from: process.env.EMAIL_USER,
      replyTo: email,
      subject: `Portfolio Contact - Message from ${name}`,
      text: `New message from your portfolio website:\n\nName: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
    };

    console.log(`📧 Attempting to send email via Nodemailer from ${email}...`);

    await transporter.sendMail(mailOptions);

    console.log("✅ Email sent successfully");
    return res.status(200).json({ success: true, message: "Message sent successfully!" });
  } catch (error) {
    console.error("❌ Email Error:", error);

    return res.status(502).json({
      success: false,
      error: "Failed to send email. Please try again later."
    });
  }
});

// Root route for health checks
app.get("/", (req, res) => {
  res.status(200).send("Portfolio Backend is running and healthy! ✔");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
  console.log(`🌐 Allowed Origins: ${allowedOrigins.join(", ")}`);
});
