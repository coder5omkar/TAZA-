# TAZA-PHAL-SABZI.COM — Backend (Node.js + MySQL)

Express REST API that also serves the customer app (`/templates`) and the admin
panel (`/admin`). Built for **Hostinger Node.js hosting**, fully testable locally,
works from mobile over your Wi-Fi.

## 1. Local setup (Windows / macOS / Linux)

```bash
# 1. install dependencies (run in the repo root, where package.json is)
npm install

# 2. create your environment file
copy .env.example .env        # Windows
# cp .env.example .env        # macOS / Linux
# → open .env and set DB_USER / DB_PASSWORD for your MySQL

# 3. create the database + tables + seed data (34 products, staff accounts)
npm run seed

# 4. start the server
npm run dev        # auto-restarts (nodemon)  — or: npm start

# 5. optional: run the API smoke test (server must be running)
npm test
```

> **Local MySQL note:** if `npm run seed` says *Access denied*, your MySQL root
> has a password — put it in `.env` as `DB_PASSWORD=...` and run `npm run seed`
> again. Use your own MySQL (XAMPP/WAMP/MySQL Installer) — any host works.

Then open:

| URL | What |
|---|---|
| http://localhost:3000/templates/login.html | Customer app |
| http://localhost:3000/admin/index.html | Admin panel |
| http://localhost:3000/api/health | Health check (shows DB status) |

**Seeded logins** (same as the demo templates):

| Account | Email | Password |
|---|---|---|
| Admin | `hannah@vegfruit.shop` | `hannah@123` |
| Admin | `vikram@store.com` | `vikram@654` |
| Customer | `ravi.k@gmail.com` | `ravi@123` |

## 2. Test from your phone (same Wi-Fi)

1. Find your PC's IP: `ipconfig` (Windows) → e.g. `192.168.0.7`
2. Allow Node through the firewall if Windows asks (Private networks)
3. On the phone open: **http://192.168.0.7:3000/templates/login.html**

The templates are mobile-first, so everything renders full-bleed like a native app.

## 3. How the business rules live in the API

- **Order IDs** — `POST /api/orders` generates `TS·YY·MM·DD·NN` inside a DB
  transaction (row-locked **daily** counter that resets to `01` each day).
  Example: `TS26101605` = 5th order placed on 16 Oct 2026.
  **Maximum 99 orders/day** — the 100th request gets
  `429 "Today's capacity (99 orders) is full"`.
- **10 PM cutoff** — orders placed before `cutoff_hour` (22:00, in `settings`)
  get `cycle = 'tomorrow'` + delivery date = tomorrow; after the cutoff they get
  `cycle = 'day-after'` + delivery date = the day after tomorrow.
- **UPI discount** — orders paid by UPI get **3% off the items subtotal**
  (the delivery fee is not discounted). Saved in `orders.discount`; merging
  new items recomputes it. COD orders keep `discount = 0`.
- **Pay on delivery** — both UPI (scan the shop QR at the door) and COD (cash)
  are collected **on delivery**; every order starts `paid = 0` and the admin
  marks it collected via `PATCH /api/orders/:id/paid`. **COD is the default**
  payment method (no online gateway is wired yet).
- **Supplier list** — `GET /api/admin/procurement` aggregates item × qty × value
  for all live orders in the `tomorrow` cycle (the 10 PM handover list).
- **Same-day confirm/reject** — `PATCH /api/orders/:id/status` with
  `pending | confirmed | on_way | delivered | rejected`.

## 4. API reference

| Method & path | Who | Purpose |
|---|---|---|
| `POST /api/auth/login` | public | email + password → token + user (role decides panel) |
| `POST /api/auth/register` | public | create a customer account |
| `GET /api/auth/me` | auth | current user |
| `PATCH /api/auth/me` | auth | edit own name / email / address parts / default payment |
| `GET /api/products?cat=veg\|fruits` | public | catalogue |
| `POST /api/orders` | customer | place order (items, slot, payment, address) — UPI gets a 3% discount |
| `GET /api/orders?status=&cycle=` | auth | own orders (admin: all, filterable) |
| `PATCH /api/orders/:id/status` | admin | set any status at any stage — confirm / on the way / deliver / reject / reopen (even after delivered) |
| `PATCH /api/orders/:id/paid` | admin | mark the payment collected (UPI scan / cash) or unpaid |
| `GET /api/chat/my`, `POST /api/chat/my` | customer | support chat |
| `GET /api/chat/conversations` | admin | inbox list with unread counts |
| `GET/POST /api/chat/conversations/:id` | admin | read thread / reply |
| `GET /api/admin/stats` | admin | dashboard numbers |
| `GET /api/admin/users` | admin | list users |
| `PATCH /api/admin/users/:id` | admin | change role / suspend |
| `DELETE /api/admin/users/:id` | admin | delete (blocked if the user has orders) |
| `GET /api/admin/products` | admin | full catalogue incl. disabled items (with `active` flag) |
| `POST/PATCH/DELETE /api/admin/products/:id?` | admin | manage catalogue — PATCH also enables/disables (`{ active: true/false }`) |
| `GET /api/admin/procurement` | admin | tonight's supplier list |
| `GET/PUT /api/admin/settings` | admin | store / slot / payment settings |

Quick curl test after seeding:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"ravi.k@gmail.com\",\"password\":\"ravi@123\"}"
```

## 5. Deploy to Hostinger

1. **MySQL** — hPanel → *Databases → MySQL Databases*: create database +
   user, note the host (e.g. `srv1234.hstgr.io`), db name and user.
2. **Upload the code** — via Git (hPanel → *Advanced → GIT*) or File Manager to
   `domains/<your-domain>/node_app` (any folder works). **Do not upload
   `node_modules`.**
3. **Node.js app** — hPanel → *Advanced → Node.js*: create an application
   - Application root: the folder with `package.json`
   - Application startup file: `server/server.js`
   - Node version: 18 or 20
4. **Environment variables** (Node.js app → Environment variables, or `.env`
   in the app folder — never commit it):
   ```
   NODE_ENV=production
   TZ=Asia/Kolkata
   DB_HOST=srv1234.hstgr.io
   DB_PORT=3306
   DB_USER=u123456_taza
   DB_PASSWORD=your-db-password
   DB_NAME=u123456_taza
   JWT_SECRET=a-long-random-string-change-me
   ```
   (`PORT` is injected by Hostinger automatically.)
5. **Install + seed** — from the Node.js app page click *Run NPM Install*, then
   run the seed once. If your plan has a terminal:
   ```bash
   npm run seed
   ```
   No terminal? Enable *Remote MySQL* (hPanel → Databases) for your home IP and
   run `npm run seed` **locally** with `.env` pointing at the Hostinger database.
6. **Restart** the app → open your domain. `/` redirects to the login screen;
   admins land in `/admin/index.html` after signing in.

## 6. Notes

- Passwords are stored as **bcrypt hashes**. The admin UI's password-reveal is a
  demo feature — the API intentionally never returns passwords.
- Change `JWT_SECRET` before going live and use HTTPS (Hostinger provides free SSL).
- `settings.cutoff_hour = 22` is the 10 PM rule — change it in DB/admin settings
  without touching code.
- Delete-user keeps integrity: users with orders must be **suspended** instead
  (the API returns a clear message).
