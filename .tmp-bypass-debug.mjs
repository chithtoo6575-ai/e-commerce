const API = "http://localhost:8787";
const email = process.env.QA_EMAIL;
const login = await fetch(API + "/api/customer/phone/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ identifier: email, password: "Password123!" }),
});
console.log("login", login.status);
const cookie = login.headers
  .getSetCookie()
  .map((c) => c.split(";")[0])
  .join("; ");
const me = await fetch(API + "/api/customer/session", {
  headers: { Cookie: cookie },
}).then((r) => r.json());
console.log("user", me.customer?.id, "cart", JSON.stringify(me.customer?.cart));

await fetch(API + "/api/customer/cart", {
  method: "PUT",
  headers: { "Content-Type": "application/json", Cookie: cookie },
  body: JSON.stringify({
    items: [{ id: "35c0c54e-4929-48ef-9f8f-77d2eff3ae73", quantity: 1, variants: {}, selected: true }],
  }),
});
const cart = await fetch(API + "/api/customer/cart", {
  headers: { Cookie: cookie },
}).then((r) => r.json());
console.log("cart api", JSON.stringify(cart.cart));

for (const quantity of [1, 2]) {
  const res = await fetch(API + "/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      customer: {
        userId: me.customer.id,
        name: "CDP Buyer",
        phone: "09970001111",
        email,
        township: "",
        city: "",
        address: "No.5, 26th Street",
      },
      items: [
        {
          id: "35c0c54e-4929-48ef-9f8f-77d2eff3ae73",
          productId: "35c0c54e-4929-48ef-9f8f-77d2eff3ae73",
          quantity,
          selected: true,
          variants: {},
        },
      ],
      deliveryMethod: "standard",
      paymentAccountId: "cod",
    }),
  });
  console.log(
    "qty",
    quantity,
    "->",
    res.status,
    (await res.text()).slice(0, 160),
  );
}
