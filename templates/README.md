# MyVegFruitShop — HTML design templates

Static HTML/CSS/JS templates of the vegetable shop mobile design, with
**English / हिंदी / मराठी** language support. These are the design source that
will later be ported to a **Vite + React** app.

## Screens

| File            | Screen        | Notes                                                        |
| --------------- | ------------- | ------------------------------------------------------------ |
| `login.html`    | Log In        | **single portal for store + admin** — the role decides where you land: admin accounts open the admin panel, others open the store (app logo, username / password, remember me, forgot password). English only |
| `index.html`    | Home          | logo header, **Vegetables / Fruits tabs** — each opens a two-column price table with price and quantity multipliers |
| `history.html`  | Order History | **live orders from the API when signed in** — TS IDs, status pills, item emojis, reorder-into-bag; sign-in prompt when logged out; demo cards offline |
| `cart.html`     | My Cart       | bag items (**editable**), delivery address, **Morning/Evening slot**, **UPI / COD payment**, totals, **Place Order**; empty-bag state |
| `messages.html` | Messages      | **chat interface** with "Response may be delayed" notice + working send box |
| `account.html`  | Account       | profile, stats, menu with a **compact language row**; Log Out → Log In |

Shared assets:

- `styles.css` — **green + rich purple dual theme** (fresh green for prices & produce, violet for primary actions), typography (Poppins + Noto Sans Devanagari), phone frame, all components
- `app.js` — interactions + translation dictionary (no framework)
- `logo.svg` — app logo (TAZA-PHAL-SABZI.COM · EAT FRESH), used as header avatar, login hero and favicon
- `preview/` — rendered screenshots (EN / HI / MR)

All prices are shown in **rupees (₹)**.

Bottom navigation: **Home · History · Cart (FAB) · Message · Account**.

## Language support

The language preference is a compact row inside the **Account** menu (right
after My Orders — EN / हिं / मर mini toggle), not a separate section.
**The login screen is always English** (`data-lang-lock="en"` on its `<html>`)
and never changes the saved preference:

- Choice is **persisted** in `localStorage` and shared across all pages
- `?lang=en|hi|mr` URL parameter overrides the saved language, e.g.
  `messages.html?lang=mr`
- All UI strings, vegetable names, price units (`/किलो`, `/गड्डी`), dates,
  statuses, chat messages and toasts are translated from the `I18N` dictionary
  in `app.js`
- Markup stays in English; elements are tagged with `data-i18n="key"`,
  `data-i18n-placeholder="key"` or `data-toast-key="key"` and swapped at runtime

## Preview

Open `index.html` directly in a browser, or serve the folder:

```bash
npx serve templates
# or
npx http-server templates
```

On phones (width ≤ 460px) the phone frame goes full-bleed — the templates are
fully responsive.

## What's interactive

- **Add to bag on Home** — tap + on any Vegetables/Fruits row (starts at 0);
  the selected quantity flows into the cart, a **count badge** appears on the
  nav bag button, and `= ₹x` shows the multiplied total; everything stays
  **editable in the cart** (minus at 1 removes the item). Selections persist
  in localStorage; `?bag=demo` seeds a sample bag for demos
- **Cart checkout** — switch **address**, pick a **delivery slot**
  (Morning 8–10 AM / Evening 7–10 PM) and a **payment method** (UPI / Cash on
  Delivery), then **Place Order**: with the backend running (sign-in required)
  it posts the real order — success shows an **"Order placed ✓" banner with the
  TS order ID + delivery date**, and every failure (not signed in, no address,
  99/day capacity full, item unavailable) shows the **exact server message**.
  Without a backend it falls back to a demo toast
- **Order History** — with the backend running, shows your **real orders** with
  TS order IDs, status pills (Pending → Confirmed → On the way → Delivered /
  Rejected), item thumbnails and totals; **Reorder** puts a past order's items
  straight back into your bag. Signed out → sign-in prompt; offline → demo cards
- **Log In** — single portal: `hannah@vegfruit.shop` / `hannah@123` (or
  `vikram@store.com`, `admin@taza-phal-sabzi.com`) opens the **admin panel**;
  any other email/password opens the **customer store**. Also has password
  show/hide and demo toasts for forgot-password / social buttons
- **Home tabs** — green **Vegetables** tab (18 items) and purple **Fruits** tab
  (16 items); `?tab=fruits` opens the Fruits list directly
- **Price tables** — each row has a − / + quantity multiplier; a green
  `= ₹x` total appears under the price when the multiplier is above 1 (all
  figures are whole rupees — no decimals)
- **Chat (Messages)** — type a message and press send (or Enter); it appears as
  a green bubble, followed by a canned support reply; the amber banner states
  "Response may be delayed"
- Language mini-toggle on Account (EN / हिं / मर) with persisted choice
- Order history filter chips (All / Delivered / Ongoing / Cancelled)
- Quantity steppers on the cart recalculate **Subtotal / Delivery / Total** live
- Heart buttons toggle favourite state
- Reorder / demo-only buttons show a small translated toast

## Notes

- Product images are **emoji placeholders** so the templates are fully
  self-contained. Swap them for `<img>` tags when you have real assets.
- The cart is represented by the **blue shop bag** from your reference image
  (recreated as `bag.svg` — blue tote with white cart + SHOP print) — in the
  bottom-nav button and on the Place Order button, instead of a shopping cart.
- The mockup's printed cart totals didn't match its own item prices; totals here
  are computed honestly from the `data-price` / `data-qty` attributes on each
  `.cart-item`, so they update correctly when quantities change.
- **Order IDs use the store format `TS·YY·MM·NN`** (e.g. `TS261001` = 1st order
  of October 2026, max 99/day). The **10 PM cutoff** rule is shown to customers
  on Home ("Order before 10 PM") and in the cart's Delivery Slot card; the admin
  panel carries the full workflow (procurement list, confirm/reject, next cycle).
- Icons are inline SVGs (no icon library needed) — they can be extracted into
  React components later.
- Removed from the original mockup (per review): promo banner, search bar,
  categories, product-details page, coupon/discount section, and the big
  language card on Account.

## Porting to Vite + React

Suggested mapping when you scaffold the app:

```
templates/index.html    → src/pages/Home.tsx        (RateTable + RateRow components)
templates/history.html  → src/pages/History.tsx     (OrderCard)
templates/cart.html     → src/pages/Cart.tsx        (CartItem + Stepper)
templates/messages.html → src/pages/Chat.tsx        (Bubble + ChatBar)
templates/account.html  → src/pages/Account.tsx     (MenuItem + LanguageMini)
templates/styles.css    → src/styles/global.css (or CSS modules per component)
templates/app.js        → React state/hooks; I18N dict → react-i18next (or any i18n lib)
```

Keep the class names from `styles.css` — the React port can reuse them as-is.
