import fs from "node:fs";

const file = ".tmp-cdp-order.mjs";
let source = fs.readFileSync(file, "utf8");
if (!source.includes("from './.tmp-cdp-page.mjs'")) {
  source = source.replace(
    'import { tmpdir } from "node:os";',
    'import { tmpdir } from "node:os";\nimport { placeOrderInPage } from "./.tmp-cdp-page.mjs";',
  );
  fs.writeFileSync(file, source);
}
console.log("import present:", source.includes("from './.tmp-cdp-page.mjs'"));
