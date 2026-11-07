import fs from "node:fs";

// Myanmar combining marks: U+1000-109F consonants, U+102B-103E dependent vowels/signs.
const MY = /[\u1000-\u109f]+/g;
const norm = (s) => [...s].map((c) => c.codePointAt(0).toString(16)).join(" ");

const text = fs.readFileSync("src/lib/i18n.js", "utf8");
const seen = new Map();

for (const line of text.split(/\r?\n/)) {
  const m = line.match(/^\s*'([^']*)':\s*'([^']*)',?\s*$/);
  if (!m) continue;
  const [, key, value] = m;
  const runs = value.match(MY);
  if (!runs) continue;
  for (const run of runs) {
    // Flag runs containing an asat/virama that precedes its base consonant (wrong order)
    const cps = [...run].map((c) => c.codePointAt(0));
    let bad = false;
    for (let i = 0; i < cps.length; i += 1) {
      // 103a (asat) or 1039 (virama) must be followed by a consonant OR be part of a stored-order sequence;
      // in correct Myanmar text a asat/virama attaches to the PRECEDING consonant.
      if ((cps[i] === 0x103a || cps[i] === 0x1039) && i + 1 < cps.length) {
        const next = cps[i + 1];
        const prev = cps[i - 1];
        const nextIsConsonant = next >= 0x1000 && next <= 0x1021;
        const prevIsConsonant = prev >= 0x1000 && prev <= 0x1021;
        if (nextIsConsonant && !prevIsConsonant) bad = true;
      }
    }
    if (bad) seen.set(run, key);
  }
}

const rows = [...seen.entries()].map(([run, key]) => ({
  key,
  run,
  codepoints: norm(run),
}));
console.log(JSON.stringify({ suspectCount: rows.length, rows }, null, 2));
