import { DatabaseSync } from "node:sqlite";

const suffix = Date.now().toString().slice(-6);
const email = `cdp${suffix}@example.com`;
const phone = `+959${suffix}${suffix.slice(0, 2)}`;
const id = crypto.randomUUID();
const now = new Date().toISOString();
const db = new DatabaseSync("data/shop.sqlite");
const row = db.prepare("select payload from shop_state").get();
const data = JSON.parse(row.payload);
data.customers = [
  {
    id,
    name: "CDP Buyer",
    email,
    phone,
    phoneVerified: true,
    emailVerified: false,
    salt: "fd8664ed5b2ab5ca9901097fd53093e4",
    passwordHash:
      "e4dc9198475e241c09bce557a1e22e276d48c46f43835817503b0fabb36ea1f5bc09025eaf59cbac87de5e2c3b2a76aa3d926992bf1438bff4d741cb9e87a7f8",
    authProvider: "phone-password",
    createdAt: now,
    lastLoginAt: now,
    cart: [],
    orderIds: [],
  },
  ...data.customers,
];
db.prepare(
  "update shop_state set payload = ? where rowid = (select rowid from shop_state limit 1)",
).run(JSON.stringify(data));
console.log(JSON.stringify({ id, email, phone }));
