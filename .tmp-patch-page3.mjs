import fs from "node:fs";

const file = ".tmp-cdp-page.mjs";
const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);

const start = lines.findIndex((line) =>
  line.includes("if (String(args[0]).includes("),
);
const end = lines.findIndex(
  (line, index) => index > start && line.includes("return res"),
);
if (start < 0 || end < 0) throw new Error("fetch block not found");

// Drop the API call log entirely; Network domain traces the requests instead.
lines.splice(start, end - start + 1, "    return res");
const cleaned = lines.filter((line) => !line.includes("calls.push("));
fs.writeFileSync(file, cleaned.join("\n"));
console.log(cleaned.slice(2, 12).join("\n"));
