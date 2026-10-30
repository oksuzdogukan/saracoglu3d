import { BufferGeometry, Color, Float32BufferAttribute } from "three";
import type { PitchData } from "../stadium/schema";

const LINE_Y = 0.012;

/**
 * Çim: sahaya dik biçme şeritleri, tribün önüne kadar uzanır.
 * Şerit genişliği saha boyu / mowStripes; desen sahanın dışına da devam eder.
 */
export function buildGrassGeometry(pitch: PitchData, halfX: number, halfZ: number, light: string, dark: string): BufferGeometry {
  const stripe = pitch.length / pitch.mowStripes;
  const colors = [new Color(light), new Color(dark)];
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const first = Math.floor((-halfX + pitch.length / 2) / stripe);
  const last = Math.ceil((halfX + pitch.length / 2) / stripe);
  for (let k = first; k < last; k++) {
    const x0 = Math.max(-halfX, -pitch.length / 2 + k * stripe);
    const x1 = Math.min(halfX, -pitch.length / 2 + (k + 1) * stripe);
    if (x1 <= x0) continue;
    const c = colors[((k % 2) + 2) % 2];
    const base = pos.length / 3;
    pos.push(x0, 0, -halfZ, x1, 0, -halfZ, x1, 0, halfZ, x0, 0, halfZ);
    for (let i = 0; i < 4; i++) col.push(c.r, c.g, c.b);
    idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new Float32BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setAttribute("color", new Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

/** Saha çizgileri: FIFA ölçüleriyle düz üçgenler (doku yok, her mesafede keskin). */
export function buildLineGeometry(pitch: PitchData): BufferGeometry {
  const pos: number[] = [];
  const L = pitch.length / 2;
  const W = pitch.width / 2;
  const w = pitch.lineWidth;
  const m = pitch.markings;

  const rect = (x0: number, z0: number, x1: number, z1: number) => {
    pos.push(x0, LINE_Y, z0, x0, LINE_Y, z1, x1, LINE_Y, z1, x0, LINE_Y, z0, x1, LINE_Y, z1, x1, LINE_Y, z0);
  };
  const band = (cx: number, cz: number, r: number, a0: number, a1: number) => {
    const steps = Math.max(8, Math.ceil(((a1 - a0) * r) / 0.4));
    const ri = r - w / 2;
    const ro = r + w / 2;
    for (let i = 0; i < steps; i++) {
      const t0 = a0 + ((a1 - a0) * i) / steps;
      const t1 = a0 + ((a1 - a0) * (i + 1)) / steps;
      const p = (rad: number, t: number) => [cx + rad * Math.cos(t), LINE_Y, cz + rad * Math.sin(t)];
      pos.push(...p(ri, t0), ...p(ri, t1), ...p(ro, t1), ...p(ri, t0), ...p(ro, t1), ...p(ro, t0));
    }
  };
  const disc = (cx: number, cz: number, r: number) => {
    const steps = 16;
    for (let i = 0; i < steps; i++) {
      const t0 = (i / steps) * Math.PI * 2;
      const t1 = ((i + 1) / steps) * Math.PI * 2;
      pos.push(cx, LINE_Y, cz, cx + r * Math.cos(t1), LINE_Y, cz + r * Math.sin(t1), cx + r * Math.cos(t0), LINE_Y, cz + r * Math.sin(t0));
    }
  };

  // Dış sınır (çizgi sınırın içinde kalır)
  rect(-L, -W, L, -W + w);
  rect(-L, W - w, L, W);
  rect(-L, -W, -L + w, W);
  rect(L - w, -W, L, W);
  // Orta çizgi, orta yuvarlak ve nokta
  rect(-w / 2, -W, w / 2, W);
  band(0, 0, m.centerCircleRadius, 0, Math.PI * 2);
  disc(0, 0, m.spotRadius);

  for (const sign of [-1, 1]) {
    const gx = sign * L;
    const box = (depth: number, width: number) => {
      const xf = gx - sign * depth;
      rect(Math.min(xf, xf + sign * w), -width / 2, Math.max(xf, xf + sign * w), width / 2);
      rect(Math.min(gx, xf), -width / 2, Math.max(gx, xf), -width / 2 + w);
      rect(Math.min(gx, xf), width / 2 - w, Math.max(gx, xf), width / 2);
    };
    box(m.penaltyAreaDepth, m.penaltyAreaWidth);
    box(m.goalAreaDepth, m.goalAreaWidth);
    const spotX = gx - sign * m.penaltySpotDistance;
    disc(spotX, 0, m.spotRadius);
    // Ceza sahası yayı: noktadan 9,15 m, ceza sahası dışında kalan kısım
    const alpha = Math.acos(Math.min(1, (m.penaltyAreaDepth - m.penaltySpotDistance) / m.centerCircleRadius));
    const facing = sign > 0 ? Math.PI : 0;
    band(spotX, 0, m.centerCircleRadius, facing - alpha, facing + alpha);
    // Köşe yayları
    for (const zs of [-1, 1]) {
      const start = Math.atan2(-zs, -sign);
      band(gx, zs * W, m.cornerArcRadius, start - Math.PI / 4, start + Math.PI / 4);
    }
  }

  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new Float32BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  return g;
}

/**
 * Kale filesi yüzeyleri (üst, eğimli arka, iki yan). UV'ler metre cinsinden;
 * tekrar eden ağ dokusuyla kullanılır.
 */
export function buildNetGeometry(pitch: PitchData, sign: 1 | -1): BufferGeometry {
  const { width, height, netDepthBottom, netDepthTop } = pitch.goal;
  const x0 = sign * (pitch.length / 2);
  const xt = sign * (pitch.length / 2 + netDepthTop);
  const xb = sign * (pitch.length / 2 + netDepthBottom);
  const z = width / 2;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const quad = (pts: number[][], uvs: number[][]) => {
    const base = pos.length / 3;
    pts.forEach((p) => pos.push(...p));
    uvs.forEach((t) => uv.push(...t));
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const backLen = Math.hypot(netDepthBottom - netDepthTop, height);
  quad(
    [[x0, height, -z], [xt, height, -z], [xt, height, z], [x0, height, z]],
    [[0, 0], [netDepthTop, 0], [netDepthTop, width], [0, width]],
  );
  quad(
    [[xt, height, -z], [xb, 0, -z], [xb, 0, z], [xt, height, z]],
    [[0, 0], [backLen, 0], [backLen, width], [0, width]],
  );
  for (const zs of [-z, z]) {
    quad(
      [[x0, 0, zs], [xb, 0, zs], [xt, height, zs], [x0, height, zs]],
      [[0, 0], [netDepthBottom, 0], [netDepthTop, height], [0, height]],
    );
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
