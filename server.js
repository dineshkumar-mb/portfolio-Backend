// import express from "express";
// import cors from "cors";
// import dotenv from "dotenv";
// import nodemailer from "nodemailer";

// dotenv.config();

// const app = express();

// // --- CORS: allow your frontend origin (for debugging you can allow all) ---
// const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "*";
// app.use(
//   cors({
//     origin: FRONTEND_ORIGIN, // in production set this to "https://your-frontend-domain"
//     methods: ["GET", "POST", "OPTIONS"],
//     allowedHeaders: ["Content-Type", "Authorization"],
//     credentials: true,
//   })
// );
// app.options("*", cors()); // respond to preflight

// app.use(express.json());

// // --- Logging middleware ---
// app.use((req, res, next) => {
//   console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - body:`, req.body);
//   next();
// });

// // --- Create transporter once and verify on startup ---
// let transporter;
// async function initTransporter() {
//   try {
//     transporter = nodemailer.createTransport({
//       service: "gmail",
//       auth: {
//         user: process.env.EMAIL_USER,
//         pass: process.env.EMAIL_PASS, // use App Password for Gmail + 2FA
//       },
//       // optional timeouts
//       socketTimeout: 15_000,
//       greetingTimeout: 10_000,
//       connectionTimeout: 10_000,
//       tls: {
//         rejectUnauthorized: false, // avoid TLS issues on some hosts — optional
//       },
//     });

//     // verify connection configuration (throws on error)
//     await transporter.verify();
//     console.log("✅ Nodemailer transporter verified and ready");
//   } catch (err) {
//     console.error("❌ Failed to verify transporter:", err);
//     // keep going — we'll still attempt to send, but log will show verification failure
//   }
// }
// await initTransporter();

// // --- helper: sendMail with timeout ---
// function sendMailWithTimeout(mailOptions, timeoutMs = 15000) {
//   const sendPromise = transporter.sendMail(mailOptions);
//   const timeoutPromise = new Promise((_, reject) =>
//     setTimeout(() => reject(new Error("sendMail timeout")), timeoutMs)
//   );
//   return Promise.race([sendPromise, timeoutPromise]);
// }

// // ✅ Contact API (POST)
// app.post("/send", async (req, res) => {
//   const { name, email, message } = req.body ?? {};

//   if (!name || !email || !message) {
//     return res.status(400).json({ success: false, error: "All fields required" });
//   }

//   if (!transporter) {
//     console.error("No transporter available (transporter not initialized)");
//     return res.status(500).json({ success: false, error: "Email service not configured" });
//   }

//   try {
//     const mailOptions = {
//       from: email,
//       to: process.env.EMAIL_USER,
//       subject: `Portfolio Contact - Message from ${name}`,
//       text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
//     };

//     console.log("About to send mail...", { to: mailOptions.to, subject: mailOptions.subject });

//     // send with timeout so request doesn't hang forever
//     await sendMailWithTimeout(mailOptions, 20_000);

//     console.log("Mail sent successfully");
//     return res.status(200).json({ success: true });
//   } catch (error) {
//     console.error("Email Error:", error && (error.stack || error.message || error));
//     // provide helpful message to frontend, but don't leak secrets
//     return res.status(502).json({ success: false, error: "Failed to send email" });
//   }
// });

// // Root route
// app.get("/", (req, res) => {
//   res.send("Portfolio Backend Running ✔");
// });

// // Start Server
// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => {
//   console.log(`✅ Server running on http://localhost:${PORT} (PORT ${PORT})`);
// });
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();

// --- CORS Configuration ---
const allowedOrigins = [
  "https://portfolio-five-chi-11.vercel.app",
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
      // Allow requests with no origin (like mobile apps or curl requests)
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

// Explicitly handle preflight requests
app.options("*", cors());

app.use(express.json());

// --- Request Logging ---
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// --- Nodemailer Setup ---
let transporter;

async function initTransporter() {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn("⚠️ EMAIL_USER or EMAIL_PASS not set in environment variables");
    }

    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      secure: false, // true for 465, false for other ports
    });

    await transporter.verify();
    console.log("✅ Nodemailer transporter verified and ready");
  } catch (err) {
    console.error("❌ Failed to verify transporter:", err.message || err);
  }
}

