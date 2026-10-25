// Full signed-in checkout: seed account cart, sign in, open checkout, place the order.
export default async function run(page, ui) {
  const log = {};
  const API = "http://localhost:8787";
  const PRODUCT_ID = "35c0c54e-4929-48ef-9f8f-77d2eff3ae73";
  const suffix = String(Date.now()).slice(-6);
  const phone = `09${suffix}123`;
  const email = `qa4${suffix}@example.com`;

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
  const put = await fetch(API + "/api/customer/cart", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      items: [{ id: PRODUCT_ID, quantity: 1, variants: {}, selected: true }],
    }),
  });
  log.seed = { signup: signup.status, cart: put.status };

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

  log.step = await page.evaluate(() => {
    const nav = document.querySelector(".mob-bottom-nav");
    const cartBtn =
      nav &&
      [...nav.querySelectorAll("button")].find((b) =>
        /cart/i.test(b.textContent),
      );
    cartBtn?.click();
    return Boolean(cartBtn);
  });
  await page.waitForTimeout(1200);
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((x) => /Go to Checkout/i.test(x.textContent))
      ?.click(),
  );
  await page.waitForTimeout(2500);
  log.checkout = (await page.evaluate(() => document.body.innerText)).slice(
    0,
    160,
  );

  // COD + fill the empty address fields if this account has no saved address.
  log.result = await page.evaluate(async () => {
    const setValue = (el, value) => {
      const proto =
        el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const fields = [...document.querySelectorAll("input, textarea")].filter(
      (el) => !["radio", "checkbox", "file"].includes(el.type),
    );
    for (const el of fields) {
      if (el.type === "tel") setValue(el, "09970001111");
      else if (el.type === "email") setValue(el, "qa@example.com");
      else if (el.tagName === "TEXTAREA")
        setValue(el, "No.5, 26th Street, Yangon");
      else setValue(el, "QA Buyer");
    }
    document.querySelector("input[value=cod]")?.click();
    await new Promise((r) => setTimeout(r, 900));
    const calls = [];
    const original = window.fetch;
    window.fetch = async (...args) => {
      const res = await original(...args);
      if (String(args[0]).includes("/api/")) {
        let body = "";
        try {
          body = (await res.clone().text()).slice(0, 160);
        } catch {}
        calls.push(
          `${(args[1] && args[1].method) || "GET"} ${String(args[0])} -> ${res.status} ${body}`,
        );
      }
      return res;
    };
    const button = [...document.querySelectorAll("button")].find((x) =>
      /Place Order/.test(x.textContent),
    );
    const disabled = button ? button.disabled : "missing";
    if (button && !button.disabled) button.click();
    await new Promise((r) => setTimeout(r, 8000));
    return { disabled, calls, text: document.body.innerText.slice(0, 260) };
  });
  return log;
}
