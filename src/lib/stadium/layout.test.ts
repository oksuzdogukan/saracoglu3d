import { describe, expect, it } from "vitest";
import raw from "../../data/stadium.json";
import { collectEstimates } from "./estimates";
import { rasterize } from "./seatPatterns";
import { analyzeStadium, loadStadium } from "./load";
import { StadiumSchema, type StadiumInput } from "./schema";

const clone = (): StadiumInput => JSON.parse(JSON.stringify(raw));

describe("stadium.json", () => {
  const model = loadStadium(raw);

  it("şemaya uyar, hata ve uyarı üretmez", () => {
    expect(model.issues).toEqual([]);
    expect(model.blocks.length).toBe(68);
  });

  it("dört tribünün iki katında da blok var ve toplam kapasiteye yakın", () => {
    for (const stand of model.stands) {
      for (const tier of model.tiers) {
        expect(model.blocks.some((b) => b.stand === stand.index && b.tier === tier.index)).toBe(true);
      }
    }
    const ratio = model.seats.count / model.data.meta.capacity;
    expect(ratio).toBeGreaterThan(0.97);
    expect(ratio).toBeLessThan(1.03);
  });

  it("çatı ışınları dış kenara değer ve çatı her arka duvarın üstünde kalır", () => {
    const roof = model.roof!;
    for (const ray of roof.rays) {
      // Dış kenarın yayları kirişlerle örneklenir; 1 mm hata payı
      expect(Math.abs(roof.outer.inverse(ray.outer.x, ray.outer.z).d)).toBeLessThan(1e-3);
      expect(ray.length).toBeGreaterThan(10);
    }
    for (const block of model.blocks) {
      const tier = model.tiers[block.tier];
      const s = (block.s0 + block.s1) / 2;
      const back = tier.ring.point(s, block.fronts.at(-1)! + block.profile.tread);
      expect(roof.heightAt(back.x, back.z)).toBeGreaterThan(tier.structure.backWallTop + 1);
    }
  });

  it("halkaya bağlı yapılar doğru tarafa yerleşir", () => {
    const tunnel = model.structures.find((s) => s.id === "oyuncu-tuneli")!;
    // Fenerium +z tarafında, tribün önünde (alt kat halkasının içinde)
    expect(tunnel.z).toBeGreaterThan(model.data.pitch.width / 2);
    expect(tunnel.z).toBeLessThan(model.tiers[0].ring.shape.halfZ);
    expect(Math.abs(tunnel.x)).toBeLessThan(0.01);
    const screens = model.structures.filter((s) => s.id.startsWith("ekran-"));
    expect(screens).toHaveLength(4);
    for (const s of screens) expect(Math.abs(s.x)).toBeGreaterThan(model.data.pitch.length / 2);
  });

  it("koltuk anahtarları tekil ve aranabilir", () => {
    expect(model.seatIndex.size).toBe(model.seats.count);
    const i = model.seatIndex.get("maraton-ust/A/12/7");
    expect(i).toBeDefined();
    const row = model.rows[model.seats.row[i!]];
    expect(row.label).toBe("12");
    expect(model.seats.number[i!]).toBe(7);
  });

  it("koltuklar blok sınırları ve kendi sıraları içinde", () => {
    for (const block of model.blocks) {
      const ring = model.tiers[block.tier].ring;
      for (let i = block.seatStart; i < block.seatStart + block.seatCount; i++) {
        const { s, d } = ring.inverse(model.seats.x[i], model.seats.z[i]);
        const row = model.rows[model.seats.row[i]];
        expect(d).toBeCloseTo(row.offset, 3);
        const sRel = ((s - block.s0) % ring.perimeter + ring.perimeter) % ring.perimeter;
        expect(sRel).toBeLessThanOrEqual(block.s1 - block.s0 + 1e-6);
      }
    }
  });

  it("koltuklar sahaya bakar", () => {
    for (let i = 0; i < model.seats.count; i += 97) {
      const fx = Math.sin(model.seats.yaw[i]);
      const fz = Math.cos(model.seats.yaw[i]);
      // Saha merkezine doğru vektörle aynı yönde
      expect(fx * -model.seats.x[i] + fz * -model.seats.z[i]).toBeGreaterThan(0);
    }
  });

  it("köşe bloğunda arka sıralar daha fazla koltuk alır", () => {
    const block = model.blocks[model.blockIndex.get("maraton-alt/I")!];
    const first = model.rows[block.rowStart];
    const last = model.rows[block.rowStart + block.rowCount - 1];
    expect(last.seatCount).toBeGreaterThan(first.seatCount + 10);
  });

  it("seatsFrom=left: 1 numara sahaya bakarken soldadır (saat yönündeki uç)", () => {
    const i1 = model.seatIndex.get("maraton-alt/E/1/1")!;
    const i2 = model.seatIndex.get("maraton-alt/E/1/2")!;
    // Maraton'da saat yönü +x; sol uç büyük x
    expect(model.seats.x[i1]).toBeGreaterThan(model.seats.x[i2]);
  });

  it("tahmini değerleri JSON yoluyla toplar", () => {
    const estimates = collectEstimates(raw);
    const paths = estimates.map((e) => e.path);
    expect(paths).toContain("tiers[alt].profile.tread");
    expect(paths).toContain("blocks[maraton-ust/E]");
  });
});

