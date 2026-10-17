/* ==========================================================================
   TAZA-PHAL-SABZI.COM — API client (used when the site is served by
   server/server.js; templates keep working in demo mode without it)
   ========================================================================== */

(function () {
  'use strict';

  var BASE = window.TAZA_API_BASE || '/api';

  function token() {
    try { return localStorage.getItem('taza-token'); } catch (e) { return null; }
  }

  function getUser() {
    try { return JSON.parse(localStorage.getItem('taza-user') || 'null'); } catch (e) { return null; }
  }

  function setSession(t, user) {
    try {
      if (t) localStorage.setItem('taza-token', t);
      if (user) localStorage.setItem('taza-user', JSON.stringify(user));
    } catch (e) { /* noop */ }
  }

  function clearSession() {
    try {
      localStorage.removeItem('taza-token');
      localStorage.removeItem('taza-user');
    } catch (e) { /* noop */ }
  }

  function request(method, path, body) {
    var isForm = (typeof FormData !== 'undefined') && (body instanceof FormData);
    var headers = {};
    if (!isForm) headers['Content-Type'] = 'application/json';
    var t = token();
    if (t) headers.Authorization = 'Bearer ' + t;

    return fetch(BASE + path, {
      method: method,
      headers: headers,
      body: isForm ? body : (body ? JSON.stringify(body) : undefined)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          var err = new Error(data.error || ('Request failed (' + res.status + ')'));
          err.status = res.status;
          throw err;
        }
        return data;
      });
    });
  }

  window.TAZA = {
    base: BASE,
    token: token,
    getUser: getUser,
    setSession: setSession,
    clearSession: clearSession,

    /* API reachability check — templates fall back to demo mode if offline */
    available: function () {
      return fetch(BASE + '/health')
        .then(function (r) { return r.ok; })
        .catch(function () { return false; });
    },

    login: function (email, password) { return request('POST', '/auth/login', { email: email, password: password }); },
    register: function (payload) { return request('POST', '/auth/register', payload); },
    me: function () { return request('GET', '/auth/me'); },
    updateMe: function (payload) { return request('PATCH', '/auth/me', payload); },
    avatarUpload: function (file) {
      var fd = new FormData();
      fd.append('image', file);
      return request('POST', '/auth/avatar', fd);
    },

    getProducts: function (cat) { return request('GET', '/products' + (cat ? '?cat=' + encodeURIComponent(cat) : '')); },
    getSettings: function () { return request('GET', '/settings'); },
    placeOrder: function (payload) { return request('POST', '/orders', payload); },
    myOrders: function () { return request('GET', '/orders'); },

    myChat: function () { return request('GET', '/chat/my'); },
    chatUnread: function () { return request('GET', '/chat/unread'); },
    sendChat: function (text) { return request('POST', '/chat/my', { text: text }); },

    orderStatus: function (id, status) { return request('PATCH', '/orders/' + encodeURIComponent(id) + '/status', { status: status }); },
    cancelOrder: function (id) { return request('PATCH', '/orders/' + encodeURIComponent(id) + '/cancel', {}); },
    orderPaid: function (id, paid) { return request('PATCH', '/orders/' + encodeURIComponent(id) + '/paid', { paid: !!paid }); },
    adminStats: function () { return request('GET', '/admin/stats'); },
    adminOrders: function (params) { return request('GET', '/orders' + (params ? '?' + params : '')); },
    adminUsers: function () { return request('GET', '/admin/users'); },
    adminUpdateUser: function (id, payload) { return request('PATCH', '/admin/users/' + id, payload); },
    adminDeleteUser: function (id) { return request('DELETE', '/admin/users/' + id); },
    adminAddProduct: function (payload) { return request('POST', '/admin/products', payload); },
    adminGetProducts: function () { return request('GET', '/admin/products'); },
    adminUpdateProduct: function (id, payload) { return request('PATCH', '/admin/products/' + id, payload); },
    adminDeleteProduct: function (id) { return request('DELETE', '/admin/products/' + id); },
    adminUploadProductImage: function (id, file) {
      var fd = new FormData();
      fd.append('image', file);
      return request('POST', '/admin/products/' + id + '/images', fd);
    },
    adminDeleteProductImage: function (imgId) { return request('DELETE', '/admin/product-images/' + imgId); },
    adminProcurement: function () { return request('GET', '/admin/procurement'); },
    adminSettings: function () { return request('GET', '/admin/settings'); },
    adminSaveSettings: function (payload) { return request('PUT', '/admin/settings', payload); },
    adminConversations: function () { return request('GET', '/chat/conversations'); },
    adminConversation: function (id) { return request('GET', '/chat/conversations/' + id); },
    adminReply: function (id, text) { return request('POST', '/chat/conversations/' + id, { text: text }); }
  };
})();
