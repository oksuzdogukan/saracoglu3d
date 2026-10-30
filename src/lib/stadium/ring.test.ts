import { describe, expect, it } from "vitest";
import { Ring, RingError } from "./ring";

const rect = new Ring({ halfX: 60, halfZ: 40, chamfer: 0, fillet: 5 });
const chamfered = new Ring({ halfX: 74.5, halfZ: 55, chamfer: 18, fillet: 3 });

describe("Ring", () => {
  it("yuvarlatılmış dikdörtgenin çevresini doğru hesaplar", () => {
    const expected = 2 * (2 * (60 - 5) + 2 * (40 - 5)) + 2 * Math.PI * 5;
    expect(rect.perimeter).toBeCloseTo(expected, 6);
  });

  it("s=0 Maraton ortasında, saat yönünde +x'e ilerler", () => {
    expect(rect.point(0)).toMatchObject({ x: 0, z: -40 });
    expect(rect.point(10).x).toBeCloseTo(10, 9);
    expect(rect.normal(0).z).toBeCloseTo(-1, 9);
    expect(rect.tangent(0).x).toBeCloseTo(1, 9);
  });

  it("kenar ortalarını bulur", () => {
    for (const ring of [rect, chamfered]) {
      const { halfX: a, halfZ: b } = ring.shape;
      const r = ring.point(ring.sideCenters.right);
      const bt = ring.point(ring.sideCenters.bottom);
      const l = ring.point(ring.sideCenters.left);
      expect(r.x).toBeCloseTo(a, 6);
      expect(r.z).toBeCloseTo(0, 6);
      expect(bt.z).toBeCloseTo(b, 6);
      expect(l.x).toBeCloseTo(-a, 6);
      expect(ring.sideCenters.bottom).toBeCloseTo(ring.perimeter / 2, 6);
    }
  });

  it("pointAt ve inverse birbirinin tersidir (köşeler dahil)", () => {
    for (const ring of [rect, chamfered]) {
      for (let i = 0; i < 400; i++) {
        const s = (ring.perimeter * i) / 400;
        for (const d of [0, 3.7, 19]) {
          const p = ring.point(s, d);
          const back = ring.inverse(p.x, p.z);
          expect(back.d).toBeCloseTo(d, 6);
          const q = ring.point(back.s, back.d);
          expect(q.x).toBeCloseTo(p.x, 6);
          expect(q.z).toBeCloseTo(p.z, 6);
        }
      }
    }
  });

  it("ötelenmiş sıranın uzunluğu çevre + 2πd kadar büyür", () => {
    for (const ring of [rect, chamfered]) {
      const d = 12.5;
      const full = ring.rowLength(0, ring.perimeter, d);
      expect(full).toBeCloseTo(ring.perimeter + 2 * Math.PI * d, 6);
    }
  });

  it("stationAtRowDistance, rowLength'in tersidir ve halkayı sarar", () => {
    const ring = chamfered;
    const sA = 40;
    const d = 9.3;
    for (const dist of [0, 5, 17.2, 31, 80]) {
      const s = ring.stationAtRowDistance(sA, dist, d);
      expect(ring.rowLength(sA, s, d)).toBeCloseTo(dist, 6);
    }
    const sWrap = ring.stationAtRowDistance(ring.perimeter - 3, 10, 0);
    expect(sWrap).toBeCloseTo(ring.perimeter + 7, 6);
  });

  it("örnekleme uçları ve yay alt bölümlerini içerir", () => {
    // Düz kısımda yalnızca uçlar ve s=0'daki segment sınırı olur
    const top = chamfered.sampleStations(-10, 10);
    expect(top[0]).toBe(-10);
    expect(top.at(-1)).toBe(10);
    expect(top.length).toBeLessThanOrEqual(3);
    const corner = chamfered.sampleStations(50, 90);
    expect(corner[0]).toBe(50);
    expect(corner.at(-1)).toBe(90);
    expect(corner.length).toBeGreaterThan(6);
    for (let i = 1; i < corner.length; i++) expect(corner[i]).toBeGreaterThan(corner[i - 1]);
  });

  it("geçersiz şekilleri reddeder", () => {
    expect(() => new Ring({ halfX: 10, halfZ: 10, chamfer: 10, fillet: 1 })).toThrow(RingError);
    expect(() => new Ring({ halfX: 10, halfZ: 10, chamfer: 9, fillet: 50 })).toThrow(RingError);
  });
});
