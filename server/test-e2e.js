/* ==========================================================================
   Smoke test — run with the server running:  node server/test-e2e.js
   Uses a dedicated QA customer (qa.tester@taza.test) for all order flows, so
   real customer orders are NEVER created or modified by the tests.
   Tests: health, login (admin+QA customer), catalogue, place order (TS id +
   10 PM cycle), order listing, admin confirm, procurement, chat round-trip,
   status changes, static pages. Prints PASS/FAIL for each step.
   ========================================================================== */

const BASE = process.env.BASE || 'http://127.0.0.1:3000';

async function req(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(BASE + path, {
    method: method,
    headers: headers,
    body: body ? JSON.stringify(body) : undefined
  });
  let data = {};
  try { data = await res.json(); } catch (e) { /* non-JSON */ }
  return { status: res.status, data: data };
}

let failed = 0;
const results = [];
function check(name, ok, extra) {
  results.push((ok ? 'PASS' : 'FAIL') + '  ' + name + (extra ? '  → ' + extra : ''));
  if (!ok) failed++;
}

(async function () {
  /* 1. health */
  const health = await req('GET', '/api/health');
  check('health + database', health.status === 200 && health.data.ok === true, JSON.stringify(health.data));

  /* 2. logins */
  const adminLogin = await req('POST', '/api/auth/login', { email: 'hannah@vegfruit.shop', password: 'hannah@123' });
  check('admin login', adminLogin.status === 200 && adminLogin.data.user.role === 'admin', adminLogin.data.user && adminLogin.data.user.role);
  const adminToken = adminLogin.data.token;

  /* the tests use their own QA account — real customer orders are never touched */
  const QA = { name: 'QA Tester', email: 'qa.tester@taza.test', password: 'qa12345' };
  let custLogin = await req('POST', '/api/auth/login', { email: QA.email, password: QA.password });
  if (custLogin.status !== 200) {
    /* first run: register the account, then sign in */
    await req('POST', '/api/auth/register', { name: QA.name, email: QA.email, password: QA.password, phone: '9000000000' });
    custLogin = await req('POST', '/api/auth/login', { email: QA.email, password: QA.password });
  }
  check('customer login (dedicated QA account)', custLogin.status === 200 && custLogin.data.user.role === 'customer', custLogin.data.user && custLogin.data.user.role);
  const custToken = custLogin.data.token;

  const badLogin = await req('POST', '/api/auth/login', { email: QA.email, password: 'wrong-password' });
  check('wrong password rejected', badLogin.status === 401);

  /* 3. catalogue — the admin can disable items at runtime, so tests pick
        whatever is currently active instead of fixed product names */
  const prods = await req('GET', '/api/products');
  const activeProds = prods.data.products || [];
  const kgItems = activeProds.filter(function (p) { return p.unit === 'kg'; });
  check('catalogue served with orderable items', prods.status === 200 && activeProds.length >= 3 && kgItems.length >= 3, activeProds.length + ' active products');

  /* 3b. cleanup: close only the QA account's own open orders so checks are
        deterministic — real customers' orders are never modified */
  const openBefore = await req('GET', '/api/orders', null, custToken);
  for (const ord of (openBefore.data.orders || [])) {
    if (ord.status === 'pending' || ord.status === 'confirmed') {
      await req('PATCH', '/api/orders/' + ord.id + '/status', { status: 'delivered' }, adminToken);
    }
  }

  /* 4. place order (customer) → creates a NEW order */
  const itemA = kgItems[0];
  const itemB = kgItems[1];
  const itemC = kgItems[2];
  const sub1 = itemA.rate * 2 + itemB.rate;
  const disc1 = Math.round(sub1 * 0.03 * 10) / 10;
  const amt1 = Math.round((sub1 - disc1 + 3) * 10) / 10;

  const order = await req('POST', '/api/orders', {
    items: [{ productId: itemA.id, qty: 2 }, { productId: itemB.id, qty: 1 }],
    slot: 'morning',
    payment: 'upi',
    address: '12, Green Park Society, MG Road, Pune 411001'
  }, custToken);
  const o = order.data.order || {};
  const nowForId = new Date();
  const todayPrefix = 'TS' + String(nowForId.getFullYear()).slice(2) +
    String(nowForId.getMonth() + 1).padStart(2, '0') + String(nowForId.getDate()).padStart(2, '0');
  check('place order → new TS id TS·YY·MM·DD·NN', order.status === 201 && !order.data.merged && /^TS\d{8}$/.test(o.id || '') && (o.id || '').indexOf(todayPrefix) === 0, o.id);
  check('order amount = items − 3% UPI discount + ₹3 fee (₹' + amt1 + ')', Math.abs(Number(o.amount) - amt1) < 0.011, '₹' + o.amount);
  check('UPI discount recorded (3% = ₹' + disc1 + ')', Math.abs(Number(o.discount || 0) - disc1) < 0.011, '₹' + o.discount);
  check('new order starts unpaid (pay on delivery)', Number(o.paid || 0) === 0, 'paid=' + o.paid);
  check('cycle is tomorrow or day-after', o.cycle === 'tomorrow' || o.cycle === 'day-after', o.cycle + ' → ' + o.deliveryDate);

  /* 5. same-day second order MERGES into the open order (same id) */
  const sub2 = itemA.rate * 3 + itemB.rate;
  const disc2 = Math.round(sub2 * 0.03 * 10) / 10;
  const amt2 = Math.round((sub2 - disc2 + 3) * 10) / 10;
  const mergeOrder = await req('POST', '/api/orders', {
    items: [{ productId: itemA.id, qty: 1 }],
    slot: 'morning',
    payment: 'upi',
    address: '12, Green Park Society, MG Road, Pune 411001'
  }, custToken);
  const mo = mergeOrder.data.order || {};
  check('second order merges into open order (same id)', mergeOrder.status === 200 && mergeOrder.data.merged === true && mo.id === o.id, mo.id);
  check('merged amount recomputed (₹' + amt2 + ')', Math.abs(Number(mo.amount) - amt2) < 0.011, '₹' + mo.amount);

  /* 5b. half-kg addition also merges (0.5 steps for KG items) */
  const sub3 = sub2 + itemC.rate * 0.5;
  const disc3 = Math.round(sub3 * 0.03 * 10) / 10;
  const amt3 = Math.round((sub3 - disc3 + 3) * 10) / 10;
  const halfOrder = await req('POST', '/api/orders', {
    items: [{ productId: itemC.id, qty: 0.5 }],
    slot: 'morning',
    payment: 'upi',
    address: '12, Green Park Society, MG Road, Pune 411001'
  }, custToken);
  const ho = halfOrder.data.order || {};
  check('0.5 kg addition merges with recomputed total (₹' + amt3 + ')', halfOrder.data.merged === true && Math.abs(Number(ho.amount) - amt3) < 0.011, '₹' + ho.amount);

  /* short-capacity guard: empty bag rejected */
  const emptyBag = await req('POST', '/api/orders', { items: [], slot: 'morning', payment: 'upi', address: 'x' }, custToken);
  check('empty bag rejected', emptyBag.status === 400);

  /* 6. customer sees one order with merged quantities */
  const mine = await req('GET', '/api/orders', null, custToken);
  const mineOrder = (mine.data.orders || []).find(function (x) { return x.id === o.id; });
  const hasA3 = mineOrder && mineOrder.items.some(function (i) { return i.name === itemA.name && Number(i.qty) === 3; });
  const hasCHalf = mineOrder && mineOrder.items.some(function (i) { return i.name === itemC.name && Number(i.qty) === 0.5; });
  check('one order holds merged items (' + itemA.name + ' ×3, ' + itemC.name + ' ×0.5)', !!mineOrder && hasA3 && hasCHalf, mineOrder ? mineOrder.items.map(function (i) { return i.name + '×' + i.qty; }).join(', ') : 'not found');

  /* 6. admin confirms */
  const confirm = await req('PATCH', '/api/orders/' + o.id + '/status', { status: 'confirmed' }, adminToken);
  check('admin confirm order', confirm.status === 200 && confirm.data.status === 'confirmed');

  /* 7. procurement list follows the cycle rule:
        before-cutoff orders (cycle=tomorrow) must appear; after-cutoff
        orders (cycle=day-after) must NOT be in tonight's list */
  const proc = await req('GET', '/api/admin/procurement', null, adminToken);
  const procRow = (proc.data.rows || []).find(function (r) { return r.name === itemA.name; });
  const expectInProc = o.cycle === 'tomorrow';
  check(
    'procurement follows cycle rule (' + o.cycle + ')',
    proc.status === 200 && (expectInProc ? (procRow && Number(procRow.qty) >= 2) : !procRow),
    expectInProc ? (procRow ? 'qty ' + procRow.qty + ' of ' + itemA.name : 'missing from list') : 'correctly excluded (after 10 PM → next cycle)'
  );

  /* 8. chat round-trip */
  const c1 = await req('POST', '/api/chat/my', { text: 'Hi, is the spinach fresh today?' }, custToken);
  check('customer sends chat', c1.status === 201);
  const convs = await req('GET', '/api/chat/conversations', null, adminToken);
  const conv = (convs.data.conversations || []).find(function (c) { return c.name === 'QA Tester'; });
  check('admin inbox shows conversation with unread', !!conv && conv.unread >= 1, conv ? 'unread ' + conv.unread : 'missing');
  let reply = { status: 0 };
  if (conv) reply = await req('POST', '/api/chat/conversations/' + conv.id, { text: 'Yes! Picked this morning 🌿' }, adminToken);
  check('admin replies', reply.status === 201);
  const myChat = await req('GET', '/api/chat/my', null, custToken);
  check('customer sees admin reply', (myChat.data.messages || []).some(function (m) { return m.sender === 'admin'; }));

  /* 9. stats */
  const stats = await req('GET', '/api/admin/stats', null, adminToken);
  check('admin stats respond', stats.status === 200 && stats.data.orders.total >= 1, JSON.stringify(stats.data.orders));

  /* 10. static pages served */
  const page = await fetch(BASE + '/templates/login.html');
  const html = await page.text();
  check('login page served', page.status === 200 && html.indexOf('Welcome') !== -1);
  const adminPage = await fetch(BASE + '/admin/index.html');
  check('admin page served', adminPage.status === 200);

  /* 11. status can be changed at any stage — even after delivered */
  const toDelivered = await req('PATCH', '/api/orders/' + o.id + '/status', { status: 'delivered' }, adminToken);
  const toOnWay = await req('PATCH', '/api/orders/' + o.id + '/status', { status: 'on_way' }, adminToken);
  const toPending = await req('PATCH', '/api/orders/' + o.id + '/status', { status: 'pending' }, adminToken);
  const backDelivered = await req('PATCH', '/api/orders/' + o.id + '/status', { status: 'delivered' }, adminToken);
  check(
    'status changes at any stage (delivered → on_way → pending → delivered)',
    toDelivered.data.status === 'delivered' && toOnWay.data.status === 'on_way' &&
      toPending.data.status === 'pending' && backDelivered.status === 200
  );

  /* 12. payment collected flag (admin marks UPI scan / cash received) */
  const payTrue = await req('PATCH', '/api/orders/' + o.id + '/paid', { paid: true }, adminToken);
  const payRead = await req('GET', '/api/orders', null, custToken);
  const payOrd = (payRead.data.orders || []).find(function (x) { return x.id === o.id; });
  check('admin marks payment collected (paid flag)', payTrue.status === 200 && !!payOrd && Number(payOrd.paid) === 1, payOrd ? 'paid=' + payOrd.paid : 'order not found');

  /* 13. runtime enable/disable of any product (admin) */
  const adminProds = await req('GET', '/api/admin/products', null, adminToken);
  const anyProd = (adminProds.data.products || [])[0];
  check('admin product list includes the active flag', adminProds.status === 200 && !!anyProd && anyProd.active !== undefined, anyProd ? anyProd.name + ' active=' + anyProd.active : 'empty');
  const pubBefore = await req('GET', '/api/products');
  const wasVisible = (pubBefore.data.products || []).some(function (p) { return p.id === anyProd.id; });
  const disableRes = await req('PATCH', '/api/admin/products/' + anyProd.id, { active: false }, adminToken);
  const pubOff = await req('GET', '/api/products');
  const nowHidden = !(pubOff.data.products || []).some(function (p) { return p.id === anyProd.id; });
  const enableRes = await req('PATCH', '/api/admin/products/' + anyProd.id, { active: true }, adminToken);
  const pubOn = await req('GET', '/api/products');
  const backVisible = (pubOn.data.products || []).some(function (p) { return p.id === anyProd.id; });
  check('disable hides a product from the shop; enable brings it back', wasVisible && disableRes.status === 200 && nowHidden && enableRes.status === 200 && backVisible, anyProd.name);

  /* summary */
  console.log('');
  console.log(results.join('\n'));
  console.log('');
  console.log(failed === 0 ? 'All checks passed ✓' : failed + ' check(s) FAILED');
  process.exit(failed === 0 ? 0 : 1);
})().catch(function (e) {
  console.error('Test crashed:', e.message);
  console.error('Is the server running?  npm run dev');
  process.exit(1);
});
