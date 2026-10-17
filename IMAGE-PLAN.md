# Image features — implementation plan

Products with real photos + admin description, profile pictures, a store
gallery, and a configurable WhatsApp group link.

Stack reality check: Node/Express + MySQL on Railway. Railway containers have
an **ephemeral filesystem** — uploaded files must live on a **Volume**
(persistent disk) or in cloud storage, not inside the container.

---

## 1. Where uploaded images live (decision)

**Option A — Railway Volume (recommended)**
- Attach one Volume to the web service, mounted at `/data`
- Server saves to `UPLOADS_DIR` (`/data/uploads` on Railway, `./uploads` locally)
- Express serves them at `/uploads/...` with long cache headers
- Hobby plan includes ~5 GB storage — thousands of compressed photos fit
- Zero new accounts; everything stays first-party
- Our code gets a tiny storage layer so we can switch to Option B later without touching features

**Option B — Cloudinary / ImageKit (free tiers)**
- CDN + automatic optimization, best for slow mobile networks
- Needs an account + API keys; images leave our infra
- Worth revisiting only if load speed becomes an issue

## 2. Upload pipeline (server)

- `multer` memory storage → `sharp` processing → save to disk (never trust client files)
- Rules: max **5 MB**, mime must be jpeg/png/webp, auto-rotate, strip EXIF
- Derivatives per upload: **full** (longest side 1000px, jpeg q80) + **thumb** (240px)
- Filenames generated server-side: `product-12-1712345678.jpg` (no client names — no path tricks)
- Caching: `Cache-Control: public, max-age=31536000, immutable` (names are unique)
- Replacing/deleting an image deletes the old files

---

## 3. Phase 1 — Product images + admin description  ⭐ (the main ask)

**Database** (migration v6, idempotent)
- `products.description VARCHAR(160)` — the "2 line" note (shown clamped to 2 lines)
- `product_images (id, product_id FK, path, thumb, sort_no, created_at)` — up to **5 images/product**

**API**
| Endpoint | Who | Purpose |
|---|---|---|
| `POST /api/admin/products/:id/images` | admin | multipart upload (`image`) → returns the new image |
| `PATCH /api/admin/product-images/:imgId` | admin | (optional) reorder |
| `DELETE /api/admin/product-images/:imgId` | admin | remove image + files |
| `PATCH /api/admin/products/:id` | admin | now also saves `description` |
| `GET /api/products` | public | each product gains `description` + `images: [{url, thumb}]` |

**Admin (Products page)**
- Every row gets a **📷 action** → bottom sheet: upload button (phone camera/gallery via `accept="image/*"`),
  3-column thumbnail grid with ✕ remove, and the description textarea (max 160 chars, live counter)
- Product row shows "📷 3" badge + first description words

**Customer (Home)**
- Tap a product's name/emoji → **product popout sheet** (reuses our existing `.order-sheet` pattern):
  - Swipeable photo gallery with page dots (fallback: the current big emoji if no photo)
  - Name, ₹ rate + unit (e.g. "₹2 /kg"), the admin description, quantity stepper **synced with the row**
- Products without images keep today's emoji look — nothing breaks
- Cart / History stay emoji-labeled (photos there are a later nicety)

## 4. Phase 2 — Profile picture

- `users.avatar VARCHAR(255)` (path); API: `POST /api/auth/avatar` (multipart → sharp 256×256)
- Customer Account: tap the avatar on the profile card → pick photo → instant update
- Admin panel: small avatar in the Users table (and later next to chat messages)

## 5. Phase 3 — Store gallery + WhatsApp group link

Two complementary pieces — curated photos inside the app + live photos on WhatsApp:

**5a. In-app gallery ("Store Gallery" page)**
- DB: `gallery (id, caption VARCHAR(160), path, thumb, created_at)`
- Admin: new **Gallery** sidebar page — upload photo + caption, grid list with delete
- Customer: `gallery.html` — 2-column photo grid with captions, tap → fullscreen;
  entry point: **Account → Store Gallery** menu item (+ optional home banner)
- Covers "how are my goods transported" with the shop's own photos

**5b. WhatsApp group link (admin-configurable)**
- DB: `settings.whatsapp_url VARCHAR(255)` — new field on the Settings page
- If set: a **"Join WhatsApp group — see live dispatch photos"** button appears on the
  Gallery page (and optionally the Home delivery note); hidden when empty
- Real-time photos naturally happen where the shop already shares them

**Phase 4 (optional) — order-proving photos**
- `order_photos (order_id, path, thumb, created_at)`
- Admin: expandable order row gains "📷 Attach photo (packed / handed over)"
- Customer: order-details sheet shows the photo strip ("your order, packed")

## 6. Security rules

- Uploads are **admin-only** except the avatar (customer, own account)
- Size + mime validated server-side; EXIF stripped; server-generated filenames
- No directory listing; `/uploads` only serves known file paths
- Old files removed on replace/delete; users can only delete their own avatar

## 7. Testing & rollout

- **e2e**: generate tiny test images in the suite → upload product image / avatar / gallery photo →
  assert public API carries `description` + `images` and files return HTTP 200; gallery + whatsapp settings round-trip
- **Previews**: puppeteer mobile shots of the product popout and gallery
- **Deploy**: migration v6 runs automatically on boot; add Railway **Volume** (`/data`) +
  `UPLOADS_DIR=/data/uploads` env; document in `BACKEND.md`
- Rollout order: **Phase 1 → 2 → 3**, Phase 4 optional later

## 8. Open decisions

1. **Storage**: Railway Volume (recommended) vs Cloudinary/ImageKit
2. **Gallery**: in-app gallery **and** WhatsApp link (recommended both) or just one
3. **Order packing photos (Phase 4)**: now or later
