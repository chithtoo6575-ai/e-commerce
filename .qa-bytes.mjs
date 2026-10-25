import fs from "node:fs";

const dump = (file, needle) => {
  const text = fs.readFileSync(file, "utf8");
  const line = text.split(/\r?\n/).find((l) => l.includes(needle));
  if (!line) return { file, needle, found: false };
  return {
    file,
    needle,
    found: true,
    line: line.trim(),
    codepoints: [...line.trim()]
      .map((c) => c.codePointAt(0).toString(16).padStart(4, "0"))
      .join(" "),
    hasReplacement: line.includes("\uFFFD"),
    hasBOM: text.charCodeAt(0) === 0xfeff,
  };
};

const results = [
  dump("src/lib/i18n.js", "'Languages'"),
  dump("src/lib/i18n.js", "'Myanmar'"),
  dump("src/lib/i18n.js", "'My Orders'"),
  dump("src/MobileApp.jsx", "label: 'Myanmar'"),
  dump("src/MobileApp.jsx", "aria-label={tr('Languages')}"),
];

console.log(JSON.stringify(results, null, 2));
