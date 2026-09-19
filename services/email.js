const nodemailer = require('nodemailer');
const { get } = require('../database/db');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const smtpHost = get("SELECT value FROM site_settings WHERE key = 'smtp_host'");
  const smtpPort = get("SELECT value FROM site_settings WHERE key = 'smtp_port'");
  const smtpUser = get("SELECT value FROM site_settings WHERE key = 'smtp_user'");
  const smtpPass = get("SELECT value FROM site_settings WHERE key = 'smtp_pass'");
  const fromEmail = get("SELECT value FROM site_settings WHERE key = 'from_email'") || { value: 'hello@zacsonfitness.com' };
  const fromName = get("SELECT value FROM site_settings WHERE key = 'from_name'") || { value: 'Zacson Fitness' };

  if (smtpUser && smtpUser.value) {
    transporter = nodemailer.createTransport({
      host: smtpHost ? smtpHost.value : 'smtp.gmail.com',
      port: smtpPort ? parseInt(smtpPort.value) : 587,
      secure: false,
      auth: { user: smtpUser.value, pass: smtpPass ? smtpPass.value : '' }
    });
  } else {
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: 'test@ethereal.email', pass: 'test' }
    });
    console.log('Email: Using ethereal (no SMTP configured). Emails will not actually send.');
  }
  transporter.fromEmail = fromEmail.value;
  transporter.fromName = fromName.value;
  return transporter;
}

