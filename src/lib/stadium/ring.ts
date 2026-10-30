/**
 * Bir katın ön sırasının plandaki referans eğrisi: köşeleri pahlı (chamfer)
 * ve yuvarlatılmış (fillet) bir dikdörtgen. Eğri doğru ve yaylardan oluşur,
 * teğet süreklidir; böylece d kadar dışarı ötelenmiş her sıra da düzgün bir
 * eğridir (doğrular kayar, yay yarıçapları d kadar büyür).
 *
 * Plan koordinatları: x (Spor Toto'ya doğru +), z (Fenerium'a doğru +).
 * İstasyon s: Maraton tarafının ortası (0, -halfZ) noktasından başlayıp,
 * yukarıdan bakınca saat yönünde ilerleyen yay uzunluğu (metre).
 */

export interface RingShape {
  halfX: number;
  halfZ: number;
  chamfer: number;
  fillet: number;
}

export interface Vec2 {
  x: number;
  z: number;
}

type LineSegment = {
  kind: "line";
  s0: number;
  length: number;
  ax: number;
  az: number;
  ux: number;
  uz: number;
};

type ArcSegment = {
  kind: "arc";
  s0: number;
  length: number;
  cx: number;
  cz: number;
  r: number;
  phi0: number;
};

export type Segment = LineSegment | ArcSegment;

const TAU = Math.PI * 2;

export class RingError extends Error {}

export class Ring {
  readonly segments: Segment[];
  readonly perimeter: number;
  /** Her kenarın orta noktasının istasyonu. */
  readonly sideCenters: { top: number; right: number; bottom: number; left: number };

  constructor(readonly shape: RingShape) {
    const { halfX: a, halfZ: b, chamfer: c, fillet: r } = shape;
    if (!(a > 0 && b > 0)) throw new RingError("halfX ve halfZ pozitif olmalı");
    if (c < 0 || c >= Math.min(a, b)) throw new RingError(`chamfer (${c}) 0 ile min(halfX, halfZ) arasında olmalı`);
    if (!(r > 0)) throw new RingError("fillet pozitif olmalı");

    const verts: Vec2[] =
      c > 0
        ? [
            { x: a - c, z: -b },
            { x: a, z: -b + c },
            { x: a, z: b - c },
            { x: a - c, z: b },
            { x: -a + c, z: b },
            { x: -a, z: b - c },
            { x: -a, z: -b + c },
            { x: -a + c, z: -b },
          ]
        : [
            { x: a, z: -b },
            { x: a, z: b },
            { x: -a, z: b },
            { x: -a, z: -b },
          ];
    const n = verts.length;

    const fillets = verts.map((v, i) => {
      const prev = verts[(i - 1 + n) % n];
      const next = verts[(i + 1) % n];
      const din = normalize({ x: v.x - prev.x, z: v.z - prev.z });
      const dout = normalize({ x: next.x - v.x, z: next.z - v.z });
      const theta = Math.acos(clamp(din.x * dout.x + din.z * dout.z, -1, 1));
      const t = r * Math.tan(theta / 2);
      const start = { x: v.x - din.x * t, z: v.z - din.z * t };
      const end = { x: v.x + dout.x * t, z: v.z + dout.z * t };
      // İçe bakan normal: (-din.z, din.x)
      const center = { x: start.x - din.z * r, z: start.z + din.x * r };
      return { start, end, center, theta, t };
    });

    for (let i = 0; i < n; i++) {
      const next = verts[(i + 1) % n];
      const edge = Math.hypot(next.x - verts[i].x, next.z - verts[i].z);
      if (fillets[i].t + fillets[(i + 1) % n].t > edge + 1e-9) {
        throw new RingError(`fillet (${r}) bu chamfer (${c}) için çok büyük; kenar uzunluğu yetmiyor`);
      }
    }

    const segments: Segment[] = [];
    let s = 0;
    const pushLine = (from: Vec2, to: Vec2) => {
      const length = Math.hypot(to.x - from.x, to.z - from.z);
      if (length < 1e-9) return;
      segments.push({ kind: "line", s0: s, length, ax: from.x, az: from.z, ux: (to.x - from.x) / length, uz: (to.z - from.z) / length });
      s += length;
    };
    const start: Vec2 = { x: 0, z: -b };
    let cursor = start;
    for (const f of fillets) {
      pushLine(cursor, f.start);
      const length = r * f.theta;
      segments.push({
        kind: "arc",
        s0: s,
        length,
        cx: f.center.x,
        cz: f.center.z,
        r,
        phi0: Math.atan2(f.start.z - f.center.z, f.start.x - f.center.x),
      });
      s += length;
      cursor = f.end;
    }
    pushLine(cursor, start);

    this.segments = segments;
    this.perimeter = s;
    this.sideCenters = {
      top: 0,
      right: this.inverse(a, 0).s,
      bottom: this.inverse(0, b).s,
      left: this.inverse(-a, 0).s,
    };
  }

