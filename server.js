require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 5000;

// Startup env check
const missing = ['EMAIL_USER','EMAIL_PASS','EMAIL_TO'].filter(k => !process.env[k]);
if (missing.length) console.warn('⚠️  Missing .env keys:', missing.join(', '));

app.use(express.json());
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://playful-donut-3ae0e8.netlify.app',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.netlify.app')) {
      return callback(null, true);
    }
    return callback(null, true); // allow all for now
  },
  methods: ['GET', 'POST'],
  credentials: true
}));

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 5,
  message: { success: false, message: 'Too many messages. Try again in 15 minutes.' }
});

// Build transporter — called fresh per request so .env changes take effect
function makeTransporter() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    tls: { rejectUnauthorized: false }
  });
}

// Health check — also tells you exactly what's wrong
app.get('/api/health', async (req, res) => {
  const t = makeTransporter();
  let mailOk = false, mailError = null;
  try { await t.verify(); mailOk = true; }
  catch (e) { mailError = e.message; }
  res.json({
    status: 'ok',
    env: {
      EMAIL_USER: process.env.EMAIL_USER || '❌ not set',
      EMAIL_PASS: process.env.EMAIL_PASS ? '✅ set' : '❌ not set',
      EMAIL_TO:   process.env.EMAIL_TO   || '❌ not set',
    },
    smtp: mailOk ? '✅ connected' : `❌ ${mailError}`,
  });
});

app.post('/api/contact', contactLimiter, async (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !message)
    return res.status(400).json({ success: false, message: 'Name, email, and message are required.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ success: false, message: 'Invalid email address.' });
  if (message.length > 2000)
    return res.status(400).json({ success: false, message: 'Message too long.' });

  const t = makeTransporter();

  // Verify SMTP before trying to send — gives a clear error immediately
  try { await t.verify(); }
  catch (e) {
    console.error('❌ SMTP verify failed:', e.message);
    return res.status(500).json({
      success: false,
      message: `Mail config error: ${e.message}. Check your Gmail App Password in .env`
    });
  }

  try {
    await t.sendMail({
      from: `"Portfolio Contact" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_TO,
      replyTo: email,
      subject: `[Portfolio] ${subject || 'New message'} — from ${name}`,
      html: `
        <div style="font-family:'Segoe UI',sans-serif;max-width:600px;margin:0 auto;border-radius:12px;overflow:hidden;border:1px solid #eee;">
          <div style="background:linear-gradient(135deg,#1A6CFF,#00D4AA);padding:2rem;text-align:center;">
            <h1 style="color:white;margin:0;font-size:1.3rem;">New Portfolio Message</h1>
          </div>
          <div style="padding:2rem;background:#fff;">
            <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
              <tr><td style="padding:8px 0;color:#888;width:90px;">From</td><td style="font-weight:600;">${name}</td></tr>
              <tr><td style="padding:8px 0;color:#888;">Email</td><td><a href="mailto:${email}" style="color:#1A6CFF;">${email}</a></td></tr>
              <tr><td style="padding:8px 0;color:#888;">Subject</td><td>${subject || '—'}</td></tr>
            </table>
            <hr style="border:none;border-top:1px solid #eee;margin:1.5rem 0;">
            <p style="font-size:0.8rem;color:#aaa;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 0.8rem;">Message</p>
            <p style="color:#333;line-height:1.8;white-space:pre-wrap;">${message}</p>
          </div>
          <div style="padding:1rem 2rem;background:#f9f9f9;text-align:center;font-size:0.75rem;color:#bbb;">
            ${new Date().toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST
          </div>
        </div>`
    });

    await t.sendMail({
      from: `"Vikash Gautam" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Got your message, ${name.split(' ')[0]}! 👋`,
      html: `
        <div style="font-family:'Segoe UI',sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:linear-gradient(135deg,#1A6CFF,#00D4AA);padding:2rem;border-radius:12px 12px 0 0;text-align:center;">
            <h1 style="color:white;margin:0;font-size:1.3rem;">Thanks for reaching out!</h1>
          </div>
          <div style="padding:2rem;background:white;border-radius:0 0 12px 12px;border:1px solid #eee;border-top:none;">
            <p style="color:#333;line-height:1.8;">Hey ${name.split(' ')[0]},</p>
            <p style="color:#333;line-height:1.8;">Got your message — I'll reply within 24–48 hours.</p>
            <p style="color:#333;line-height:1.8;">Check out my work on <a href="https://github.com/vikash1311" style="color:#1A6CFF;">GitHub</a> in the meantime.</p>
            <p style="color:#333;line-height:1.8;margin-top:2rem;">Best,<br><strong>Vikash Gautam</strong><br>
            <span style="color:#888;font-size:0.85rem;">Full Stack Developer · Nagpur</span></p>
          </div>
        </div>`
    });

    console.log(`✅ Mail sent — from ${name} <${email}>`);
    res.json({ success: true, message: 'Message sent successfully!' });

  } catch (error) {
    console.error('❌ sendMail failed:', error.message);
    res.status(500).json({ success: false, message: `Failed to send: ${error.message}` });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 Backend  → http://localhost:${PORT}`);
  console.log(`🏥 Health   → http://localhost:${PORT}/api/health`);
  console.log(`📬 Contact  → POST http://localhost:${PORT}/api/contact\n`);
});