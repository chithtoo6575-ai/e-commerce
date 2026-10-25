export default async function run(page) {
  const log = {};
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((x) => /Go to Checkout/i.test(x.textContent))
      ?.click(),
  );
  await page.waitForTimeout(2500);
  log.checkout = (await page.evaluate(() => document.body.innerText)).slice(
    0,
    120,
  );
  log.result = await page.evaluate(async () => {
    const setValue = (el, value) => {
      const proto =
        el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    // Desktop shipping step fields, if that layout is showing.
    for (const el of [...document.querySelectorAll("input, textarea")].filter(
      (n) => !["radio", "checkbox", "file"].includes(n.type),
    )) {
      if (el.type === "tel") setValue(el, "09970001111");
      else if (el.type === "email") setValue(el, "qa@example.com");
      else if (el.tagName === "TEXTAREA")
        setValue(el, "No.5, 26th Street, Yangon");
      else setValue(el, "QA Buyer");
    }
    for (let i = 0; i < 6; i += 1) {
      document.querySelector("input[value=cod]")?.click();
      const next = [...document.querySelectorAll("button")].find((b) =>
        /^Continue$/.test(b.textContent.trim()),
      );
      if (!next) break;
      next.click();
      await new Promise((r) => setTimeout(r, 800));
    }
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
    return {
      disabled,
      calls,
      text: document.body.innerText.slice(0, 240),
      tail: document.body.innerText.slice(-200),
    };
  });
  return log;
}
