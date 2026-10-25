import fs from "node:fs";
import crypto from "node:crypto";

const source = fs.readFileSync("server.js", "utf8");
const start = source.indexOf("const SUPPORT_CHANNEL_NAMES");
const end = source.indexOf("function cleanBanner");
const body = source.slice(start, end);

const factory = new Function("crypto", `${body}\nreturn cleanSupportChannel;`);
const cleanSupportChannel = factory(crypto);

const cases = [
  [
    "Phone with tel link",
    {
      channel: "Phone",
      accountName: "HTOO Shop",
      link: "tel:+959266172967",
      status: "Active",
    },
  ],
  [
    "Telegram username only",
    { channel: "Telegram", username: "@htoostore", link: "", status: "Active" },
  ],
  [
    "Telegram link",
    { channel: "Telegram", link: "https://t.me/htoostore", status: "Active" },
  ],
  [
    "Facebook page",
    {
      channel: "Facebook",
      link: "https://facebook.com/htoostore",
      status: "Active",
    },
  ],
  [
    "javascript protocol (should be null)",
    { channel: "Facebook", link: "javascript:alert(1)" },
  ],
  ["unknown channel name (should be null)", { channel: "AddressBook" }],
  [
    "inactive keeps status",
    {
      channel: "Viber",
      link: "viber://chat?number=%2B959266172967",
      status: "Inactive",
    },
  ],
];

for (const [label, input] of cases) {
  console.log(label, "=>", JSON.stringify(cleanSupportChannel(input)));
}
