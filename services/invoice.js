const { get } = require('../database/db');

function generateInvoiceHTML(invoice, payment, user, plan, endDate) {
  const invoiceDate = new Date(invoice.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  const expiryDate = endDate ? new Date(endDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : (payment.end_date ? new Date(payment.end_date).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A');
  const originalAmount = plan.price;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Invoice ${invoice.invoice_number} | Zacson Fitness</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Inter',sans-serif;background:#f5f5f5;color:#333;}
.invoice{max-width:800px;margin:20px auto;background:#fff;padding:40px;}
.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #c7a44e;padding-bottom:20px;margin-bottom:30px;}
.brand h1{font-size:28px;color:#c7a44e;letter-spacing:3px;margin-bottom:5px;}
.brand p{color:#666;font-size:13px;}
.invoice-info{text-align:right;}
.invoice-info h2{font-size:20px;color:#333;margin-bottom:5px;}
.invoice-info p{font-size:13px;color:#666;}
.status{display:inline-block;background:#27ae60;color:#fff;padding:4px 12px;border-radius:4px;font-size:12px;font-weight:600;}
.status.pending{background:#f39c12;}
.status.failed{background:#e74c3c;}
.details{display:flex;justify-content:space-between;margin-bottom:30px;}
.details .col{flex:1;}
.details h3{font-size:13px;text-transform:uppercase;color:#c7a44e;margin-bottom:8px;letter-spacing:1px;}
.details p{font-size:14px;color:#555;line-height:1.6;}
table{width:100%;border-collapse:collapse;margin:20px 0;}
th{background:#f8f8f8;color:#c7a44e;text-align:left;padding:12px;font-size:13px;text-transform:uppercase;letter-spacing:1px;}
td{padding:12px;border-bottom:1px solid #eee;font-size:14px;}
.total{background:#f8f8f8;padding:15px;text-align:right;margin:20px 0;border-radius:4px;}
.total .amount{font-size:24px;font-weight:700;color:#c7a44e;}
.footer-note{margin-top:30px;padding-top:20px;border-top:1px solid #eee;text-align:center;color:#999;font-size:12px;}
@media print{body{background:#fff;}.invoice{margin:0;padding:30px;}}
</style></head><body>
<div class="invoice">
<div class="header">
<div class="brand"><h1>ZACSON FITNESS</h1><p>Forge Your Strength. Shape Your Life.</p><p>14th Floor, Sagar Tech Plaza, Andheri Kurla Road, Andheri West, Mumbai 400053</p></div>
<div class="invoice-info"><h2>INVOICE</h2><p>${invoice.invoice_number}</p><p>Date: ${invoiceDate}</p><p><span class="status ${payment.status}">${payment.status.toUpperCase()}</span></p></div>
</div>
<div class="details">
<div class="col"><h3>Bill To</h3><p>${user.full_name || 'Member'}<br>${user.email}<br>${user.phone || ''}</p></div>
<div class="col"><h3>Plan Details</h3><p>${plan.name} Plan<br>Duration: ${plan.duration_months} month${plan.duration_months > 1 ? 's' : ''}<br>Valid Until: ${expiryDate}</p></div>
<div class="col"><h3>Payment</h3><p>Method: Razorpay<br>Payment ID: ${payment.razorpay_payment_id || 'N/A'}<br>Order ID: ${payment.razorpay_order_id || 'N/A'}</p></div>
</div>
<table><thead><tr><th>Description</th><th>Amount</th></tr></thead>
<tbody>
<tr><td>${plan.name} Membership (${plan.duration_months} month${plan.duration_months > 1 ? 's' : ''})</td><td>&#8377;${originalAmount.toLocaleString()}</td></tr>
${payment.amount < originalAmount ? `<tr><td>Discount Applied</td><td style="color:#27ae60;">-&#8377;${(originalAmount - payment.amount).toLocaleString()}</td></tr>` : ''}
</tbody></table>
<div class="total"><p>Total Paid</p><p class="amount">&#8377;${payment.amount.toLocaleString()}</p></div>
<div class="footer-note"><p>Thank you for choosing Zacson Fitness! For queries, email hello@zacsonfitness.com or call +91 98765 43210.</p><p style="margin-top:5px;">This is a computer-generated invoice and does not require a signature.</p></div>
</div>
</body></html>`;
}

module.exports = { generateInvoiceHTML };
