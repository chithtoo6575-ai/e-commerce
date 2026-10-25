import fs from "node:fs";

const file = ".tmp-cdp-page.mjs";
const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
const index = lines.findIndex((line) => line.includes("calls.push("));
if (index < 0) throw new Error("push line not found");
const indent = lines[index].match(/^\s*/)[0];
const quote = String.fromCharCode(39);
const arrow = quote + " -" + "> " + quote;
lines[index] =
  indent +
  "calls.push((args[1] && args[1].method) || " +
  quote +
  "GET" +
  quote +
  ") + " +
  quote +
  " + quote + " +
  String(args[0]) +
  " + arrow + " +
  res.status +
  " + quote + " +
  quote +
  " + body)";
fs.writeFileSync(file, lines.join("\n"));
console.log(lines[index]);
