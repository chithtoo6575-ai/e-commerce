import {
  supportChannelHref,
  mergeSupportChannels,
  channelIcon,
  isActiveChannel,
} from "./src/lib/supportChannels.js";

const cases = [
  ["Phone: bare number", { channel: "Phone", link: "09 266 172 967" }],
  ["Phone: existing tel link", { channel: "Phone", link: "tel:+959266172967" }],
  ["Telegram: @username", { channel: "Telegram", username: "@htoostore" }],
  ["Telegram: url", { channel: "Telegram", link: "https://t.me/htoostore" }],
  ["Facebook: page name", { channel: "Facebook", username: "htoostore" }],
  ["Email: address", { channel: "Email", link: "shop@htoo.com" }],
  ["WhatsApp: number", { channel: "WhatsApp", link: "+959 266 172 967" }],
  ["No details", { channel: "Facebook" }],
];

for (const [label, input] of cases) {
  console.log(label, "=>", supportChannelHref(input) || "(none)");
}

console.log("\n--- icon ---");
console.log("Phone icon:", channelIcon({ channel: "Phone" }));
console.log("custom icon:", channelIcon({ channel: "Phone", icon: "☎️" }));

console.log("\n--- merge + filter ordering ---");
const merged = mergeSupportChannels(
  [
    {
      id: "a",
      channel: "Telegram",
      link: "https://t.me/x",
      status: "Active",
      sortOrder: 2,
    },
    {
      id: "b",
      channel: "Facebook",
      link: "https://fb.com/x",
      status: "Inactive",
      sortOrder: 1,
    },
  ],
  [
    {
      id: "c",
      channel: "Phone",
      link: "tel:+959",
      status: "Active",
      sortOrder: 1,
    },
    {
      id: "a",
      channel: "Telegram",
      link: "https://t.me/x",
      status: "Active",
      sortOrder: 2,
    },
  ],
);
console.log(merged.map((c) => `${c.channel}#${c.id}`).join(", "));
console.log("active Facebook?", isActiveChannel({ status: "Inactive" }));
