import fs from "node:fs";

const file = ".tmp-cdp-order.mjs";
let source = fs.readFileSync(file, "utf8");

// Print what the server actually saved in the cart right before the bypass order.
source = source.replace(
  "  const staleBypass = await fetch(API + '/api/orders', {",
  `  const cartBeforeBypass = await fetch(API + '/api/customer/cart', { headers: { Cookie: cookie } }).then((r) => r.json())
  await fetch(API + '/api/customer/cart', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ items: [{ id: PRODUCT_ID, quantity: 1, variants: {}, selected: true }] })
  })
  const staleBypass = await fetch(API + '/api/orders', {`,
);
source = source.replace(
  "        staleBypass,",
  "        staleBypass,\n        cartBeforeBypass: cartBeforeBypass.cart.map((i) => `${i.id}:${i.quantity}:${JSON.stringify(i.variants)}`),",
);
fs.writeFileSync(file, source);
console.log("patched", source.includes("cartBeforeBypass"));
