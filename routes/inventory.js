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

function safeAll(sql, params) {
  try { return all(sql, params); } catch (e) { return []; }
}

function safeGet(sql, params) {
  try { return get(sql, params); } catch (e) { return null; }
}

router.get('/suppliers', (req, res) => {
  const { page = 1, limit = 50, search } = req.query;
  const conditions = ['is_active != 0'];
  const params = [];
  if (search) { conditions.push('(name LIKE ? OR phone LIKE ? OR email LIKE ?)'); params.push('%' + search + '%', '%' + search + '%', '%' + search + '%'); }
  const where = ' WHERE ' + conditions.join(' AND ');
  const total = safeGet('SELECT COUNT(*) as total FROM suppliers' + where, params);
  const items = safeAll('SELECT * FROM suppliers' + where + ' ORDER BY name LIMIT ? OFFSET ?',
    params.concat([parseInt(limit), (parseInt(page) - 1) * parseInt(limit)]));
  res.json({ items, total: total ? total.total : 0, page: parseInt(page), limit: parseInt(limit) });
});

router.post('/suppliers', (req, res) => {
  const { name, phone, contact_person, email, address, gst_number } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'name and phone are required' });
  const rec = run('INSERT INTO suppliers (name, phone, contact_person, email, address, gst_number, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [name, phone, contact_person || '', email || '', address || '', gst_number || '', 1]);
  const id = rec.lastID;
  logAudit({ req, action: 'CREATE', entity_type: 'supplier', entity_id: id, entity_name: name });
  res.json({ message: 'Supplier created', id });
});

router.put('/suppliers/:id', (req, res) => {
  const prev = get('SELECT * FROM suppliers WHERE id = ?', [req.params.id]);
  if (!prev) return res.status(404).json({ error: 'Supplier not found' });
  const { name, phone, contact_person, email, address, gst_number, is_active } = req.body;
  run('UPDATE suppliers SET name = ?, phone = ?, contact_person = ?, email = ?, address = ?, gst_number = ?, is_active = ? WHERE id = ?',
    [name || prev.name, phone || prev.phone, contact_person !== undefined ? contact_person : prev.contact_person, email !== undefined ? email : prev.email, address !== undefined ? address : prev.address, gst_number !== undefined ? gst_number : prev.gst_number, is_active !== undefined ? (is_active ? 1 : 0) : prev.is_active, req.params.id]);
  logAudit({ req, action: 'UPDATE', entity_type: 'supplier', entity_id: req.params.id, entity_name: prev.name, previous_value: JSON.stringify(prev), new_value: JSON.stringify({ name, phone }) });
  res.json({ message: 'Supplier updated' });
});

router.delete('/suppliers/:id', (req, res) => {
  const prev = get('SELECT * FROM suppliers WHERE id = ?', [req.params.id]);
  if (!prev) return res.status(404).json({ error: 'Supplier not found' });
  let linked = 0;
  const poCount = safeGet('SELECT COUNT(*) as total FROM purchase_orders WHERE supplier_id = ?', [req.params.id]);
  if (poCount) linked = poCount.total;
  if (linked > 0) {
    run('UPDATE suppliers SET is_active = 0 WHERE id = ?', [req.params.id]);
    logAudit({ req, action: 'DEACTIVATE', entity_type: 'supplier', entity_id: req.params.id, entity_name: prev.name, new_value: 'is_active=0' });
    res.json({ message: 'Supplier deactivated (has purchase history)' });
  } else {
    try { run('DELETE FROM suppliers WHERE id = ?', [req.params.id]); } catch (e) {}
    logAudit({ req, action: 'DELETE', entity_type: 'supplier', entity_id: req.params.id, entity_name: prev.name });
    res.json({ message: 'Supplier deleted' });
  }
});

