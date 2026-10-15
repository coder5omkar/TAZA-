# TAZA-PHAL-SABZI.COM — Admin panel

Static admin templates (desktop dashboard) that pair with the customer app in
`../templates`. Same green + purple theme, same logo.

## Screens

| File            | Screen        | What it shows                                                     |
| --------------- | ------------- | ----------------------------------------------------------------- |
| `index.html`    | Dashboard     | Stats, **Tonight's Procurement — supplier list** (item qty + value for the 10 PM cutoff), recent orders, quick actions, store snapshot |
| `orders.html`   | Orders        | Filterable table with **TS order IDs**, placed time, **delivery date / Next-cycle flag**, and **Confirm** & **Reject** actions |
| `messages.html` | Messages      | **Customer chat inbox** — conversation list with unread badges + reply thread |
| `users.html`    | Users         | All users with **ID, name, contact, role select, masked password (eye toggle), status**, delete |
| `products.html` | Products      | **Add vegetable / fruit** form (name, emoji, category, unit, rate) + catalogue table with filters, edit & delete |
| `settings.html` | Settings      | Store name, support phone, delivery fee, slot toggles (Morning 8–10 AM / Evening 7–10 PM), payment toggles (UPI / COD) |

## Order workflow (as built into the UI)

- **Order ID format: `TS·YY·MM·NN`** — e.g. `TS261001` = TazaSabzi · 2026 · October · 1st order of that day (max **99/day** capacity)
- **10:00 PM cutoff** — orders placed before 10 PM are procured the same night and delivered the next day; orders after 10 PM show a **"Next cycle"** flag and are delivered the **day after tomorrow**
- **Same-day accept/reject** — the admin confirms or rejects each order the day it arrives (no backlog, no 3-day-old orders)
- **Tonight's Procurement** on the dashboard aggregates every live order in the cycle into an **item + qty + value supplier list**, ready to hand over at 10 PM ("Mark sent to supplier" button)

## Single login (no separate admin portal)

There is **one shared login** at `../templates/login.html`. When the user
signs in, the role decides the destination:

- **Admin account** (e.g. `hannah@vegfruit.shop` / `hannah@123`, or
  `vikram@store.com`, `admin@taza-phal-sabzi.com`) → admin panel
- **Any other account** → customer store (`../templates/index.html`)

The "Log Out" button in the admin sidebar returns to the same shared login.

## Assets

- `admin.css` — layout (sidebar + topbar + cards + tables), pills, buttons, toast, responsive
- `admin.js` — demo data (`USERS` / `ORDERS` / `PRODUCTS` arrays), sidebar rendering, table rendering and all interactions
- `logo.svg` — same brand badge as the store app

## Preview

Sign in through the shared login (`../templates/login.html`) with an admin
account — you'll land here. Or open `index.html` directly, or serve the repo
root (`npx serve`) and visit `/admin/index.html`.

## Notes

- All data is **in-memory demo data** in `admin.js` — confirm/reject, role
  change, add/delete product update the UI instantly (no backend).
- Passwords are dummy values; the eye icon toggles masking per user.
- "Edit" buttons on products show a placeholder toast — an edit form is the
  natural next step.
- The panel is responsive: the sidebar becomes a top bar under 980px.
