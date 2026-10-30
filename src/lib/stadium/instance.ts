import raw from "@/data/stadium.json";
import { loadStadium } from "./load";

/**
 * Uygulamanın kullandığı stadyum modeli. stadium.json değişince (dev
 * sunucusunda) modül yeniden yüklenir ve sahne yeni veriyle kurulur.
 */
export const stadium = loadStadium(raw);

if (process.env.NODE_ENV !== "production") {
  const warnings = stadium.issues.filter((i) => i.level === "warning");
  if (warnings.length) {
    console.warn(`stadium.json: ${warnings.length} uyarı\n${warnings.map((w) => `  ${w.path}: ${w.message}`).join("\n")}`);
  }
}
