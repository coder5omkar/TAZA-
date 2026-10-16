/* ==========================================================================
   TAZA-PHAL-SABZI.COM - Admin panel script

   Dual mode:
   - LIVE  : an admin session exists (token from the shared login) -> every
             screen talks to the backend API (server/routes/*)
   - DEMO  : no backend / not signed in (e.g. opening the files directly)
             -> in-memory demo data so the design still demos standalone

   Workflow rules: 10:00 PM cutoff, TS.YY.MM.NN order ids (max 99/day),
   same-day confirm/reject, day-after cycle for late orders.
   ========================================================================== */

(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var money = function (n) {
    var v = Math.round(Number(n) * 10) / 10;
    return '₹' + (Number.isInteger(v) ? v : v.toFixed(1));
  };
  var fmtQty = function (n) {
    var v = Math.round(Number(n) * 10) / 10;
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
  };
  var esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  var LIVE = false;
  var editingProductId = null;
  var editingUserId = null;
  var activeConvId = null;

  /* ---------------- toast ---------------- */

  function toast(msg) {
    var el = $('#adminToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'adminToast';
      el.className = 'admin-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  function nowTime() {
    var d = new Date();
    var h = d.getHours();
    var m = d.getMinutes();
    return (h % 12 || 12) + ':' + (m < 10 ? '0' + m : m) + ' ' + (h >= 12 ? 'PM' : 'AM');
  }

  function fmtDay(dstr) {
    var d = new Date(String(dstr || '').replace(' ', 'T'));
    if (isNaN(d.getTime())) return String(dstr || '');
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  function fmtDayTime(dstr) {
    var d = new Date(String(dstr || '').replace(' ', 'T'));
    if (isNaN(d.getTime())) return String(dstr || '');
    var h = d.getHours();
    var m = d.getMinutes();
    return fmtDay(dstr) + ', ' + (h % 12 || 12) + ':' + (m < 10 ? '0' + m : m) + ' ' + (h >= 12 ? 'PM' : 'AM');
  }

  function fmtLong(dstr) {
    var d = new Date(String(dstr || '').replace(' ', 'T'));
    if (isNaN(d.getTime())) return String(dstr || '');
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function fmtClock(dstr) {
    var d = new Date(String(dstr || '').replace(' ', 'T'));
    if (isNaN(d.getTime())) return String(dstr || '');
    var h = d.getHours();
    var m = d.getMinutes();
    return (h % 12 || 12) + ':' + (m < 10 ? '0' + m : m) + ' ' + (h >= 12 ? 'PM' : 'AM');
  }

  function dbStamp() {
    var d = new Date();
    var p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' +
      p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  /* operational day: runs 10:00 PM -> 10:00 PM (late-night orders belong to the next day) */
  function opDayKey(dateLike) {
    var d;
    if (dateLike instanceof Date) {
      d = dateLike;
    } else {
      d = new Date(String(dateLike || '').replace(' ', 'T'));
      if (isNaN(d.getTime())) {
        var m = String(dateLike || '').match(/^(\d{1,2})\s+([A-Za-z]{3})/);
        if (m) {
          var mm = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(m[2]);
          d = new Date(new Date().getFullYear(), mm, parseInt(m[1], 10), 12, 0, 0);
        }
      }
    }
    if (!d || isNaN(d.getTime())) return 'unknown';
    d = new Date(d.getTime() + 2 * 3600 * 1000);
    var p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function opDayLabel(key) {
    var today = opDayKey(new Date());
    var yest = opDayKey(new Date(Date.now() - 24 * 3600 * 1000));
    if (key === today) return 'Today · orders since 10 PM last night';
    if (key === yest) return 'Yesterday';
    if (key === 'unknown') return 'Earlier';
    return fmtLong(key);
  }

  /* ---------------- demo data (fallback) ---------------- */

  var DEMO = {
    users: [
      { id: 'USR-1001', rawId: null, name: 'Hannah', email: 'hannah@vegfruit.shop', phone: '+91 98200 11001', address: '12, Green Park Society, MG Road, Pune 411001', role: 'admin', password: 'hannah@123', status: 'active', joined: '12 Jun 2025' },
      { id: 'USR-1002', rawId: null, name: 'Ravi Kumar', email: 'ravi.k@gmail.com', phone: '+91 98200 11002', address: 'Flat 302, Sai Residency, Baner, Pune 411045', role: 'customer', password: 'ravi@123', status: 'active', joined: '18 Jun 2025' },
      { id: 'USR-1003', rawId: null, name: 'Priya Sharma', email: 'priya.s@yahoo.com', phone: '+91 98200 11003', address: '7, Rose Villa, Kothrud, Pune 411038', role: 'customer', password: 'priya@456', status: 'active', joined: '21 Jun 2025' },
      { id: 'USR-1004', rawId: null, name: 'Amit Patel', email: 'amit@outlook.com', phone: '+91 98200 11004', address: '21, Shanti Nagar, Wakad, Pune 411057', role: 'delivery', password: 'amit@789', status: 'active', joined: '25 Jun 2025' },
      { id: 'USR-1005', rawId: null, name: 'Sneha Joshi', email: 'sneha.j@gmail.com', phone: '+91 98200 11005', address: '5-B, Lake View, Viman Nagar, Pune 411014', role: 'customer', password: 'sneha@321', status: 'suspended', joined: '02 Jul 2025' },
      { id: 'USR-1006', rawId: null, name: 'Vikram Rao', email: 'vikram@store.com', phone: '+91 98200 11006', address: 'Store HQ, FC Road, Pune 411004', role: 'admin', password: 'vikram@654', status: 'active', joined: '05 Jul 2025' },
      { id: 'USR-1007', rawId: null, name: 'Neha Gupta', email: 'neha.g@gmail.com', phone: '+91 98200 11007', address: '88, Green Meadows, Hinjewadi, Pune 411057', role: 'customer', password: 'neha@987', status: 'active', joined: '11 Jul 2025' },
      { id: 'USR-1008', rawId: null, name: 'Rahul Singh', email: 'rahul@deliver.in', phone: '+91 98200 11008', address: '3, Workers Colony, Hadapsar, Pune 411028', role: 'delivery', password: 'rahul@135', status: 'active', joined: '14 Jul 2025' }
    ],
    orders: [
      { id: 'TS261016', customer: 'Ravi Kumar', address: 'Flat 302, Sai Residency, Baner, Pune 411045', items: [{ name: 'Tomato', qty: 1, unit: 'kg' }, { name: 'Coriander', qty: 1, unit: 'bunch' }], amount: 6, slot: 'Morning 8–10 AM', payment: 'UPI', paid: false, placed: '15 Oct, 10:12 PM', delivery: '17 Oct', cycle: 'day-after', status: 'Pending' },
      { id: 'TS261015', customer: 'Amit Patel', address: '21, Shanti Nagar, Wakad, Pune 411057', items: [{ name: 'Tomato', qty: 2, unit: 'kg' }, { name: 'Potato', qty: 1, unit: 'kg' }], amount: 8, slot: 'Morning 8–10 AM', payment: 'COD', paid: false, placed: '15 Oct, 8:42 PM', delivery: '16 Oct', cycle: 'tomorrow', status: 'Pending' },
      { id: 'TS261014', customer: 'Priya Sharma', address: '7, Rose Villa, Kothrud, Pune 411038', items: [{ name: 'Spinach', qty: 2, unit: 'bunch' }, { name: 'Carrot', qty: 1, unit: 'kg' }, { name: 'Apple', qty: 1, unit: 'pack' }, { name: 'Grapes', qty: 1, unit: 'kg' }, { name: 'Orange', qty: 1, unit: 'dozen' }], amount: 18, slot: 'Evening 7–10 PM', payment: 'UPI', paid: false, placed: '15 Oct, 8:10 PM', delivery: '16 Oct', cycle: 'tomorrow', status: 'Pending' },
      { id: 'TS261013', customer: 'Ravi Kumar', address: 'Flat 302, Sai Residency, Baner, Pune 411045', items: [{ name: 'Onion', qty: 1, unit: 'kg' }, { name: 'Capsicum', qty: 1, unit: 'kg' }, { name: 'Coriander', qty: 1, unit: 'bunch' }], amount: 9, slot: 'Morning 8–10 AM', payment: 'UPI', paid: false, placed: '15 Oct, 7:05 PM', delivery: '16 Oct', cycle: 'tomorrow', status: 'Confirmed' },
      { id: 'TS261012', customer: 'Neha Gupta', address: '88, Green Meadows, Hinjewadi, Pune 411057', items: [{ name: 'Tomato', qty: 1, unit: 'kg' }, { name: 'Brinjal', qty: 1, unit: 'kg' }, { name: 'Mango', qty: 1, unit: 'kg' }, { name: 'Banana', qty: 1, unit: 'dozen' }, { name: 'Cherry', qty: 1, unit: 'pack' }, { name: 'Melon', qty: 1, unit: 'piece' }], amount: 18, slot: 'Evening 7–10 PM', payment: 'UPI', paid: false, placed: '15 Oct, 6:30 PM', delivery: '16 Oct', cycle: 'tomorrow', status: 'Confirmed' },
      { id: 'TS261011', customer: 'Hannah', address: '12, Green Park Society, MG Road, Pune 411001', items: [{ name: 'Spinach', qty: 1, unit: 'bunch' }, { name: 'Apple', qty: 1, unit: 'pack' }], amount: 8, slot: 'Morning 8–10 AM', payment: 'COD', paid: false, placed: '15 Oct, 5:12 PM', delivery: '16 Oct', cycle: 'tomorrow', status: 'On the way' },
      { id: 'TS261010', customer: 'Hannah', address: '12, Green Park Society, MG Road, Pune 411001', items: [{ name: 'Grapes', qty: 1, unit: 'kg' }, { name: 'Kiwi', qty: 2, unit: 'piece' }], amount: 8, slot: 'Morning 8–10 AM', payment: 'UPI', paid: false, placed: '15 Oct, 9:15 AM', delivery: '—', cycle: 'tomorrow', status: 'Rejected' },
      { id: 'TS261003', customer: 'Hannah', address: '12, Green Park Society, MG Road, Pune 411001', items: [{ name: 'Potato', qty: 1, unit: 'kg' }, { name: 'Spinach', qty: 1, unit: 'bunch' }, { name: 'Lettuce', qty: 1, unit: 'bunch' }], amount: 9, slot: 'Morning 8–10 AM', payment: 'UPI', paid: true, placed: '14 Oct, 7:40 PM', delivery: '15 Oct', cycle: 'tomorrow', status: 'Delivered' },
      { id: 'TS261002', customer: 'Hannah', address: '12, Green Park Society, MG Road, Pune 411001', items: [{ name: 'Apple', qty: 1, unit: 'pack' }, { name: 'Carrot', qty: 1, unit: 'kg' }], amount: 7, slot: 'Evening 7–10 PM', payment: 'COD', paid: true, placed: '14 Oct, 6:05 PM', delivery: '15 Oct', cycle: 'tomorrow', status: 'Delivered' }
    ],
    products: [
      { name: 'Potato', emoji: '🥔', cat: 'veg', unit: 'kg', rate: 1, section: 'kg' },
      { name: 'Tomato', emoji: '🍅', cat: 'veg', unit: 'kg', rate: 2, section: 'kg' },
      { name: 'Onion', emoji: '🧅', cat: 'veg', unit: 'kg', rate: 2, section: 'kg' },
      { name: 'Cucumber', emoji: '🥒', cat: 'veg', unit: 'kg', rate: 1, section: 'kg' },
      { name: 'Sweet Potato', emoji: '🍠', cat: 'veg', unit: 'kg', rate: 1, section: 'kg' },
      { name: 'Carrot', emoji: '🥕', cat: 'veg', unit: 'kg', rate: 2, section: 'kg' },
      { name: 'Brinjal', emoji: '🍆', cat: 'veg', unit: 'kg', rate: 2, section: 'kg' },
      { name: 'Capsicum', emoji: '🫑', cat: 'veg', unit: 'kg', rate: 3, section: 'kg' },
      { name: 'Pumpkin', emoji: '🎃', cat: 'veg', unit: 'kg', rate: 1, section: 'kg' },
      { name: 'Broccoli', emoji: '🥦', cat: 'veg', unit: 'kg', rate: 3, section: 'kg' },
      { name: 'Cabbage', emoji: '🥬', cat: 'veg', unit: 'kg', rate: 1, section: 'kg' },
      { name: 'Spinach', emoji: '🥬', cat: 'veg', unit: 'bunch', rate: 3, section: 'bunch' },
      { name: 'Fenugreek Leaves', emoji: '🌿', cat: 'veg', unit: 'bunch', rate: 2, section: 'bunch' },
      { name: 'Dill', emoji: '🌱', cat: 'veg', unit: 'bunch', rate: 2, section: 'bunch' },
      { name: 'Sorrel', emoji: '🥬', cat: 'veg', unit: 'bunch', rate: 2, section: 'bunch' },
      { name: 'Lettuce', emoji: '🥗', cat: 'veg', unit: 'bunch', rate: 2, section: 'bunch' },
      { name: 'Ginger', emoji: '🫚', cat: 'veg', unit: '100 g', rate: 2, section: 'gram' },
      { name: 'Garlic', emoji: '🧄', cat: 'veg', unit: '100 g', rate: 1, section: 'gram' },
      { name: 'Coriander', emoji: '🌿', cat: 'veg', unit: '100 g', rate: 1, section: 'gram' },
      { name: 'Curry Leaves', emoji: '🍃', cat: 'veg', unit: '100 g', rate: 1, section: 'gram' },
      { name: 'Green Chilli', emoji: '🌶️', cat: 'veg', unit: '100 g', rate: 1, section: 'gram' },
      { name: 'Sweet Corn', emoji: '🌽', cat: 'veg', unit: 'piece', rate: 1, section: 'piece_pack' },
      { name: 'Mushroom', emoji: '🍄', cat: 'veg', unit: 'pack', rate: 4, section: 'piece_pack' },
      { name: 'Mango', emoji: '🥭', cat: 'fruits', unit: 'kg', rate: 4, section: 'kg' },
      { name: 'Grapes', emoji: '🍇', cat: 'fruits', unit: 'kg', rate: 3, section: 'kg' },
      { name: 'Orange', emoji: '🍊', cat: 'fruits', unit: 'kg', rate: 2, section: 'kg' },
      { name: 'Watermelon', emoji: '🍉', cat: 'fruits', unit: 'kg', rate: 1, section: 'kg' },
      { name: 'Peach', emoji: '🍑', cat: 'fruits', unit: 'kg', rate: 3, section: 'kg' },
      { name: 'Pear', emoji: '🍐', cat: 'fruits', unit: 'kg', rate: 2, section: 'kg' },
      { name: 'Melon', emoji: '🍈', cat: 'fruits', unit: 'kg', rate: 2, section: 'kg' },
      { name: 'Banana', emoji: '🍌', cat: 'fruits', unit: 'dozen', rate: 2, section: 'dozen_piece' },
      { name: 'Lemon', emoji: '🍋', cat: 'fruits', unit: 'piece', rate: 1, section: 'dozen_piece' },
      { name: 'Pineapple', emoji: '🍍', cat: 'fruits', unit: 'piece', rate: 2, section: 'dozen_piece' },
      { name: 'Kiwi', emoji: '🥝', cat: 'fruits', unit: 'piece', rate: 1, section: 'dozen_piece' },
      { name: 'Coconut', emoji: '🥥', cat: 'fruits', unit: 'piece', rate: 2, section: 'dozen_piece' },
      { name: 'Avocado', emoji: '🥑', cat: 'fruits', unit: 'piece', rate: 2, section: 'dozen_piece' },
      { name: 'Apple', emoji: '🍎', cat: 'fruits', unit: 'pack', rate: 2, section: 'pack' },
      { name: 'Strawberry', emoji: '🍓', cat: 'fruits', unit: 'pack', rate: 4, section: 'pack' },
      { name: 'Cherry', emoji: '🍒', cat: 'fruits', unit: 'pack', rate: 3, section: 'pack' }
    ],
    conversations: [
      { id: 'c1', name: 'Ravi Kumar', order: 'TS261013', online: true, unread: 2, messages: [
        { from: 'them', text: 'Hi, can I add 1 kg tomato to my order? 🙏', time: '8:05 PM' },
        { from: 'them', text: 'Also please deliver before 9 AM if possible.', time: '8:06 PM' }
      ] },
      { id: 'c2', name: 'Priya Sharma', order: 'TS261014', online: true, unread: 1, messages: [
        { from: 'them', text: 'Is the strawberry fresh today?', time: '7:58 PM' }
      ] },
      { id: 'c3', name: 'Amit Patel', order: 'TS261015', online: false, unread: 0, messages: [
        { from: 'them', text: 'Please make sure the potatoes are not sprouted.', time: '6:40 PM' },
        { from: 'me', text: 'Sure, we will pick the freshest ones for you 🌿', time: '6:44 PM' }
      ] },
      { id: 'c4', name: 'Neha Gupta', order: 'TS261012', online: false, unread: 0, messages: [
        { from: 'them', text: 'Thank you for the quick delivery yesterday!', time: '10:02 AM' },
        { from: 'me', text: 'Happy to help 🌿 See you in tomorrow\'s cycle.', time: '10:05 AM' }
      ] }
    ],
    settings: { store_name: 'TAZA-PHAL-SABZI.COM', support_phone: '+91 98200 11001', delivery_fee: 3, cutoff_hour: 22, morning_slot: 1, evening_slot: 1, upi_enabled: 1, cod_enabled: 1 }
  };

  var state = {
    users: [], orders: [], products: [], conversations: [],
    stats: null, procurement: null, settings: null
  };

  /* ---------------- icons ---------------- */

  var ICONS = {
    dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    orders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
    messages: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    products: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.83z"/><circle cx="7" cy="7" r="1.2"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>',
    pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>',
    ban: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M4.93 4.93l14.14 14.14"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>'
  };

  var NAV = [
    { page: 'dashboard', href: 'index.html', label: 'Dashboard', icon: ICONS.dashboard },
    { page: 'orders', href: 'orders.html', label: 'Orders', icon: ICONS.orders },
    { page: 'messages', href: 'messages.html', label: 'Messages', icon: ICONS.messages },
    { page: 'users', href: 'users.html', label: 'Users', icon: ICONS.users },
    { page: 'products', href: 'products.html', label: 'Products', icon: ICONS.products },
    { page: 'settings', href: 'settings.html', label: 'Settings', icon: ICONS.settings }
  ];

  function renderSidebar() {
    var el = $('#adminSidebar');
    if (!el) return;
    var active = el.getAttribute('data-active');
    el.innerHTML =
      '<div class="brand"><img src="logo.svg" alt="TAZA-PHAL-SABZI.COM" /><div><b>TAZA Admin</b><span>Phal-Sabzi Panel</span></div></div>' +
      NAV.map(function (n) {
        return '<a class="nav-item' + (n.page === active ? ' active' : '') + '" href="' + n.href + '">' + n.icon + '<span>' + n.label + '</span></a>';
      }).join('') +
      '<div class="spacer"></div>' +
      '<div class="admin-user"><img src="logo.svg" alt="" /><div><b id="sidebarAdminName">Admin</b><span>Super Admin</span></div></div>' +
      '<a class="nav-item logout" id="adminLogout" href="../templates/login.html">' + ICONS.logout + '<span>Log Out</span></a>';
  }

  /* ---------------- shared bits ---------------- */

  var STATUS_CLASS = { 'Pending': 'pending', 'Confirmed': 'confirmed', 'On the way': 'way', 'Delivered': 'delivered', 'Rejected': 'rejected' };

  function statusPill(status) {
    return '<span class="pill ' + (STATUS_CLASS[status] || '') + '">' + esc(status) + '</span>';
  }

  function slotLabel(slot) { return slot === 'evening' ? 'Evening 7–10 PM' : 'Morning 8–10 AM'; }

  function mapOrder(o) {
    return {
      id: o.id,
      customer: o.customer_name,
      items: o.items || [],
      amount: Number(o.amount),
      slot: slotLabel(o.slot),
      payment: String(o.payment || '').toUpperCase(),
      placed: fmtDayTime(o.placed_at),
      placedAt: o.placed_at,
      delivery: o.status === 'rejected' ? '—' : fmtDay(o.delivery_date),
      deliveryDate: o.delivery_date,
      cycle: o.cycle,
      status: o.status === 'on_way' ? 'On the way' : o.status.charAt(0).toUpperCase() + o.status.slice(1),
      address: o.address || '',
      fee: o.delivery_fee != null ? Number(o.delivery_fee) : null,
      discount: Number(o.discount || 0),
      paid: !!Number(o.paid)
    };
  }

  /* ---------------- orders ---------------- */

  var orderFilter = 'All';
  var ORDER_STATUSES = ['Pending', 'Confirmed', 'On the way', 'Delivered', 'Rejected'];
  var ORDER_STATUS_API = { 'Pending': 'pending', 'Confirmed': 'confirmed', 'On the way': 'on_way', 'Delivered': 'delivered', 'Rejected': 'rejected' };
  var expandedOrders = {};

  /* "1.5 kg", "2 bunch", "200 g" — same units the customer ordered */
  function itemQtyText(it) {
    var unit = it && it.unit != null ? String(it.unit) : '';
    var qty = Number(it && it.qty) || 0;
    if (unit === '100 g') return fmtQty(qty * 100) + ' g';
    if (!unit) return fmtQty(qty);
    return fmtQty(qty) + ' ' + unit;
  }

  function orderActions(o) {
    var html = '';
    var open = !!expandedOrders[o.id];
    if (o.status === 'Pending') {
      html += '<button class="btn success small" data-act="confirm" data-id="' + esc(o.id) + '">Confirm</button>';
      html += '<button class="btn danger small" data-act="reject" data-id="' + esc(o.id) + '">Reject</button>';
    } else if (o.status === 'Confirmed') {
      html += '<button class="btn ghost small" data-act="set-status" data-id="' + esc(o.id) + '" data-status="On the way">On the way</button>';
      html += '<button class="btn success small" data-act="set-status" data-id="' + esc(o.id) + '" data-status="Delivered">Delivered</button>';
    } else if (o.status === 'On the way') {
      html += '<button class="btn success small" data-act="set-status" data-id="' + esc(o.id) + '" data-status="Delivered">Delivered</button>';
    } else {
      /* delivered / rejected — reopen or switch to any status from the expanded panel */
      html += '<button class="btn ghost small" data-act="set-status" data-id="' + esc(o.id) + '" data-status="Pending">Reopen</button>';
    }
    html += '<button class="btn ghost small" data-act="expand" data-id="' + esc(o.id) + '">' + (open ? 'Hide items' : 'Items') + '</button>';
    return html;
  }

  function orderDetailRow(o) {
    var items = o.items || [];

    /* items to pack: name, ordered quantity + unit, rate, line amount */
    var lines = items.map(function (it) {
      var hasRate = it.rate != null;
      var amount = hasRate ? Number(it.rate) * Number(it.qty) : null;
      return '<div class="od-line">' +
        '<b>' + esc(it.name) + '</b>' +
        '<span class="od-qty">×' + itemQtyText(it) + '</span>' +
        (hasRate ? '<span class="od-rate">' + money(Number(it.rate)) + ' /' + esc(String(it.unit || 'unit')) + '</span>' : '') +
        (amount != null ? '<em>' + money(amount) + '</em>' : '') +
        '</div>';
    }).join('') || '<p class="muted">No line items</p>';

    var hasRates = items.some(function (it) { return it.rate != null; });
    var totals = '';
    if (hasRates) {
      var sub = items.reduce(function (s, it) { return s + Number(it.rate || 0) * Number(it.qty || 0); }, 0);
      var fee = o.fee != null ? o.fee : 0;
      totals += '<div class="od-total"><span>Subtotal</span><b>' + money(sub) + '</b></div>';
      totals += '<div class="od-total"><span>Delivery</span><b>' + money(fee) + '</b></div>';
      if (o.discount > 0) totals += '<div class="od-total"><span>UPI discount (3%)</span><b>−' + money(o.discount) + '</b></div>';
    }
    totals += '<div class="od-total grand"><span>' + (hasRates ? 'Total' : 'Order total') + '</span><b>' + money(o.amount) + '</b></div>';

    var statusBtns = ORDER_STATUSES.map(function (s) {
      return '<button class="status-btn' + (s === o.status ? ' active' : '') + '"' +
        ' data-act="set-status" data-id="' + esc(o.id) + '" data-status="' + s + '">' + s + '</button>';
    }).join('');

    return '<tr class="order-detail-row"><td colspan="7">' +
      '<div class="od-grid">' +
      '<div class="od-items">' +
      '<h4>Items to pack <span>' + items.length + '</span></h4>' + lines +
      '<div class="od-totals">' + totals + '</div>' +
      '</div>' +
      '<div class="od-side">' +
      '<h4>Order details</h4>' +
      '<div class="od-meta">' +
      '<div class="kv"><span>Customer</span><b>' + esc(o.customer) + '</b></div>' +
      '<div class="kv"><span>Payment</span><b>' + (o.payment === 'COD' ? 'COD' : 'UPI') + ' · ' + (o.paid ? 'paid' : 'pay at delivery') + '</b></div>' +
      '<div class="kv"><span>Placed</span><b>' + esc(o.placed) + '</b></div>' +
      '<div class="kv"><span>Delivery</span><b>' + esc(o.delivery) + '</b></div>' +
      '<div class="kv"><span>Address</span><b>' + esc(o.address || '—') + '</b></div>' +
      '</div>' +
      '<div class="od-paid-row">' +
      (o.paid ? '<span class="pill delivered">Paid</span>' : '<span class="pill pending">Unpaid</span>') +
      '<button class="btn ghost small" data-act="toggle-paid" data-id="' + esc(o.id) + '">' + (o.paid ? 'Mark as unpaid' : 'Mark as paid') + '</button>' +
      '</div>' +
      '<h4>Change status</h4>' +
      '<div class="od-status">' + statusBtns + '</div>' +
      '<p class="od-note">Move the order to any status at any time — even after delivery, e.g. to correct a mistaken update.</p>' +
      '</div>' +
      '</div></td></tr>';
  }

  function renderOrders() {
    var tbody = $('#ordersBody');
    if (!tbody) return;
    var list = state.orders.filter(function (o) { return orderFilter === 'All' || o.status === orderFilter; });
    tbody.innerHTML = list.map(function (o) {
      var open = !!expandedOrders[o.id];
      var row = '<tr class="order-row' + (open ? ' open' : '') + '" data-order-row="' + esc(o.id) + '">' +
        '<td><span class="row-chev" aria-hidden="true">›</span><b>' + esc(o.id) + '</b><span class="sub">placed ' + esc(o.placed) + '</span></td>' +
        '<td>' + esc(o.customer) + '<span class="sub">' + o.items.length + ' items</span></td>' +
        '<td class="amount">' + money(o.amount) + '</td>' +
        '<td>' + esc(o.slot) + '<span class="sub">' + esc(o.payment) + ' · ' + (o.paid ? 'paid' : 'pay at delivery') + '</span></td>' +
        '<td>' + esc(o.delivery) + (o.cycle === 'day-after' ? ' <span class="pill pending">Next cycle</span>' : '') +
        '<span class="sub">' + (o.cycle === 'day-after' ? 'after 10 PM · day-after delivery' : (o.status === 'Rejected' ? 'rejected same day' : (o.status === 'Delivered' ? 'delivered ' + esc(o.delivery) : 'procure tonight · deliver tomorrow'))) + '</span></td>' +
        '<td>' + statusPill(o.status) + '</td>' +
        '<td class="actions-cell">' + orderActions(o) + '</td>' +
        '</tr>';
      return row + (open ? orderDetailRow(o) : '');
    }).join('') || '<tr><td colspan="7" class="muted" style="padding:22px 18px">No orders in this filter.</td></tr>';

    var countEl = $('#ordersCount');
    if (countEl) countEl.textContent = list.length + ' orders';

    /* bulk accept: show how many are pending */
    var acceptBtn = $('#acceptAllBtn');
    if (acceptBtn) {
      var pendingCount = state.orders.filter(function (o) { return o.status === 'Pending'; }).length;
      acceptBtn.hidden = !pendingCount;
      acceptBtn.textContent = 'Accept all pending (' + pendingCount + ')';
    }
  }

  function loadOrders() {
    if (!LIVE) { renderOrders(); return Promise.resolve(); }
    return window.TAZA.adminOrders().then(function (res) {
      state.orders = (res.orders || []).map(mapOrder);
      renderOrders();
    }).catch(function (err) { toast(err.message || 'Could not load orders'); });
  }

  function setOrderStatus(id, status, msg) {
    if (!LIVE) {
      state.orders.forEach(function (o) {
        if (o.id === id) { o.status = status; if (status === 'Rejected') o.delivery = '—'; }
      });
      renderOrders();
      toast(msg);
      return;
    }
    window.TAZA.orderStatus(id, ORDER_STATUS_API[status] || String(status).toLowerCase()).then(function () {
      toast(msg);
      loadOrders();
      loadDashboard();
    }).catch(function (err) { toast(err.message || 'Could not update the order'); });
  }

  /* ---------------- procurement + dashboard ---------------- */

  function buildProcurementDemo() {
    var agg = {};
    var orderCount = 0;
    var totalValue = 0;
    state.orders.forEach(function (o) {
      if (o.cycle !== 'tomorrow' || o.status === 'Rejected' || o.status === 'Delivered') return;
      orderCount++;
      totalValue += o.amount;
      o.items.forEach(function (it) {
        if (!agg[it.name]) agg[it.name] = 0;
        agg[it.name] += it.qty;
      });
    });
    var rows = Object.keys(agg).map(function (name) {
      var p = null;
      state.products.forEach(function (x) { if (x.name === name) p = x; });
      return { name: name, qty: agg[name], unit: p ? p.unit : 'kg', value: agg[name] * (p ? p.rate : 1) };
    });
    var totalItems = rows.reduce(function (s, r) { return s + r.qty; }, 0);
    return { rows: rows, orders: orderCount, totalItems: totalItems, totalValue: totalValue };
  }

  function renderProcurement(proc) {
    var tbody = $('#procBody');
    if (!tbody) return;

    var rows = proc.rows || [];
    var totalItems = rows.reduce(function (s, r) { return s + Number(r.qty); }, 0);

    tbody.innerHTML = rows.map(function (r) {
      return '<tr>' +
        '<td><b>' + esc(r.name) + '</b></td>' +
        '<td>' + fmtQty(r.qty) + '</td>' +
        '<td>/' + esc(r.unit) + '</td>' +
        '<td class="amount">' + money(Number(r.value)) + '</td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="4" class="muted" style="padding:22px 18px">No live orders in tomorrow\'s cycle yet.</td></tr>';

    var meta = $('#procMeta');
    if (meta) meta.textContent = proc.orders + ' orders in tomorrow\'s cycle · cutoff 10:00 PM · sent to the supplier at 10 PM';

    var totals = $('#procTotals');
    if (totals) {
      var totalValue = proc.totalValue != null ? proc.totalValue : (proc.value != null ? proc.value : 0);
      totals.innerHTML = '<span><b>' + proc.orders + '</b> orders</span>' +
        '<span><b>' + totalItems + '</b> items to procure</span>' +
        '<span>order value <b>' + money(Number(totalValue)) + '</b></span>';
    }
  }

  function renderStatsAndSnapshot(stats, settings) {
    var statsEl = $('#stats');
    if (statsEl && stats) {
      statsEl.innerHTML = [
        { num: stats.orders.total, lbl: 'Orders in book', cls: 'purple' },
        { num: stats.orders.pending, lbl: 'Pending — confirm today', cls: 'amber' },
        { num: money(Number(stats.orders.revenue)), lbl: 'Revenue (excluding rejected)', cls: 'green' },
        { num: stats.orders.late, lbl: 'After-10 PM (day-after cycle)', cls: 'amber' },
        { num: stats.users.active + ' / ' + stats.users.total, lbl: 'Active Users', cls: 'purple' },
        { num: stats.products.total, lbl: 'Products in Catalogue', cls: 'green' }
      ].map(function (s) {
        return '<div class="stat-card"><span class="num ' + s.cls + '">' + s.num + '</span><span class="lbl">' + s.lbl + '</span></div>';
      }).join('');
    }

    var snap = $('#snapList');
    if (snap && settings) {
      var vegCount = state.products.filter(function (p) { return p.cat === 'veg'; }).length;
      var fruitCount = state.products.filter(function (p) { return p.cat === 'fruits'; }).length;
      snap.innerHTML =
        '<div class="kv"><span>Vegetables</span><b>' + (vegCount || 18) + '</b></div>' +
        '<div class="kv"><span>Fruits</span><b>' + (fruitCount || 16) + '</b></div>' +
        '<div class="kv"><span>Order cutoff</span><b>' + settings.cutoff_hour + ':00 PM daily</b></div>' +
        '<div class="kv"><span>Daily capacity</span><b>99 orders</b></div>' +
        '<div class="kv"><span>Delivery slots</span><b>' + (settings.morning_slot ? 'Morning' : '') + (settings.morning_slot && settings.evening_slot ? ' · ' : '') + (settings.evening_slot ? 'Evening' : '') + '</b></div>' +
        '<div class="kv"><span>Payments</span><b>' + (settings.upi_enabled ? 'UPI' : '') + (settings.upi_enabled && settings.cod_enabled ? ' · ' : '') + (settings.cod_enabled ? 'COD' : '') + '</b></div>';
    }
  }

  function renderRecentOrders() {
    var recent = $('#recentOrders');
    if (!recent) return;

    /* grouped by operational day (10 PM -> 10 PM) */
    var groups = {};
    state.orders.forEach(function (o) {
      var k = opDayKey(o.placedAt || o.placed || '');
      if (!groups[k]) groups[k] = [];
      groups[k].push(o);
    });

    var keys = Object.keys(groups).sort().reverse().slice(0, 4);
    var html = '';
    keys.forEach(function (k) {
      html += '<tr class="group-row"><td colspan="4">' + esc(opDayLabel(k)) +
        '<span>' + groups[k].length + ' orders</span></td></tr>';
      groups[k].slice(0, 6).forEach(function (o) {
        html += '<tr>' +
          '<td><b>' + esc(o.id) + '</b><span class="sub">placed ' + esc(o.placed) + '</span></td>' +
          '<td>' + esc(o.customer) + '</td>' +
          '<td class="amount">' + money(o.amount) + '</td>' +
          '<td>' + statusPill(o.status) + '</td>' +
          '</tr>';
      });
    });
    recent.innerHTML = html || '<tr><td colspan="4" class="muted" style="padding:18px">No orders yet.</td></tr>';
  }

  function loadDashboard() {
    if (!LIVE || !$('#stats')) { return; }
    Promise.all([
      window.TAZA.adminStats(),
      window.TAZA.adminOrders(),
      window.TAZA.adminProcurement(),
      window.TAZA.adminSettings(),
      window.TAZA.getProducts()
    ]).then(function (res) {
      var stats = res[0];
      state.orders = (res[1].orders || []).map(mapOrder);
      state.products = res[4].products || [];
      state.settings = res[3].settings || DEMO.settings;
      renderStatsAndSnapshot(stats, state.settings);
      renderRecentOrders();
      renderProcurement(res[2]);
    }).catch(function (err) { toast(err.message || 'Could not load the dashboard'); });
  }

  /* ---------------- users ---------------- */

  function roleOptions(role) {
    return ['customer', 'admin', 'delivery'].map(function (r) {
      return '<option value="' + r + '"' + (r === role ? ' selected' : '') + '>' + r.charAt(0).toUpperCase() + r.slice(1) + '</option>';
    }).join('');
  }

  function renderUsers() {
    var tbody = $('#usersBody');
    if (!tbody) return;
    tbody.innerHTML = state.users.map(function (u) {
      var idAttr = u.rawId != null ? u.rawId : esc(u.id);
      var live = u.rawId != null;
      var editing = editingUserId != null && String(editingUserId) === String(idAttr);

      if (editing) {
        return '<tr>' +
          '<td><b>' + esc(u.id) + '</b><span class="sub">joined ' + esc(u.joined) + '</span></td>' +
          '<td>' +
          '<input class="input user-edit-input user-edit-name" value="' + esc(u.name) + '" placeholder="Name" />' +
          '<input class="input user-edit-input user-edit-email" value="' + esc(u.email) + '" placeholder="Email" />' +
          '<input class="input user-edit-input user-edit-phone" value="' + esc(u.phone || '') + '" placeholder="Phone" />' +
          '</td>' +
          '<td><input class="input user-edit-input user-edit-address" value="' + esc(u.address || '') + '" placeholder="Delivery address" /></td>' +
          '<td><select class="input role-select role-edit" aria-label="Role">' + roleOptions(u.role) + '</select></td>' +
          '<td><select class="input user-edit-status" aria-label="Status">' +
          '<option value="active"' + (u.status === 'active' ? ' selected' : '') + '>Active</option>' +
          '<option value="suspended"' + (u.status === 'suspended' ? ' selected' : '') + '>Suspended</option>' +
          '</select></td>' +
          '<td><input class="input user-edit-input user-edit-password" type="text" value="' + (live ? '' : esc(u.password || '')) + '" placeholder="' + (live ? 'New password (blank = keep)' : 'Password') + '" /></td>' +
          '<td class="actions-cell">' +
          '<button class="btn success small" data-act="edit-user-save" data-id="' + idAttr + '">Save</button>' +
          '<button class="btn ghost small" data-act="edit-user-cancel">Cancel</button>' +
          '</td>' +
          '</tr>';
      }

      var pwCell = live
        ? '<span class="pw-cell" title="Passwords are stored hashed — use edit to reset">••••••••</span>'
        : '<span class="pw-cell" id="pw-' + esc(u.id) + '" data-show="0">••••••••</span>';
      var quick = live
        ? '<button class="iconbtn" data-act="toggle-user" data-id="' + idAttr + '" title="' + (u.status === 'active' ? 'Suspend' : 'Activate') + '">' + (u.status === 'active' ? ICONS.ban : ICONS.check) + '</button>'
        : '<button class="iconbtn" data-act="pw" data-id="' + esc(u.id) + '" title="Show / hide password">' + ICONS.eye + '</button>';

      return '<tr>' +
        '<td><b>' + esc(u.id) + '</b><span class="sub">joined ' + esc(u.joined) + '</span></td>' +
        '<td>' + esc(u.name) + '<span class="sub">' + esc(u.email) + (u.phone ? ' · ' + esc(u.phone) : '') + '</span></td>' +
        '<td>' + (u.address ? esc(u.address) : '<span class="muted">—</span>') + '</td>' +
        '<td><select class="input role-select" data-id="' + idAttr + '" data-live="' + (live ? '1' : '0') + '" aria-label="Role">' + roleOptions(u.role) + '</select></td>' +
        '<td><span class="pill ' + (u.status === 'active' ? 'active' : 'suspended') + '">' + (u.status === 'active' ? 'Active' : 'Suspended') + '</span></td>' +
        '<td>' + pwCell + '</td>' +
        '<td class="actions-cell">' + quick +
        '<button class="iconbtn" data-act="edit-user" data-id="' + idAttr + '" title="Edit user">' + ICONS.pencil + '</button>' +
        '<button class="iconbtn danger" data-act="del-user" data-id="' + idAttr + '" title="Delete user">' + ICONS.trash + '</button>' +
        '</td>' +
        '</tr>';
    }).join('');

    var countEl = $('#usersCount');
    if (countEl) countEl.textContent = state.users.length + ' users';
  }

  function loadUsers() {
    if (!LIVE) { renderUsers(); return Promise.resolve(); }
    return window.TAZA.adminUsers().then(function (res) {
      state.users = (res.users || []).map(function (u) {
        return {
          id: 'USR-' + String(u.id).padStart(4, '0'),
          rawId: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone || '',
          address: u.address || '',
          role: u.role,
          status: u.status,
          joined: fmtLong(u.created_at)
        };
      });
      renderUsers();
    }).catch(function (err) { toast(err.message || 'Could not load users'); });
  }

  /* ---------------- products ---------------- */

  var SECTION_LABELS = {
    kg: 'KG · Weight',
    bunch: 'Bunch (Judi)',
    gram: 'Gram',
    piece_pack: 'Piece & Pack',
    dozen_piece: 'Dozen · Piece (Count)',
    pack: 'Pack (Pre-packed)'
  };
  var SECTION_OPTIONS = {
    veg: ['kg', 'bunch', 'gram', 'piece_pack'],
    fruits: ['kg', 'dozen_piece', 'pack']
  };
  var UNIT_OPTIONS = ['kg', 'bunch', 'pack', 'piece', 'dozen', '100 g'];

  function sectionFromUnit(p) {
    if (p.cat === 'veg') {
      if (p.unit === 'bunch') return 'bunch';
      if (p.unit === 'pack' || p.unit === 'piece' || p.unit === 'dozen') return 'piece_pack';
      return 'kg';
    }
    if (p.unit === 'pack') return 'pack';
    if (p.unit === 'piece' || p.unit === 'dozen') return 'dozen_piece';
    return 'kg';
  }

  function sectionOptionsHtml(cat, selected) {
    var list = SECTION_OPTIONS[cat === 'fruits' ? 'fruits' : 'veg'];
    return list.map(function (v) {
      return '<option value="' + v + '"' + (v === selected ? ' selected' : '') + '>' + SECTION_LABELS[v] + '</option>';
    }).join('');
  }

  var productFilter = 'All';

  function renderProducts() {
    var tbody = $('#productsBody');
    if (!tbody) return;
    var list = state.products.filter(function (p) { return productFilter === 'All' || p.cat === productFilter; });

    tbody.innerHTML = list.map(function (p) {
      var idAttr = p.id != null ? p.id : esc(p.name);
      var editing = editingProductId != null && String(editingProductId) === String(idAttr);
      var sec = p.section || sectionFromUnit(p);
      var sectionCell = editing
        ? '<select class="input section-edit" style="height:34px">' + sectionOptionsHtml(p.cat, sec) + '</select>'
        : '<span class="pill section">' + SECTION_LABELS[sec] + '</span>';
      var unitCell = editing
        ? '<select class="input rate-edit-unit" style="height:34px">' +
          UNIT_OPTIONS.map(function (un) {
            return '<option' + (un === p.unit ? ' selected' : '') + '>' + un + '</option>';
          }).join('') + '</select>'
        : '/' + esc(p.unit);
      var rateCell = editing
        ? '<input class="input rate-edit-rate" type="number" min="1" step="1" value="' + p.rate + '" style="height:34px;width:80px" />'
        : money(p.rate);
      var actions = editing
        ? '<button class="btn success small" data-act="edit-save" data-id="' + idAttr + '" data-name="' + esc(p.name) + '">Save</button>' +
          '<button class="btn ghost small" data-act="edit-cancel">Cancel</button>'
        : '<button class="iconbtn" data-act="edit-prod" data-id="' + idAttr + '" title="Edit">' + ICONS.pencil + '</button>' +
          '<button class="iconbtn danger" data-act="del-prod" data-id="' + idAttr + '" data-name="' + esc(p.name) + '" title="Delete">' + ICONS.trash + '</button>';

      return '<tr>' +
        '<td><span class="p-emoji">' + esc(p.emoji) + '</span><b>' + esc(p.name) + '</b></td>' +
        '<td><span class="pill ' + (p.cat === 'veg' ? 'cat-veg' : 'cat-fruits') + '">' + (p.cat === 'veg' ? 'Vegetables' : 'Fruits') + '</span></td>' +
        '<td>' + sectionCell + '</td>' +
        '<td>' + unitCell + '</td>' +
        '<td class="amount">' + rateCell + '</td>' +
        '<td class="actions-cell">' + actions + '</td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="6" class="muted" style="padding:22px 18px">No products in this filter.</td></tr>';

    var countEl = $('#prodCount');
    if (countEl) countEl.textContent = list.length + ' products';
  }

  function loadProducts() {
    if (!LIVE) { renderProducts(); return Promise.resolve(); }
    return window.TAZA.getProducts().then(function (res) {
      state.products = res.products || [];
      renderProducts();
    }).catch(function (err) { toast(err.message || 'Could not load products'); });
  }

  function setupProductForm() {
    var form = $('#addProductForm');
    if (!form) return;

    var catEl = $('#npCat');
    function fillSectionOptions() {
      var selEl = $('#npSection');
      if (!selEl || !catEl) return;
      selEl.innerHTML = sectionOptionsHtml(catEl.value, null);
    }
    if (catEl) {
      catEl.addEventListener('change', fillSectionOptions);
      fillSectionOptions();
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var payload = {
        name: $('#npName').value.trim(),
        emoji: $('#npEmoji').value.trim() || '🥬',
        cat: $('#npCat').value,
        section: $('#npSection') ? $('#npSection').value : null,
        unit: $('#npUnit').value,
        rate: parseInt($('#npRate').value, 10) || 1
      };
      if (!payload.name) { toast('Enter a product name first'); return; }

      if (LIVE) {
        window.TAZA.adminAddProduct(payload).then(function () {
          toast(payload.name + ' added to catalogue ✓');
          form.reset();
          $('#npEmoji').value = '🥬';
          $('#npRate').value = 1;
          fillSectionOptions();
          loadProducts();
        }).catch(function (err) { toast(err.message || 'Could not add the product'); });
        return;
      }

      payload.id = 'd' + Date.now();
      payload.section = payload.section || sectionFromUnit(payload);
      state.products.unshift(payload);
      renderProducts();
      form.reset();
      $('#npEmoji').value = '🥬';
      $('#npRate').value = 1;
      fillSectionOptions();
      toast(payload.name + ' added to catalogue ✓');
    });
  }

  /* ---------------- conversations ---------------- */

  var pollTimer = null;

  function convMeta(c) {
    if (c.order) return 'Order ' + esc(c.order);
    return esc(c.last_at ? fmtDayTime(c.last_at) : '');
  }

  function convPreview(c) {
    var last = c.last_text || (c.messages && c.messages.length ? c.messages[c.messages.length - 1].text : '');
    return esc(last || '');
  }

  function renderConvList() {
    var list = $('#convList');
    if (!list) return;
    list.innerHTML = state.conversations.map(function (c) {
      return '<div class="conv' + (String(c.id) === String(activeConvId) ? ' active' : '') + '" data-conv="' + esc(c.id) + '">' +
        '<span class="conv-avatar">' + esc(c.name.charAt(0).toUpperCase()) + '</span>' +
        '<div class="conv-body"><b>' + esc(c.name) + '</b><p>' + convPreview(c) + '</p></div>' +
        '<div class="conv-meta"><time>' + convMeta(c) + '</time>' +
        (c.unread ? '<span class="unread">' + c.unread + '</span>' : '') +
        '</div></div>';
    }).join('') || '<div class="muted" style="padding:18px">No customer conversations yet.</div>';
  }

  function renderThread() {
    var thread = $('#chatThread');
    if (!thread) return;
    var conv = null;
    state.conversations.forEach(function (c) { if (String(c.id) === String(activeConvId)) conv = c; });
    if (!conv) { thread.innerHTML = ''; return; }
    thread.innerHTML = (conv.messages || []).map(function (m) {
      return '<div class="bubble ' + (m.from === 'me' ? 'me' : 'them') + '">' +
        '<p>' + esc(m.text) + '</p><time>' + esc(m.time) + '</time></div>';
    }).join('');
    thread.scrollTop = thread.scrollHeight;
  }

  function openConversation(id) {
    activeConvId = id;
    var conv = null;
    state.conversations.forEach(function (c) { if (String(c.id) === String(id)) conv = c; });
    if (!conv) return;

    conv.unread = 0;
    var avatar = $('#chatAvatar');
    var name = $('#chatName');
    var meta = $('#chatMeta');
    if (avatar) avatar.textContent = conv.name.charAt(0).toUpperCase();
    if (name) name.textContent = conv.name;
    if (meta) meta.textContent = LIVE ? (conv.status === 'suspended' ? 'Suspended account' : 'Customer') : ('Order ' + conv.order + ' · ' + (conv.online ? 'Online now' : 'Offline'));

    renderConvList();

    if (LIVE) {
      window.TAZA.adminConversation(id).then(function (res) {
        conv.messages = (res.messages || []).map(function (m) {
          return { from: m.sender === 'admin' ? 'me' : 'them', text: m.text, time: fmtClock(m.created_at) };
        });
        renderThread();
        renderConvList();
      }).catch(function (err) { toast(err.message || 'Could not load the conversation'); });
      return;
    }
    renderThread();
  }

  function loadConversations() {
    if (!LIVE) { renderConvList(); return Promise.resolve(); }
    return window.TAZA.adminConversations().then(function (res) {
      var open = null;
      state.conversations.forEach(function (c) { if (String(c.id) === String(activeConvId)) open = c.messages || []; });
      state.conversations = (res.conversations || []).map(function (c) {
        return { id: c.id, name: c.name, status: c.status, last_text: c.last_text, last_at: c.last_at, unread: c.unread, messages: open && String(activeConvId) === String(c.id) ? open : [] };
      });
      renderConvList();
      if (!activeConvId && state.conversations.length) openConversation(state.conversations[0].id);
    }).catch(function (err) { toast(err.message || 'Could not load conversations'); });
  }

  function setupChatForm() {
    var form = $('#adminChatForm');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = $('#adminChatInput');
      var text = input.value.trim();
      if (!text || !activeConvId) return;

      var conv = null;
      state.conversations.forEach(function (c) { if (String(c.id) === String(activeConvId)) conv = c; });
      if (!conv) return;

      input.value = '';

      if (LIVE) {
        window.TAZA.adminReply(activeConvId, text).then(function () {
          conv.messages = conv.messages || [];
          conv.messages.push({ from: 'me', text: text, time: fmtClock(dbStamp()) });
          conv.last_text = text;
          conv.last_at = dbStamp();
          renderConvList();
          renderThread();
        }).catch(function (err) { toast(err.message || 'Could not send the reply'); });
        return;
      }

      conv.messages.push({ from: 'me', text: text, time: nowTime() });
      renderConvList();
      renderThread();
      setTimeout(function () {
        conv.messages.push({ from: 'them', text: 'Thank you! 🙏', time: nowTime() });
        if (String(conv.id) === String(activeConvId)) { renderConvList(); renderThread(); }
        else { conv.unread += 1; renderConvList(); }
      }, 1400);
    });
  }

  /* ---------------- settings ---------------- */

  function fillSettings(s) {
    if (!s) return;
    if ($('#stStoreName')) $('#stStoreName').value = s.store_name || '';
    if ($('#stPhone')) $('#stPhone').value = s.support_phone || '';
    if ($('#stFee')) $('#stFee').value = s.delivery_fee;
    if ($('#stMorning')) $('#stMorning').checked = !!s.morning_slot;
    if ($('#stEvening')) $('#stEvening').checked = !!s.evening_slot;
    if ($('#stUpi')) $('#stUpi').checked = !!s.upi_enabled;
    if ($('#stCod')) $('#stCod').checked = !!s.cod_enabled;
  }

  function setupSettings() {
    var form = $('#settingsForm');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var payload = {
        store_name: $('#stStoreName') ? $('#stStoreName').value.trim() : undefined,
        support_phone: $('#stPhone') ? $('#stPhone').value.trim() : undefined,
        delivery_fee: $('#stFee') ? parseInt($('#stFee').value, 10) : undefined,
        morning_slot: $('#stMorning') && $('#stMorning').checked ? 1 : 0,
        evening_slot: $('#stEvening') && $('#stEvening').checked ? 1 : 0,
        upi_enabled: $('#stUpi') && $('#stUpi').checked ? 1 : 0,
        cod_enabled: $('#stCod') && $('#stCod').checked ? 1 : 0
      };
      if (LIVE) {
        window.TAZA.adminSaveSettings(payload).then(function () { toast('Settings saved ✓'); })
          .catch(function (err) { toast(err.message || 'Could not save the settings'); });
        return;
      }
      toast('Settings saved ✓ (demo mode)');
    });
  }

  /* ---------------- interactions ---------------- */

  document.addEventListener('click', function (e) {
    var demo = e.target.closest('[data-demo]');
    if (demo) { e.preventDefault(); toast('This action is not wired in this template'); return; }

    var logout = e.target.closest('#adminLogout');
    if (logout && window.TAZA) window.TAZA.clearSession();

    var convEl = e.target.closest('.conv');
    if (convEl) { openConversation(convEl.getAttribute('data-conv')); return; }

    /* tap an order row to expand its items-to-pack + status controls */
    var orderRow = e.target.closest('[data-order-row]');
    if (orderRow && !e.target.closest('button, a, select, input, label')) {
      var oidRow = orderRow.getAttribute('data-order-row');
      expandedOrders[oidRow] = !expandedOrders[oidRow];
      renderOrders();
      return;
    }

    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var act = btn.getAttribute('data-act');
    var id = btn.getAttribute('data-id');

    if (act === 'confirm') { setOrderStatus(id, 'Confirmed', 'Order ' + id + ' confirmed — collect from supplier tonight'); return; }
    if (act === 'reject') { setOrderStatus(id, 'Rejected', 'Order ' + id + ' rejected — customer notified'); return; }

    if (act === 'accept-all') {
      var pend = state.orders.filter(function (o) { return o.status === 'Pending'; });
      if (!pend.length) { toast('No pending orders'); return; }
      if (!window.confirm('Confirm all ' + pend.length + ' pending orders?')) return;
      if (!LIVE) {
        pend.forEach(function (o) { o.status = 'Confirmed'; });
        renderOrders();
        toast(pend.length + ' orders confirmed');
        return;
      }
      Promise.all(pend.map(function (o) {
        return window.TAZA.orderStatus(o.id, 'confirmed').catch(function () { return null; });
      })).then(function () {
        toast(pend.length + ' orders confirmed — collect from supplier tonight');
        loadOrders();
        loadDashboard();
      });
      return;
    }

    if (act === 'toggle-paid') {
      var paidOrder = null;
      state.orders.forEach(function (x) { if (x.id === id) paidOrder = x; });
      if (!paidOrder) return;
      var newPaid = !paidOrder.paid;
      if (!LIVE) {
        paidOrder.paid = newPaid;
        renderOrders();
        toast(id + (newPaid ? ' marked as paid' : ' marked as unpaid'));
        return;
      }
      window.TAZA.orderPaid(id, newPaid).then(function () {
        toast(id + (newPaid ? ' marked as paid ✓' : ' marked as unpaid'));
        loadOrders();
      }).catch(function (err) { toast(err.message || 'Could not update the payment'); });
      return;
    }
    if (act === 'expand') { expandedOrders[id] = !expandedOrders[id]; renderOrders(); return; }
    if (act === 'set-status') {
      var newStatus = btn.getAttribute('data-status');
      setOrderStatus(id, newStatus, 'Order ' + id + ' → ' + newStatus + (newStatus === 'Delivered' || newStatus === 'Rejected' ? '' : ' — customer will be informed'));
      return;
    }

    if (act === 'edit-user') { editingUserId = id; renderUsers(); return; }
    if (act === 'edit-user-cancel') { editingUserId = null; renderUsers(); return; }

    if (act === 'edit-user-save') {
      var du2 = null;
      state.users.forEach(function (x) { if (String(x.rawId != null ? x.rawId : x.id) === String(id)) du2 = x; });
      if (!du2) return;

      var payload = {
        name: $('.user-edit-name') ? $('.user-edit-name').value.trim() : '',
        email: $('.user-edit-email') ? $('.user-edit-email').value.trim() : '',
        phone: $('.user-edit-phone') ? $('.user-edit-phone').value.trim() : '',
        address: $('.user-edit-address') ? $('.user-edit-address').value.trim() : '',
        role: $('.role-edit') ? $('.role-edit').value : undefined,
        status: $('.user-edit-status') ? $('.user-edit-status').value : undefined,
        password: $('.user-edit-password') ? $('.user-edit-password').value.trim() : ''
      };
      if (!payload.name || !payload.email) { toast('Name and email are required'); return; }
      if (!payload.password) delete payload.password;

      if (LIVE) {
        window.TAZA.adminUpdateUser(id, payload).then(function () {
          editingUserId = null;
          toast(payload.name + ' updated ✓');
          loadUsers();
        }).catch(function (err) { toast(err.message || 'Could not update the user'); });
        return;
      }

      du2.name = payload.name;
      du2.email = payload.email;
      du2.phone = payload.phone;
      du2.address = payload.address;
      if (payload.role) du2.role = payload.role;
      if (payload.status) du2.status = payload.status;
      if (payload.password) du2.password = payload.password;
      editingUserId = null;
      renderUsers();
      toast(payload.name + ' updated ✓');
      return;
    }

    if (act === 'toggle-user') {
      var u = null;
      state.users.forEach(function (x) { if (String(x.rawId) === String(id)) u = x; });
      if (!u) return;
      var next = u.status === 'active' ? 'suspended' : 'active';
      if (LIVE) {
        window.TAZA.adminUpdateUser(id, { status: next }).then(function () {
          toast(u.name + (next === 'active' ? ' activated ✓' : ' suspended'));
          loadUsers();
        }).catch(function (err) { toast(err.message || 'Could not update the user'); });
      }
      return;
    }

    if (act === 'pw') {
      var cell = document.getElementById('pw-' + id);
      var user = null;
      state.users.forEach(function (x) { if (x.id === id) user = x; });
      if (!cell || !user) return;
      var show = cell.getAttribute('data-show') === '1';
      cell.setAttribute('data-show', show ? '0' : '1');
      cell.textContent = show ? '••••••••' : user.password;
      return;
    }

    if (act === 'del-user') {
      var du = null;
      state.users.forEach(function (x) { if (String(x.rawId != null ? x.rawId : x.id) === String(id)) du = x; });
      if (!du) return;
      if (!window.confirm('Delete ' + du.name + '?')) return;
      if (LIVE) {
        window.TAZA.adminDeleteUser(id).then(function () {
          toast('User removed');
          loadUsers();
        }).catch(function (err) { toast(err.message || 'Could not delete the user'); });
        return;
      }
      state.users = state.users.filter(function (x) { return x !== du; });
      renderUsers();
      toast('User ' + du.id + ' removed');
      return;
    }

    if (act === 'edit-prod') { editingProductId = id; renderProducts(); return; }
    if (act === 'edit-cancel') { editingProductId = null; renderProducts(); return; }

    if (act === 'edit-save') {
      var rateEl = $('.rate-edit-rate');
      var unitEl = $('.rate-edit-unit');
      var secEl = $('.section-edit');
      var newRate = rateEl ? parseInt(rateEl.value, 10) || 1 : null;
      var newUnit = unitEl ? unitEl.value : null;
      var newSection = secEl ? secEl.value : null;

      if (LIVE) {
        window.TAZA.adminUpdateProduct(id, { rate: newRate, unit: newUnit, section: newSection }).then(function () {
          toast(btn.getAttribute('data-name') + ' updated ✓');
          editingProductId = null;
          loadProducts();
        }).catch(function (err) { toast(err.message || 'Could not update the product'); });
        return;
      }
      state.products.forEach(function (p) {
        if (String(p.id) === String(id) || p.name === btn.getAttribute('data-name')) {
          if (newRate) p.rate = newRate;
          if (newUnit) p.unit = newUnit;
          if (newSection) p.section = newSection;
        }
      });
      editingProductId = null;
      renderProducts();
      toast(btn.getAttribute('data-name') + ' updated ✓');
      return;
    }

    if (act === 'del-prod') {
      if (!window.confirm('Delete ' + btn.getAttribute('data-name') + ' from the catalogue?')) return;
      if (LIVE) {
        window.TAZA.adminDeleteProduct(id).then(function () {
          toast(btn.getAttribute('data-name') + ' removed from catalogue');
          loadProducts();
        }).catch(function (err) { toast(err.message || 'Could not delete the product'); });
        return;
      }
      state.products = state.products.filter(function (p) { return String(p.id) !== String(id) && p.name !== btn.getAttribute('data-name'); });
      renderProducts();
      toast(btn.getAttribute('data-name') + ' removed from catalogue');
      return;
    }

    if (act === 'proc-send') {
      toast('Tonight\'s procurement list marked as sent to the supplier ✓');
      return;
    }
  });

  document.addEventListener('change', function (e) {
    var sel = e.target.closest('.role-select');
    if (!sel || sel.classList.contains('role-edit')) return;   /* edit-mode select is read on Save */
    var id = sel.getAttribute('data-id');
    if (sel.getAttribute('data-live') === '1' && LIVE) {
      window.TAZA.adminUpdateUser(id, { role: sel.value }).then(function () {
        toast('Role updated — ' + sel.value.charAt(0).toUpperCase() + sel.value.slice(1));
      }).catch(function (err) { toast(err.message || 'Could not update the role'); loadUsers(); });
      return;
    }
    toast('Role updated — ' + sel.value.charAt(0).toUpperCase() + sel.value.slice(1));
  });

  var of = $('#orderFilters');
  if (of) {
    of.addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (!chip) return;
      $$('.chip', of).forEach(function (c) { c.classList.remove('active'); });
      chip.classList.add('active');
      orderFilter = chip.getAttribute('data-filter');
      renderOrders();
    });
  }

  var pf = $('#productFilters');
  if (pf) {
    pf.addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (!chip) return;
      $$('.chip', pf).forEach(function (c) { c.classList.remove('active'); });
      chip.classList.add('active');
      productFilter = chip.getAttribute('data-filter');
      renderProducts();
    });
  }

  /* ---------------- init ---------------- */

  function initDemo() {
    state.users = JSON.parse(JSON.stringify(DEMO.users));
    state.orders = JSON.parse(JSON.stringify(DEMO.orders));
    state.products = JSON.parse(JSON.stringify(DEMO.products));
    state.conversations = JSON.parse(JSON.stringify(DEMO.conversations));

    renderUsers();
    renderOrders();
    renderProducts();
    renderRecentOrders();
    renderProcurement(buildProcurementDemo());
    renderStatsAndSnapshot(
      {
        orders: {
          total: state.orders.length,
          pending: state.orders.filter(function (o) { return o.status === 'Pending'; }).length,
          late: state.orders.filter(function (o) { return o.cycle === 'day-after' && o.status !== 'Rejected'; }).length,
          revenue: state.orders.reduce(function (s, o) { return o.status === 'Rejected' ? s : s + o.amount; }, 0)
        },
        users: { total: state.users.length, active: state.users.filter(function (u) { return u.status === 'active'; }).length },
        products: { total: state.products.length }
      },
      DEMO.settings
    );
    fillSettings(DEMO.settings);
    renderConvList();
    if ($('#convList') && state.conversations.length) openConversation(state.conversations[0].id);
  }

  function initLive(me) {
    var nameEl = $('#sidebarAdminName');
    if (nameEl && me) nameEl.textContent = me.name;
    var chip = $('.admin-chip span');
    if (chip && me) chip.textContent = me.name + ' · Super Admin';

    /* users page: passwords are never returned by the API */
    if ($('#usersBody')) {
      var usersHint = $('.card-head span.hint');
      if (usersHint) usersHint.textContent = 'Click the pencil to edit any user — including password reset (stored hashed)';
    }

    /* dashboard */
    loadDashboard();

    /* orders */
    if ($('#ordersBody')) { loadOrders(); }

    /* users */
    if ($('#usersBody')) { loadUsers(); }

    /* products */
    if ($('#productsBody')) { loadProducts(); }

    /* messages */
    if ($('#convList')) {
      loadConversations().then(function () {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = setInterval(function () {
          loadConversations().then(function () {
            if (activeConvId) {
              window.TAZA.adminConversation(activeConvId).then(function (res) {
                var conv = null;
                state.conversations.forEach(function (c) { if (String(c.id) === String(activeConvId)) conv = c; });
                if (!conv) return;
                conv.messages = (res.messages || []).map(function (m) {
                  return { from: m.sender === 'admin' ? 'me' : 'them', text: m.text, time: fmtClock(m.created_at) };
                });
                renderThread();
              }).catch(function () { /* noop */ });
            }
          });
        }, 8000);
      });
    }

    /* settings */
    if ($('#settingsForm')) {
      window.TAZA.adminSettings().then(function (res) { fillSettings(res.settings); })
        .catch(function (err) { toast(err.message || 'Could not load settings'); });
    }
  }

  function boot() {
    renderSidebar();

    /* preview helper: ?order=TS… auto-expands that order row */
    var expandParam = null;
    try { expandParam = new URLSearchParams(location.search).get('order'); } catch (e) { /* noop */ }
    if (expandParam) expandedOrders[expandParam] = true;

    /* bind the forms once — they work in both demo and live mode */
    setupChatForm();
    setupProductForm();
    setupSettings();

    var t = window.TAZA;
    if (!t || !t.token()) { initDemo(); return; }

    t.me().then(function (res) {
      if (!res.user || res.user.role !== 'admin') {
        /* signed in as a customer - send back to the login screen */
        window.location.href = '../templates/login.html';
        return;
      }
      LIVE = true;
      initLive(res.user);
    }).catch(function (err) {
      if (err && err.status === 401) { window.location.href = '../templates/login.html'; return; }
      initDemo(); /* backend unreachable - static demo */
    });
  }

  boot();
})();
