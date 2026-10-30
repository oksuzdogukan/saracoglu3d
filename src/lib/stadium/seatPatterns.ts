import type { BlockModel, RowModel, SeatArrays, StandModel, TierModel } from "./layout";
import { mod } from "./ring";
import type { SeatPatternData } from "./schema";

/**
 * Koltuk yazıları için blok yazı tipi: 5 sütun × 7 satır, Ç'nin çengeli için
 * bir alt satır. "#" = renkli koltuk.
 */
const GLYPHS: Record<string, string[]> = {
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#....", "....."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####", "....."],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#", "....."],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#", "....."],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####.", "....."],
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#", "....."],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#", "....."],
  Ç: [".####", "#....", "#....", "#....", "#....", "#....", ".####", "..#.."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", ".....", "....."],
};
const GLYPH_W = 5;
const GLYPH_H = 8;

/**
 * Metni piksel ızgarasına çevirir. Sütunlar iki katına çıkarılıp sağa bir
 * piksel kalınlaştırılır: stattaki yazı gibi kalın dikey çizgiler.
 */
export function rasterize(text: string): boolean[][] {
  const chars = [...text.toLocaleUpperCase("tr-TR")];
  const cell = (GLYPH_W + 1) * 2;
  const width = chars.length * cell - 2;
  const grid = Array.from({ length: GLYPH_H }, () => new Array<boolean>(width).fill(false));
  chars.forEach((ch, k) => {
    const glyph = GLYPHS[ch] ?? GLYPHS[" "];
    for (let y = 0; y < GLYPH_H; y++) {
      for (let x = 0; x < GLYPH_W; x++) {
        if (glyph[y][x] !== "#") continue;
        const gx = k * cell + x * 2;
        grid[y][gx] = grid[y][gx + 1] = true;
        if (gx + 2 < width) grid[y][gx + 2] = true;
      }
    }
  });
  return grid;
}

function parseRange(spec: string): [number, number] {
  const m = spec.match(/^(\d+)-(\d+)$/);
  if (!m) throw new Error(`Sıra aralığı "a-b" biçiminde olmalı: "${spec}"`);
  const a = Number(m[1]);
  const b = Number(m[2]);
  return [Math.min(a, b), Math.max(a, b)];
}

/**
 * Koltuk renk indekslerini yazılara göre günceller. Yazının sütunu tribün
 * boyunca konumdan (saat yönü = karşıdan bakınca soldan sağa), satırı fiziksel
 * sıradan gelir (arka sıralar yazının üstü).
 */
export function applySeatPatterns(
  patterns: SeatPatternData[],
  ctx: {
    tiers: Map<string, TierModel>;
    stands: Map<string, StandModel>;
    blocks: BlockModel[];
    rows: RowModel[];
    seats: SeatArrays;
    colorIndex: Uint8Array;
    palette: string[];
  },
  error: (path: string, message: string) => void,
) {
  for (const p of patterns) {
    const tier = ctx.tiers.get(p.tier);
    const stand = ctx.stands.get(p.stand);
    if (!tier || !stand) {
      error(`seatPatterns[${p.id}]`, "Tanımsız tribün ya da kat");
      continue;
    }
    let r0: number;
    let r1: number;
    try {
      [r0, r1] = parseRange(p.rows);
    } catch (e) {
      error(`seatPatterns[${p.id}].rows`, (e as Error).message);
      continue;
    }
    const grid = rasterize(p.text);
    const cols = grid[0].length;
    let color = ctx.palette.indexOf(p.color);
    if (color < 0) color = ctx.palette.push(p.color) - 1;
    const ring = tier.ring;
    const P = ring.perimeter;
    const center = ring.sideCenters[stand.side];

    for (const block of ctx.blocks) {
      if (block.tier !== tier.index || block.stand !== stand.index) continue;
      for (let i = block.seatStart; i < block.seatStart + block.seatCount; i++) {
        const row = ctx.rows[ctx.seats.row[i]].phys + 1;
        if (row < r0 || row > r1) continue;
        const { s } = ring.inverse(ctx.seats.x[i], ctx.seats.z[i]);
        const u = mod(s - center + P / 2, P) - P / 2;
        const gx = Math.floor(((u - p.from) / (p.to - p.from)) * cols);
        if (gx < 0 || gx >= cols) continue;
        const gy = Math.min(GLYPH_H - 1, Math.floor(((r1 - row) / (r1 - r0 + 1)) * GLYPH_H));
        if (grid[gy][gx]) ctx.colorIndex[i] = color;
      }
    }
  }
}
