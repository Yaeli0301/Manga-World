# Manga-World · AI Manga & Comics Reader Platform

Mobile-first PWA (React + Vite) and Node.js (Express + MongoDB) stack with JWT auth, Stripe-ready billing, Cloudinary-or-local media, OpenAI hooks for translation/metadata/recommendations, ZIP bulk ingest, and precise reading progress.

## Prerequisites

- Node.js 20+
- MongoDB 6+ (local or Atlas)

## Setup

1. Copy environment template and fill secrets:

   `cp .env.example .env` (or copy manually on Windows)

2. Set at minimum:

   - `MONGODB_URI`
   - `JWT_SECRET` (32+ characters in production)

3. Install dependencies from the repo root:

   `npm install`

4. (Optional) Seed **readable demo comics** (4 series, multiple chapters & pages as WebP; reader has progress; premium chapter for paywall tests). Favorites are **only** titles you add with ♥ (not auto-seeded). Creates `admin@seed.local` / `reader@seed.local`, password `SeedPass123!`:

   `npm run seed -w server`

   Demo titles start with **`Demo:`** — re-running seed removes previous demo data for those accounts.

   **Login (after seed)**  
   - **`demo@manga.local`** / **`DemoRead2026!`** — simple demo user (Hebrew UI, progress seeded).  
   - **`reader@seed.local`** / **`SeedPass123!`** — reader demo.  
   - **`admin@seed.local`** / **`SeedPass123!`** — admin + premium + translator.

## Run (development)

From the repo root:

`npm run dev`

- API: `http://localhost:4000`
- Client: `http://localhost:5173` (proxies `/api` and `/uploads` to the API)

## Run (production-style)

- Build client: `npm run build -w client`
- Start API: `npm run start -w server` (serve `client/dist` with your own static middleware or reverse proxy as needed)

## Tests

`npm test` — runs server Jest suite and client Vitest.

## Roles

Default registration creates `user`. Grant `translator` or `admin` in the database or via `PATCH /api/admin/users/:id/roles` as an admin.

## Stripe (real monthly billing)

Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PREMIUM` (recurring **Price** ID from [Products](https://dashboard.stripe.com/products)), and `CLIENT_URL` (e.g. `http://localhost:5173`) so Checkout return URLs match your app.

- **Checkout:** `POST /api/payment/checkout` (auth) opens a Stripe Checkout **subscription** session. Premium is applied only after Stripe confirms payment (`checkout.session.completed` webhook).
- **Webhook:** `POST /api/payment/webhook` must receive the **raw** JSON body (this app registers it before `express.json()`). Subscribe to at least `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`.
- **Renewal reminders:** Turn on **customer billing emails** in the Stripe Dashboard so Stripe emails upcoming invoices / failures before or after charges (no in-app email server is required for that path).
- **Billing portal:** After the first Checkout, the user gets `hasBillingCustomer` and can open **Manage billing** (`POST /api/payment/portal`) to update cards or cancel.
- **Dev only:** `POST /api/payment/mock-subscribe` still exists when `NODE_ENV !== "production"` for local QA without Stripe.

## Media storage priority

1. **AWS S3** when `AWS_S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY` are set (optional `AWS_S3_PUBLIC_BASE_URL` for CloudFront or static domain).
2. Otherwise **Cloudinary** when configured.
3. Otherwise **local** files under `./uploads` served at `/uploads/...`.

## Admin API

- `GET /api/admin/manga?status=pending|published|draft|rejected|all&page=&limit=` — catalog for moderation.
- `PATCH /api/admin/manga/:id` — body `{ "isPremiumOnly": true|false }` marks an entire published series as premium-only (all chapters locked for non-subscribers).
- `POST /api/admin/manga/bulk-status` — body `{ "ids": ["..."], "status": "published" }`.

Translators/admins can `PATCH /api/chapters/:id` with `{ title, titleHe, isPremiumOnly, translationStatus }`.
