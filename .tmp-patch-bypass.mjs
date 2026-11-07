import fs from "node:fs";

const file = ".tmp-cdp-order.mjs";
let source = fs.readFileSync(file, "utf8");
if (!source.includes("staleBypass")) {
  source = source.replace(
    "  const flow = await evaluate(",
    `  // Second pass: browser cart shows 2, account holds 1 again, and this time the client sync
  // is bypassed (plain fetch, no cart save) to prove the server no longer rejects valid lines.
  await evaluate(\`(async () => {
    const carts = JSON.parse(localStorage.getItem('atelier_carts') || '{}')
    const line = (carts[\${JSON.stringify(me.customer.id)}] || [])[0]
    carts[\${JSON.stringify(me.customer.id)}] = [{ ...line, quantity: 2, selected: true }]
    localStorage.setItem('atelier_carts', JSON.stringify(carts))
    return true
  })()\`)
  await fetch(API + '/api/customer/cart', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ items: [{ id: PRODUCT_ID, quantity: 1, variants: {}, selected: true }] })
  })
  const staleBypass = await fetch(API + '/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      customer: { userId: me.customer.id, name: 'CDP Buyer', phone: '09970001111', email, township: 'Hlaing', city: 'Yangon', address: 'No.5, 26th Street, Hlaing, Yangon' },
      items: [{ id: PRODUCT_ID, productId: PRODUCT_ID, quantity: 2, selected: true, variants: {}, price: 1 }],
      deliveryMethod: 'standard',
      paymentAccountId: 'cod'
    })
  }).then(async (r) => ({ status: r.status, body: (await r.text()).slice(0, 200) }))

  const flow = await evaluate(`,
  );
  source = source.replace(
    "        apiTrail,",
    "        apiTrail,\n        staleBypass,",
  );
  fs.writeFileSync(file, source);
}
console.log("patched", source.includes("staleBypass"));
