import { describe, expect, it } from "vitest";
import raw from "../../data/stadium.json";
import { loadStadium } from "./load";
import { buildPlan } from "./plan";
import { normalizeText, searchSeat } from "./search";

const model = loadStadium(raw);
const seatOf = (key: string) => model.seatIndex.get(key)!;

describe("searchSeat", () => {
  it("Türkçe karakterleri sadeleştirir", () => {
    expect(normalizeText("Maraton ÜST · Sıra İKİ ç ğ ş ö")).toBe("maraton ust · sira iki c g s o");
  });

  it("kısa biçimi ve link biçimini anlar", () => {
    expect(searchSeat(model, "Maraton Üst A 12 7").seat).toBe(seatOf("maraton-ust/A/12/7"));
    expect(searchSeat(model, "maraton-ust/a/12/7").seat).toBe(seatOf("maraton-ust/A/12/7"));
    expect(searchSeat(model, "spor toto alt k 3 4").seat).toBe(seatOf("spor-toto-alt/K/3/4"));
    expect(searchSeat(model, "sportoto üst b 1 1").seat).toBe(seatOf("spor-toto-ust/B/1/1"));
  });

  it("anahtar kelimeleri iki sırada da anlar", () => {
    const want = seatOf("maraton-ust/A/12/7");
    expect(searchSeat(model, "maraton üst a blok sıra 12 koltuk 7").seat).toBe(want);
    expect(searchSeat(model, "Maraton Üst A Blok 12. Sıra 7 Numara").seat).toBe(want);
    expect(searchSeat(model, "maraton üst a sıra 12 7 numaralı koltuk").seat).toBe(want);
    expect(searchSeat(model, "12. sıra 7. koltuk maraton üst blok a").seat).toBe(want);
  });

  it("kat yazılmazsa harf tekse bloğu bulur, değilse adayları döner", () => {
    // Kuzey'de K yalnızca alt katta
    expect(searchSeat(model, "kuzey k 5 10").seat).toBe(seatOf("kuzey-alt/K/5/10"));
    const ambiguous = searchSeat(model, "maraton a 5 3");
    expect(ambiguous.blocks).toHaveLength(2);
    expect(ambiguous.seat).toBeNull();
    expect(ambiguous.message).toMatch(/2 blok/);
  });

  it("eksik ve hatalı kısımları söyler", () => {
    expect(searchSeat(model, "fenerium alt e").message).toMatch(/Sıra yazın \(1–19\)/);
    expect(searchSeat(model, "fenerium alt e 40").message).toMatch(/40\. sıra yok/);
    expect(searchSeat(model, "fenerium alt e 1").message).toMatch(/Koltuk numarası yazın \(1–12\)/);
    expect(searchSeat(model, "fenerium alt e 1 13").message).toMatch(/13 numaralı koltuk yok/);
    expect(searchSeat(model, "beşiktaş a 1 1").message).toMatch(/“besiktas” anlaşılamadı/);
    expect(searchSeat(model, "")).toMatchObject({ seat: null, message: "" });
  });
});

describe("buildPlan", () => {
  it("her blok için kapalı bir çokgen üretir, alt kat üstte çizilir", () => {
    const plan = buildPlan(model);
    expect(plan.blocks).toHaveLength(model.blocks.length);
    for (const b of plan.blocks) expect(b.path).toMatch(/^M[-\d. L]+Z$/);
    const lastUpper = plan.blocks.findLastIndex((b) => model.blocks[b.index].tierId === "ust");
    const firstLower = plan.blocks.findIndex((b) => model.blocks[b.index].tierId === "alt");
    expect(lastUpper).toBeLessThan(firstLower);
    expect(plan.standLabels.map((l) => l.text)).toContain("MARATON");
  });
});
