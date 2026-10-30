/**
 * npm run veri — stadium.json'u doğrular, tahmini değerleri ve koltuk
 * sayılarını listeler. Hata varsa 1 koduyla çıkar.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { analyzeStadium } from "../src/lib/stadium/load";

const file = resolve(process.argv[2] ?? "src/data/stadium.json");
const fmt = (n: number) => n.toLocaleString("tr-TR");

let raw: unknown;
try {
  raw = JSON.parse(readFileSync(file, "utf8"));
} catch (e) {
  console.error(`✖ ${file} okunamadı ya da geçerli JSON değil:\n  ${(e as Error).message}`);
  process.exit(1);
}

const { model, estimates, schemaError, issues } = analyzeStadium(raw);

console.log(`\nSaracoğlu veri raporu — ${file}\n`);

if (schemaError) {
  console.error("✖ Şema hataları:\n" + schemaError);
  process.exit(1);
}
console.log("✔ Şema geçerli");

const errors = issues.filter((i) => i.level === "error");
const warnings = issues.filter((i) => i.level === "warning");
for (const e of errors) console.log(`✖ ${e.path}: ${e.message}`);
if (warnings.length) {
  console.log(`\n⚠ ${warnings.length} uyarı`);
  for (const w of warnings.slice(0, 40)) console.log(`  ${w.path}: ${w.message}`);
  if (warnings.length > 40) console.log(`  … ve ${warnings.length - 40} uyarı daha`);
}

const valueEstimates = estimates.filter((e) => e.value !== undefined);
const blockEstimates = estimates.filter((e) => e.value === undefined && e.path.startsWith("blocks["));
const otherEstimates = estimates.filter((e) => e.value === undefined && !e.path.startsWith("blocks["));

console.log(`\nTahmini değerler (${valueEstimates.length}):`);
for (const e of valueEstimates) {
  console.log(`  ${e.path} = ${e.value}${e.note ? `  — ${e.note}` : ""}`);
}
if (blockEstimates.length) {
  const names = blockEstimates.map((e) => e.path.slice("blocks[".length, -1));
  console.log(`\nTahmini blok sınırları (${blockEstimates.length}): ${names.join(", ")}`);
}
for (const e of otherEstimates) console.log(`  ${e.path}${e.note ? `  — ${e.note}` : ""} (tahmini)`);

if (model) {
  console.log("\nKoltuk sayıları:");
  let total = 0;
  for (const stand of model.stands) {
    for (const tier of model.tiers) {
      const blocks = model.blocks.filter((b) => b.stand === stand.index && b.tier === tier.index);
      if (!blocks.length) continue;
      const sum = blocks.reduce((acc, b) => acc + b.seatCount, 0);
      total += sum;
      const detail = blocks.map((b) => `${b.id} ${fmt(b.seatCount)}`).join(" · ");
      console.log(`  ${stand.name} ${tier.name}: ${fmt(sum)}  (${detail})`);
    }
  }
  const capacity = model.data.meta.capacity;
  const pct = ((total / capacity) * 100).toFixed(1);
  console.log(`\n  Toplam: ${fmt(total)} koltuk / hedef ${fmt(capacity)} (%${pct}, yalnızca tanımlı bloklar)`);
}

console.log("");
process.exit(errors.length ? 1 : 0);
