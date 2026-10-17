/* ==========================================================================
   MyVegFruitShop — template interactions + i18n (English / हिंदी / मराठी)
   - language preference: compact row in Account (persisted, ?lang=en|hi|mr)
   - quantity multipliers (home price table) + live cart totals
   - favourite (heart) toggles, order-history filter chips
   - chat send with canned reply (messages screen)
   - tiny toast feedback for demo-only actions
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
  /* order history: quantity + the unit exactly as stored (kg / bunch / 100 g …) */
  var UNIT_WORD_KEYS = { bunch: 'u_bunch', pack: 'u_pack', piece: 'u_piece', dozen: 'u_dozen' };
  var itemQtyHtml = function (it) {
    var unit = it && it.unit != null ? String(it.unit) : '';
    var qty = Number(it && it.qty) || 0;
    if (unit === 'kg') return fmtQty(qty) + ' <span data-i18n="u_kg">' + t('u_kg') + '</span>';
    if (unit === '100 g') return fmtQty(qty * 100) + ' <span data-i18n="u_g">' + t('u_g') + '</span>';
    if (!unit) return fmtQty(qty);
    var key = UNIT_WORD_KEYS[unit];
    return fmtQty(qty) + (key ? ' <span data-i18n="' + key + '">' + t(key) + '</span>' : ' ' + esc(unit));
  };
  var payChipHtml = function (order) {
    var method = String(order && order.payment || '').toLowerCase() === 'cod' ? 'cod' : 'upi';
    var label = method === 'cod'
      ? '<span data-i18n="cod_word">' + t('cod_word') + '</span>'
      : '<span data-i18n="pay_upi">' + t('pay_upi') + '</span>';
    if (order && order.status === 'rejected') return '';
    var isPaid = !!(order && (order.paid === true || order.paid === 1 || order.paid === '1'));
    if (isPaid) {
      return '<span class="pay-chip"><span data-i18n="paid_word">' + t('paid_word') + '</span> · ' + label + '</span>';
    }
    return '<span class="pay-chip cod" data-i18n="pay_at_delivery">' + t('pay_at_delivery') + '</span>';
  };
  var esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  /* ---------- i18n dictionary ---------- */

  var I18N = {
    en: {
      hello: 'Hello, Hannah',
      hello_plain: 'Hello',
      delivery_note: 'Order before 10 PM — fresh delivery tomorrow morning!',
      vegetables: 'Vegetables',
      fruits: 'Fruits',
      tab_home: 'Home',
      tab_history: 'History',
      tab_message: 'Message',
      tab_account: 'Account',
      veg_tomato: 'Tomato',
      veg_potato: 'Potato',
      veg_onion: 'Onion',
      veg_spinach: 'Spinach',
      veg_carrot: 'Carrot',
      veg_cucumber: 'Cucumber',
      veg_capsicum: 'Capsicum',
      veg_brinjal: 'Brinjal',
      veg_corn: 'Sweet Corn',
      veg_pumpkin: 'Pumpkin',
      veg_broccoli: 'Broccoli',
      veg_mushroom: 'Mushroom',
      veg_garlic: 'Garlic',
      veg_chilli: 'Green Chilli',
      veg_lettuce: 'Lettuce',
      veg_cabbage: 'Cabbage',
      veg_coriander: 'Coriander',
      veg_sweet_potato: 'Sweet Potato',
      veg_methi: 'Fenugreek Leaves',
      veg_shepu: 'Dill',
      veg_chuka: 'Sorrel',
      veg_ginger: 'Ginger',
      veg_curry_leaves: 'Curry Leaves',
      fruit_apple: 'Apple',
      fruit_banana: 'Banana',
      fruit_mango: 'Mango',
      fruit_grapes: 'Grapes',
      fruit_orange: 'Orange',
      fruit_lemon: 'Lemon',
      fruit_watermelon: 'Watermelon',
      fruit_strawberry: 'Strawberry',
      fruit_peach: 'Peach',
      fruit_pineapple: 'Pineapple',
      fruit_kiwi: 'Kiwi',
      fruit_pear: 'Pear',
      fruit_melon: 'Melon',
      fruit_cherry: 'Cherry',
      fruit_coconut: 'Coconut',
      fruit_avocado: 'Avocado',
      unit_kg: ' /kg',
      unit_bunch: ' /bunch',
      unit_pack: ' /pack',
      unit_piece: ' /piece',
      unit_dozen: ' /dozen',
      unit_100g: ' /100 g',
      u_kg: 'kg',
      u_g: 'g',
      u_bunch: 'bunch',
      u_pack: 'pack',
      u_piece: 'piece',
      u_dozen: 'dozen',
      pay_upi: 'UPI on delivery',
      paid_word: 'Paid',
      cod_word: 'Cash',
      pay_at_delivery: 'Pay on delivery',
      sec_kg: 'KG · Weight',
      sec_bunch: 'Bunch (Judi)',
      sec_gram: 'Gram',
      sec_piece_pack: 'Piece & Pack',
      sec_dozen_piece: 'Dozen · Piece (Count)',
      sec_pack: 'Pack (Pre-packed)',
      my_cart: 'My Cart',
      fresh_fiji_apples: 'Fresh Fiji Apples',
      organic_spinach: 'Organic Spinach',
      organic_lettuce: 'Organic Lettuce',
      one_bunch: '1 Bunch',
      three_pieces: '3 Pieces',
      subtotal: 'Subtotal',
      delivery: 'Delivery',
      total: 'Total',
      delivery_address: 'Delivery Address',
      addr_home: 'Home',
      addr_office: 'Office',
      place_order: 'Place Order',
      order_placed: 'Order placed ✓',
      order_updated: 'Order updated ✓',
      order_delivery: 'delivery',
      open_order_title: 'Open order',
      open_order_text: 'New items will be added to this order',
      empty_bag: 'Empty bag',
      tap_confirm: 'Tap again to confirm',
      bag_emptied: 'Bag emptied',
      edit_profile: 'Edit profile',
      field_name: 'Name',
      field_email: 'Email',
      email_note: 'Email verification will be added soon',
      save_btn: 'Save',
      addr_flat: 'Flat / House No',
      addr_floor: 'Floor',
      addr_building: 'Building / Apartment',
      addr_area: 'Area / Locality',
      addr_city: 'City',
      addr_pin: 'PIN code',
      current_address: 'Current address',
      upi_discount: 'UPI on delivery discount (3%)',
      profile_saved: 'Profile updated ✓',
      address_saved: 'Address updated ✓',
      avatar_updated: 'Profile photo updated ✓',
      err_required: 'Name and email are required',
      err_signin: 'Please sign in to place your order',
      err_address: 'Choose a delivery address',
      err_items: 'Some items are no longer available',
      err_generic: 'Could not place the order — try again',
      items_word: 'Items',
      status_pending: 'Pending',
      history_empty: 'No orders yet',
      history_empty_sub: 'Your placed orders will appear here',
      history_signin: 'Sign in to see your orders',
      loading_orders: 'Loading your orders…',
      no_orders_filter: 'No orders in this filter',
      details_items: 'Items',
      sheet_placed: 'Placed',
      sheet_payment: 'Payment',
      order_late_note: 'Placed after 10 PM — delivered the day after',
      history_title: 'Order History',
      filter_all: 'All',
      filter_delivered: 'Delivered',
      filter_ongoing: 'Ongoing',
      filter_cancelled: 'Cancelled',
      status_delivered: 'Delivered',
      status_ongoing: 'On the way',
      status_cancelled: 'Cancelled',
      status_confirmed: 'Confirmed',
      status_rejected: 'Rejected',
      date_1: '15th Oct 2026',
      date_2: '14th Oct 2026',
      date_3: '14th Oct 2026',
      date_4: '15th Oct 2026',
      items_1: '1 Item',
      items_2: '2 Items',
      items_3: '3 Items',
      items_4: '4 Items',
      reorder: 'Reorder',
      cancel_order: 'Cancel order',
      order_cancelled: 'Order cancelled ✓',
      chat_contact: 'Store Support',
      chat_online: 'Online',
      chat_notice: 'Response may be delayed',
      chat_today: 'Today',
      chat_ph: 'Type a message',
      chat_b1: 'Hello Hannah! 👋 How can we help you today?',
      chat_b2: 'Hi! Can I change my delivery slot for order #VG-2398?',
      chat_b3: 'Of course. Which slot would you prefer?',
      chat_b4: 'Tomorrow between 8–10 AM, please.',
      chat_b5: 'Done ✅ Your order will arrive tomorrow, 8–10 AM.',
      chat_auto_reply: 'Thanks for your message! Our team will reply as soon as possible.',
      chat_hint: 'Send us a message — we usually reply within minutes.',
      account_title: 'Account',
      profile_name: 'Hannah',
      lang_label: 'Language',
      menu_my_orders: 'My Orders',
      menu_addresses: 'Delivery Addresses',
      menu_help: 'Help & Support',
      menu_logout: 'Log Out',
      slot_title: 'Delivery Slot',
      slot_morning: 'Morning',
      slot_evening: 'Evening',
      slot_none: 'No delivery slots are open right now — please check back soon',
      slot_sub: 'Order before 10 PM · delivered next morning',
      pay_title: 'Payment Method',
      pay_cod: 'Cash on Delivery',
      pay_cod_sub: 'Pay when your order arrives',
      cart_empty: 'Your bag is empty',
      cart_empty_sub: 'Add fresh vegetables & fruits to get started',
      browse: 'Browse products',
      login_welcome: 'Welcome',
      login_sub: 'Log in to order fresh vegetables & fruits',
      login_user_ph: 'Username',
      login_pass_ph: 'Password',
      remember_me: 'Remember me',
      forgot_password: 'Forgot Password?',
      login_btn: 'Log In',
      or_continue: 'or continue with',
      no_account: 'Don’t have an account?',
      sign_up: 'Sign Up',
      toast_login: 'Logging you in…',
      toast_checkout: 'Placing your order…',
      toast_added: 'Added to bag ✓',
      toast_removed: 'Removed from bag',
      toast_reorder: 'Items added to bag ✓',
      toast_demo: 'This section isn’t wired in this template yet'
    },

    hi: {
      hello: 'नमस्ते, हन्ना',
      hello_plain: 'नमस्ते',
      delivery_note: 'रात 10 बजे से पहले ऑर्डर करें — कल सुबह ताज़ा डिलीवरी!',
      vegetables: 'सब्ज़ियाँ',
      fruits: 'फल',
      tab_home: 'होम',
      tab_history: 'इतिहास',
      tab_message: 'संदेश',
      tab_account: 'खाता',
      veg_tomato: 'टमाटर',
      veg_potato: 'आलू',
      veg_onion: 'प्याज़',
      veg_spinach: 'पालक',
      veg_carrot: 'गाजर',
      veg_cucumber: 'खीरा',
      veg_capsicum: 'शिमला मिर्च',
      veg_brinjal: 'बैंगन',
      veg_corn: 'मक्का',
      veg_pumpkin: 'कद्दू',
      veg_broccoli: 'ब्रोकली',
      veg_mushroom: 'मशरूम',
      veg_garlic: 'लहसुन',
      veg_chilli: 'हरी मिर्च',
      veg_lettuce: 'सलाद पत्ता',
      veg_cabbage: 'पत्तागोभी',
      veg_coriander: 'धनिया',
      veg_sweet_potato: 'शकरकंद',
      veg_methi: 'मेथी',
      veg_shepu: 'शेपू',
      veg_chuka: 'चुका',
      veg_ginger: 'अदरक',
      veg_curry_leaves: 'कड़ी पत्ता',
      fruit_apple: 'सेब',
      fruit_banana: 'केला',
      fruit_mango: 'आम',
      fruit_grapes: 'अंगूर',
      fruit_orange: 'संतरा',
      fruit_lemon: 'नींबू',
      fruit_watermelon: 'तरबूज़',
      fruit_strawberry: 'स्ट्रॉबेरी',
      fruit_peach: 'आड़ू',
      fruit_pineapple: 'अनानास',
      fruit_kiwi: 'कीवी',
      fruit_pear: 'नाशपाती',
      fruit_melon: 'खरबूजा',
      fruit_cherry: 'चेरी',
      fruit_coconut: 'नारियल',
      fruit_avocado: 'एवोकाडो',
      unit_kg: ' /किलो',
      unit_bunch: ' /गड्डी',
      unit_pack: ' /पैक',
      unit_piece: ' /नग',
      unit_dozen: ' /दर्जन',
      unit_100g: ' /100 ग्राम',
      u_kg: 'किलो',
      u_g: 'ग्राम',
      u_bunch: 'गड्डी',
      u_pack: 'पैक',
      u_piece: 'नग',
      u_dozen: 'दर्जन',
      pay_upi: 'डिलीवरी पर UPI',
      paid_word: 'भुगतान हुआ',
      cod_word: 'कैश',
      pay_at_delivery: 'डिलीवरी पर भुगतान',
      sec_kg: 'किलो · वज़न',
      sec_bunch: 'गड्डी (जुडी)',
      sec_gram: 'ग्राम',
      sec_piece_pack: 'पीस और पैक',
      sec_dozen_piece: 'दर्जन · पीस (गिनती)',
      sec_pack: 'पैक (तैयार)',
      my_cart: 'मेरा कार्ट',
      fresh_fiji_apples: 'ताज़े फ़िजी सेब',
      organic_spinach: 'जैविक पालक',
      organic_lettuce: 'जैविक सलाद पत्ता',
      one_bunch: '1 गड्डी',
      three_pieces: '3 पीस',
      subtotal: 'उप-योग',
      delivery: 'डिलीवरी',
      total: 'कुल',
      delivery_address: 'डिलीवरी पता',
      addr_home: 'घर',
      addr_office: 'ऑफ़िस',
      place_order: 'ऑर्डर करें',
      order_placed: 'ऑर्डर हो गया ✓',
      order_updated: 'ऑर्डर अपडेट हुआ ✓',
      order_delivery: 'डिलीवरी',
      open_order_title: 'खुला ऑर्डर',
      open_order_text: 'नए आइटम इसी ऑर्डर में जोड़े जाएँगे',
      empty_bag: 'बैग खाली करें',
      tap_confirm: 'पुष्टि के लिए फिर टैप करें',
      bag_emptied: 'बैग खाली हो गया',
      edit_profile: 'प्रोफ़ाइल संपादित करें',
      field_name: 'नाम',
      field_email: 'ईमेल',
      email_note: 'ईमेल सत्यापन जल्द जोड़ा जाएगा',
      save_btn: 'सहेजें',
      addr_flat: 'फ्लैट / मकान नंबर',
      addr_floor: 'मंज़िल',
      addr_building: 'बिल्डिंग / अपार्टमेंट',
      addr_area: 'इलाका',
      addr_city: 'शहर',
      addr_pin: 'पिन कोड',
      current_address: 'वर्तमान पता',
      upi_discount: 'डिलीवरी पर UPI छूट (3%)',
      profile_saved: 'प्रोफ़ाइल अपडेट हुई ✓',
      address_saved: 'पता अपडेट हुआ ✓',
      avatar_updated: 'प्रोफ़ाइल फ़ोटो अपडेट हुई ✓',
      err_required: 'नाम और ईमेल आवश्यक हैं',
      err_signin: 'ऑर्डर करने के लिए लॉग इन करें',
      err_address: 'डिलीवरी पता चुनें',
      err_items: 'कुछ आइटम अब उपलब्ध नहीं हैं',
      err_generic: 'ऑर्डर नहीं हो सका — फिर कोशिश करें',
      items_word: 'आइटम',
      status_pending: 'प्रतीक्षा में',
      history_empty: 'अभी कोई ऑर्डर नहीं',
      history_empty_sub: 'आपके ऑर्डर यहाँ दिखेंगे',
      history_signin: 'अपने ऑर्डर देखने के लिए लॉग इन करें',
      loading_orders: 'आपके ऑर्डर लोड हो रहे हैं…',
      no_orders_filter: 'इस फ़िल्टर में कोई ऑर्डर नहीं',
      details_items: 'आइटम',
      sheet_placed: 'ऑर्डर समय',
      sheet_payment: 'भुगतान',
      order_late_note: 'रात 10 बजे के बाद ऑर्डर — अगले दिन डिलीवरी',
      history_title: 'ऑर्डर इतिहास',
      filter_all: 'सभी',
      filter_delivered: 'डिलीवर हुए',
      filter_ongoing: 'चल रहे',
      filter_cancelled: 'रद्द',
      status_delivered: 'डिलिवर हुआ',
      status_ongoing: 'रास्ते में',
      status_cancelled: 'रद्द',
      status_confirmed: 'कन्फर्म हुआ',
      status_rejected: 'रद्द किया गया',
      date_1: '15 अक्टूबर 2026',
      date_2: '14 अक्टूबर 2026',
      date_3: '14 अक्टूबर 2026',
      date_4: '15 अक्टूबर 2026',
      items_1: '1 आइटम',
      items_2: '2 आइटम',
      items_3: '3 आइटम',
      items_4: '4 आइटम',
      reorder: 'फिर से ऑर्डर करें',
      cancel_order: 'ऑर्डर रद्द करें',
      order_cancelled: 'ऑर्डर रद्द हो गया ✓',
      chat_contact: 'स्टोर सहायता',
      chat_online: 'ऑनलाइन',
      chat_notice: 'जवाब में देरी हो सकती है',
      chat_today: 'आज',
      chat_ph: 'संदेश लिखें',
      chat_b1: 'नमस्ते हन्ना! 👋 हम आपकी क्या मदद कर सकते हैं?',
      chat_b2: 'नमस्ते! क्या मैं ऑर्डर #VG-2398 का डिलीवरी स्लॉट बदल सकती हूँ?',
      chat_b3: 'बिल्कुल। आप कौन सा स्लॉट चाहेंगी?',
      chat_b4: 'कल सुबह 8–10 बजे, कृपया।',
      chat_b5: 'हो गया ✅ आपका ऑर्डर कल सुबह 8–10 बजे आ जाएगा।',
      chat_auto_reply: 'आपके संदेश के लिए धन्यवाद! हमारी टीम जल्द ही जवाब देगी।',
      chat_hint: 'हमें संदेश भेजें — हम आमतौर पर मिनटों में जवाब देते हैं।',
      account_title: 'खाता',
      profile_name: 'हन्ना',
      lang_label: 'भाषा',
      menu_my_orders: 'मेरे ऑर्डर',
      menu_addresses: 'डिलीवरी पते',
      menu_help: 'सहायता और समर्थन',
      menu_logout: 'लॉग आउट',
      slot_title: 'डिलीवरी समय',
      slot_morning: 'सुबह',
      slot_evening: 'शाम',
      slot_none: 'अभी कोई डिलीवरी स्लॉट उपलब्ध नहीं है — कृपया बाद में देखें',
      slot_sub: 'रात 10 बजे से पहले ऑर्डर = अगली सुबह डिलीवरी',
      pay_title: 'भुगतान विधि',
      pay_cod: 'कैश ऑन डिलीवरी',
      pay_cod_sub: 'ऑर्डर मिलने पर भुगतान करें',
      cart_empty: 'आपका बैग खाली है',
      cart_empty_sub: 'शुरू करने के लिए ताज़ी सब्ज़ियाँ और फल जोड़ें',
      browse: 'उत्पाद देखें',
      login_welcome: 'स्वागत है',
      login_sub: 'ताज़ी सब्ज़ियाँ और फल ऑर्डर करने के लिए लॉग इन करें',
      login_user_ph: 'उपयोगकर्ता नाम',
      login_pass_ph: 'पासवर्ड',
      remember_me: 'मुझे याद रखें',
      forgot_password: 'पासवर्ड भूल गए?',
      login_btn: 'लॉग इन करें',
      or_continue: 'या इसके साथ जारी रखें',
      no_account: 'खाता नहीं है?',
      sign_up: 'साइन अप करें',
      toast_login: 'लॉग इन किया जा रहा है…',
      toast_checkout: 'ऑर्डर किया जा रहा है…',
      toast_added: 'बैग में जोड़ा गया ✓',
      toast_removed: 'बैग से हटाया',
      toast_reorder: 'आइटम बैग में जोड़े गए ✓',
      toast_demo: 'यह सेक्शन अभी टेम्पलेट में जोड़ा नहीं गया है'
    },

    mr: {
      hello: 'नमस्कार, हन्ना',
      hello_plain: 'नमस्कार',
      delivery_note: 'रात्री 10 पर्यंत ऑर्डर करा — उद्या सकाळी ताजे वितरण!',
      vegetables: 'भाज्या',
      fruits: 'फळे',
      tab_home: 'होम',
      tab_history: 'इतिहास',
      tab_message: 'संदेश',
      tab_account: 'खाते',
      veg_tomato: 'टोमॅटो',
      veg_potato: 'बटाटा',
      veg_onion: 'कांदा',
      veg_spinach: 'पालक',
      veg_carrot: 'गाजर',
      veg_cucumber: 'काकडी',
      veg_capsicum: 'शिमला मिरची',
      veg_brinjal: 'वांगे',
      veg_corn: 'मका',
      veg_pumpkin: 'भोपळा',
      veg_broccoli: 'ब्रोकोली',
      veg_mushroom: 'मशरूम',
      veg_garlic: 'लसूण',
      veg_chilli: 'हिरवी मिरची',
      veg_lettuce: 'लेट्यूस',
      veg_cabbage: 'कोबी',
      veg_coriander: 'कोथिंबीर',
      veg_sweet_potato: 'रताळे',
      veg_methi: 'मेथी',
      veg_shepu: 'शेपू',
      veg_chuka: 'चुका',
      veg_ginger: 'आले',
      veg_curry_leaves: 'कढीपत्ता',
      fruit_apple: 'सफरचंद',
      fruit_banana: 'केळे',
      fruit_mango: 'आंबा',
      fruit_grapes: 'द्राक्षे',
      fruit_orange: 'संत्री',
      fruit_lemon: 'लिंबू',
      fruit_watermelon: 'टरबूज',
      fruit_strawberry: 'स्ट्रॉबेरी',
      fruit_peach: 'पीच',
      fruit_pineapple: 'अननस',
      fruit_kiwi: 'कीवी',
      fruit_pear: 'नाशपाती',
      fruit_melon: 'खरबूज',
      fruit_cherry: 'चेरी',
      fruit_coconut: 'नारळ',
      fruit_avocado: 'ॲवोकॅडो',
      unit_kg: ' /किलो',
      unit_bunch: ' /गड्डी',
      unit_pack: ' /पॅक',
      unit_piece: ' /नग',
      unit_dozen: ' /डझन',
      unit_100g: ' /100 ग्राम',
      u_kg: 'किलो',
      u_g: 'ग्राम',
      u_bunch: 'गड्डी',
      u_pack: 'पॅक',
      u_piece: 'नग',
      u_dozen: 'डझन',
      pay_upi: 'डिलिव्हरीवर UPI',
      paid_word: 'पेमेंट झाले',
      cod_word: 'कॅश',
      pay_at_delivery: 'डिलिव्हरीवर पेमेंट',
      sec_kg: 'किलो · वजन',
      sec_bunch: 'गड्डी (जुडी)',
      sec_gram: 'ग्राम',
      sec_piece_pack: 'पीस आणि पॅक',
      sec_dozen_piece: 'डझन · पीस (संख्या)',
      sec_pack: 'पॅक (तयार)',
      my_cart: 'माझे कार्ट',
      fresh_fiji_apples: 'ताजी फिजी सफरचंद',
      organic_spinach: 'सेंद्रिय पालक',
      organic_lettuce: 'सेंद्रिय लेट्यूस',
      one_bunch: '1 गड्डी',
      three_pieces: '3 नग',
      subtotal: 'उप-एकूण',
      delivery: 'वितरण',
      total: 'एकूण',
      delivery_address: 'वितरण पत्ता',
      addr_home: 'घर',
      addr_office: 'ऑफिस',
      place_order: 'ऑर्डर करा',
      order_placed: 'ऑर्डर झाली ✓',
      order_updated: 'ऑर्डर अपडेट झाली ✓',
      order_delivery: 'वितरण',
      open_order_title: 'सुरू असलेली ऑर्डर',
      open_order_text: 'नवीन वस्तू याच ऑर्डरमध्ये जोडल्या जातील',
      empty_bag: 'बॅग रिकामी करा',
      tap_confirm: 'खात्रीसाठी पुन्हा टॅप करा',
      bag_emptied: 'बॅग रिकामी झाली',
      edit_profile: 'प्रोफाइल संपादित करा',
      field_name: 'नाव',
      field_email: 'ईमेल',
      email_note: 'ईमेल पडताळणी लवकरच जोडली जाईल',
      save_btn: 'जतन करा',
      addr_flat: 'फ्लॅट / घर क्र.',
      addr_floor: 'मजला',
      addr_building: 'इमारत / अपार्टमेंट',
      addr_area: 'परिसर',
      addr_city: 'शहर',
      addr_pin: 'पिन कोड',
      current_address: 'सध्याचा पत्ता',
      upi_discount: 'डिलिव्हरीवर UPI सूट (3%)',
      profile_saved: 'प्रोफाइल अपडेट झाले ✓',
      address_saved: 'पत्ता अपडेट झाला ✓',
      avatar_updated: 'प्रोफाइल फोटो अपडेट झाला ✓',
      err_required: 'नाव आणि ईमेल आवश्यक आहेत',
      err_signin: 'ऑर्डर करण्यासाठी लॉग इन करा',
      err_address: 'वितरण पत्ता निवडा',
      err_items: 'काही वस्तू आता उपलब्ध नाहीत',
      err_generic: 'ऑर्डर झाली नाही — पुन्हा प्रयत्न करा',
      items_word: 'वस्तू',
      status_pending: 'प्रलंबित',
      history_empty: 'अजून ऑर्डर नाही',
      history_empty_sub: 'तुमच्या ऑर्डर इथे दिसतील',
      history_signin: 'तुमच्या ऑर्डर पाहण्यासाठी लॉग इन करा',
      loading_orders: 'तुमच्या ऑर्डर लोड होत आहेत…',
      no_orders_filter: 'या फिल्टरमध्ये ऑर्डर नाहीत',
      details_items: 'वस्तू',
      sheet_placed: 'ऑर्डर वेळ',
      sheet_payment: 'पेमेंट',
      order_late_note: 'रात्री 10 नंतर ऑर्डर — पुढच्या दिवशी वितरण',
      history_title: 'ऑर्डर इतिहास',
      filter_all: 'सर्व',
      filter_delivered: 'डिलिव्हर झाले',
      filter_ongoing: 'सुरू असलेले',
      filter_cancelled: 'रद्द',
      status_delivered: 'डिलिव्हर झाले',
      status_ongoing: 'मार्गात',
      status_cancelled: 'रद्द',
      status_confirmed: 'कन्फर्म झाले',
      status_rejected: 'रद्द केले',
      date_1: '15 ऑक्टोबर 2026',
      date_2: '14 ऑक्टोबर 2026',
      date_3: '14 ऑक्टोबर 2026',
      date_4: '15 ऑक्टोबर 2026',
      items_1: '1 वस्तू',
      items_2: '2 वस्तू',
      items_3: '3 वस्तू',
      items_4: '4 वस्तू',
      reorder: 'पुन्हा ऑर्डर करा',
      cancel_order: 'ऑर्डर रद्द करा',
      order_cancelled: 'ऑर्डर रद्द झाली ✓',
      chat_contact: 'स्टोअर सपोर्ट',
      chat_online: 'ऑनलाइन',
      chat_notice: 'उत्तरास उशीर होऊ शकतो',
      chat_today: 'आज',
      chat_ph: 'संदेश लिहा',
      chat_b1: 'नमस्कार हन्ना! 👋 आम्ही तुम्हाला कशी मदत करू शकतो?',
      chat_b2: 'नमस्कार! मी ऑर्डर #VG-2398 चा डिलिव्हरी स्लॉट बदलू शकते का?',
      chat_b3: 'अर्थातच. तुम्हाला कोणता स्लॉट हवा आहे?',
      chat_b4: 'उद्या सकाळी 8–10 दरम्यान, कृपया.',
      chat_b5: 'झाले ✅ तुमची ऑर्डर उद्या सकाळी 8–10 दरम्यान येईल.',
      chat_auto_reply: 'तुमच्या संदेशाबद्दल धन्यवाद! आमची टीम लवकरच उत्तर देईल.',
      chat_hint: 'आम्हाला संदेश पाठवा — आम्ही सहसा काही मिनिटांत उत्तर देतो.',
      account_title: 'खाते',
      profile_name: 'हन्ना',
      lang_label: 'भाषा',
      menu_my_orders: 'माझ्या ऑर्डर्स',
      menu_addresses: 'वितरण पत्ते',
      menu_help: 'मदत आणि समर्थन',
      menu_logout: 'लॉग आउट',
      slot_title: 'वितरण वेळ',
      slot_morning: 'सकाळ',
      slot_evening: 'संध्याकाळ',
      slot_none: 'सध्या कोणताही डिलिव्हरी स्लॉट उपलब्ध नाही — कृपया नंतर पहा',
      slot_sub: 'रात्री 10 पर्यंत ऑर्डर = पुढील सकाळी वितरण',
      pay_title: 'पेमेंट पद्धत',
      pay_cod: 'कॅश ऑन डिलिव्हरी',
      pay_cod_sub: 'ऑर्डर मिळाल्यावर पैसे द्या',
      cart_empty: 'तुमची बॅग रिकामी आहे',
      cart_empty_sub: 'सुरू करण्यासाठी ताज्या भाज्या आणि फळे जोडा',
      browse: 'उत्पादने पहा',
      login_welcome: 'स्वागत आहे',
      login_sub: 'ताज्या भाज्या आणि फळे ऑर्डर करण्यासाठी लॉग इन करा',
      login_user_ph: 'वापरकर्तानाव',
      login_pass_ph: 'पासवर्ड',
      remember_me: 'मला लक्षात ठेवा',
      forgot_password: 'पासवर्ड विसरला?',
      login_btn: 'लॉग इन करा',
      or_continue: 'किंवा यासह सुरू ठेवा',
      no_account: 'खाते नाही?',
      sign_up: 'साइन अप करा',
      toast_login: 'लॉग इन केले जात आहे…',
      toast_checkout: 'ऑर्डर दिली जात आहे…',
      toast_added: 'बॅगमध्ये जोडले ✓',
      toast_removed: 'बॅगमधून काढले',
      toast_reorder: 'वस्तू बॅगमध्ये जोडल्या ✓',
      toast_demo: 'हा विभाग अद्याप टेम्पलेटमध्ये जोडलेला नाही'
    }
  };

  var LANG_STORAGE_KEY = 'vegshop-lang';
  var LANGS = ['en', 'hi', 'mr'];

  /* pages can lock their language (e.g. the login screen is English-only) */
  var lockLang = document.documentElement.getAttribute('data-lang-lock');
  if (lockLang && LANGS.indexOf(lockLang) === -1) lockLang = null;

  /* URL param (?lang=hi) wins on load — handy for testing & sharing links */
  var currentLang = lockLang || (function () {
    var fromUrl = null;
    try { fromUrl = new URLSearchParams(window.location.search).get('lang'); } catch (e) { /* noop */ }
    if (fromUrl && LANGS.indexOf(fromUrl) !== -1) return fromUrl;
    try {
      var saved = localStorage.getItem(LANG_STORAGE_KEY);
      if (saved && LANGS.indexOf(saved) !== -1) return saved;
    } catch (e) { /* noop */ }
    return 'en';
  })();

  function t(key) {
    var dict = I18N[currentLang] || I18N.en;
    if (dict[key] != null) return dict[key];
    return I18N.en[key] != null ? I18N.en[key] : key;
  }

  function applyLanguage(lang) {
    if (lockLang) lang = lockLang;
    if (LANGS.indexOf(lang) === -1) lang = 'en';
    currentLang = lang;
    if (!lockLang) {
      try { localStorage.setItem(LANG_STORAGE_KEY, lang); } catch (e) { /* noop */ }
    }

    document.documentElement.lang = lang;

    $$('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    $$('[data-i18n-placeholder]').forEach(function (el) {
      el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });
    $$('.lang').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });

    paintHello();
  }

  $$('.lang').forEach(function (btn) {
    btn.addEventListener('click', function () { applyLanguage(btn.getAttribute('data-lang')); });
  });

  /* ---------- home greeting: show the signed-in customer's name ---------- */

  var liveFirstName = null;

  function paintHello() {
    var el = $('.hello');
    if (!el || !liveFirstName) return;
    el.removeAttribute('data-i18n');
    el.textContent = t('hello_plain') + ', ' + liveFirstName;
  }

  if ($('.hello') && window.TAZA) {
    window.TAZA.available().then(function (ok) {
      if (!ok || !window.TAZA.token()) return;
      window.TAZA.me().then(function (res) {
        var u = res.user;
        if (u && u.name) {
          liveFirstName = String(u.name).trim().split(' ')[0];
          paintHello();
        }
      }).catch(function () { /* keep the demo greeting */ });
    });
  }

  /* preview helper: ?scroll=bottom jumps the content area to the bottom */
  try {
    if (new URLSearchParams(window.location.search).get('scroll') === 'bottom') {
      setTimeout(function () {
        var c = $('.content');
        if (c) c.scrollTop = c.scrollHeight;
      }, 500);
    }
  } catch (e) { /* noop */ }

  /* ---------- toast ---------- */

  function toast(message, ms) {
    var screen = $('.screen');
    if (!screen) return;
    var el = $('.toast', screen);
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      screen.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(function () { el.classList.remove('show'); }, ms || 1700);
  }

  $$('[data-toast-key], [data-toast]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      if (el.tagName === 'A') e.preventDefault(); // demo links
      var key = el.getAttribute('data-toast-key');
      toast(key ? t(key) : el.getAttribute('data-toast'));
    });
  });

  /* ---------- cart totals ---------- */

  function updateCartTotals() {
    var items = $$('.cart-item');
    if (!items.length) return;

    var subtotal = 0;
    items.forEach(function (item) {
      subtotal += parseFloat(item.dataset.price) * parseFloat(item.dataset.qty);
    });
    var delivery = subtotal > 0 ? 3 : 0;

    /* UPI orders get a 3% discount on the items subtotal */
    var payEl = $('.pay-card .addr-option.active');
    var pay = payEl && payEl.getAttribute('data-pay') ? payEl.getAttribute('data-pay') : 'cod';
    var discount = pay === 'upi' && subtotal > 0 ? Math.round(subtotal * 0.03 * 10) / 10 : 0;

    var upiRow = $('#upiRow');
    var upiEl = $('#upiDiscount');
    if (upiRow && upiEl) {
      upiRow.hidden = !(discount > 0);
      if (discount > 0) upiEl.textContent = '-' + money(discount);
    }

    var set = function (id, value) {
      var el = document.getElementById(id);
      if (el) el.textContent = value;
    };
    set('subtotal', money(subtotal));
    set('delivery', money(delivery));
    set('total', money(Math.round((subtotal - discount + delivery) * 10) / 10));
  }

  /* preselect a payment option (default method) */
  function setPayOption(pay) {
    var card = $('.pay-card');
    if (!card) return;
    $$('.addr-option', card).forEach(function (o) {
      var active = o.getAttribute('data-pay') === pay;
      o.classList.toggle('active', active);
      var input = $('input', o);
      if (input) input.checked = active;
    });
    updateCartTotals();
  }

  function localDefaultPay() {
    try { return localStorage.getItem('taza-default-pay') || 'cod'; } catch (e) { return 'cod'; }
  }

  /* ---------- bag (shared between home & cart) ---------- */

  var BAG_KEY = 'vegshop-bag';

  function getBag() {
    try { return JSON.parse(localStorage.getItem(BAG_KEY)) || []; } catch (e) { return []; }
  }
  function saveBag(bag) {
    try { localStorage.setItem(BAG_KEY, JSON.stringify(bag)); } catch (e) { /* noop */ }
  }
  function bagCount(bag) {
    return bag.reduce(function (n, it) { return n + it.qty; }, 0);
  }
  function findBagItem(bag, id) {
    var found = null;
    bag.forEach(function (it) { if (it.id === id) found = it; });
    return found;
  }
  function mergeBag(id, qty, emoji, price, unitKey) {
    var bag = getBag();
    var item = findBagItem(bag, id);
    if (item) {
      item.qty = Math.min(99, item.qty + qty);
    } else {
      bag.push({ id: id, qty: Math.min(99, qty), emoji: emoji || '🧺', price: price || 0, unit: unitKey || 'unit_pack' });
    }
    saveBag(bag);
    updateFabs();
  }
  function updateFabs() {
    var count = bagCount(getBag());
    $$('.tab-fab').forEach(function (fab) {
      var el = $('.bag-count', fab);
      if (!el) {
        el = document.createElement('span');
        el.className = 'bag-count';
        fab.appendChild(el);
      }
      el.textContent = count;
      el.hidden = count === 0;
    });
  }
  function setBagItem(id, qty, sourceRow) {
    var bag = getBag();
    if (qty <= 0) {
      bag = bag.filter(function (it) { return it.id !== id; });
      saveBag(bag);
      updateFabs();
      return;
    }
    var item = findBagItem(bag, id);
    if (!item) {
      var emoji = '';
      var price = 0;
      var unit = 'unit_pack';
      if (sourceRow) {
        var e = $('.r-emoji', sourceRow);
        var p = $('.price span', sourceRow);
        emoji = e ? e.textContent.trim() : '';
        price = parseFloat(sourceRow.dataset.price) || 0;
        unit = p && p.getAttribute('data-i18n') ? p.getAttribute('data-i18n') : 'unit_pack';
      }
      item = { id: id, qty: qty, emoji: emoji, price: price, unit: unit };
      bag.push(item);
    } else {
      item.qty = qty;
    }
    saveBag(bag);
    updateFabs();
  }
  function refreshStepperState(stepper, qty, min) {
    if (!stepper) return;
    var minus = $('.step[data-step="-1"]', stepper);
    if (minus) minus.disabled = qty <= min;
  }

  /* ---------- quantity steppers (delegated — also covers rendered cart rows) ---------- */

  function stepInfo(stepper) {
    var row = stepper.closest('.cart-item') || stepper.closest('.rate-row');
    var unitEl = row ? $('.price span[data-i18n]', row) : null;
    var isKg = !!(unitEl && unitEl.getAttribute('data-i18n') === 'unit_kg');
    return { step: isKg ? 0.5 : 1, isKg: isKg };
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.step');
    if (!btn || btn.disabled) return;
    var stepper = btn.closest('.stepper');
    var qtyEl = stepper ? $('.qty', stepper) : null;
    if (!qtyEl) return;

    var cartItem = stepper.closest('.cart-item');
    var rateRow = stepper.closest('.rate-row');
    var info = stepInfo(stepper);
    var current = parseFloat(qtyEl.textContent) || 0;
    var min = cartItem ? info.step : 0;
    var raw = current + (parseInt(btn.dataset.step, 10) * info.step);
    var next = Math.min(99, Math.max(min, Math.round(raw * 10) / 10));

    /* cart: minus at the minimum removes the item */
    if (cartItem && next === current) {
      setBagItem(cartItem.dataset.id, 0);
      renderCart();
      toast(t('toast_removed'));
      return;
    }
    if (next === current) return;

    qtyEl.textContent = fmtQty(next);
    refreshStepperState(stepper, next, 0);

    if (cartItem) {
      cartItem.dataset.qty = next;
      setBagItem(cartItem.dataset.id, next);
      var lt = $('.line-total', cartItem);
      if (lt) lt.textContent = '= ' + money(parseFloat(cartItem.dataset.price) * next);
      updateCartTotals();
    }

    if (rateRow) {
      var h4 = rateRow.querySelector('h4');
      if (h4) setBagItem(h4.getAttribute('data-i18n'), next, rateRow);

      var rowTotal = $('.row-total', rateRow);
      if (rowTotal) {
        if (next > 1) {
          rowTotal.textContent = '= ' + money(parseFloat(rateRow.dataset.price) * next);
          rowTotal.hidden = false;
        } else {
          rowTotal.hidden = true;
        }
      }
      if (current === 0) toast(t('toast_added'));
    }
  });

  /* ---------- cart rendering (from the shared bag) ---------- */

  var STEP_MINUS_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M5 12h14" /></svg>';
  var STEP_PLUS_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>';

  function renderCart() {
    var list = $('#cartList');
    if (!list) return;

    var content = $('.cart-content');
    var bar = $('.checkout-bar');
    var bag = getBag();

    if (!bag.length) {
      if (content) content.classList.add('is-empty');
      if (bar) bar.hidden = true;
      list.innerHTML = '';
      return;
    }

    if (content) content.classList.remove('is-empty');
    if (bar) bar.hidden = false;

    var countEl = $('#bagCount');
    if (countEl) countEl.textContent = bag.length + ' ' + t('items_word');

    list.innerHTML = bag.map(function (it) {
      return '<li class="cart-item" data-id="' + it.id + '" data-price="' + it.price + '" data-qty="' + it.qty + '">' +
        '<div class="c-thumb" aria-hidden="true">' + it.emoji + '</div>' +
        '<div class="c-info">' +
        '<h4 data-i18n="' + it.id + '">' + it.id + '</h4>' +
        '<p class="price"><b>' + money(it.price) + '</b><span data-i18n="' + it.unit + '"></span></p>' +
        '<em class="line-total">= ' + money(Number(it.price) * Number(it.qty)) + '</em>' +
        '</div>' +
        '<div class="stepper">' +
        '<button class="step" data-step="-1" aria-label="Decrease quantity">' + STEP_MINUS_SVG + '</button>' +
        '<span class="qty">' + fmtQty(it.qty) + '</span>' +
        '<button class="step plus" data-step="1" aria-label="Increase quantity">' + STEP_PLUS_SVG + '</button>' +
        '</div>' +
        '</li>';
    }).join('');

    applyLanguage(currentLang);
    $$('.cart-item .stepper').forEach(function (stepper) {
      refreshStepperState(stepper, parseFloat($('.qty', stepper).textContent), 0);
    });
    updateCartTotals();
  }

  /* ---------- home rows ↔ bag ---------- */

  function initHomeRows() {
    var rows = $$('.rate-row[data-price]');
    if (!rows.length) return;
    var bag = getBag();
    rows.forEach(function (row) {
      var h4 = row.querySelector('h4');
      if (!h4) return;
      var item = findBagItem(bag, h4.getAttribute('data-i18n'));
      var qty = item ? item.qty : 0;
      var qtyEl = $('.qty', row);
      if (qtyEl) qtyEl.textContent = fmtQty(qty);
      refreshStepperState($('.stepper', row), qty, 0);
    });
  }

  /* ---------- bag init (runs on every page) ---------- */

  function initBag() {
    if ($('#cartList')) {
      /* ?bag=demo seeds a sample bag (handy for previews & demos) */
      var demo = null;
      try { demo = new URLSearchParams(window.location.search).get('bag'); } catch (e) { /* noop */ }
      if (demo === 'demo' && getBag().length === 0) {
        saveBag([
          { id: 'fresh_fiji_apples', qty: 2, emoji: '🍎', price: 100, unit: 'unit_pack' },
          { id: 'organic_spinach', qty: 1, emoji: '🥬', price: 20, unit: 'unit_bunch' },
          { id: 'organic_lettuce', qty: 3, emoji: '🥬', price: 30, unit: 'unit_bunch' }
        ]);
      }
      renderCart();
    }
    initHomeRows();
    updateFabs();
  }

  /* ---------- product tabs (Vegetables / Fruits) ---------- */

  var productTabs = $$('.tabs .tab');
  if (productTabs.length) {
    var productPanes = { veg: $('#vegList'), fruits: $('#fruitList') };
    productTabs.forEach(function (btn) {
      btn.addEventListener('click', function () {
        productTabs.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var target = btn.getAttribute('data-tab');
        Object.keys(productPanes).forEach(function (key) {
          if (productPanes[key]) productPanes[key].hidden = (key !== target);
        });
      });
    });

    /* ?tab=fruits opens the Fruits list directly (handy for testing/sharing) */
    var urlTab = null;
    try { urlTab = new URLSearchParams(window.location.search).get('tab'); } catch (e) { /* noop */ }
    if (urlTab === 'fruits' && productTabs[1]) productTabs[1].click();
  }

  /* ---------- selectable option groups (address / slot / payment) ---------- */

  $$('.addr-option').forEach(function (opt) {
    opt.addEventListener('click', function () {
      var group = opt.closest('section') || document;
      $$('.addr-option', group).forEach(function (o) { o.classList.remove('active'); });
      opt.classList.add('active');
      var input = $('input', opt);
      if (input) input.checked = true;
      if (opt.closest('.pay-card')) updateCartTotals();
    });
  });

  /* ---------- place order (cart → backend) ---------- */

  var placeBtn = $('#placeOrderBtn');

  function showLastOrder(order, merged) {
    var el = $('#orderSuccess');
    if (!el || !order || !order.id) return;
    var title = $('#orderSuccessTitle');
    var text = $('#orderSuccessText');
    if (title) title.textContent = merged ? t('order_updated') : t('order_placed');
    if (text) {
      var str = order.id;
      if (order.deliveryDate) str += ' · ' + t('order_delivery') + ' ' + order.deliveryDate;
      text.textContent = str;
    }
    el.hidden = false;
  }

  /* shows only the ?last= preview variant — the green banner does NOT persist
     across visits (it confused users by appearing before a new order) */
  function restoreLastOrder() {
    var urlId = null;
    try { urlId = new URLSearchParams(window.location.search).get('last'); } catch (e) { /* noop */ }
    if (urlId) {
      showLastOrder({ id: urlId, deliveryDate: new URLSearchParams(window.location.search).get('date') || '' });
    }
  }

  /* ---------- open order strip: new items merge into it ---------- */

  function showOpenOrder(order) {
    var el = $('#openOrder');
    if (!el || !order || !order.id) return;
    var success = $('#orderSuccess');
    if (success && !success.hidden) return;   /* fresh green confirmation already explains it */
    var title = $('#openOrderTitle');
    var text = $('#openOrderText');
    if (title) title.textContent = t('open_order_title') + ' · ' + order.id;
    if (text) {
      var str = t('open_order_text');
      if (order.delivery_date) str += ' · ' + t('order_delivery') + ' ' + order.delivery_date;
      text.textContent = str;
    }
    el.hidden = false;
  }

  if ($('#openOrder') && window.TAZA) {
    window.TAZA.available().then(function (ok) {
      if (!ok || !window.TAZA.token()) return;
      window.TAZA.myOrders().then(function (res) {
        var d = new Date();
        var p = function (n) { return n < 10 ? '0' + n : '' + n; };
        var todayStr = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
        var open = (res.orders || []).filter(function (o) {
          return (o.status === 'pending' || o.status === 'confirmed') && String(o.delivery_date || '') >= todayStr;
        })[0];
        if (open) showOpenOrder(open);
      }).catch(function () { /* noop */ });
    });
  }

  function setPlaceBusy(busy) {
    if (!placeBtn) return;
    placeBtn.disabled = busy;
    placeBtn.classList.toggle('is-busy', busy);
  }

  if (placeBtn) {
    placeBtn.addEventListener('click', function () {
      var bag = getBag();
      if (!bag.length) { toast(t('cart_empty')); return; }

      /* static demo mode (no backend running) */
      if (!window.TAZA) { toast(t('toast_checkout')); return; }

      if (!window.TAZA.token()) {
        toast(t('err_signin'), 2600);
        setTimeout(function () { window.location.href = 'login.html'; }, 1500);
        return;
      }

      var addrEl = $('.address-card .addr-option.active .addr-text');
      var address = addrEl ? addrEl.textContent.trim() : '';
      if (!address) { toast(t('err_address'), 2600); return; }

      var slotEl = $('.slot-card .addr-option.active');
      var payEl = $('.pay-card .addr-option.active');
      var slot = slotEl && slotEl.getAttribute('data-slot') ? slotEl.getAttribute('data-slot') : 'morning';
      var payment = payEl && payEl.getAttribute('data-pay') ? payEl.getAttribute('data-pay') : 'cod';

      setPlaceBusy(true);
      toast(t('toast_checkout'), 1200);

      window.TAZA.getProducts().then(function (res) {
        /* map the local bag (i18n keys) to the live catalogue by name */
        var byName = {};
        (res.products || []).forEach(function (p) { byName[String(p.name).toLowerCase()] = p; });

        var items = [];
        bag.forEach(function (b) {
          var en = (I18N.en && I18N.en[b.id]) ? String(I18N.en[b.id]).toLowerCase() : '';
          var p = byName[en];
          if (p) items.push({ productId: p.id, qty: b.qty });
        });

        if (!items.length) throw new Error(t('err_items'));
        return window.TAZA.placeOrder({ items: items, slot: slot, payment: payment, address: address });
      }).then(function (res) {
        var order = res.order || {};
        var merged = !!res.merged;
        saveBag([]);
        updateFabs();
        renderCart();
        setPlaceBusy(false);

        showLastOrder(order, merged);
        toast((merged ? t('order_updated') : t('order_placed')) + ' · ' + order.id + ' · ' + t('order_delivery') + ' ' + order.deliveryDate, 4200);
      }).catch(function (err) {
        setPlaceBusy(false);
        toast((err && err.message) ? err.message : t('err_generic'), 3200);
      });
    });
  }

  restoreLastOrder();

  /* ---------- empty the whole bag (two-tap confirm) ---------- */

  var emptyBtn = $('#emptyBag');
  if (emptyBtn) {
    var emptyTimer = null;
    emptyBtn.addEventListener('click', function () {
      var label = $('.empty-bag-label', emptyBtn);

      if (!emptyBtn.classList.contains('confirm')) {
        emptyBtn.classList.add('confirm');
        if (label) label.textContent = t('tap_confirm');
        clearTimeout(emptyTimer);
        emptyTimer = setTimeout(function () {
          emptyBtn.classList.remove('confirm');
          if (label) label.textContent = t('empty_bag');
        }, 2600);
        return;
      }

      clearTimeout(emptyTimer);
      emptyBtn.classList.remove('confirm');
      if (label) label.textContent = t('empty_bag');
      saveBag([]);
      updateFabs();
      renderCart();
      toast(t('bag_emptied'));
    });
  }

  /* ---------- order history (customer, live from the API) ---------- */

  var orderListEl = $('#orderList');
  var liveOrders = {};
  var liveOrderArr = [];
  var historyLive = false;
  var historyFilter = 'ongoing';       /* land on active orders first */

  if (orderListEl) {
    var LOCALES = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' };
    var STATUS_VIEW = {
      pending:   { cls: 'way',    key: 'status_pending' },
      confirmed: { cls: 'conf',   key: 'status_confirmed' },
      on_way:    { cls: 'conf',   key: 'status_ongoing' },
      delivered: { cls: 'ok',     key: 'status_delivered' },
      rejected:  { cls: 'cancel', key: 'status_cancelled' }
    };
    var UNIT_KEYS = { kg: 'unit_kg', bunch: 'unit_bunch', pack: 'unit_pack', piece: 'unit_piece', dozen: 'unit_dozen' };
    var REORDER_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>';
    var CANCEL_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>';

    function fmtDate(str) {
      var d = new Date(String(str || '').replace(' ', 'T'));
      if (isNaN(d.getTime())) return String(str || '');
      return d.toLocaleDateString(LOCALES[currentLang] || 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    function orderCard(o) {
      var st = STATUS_VIEW[o.status] || STATUS_VIEW.pending;
      var items = o.items || [];
      var MAX = 6;

      var lines = items.slice(0, MAX).map(function (it) {
        var key = nameKeyFor(it.name);
        var nameHtml = key
          ? '<span data-i18n="' + key + '">' + esc(it.name) + '</span>'
          : '<span>' + esc(it.name) + '</span>';
        return '<div class="oi-line"><span class="oi-name">' + nameHtml + ' ×' + itemQtyHtml(it) + '</span>' +
          '<span class="oi-amt">' + money(Number(it.rate) * Number(it.qty)) + '</span></div>';
      }).join('');
      if (items.length > MAX) {
        lines += '<div class="oi-line oi-more"><span class="oi-name">+' + (items.length - MAX) + ' ' + t('items_word') + '</span></div>';
      }

      /* action: Reorder only after delivery; small Cancel icon while still pending */
      var actionHtml = '';
      if (o.status === 'delivered') {
        actionHtml = '<button class="reorder" data-reorder="' + o.id + '">' + REORDER_SVG + '<span data-i18n="reorder">' + t('reorder') + '</span></button>';
      } else if (o.status === 'pending') {
        actionHtml = '<button class="cancel-order" data-cancel="' + o.id + '" aria-label="' + esc(t('cancel_order')) + '" title="' + esc(t('cancel_order')) + '">' + CANCEL_SVG + '</button>';
      }

      return '<article class="order-card" data-id="' + o.id + '">' +
        '<div class="order-head">' +
        '<div>' +
        '<h4>' + o.id + '</h4>' +
        '<p class="o-date">' + fmtDate(o.placed_at) + ' · ' + (o.items ? o.items.length : 0) + ' ' + t('items_word') + '</p>' +
        '</div>' +
        '<span class="status ' + st.cls + '" data-i18n="' + st.key + '">' + t(st.key) + '</span>' +
        '</div>' +
        '<div class="order-items">' + lines + '</div>' +
        '<div class="order-foot">' +
        '<div class="of-left"><p class="o-total">₹' + fmtQty(o.amount) + '</p>' + payChipHtml(o) + '</div>' +
        actionHtml +
        '</div>' +
        '</article>';
    }

    function showOrderState(state) {
      orderListEl.hidden = state !== 'list';
      var loading = $('#orderLoading'); if (loading) loading.hidden = state !== 'loading';
      var empty = $('#orderEmpty'); if (empty) empty.classList.toggle('show', state === 'empty');
      var signin = $('#orderSignin'); if (signin) signin.classList.toggle('show', state === 'signin');
    }

    function orderMatchesFilter(o, f) {
      if (f === 'delivered') return o.status === 'delivered';
      if (f === 'ongoing') return o.status === 'pending' || o.status === 'confirmed' || o.status === 'on_way';
      if (f === 'cancelled') return o.status === 'rejected';
      return true;
    }

    function applyHistoryFilter(f) {
      historyFilter = f || 'all';

      if (historyLive) {
        var list = liveOrderArr.filter(function (o) { return orderMatchesFilter(o, historyFilter); });
        orderListEl.innerHTML = list.length
          ? list.map(orderCard).join('')
          : '<p class="oi-empty">' + t('no_orders_filter') + '</p>';
        applyLanguage(currentLang);
        return;
      }

      /* demo mode: show/hide the static cards by data-status */
      $$('.order-card', orderListEl).forEach(function (card) {
        var st = card.getAttribute('data-status') || '';
        card.hidden = !orderMatchesFilter({ status: st }, historyFilter);
      });
    }

    function loadOrders() {
      showOrderState('loading');
      window.TAZA.myOrders().then(function (res) {
        var orders = res.orders || [];
        liveOrders = {};
        liveOrderArr = orders;
        historyLive = true;
        orders.forEach(function (o) { liveOrders[o.id] = o; });
        if (!orders.length) { showOrderState('empty'); return; }
        showOrderState('list');
        applyHistoryFilter(historyFilter);
      }).catch(function (err) {
        if (err && err.status === 401) { showOrderState('signin'); return; }
        toast((err && err.message) ? err.message : t('err_generic'), 3000);
        showOrderState('list');
      });
    }

    /* filter chips: actually filter the rendered list */
    var orderFiltersEl = $('#orderFilters');
    if (orderFiltersEl) {
      orderFiltersEl.addEventListener('click', function (e) {
        var chip = e.target.closest('.fchip');
        if (!chip) return;
        applyHistoryFilter(chip.getAttribute('data-filter') || 'all');
      });
    }

    /* ---------- order details popup (tap a card) ---------- */

    var sheetEl = $('#orderSheet');
    var sheetBackdrop = $('#orderSheetBackdrop');
    var sheetTimer = null;

    var SHEET_STATUS = {
      pending: { cls: 'way', key: 'status_pending' },
      confirmed: { cls: 'conf', key: 'status_confirmed' },
      on_way: { cls: 'conf', key: 'status_ongoing' },
      delivered: { cls: 'ok', key: 'status_delivered' },
      rejected: { cls: 'cancel', key: 'status_cancelled' }
    };

    function closeOrderSheet() {
      if (!sheetEl || sheetEl.hidden) return;
      sheetEl.classList.remove('open');
      if (sheetBackdrop) sheetBackdrop.classList.remove('open');
      clearTimeout(sheetTimer);
      sheetTimer = setTimeout(function () {
        sheetEl.hidden = true;
        if (sheetBackdrop) sheetBackdrop.hidden = true;
      }, 240);
    }

    function smRow(label, value) {
      return '<div class="sm-row"><span>' + esc(label) + '</span><b>' + esc(value) + '</b></div>';
    }

    function openOrderSheet(order) {
      if (!sheetEl || !order || !order.id) return;

      var st = SHEET_STATUS[order.status] || SHEET_STATUS.pending;

      $('#sheetOrderId').textContent = order.id;
      var pill = $('#sheetStatus');
      pill.className = 'status ' + st.cls;
      pill.setAttribute('data-i18n', st.key);
      pill.textContent = t(st.key);

      var meta = '';
      meta += smRow(t('sheet_placed'), fmtDate(order.placed));
      meta += smRow(t('slot_title'), order.slot === 'evening' ? t('slot_evening') : t('slot_morning'));
      var payValue = String(order.payment || '').toLowerCase() === 'cod'
        ? '<span data-i18n="pay_cod">' + t('pay_cod') + '</span>'
        : '<span data-i18n="pay_upi">' + t('pay_upi') + '</span>';
      if (order.paid) {
        payValue += ' · <span data-i18n="paid_word">' + t('paid_word') + '</span>';
      }
      meta += '<div class="sm-row"><span>' + esc(t('sheet_payment')) + '</span><b>' + payValue + '</b></div>';
      meta += smRow(t('order_delivery'), fmtDate(order.delivery));
      meta += smRow(t('delivery_address'), order.address || '—');
      $('#sheetMeta').innerHTML = meta;

      var late = $('#sheetLate');
      if (late) {
        late.hidden = order.cycle !== 'day-after';
        late.textContent = t('order_late_note');
      }

      var items = order.items || [];
      var sub = 0;
      $('#sheetItems').innerHTML = items.map(function (it) {
        var amount = Number(it.rate) * Number(it.qty);
        sub += amount;
        var key = nameKeyFor(it.name);
        var nameHtml = key
          ? '<span data-i18n="' + key + '">' + esc(it.name) + '</span>'
          : '<span>' + esc(it.name) + '</span>';
        return '<div class="oi-line"><span class="oi-name">' + nameHtml + ' ×' + itemQtyHtml(it) + '</span>' +
          '<span class="oi-amt">' + money(amount) + '</span></div>';
      }).join('') || '<p class="oi-empty">—</p>';

      var fee = order.fee != null ? Number(order.fee) : Math.max(0, Number(order.amount) - sub);
      var discount = Number(order.discount || 0);
      $('#sheetTotals').innerHTML =
        '<div class="s-row"><span>' + esc(t('subtotal')) + '</span><b>' + money(sub) + '</b></div>' +
        '<div class="s-row"><span>' + esc(t('delivery')) + '</span><b>' + money(fee) + '</b></div>' +
        (discount > 0 ? '<div class="s-row"><span>' + esc(t('upi_discount')) + '</span><b>-' + money(discount) + '</b></div>' : '') +
        '<div class="s-divider"></div>' +
        '<div class="s-total"><span>' + esc(t('total')) + '</span><b>' + money(Number(order.amount)) + '</b></div>';

      var reorderBtn = $('#sheetReorder');
      if (reorderBtn) {
        var canReorder = !!liveOrders[order.id] && liveOrders[order.id].status === 'delivered';
        reorderBtn.hidden = !canReorder;
        if (canReorder) reorderBtn.setAttribute('data-reorder', order.id);
      }

      applyLanguage(currentLang);

      sheetEl.hidden = false;
      if (sheetBackdrop) sheetBackdrop.hidden = false;
      requestAnimationFrame(function () {
        sheetEl.classList.add('open');
        if (sheetBackdrop) sheetBackdrop.classList.add('open');
      });
    }

    /* tap an order card → details popup (reorder / cancel taps are excluded) */
    orderListEl.addEventListener('click', function (e) {
      if (e.target.closest('[data-reorder]') || e.target.closest('[data-cancel]')) return;
      var card = e.target.closest('.order-card');
      if (!card) return;

      var order = null;
      var id = card.getAttribute('data-id');
      if (id && liveOrders[id]) {
        var o = liveOrders[id];
        order = {
          id: o.id,
          status: o.status,
          placed: o.placed_at,
          delivery: o.delivery_date,
          slot: o.slot,
          payment: o.payment,
          paid: !!(Number(o.paid) === 1),
          address: o.address,
          fee: Number(o.delivery_fee || 0),
          discount: Number(o.discount || 0),
          amount: Number(o.amount),
          cycle: o.cycle,
          items: o.items || []
        };
      } else if (card.getAttribute('data-order')) {
        try { order = JSON.parse(card.getAttribute('data-order')); } catch (err) { order = null; }
      }
      if (order) openOrderSheet(order);
    });

    if (sheetBackdrop) sheetBackdrop.addEventListener('click', closeOrderSheet);
    if ($('#sheetClose')) $('#sheetClose').addEventListener('click', closeOrderSheet);

    /* preview helper: ?order=TS… opens the details sheet for that order */
    var orderParam = new URLSearchParams(location.search).get('order');
    if (orderParam) {
      setTimeout(function () {
        var cards = $$('.order-card', orderListEl);
        for (var i = 0; i < cards.length; i++) {
          var data = cards[i].getAttribute('data-order') || '';
          if (cards[i].getAttribute('data-id') === orderParam || data.indexOf('"id":"' + orderParam + '"') !== -1) {
            cards[i].click();
            break;
          }
        }
      }, 600);
    }

    window.TAZA.available().then(function (ok) {
      if (!ok) { applyHistoryFilter(historyFilter); return; }   /* static demo — still land on Ongoing */
      if (!window.TAZA.token()) { showOrderState('signin'); return; }
      loadOrders();
    });

    /* reorder: put a past order's items back into the bag */
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-reorder]');
      if (!btn) return;
      var order = liveOrders[btn.getAttribute('data-reorder')];
      if (!order) return;

      window.TAZA.getProducts().then(function (res) {
        var byName = {};
        (res.products || []).forEach(function (p) { byName[String(p.name).toLowerCase()] = p; });
        var added = 0;
        (order.items || []).forEach(function (it) {
          var p = byName[String(it.name).toLowerCase()];
          if (!p) return;
          var idKey = null;
          Object.keys(I18N.en).forEach(function (k) { if (I18N.en[k] === p.name) idKey = k; });
          if (!idKey) return;
          mergeBag(idKey, it.qty, p.emoji, p.rate, UNIT_KEYS[p.unit] || 'unit_pack');
          added++;
        });
        if (added) {
          closeOrderSheet();
          toast(t('toast_reorder'), 2200);
        }
      }).catch(function () { /* noop */ });
    });

    /* cancel: small ✕ button on pending orders — two taps to confirm */
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-cancel]');
      if (!btn) return;
      var id = btn.getAttribute('data-cancel');

      if (btn.getAttribute('data-confirm') !== '1') {
        btn.setAttribute('data-confirm', '1');
        btn.classList.add('confirming');
        toast(t('tap_confirm'), 2200);
        clearTimeout(btn._t);
        btn._t = setTimeout(function () {
          btn.removeAttribute('data-confirm');
          btn.classList.remove('confirming');
        }, 2600);
        return;
      }
      clearTimeout(btn._t);

      if (historyLive && window.TAZA && window.TAZA.token()) {
        window.TAZA.cancelOrder(id).then(function () {
          if (liveOrders[id]) liveOrders[id].status = 'rejected';
          liveOrderArr.forEach(function (x) { if (x.id === id) x.status = 'rejected'; });
          applyHistoryFilter(historyFilter);
          toast(t('order_cancelled'));
        }).catch(function (err) {
          toast((err && err.message) ? err.message : t('err_generic'), 3000);
        });
        return;
      }

      /* demo card: mark it as cancelled locally */
      var card = btn.closest('.order-card');
      if (card) {
        card.setAttribute('data-status', 'rejected');
        var pill = $('.status', card);
        if (pill) {
          pill.className = 'status cancel';
          pill.setAttribute('data-i18n', 'status_cancelled');
          pill.textContent = t('status_cancelled');
        }
        try {
          var jo = JSON.parse(card.getAttribute('data-order') || '{}');
          jo.status = 'rejected';
          card.setAttribute('data-order', JSON.stringify(jo));
        } catch (err2) { /* ignore */ }
        applyHistoryFilter(historyFilter);
        toast(t('order_cancelled'));
      }
    });
  }

  /* ---------- favourite hearts ---------- */

  $$('.heart').forEach(function (btn) {
    btn.addEventListener('click', function () { btn.classList.toggle('on'); });
  });

  /* ---------- single-select chip groups (order filters) ---------- */

  $$('.filters').forEach(function (list) {
    list.addEventListener('click', function (e) {
      var chip = e.target.closest('.fchip');
      if (!chip) return;
      $$('.fchip', list).forEach(function (c) { c.classList.remove('active'); });
      chip.classList.add('active');
    });
  });

  /* ---------- chat (messages screen) ---------- */

  var chatInput = $('#chatInput');
  var chatSend = $('#chatSend');
  var chatContent = $('.chat-content');

  if (chatInput && chatSend && chatContent) {
    var chatLive = false;
    var chatLastCount = -1;

    var pad2 = function (n) { return n < 10 ? '0' + n : '' + n; };
    var clock = function (dateLike) {
      var d = dateLike ? new Date(String(dateLike).replace(' ', 'T')) : new Date();
      if (isNaN(d.getTime())) d = new Date();
      var h = d.getHours();
      var m = d.getMinutes();
      return (h % 12 || 12) + ':' + pad2(m) + ' ' + (h >= 12 ? 'PM' : 'AM');
    };

    var appendBubble = function (cls, text, time) {
      var bubble = document.createElement('div');
      bubble.className = 'bubble ' + cls;
      var p = document.createElement('p');
      p.textContent = text;
      var timeEl = document.createElement('time');
      timeEl.textContent = time || '';
      bubble.appendChild(p);
      bubble.appendChild(timeEl);
      chatContent.appendChild(bubble);
      chatContent.scrollTop = chatContent.scrollHeight;
    };

    var pollChat = function () {
      window.TAZA.myChat().then(function (res) {
        var msgs = res.messages || [];
        if (msgs.length === chatLastCount) return;
        chatLastCount = msgs.length;
        chatContent.innerHTML = '';
        if (!msgs.length) {
          appendBubble('them', t('chat_hint'), '');
          return;
        }
        msgs.forEach(function (m) {
          appendBubble(m.sender === 'admin' ? 'them' : 'me', m.text, clock(m.created_at));
        });
      }).catch(function () { /* keep the current thread on transient errors */ });
    };

    var sendChatMessage = function () {
      var text = chatInput.value.trim();
      if (!text) return;
      chatInput.value = '';

      if (chatLive) {
        window.TAZA.sendChat(text).then(function () {
          chatLastCount = -1;           /* force a refresh */
          pollChat();
        }).catch(function (err) {
          toast((err && err.message) ? err.message : t('err_generic'), 2600);
        });
        return;
      }

      /* static demo: local bubble + canned reply */
      appendBubble('me', text, clock());
      setTimeout(function () { appendBubble('them', t('chat_auto_reply'), ''); }, 1200);
    };

    chatSend.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') sendChatMessage();
    });

    if (window.TAZA) {
      window.TAZA.available().then(function (ok) {
        if (!ok) return;                       /* static demo chat stays */
        if (!window.TAZA.token()) {
          chatContent.innerHTML = '';
          appendBubble('them', t('history_signin'), '');
          chatInput.disabled = true;
          chatSend.disabled = true;
          return;
        }
        chatLive = true;
        chatContent.innerHTML = '';
        pollChat();
        setInterval(pollChat, 8000);
      });
    }
  }

  /* ---------- login: show / hide password ---------- */

  var passInput = $('#passwordInput');
  var passToggle = $('#togglePass');
  if (passInput && passToggle) {
    passToggle.addEventListener('click', function () {
      var show = passInput.type === 'password';
      passInput.type = show ? 'text' : 'password';
      passToggle.classList.toggle('on', show);
    });
  }

  /* ---------- single login portal: role-based redirect ---------- */
  /* With the backend running: POST /api/auth/login decides by the account's
     role. Without it (pure static demo): the built-in list below applies. */

  var loginForm = $('#loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var userEl = $('#loginUser');
      var user = userEl ? userEl.value.trim().toLowerCase() : '';
      var pass = passInput ? passInput.value : '';

      function go(admin) {
        setTimeout(function () {
          window.location.href = admin ? '../admin/index.html' : 'index.html';
        }, 900);
      }

      /* demo fallback (static templates without the API) */
      function demoLogin() {
        var ADMIN_LOGINS = {
          'hannah@vegfruit.shop': 'hannah@123',
          'vikram@store.com': 'vikram@654',
          'admin@taza-phal-sabzi.com': 'admin@123'
        };
        var isAdmin = Object.prototype.hasOwnProperty.call(ADMIN_LOGINS, user);
        if (isAdmin && pass !== ADMIN_LOGINS[user]) {
          toast('Incorrect password for this admin account');
          return;
        }
        toast(isAdmin ? 'Welcome back, admin — opening the admin panel…' : 'Welcome — opening the store…');
        go(isAdmin);
      }

      if (window.TAZA) {
        window.TAZA.login(user, pass).then(function (data) {
          window.TAZA.setSession(data.token, data.user);
          var isAdmin = data.user.role === 'admin';
          toast('Welcome, ' + data.user.name + ' — opening ' + (isAdmin ? 'the admin panel…' : 'the store…'));
          go(isAdmin);
        }).catch(function (err) {
          if (err && err.status) {        /* real API answered */
            toast(err.message || 'Sign in failed');
            return;
          }
          demoLogin();                    /* API unreachable — static demo */
        });
        return;
      }

      demoLogin();
    });
  }

  /* ---------- home catalogue (live from the API) ---------- */

  function nameKeyFor(name) {
    var key = null;
    Object.keys(I18N.en).forEach(function (k) { if (I18N.en[k] === name) key = k; });
    return key;
  }

  /* product details popout: photos + admin description + synced stepper */
  var HOME_PRODUCTS = {};          /* id → full product (live mode) */

  function rateRowHtml(p) {
    var key = nameKeyFor(p.name);
    var nameHtml = key ? '<h4 data-i18n="' + key + '">' + esc(p.name) + '</h4>' : '<h4>' + esc(p.name) + '</h4>';
    var unitKey = p.unit === '100 g' ? 'unit_100g' : 'unit_' + p.unit;
    return '<div class="rate-row" data-price="' + p.rate + '" data-pid="' + p.id + '">' +
      '<div class="r-top"><span class="r-emoji" aria-hidden="true">' + esc(p.emoji) + '</span>' + nameHtml + '</div>' +
      '<div class="r-bottom">' +
      '<div><p class="price r-price"><b>' + money(p.rate) + '</b><span data-i18n="' + unitKey + '"> /' + esc(p.unit) + '</span></p><em class="row-total" hidden></em></div>' +
      '<div class="stepper mini">' +
      '<button class="step" data-step="-1" aria-label="Decrease quantity">' + STEP_MINUS_SVG + '</button>' +
      '<span class="qty">0</span>' +
      '<button class="step plus" data-step="1" aria-label="Increase quantity">' + STEP_PLUS_SVG + '</button>' +
      '</div></div></div>';
  }

  /* ---- product popout sheet ---- */
  var psSheet = $('#productSheet');
  var psBackdrop = $('#psBackdrop');
  var psRow = null;
  var psTimer = null;

  function closeProductSheet() {
    if (!psSheet || psSheet.hidden) return;
    psSheet.classList.remove('open');
    if (psBackdrop) psBackdrop.classList.remove('open');
    clearTimeout(psTimer);
    psTimer = setTimeout(function () {
      psSheet.hidden = true;
      if (psBackdrop) psBackdrop.hidden = true;
    }, 240);
  }

  function syncSheetQty() {
    var qtyEl = $('#psQty');
    if (!qtyEl || !psRow) return;
    var rowQty = $('.qty', psRow);
    qtyEl.textContent = rowQty ? rowQty.textContent : '0';
  }

  function openProductSheet(row) {
    if (!psSheet || !row) return;
    psRow = row;

    var p = null;
    var pid = row.getAttribute('data-pid');
    if (pid && HOME_PRODUCTS[pid]) p = HOME_PRODUCTS[pid];

    /* name + rate are cloned from the row so i18n + units always match */
    var h4 = $('h4', row);
    $('#psName').innerHTML = h4 ? h4.innerHTML : '—';
    var priceEl = $('.price', row);
    $('#psRate').innerHTML = priceEl ? priceEl.innerHTML : '';

    var gallery = $('#psGallery');
    var dots = $('#psDots');
    var emojiEl = $('.r-emoji', row);
    var images = (p && p.images) || [];

    if (images.length) {
      gallery.innerHTML = images.map(function (im) {
        return '<div class="ps-slide"><img src="' + esc(im.url) + '" alt="" loading="lazy"></div>';
      }).join('');
      dots.hidden = images.length < 2;
      dots.innerHTML = images.map(function (_, i) {
        return '<span class="ps-dot' + (i === 0 ? ' on' : '') + '"></span>';
      }).join('');
      gallery.onscroll = function () {
        var w = gallery.clientWidth || 1;
        var idx = Math.round(gallery.scrollLeft / w);
        $$('.ps-dot', dots).forEach(function (d, i) { d.classList.toggle('on', i === idx); });
      };
    } else {
      gallery.innerHTML = '<div class="ps-slide ps-slide-emoji" aria-hidden="true">' +
        (emojiEl ? emojiEl.textContent : '🧺') + '</div>';
      dots.hidden = true;
    }

    var descEl = $('#psDesc');
    var desc = (p && p.description) || '';
    descEl.hidden = !desc;
    descEl.textContent = desc;

    syncSheetQty();

    psSheet.hidden = false;
    if (psBackdrop) psBackdrop.hidden = false;
    requestAnimationFrame(function () {
      psSheet.classList.add('open');
      if (psBackdrop) psBackdrop.classList.add('open');
    });
  }

  if (psSheet) {
    /* if a photo file is missing (e.g. lost before the volume existed),
       hide the broken slide — and fall back to the emoji if ALL are missing */
    var psGalleryEl = $('#psGallery');
    if (psGalleryEl) {
      psGalleryEl.addEventListener('error', function (e) {
        var img = e.target;
        if (!img || img.tagName !== 'IMG') return;
        var slide = img.closest('.ps-slide');
        if (slide) slide.classList.add('ps-slide-broken');
        var slides = $$('.ps-slide', psGalleryEl).filter(function (s) { return s.classList.contains('ps-slide-broken'); });
        var all = $$('.ps-slide', psGalleryEl);
        if (all.length && slides.length === all.length) {
          var emojiEl = psRow ? $('.r-emoji', psRow) : null;
          psGalleryEl.innerHTML = '<div class="ps-slide ps-slide-emoji" aria-hidden="true">' +
            (emojiEl ? emojiEl.textContent : '🧺') + '</div>';
          var dotsEl = $('#psDots');
          if (dotsEl) dotsEl.hidden = true;
        }
      }, true);
    }

    /* the sheet's stepper mirrors the row's stepper (single source of truth = the row) */
    psSheet.addEventListener('click', function (e) {
      var btn = e.target.closest('.step');
      if (!btn || !psRow) return;
      e.stopPropagation();
      var target = psRow.querySelector(btn.classList.contains('plus') ? '.step.plus' : '.step[data-step="-1"]');
      if (target) target.click();
      syncSheetQty();
    });
    if (psBackdrop) psBackdrop.addEventListener('click', closeProductSheet);
    if ($('#psClose')) $('#psClose').addEventListener('click', closeProductSheet);
  }

  /* tap a product row (anywhere but its own stepper) → popout */
  document.addEventListener('click', function (e) {
    if (!psSheet) return;
    var row = e.target.closest('.rate-row');
    if (!row || e.target.closest('.stepper') || psSheet.contains(e.target)) return;
    openProductSheet(row);
  });

  function sectionFor(p) {
    if (p.cat === 'veg') {
      if (p.unit === 'bunch') return 'bunch';
      if (p.unit === '100 g') return 'gram';
      if (p.unit === 'pack' || p.unit === 'piece' || p.unit === 'dozen') return 'piece_pack';
      return 'kg';
    }
    if (p.unit === 'pack') return 'pack';
    if (p.unit === 'piece' || p.unit === 'dozen') return 'dozen_piece';
    return 'kg';
  }

  var SECTION_META = {
    veg: [
      { id: 'kg', ico: '🥔', key: 'sec_kg' },
      { id: 'bunch', ico: '🥬', key: 'sec_bunch' },
      { id: 'gram', ico: '⚖️', key: 'sec_gram' },
      { id: 'piece_pack', ico: '📦', key: 'sec_piece_pack' }
    ],
    fruits: [
      { id: 'kg', ico: '🥭', key: 'sec_kg' },
      { id: 'dozen_piece', ico: '🍌', key: 'sec_dozen_piece' },
      { id: 'pack', ico: '📦', key: 'sec_pack' }
    ]
  };

  function buildPane(sel, products, cat) {
    var pane = $(sel);
    if (!pane || !products.length) return;
    var theme = cat === 'veg' ? 'theme-green' : 'theme-purple';

    pane.innerHTML = SECTION_META[cat].map(function (def) {
      var items = products.filter(function (p) { return sectionFor(p) === def.id; });
      if (!items.length) return '';
      var half = Math.ceil(items.length / 2);
      return '<div class="sub-section ' + theme + '">' +
        '<div class="sub-head">' +
        '<span class="sub-ico" aria-hidden="true">' + def.ico + '</span>' +
        '<h4 data-i18n="' + def.key + '"></h4>' +
        '<span class="sub-count"><b>' + items.length + '</b> <span data-i18n="items_word"></span></span>' +
        '</div>' +
        '<div class="rate-table">' +
        '<div class="rate-col">' + items.slice(0, half).map(rateRowHtml).join('') + '</div>' +
        '<div class="rate-col">' + items.slice(half).map(rateRowHtml).join('') + '</div>' +
        '</div>' +
        '</div>';
    }).join('');
  }

  if ($('#vegList') && window.TAZA) {
    window.TAZA.available().then(function (ok) {
      if (!ok) return;                         /* static demo tables stay */
      window.TAZA.getProducts().then(function (res) {
        var products = res.products || [];
        products.forEach(function (p) { HOME_PRODUCTS[p.id] = p; });
        buildPane('#vegList', products.filter(function (p) { return p.cat === 'veg'; }), 'veg');
        buildPane('#fruitList', products.filter(function (p) { return p.cat === 'fruits'; }), 'fruits');
        applyLanguage(currentLang);
        initHomeRows();                        /* restore bag quantities */
      }).catch(function () { /* keep static tables */ });
    });
  }

  /* ---------- account: live profile, edit sheets, logout ---------- */

  if ($('.profile-card')) {
    var acctUser = null;
    var acctBackdrop = $('#acctBackdrop');
    var acctSheets = ['sheetProfile', 'sheetAddress', 'sheetPayment'].map(function (id) {
      return document.getElementById(id);
    }).filter(Boolean);

    function closeAcctSheets() {
      if (!acctSheets.length) return;
      acctSheets.forEach(function (s) {
        s.classList.remove('open');
        clearTimeout(s._t);
        s._t = setTimeout(function () { s.hidden = true; }, 240);
      });
      if (acctBackdrop) {
        acctBackdrop.classList.remove('open');
        clearTimeout(acctBackdrop._t);
        acctBackdrop._t = setTimeout(function () { acctBackdrop.hidden = true; }, 240);
      }
    }

    function openAcctSheet(id) {
      var s = document.getElementById(id);
      if (!s) return;
      acctSheets.forEach(function (x) {
        x.hidden = x !== s;
        x.classList.remove('open');
      });
      if (acctBackdrop) acctBackdrop.hidden = false;
      s.hidden = false;
      requestAnimationFrame(function () {
        s.classList.add('open');
        if (acctBackdrop) acctBackdrop.classList.add('open');
      });
    }

    if (acctBackdrop) acctBackdrop.addEventListener('click', closeAcctSheets);
    $$('.acct-sheet-close').forEach(function (b) { b.addEventListener('click', closeAcctSheets); });

    var logoutLink = $('.menu-item.danger');
    if (logoutLink && window.TAZA) {
      logoutLink.addEventListener('click', function () { window.TAZA.clearSession(); });
    }

    var AV_CAM = '<span class="pf-cam" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />' +
      '<circle cx="12" cy="13" r="4" /></svg></span>';

    function paintAvatar(avatarUrl) {
      var av = $('#pfAvatar');
      if (!av || !avatarUrl) return;
      av.classList.add('has-photo');
      av.innerHTML = '<img src="' + esc(avatarUrl) + '" alt="">' + AV_CAM;
    }

    function paintProfile(user) {
      if (!user) return;
      acctUser = user;
      var nameEl = $('.pf-info h4');
      var mailEl = $('.pf-info p');
      if (nameEl) { nameEl.textContent = user.name; nameEl.removeAttribute('data-i18n'); }
      if (mailEl) mailEl.textContent = user.email || '';
      if (user.avatar) paintAvatar(user.avatar);
    }

    if (window.TAZA) {
      window.TAZA.available().then(function (ok) {
        if (!ok || !window.TAZA.token()) return;
        window.TAZA.me().then(function (res) { paintProfile(res.user); }).catch(function () { /* noop */ });
      });
    }

    /* profile photo: tap the avatar -> pick from camera/gallery */
    var avBtn = $('#pfAvatar');
    var avInput = $('#avatarInput');
    if (avBtn && avInput) {
      avBtn.addEventListener('click', function () { avInput.click(); });
      avInput.addEventListener('change', function () {
        var file = avInput.files && avInput.files[0];
        avInput.value = '';
        if (!file) return;
        if (window.TAZA && window.TAZA.token()) {
          window.TAZA.avatarUpload(file).then(function (res) {
            paintProfile(res.user);
            toast(t('avatar_updated'));
          }).catch(function (err) { toast((err && err.message) ? err.message : t('err_generic'), 3200); });
          return;
        }
        /* demo (no API): show it locally */
        try {
          paintAvatar(URL.createObjectURL(file));
          toast(t('avatar_updated'));
        } catch (e) { /* noop */ }
      });
    }

    /* pencil -> edit profile (name + email; verification added later) */
    var pencil = $('.pf-edit');
    if (pencil) {
      pencil.addEventListener('click', function () {
        if ($('#pfName')) {
          $('#pfName').value = (acctUser && acctUser.name) || ($('.pf-info h4') ? $('.pf-info h4').textContent.trim() : '');
        }
        if ($('#pfEmail')) {
          $('#pfEmail').value = (acctUser && acctUser.email) || ($('.pf-info p') ? $('.pf-info p').textContent.trim() : '');
        }
        openAcctSheet('sheetProfile');
      });
    }

    var pfSave = $('#pfSave');
    if (pfSave) {
      pfSave.addEventListener('click', function () {
        var name = $('#pfName') ? $('#pfName').value.trim() : '';
        var email = $('#pfEmail') ? $('#pfEmail').value.trim() : '';
        if (!name || !email) { toast(t('err_required'), 2600); return; }
        if (window.TAZA && window.TAZA.token()) {
          window.TAZA.updateMe({ name: name, email: email }).then(function (res) {
            paintProfile(res.user);
            closeAcctSheets();
            toast(t('profile_saved'));
          }).catch(function (err) { toast((err && err.message) ? err.message : t('err_generic'), 3200); });
          return;
        }
        paintProfile({ name: name, email: email });
        closeAcctSheets();
        toast(t('profile_saved'));
      });
    }

    /* delivery address sheet (flat / floor / building / area / city / pin) */
    var btnAddress = $('#btnAddress');
    if (btnAddress) {
      btnAddress.addEventListener('click', function () {
        var u = acctUser || {};
        if ($('#adFlat')) $('#adFlat').value = u.address_flat || '';
        if ($('#adFloor')) $('#adFloor').value = u.address_floor || '';
        if ($('#adBuilding')) $('#adBuilding').value = u.address_building || '';
        if ($('#adArea')) $('#adArea').value = u.address_area || '';
        if ($('#adCity')) $('#adCity').value = u.address_city || '';
        if ($('#adPin')) $('#adPin').value = u.address_pin || '';
        var cur = $('#curAddress');
        if (cur) cur.textContent = u.address || '—';
        openAcctSheet('sheetAddress');
      });
    }

    var adSave = $('#adSave');
    if (adSave) {
      adSave.addEventListener('click', function () {
        var payload = {
          flat: $('#adFlat') ? $('#adFlat').value.trim() : '',
          floor: $('#adFloor') ? $('#adFloor').value.trim() : '',
          building: $('#adBuilding') ? $('#adBuilding').value.trim() : '',
          area: $('#adArea') ? $('#adArea').value.trim() : '',
          city: $('#adCity') ? $('#adCity').value.trim() : '',
          pin: $('#adPin') ? $('#adPin').value.trim() : ''
        };
        if (window.TAZA && window.TAZA.token()) {
          window.TAZA.updateMe(payload).then(function (res) {
            if (res.user) acctUser = res.user;
            closeAcctSheets();
            toast(t('address_saved'));
          }).catch(function (err) { toast((err && err.message) ? err.message : t('err_generic'), 3200); });
          return;
        }
        var composed = [payload.flat, payload.floor, payload.building, payload.area,
          [payload.city, payload.pin].filter(Boolean).join(' ')].filter(Boolean).join(', ');
        if (acctUser) acctUser.address = composed;
        closeAcctSheets();
        toast(t('address_saved'));
      });
    }

    /* preview helper: ?sheet=profile|address opens that sheet */
    var sheetParam = new URLSearchParams(location.search).get('sheet');
    if (sheetParam) {
      setTimeout(function () {
        if (sheetParam === 'profile' && pencil) pencil.click();
        else if (sheetParam === 'address' && btnAddress) btnAddress.click();
      }, 300);
    }
  }

  /* ---------- red unread badge on the Message tab (all pages) ---------- */

  var msgTabs = $$('.tab-item[href="messages.html"]');
  if (msgTabs.length && window.TAZA) {
    var applyMsgBadge = function (n) {
      msgTabs.forEach(function (tab) {
        var b = $('.tab-badge', tab);
        if (!b) {
          b = document.createElement('span');
          b.className = 'tab-badge';
          b.hidden = true;
          tab.appendChild(b);
        }
        b.textContent = n;
        b.hidden = !n;
      });
    };

    var pollUnread = function () {
      if (!window.TAZA.token()) { applyMsgBadge(0); return; }
      window.TAZA.chatUnread().then(function (res) {
        applyMsgBadge(res.unread || 0);
      }).catch(function () { /* noop */ });
    };

    window.TAZA.available().then(function (ok) {
      if (!ok) return;
      pollUnread();
      setInterval(pollUnread, 15000);
    });
  }

  /* ---------- delivery slots: respect the admin's enabled slots + times ---------- */

  function slotRangeText(from, to) {
    var parts = function (t) {
      var p = String(t || '').split(':');
      var h = parseInt(p[0], 10) || 0;
      var m = parseInt(p[1], 10) || 0;
      return { h: ((h + 11) % 12) + 1, m: m, ap: h >= 12 ? 'PM' : 'AM' };
    };
    var a = parts(from), b = parts(to);
    var fmt = function (x) { return x.h + (x.m ? ':' + String(x.m).padStart(2, '0') : ''); };
    return a.ap === b.ap ? fmt(a) + '–' + fmt(b) + ' ' + b.ap : fmt(a) + ' ' + a.ap + ' – ' + fmt(b) + ' ' + b.ap;
  }

  function applySlotSettings(s) {
    if (!s) return;
    var mOpt = document.getElementById('slotMorningOpt');
    var eOpt = document.getElementById('slotEveningOpt');
    var mR = document.getElementById('slotRangeMorning');
    var eR = document.getElementById('slotRangeEvening');
    if (mR && s.morning_from && s.morning_to) mR.textContent = '(' + slotRangeText(s.morning_from, s.morning_to) + ')';
    if (eR && s.evening_from && s.evening_to) eR.textContent = '(' + slotRangeText(s.evening_from, s.evening_to) + ')';

    var mOn = Number(s.morning_slot) !== 0;
    var eOn = Number(s.evening_slot) !== 0;
    if (mOpt) mOpt.hidden = !mOn;
    if (eOpt) eOpt.hidden = !eOn;

    var card = $('.slot-card');
    if (!card) return;
    var active = $('.addr-option.active', card);
    if (!active || active.hidden) {
      var pick = mOn ? mOpt : (eOn ? eOpt : null);
      $$('.addr-option', card).forEach(function (o) { o.classList.remove('active'); });
      if (pick) {
        pick.classList.add('active');
        var inp = $('input', pick);
        if (inp) inp.checked = true;
      }
    }
    if (!mOn && !eOn) toast(t('slot_none'), 3000);
  }

  if (document.querySelector('.slot-card') && window.TAZA) {
    window.TAZA.available().then(function (ok) {
      if (!ok) return;
      window.TAZA.getSettings().then(applySlotSettings).catch(function () { /* keep the defaults */ });
    });
  }

  /* ---------- cart: single address + default payment from the account ---------- */

  if ($('#deliveryAddress')) {
    if (window.TAZA) {
      window.TAZA.available().then(function (ok) {
        if (!ok || !window.TAZA.token()) { setPayOption(localDefaultPay()); return; }
        window.TAZA.me().then(function (res) {
          if (res.user && res.user.address) {
            $('#deliveryAddress').textContent = res.user.address;
          }
          setPayOption((res.user && res.user.default_payment) || localDefaultPay());
        }).catch(function () { setPayOption(localDefaultPay()); });
      });
    } else {
      setPayOption(localDefaultPay());
    }
  }

  /* ---------- initial paint ---------- */

  /* ---------- PWA: service worker (needed for "Install app"); skipped on file:// ---------- */
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* app keeps working without install support */ });
  }

  applyLanguage(currentLang);
  updateCartTotals();
  initBag();
})();
