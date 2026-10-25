import fs from "node:fs";

const cp = (s) =>
  [...s].map((c) => c.codePointAt(0).toString(16).padStart(4, "0")).join(" ");

// Known-good Burmese strings that already existed and render fine in the app.
const known = [
  ["Home", "ပင်မ"],
  ["Cart", "ဈေးခြင်း"],
  ["Account", "အကောင့်"],
];

// New strings I authored in the last two turns.
const authored = [
  ["Languages", "ဘာသာစကားများ"],
  ["Myanmar (option)", "မြန်မာ"],
  ["No orders to receive", "လက်ခံရန် မှာယူမှု မရှိသေးပါ"],
  ["No received orders yet", "လက်ခံပြီး မှာယူမှု မရှိသေးပါ"],
  ["No cancelled orders", "ပယ်ဖျက်ထားသော မှာယူမှု မရှိပါ"],
  ["Details & Chat", "အသေးစိတ်နှင့် စကားပြောရန်"],
];

console.log("--- known good ---");
for (const [k, v] of known) console.log(k.padEnd(22), cp(v));
console.log("--- authored ---");
for (const [k, v] of authored) console.log(k.padEnd(22), cp(v));

// NFC/NFD comparison: correct Myanmar text is unaffected by normalization,
// but we can at least detect replacement chars or lone combining marks.
console.log("--- diagnostics ---");
for (const [k, v] of [...known, ...authored]) {
  const cps = [...v].map((c) => c.codePointAt(0));
  const leadingMark = cps.length && cps[0] >= 0x102b && cps[0] <= 0x103e;
  const hasFFFD = cps.includes(0xfffd);
  if (leadingMark || hasFFFD)
    console.log("SUSPECT", k, cp(v), { leadingMark, hasFFFD });
}
