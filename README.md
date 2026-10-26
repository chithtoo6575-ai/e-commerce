# Atelier Market

Responsive React + Vite storefront for fashion, phone accessories, and grocery sellers. The frontend now has a Supabase browser data adapter and a normalized PostgreSQL/RLS migration foundation. The existing legacy Node/SQLite API and admin interface are still present for compatibility; the application has not completed a full migration of checkout, admin, all account flows, Telegram, or payment integrations.

## Supabase + Vercel migration (new)

The `/api/*` routes were not provided by GitHub Pages: Pages serves static files only. The former Vite `/api` proxy was a local-development proxy to `server.js`, not a production backend. New catalog, settings, banners, promotions, support-channel reads, and basic email/password account calls are defined in `src/lib/supabase.js`; RLS limits database visibility. Missing Supabase configuration is surfaced instead of calling fictitious same-origin API routes. Remaining legacy `/api`-backed features are not production-ready.

### Local setup
1. Create a Supabase project and put its project URL and publishable/anon key in `.env` (never use a service-role key in `VITE_*`). `.env.example` contains placeholders only.
2. Install/configure Supabase CLI, link the project (`supabase link --project-ref <project-ref>`), then apply `supabase/migrations/202610260001_initial_schema.sql` with `supabase db push` (or review and run it using the SQL Editor).
3. In Supabase **Authentication → URL Configuration**, add `http://localhost:5173` and your production URL to allowed redirects. Configure email confirmation and password recovery delivery.
4. Run `npm run dev`. The Vite `/api` proxy remains only for legacy local backend features; the Supabase adapter uses the explicit project URL.
5. Grant the first administrator a row in `public.user_roles` from the trusted SQL Editor. Never expose service-role credentials or accept browser-supplied role claims.

### Order-processing boundary status
A `create-order` Edge Function template and SQL transaction function are included, but the existing checkout has not yet been switched to them. The function currently rejects guest checkout and deliberately sets shipping and discount values to zero; shipping/promotion business logic must be completed in trusted database logic before launch. Review and test all SQL in staging. No payment provider is integrated; old UI payment slips/COD are not verified payment processing. Do not accept online payment until a provider webhook is verified server-side.

### Deploy to Vercel
1. Import the repository into Vercel and set Vite framework, build command `npm run build`, output directory `dist` (also configured in `vercel.json`).
2. Add Production and Preview environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (publishable/anon only), then redeploy.
3. Set the Vercel domain as Supabase Auth Site URL and add exact production/preview redirect URLs.
4. Apply the migration, test RLS with anon/authenticated users, securely grant initial admin access, and deploy reviewed Edge Functions. Set Edge Function secret `ALLOWED_ORIGINS` to exact allowed origin(s). Never put service role keys in the frontend.
5. Connect GitHub for automatic deployment and stop using GitHub Pages for production. The existing Pages workflow has not been removed.

### Production gaps
The schema/policies and Supabase adapter are local templates; no remote database has been configured. Product/admin CRUD, customer carts/orders, persistent addresses, the full account/session UI and remaining admin/payment features still have legacy API calls. Checkout isn't migrated; the SQL order function is an initial atomic-stock design and must receive staging security/integration tests. Complete these migrations and tests before taking real orders.

Required public variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Copy `.env.example` to `.env` locally and insert real public project values; never store privileged credentials in the frontend.

## Run locally

```bash
npm install
npm run dev
```

The owner area and buyer authentication use server-side API sessions. The API requires Node.js 22.13 or newer (for the built-in SQLite driver). Copy `.env.example` to `.env`, set a real `ADMIN_EMAIL` and a strong `ADMIN_PASSWORD` of at least 12 characters, and configure Twilio Verify for buyer phone OTP as described below. The local `.env` is loaded by the API and setup script and is never bundled into the frontend.

```bash
npm run admin:setup
npm run dev:api
```

## Deploy the storefront to GitHub Pages

The workflow in `.github/workflows/deploy.yml` builds the site with Node.js 22.13.0, matching the minimum version in `package.json`, and deploys `dist` when changes are pushed to `main`. To publish:

1. Commit and push these changes to the repository's `main` branch.
2. In GitHub, open **Settings → Pages** and set the build and deployment source to **GitHub Actions**.
3. Open the repository's **Actions** tab and select the **Deploy to GitHub Pages** workflow. Wait for both the build and deploy jobs to complete successfully.
4. Visit `https://chithtoo6575-ai.github.io/my-online-shop/` after the deployment job succeeds. You can also start a run manually from **Actions → Deploy to GitHub Pages → Run workflow**.

