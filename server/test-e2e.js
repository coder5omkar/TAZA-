/* ==========================================================================
   Smoke test — run with the server running:  node server/test-e2e.js
   Tests: health, login (admin+customer), catalogue, place order (TS id +
   10 PM cycle), order listing, admin confirm, procurement, chat round-trip,
   static pages. Prints PASS/FAIL for each step.
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

  const custLogin = await req('POST', '/api/auth/login', { email: 'ravi.k@gmail.com', password: 'ravi@123' });
  check('customer login', custLogin.status === 200 && custLogin.data.user.role === 'customer', custLogin.data.user && custLogin.data.user.role);
  const custToken = custLogin.data.token;

  const badLogin = await req('POST', '/api/auth/login', { email: 'ravi.k@gmail.com', password: 'wrong' });
  check('wrong password rejected', badLogin.status === 401);

  /* 3. catalogue */
  const prods = await req('GET', '/api/products');
  check('catalogue has 39 products (incl. 100g/gram items)', prods.status === 200 && prods.data.products.length >= 39, (prods.data.products || []).length + ' products');

  /* 3b. cleanup: close any open orders from previous runs so checks are deterministic */
  const openBefore = await req('GET', '/api/orders', null, adminToken);
  for (const ord of (openBefore.data.orders || [])) {
    if (ord.status === 'pending' || ord.status === 'confirmed') {
      await req('PATCH', '/api/orders/' + ord.id + '/status', { status: 'delivered' }, adminToken);
    }
  }

  /* 4. place order (customer) → creates a NEW order */
  const tomato = prods.data.products.find(function (p) { return p.name === 'Tomato'; });
  const apple = prods.data.products.find(function (p) { return p.name === 'Apple'; });
  const cucumber = prods.data.products.find(function (p) { return p.name === 'Cucumber'; });
  const order = await req('POST', '/api/orders', {
    items: [{ productId: tomato.id, qty: 2 }, { productId: apple.id, qty: 1 }],
    slot: 'morning',
    payment: 'upi',
    address: '12, Green Park Society, MG Road, Pune 411001'
  }, custToken);
  const o = order.data.order || {};
  check('place order → new TS id (not merged)', order.status === 201 && !order.data.merged && /^TS\d{6}$/.test(o.id || ''), o.id);
  check('order amount = 2×₹2 + ₹2 + ₹3 fee = ₹9', Number(o.amount) === 9, '₹' + o.amount);
  check('cycle is tomorrow or day-after', o.cycle === 'tomorrow' || o.cycle === 'day-after', o.cycle + ' → ' + o.deliveryDate);

  /* 5. same-day second order MERGES into the open order (same id) */
  const mergeOrder = await req('POST', '/api/orders', {
    items: [{ productId: tomato.id, qty: 1 }],
    slot: 'morning',
    payment: 'upi',
    address: '12, Green Park Society, MG Road, Pune 411001'
  }, custToken);
  const mo = mergeOrder.data.order || {};
  check('second order merges into open order (same id)', mergeOrder.status === 200 && mergeOrder.data.merged === true && mo.id === o.id, mo.id);
  check('merged amount = ₹9 + 1×₹2 = ₹11', Number(mo.amount) === 11, '₹' + mo.amount);

  /* 5b. half-kg addition also merges (0.5 steps for KG items) */
  const halfOrder = await req('POST', '/api/orders', {
    items: [{ productId: cucumber.id, qty: 0.5 }],
    slot: 'morning',
    payment: 'upi',
    address: '12, Green Park Society, MG Road, Pune 411001'
  }, custToken);
  const ho = halfOrder.data.order || {};
  check('0.5 kg addition merges (₹11 + 0.5×₹1 = ₹11.5)', halfOrder.data.merged === true && Number(ho.amount) === 11.5, '₹' + ho.amount);

  /* short-capacity guard: empty bag rejected */
  const emptyBag = await req('POST', '/api/orders', { items: [], slot: 'morning', payment: 'upi', address: 'x' }, custToken);
  check('empty bag rejected', emptyBag.status === 400);

  /* 6. customer sees one order with merged quantities */
  const mine = await req('GET', '/api/orders', null, custToken);
  const mineOrder = (mine.data.orders || []).find(function (x) { return x.id === o.id; });
  const hasTomato3 = mineOrder && mineOrder.items.some(function (i) { return i.name === 'Tomato' && Number(i.qty) === 3; });
  const hasCucumberHalf = mineOrder && mineOrder.items.some(function (i) { return i.name === 'Cucumber' && Number(i.qty) === 0.5; });
  check('one order holds merged items (Tomato ×3, Cucumber ×0.5)', !!mineOrder && hasTomato3 && hasCucumberHalf, mineOrder ? mineOrder.items.map(function (i) { return i.name + '×' + i.qty; }).join(', ') : 'not found');

  /* 6. admin confirms */
  const confirm = await req('PATCH', '/api/orders/' + o.id + '/status', { status: 'confirmed' }, adminToken);
  check('admin confirm order', confirm.status === 200 && confirm.data.status === 'confirmed');

  /* 7. procurement list follows the cycle rule:
        before-cutoff orders (cycle=tomorrow) must appear; after-cutoff
        orders (cycle=day-after) must NOT be in tonight's list */
  const proc = await req('GET', '/api/admin/procurement', null, adminToken);
  const procTomato = (proc.data.rows || []).find(function (r) { return r.name === 'Tomato'; });
  const expectInProc = o.cycle === 'tomorrow';
  check(
    'procurement follows cycle rule (' + o.cycle + ')',
    proc.status === 200 && (expectInProc ? (procTomato && Number(procTomato.qty) >= 2) : !procTomato),
    expectInProc ? (procTomato ? 'qty ' + procTomato.qty : 'missing from list') : 'correctly excluded (after 10 PM → next cycle)'
  );

  /* 8. chat round-trip */
  const c1 = await req('POST', '/api/chat/my', { text: 'Hi, is the spinach fresh today?' }, custToken);
  check('customer sends chat', c1.status === 201);
  const convs = await req('GET', '/api/chat/conversations', null, adminToken);
  const conv = (convs.data.conversations || []).find(function (c) { return c.name === 'Ravi Kumar'; });
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
