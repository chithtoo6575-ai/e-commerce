const API = "http://localhost:8787";
const email = "uiqa361093@example.com";
const login = await fetch(API + "/api/customer/phone/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ identifier: email, password: "Password123!" }),
});
const cookie = login.headers
  .getSetCookie()
  .map((c) => c.split(";")[0])
  .join("; ");
const cart = await fetch(API + "/api/customer/cart", {
  headers: { Cookie: cookie },
}).then((r) => r.json());
const me = await fetch(API + "/api/customer/session", {
  headers: { Cookie: cookie },
}).then((r) => r.json());
console.log("cart:", JSON.stringify(cart));
for (const variant of [
  {},
  { size: "" },
  { size: undefined, color: undefined },
]) {
  const body = {
    customer: {
      userId: me.customer.id,
      name: "UI QA",
      phone: "09361093123",
      email,
      township: "",
      city: "",
      address: "No.5, 26th Street, Mandalay",
    },
    items: cart.cart.map((item) => ({
      ...item,
      selected: true,
      productId: item.id,
      variants: { ...item.variants, ...variant },
    })),
    deliveryMethod: "standard",
    paymentAccountId: "cod",
  };
  const res = await fetch(API + "/api/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      "Idempotency-Key": "qa-" + Math.random().toString(36).slice(2),
    },
    body: JSON.stringify(body),
  });
  console.log(
    "variants",
    JSON.stringify(variant),
    "->",
    res.status,
    (await res.text()).slice(0, 160),
  );
}
