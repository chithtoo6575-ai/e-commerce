import fs from "node:fs";

const file = "server.js";
let source = fs.readFileSync(file, "utf8");

const beginMarker = "          const lineKey = savedCartKey(id, variants)";
const endMarker =
  "return send(response, 409, { error: 'Your selected cart items changed. Refresh your cart and try again.' })";

const start = source.indexOf(beginMarker);
const endAt = source.indexOf(endMarker);
if (start < 0 || endAt < 0) throw new Error("markers not found");

// Find the closing brace of the `if (signedInCustomer) { ... }` block.
let cursor = endAt + endMarker.length;
const closeAt = source.indexOf("\n          }\n", cursor);
if (closeAt < 0) throw new Error("closing brace not found");

const original = [
  "          const savedCartItem = (Array.isArray(signedInCustomer.cart) ? signedInCustomer.cart : []).find((item) =>",
  "            String(item.productId) === id && productVariantStockKey(item.variants || {}) === productVariantStockKey(variants)",
  "          )",
  "          if (!savedCartItem || savedCartItem.selected === false || quantity > Number(savedCartItem.quantity)) {",
  `            ${endMarker}`,
  "          }",
].join("\n");

source =
  source.slice(0, start) +
  original +
  source.slice(closeAt + "\n          }\n".length);
fs.writeFileSync(file, source);
console.log("reverted order check to original behaviour");