  /** s'yi [0, perimeter) aralığına indirip segment indeksini ve yerel konumu verir. */
  locate(s: number): { index: number; t: number } {
    const sm = mod(s, this.perimeter);
    let lo = 0;
    let hi = this.segments.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.segments[mid].s0 <= sm) lo = mid;
      else hi = mid - 1;
    }
    const seg = this.segments[lo];
    return { index: lo, t: Math.min(sm - seg.s0, seg.length) };
  }

  /** Referans eğrisinin s istasyonundaki noktasından d kadar dışarıdaki nokta. */
  point(s: number, d = 0): Vec2 {
    const { index, t } = this.locate(s);
    return segmentPoint(this.segments[index], t, d);
  }

  /** Dışa bakan birim normal. */
  normal(s: number): Vec2 {
    const { index, t } = this.locate(s);
    return segmentNormal(this.segments[index], t);
  }

  /** s artış yönündeki (saat yönü) birim teğet. */
  tangent(s: number): Vec2 {
    const n = this.normal(s);
    return { x: -n.z, z: n.x };
  }

  /** [sA, sB] istasyon aralığının, d ötelemeli sıradaki gerçek uzunluğu. */
  rowLength(sA: number, sB: number, d: number): number {
    let total = 0;
    this.walk(sA, sB, (seg, tA, tB) => {
      total += (tB - tA) * scale(seg, d);
    });
    return total;
  }

  /** sA'dan başlayarak d ötelemeli sıra boyunca `dist` metre ilerlenen istasyon. */
  stationAtRowDistance(sA: number, dist: number, d: number): number {
    let { index, t } = this.locate(sA);
    let s = sA;
    let remaining = dist;
    for (let guard = 0; guard <= this.segments.length * 2; guard++) {
      const seg = this.segments[index];
      const avail = seg.length - t;
      const f = scale(seg, d);
      if (remaining <= avail * f) return s + remaining / f;
      remaining -= avail * f;
      s += avail;
      index = (index + 1) % this.segments.length;
      t = 0;
    }
    return s;
  }

  /**
   * [sA, sB] aralığını mesh üretimi için örnekler: uçlar, aradaki segment
   * sınırları ve yaylarda en fazla `maxAngle` radyanlık adımlar.
   */
  sampleStations(sA: number, sB: number, maxAngle = (3 * Math.PI) / 180): number[] {
    const out = [sA];
    let s = sA;
    this.walk(sA, sB, (seg, tA, tB) => {
      if (seg.kind === "arc") {
        const steps = Math.max(1, Math.ceil((tB - tA) / seg.r / maxAngle));
        for (let i = 1; i < steps; i++) out.push(s + ((tB - tA) * i) / steps);
      }
      s += tB - tA;
      if (sB - s > 1e-6) out.push(s);
    });
    out.push(sB);
    return out;
  }

  /** Plan noktasını (istasyon, öteleme) çiftine çevirir. */
  inverse(x: number, z: number): { s: number; d: number } {
    let best = { dist: Infinity, s: 0, d: 0 };
    for (const seg of this.segments) {
      let t: number;
      let d: number;
      let dist: number;
      if (seg.kind === "line") {
        const rx = x - seg.ax;
        const rz = z - seg.az;
        t = clamp(rx * seg.ux + rz * seg.uz, 0, seg.length);
        const fx = seg.ax + seg.ux * t;
        const fz = seg.az + seg.uz * t;
        dist = Math.hypot(x - fx, z - fz);
        d = (x - fx) * seg.uz - (z - fz) * seg.ux;
      } else {
        const rx = x - seg.cx;
        const rz = z - seg.cz;
        const radius = Math.hypot(rx, rz);
        const sweep = seg.length / seg.r;
        const alpha = mod(Math.atan2(rz, rx) - seg.phi0, TAU);
        if (alpha <= sweep) {
          t = alpha * seg.r;
          d = radius - seg.r;
          dist = Math.abs(d);
        } else {
          const p0 = segmentPoint(seg, 0, 0);
          const p1 = segmentPoint(seg, seg.length, 0);
          const d0 = Math.hypot(x - p0.x, z - p0.z);
          const d1 = Math.hypot(x - p1.x, z - p1.z);
          t = d0 < d1 ? 0 : seg.length;
          dist = Math.min(d0, d1);
          d = radius - seg.r;
        }
      }
      if (dist < best.dist) best = { dist, s: seg.s0 + t, d };
    }
    return { s: best.s, d: best.d };
  }

  private walk(sA: number, sB: number, cb: (seg: Segment, tA: number, tB: number) => void) {
    let { index, t } = this.locate(sA);
    let remaining = sB - sA;
    while (remaining > 1e-9) {
      const seg = this.segments[index];
      const take = Math.min(seg.length - t, remaining);
      if (take > 0) cb(seg, t, t + take);
      remaining -= take;
      index = (index + 1) % this.segments.length;
      t = 0;
    }
  }
}

function segmentPoint(seg: Segment, t: number, d: number): Vec2 {
  if (seg.kind === "line") {
    return { x: seg.ax + seg.ux * t + seg.uz * d, z: seg.az + seg.uz * t - seg.ux * d };
  }
  const phi = seg.phi0 + t / seg.r;
  const radius = seg.r + d;
  return { x: seg.cx + radius * Math.cos(phi), z: seg.cz + radius * Math.sin(phi) };
}

function segmentNormal(seg: Segment, t: number): Vec2 {
  if (seg.kind === "line") return { x: seg.uz, z: -seg.ux };
  const phi = seg.phi0 + t / seg.r;
  return { x: Math.cos(phi), z: Math.sin(phi) };
}

function scale(seg: Segment, d: number): number {
  return seg.kind === "arc" ? (seg.r + d) / seg.r : 1;
}

function normalize(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.z);
  return { x: v.x / len, z: v.z / len };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function mod(v: number, m: number): number {
  return ((v % m) + m) % m;
}
