require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST'],
  credentials: true
}));

// Rate limit: max 5 contact form submissions per 15 minutes per IP
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many messages sent. Please try again later.' }
});

// Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Portfolio backend is running 🚀' });
});

// Contact form endpoint
app.post('/api/contact', contactLimiter, async (req, res) => {
  const { name, email, subject, message } = req.body;

  // Basic validation
  if (!name || !email || !message) {
    return res.status(400).json({ success: false, message: 'Name, email, and message are required.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: 'Invalid email address.' });
  }
  if (message.length > 2000) {
    return res.status(400).json({ success: false, message: 'Message too long (max 2000 chars).' });
  }

  try {
    // Email to Vikash
    await transporter.sendMail({
      from: `"Portfolio Contact" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_TO,
      subject: `[Portfolio] ${subject || 'New message'} — from ${name}`,
      html: `
        <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; border-radius: 12px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #1A6CFF, #00D4AA); padding: 2rem; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 1.4rem;">New Portfolio Message</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 0.5rem 0 0; font-size: 0.9rem;">from vikash-gautam.dev</p>
          </div>
          <div style="padding: 2rem; background: white;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 0.6rem 0; color: #888; font-size: 0.85rem; width: 100px;">From</td><td style="padding: 0.6rem 0; font-weight: 600;">${name}</td></tr>
              <tr><td style="padding: 0.6rem 0; color: #888; font-size: 0.85rem;">Email</td><td style="padding: 0.6rem 0;"><a href="mailto:${email}" style="color: #1A6CFF;">${email}</a></td></tr>
              <tr><td style="padding: 0.6rem 0; color: #888; font-size: 0.85rem;">Subject</td><td style="padding: 0.6rem 0;">${subject || '—'}</td></tr>
            </table>
            <hr style="border: none; border-top: 1px solid #eee; margin: 1.5rem 0;">
            <h3 style="margin: 0 0 1rem; font-size: 0.9rem; color: #888; text-transform: uppercase; letter-spacing: 0.1em;">Message</h3>
            <p style="line-height: 1.7; color: #333; white-space: pre-wrap;">${message}</p>
          </div>
          <div style="padding: 1rem 2rem; background: #f9f9f9; text-align: center; font-size: 0.78rem; color: #aaa;">
            Sent via portfolio contact form · ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
          </div>
        </div>
      `
    });

    // Auto-reply to sender
    await transporter.sendMail({
      from: `"Vikash Gautam" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Got your message, ${name.split(' ')[0]}! 👋`,
      html: `
        <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #1A6CFF, #00D4AA); padding: 2rem; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 1.4rem;">Thanks for reaching out!</h1>
          </div>
          <div style="padding: 2rem; background: white; border-radius: 0 0 12px 12px; border: 1px solid #eee;">
            <p style="color: #333; line-height: 1.7;">Hey ${name.split(' ')[0]},</p>
            <p style="color: #333; line-height: 1.7;">I've received your message and will get back to you within 24–48 hours.</p>
            <p style="color: #333; line-height: 1.7;">In the meantime, feel free to check out my work on <a href="https://github.com/vikash1311" style="color: #1A6CFF;">GitHub</a>.</p>
            <p style="color: #333; line-height: 1.7; margin-top: 2rem;">Best,<br><strong>Vikash Gautam</strong><br><span style="color: #888; font-size: 0.85rem;">Full Stack Developer · Nagpur</span></p>
          </div>
        </div>
      `
    });

    res.json({ success: true, message: 'Message sent successfully!' });
  } catch (error) {
    console.error('Mail error:', error);
    res.status(500).json({ success: false, message: 'Failed to send message. Please try again.' });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 Portfolio backend running on http://localhost:${PORT}`);
  console.log(`📧 Emails will be sent to: ${process.env.EMAIL_TO}`);
});
