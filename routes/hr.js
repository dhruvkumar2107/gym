const express = require('express');
const router = express.Router();
const { run, get, all } = require('../database/db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

router.use(authMiddleware, adminMiddleware);

let notifyMod = {};
try { notifyMod = require('../services/notify'); } catch (e) {}
const createNotification = notifyMod.createNotification || function (n) {
  try {
    run('INSERT INTO notifications (user_id, title, message, type, module) VALUES (?, ?, ?, ?, ?)',
      [n && n.user_id !== undefined ? n.user_id : null, (n && n.title) || '', (n && (n.body || n.message)) || '', (n && n.type) || 'info', (n && (n.link || n.module)) || null]);
  } catch (e) {}
  return null;
};
const logAudit = notifyMod.logAudit || function (a) {
  try {
    const u = (a && a.req && a.req.user) || null;
    run('INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, entity_name, previous_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [(a && a.user_id) || (u && u.id) || null, (u && u.full_name) || null, (a && a.action) || '', (a && a.entity_type) || null, (a && a.entity_id) || null, (a && a.entity_name) || null, a && a.previous_value != null ? String(a.previous_value) : null, a && a.new_value != null ? String(a.new_value) : null]);
  } catch (e) {}
  return null;
};

const LEAVE_TYPES = ['casual', 'sick', 'earned', 'unpaid'];

function notifyUsers(userIds, payload) {
  const ids = (userIds || []).filter(Boolean);
  ids.forEach(id => {
    try { createNotification(Object.assign({}, payload, { user_id: id })); } catch (e) {}
  });
}

function managerUserIds() {
  return all("SELECT id FROM users WHERE role IN ('admin', 'super_admin', 'branch_manager', 'hr_manager') AND is_active = 1").map(u => u.id);
}

function employeeUserId(emp) {
  if (!emp) return null;
  if (emp.user_id) return emp.user_id;
  if (emp.email) {
    const u = get('SELECT id FROM users WHERE email = ?', [emp.email]);
    if (u) return u.id;
  }
  return null;
}

router.get('/leave-balances', (req, res) => {
  const { employee_id } = req.query;
  const year = String(new Date().getFullYear());
  const employees = employee_id
    ? all('SELECT * FROM employees WHERE id = ? AND is_active = 1', [employee_id])
    : all('SELECT * FROM employees WHERE is_active = 1');
  const items = [];
  employees.forEach(emp => {
    LEAVE_TYPES.forEach(t => {
      const setting = get('SELECT value FROM site_settings WHERE key = ?', ['leave_entitlement_' + t]);
      const entitled = setting && setting.value !== null && setting.value !== '' ? Number(setting.value) || 0 : 0;
      const takenRow = get("SELECT COALESCE(SUM(days), 0) as t FROM leave_requests WHERE employee_id = ? AND leave_type = ? AND status = 'approved' AND strftime('%Y', start_date) = ?", [emp.id, t, year]);
      const taken = takenRow ? takenRow.t : 0;
      items.push({ employee_id: emp.id, employee_name: emp.full_name, leave_type: t, entitled, taken, balance: entitled - taken });
    });
  });
  res.json({ items, total: items.length });
});

router.get('/leave-requests', (req, res) => {
  const { status, employee_id, page = 1, limit = 20 } = req.query;
  let sql = 'SELECT lr.*, e.full_name as employee_name, e.department, e.designation FROM leave_requests lr JOIN employees e ON lr.employee_id = e.id';
  const params = [];
  const conditions = [];
  if (status) { conditions.push('lr.status = ?'); params.push(status); }
  if (employee_id) { conditions.push('lr.employee_id = ?'); params.push(employee_id); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  const total = get('SELECT COUNT(*) as total FROM leave_requests lr' + (conditions.length ? ' WHERE ' + conditions.join(' AND ') : ''), params).total;
  sql += ' ORDER BY lr.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  const items = all(sql, params);
  res.json({ items, total, page: parseInt(page), limit: parseInt(limit) });
});

router.post('/leave-requests', (req, res) => {
  const { employee_id, type, leave_type, from_date, start_date, to_date, end_date, reason } = req.body;
  const lvType = type || leave_type;
  const from = from_date || start_date;
  const to = to_date || end_date;
  if (!employee_id || !lvType || !from || !to) return res.status(400).json({ error: 'employee_id, type, from_date and to_date are required' });
  const days = Math.max(1, Math.round((new Date(to) - new Date(from)) / 86400000) + 1);
  const ins = run('INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, days, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [employee_id, lvType, from, to, days, reason || '', 'pending']);
  const leaveId = ins.lastID;
  const emp = get('SELECT * FROM employees WHERE id = ?', [employee_id]);
  notifyUsers(managerUserIds(), { type: 'leave', title: 'Leave request pending approval', body: `${emp ? emp.full_name : 'Employee'} requested ${days} day(s) of ${lvType} leave from ${from} to ${to}.`, link: '/admin?view=leave' });
  logAudit({ req, action: 'CREATE', entity_type: 'leave_request', entity_id: leaveId, entity_name: `${lvType} ${from} to ${to}`, new_value: JSON.stringify({ status: 'pending', days }) });
  res.json({ message: 'Leave request submitted', id: leaveId, days });
});

router.put('/leave-requests/:id/approve', (req, res) => {
  const leave = get('SELECT * FROM leave_requests WHERE id = ?', [req.params.id]);
  if (!leave) return res.status(404).json({ error: 'Leave request not found' });
  run("UPDATE leave_requests SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?", [req.user.id, req.params.id]);
  const emp = get('SELECT * FROM employees WHERE id = ?', [leave.employee_id]);
  const uid = employeeUserId(emp);
  if (uid) notifyUsers([uid], { type: 'leave', title: 'Leave request approved', body: `Your ${leave.leave_type} leave from ${leave.start_date} to ${leave.end_date} has been approved.`, link: '/portal' });
  logAudit({ req, action: 'APPROVE', entity_type: 'leave_request', entity_id: leave.id, entity_name: emp ? emp.full_name : '', previous_value: leave.status, new_value: 'approved' });
  res.json({ message: 'Leave request approved' });
});

router.put('/leave-requests/:id/reject', (req, res) => {
  const leave = get('SELECT * FROM leave_requests WHERE id = ?', [req.params.id]);
  if (!leave) return res.status(404).json({ error: 'Leave request not found' });
  const { reason } = req.body;
  run("UPDATE leave_requests SET status = 'rejected', approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?", [req.user.id, req.params.id]);
  const emp = get('SELECT * FROM employees WHERE id = ?', [leave.employee_id]);
  const uid = employeeUserId(emp);
  if (uid) notifyUsers([uid], { type: 'leave', title: 'Leave request rejected', body: `Your ${leave.leave_type} leave from ${leave.start_date} to ${leave.end_date} was rejected.${reason ? ' Reason: ' + reason : ''}`, link: '/portal' });
  logAudit({ req, action: 'REJECT', entity_type: 'leave_request', entity_id: leave.id, entity_name: emp ? emp.full_name : '', previous_value: leave.status, new_value: reason || 'rejected' });
  res.json({ message: 'Leave request rejected' });
});

function parseMonth(month) {
  if (!month) return null;
  const m = String(month).match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  return { year: parseInt(m[1]), month: parseInt(m[2]) };
}

router.get('/payroll', (req, res) => {
  const { month, year, status, employee_id, page = 1, limit = 50 } = req.query;
  let sql = 'SELECT p.*, e.full_name as employee_name, e.department, e.designation FROM payroll p JOIN employees e ON p.employee_id = e.id';
  const params = [];
  const conditions = [];
  const parsed = parseMonth(month);
  if (parsed) { conditions.push('p.month = ? AND p.year = ?'); params.push(parsed.month, parsed.year); }
  else {
    if (month) { conditions.push('p.month = ?'); params.push(month); }
    if (year) { conditions.push('p.year = ?'); params.push(year); }
  }
  if (status) { conditions.push('p.status = ?'); params.push(status); }
  if (employee_id) { conditions.push('p.employee_id = ?'); params.push(employee_id); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  const countSql = 'SELECT COUNT(*) as total FROM payroll p' + (conditions.length ? ' WHERE ' + conditions.join(' AND ') : '');
  const total = get(countSql, params).total;
  sql += ' ORDER BY p.year DESC, p.month DESC, e.full_name LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  const items = all(sql, params);
  res.json({ items, total, page: parseInt(page), limit: parseInt(limit) });
});

router.post('/payroll/generate', (req, res) => {
  const parsed = parseMonth(req.body.month);
  if (!parsed) return res.status(400).json({ error: 'month must be YYYY-MM' });
  const { year, month } = parsed;
  const monthStr = String(year) + '-' + String(month).padStart(2, '0');
  const commissionSetting = get("SELECT value FROM site_settings WHERE key = 'commission_pct'");
  const commissionPct = commissionSetting && commissionSetting.value !== '' && commissionSetting.value !== null ? Number(commissionSetting.value) : 5;
  const employees = all('SELECT * FROM employees WHERE is_active = 1 AND salary > 0');
  let generated = 0;
  employees.forEach(emp => {
    const attRows = all("SELECT working_hours FROM employee_attendance WHERE employee_id = ? AND strftime('%Y-%m', date) = ?", [emp.id, monthStr]);
    const ratePerHour = emp.salary / 30 / 8 * 1.5;
    let overtimeHours = 0;
    attRows.forEach(r => { overtimeHours += Math.max(0, (r.working_hours || 0) - 8); });
    const overtime = Math.round(overtimeHours * ratePerHour * 100) / 100;
    const revenueRow = get("SELECT COALESCE(SUM(p.amount), 0) as rev FROM payments p JOIN memberships m ON (p.membership_id = m.id OR p.membership_id = m.membership_id) WHERE m.assigned_salesperson = ? AND p.status = 'completed' AND strftime('%Y-%m', p.created_at) = ?", [emp.id, monthStr]);
    const revenue = revenueRow ? revenueRow.rev : 0;
    const basic = emp.salary;
    const allowances = Math.round(emp.salary * 0.2 * 100) / 100;
    const deductions = Math.round(emp.salary * 0.05 * 100) / 100;
    const incentive = Math.round(revenue * commissionPct) / 100;
    const advances = 0;
    const net = Math.round((basic + allowances + overtime + incentive - deductions - advances) * 100) / 100;
    const existing = get('SELECT id, status FROM payroll WHERE employee_id = ? AND month = ? AND year = ?', [emp.id, month, year]);
    if (existing) {
      if (existing.status !== 'paid') {
        run('UPDATE payroll SET basic_salary = ?, allowances = ?, deductions = ?, incentives = ?, overtime_pay = ?, advances = ?, net_salary = ?, status = ? WHERE id = ?',
          [basic, allowances, deductions, incentive, overtime, advances, net, 'pending', existing.id]);
      }
    } else {
      run('INSERT INTO payroll (employee_id, month, year, basic_salary, allowances, deductions, incentives, overtime_pay, advances, net_salary, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [emp.id, month, year, basic, allowances, deductions, incentive, overtime, advances, net, 'pending']);
    }
    generated++;
  });
  logAudit({ req, action: 'PAYROLL_GENERATE', entity_type: 'payroll', entity_name: monthStr, new_value: JSON.stringify({ generated, month: monthStr }) });
  res.json({ generated, month: monthStr });
});

router.put('/payroll/:id/mark-paid', (req, res) => {
  const row = get('SELECT * FROM payroll WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Payroll record not found' });
  run("UPDATE payroll SET status = 'paid', paid_at = CURRENT_TIMESTAMP WHERE id = ?", [req.params.id]);
  const emp = get('SELECT * FROM employees WHERE id = ?', [row.employee_id]);
  const uid = employeeUserId(emp);
  if (uid) notifyUsers([uid], { type: 'payroll', title: 'Salary credited', body: `Salary for ${String(row.month).padStart(2, '0')}/${row.year} of amount ₹${row.net_salary} has been marked paid.`, link: '/portal' });
  logAudit({ req, action: 'PAYROLL_PAID', entity_type: 'payroll', entity_id: row.id, entity_name: emp ? emp.full_name : '', previous_value: row.status, new_value: 'paid' });
  res.json({ message: 'Payroll marked paid' });
});

router.get('/payroll/:id/payslip', (req, res) => {
  const row = get('SELECT p.*, e.full_name, e.employee_id as emp_code, e.department, e.designation, e.bank_account, e.ifsc_code FROM payroll p JOIN employees e ON p.employee_id = e.id WHERE p.id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Payslip not found' });
  const company = get("SELECT value FROM site_settings WHERE key = 'brand_name'");
  const brand = company && company.value ? company.value : 'Zacson Fitness';
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Payslip ${String(row.month).padStart(2, '0')}-${row.year} | ${row.full_name}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:Arial,Helvetica,sans-serif;background:#f4f4f4;color:#333;}
.slip{max-width:760px;margin:24px auto;background:#fff;padding:32px;}
h1{font-size:22px;color:#c7a44e;letter-spacing:2px;}
h2{font-size:16px;margin:18px 0 8px;color:#444;text-transform:uppercase;letter-spacing:1px;}
.sub{color:#777;font-size:13px;margin-top:4px;}
.head{display:flex;justify-content:space-between;border-bottom:3px solid #c7a44e;padding-bottom:16px;margin-bottom:18px;}
.meta{text-align:right;font-size:13px;color:#555;line-height:1.7;}
table{width:100%;border-collapse:collapse;margin:10px 0 18px;}
th{background:#f7f7f7;text-align:left;padding:10px;font-size:12px;text-transform:uppercase;color:#c7a44e;border-bottom:1px solid #eee;}
td{padding:10px;border-bottom:1px solid #eee;font-size:14px;}
td.num,th.num{text-align:right;}
.total td{font-weight:bold;background:#fafafa;font-size:15px;}
.note{margin-top:20px;font-size:12px;color:#999;text-align:center;border-top:1px solid #eee;padding-top:14px;}
@media print{body{background:#fff;}.slip{margin:0;padding:20px;}}
</style></head><body>
<div class="slip">
<div class="head">
<div><h1>${brand.toUpperCase()}</h1><p class="sub">Payslip for ${String(row.month).padStart(2, '0')}/${row.year}</p></div>
<div class="meta"><strong>${row.full_name}</strong><br>Employee Code: ${row.emp_code || 'N/A'}<br>${row.designation || ''} ${row.department ? ' | ' + row.department : ''}<br>Status: ${row.status.toUpperCase()}</div>
</div>
<h2>Earnings</h2>
<table><thead><tr><th>Component</th><th class="num">Amount</th></tr></thead>
<tbody>
<tr><td>Basic Salary</td><td class="num">&#8377;${row.basic_salary.toLocaleString('en-IN')}</td></tr>
<tr><td>Allowances</td><td class="num">&#8377;${row.allowances.toLocaleString('en-IN')}</td></tr>
<tr><td>Overtime</td><td class="num">&#8377;${row.overtime_pay.toLocaleString('en-IN')}</td></tr>
<tr><td>Incentive / Commission</td><td class="num">&#8377;${row.incentives.toLocaleString('en-IN')}</td></tr>
<tr class="total"><td>Gross</td><td class="num">&#8377;${(row.basic_salary + row.allowances + row.overtime_pay + row.incentives).toLocaleString('en-IN')}</td></tr>
</tbody></table>
<h2>Deductions</h2>
<table><thead><tr><th>Component</th><th class="num">Amount</th></tr></thead>
<tbody>
<tr><td>Deductions</td><td class="num">-&#8377;${row.deductions.toLocaleString('en-IN')}</td></tr>
<tr><td>Advances</td><td class="num">-&#8377;${row.advances.toLocaleString('en-IN')}</td></tr>
<tr class="total"><td>Net Salary</td><td class="num">&#8377;${row.net_salary.toLocaleString('en-IN')}</td></tr>
</tbody></table>
<h2>Bank Details</h2>
<table><tbody>
<tr><td>Account</td><td>${row.bank_account || 'N/A'}</td></tr>
<tr><td>IFSC</td><td>${row.ifsc_code || 'N/A'}</td></tr>
</tbody></table>
<p class="note">This is a computer-generated payslip and does not require a signature.</p>
</div></body></html>`;
  res.type('html').send(html);
});

router.post('/employee-attendance/clock', (req, res) => {
  const { employee_id, date, check_in, check_out, notes } = req.body;
  if (!employee_id) return res.status(400).json({ error: 'employee_id is required' });
  const targetDate = date || new Date().toISOString().split('T')[0];
  let workingHours = 0;
  if (check_in && check_out) {
    workingHours = ((parseInt(check_out.split(':')[0]) * 60 + parseInt(check_out.split(':')[1])) - (parseInt(check_in.split(':')[0]) * 60 + parseInt(check_in.split(':')[1]))) / 60;
    if (workingHours < 0) workingHours = 0;
  }
  const overtime = Math.max(0, workingHours - 8);
  const ins = run('INSERT INTO employee_attendance (employee_id, date, check_in, check_out, working_hours, overtime_hours, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [employee_id, targetDate, check_in || '', check_out || '', workingHours, overtime, check_in ? 'present' : 'absent', notes || '']);
  const attId = ins.lastID;
  logAudit({ req, action: 'CREATE', entity_type: 'employee_attendance', entity_id: attId, entity_name: `Employee #${employee_id}`, new_value: JSON.stringify({ date: targetDate, check_in, check_out }) });
  res.json({ message: 'Attendance recorded', id: attId, working_hours: workingHours, overtime_hours: overtime });
});

router.get('/employees/:id/attendance', (req, res) => {
  const monthStr = req.query.month || new Date().toISOString().slice(0, 7);
  const emp = get('SELECT * FROM employees WHERE id = ?', [req.params.id]);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });
  const items = all("SELECT * FROM employee_attendance WHERE employee_id = ? AND strftime('%Y-%m', date) = ? ORDER BY date", [req.params.id, monthStr]);
  const total = items.length;
  const lateSetting = get("SELECT value FROM site_settings WHERE key = 'work_start_time'");
  const lateAfter = lateSetting && lateSetting.value ? lateSetting.value : '09:30';
  let worked = 0;
  let late = 0;
  let ot = 0;
  items.forEach(r => {
    worked += r.working_hours || 0;
    ot += r.overtime_hours || Math.max(0, (r.working_hours || 0) - 8);
    if (r.check_in && r.check_in > lateAfter) late++;
  });
  res.json({ items, total, worked_hours: Math.round(worked * 100) / 100, late_count: late, overtime_hours: Math.round(ot * 100) / 100, month: monthStr });
});

module.exports = router;
