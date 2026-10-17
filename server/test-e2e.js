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

  /* procurement baseline for itemA — real customers' orders also contain
     common items, so the cycle-rule check compares before/after quantities */
  const procBaseline = await req('GET', '/api/admin/procurement', null, adminToken);
  const procQtyOf = function (res, name) {
    const row = (res.data.rows || []).find(function (r) { return r.name === name; });
    return row ? Number(row.qty) : 0;
  };
  const beforeQtyA = procQtyOf(procBaseline, itemA.name);

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
  const deltaA = Math.round((procQtyOf(proc, itemA.name) - beforeQtyA) * 10) / 10;
  const expectedDelta = o.cycle === 'tomorrow' ? 3 : 0;   /* merged qty of itemA in our order */
  check(
    'procurement follows cycle rule (' + o.cycle + ')',
    proc.status === 200 && Math.abs(deltaA - expectedDelta) < 0.011,
    'Δ' + itemA.name + ' ' + deltaA + ' (expected ' + expectedDelta + ')'
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

  /* 14. customer cancels their own pending order — only while not yet confirmed */
  const cancelAttempt = await req('POST', '/api/orders', {
    items: [{ productId: itemA.id, qty: 1 }],
    slot: 'morning',
    payment: 'cod',
    address: '12, Green Park Society, MG Road, Pune 411001'
  }, custToken);
  const cancelId = (cancelAttempt.data.order || {}).id;
  const cancelled = await req('PATCH', '/api/orders/' + cancelId + '/cancel', {}, custToken);
  const cancelAgain = await req('PATCH', '/api/orders/' + cancelId + '/cancel', {}, custToken);
  const cancelDelivered = await req('PATCH', '/api/orders/' + o.id + '/cancel', {}, custToken);
  check(
    'customer cancels a pending order (not twice, not after delivery)',
    cancelAttempt.status === 201 && cancelled.status === 200 && cancelAgain.status === 409 && cancelDelivered.status === 409,
    cancelId + ' → cancel ' + cancelled.status + ', again ' + cancelAgain.status + ', delivered ' + cancelDelivered.status
  );

  /* 15. product photos + description (admin upload) */
  const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const mkForm = function () {
    const fd = new FormData();
    fd.append('image', new Blob([tinyPng], { type: 'image/png' }), 'test.png');
    return fd;
  };
  const upRes = await fetch(BASE + '/api/admin/products/' + anyProd.id + '/images', {
    method: 'POST', headers: { Authorization: 'Bearer ' + adminToken }, body: mkForm()
  });
  const upJson = await upRes.json().catch(function () { return {}; });
  check('admin uploads a product photo', upRes.status === 201 && !!upJson.image && !!upJson.image.url, upJson.image && upJson.image.url);
  const imgFetch = upJson.image ? await fetch(BASE + upJson.image.url) : { status: 0, headers: { get: function () { return ''; } } };
  check('uploaded photo is served as an image', imgFetch.status === 200 && String(imgFetch.headers.get('content-type')).indexOf('image') !== -1, imgFetch.status + ' ' + imgFetch.headers.get('content-type'));
  await req('PATCH', '/api/admin/products/' + anyProd.id, { description: 'Picked this morning — great for sabzi & salad.' }, adminToken);
  const pubWithImg = await req('GET', '/api/products');
  const enriched = (pubWithImg.data.products || []).find(function (p) { return p.id === anyProd.id; });
  check('public product carries description + photos', !!enriched && enriched.description.length > 0 && enriched.images.length >= 1, enriched ? '"' + enriched.description.slice(0, 24) + '…", ' + enriched.images.length + ' photo(s)' : 'missing');
  const delImg = await fetch(BASE + '/api/admin/product-images/' + (upJson.image ? upJson.image.id : 0), { method: 'DELETE', headers: { Authorization: 'Bearer ' + adminToken } });
  await req('PATCH', '/api/admin/products/' + anyProd.id, { description: '' }, adminToken);
  check('admin deletes the photo', delImg.status === 200);

  /* 16. customer profile photo */
  const avRes = await fetch(BASE + '/api/auth/avatar', {
    method: 'POST', headers: { Authorization: 'Bearer ' + custToken }, body: mkForm()
  });
  const avJson = await avRes.json().catch(function () { return {}; });
  const meAfter = await req('GET', '/api/auth/me', null, custToken);
  check('customer uploads a profile photo', avRes.status === 200 && !!avJson.user && !!avJson.user.avatar && meAfter.data.user.avatar === avJson.user.avatar, avJson.user ? avJson.user.avatar : 'failed');

  /* 17. delivery slots: admin timings + disabled slot enforcement */
  const slotSet0 = await req('GET', '/api/settings');
  check('public settings expose slot windows', slotSet0.status === 200 && slotSet0.data.morning_slot !== undefined && slotSet0.data.morning_from !== undefined, 'morning ' + slotSet0.data.morning_from + '–' + slotSet0.data.morning_to);

  await req('PUT', '/api/admin/settings', { morning_slot: 1, evening_slot: 0, morning_from: '07:30', morning_to: '09:30' }, adminToken);
  const slotSet1 = await req('GET', '/api/settings');
  const tryEvening = await req('POST', '/api/orders', {
    items: [{ productId: itemA.id, qty: 1 }],
    slot: 'evening',
    payment: 'cod',
    address: 'QA Lane, Test City'
  }, custToken);
  check(
    'disabled slot is rejected at checkout + admin times are live',
    Number(slotSet1.data.evening_slot) === 0 && slotSet1.data.morning_from === '07:30' && tryEvening.status === 400,
    'evening order → ' + tryEvening.status + ', morning from ' + slotSet1.data.morning_from
  );

  /* restore the default slot windows */
  await req('PUT', '/api/admin/settings', { morning_slot: 1, evening_slot: 1, morning_from: '08:00', morning_to: '10:00', evening_from: '19:00', evening_to: '22:00' }, adminToken);

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
