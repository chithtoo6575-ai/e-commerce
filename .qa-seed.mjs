// Temporary QA fixture: give one order to a throwaway customer, then restore.
import fs from "node:fs";

const FILE = "data/shop.json";
const BACKUP = "data/shop.json.qa-backup";
const ORDER_ID = "753fbd7a-f27a-462d-9435-783ccd2e5268";
const CUSTOMER_ID = "qa-order-card-customer";
const KEEP_ORIGINAL_ORDER_IDS = [];

const mode = process.argv[2];

if (mode === "seed") {
  if (!fs.existsSync(BACKUP)) fs.copyFileSync(FILE, BACKUP);
  const data = JSON.parse(fs.readFileSync(FILE, "utf8"));
  const order = data.orders.find((o) => o.id === ORDER_ID);
  if (!order) throw new Error("Seed order not found");
  // Detach only from the throwaway customer's previous seed, leave real data untouched.
  if (!data.customers.some((c) => c.id === CUSTOMER_ID)) {
    data.customers.push({
      id: CUSTOMER_ID,
      name: "QA Order Card",
      email: "",
      phone: "",
      orderIds: [ORDER_ID],
      createdAt: new Date().toISOString(),
    });
  } else {
    const customer = data.customers.find((c) => c.id === CUSTOMER_ID);
    if (!customer.orderIds.includes(ORDER_ID)) customer.orderIds.push(ORDER_ID);
  }
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  console.log(
    JSON.stringify({
      seeded: true,
      customerId: CUSTOMER_ID,
      originalOrderIds: KEEP_ORIGINAL_ORDER_IDS,
    }),
  );
} else if (mode === "restore") {
  if (fs.existsSync(BACKUP)) {
    fs.copyFileSync(BACKUP, FILE);
    fs.unlinkSync(BACKUP);
    console.log(JSON.stringify({ restored: true }));
  } else {
    console.log(JSON.stringify({ restored: false, reason: "no backup" }));
  }
}
