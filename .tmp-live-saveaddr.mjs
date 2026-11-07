export default async function run(page, ui) {
  const log = {};
  const snap = await ui.snapshot();
  const ref = (label) =>
    (snap.match(
      new RegExp(`@(e\\d+) ${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
    ) || [])[1];

  const full = ref('textbox "Full Name *"');
  const tel = ref('textbox "Phone Number *"');
  const region = ref('select "Region / State *"');
  const address = ref('textbox "Full Delivery Address *"');
  const map = ref('textbox "Map Location Picker *"');
  const save = ref('button "Save Address"');
  log.refs = { full, tel, region, address, map, save };

  if (full) await page.locator("#" + "mob-address-fullName").fill("QA Buyer");
  if (tel) await page.locator("#mob-address-phone").fill("09970001111");
  const regionValue = await page.evaluate(
    () =>
      document.querySelector("#mob-address-region")?.options[1]?.value || "",
  );
  if (regionValue) await page.selectOption("#mob-address-region", regionValue);
  await page.waitForTimeout(500);
  const townValue = await page.evaluate(
    () =>
      document.querySelector("#mob-address-township")?.options[1]?.value || "",
  );
  if (townValue) await page.selectOption("#mob-address-township", townValue);
  await page.locator("#mob-address-addressLine").fill("No.5, 26th Street");
  await page.locator("#mob-address-mapLocation").fill("21.9588,96.0891");
  log.picked = { regionValue, townValue };
  await page
    .getByRole("button", { name: "Save Address" })
    .click({ force: true });
  await page.waitForTimeout(2000);
  log.text = (await page.evaluate(() => document.body.innerText)).slice(0, 300);
  log.book = await page.evaluate(() =>
    localStorage.getItem("hto_customer_addresses"),
  );
  return log;
}
