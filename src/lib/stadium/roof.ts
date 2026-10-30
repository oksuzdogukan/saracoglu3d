import { Ring, type Vec2 } from "./ring";
import type { RoofData } from "./schema";

export interface RoofRay {
  /** İç halkadaki istasyon. */
  s: number;
  inner: Vec2;
  outer: Vec2;
  /** İç kenardan dış kenara yatay uzunluk. */
  length: number;
}

export interface RoofModel {
  data: RoofData;
  inner: Ring;
  outer: Ring;
  /** İç kenar boyunca örneklenmiş, iç normal doğrultusunda dış kenara uzanan ışınlar. */
  rays: RoofRay[];
  /** İç halkadaki s istasyonundan dış kenara uzanan ışın. */
  rayAt(s: number): RoofRay;
  /** Plandaki bir noktada çatı yüzeyinin kotu (iç ve dış kenar arasında doğrusal). */
  heightAt(x: number, z: number): number;
}

/**
 * Çatı yüzeyi, iç kenarın normalleri boyunca dış kenara uzanan doğrularla
 * örülür. Köşelerde normaller yelpaze gibi açıldığı için dış kenar pahlı
 * (sekizgen) olsa da yüzey kesintisiz kalır.
 */
export function buildRoof(data: RoofData, step = 2): RoofModel {
  const inner = new Ring(data.inner);
  const outer = new Ring(data.outer);
  const polygon = outer.sampleStations(0, outer.perimeter, (2 * Math.PI) / 180).map((s) => outer.point(s));

  const castLength = (s: number): number => {
    const p = inner.point(s);
    const n = inner.normal(s);
    let best = Infinity;
    for (let i = 0; i + 1 < polygon.length; i++) {
      const t = raySegment(p, n, polygon[i], polygon[i + 1]);
      if (t !== null && t < best) best = t;
    }
    return Number.isFinite(best) ? best : 0;
  };

  // Düz kısımlarda da sık örnekle: dış sekizgenin köşeleri ışınlar arasında kaybolmasın
  const stations: number[] = [];
  for (const s of inner.sampleStations(0, inner.perimeter)) {
    const last = stations.at(-1);
    if (last !== undefined) {
      const gap = s - last;
      const extra = Math.floor(gap / step);
      for (let k = 1; k <= extra; k++) {
        const t = last + (gap * k) / (extra + 1);
        stations.push(t);
      }
    }
    stations.push(s);
  }

  const rayAt = (s: number): RoofRay => {
    const length = castLength(s);
    return { s, inner: inner.point(s), outer: inner.point(s, length), length };
  };
  const rays = stations.map(rayAt);

  const heightAt = (x: number, z: number) => {
    const { s, d } = inner.inverse(x, z);
    const length = castLength(s);
    const t = length > 0 ? Math.min(1, Math.max(0, d / length)) : 0;
    return data.innerHeight + (data.outerHeight - data.innerHeight) * t;
  };

  return { data, inner, outer, rays, rayAt, heightAt };
}

/** p + t·n ışınının [a, b] doğru parçasıyla kesişimi (t > 0), yoksa null. */
function raySegment(p: Vec2, n: Vec2, a: Vec2, b: Vec2): number | null {
  const ex = b.x - a.x;
  const ez = b.z - a.z;
  const det = n.x * -ez - n.z * -ex;
  if (Math.abs(det) < 1e-12) return null;
  const ax = a.x - p.x;
  const az = a.z - p.z;
  const t = (ax * -ez - az * -ex) / det;
  const u = (n.x * az - n.z * ax) / det;
  if (t <= 1e-9 || u < -1e-9 || u > 1 + 1e-9) return null;
  return t;
}
