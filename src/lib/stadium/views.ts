import type { StadiumModel } from "./layout";
import { mod } from "./ring";

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

export interface Pose {
  position: Point3;
  target: Point3;
}

/** Genel görünüm: Fenerium ile Spor Toto arasındaki köşenin üstünden tüm stada. */
export const OVERVIEW_POSE: Pose = {
  position: { x: 120, y: 175, z: 215 },
  target: { x: 0, y: 0, z: 0 },
};

/** Koltuk görünümünde varsayılan bakış noktası: saha merkezi. */
export const PITCH_CENTER: Point3 = { x: 0, y: 0, z: 0 };

/** Bloğun orta istasyonu ve orta sırasındaki nokta. */
export function blockCenter(model: StadiumModel, blockIndex: number): Point3 & { s: number } {
  const block = model.blocks[blockIndex];
  const ring = model.tiers[block.tier].ring;
  const s = (block.s0 + block.s1) / 2;
  const mid = Math.floor(block.fronts.length / 2);
  const p = ring.point(s, block.fronts[mid] + block.profile.tread / 2);
  return { x: p.x, y: block.floors[mid], z: p.z, s };
}

/** Blok seçilince kamera: bloğun önünde, sahanın üstünde, bloğa bakar. */
export function blockViewPose(model: StadiumModel, blockIndex: number): Pose {
  const block = model.blocks[blockIndex];
  const ring = model.tiers[block.tier].ring;
  const c = blockCenter(model, blockIndex);
  const n = ring.normal(c.s);
  return {
    position: { x: c.x - n.x * 48, y: c.y + 20, z: c.z - n.z * 48 },
    target: { x: c.x, y: c.y + 2, z: c.z },
  };
}

export function seatEye(model: StadiumModel, seat: number, eyeHeight: number): Point3 {
  const { x, y, z } = model.seats;
  return { x: x[seat], y: y[seat] + eyeHeight, z: z[seat] };
}

/** Koltuğa giriş/çıkış uçuşunun kontrol noktası: koltuğun önünde, sahanın üstünde. */
export function seatApproachPoint(model: StadiumModel, seat: number, eyeHeight: number): Point3 {
  const block = model.blocks[model.seats.block[seat]];
  const ring = model.tiers[block.tier].ring;
  const { s } = ring.inverse(model.seats.x[seat], model.seats.z[seat]);
  const p = ring.point(s, -24);
  const eye = seatEye(model, seat, eyeHeight);
  return { x: p.x, y: eye.y + 9, z: p.z };
}

/**
 * Koltuk görünümünde ayrıntılı koltuk modeliyle çizilecek bloklar: aynı
 * kattaki, koltuğun istasyonuna `radius` metreden yakın olanlar.
 */
export function nearbyBlocks(model: StadiumModel, seat: number, radius = 28): number[] {
  const own = model.blocks[model.seats.block[seat]];
  const ring = model.tiers[own.tier].ring;
  const P = ring.perimeter;
  const { s } = ring.inverse(model.seats.x[seat], model.seats.z[seat]);
  const out: number[] = [];
  for (const b of model.blocks) {
    if (b.tier !== own.tier) continue;
    // Koltuğun istasyonundan bloğa saat yönünde ve tersinde en kısa mesafe
    const ahead = mod(b.s0 - s, P);
    const length = b.s1 - b.s0;
    const dist = ahead + length >= P ? 0 : Math.min(ahead, P - ahead - length);
    if (dist <= radius) out.push(b.index);
  }
  return out;
}
