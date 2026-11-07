// Same flow as .tmp-repro-flow.mjs but keeps the browser open for inspection.
export default async function run(page, ui) {
  const log = {};
  const suffix = String(Date.now()).slice(-6);
  const phone = `09${suffix}123`;
  const email = `qa3${suffix}@example.com`;
  const PRODUCT_ID = "35c0c54e-4929-48ef-9f8f-77d2eff3ae73";
  const API = "http://localhost:8787";
  const signup = await fetch(API + "/api/customer/phone/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "QA Buyer",
      email,
      phone,
      password: "Password123!",
      confirmPassword: "Password123!",
    }),
  });
  const cookie = signup.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  await fetch(API + "/api/customer/cart", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      items: [{ id: PRODUCT_ID, quantity: 1, variants: {}, selected: true }],
    }),
  });
  log.signup = signup.status;
  await page.goto("http://localhost:5173/my-online-shop/");
  log.login = await page.evaluate(
    async ({ email }) => {
      localStorage.setItem("shop_onboarding_seen", "1");
      const res = await fetch("/api/customer/phone/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: email, password: "Password123!" }),
      });
      return res.status;
    },
    { email },
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  await page.evaluate(() => {
    const open = [...document.querySelectorAll("button")].find(
      (b) => /Open cart/.test(b.textContent) && b.closest(".mob-bottom-nav"),
    );
    open?.click();
  });
  await page.waitForTimeout(1200);
  log.snapBeforeCheckout = await ui.snapshot();
  return log;
}
