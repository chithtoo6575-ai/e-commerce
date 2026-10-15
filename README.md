# Atelier Market

Multi-purpose e-commerce storefront for fashion, phone accessories, and grocery sellers. The current MVP is a responsive React + Vite storefront with category filtering, search, saved items, and a working cart drawer.

## Run locally

```bash
npm install
npm run dev
```

The owner area uses a separate server-side session. Copy `.env.example` to `.env` and set a real `ADMIN_EMAIL` and a strong `ADMIN_PASSWORD` of at least 12 characters. The local `.env` is loaded by the API and setup script and is never bundled into the frontend.

```bash
npm run admin:setup
npm run dev:api
```

`npm run admin:setup` creates or replaces the owner account by hashing the password with Node `scrypt` and storing only the salted hash in `data/admin.json`. Run it once for a new local account, or again whenever you intentionally change the credentials, then restart the API. Open `/admin/login` for owner access. The API rejects every `/api/admin/*` request without an authenticated HttpOnly session. Admin credentials are never bundled into the frontend.

Production checks:

```bash
npm run lint
npm run build
```

## What is included

- Responsive storefront layout for desktop and mobile
- Store-type filters, search, saved products, and cart quantity controls
- Cart totals and checkout entry point
- Mobile bottom navigation
- Sign up and sign in flows with customer or seller roles
- Guest cart persistence with localStorage
- User-specific cart persistence and guest-to-user cart merge on sign in
- Protected owner dashboard at `/admin` with login at `/admin/login`
- Owner dashboard order summary and order-status controls at `/admin/dashboard`
- New customer orders are forwarded to the server-owned order store for the owner dashboard
- Admin product CRUD with bilingual names/descriptions, multi-image uploads, stock controls, search, filters, sorting, and enable/disable state
- Customer catalog refreshes from the shared product API on focus and periodically while open

Demo catalog data and the customer-only local persistence adapter currently live in `src/App.jsx` and `src/lib/storage.js`. The admin foundation uses `server.js`; replace its JSON store with PostgreSQL or another durable database before production.

## Try the flows

1. Click the profile circle and create a shopper account or seller account.
2. Add an item as a guest, then sign up or sign in to see the guest cart merge into the account cart.
3. Refresh the browser to verify that the cart and session remain available.
4. Create a seller account, open the account menu, choose `Open seller dashboard`, and update inventory.
5. Refresh again to verify inventory changes remain available locally.

The local data keys are `atelier_users`, `atelier_session`, `atelier_carts`, `atelier_guest_cart`, and `atelier_products`.

## Scale-to-mobile architecture

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

### 2. Add the backend boundary

Recommended foundation: Node.js with NestJS or Fastify, PostgreSQL, Redis, and S3-compatible object storage.

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
