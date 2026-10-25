import fs from "node:fs";

const file = ".tmp-cdp-order.mjs";
let source = fs.readFileSync(file, "utf8");
if (!source.includes("Page.captureScreenshot")) {
  source = source.replace(
    "  console.log(\n    JSON.stringify(",
    `  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(".tmp-final-confirmation.png", Buffer.from(shot.data, "base64"));
  console.log(
    JSON.stringify(`,
  );
  fs.writeFileSync(file, source);
}
console.log("patched", source.includes("Page.captureScreenshot"));