// In ES modules, top-level await is supported
await initTransporter();

// Helper function to send mail with timeout
function sendMailWithTimeout(mailOptions, timeoutMs = 15000) {
  if (!transporter) return Promise.reject(new Error("Transporter not initialized"));
  
  const sendPromise = transporter.sendMail(mailOptions);
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Email sending timed out")), timeoutMs)
  );
  return Promise.race([sendPromise, timeoutPromise]);
}

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
      from: process.env.EMAIL_USER, // Gmail requires this to be the authenticated user
      to: process.env.EMAIL_USER,   // Sending to yourself
      replyTo: email,               // Reply to the user who filled the form
      subject: `Portfolio Contact - Message from ${name}`,
      text: `New message from your portfolio website:\n\nName: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
    };

    console.log(`📧 Attempting to send email from ${email}...`);
    
    await sendMailWithTimeout(mailOptions, 20000);
    
    console.log("✅ Email sent successfully");
    return res.status(200).json({ success: true, message: "Message sent successfully!" });
  } catch (error) {
    console.error("❌ Email Error:", error.message || error);
    
    // Check if it's an auth error
    if (error.message && error.message.includes("Invalid login")) {
      return res.status(500).json({ 
        success: false, 
        error: "Email service authentication failed. Please check backend configuration." 
      });
    }

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



// import express from "express";
// import cors from "cors";
// import dotenv from "dotenv";
// import nodemailer from "nodemailer";

// dotenv.config();

// const app = express();

// const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "*";
// app.use(
//   cors({
//     origin: FRONTEND_ORIGIN,
//     methods: ["GET", "POST", "OPTIONS"],
//     allowedHeaders: ["Content-Type", "Authorization"],
//     credentials: true,
//   })
// );
// app.options("*", cors());
// app.use(express.json());

// app.use((req, res, next) => {
//   console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - body:`, req.body);
//   next();
// });

// // --- SETUP SENDGRID TRANSPORTER ---
// let transporter;
// async function initTransporter() {
//   try {
//     transporter = nodemailer.createTransport({
//       service: "SendGrid", // Known nodemailer service
//       auth: {
//         user: "apikey", // literally the string 'apikey'
//         pass: process.env.SENDGRID_API_KEY,
//       },
//     });
//     await transporter.verify();
//     console.log("✅ SendGrid transporter verified and ready");
//   } catch (err) {
//     console.error("❌ Failed to verify transporter:", err);
//   }
// }
// await initTransporter(); // or wrap in IIFE if not ESM

// function sendMailWithTimeout(mailOptions, timeoutMs = 15000) {
//   const sendPromise = transporter.sendMail(mailOptions);
//   const timeoutPromise = new Promise((_, reject) =>
//     setTimeout(() => reject(new Error("sendMail timeout")), timeoutMs)
//   );
//   return Promise.race([sendPromise, timeoutPromise]);
// }

// app.post("/send", async (req, res) => {
//   const { name, email, message } = req.body ?? {};
//   if (!name || !email || !message) {
//     return res.status(400).json({ success: false, error: "All fields required" });
//   }
//   if (!transporter) {
//     console.error("No transporter available");
//     return res.status(500).json({ success: false, error: "Email service not configured" });
//   }
//   try {
//     const mailOptions = {
//       from: process.env.EMAIL_USER,
//       replyTo: email,
//       to: process.env.EMAIL_USER,
//       subject: `Portfolio Contact - Message from ${name}`,
//       text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
//     };
//     await sendMailWithTimeout(mailOptions, 20000);
//     console.log("Mail sent successfully");
//     return res.status(200).json({ success: true });
//   } catch (error) {
//     console.error("Email Error:", error);
//     return res.status(502).json({ success: false, error: "Failed to send email" });
//   }
// });

// app.get("/", (req, res) => {
//   res.send("Portfolio Backend Running ✔");
// });

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => {
//   console.log(`✅ Server running on http://localhost:${PORT} (PORT ${PORT})`);
// });