function emailTemplate(title, body) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Tahoma,sans-serif;color:#fff;}
.container{max-width:600px;margin:0 auto;background:#111;border:1px solid #c7a44e;}
.header{background:#c7a44e;padding:20px;text-align:center;}
.header h1{margin:0;color:#000;font-size:22px;letter-spacing:2px;}
.content{padding:30px;color:#ddd;font-size:15px;line-height:1.7;}
.content h2{color:#c7a44e;font-size:20px;margin-top:0;}
.btn{display:inline-block;background:#c7a44e;color:#000;padding:12px 30px;text-decoration:none;font-weight:bold;border-radius:4px;margin:15px 0;}
.footer{padding:20px;text-align:center;color:#666;font-size:12px;border-top:1px solid #333;}
.highlight{color:#c7a44e;font-weight:bold;}
table{width:100%;border-collapse:collapse;margin:15px 0;}
td,th{padding:10px;border-bottom:1px solid #333;text-align:left;}
th{color:#c7a44e;}
</style></head><body>
<div class="container">
<div class="header"><h1>ZACSON FITNESS</h1></div>
<div class="content">${body}</div>
<div class="footer"><p>&copy; ${new Date().getFullYear()} Zacson Fitness. All rights reserved.<br>14th Floor, Sagar Tech Plaza, Andheri Kurla Road, Andheri West, Mumbai 400053</p></div>
</div></body></html>`;
}

async function sendEmail(to, subject, htmlBody) {
  try {
    const transport = getTransporter();
    await transport.sendMail({
      from: `"${transport.fromName}" <${transport.fromEmail}>`,
      to,
      subject,
      html: htmlBody
    });
    console.log('Email sent to', to, subject);
    return true;
  } catch (err) {
    console.error('Email error:', err.message);
    return false;
  }
}

async function sendFreeTrialConfirmation(user) {
  const body = `<h2>Your Free Trial is Confirmed!</h2>
<p>Hi <span class="highlight">${user.name}</span>,</p>
<p>Your free trial session at <span class="highlight">Zacson Fitness</span> has been booked. We're excited to welcome you!</p>
<table>
<tr><th>Date</th><td>${user.preferred_date || 'Any available day'}</td></tr>
<tr><th>Time</th><td>${user.preferred_time || 'Morning (6 AM - 10 AM)'}</td></tr>
<tr><th>Phone</th><td>${user.phone}</td></tr>
<tr><th>Fitness Goal</th><td>${user.fitness_goal ? user.fitness_goal.replace(/_/g, ' ').toUpperCase() : 'General Fitness'}</td></tr>
</table>
<p>What to bring: Comfortable workout clothes, sports shoes, water bottle, and a valid ID.</p>
<p>Our trainer will meet you at the reception. Please arrive 15 minutes early.</p>
<a href="https://wa.me/919876543210?text=Hi! I have a free trial booked. Need directions." class="btn">Chat on WhatsApp</a>
<p>Need to reschedule? Call us at <span class="highlight">+91 98765 43210</span></p>`;
  await sendEmail(user.email, 'Free Trial Confirmed - Zacson Fitness', emailTemplate('Free Trial Confirmation', body));
}

async function sendContactConfirmation(user) {
  const body = `<h2>Thank You for Reaching Out!</h2>
<p>Hi <span class="highlight">${user.name}</span>,</p>
<p>We've received your message and our team will get back to you within 24 hours.</p>
<table>
<tr><th>Subject</th><td>${user.subject || 'General Enquiry'}</td></tr>
<tr><th>Message</th><td>${user.message}</td></tr>
</table>
<p>In the meantime, feel free to reach us on WhatsApp for instant assistance.</p>
<a href="https://wa.me/919876543210?text=Hi! I just sent a contact form. Need quick response." class="btn">Chat on WhatsApp</a>`;
  await sendEmail(user.email, 'We Got Your Message - Zacson Fitness', emailTemplate('Message Received', body));
}

async function sendMembershipConfirmation(user, plan, payment, invoiceNumber) {
  const body = `<h2>Welcome to Zacson Fitness!</h2>
<p>Hi <span class="highlight">${user.full_name || user.email}</span>,</p>
<p>Your membership has been activated. Here are your details:</p>
<table>
<tr><th>Plan</th><td><span class="highlight">${plan.name}</span></td></tr>
<tr><th>Amount Paid</th><td>&#8377;${payment.amount.toLocaleString()}</td></tr>
<tr><th>Invoice #</th><td>${invoiceNumber}</td></tr>
<tr><th>Valid From</th><td>${payment.start_date || new Date().toISOString().split('T')[0]}</td></tr>
<tr><th>Valid Until</th><td>${payment.end_date || 'N/A'}</td></tr>
<tr><th>Payment ID</th><td>${payment.razorpay_payment_id || 'N/A'}</td></tr>
</table>
<p>Your invoice is attached below for your records.</p>
<a href="https://wa.me/919876543210?text=Hi! I just purchased the ${plan.name} plan. Need help getting started." class="btn">Get Started on WhatsApp</a>`;
  await sendEmail(user.email, `Welcome to Zacson Fitness - ${plan.name} Plan`, emailTemplate('Membership Confirmed', body));
}

async function sendAdminNotification(type, data) {
  const adminEmail = get("SELECT value FROM site_settings WHERE key = 'contact_email'") || { value: 'admin@zacsonfitness.com' };
  let subject = '', body = '';
  switch (type) {
    case 'new_lead':
      subject = 'New Lead - ' + data.name;
      body = `<h2>New Lead Received</h2><table><tr><th>Name</th><td>${data.name}</td></tr><tr><th>Email</th><td>${data.email}</td></tr><tr><th>Phone</th><td>${data.phone}</td></tr><tr><th>Source</th><td>${data.source}</td></tr><tr><th>Goal</th><td>${data.fitness_goal || 'N/A'}</td></tr></table>`;
      break;
    case 'new_trial':
      subject = 'New Free Trial Booking - ' + data.name;
      body = `<h2>New Free Trial Booking</h2><table><tr><th>Name</th><td>${data.name}</td></tr><tr><th>Email</th><td>${data.email}</td></tr><tr><th>Phone</th><td>${data.phone}</td></tr><tr><th>Goal</th><td>${data.fitness_goal || 'N/A'}</td></tr><tr><th>Preferred Date</th><td>${data.preferred_date || 'Flexible'}</td></tr></table>`;
      break;
    case 'new_payment':
      subject = 'Payment Received - ' + data.amount;
      body = `<h2>Payment Received</h2><table><tr><th>Amount</th><td>&#8377;${data.amount}</td></tr><tr><th>Plan</th><td>${data.plan_name || 'N/A'}</td></tr><tr><th>Customer</th><td>${data.customer_name || data.email}</td></tr><tr><th>Payment ID</th><td>${data.razorpay_payment_id || 'N/A'}</td></tr><tr><th>Invoice</th><td>${data.invoice_number || 'N/A'}</td></tr></table>`;
      break;
    case 'new_contact':
      subject = 'Contact Form - ' + data.name;
      body = `<h2>New Contact Form Submission</h2><table><tr><th>Name</th><td>${data.name}</td></tr><tr><th>Email</th><td>${data.email}</td></tr><tr><th>Phone</th><td>${data.phone || 'N/A'}</td></tr><tr><th>Message</th><td>${data.message}</td></tr></table>`;
      break;
  }
  await sendEmail(adminEmail.value, `[Zacson Fitness] ${subject}`, emailTemplate('Admin Notification', body));
}

module.exports = { sendEmail, sendFreeTrialConfirmation, sendContactConfirmation, sendMembershipConfirmation, sendAdminNotification, emailTemplate };