describe("doğrulama", () => {
  it("çakışan blokları yakalar", () => {
    const data = clone();
    const b = data.blocks.find((x) => x.tier === "alt" && x.id === "B")!;
    b.to = -30;
    const result = analyzeStadium(data);
    expect(result.issues.some((i) => i.level === "error" && i.message.includes("çakışıyor"))).toBe(true);
  });

  it("tanımsız tribünü ve bilinmeyen alanı şema hatası olarak verir", () => {
    const data = clone() as Record<string, unknown> & StadiumInput;
    data.blocks[0].stand = "yok";
    expect(StadiumSchema.safeParse(data).success).toBe(false);
    const typo = clone() as unknown as { tiers: { profile: Record<string, unknown> }[] };
    typo.tiers[0].profile.treed = 0.8;
    expect(analyzeStadium(typo).schemaError).toMatch(/treed/);
  });

  it("gerçek numaralandırma: boş yer, ters sıra ve sığmayan sıra", () => {
    const data = clone();
    const b = data.blocks.find((x) => x.tier === "alt" && x.id === "E")!;
    b.seatsFrom = "right";
    b.rows = [
      { rows: "1", seats: "1-5,_,_,6-10" },
      { rows: "2", seats: "10-1" },
      { rows: "3", seats: "1-40" },
    ];
    b.profile = { rows: 3 };
    const result = analyzeStadium(data);
    const model = result.model!;
    expect(result.issues.filter((i) => i.level === "error")).toEqual([]);
    expect(result.issues.some((i) => i.message.includes("sığmıyor"))).toBe(true);
    const seat = (row: string, n: number) => model.seatIndex.get(`maraton-alt/E/${row}/${n}`)!;
    // seatsFrom=right: 1 numara sağda (küçük x); 5 ile 6 arasında iki boş yer var
    expect(model.seats.x[seat("1", 1)]).toBeLessThan(model.seats.x[seat("1", 2)]);
    const gap = model.seats.x[seat("1", 6)] - model.seats.x[seat("1", 5)];
    expect(gap).toBeCloseTo(3 * 0.5, 3);
    expect(model.seats.x[seat("2", 10)]).toBeLessThan(model.seats.x[seat("2", 9)]);
  });
});

describe("koltuk yazıları", () => {
  const model = loadStadium(raw);

  it("FENERBAHÇE yalnızca Maraton ve Fenerium üst katlarında sarı koltuk olarak görünür", () => {
    expect(rasterize("FENERBAHÇE")[0]).toHaveLength(118);
    const yellow = model.seatPalette.indexOf("#efc416");
    expect(yellow).toBeGreaterThan(0);
    const perTier = new Map<string, number>();
    for (let i = 0; i < model.seats.count; i++) {
      if (model.seats.color[i] !== yellow) continue;
      const b = model.blocks[model.seats.block[i]];
      perTier.set(b.slug, (perTier.get(b.slug) ?? 0) + 1);
    }
    expect([...perTier.keys()].sort()).toEqual(["fenerium-ust", "maraton-ust"]);
    // Her yazı en az birkaç yüz koltuk tutar
    for (const n of perTier.values()) expect(n).toBeGreaterThan(800);
  });
});