GitHub Pages hosts static files only; it does not run `server.js`, Node.js APIs, or a database. Consequently, admin and customer API-backed features (including sign-in/OTP, persistent carts and orders, inventory changes, image uploads, email/SMS, and Telegram integrations) will not work from this Pages deployment alone. The API needs a separate server deployment with persistent storage and server-side credentials. The current frontend calls `/api` on its own origin (and Vite's `/api` proxy works only during local development), so an independently hosted API also needs a same-origin reverse proxy or an intentional frontend/API-origin and cross-origin configuration. Do not put API credentials in the frontend or GitHub Pages files.

`npm run admin:setup` creates or replaces the owner account by hashing the password with Node `scrypt` and storing only the salted hash in `data/admin.json`. Run it once for a new local account, or again whenever you intentionally change the credentials, then restart the API. Open `/admin/login` for owner access (or `/my-online-shop/admin/login` when using this repository's configured deployment base). After signing in, use the Orders section or open `/admin/orders` directly. The API rejects every `/api/admin/*` request without an authenticated HttpOnly session. Admin credentials are never bundled into the frontend.

## Telegram Bot, Mini App, and customer sign-in

The bot reuses the existing Node API and SQLite order/customer store. Set these values in the API server's local `.env`; never put the bot token, webhook secret, OIDC client secret, or other private credentials in frontend code:

```dotenv
TELEGRAM_BOT_TOKEN=<token from BotFather>
TELEGRAM_ADMIN_CHAT_ID=<admin private chat or group ID>
TELEGRAM_ADMIN_USER_ID=<admin Telegram user ID>
TELEGRAM_WEBHOOK_SECRET=<random 1-256 character value using letters, digits, _ or ->
TELEGRAM_WEBHOOK_URL=https://<public-host>/api/telegram/webhook
TELEGRAM_MINI_APP_URL=https://<public-host>/
```

Both URLs must be public HTTPS addresses reachable by Telegram. Do not use `localhost`, a private IP address, or an HTTP URL in production. For local development, run `npm run dev`, expose its Vite port (5173) through an HTTPS tunnel, and set both URLs to that tunnel host; Vite proxies `/api` requests to the local Node API on port 8787. A tunnel URL is temporary and must remain active for webhook delivery.

After saving real bot credentials and URLs, run:

```bash
npm run telegram:setup
```

The setup command validates the required values, registers the webhook with Telegram's secret-token header, publishes `/start`, `/help`, `/orders`, and `/pending`, and sets the Mini App menu button. It makes live Bot API calls, so do not run it with placeholder values. Telegram must be able to reach the configured webhook URL; setup cannot verify that your host stays online.

The Mini App authenticates Telegram `initData` server-side and checks its signature and age. A customer links Telegram to their existing account from inside the signed-in Mini App; `/orders` only lists that linked account's orders in a private chat. Admin callbacks and `/pending` require both the configured admin chat ID and user ID. Admin order links require the normal Admin session, and customer order links only open orders returned for the signed-in customer. Checkout request retries use a persisted idempotency key so a repeated request returns the saved order instead of creating another order or Telegram notification. Missing Telegram bot configuration does not prevent storefront, checkout, or Admin order changes.

Website buyers use Telegram's official OpenID Connect authorization-code flow (not the Login Widget response as trusted frontend data). In BotFather's Telegram Login settings, register the local and production callback URLs as allowed URLs and copy the Login Client ID and Client Secret to the API server:

```dotenv
TELEGRAM_CLIENT_ID=<Telegram Login client ID>
TELEGRAM_CLIENT_SECRET=<Telegram Login client secret>
TELEGRAM_REDIRECT_URI=http://localhost:5173/auth/telegram/callback
```

For production, set the redirect URI to `https://<your-domain>/auth/telegram/callback` and register that exact URI in BotFather. The web sign-in uses only the `openid profile` scopes; phone and bot-access permissions are not requested. The API keeps state, nonce, and the PKCE verifier server-side, exchanges the authorization code on the backend, verifies the ID-token signature using Telegram's JWKS, and checks issuer, audience, expiry, issue time, and nonce. Telegram website sign-in has its own client credentials; the bot token above remains server-only for the existing Mini App and bot features. See the [official Telegram Login documentation](https://core.telegram.org/bots/telegram-login).

Production checks:

```bash
npm run lint
npm run build
```

## Buyer accounts, authentication, and orders

Buyer passwords are hashed with Node `scrypt`. The API stores customer profiles, products, stock, promotions, and orders in `data/shop.sqlite` using Node's built-in SQLite driver. On first startup, the API imports the existing `data/shop.json` document into SQLite in a transaction and leaves the original file unchanged. It will not silently replace malformed legacy data with an empty store. After migration, SQLite is authoritative; do not edit the old JSON file to update live shop records. Order creation and stock decrements are saved in one atomic SQLite document update with a revision check, and all existing order/admin API routes continue to use that backend store.

Products can optionally track `variantStock` by exact size/color combination. Existing products remain on aggregate stock until an owner explicitly enables variant tracking and enters every combination's on-hand quantity in the product editor; saving derives aggregate stock from those counts. No table rebuild or destructive data migration is required because this is an additive field in the existing SQLite shop-state payload. Cart validation, order creation, cancellation returns, and admin stock movements all use the same variant counts.

Buyer sign-up and sign-in use a Myanmar phone number and Twilio Verify SMS code. The API verifies the code with Twilio before creating or signing in to the matching customer account; it never sends or stores the OTP itself. Authentication uses an HttpOnly, SameSite cookie; browser local storage is not used for buyer credentials or session tokens. Existing email/password and external identity data remains in the customer store for compatibility, and verified recovery-email features remain available to eligible existing accounts. Google and Telegram sign-in buttons are no longer shown on the buyer authentication page; the existing server-side OIDC/account-linking APIs remain available to linked-account flows. Provider identifiers (`sub`) link identities; matching email addresses alone never merge accounts.

For local development, `AUTH_OTP_MODE=auto` uses Twilio when all three Twilio credentials are present. If none are present, it enables a development-only mock OTP (`123456`) without sending SMS; the code is displayed on the verification screen. The mock is never enabled when `NODE_ENV=production`, and partial Twilio configuration does not silently fall back to mock mode. To explicitly select a provider, use `AUTH_OTP_MODE=mock` (local development only) or `AUTH_OTP_MODE=twilio`. Set `NODE_ENV=production` on production deployments.

Set these API-server environment variables in `.env`:

```dotenv
AUTH_SECRET=<at-least-32-random-characters>
AUTH_OTP_MODE=auto
TWILIO_ACCOUNT_SID=<Twilio-account-SID>
TWILIO_AUTH_TOKEN=<Twilio-auth-token>
TWILIO_VERIFY_SERVICE_SID=<Twilio-Verify-service-SID>
EMAIL_HOST=<your-transactional-email-SMTP-host>
EMAIL_PORT=587
EMAIL_USER=<SMTP-user>
EMAIL_PASSWORD=<SMTP-password-or-provider-app-password>
EMAIL_FROM=HTOO Online <no-reply@your-domain.example>
```

Create a Verify service in Twilio Console and set its Account SID, Auth Token, and Verify Service SID only in the API server environment. Twilio Verify owns code generation, SMS delivery, expiry, and code checking; the application applies additional per-phone and per-IP request limits. For local testing without SMS, leave the Twilio credentials blank and keep `AUTH_OTP_MODE=auto`, or explicitly set `AUTH_OTP_MODE=mock`; use the displayed `123456` test code. Never use mock mode in production. Keep the same persistent `AUTH_SECRET` across API restarts and keep all provider credentials in the server environment/secret manager. SMTP remains optional for the legacy recovery-email features; configure it with a transactional email service or a properly authorized SMTP account if those features are needed.

### Google Cloud OAuth setup

1. In [Google Cloud Console](https://console.cloud.google.com/), select or create a project and configure the OAuth consent screen. Add the app name and support email; while the consent screen is in testing, add each test buyer as a test user.
2. Create an OAuth client with application type **Web application**.
3. Add `http://localhost:5173` under **Authorized JavaScript origins** for local development. Add `https://<your-production-domain>` for production.
4. Add the exact value of `GOOGLE_REDIRECT_URI` under **Authorized redirect URIs**: `http://localhost:5173/` locally and `https://<your-production-domain>/` in production. Google requires an exact match, including path and trailing slash.
5. Put the client ID and secret in the API server's `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Never put the client secret in a `VITE_*` variable or frontend source. Set `GOOGLE_REDIRECT_URI` to the matching local or production URL before starting the API.

After configuration, run `npm run dev`, open the storefront, and test sign-up with a phone number you can access, SMS delivery and code verification, sign-in with that phone number, guest checkout, and logout. The local Vite server proxies `/api` to the Node API. For production, serve the built frontend and Node API behind HTTPS on the same origin (or configure a same-origin reverse proxy for `/api`), set `NODE_ENV=production`, `API_PORT`, a stable `AUTH_SECRET`, and Twilio credentials in the host's secret manager. Cookies are marked Secure in production. Run one API process against a persistent SQLite volume; login sessions and in-flight OAuth state are process-local and are intentionally invalidated on restart.

### Backup and restore

Keep backups encrypted and access-controlled because the database contains customer contact/delivery details and payment-evidence references.

1. Stop the API so SQLite can checkpoint its write-ahead log.
2. Copy `data/shop.sqlite`, `data/payments.json`, `data/settings.json`, `data/admin.json`, `public/uploads/`, and the legacy `data/shop.json` to the protected backup location. Back up `.env` separately in a secrets manager; never commit it.
3. To restore, stop the API, restore those files to their original paths (including the SQLite file and uploads), check file permissions, and start the API. Do not restore `shop.json` over an existing SQLite database; the JSON file is only used for first-time import. Verify product stock and the Orders page after restart.

For PowerShell, with the API stopped, use an explicit destination and preserve the directory tree, for example:

```powershell
$backup = "D:\HTOO-backups\2026-10-13"
New-Item -ItemType Directory -Force $backup
Copy-Item data\shop.sqlite, data\payments.json, data\settings.json, data\admin.json, data\shop.json $backup
Copy-Item public\uploads $backup\uploads -Recurse
```

Do not run backup/restore commands against production paths until the destination and source have been checked.

## What is included

- Responsive storefront layout for desktop and mobile
- Store-type filters, search, saved products, and cart quantity controls
- Cart totals and checkout entry point
- Mobile bottom navigation
- Buyer phone-number registration and sign-in with Twilio Verify SMS OTP and server-side sessions
- Existing verified recovery-email and linked-account records for customer account compatibility
- Existing guest shopping and checkout flows
- Guest cart persistence with localStorage
- User-specific cart persistence and guest-to-user cart merge on sign in
- Signed-in customer carts are synchronized with the shared backend as well as the local cache
- Protected owner dashboard at `/admin` with login at `/admin/login`
- Owner dashboard order summary and order-status controls at `/admin/dashboard`
- Owner-only shipping management with persisted shipment status and tracking numbers at `/admin`
- Inventory availability and reservations reflect unfulfilled orders; eligible cancellations restore stock
- Dashboard order, fulfillment, revenue, and average-order-value KPIs with daily comparisons
- New customer orders and stock changes are persisted in SQLite and shown in the existing Owner/Admin Orders section
- Admin product CRUD with bilingual names/descriptions, multi-image uploads, aggregate or per-size/color stock controls, search, filters, sorting, and enable/disable state
- Customer catalog refreshes from the shared product API on focus and periodically while open

The sample catalog in `src/App.jsx` is only a frontend fallback while the API catalog loads. The browser persistence adapter in `src/lib/storage.js` is used for non-authoritative shopping conveniences such as guest carts; customer records, product stock, payment evidence, and orders are stored by the API in SQLite.

## Try the flows

1. Click the profile circle and create a shopper account with a phone number and SMS code, or continue as a guest. Buyer phone authentication requires configured Twilio Verify delivery.
2. Add an item as a guest, then sign up or sign in to see the guest cart merge into the account cart.
3. Refresh the browser to verify that the cart and session remain available.
4. Place an order and verify it appears in the customer order history and Admin Orders page.
5. Restart the API, then verify the order and stock change remain in SQLite.

Guest cart data uses `atelier_guest_cart`; buyer authentication and profiles are handled by the Node API.

## Future scale-up roadmap

The following are longer-term options, not prerequisites for the current buyer flow.

### 1. Split by feature

```text
src/
  app/              # routes, providers, app shell
  features/
    catalog/        # products, categories, filters
    cart/           # cart state, drawer, checkout summary
    wishlist/       # saved products
    account/        # auth, profile, addresses
  components/       # reusable buttons, inputs, empty states
  lib/              # API client, formatting, validation
  data/             # temporary fixtures and seed data
```

Move to TypeScript when the API contract is introduced. Keep catalog and cart as domain features so their business rules can be reused by React Native later.

### 2. Scale the backend boundary

For higher traffic or multiple API instances, consider a normalized managed database, shared session/rate-limit storage, and S3-compatible private object storage. The current Node API and SQLite database are already the source of truth for this single-process deployment.

Core domains are `users`, `stores`, `products`, `product_variants`, `inventory`, `carts`, `orders`, `payments`, `wishlists`, `delivery_zones`, and `promotions`. Expose versioned endpoints such as `/api/v1/catalog`, `/api/v1/cart`, and `/api/v1/orders`. Validate at the boundary and calculate prices on the server.

### 3. Production sequence

1. Replace demo data with a paginated catalog API.
2. Add authentication, addresses, and server-side cart persistence.
3. Add stock checks, order creation, payment webhooks, and idempotency keys.
4. Add seller/admin tools for inventory, approval, promotions, and order status.
5. Add image optimization, error tracking, analytics, automated tests, and CI/CD.

### 4. Android and iOS path

Use React Native with Expo after the web MVP stabilizes. Share the API client, TypeScript domain types, catalog/cart/pricing/validation logic, analytics events, and design tokens. Keep platform-specific UI in presentation components. The mobile app should consume the same versioned API, with deep links, push order updates, and cached catalog data added as native features.

Suggested sequence: `Web MVP` -> `Catalog API` -> `Auth + persistent cart` -> `Checkout + payments` -> `Seller/admin tools` -> `React Native app` -> `Notifications + offline polish`.