router.post('/purchases', (req, res) => {
  const { supplier_id, items, notes } = req.body;
  if (!supplier_id) return res.status(400).json({ error: 'supplier_id is required' });
  if (!items || !items.length) return res.status(400).json({ error: 'items are required' });
  const supplier = safeGet('SELECT * FROM suppliers WHERE id = ?', [supplier_id]);
  if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
  let total = 0;
  items.forEach(it => { total += (it.quantity || 1) * (it.unit_cost || 0); });
  const poNumber = 'PO-' + Date.now().toString(36).toUpperCase();
  const poRec = run('INSERT INTO purchase_orders (po_number, supplier_id, order_date, status, total, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [poNumber, supplier_id, new Date().toISOString().split('T')[0], 'received', total, notes || '', req.user.id]);
  const poId = poRec.lastID;
  const purchasedItems = [];
  items.forEach(it => {
    const product = get('SELECT * FROM products WHERE id = ?', [it.product_id]);
    if (!product) return;
    const qty = it.quantity || 1;
    const cost = it.unit_cost;
    if (cost === undefined) return;
    const itemTotal = qty * cost;
    run('INSERT INTO purchase_items (po_id, product_id, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?)',
      [poId, product.id, qty, cost, itemTotal]);
    run('UPDATE products SET stock = stock + ?, purchase_price = ? WHERE id = ?', [qty, cost || product.purchase_price, product.id]);
    run('INSERT INTO inventory_transactions (product_id, transaction_type, quantity, reference_id, reference_type, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [product.id, 'purchase', qty, poId, 'purchase_order', `Purchase from ${supplier.name}`, req.user.id]);
    purchasedItems.push({ product_id: product.id, product_name: product.name, quantity: qty, unit_cost: cost, total: itemTotal });
  });
  logAudit({ req, action: 'PURCHASE', entity_type: 'purchase_order', entity_id: poId, entity_name: poNumber, new_value: JSON.stringify({ supplier_id, total, items: items.length }) });
  res.json({ message: 'Purchase created', purchase: { id: poId, po_number: poNumber, supplier_id, total, items: purchasedItems } });
});

router.get('/purchases', (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  let sql = 'SELECT po.*, s.name as supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON po.supplier_id = s.id';
  const total = safeGet('SELECT COUNT(*) as total FROM purchase_orders');
  const items = safeAll(sql + ' ORDER BY po.created_at DESC LIMIT ? OFFSET ?', [parseInt(limit), (parseInt(page) - 1) * parseInt(limit)]);
  items.forEach(po => {
    po.items = safeAll('SELECT pi.*, p.name as product_name FROM purchase_items pi LEFT JOIN products p ON pi.product_id = p.id WHERE pi.po_id = ?', [po.id]);
  });
  res.json({ items, total: total ? total.total : 0, page: parseInt(page), limit: parseInt(limit) });
});

router.post('/products/:id/movement', (req, res) => {
  const product = get('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const { type, quantity, notes } = req.body;
  if (!type) return res.status(400).json({ error: 'type is required' });
  const qty = parseInt(quantity) || 0;
  if (!qty) return res.status(400).json({ error: 'quantity must be a non-zero number' });
  const t = String(type).toLowerCase();
  const adds = ['purchase', 'return', 'adjustment_add'];
  const subtracts = ['sale', 'damage', 'transfer', 'adjustment_remove'];
  let newStock = product.stock;
  if (adds.includes(t)) newStock += Math.abs(qty);
  else if (subtracts.includes(t)) newStock -= Math.abs(qty);
  else if (t === 'adjustment') newStock += qty;
  else return res.status(400).json({ error: 'Unsupported movement type: ' + type });
  newStock = Math.max(0, newStock);
  run('UPDATE products SET stock = ? WHERE id = ?', [newStock, req.params.id]);
  run('INSERT INTO inventory_transactions (product_id, transaction_type, quantity, notes, created_by) VALUES (?, ?, ?, ?, ?)',
    [req.params.id, t, qty, notes || '', req.user.id]);
  logAudit({ req, action: 'STOCK_MOVEMENT', entity_type: 'product', entity_id: product.id, entity_name: product.name, previous_value: product.stock, new_value: newStock });
  res.json({ message: 'Stock updated', new_stock: newStock, movement_type: t });
});

router.get('/inventory/low-stock', (req, res) => {
  const items = all('SELECT * FROM products WHERE is_active = 1 AND stock <= minimum_stock ORDER BY (stock - minimum_stock) ASC');
  res.json({ items, total: items.length });
});

router.post('/pos/orders/:id/refund', (req, res) => {
  const order = get('SELECT * FROM pos_orders WHERE id = ?', [req.params.id]);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const { reason } = req.body;
  const orderItems = all('SELECT * FROM pos_order_items WHERE order_id = ?', [order.id]);
  orderItems.forEach(it => {
    run('UPDATE products SET stock = stock + ? WHERE id = ?', [it.quantity, it.product_id]);
    run('INSERT INTO inventory_transactions (product_id, transaction_type, quantity, reference_id, reference_type, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [it.product_id, 'return', it.quantity, order.id, 'pos_refund', reason || 'POS order refund', req.user.id]);
  });
  run("UPDATE pos_orders SET payment_status = 'refunded' WHERE id = ?", [order.id]);
  const payment = get('SELECT * FROM payments WHERE notes = ?', ['POS Order ' + order.order_number]);
  if (payment) {
    try {
      run('INSERT INTO refunds (payment_id, amount, reason, status, processed_by, processed_at) VALUES (?, ?, ?, ?, ?, ?)',
        [payment.id, order.total, reason || 'POS order refund', 'processed', req.user.id, new Date().toISOString()]);
    } catch (e) {}
  }
  logAudit({ req, action: 'REFUND', entity_type: 'pos_order', entity_id: order.id, entity_name: order.order_number, previous_value: order.payment_status, new_value: 'refunded' });
  res.json({ message: 'Order refunded and items restocked', order_number: order.order_number });
});

module.exports = router;