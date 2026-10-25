export default async function run(page) {
  const log = {};
  const API = "http://localhost:8787";
  const email = process.env.QA_EMAIL;
  const product = await fetch(API + "/api/products")
    .then((r) => r.json())
    .then((j) =>
      (j.products || j).find(
        (p) => p.id === "35c0c54e-4929-48ef-9f8f-77d2eff3ae73",
      ),
    );
  log.product = { stock: product.stock, enabled: product.enabled };

  const login = await fetch(API + "/api/customer/phone/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: email, password: "Password123!" }),
  });
  const cookie = login.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  const me = await fetch(API + "/api/customer/session", {
    headers: { Cookie: cookie },
  }).then((r) => r.json());
  log.user = me.customer?.id || null;
  const seed = await fetch(API + "/api/customer/cart", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      items: [
        {
          id: "35c0c54e-4929-48ef-9f8f-77d2eff3ae73",
          quantity: 1,
          variants: {},
          selected: true,
        },
      ],
    }),
  });
  log.seed = seed.status;
  log.serverCart = await fetch(API + "/api/customer/cart", {
    headers: { Cookie: cookie },
  })
    .then((r) => r.json())
    .then((j) => j.cart.map((i) => `${i.name} x${i.quantity}`));

  await page.goto("http://localhost:5173/my-online-shop/");
  log.login = await page.evaluate(
    async ({ email }) => {
      localStorage.setItem("shop_onboarding_seen", "1");
      return (
        await fetch("/api/customer/phone/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: email, password: "Password123!" }),
        })
      ).status;
    },
    { email },
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4500);
  log.staleCopy = await page.evaluate((userId) => {
    const carts = JSON.parse(localStorage.getItem("atelier_carts") || "{}");
    const line = (carts[userId] || [])[0];
    if (!line) return null;
    carts[userId] = [{ ...line, quantity: 2 }];
    localStorage.setItem("atelier_carts", JSON.stringify(carts));
    return line.quantity;
  }, log.user);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  log.afterReload = await page.evaluate((userId) => {
    const carts = JSON.parse(localStorage.getItem("atelier_carts") || "{}");
    return (carts[userId] || []).map((i) => i.quantity);
  }, log.user);
  return log;
}
