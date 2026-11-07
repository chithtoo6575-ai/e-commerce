// End-to-end: seed two active + one inactive channel via the admin API, then
// check both storefront surfaces render them and announce the open event.
const API = "http://localhost:8787";
const STORE = "http://localhost:5173/my-online-shop/";
const ADMIN = { email: "chithtoo6575@gmail.com", password: "Ch1266172967" };

export default async function run(page, ui) {
  const log = {};

  // --- 1. Admin session (the PUT below is admin-gated) ----------------------
  const loginRes = await fetch(API + "/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ADMIN),
  });
  log.loginStatus = loginRes.status;
  log.loginBody = (await loginRes.text()).slice(0, 200);
  const adminCookie = loginRes.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");

  const before = await (
    await fetch(API + "/api/admin/support-channels", {
      headers: { Cookie: adminCookie },
    })
  ).json();
  log.before = before;

  // --- 2. Seed two active + one inactive channel ----------------------------
  const seeded = [
    {
      id: "e2e-phone",
      channel: "Phone",
      accountName: "HTOO Shop",
      link: "tel:+959266172967",
      status: "Active",
    },
    {
      id: "e2e-telegram",
      channel: "Telegram",
      username: "@htoostore",
      link: "",
      status: "Active",
    },
    {
      id: "e2e-facebook",
      channel: "Facebook",
      link: "https://facebook.com/htoostore",
      status: "Inactive",
    },
  ];
  const saveRes = await fetch(API + "/api/admin/support-channels", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({ channels: seeded }),
  });
  log.saveStatus = saveRes.status;
  log.saveBody = await saveRes.text();

  // The public endpoint must already be active-only.
  log.public = await (await fetch(API + "/api/support-channels")).json();

  // --- 3. Load the storefront as a guest at desktop width -------------------
  // App.jsx reads the guest flag as the exact string 'true'; any other value
  // leaves the app on the auth screen.
  const guestSetup = `(() => {
    localStorage.setItem('shop_onboarding_seen', '1')
    localStorage.setItem('hto_guest_mode', 'true')
    return true
  })()`;
  await page.goto(STORE, { waitUntil: "domcontentloaded" });
  await page.evaluate(guestSetup);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => document.querySelectorAll("nav button, [role=dialog], main").length > 0,
    null,
    { timeout: 30000 },
  );
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.waitForFunction(
    () => document.querySelectorAll("button").length > 0,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(800);

  // --- 4. Desktop surface: account tab → Help & Support card ----------------
  log.tabClicked = await page.evaluate(() => {
    const tab = [...document.querySelectorAll("button")].find((button) =>
      /account/i.test(
        button.getAttribute("aria-label") || button.textContent || "",
      ),
    );
    tab?.click();
    return tab ? tab.getAttribute("aria-label") || tab.textContent : null;
  });
  await page.waitForFunction(
    () => Boolean(document.querySelector(".desktop-support-card")),
    null,
    { timeout: 15000 },
  );
  await page.waitForTimeout(1000);
  await page.screenshot({ path: ".tmp-support-desktop-final.png" });

  const snap = await ui.snapshot();
  log.snapHead = snap.split("\n").slice(0, 60).join("\n");

  log.card = await page.evaluate(() => {
    const card = document.querySelector(".desktop-support-card");
    if (!card) return null;
    const rows = [...card.querySelectorAll(".support-channel")];
    return {
      text: card.innerText,
      rows: rows.length,
      anchors: rows.map((row) => ({
        tag: row.tagName,
        href: row.getAttribute("href"),
        target: row.getAttribute("target"),
        label: row.getAttribute("aria-label"),
        text: row.innerText,
      })),
    };
  });

  // The live region starts empty and is visually hidden.
  log.live = await page.evaluate(() => {
    const el = document.querySelector(".desktop-support-card .sr-only");
    return el
      ? {
          text: el.innerText,
          role: el.getAttribute("role"),
          live: el.getAttribute("aria-live"),
          box: el.getBoundingClientRect().toJSON(),
        }
      : null;
  });

  // --- 5. Opening a channel announces it for screen readers ---------------
  log.notice = await page.evaluate(() => {
    const link = document.querySelector(".desktop-support-card a.support-channel");
    if (!link) return null;
    // Block the actual navigation/tab-open so the page stays put.
    document.addEventListener("click", (event) => event.preventDefault(), {
      capture: true,
      once: true,
    });
    link.click();
    return new Promise((resolve) =>
      setTimeout(() => {
        const el = document.querySelector(".desktop-support-card .sr-only");
        resolve(el ? { text: el.textContent, role: el.getAttribute("role") } : null);
      }, 200),
    );
  });

  // --- 6. Mobile surface: account sheet → Help & Support -------------------
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  log.mobileOpen = await page.evaluate(() => {
    const account = document.querySelector(".mob-bottom-nav .mob-nav-item:last-child");
    account?.click();
    return Boolean(account);
  });
  await page.waitForTimeout(1200);
  log.mobileHelp = await page.evaluate(() => {
    const item = [...document.querySelectorAll(".mob-menu-item")].find((button) =>
      /help|အကူအညီ/i.test(button.textContent),
    );
    item?.click();
    return item ? item.textContent.trim() : null;
  });
  await page.waitForTimeout(1500);
  log.mobile = await page.evaluate(() => {
    const list = document.querySelector(".support-channels-list");
    if (!list) return null;
    const rows = [...list.querySelectorAll(".support-channel")];
    return {
      rows: rows.length,
      text: list.innerText,
      anchors: rows.map((row) => ({
        href: row.getAttribute("href"),
        target: row.getAttribute("target"),
        label: row.getAttribute("aria-label"),
      })),
    };
  });
  await page.screenshot({ path: ".tmp-support-mobile-final.png" });

  // --- 7. Restore the previously published channels ------------------------
  const restoreRes = await fetch(API + "/api/admin/support-channels", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({ channels: before.channels || [] }),
  });
  log.restoreStatus = restoreRes.status;
  log.after = await (await fetch(API + "/api/support-channels")).json();

  return log;
}
