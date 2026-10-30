import { BufferGeometry, Color, ShapeUtils, Vector2 } from "three";
import { nextBlockInTier, type BlockModel, type StadiumModel, type TierModel } from "../stadium/layout";
import type { Ring } from "../stadium/ring";
import { MeshWriter, type V3 } from "./meshWriter";

const UP: V3 = [0, 1, 0];
const DOWN: V3 = [0, -1, 0];
const RAIL_BAR = 0.06;

interface Profile {
  fronts: number[];
  floors: number[];
  tread: number;
  base: number;
  dBack: number;
  wallTop: number;
}

interface Palette {
  concrete: Color;
  riser: Color;
  rail: Color;
}

export interface TerraceGeometries {
  /** Basamaklar, koridor merdivenleri, ön/arka duvarlar, alt yüzeyler. */
  terrace: BufferGeometry;
  /** Ön korkulukların cam panelleri (yarı saydam malzeme). */
  glass: BufferGeometry;
}

/**
 * Tüm blokların tribün yüzeylerini, koltuklarla aynı profilden üretir.
 * Komşu bloklar arasındaki boşluk `maxAisleWidth`'ten küçükse yarım
 * basamaklı koridor merdiveni, değilse blok ucunda kapama yüzeyi çizilir.
 */
export function buildTerraceGeometry(model: StadiumModel): TerraceGeometries {
  const { colors, defaults } = model.data;
  const palette: Palette = {
    concrete: new Color(colors.concrete),
    riser: new Color(colors.riser),
    rail: new Color("#2b313c"),
  };
  const w = new MeshWriter();
  const glass = new MeshWriter();

  const prevAisle = new Set<number>();
  const aisleAfter = new Map<number, BlockModel>();
  for (const block of model.blocks) {
    const next = nextBlockInTier(model, block);
    if (next && next.gap > 1e-6 && next.gap <= defaults.maxAisleWidth) {
      aisleAfter.set(block.index, next.block);
      prevAisle.add(next.block.index);
    }
  }

  for (const block of model.blocks) {
    const tier = model.tiers[block.tier];
    const ring = tier.ring;
    const profile = blockProfile(tier, block);
    const seatColor = new Color(block.seatColor);
    const stations = ring.sampleStations(block.s0, block.s1);

    eachPair(stations, (sa, sb) => {
      structureFaces(w, glass, ring, tier, profile, sa, sb, palette, block.index);
      const inward = inwardAt(ring, (sa + sb) / 2);
      profile.fronts.forEach((f, i) => {
        const y = profile.floors[i];
        w.quad(P(ring, sa, f, y), P(ring, sb, f, y), P(ring, sb, f + profile.tread, y), P(ring, sa, f + profile.tread, y), UP, seatColor, block.index, 0);
        if (i + 1 < profile.fronts.length) {
          const d = f + profile.tread;
          const y2 = profile.floors[i + 1];
          w.quad(P(ring, sa, d, y), P(ring, sb, d, y), P(ring, sb, d, y2), P(ring, sa, d, y2), inward, palette.riser, block.index);
        }
      });
    });

    if (!prevAisle.has(block.index)) endCap(w, ring, profile, block.s0, -1, palette.concrete, block.index);
    const next = aisleAfter.get(block.index);
    if (next) aisle(w, glass, ring, tier, profile, block, next, palette);
    else endCap(w, ring, profile, block.s1, 1, palette.concrete, block.index);
  }

  return { terrace: w.toGeometry(), glass: glass.toGeometry() };
}

function blockProfile(tier: TierModel, block: BlockModel): Profile {
  const last = block.fronts.length - 1;
  const base = block.profile.frontHeight - tier.structure.fasciaDepth;
  const lastFloor = block.floors[last];
  return {
    fronts: block.fronts,
    floors: block.floors,
    tread: block.profile.tread,
    base,
    dBack: block.fronts[last] + block.profile.tread,
    wallTop: Math.max(tier.structure.backWallTop, lastFloor),
  };
}

/** Ön alın + korkuluk, arka duvar, dış kapama ve (varsa) alt yüzey. */
function structureFaces(
  w: MeshWriter,
  glass: MeshWriter,
  ring: Ring,
  tier: TierModel,
  p: Profile,
  sa: number,
  sb: number,
  palette: Palette,
  block: number,
) {
  const { structure } = tier;
  const inward = inwardAt(ring, (sa + sb) / 2);
  const outward: V3 = [-inward[0], 0, -inward[2]];
  const f0 = p.fronts[0];
  const y0 = p.floors[0];
  const lastFloor = p.floors[p.floors.length - 1];
  const fascia = new Color(structure.fasciaColor);

  if (y0 - p.base > 1e-3) {
    w.quad(P(ring, sa, f0, p.base), P(ring, sb, f0, p.base), P(ring, sb, f0, y0), P(ring, sa, f0, y0), inward, fascia, block);
  }
  if (structure.railHeight > 0) {
    const top = y0 + structure.railHeight;
    const dr = f0 - RAIL_BAR / 2;
    glass.quad(P(ring, sa, dr, y0), P(ring, sb, dr, y0), P(ring, sb, dr, top), P(ring, sa, dr, top), inward, palette.rail);
    w.quad(P(ring, sa, f0 - RAIL_BAR, top), P(ring, sb, f0 - RAIL_BAR, top), P(ring, sb, f0, top), P(ring, sa, f0, top), UP, palette.rail);
    w.quad(P(ring, sa, f0 - RAIL_BAR, top - RAIL_BAR), P(ring, sb, f0 - RAIL_BAR, top - RAIL_BAR), P(ring, sb, f0 - RAIL_BAR, top), P(ring, sa, f0 - RAIL_BAR, top), inward, palette.rail);
  }
  if (p.wallTop - lastFloor > 1e-3) {
    // Üstten aşağı renk bantları (loca camları, reklam bandı), kalan kısım duvar rengi
    let top = p.wallTop;
    for (const band of structure.backWallBands ?? []) {
      const bottom = Math.max(lastFloor, top - band.height);
      if (top - bottom < 1e-3) break;
      w.quad(P(ring, sa, p.dBack, bottom), P(ring, sb, p.dBack, bottom), P(ring, sb, p.dBack, top), P(ring, sa, p.dBack, top), inward, new Color(band.color), block);
      top = bottom;
    }
    if (top - lastFloor > 1e-3) {
      const wall = new Color(structure.backWallColor);
      w.quad(P(ring, sa, p.dBack, lastFloor), P(ring, sb, p.dBack, lastFloor), P(ring, sb, p.dBack, top), P(ring, sa, p.dBack, top), inward, wall, block);
    }
  }
  w.quad(P(ring, sa, p.dBack, p.base), P(ring, sb, p.dBack, p.base), P(ring, sb, p.dBack, p.wallTop), P(ring, sa, p.dBack, p.wallTop), outward, palette.concrete, block);
  if (p.wallTop - lastFloor > 1e-3) {
    w.quad(P(ring, sa, p.dBack, p.wallTop), P(ring, sb, p.dBack, p.wallTop), P(ring, sb, p.dBack + 0.3, p.wallTop), P(ring, sa, p.dBack + 0.3, p.wallTop), UP, palette.concrete, block);
  }
  if (structure.underside && p.base > 1e-3) {
    w.quad(P(ring, sa, f0, p.base), P(ring, sb, f0, p.base), P(ring, sb, p.dBack, p.base), P(ring, sa, p.dBack, p.base), DOWN, palette.concrete, block);
  }
}

/** İki blok arasındaki koridor: her sırada iki yarım basamak. */
function aisle(
  w: MeshWriter,
  glass: MeshWriter,
  ring: Ring,
  tier: TierModel,
  p: Profile,
  left: BlockModel,
  right: BlockModel,
  palette: Palette,
) {
  const sL = left.s1;
  const sR = sL + ((right.s0 - left.s1) % ring.perimeter + ring.perimeter) % ring.perimeter;
  const aisleColor = new Color(left.aisleColor);
  const half = p.tread / 2;
  const n = p.fronts.length;

  eachPair(ring.sampleStations(sL, sR), (sa, sb) => {
    structureFaces(w, glass, ring, tier, p, sa, sb, palette, -1);
    const inward = inwardAt(ring, (sa + sb) / 2);
    p.fronts.forEach((f, i) => {
      const y = p.floors[i];
      if (i + 1 >= n) {
        w.quad(P(ring, sa, f, y), P(ring, sb, f, y), P(ring, sb, f + p.tread, y), P(ring, sa, f + p.tread, y), UP, aisleColor);
        return;
      }
      const y2 = p.floors[i + 1];
      const ym = (y + y2) / 2;
      w.quad(P(ring, sa, f, y), P(ring, sb, f, y), P(ring, sb, f + half, y), P(ring, sa, f + half, y), UP, aisleColor);
      w.quad(P(ring, sa, f + half, y), P(ring, sb, f + half, y), P(ring, sb, f + half, ym), P(ring, sa, f + half, ym), inward, palette.riser);
      w.quad(P(ring, sa, f + half, ym), P(ring, sb, f + half, ym), P(ring, sb, f + p.tread, ym), P(ring, sa, f + p.tread, ym), UP, aisleColor);
      w.quad(P(ring, sa, f + p.tread, ym), P(ring, sb, f + p.tread, ym), P(ring, sb, f + p.tread, y2), P(ring, sa, f + p.tread, y2), inward, palette.riser);
    });
  });

  // Yükseltilmiş yarım basamakların bloklara bakan yan yüzleri
  for (const [s, sign] of [
    [sL, -1],
    [sR, 1],
  ] as const) {
    const t = ring.tangent(s);
    const want: V3 = [t.x * sign, 0, t.z * sign];
    for (let i = 0; i + 1 < n; i++) {
      const f = p.fronts[i];
      const y = p.floors[i];
      const ym = (y + p.floors[i + 1]) / 2;
      w.quad(P(ring, s, f + half, y), P(ring, s, f + p.tread, y), P(ring, s, f + p.tread, ym), P(ring, s, f + half, ym), want, palette.riser);
    }
  }
}

/** Komşusu olmayan blok ucunu, basamak profilini izleyen bir yüzeyle kapatır. */
function endCap(w: MeshWriter, ring: Ring, p: Profile, s: number, sign: 1 | -1, color: Color, block: number) {
  const contour: Vector2[] = [new Vector2(p.fronts[0], p.base), new Vector2(p.fronts[0], p.floors[0])];
  p.fronts.forEach((f, i) => {
    contour.push(new Vector2(f + p.tread, p.floors[i]));
    if (i + 1 < p.fronts.length) contour.push(new Vector2(f + p.tread, p.floors[i + 1]));
  });
  if (p.wallTop > p.floors[p.floors.length - 1] + 1e-3) contour.push(new Vector2(p.dBack, p.wallTop));
  contour.push(new Vector2(p.dBack, p.base));

  const t = ring.tangent(s);
  const want: V3 = [t.x * sign, 0, t.z * sign];
  const pts = contour.map((v) => P(ring, s, v.x, v.y));
  for (const [a, b, c] of ShapeUtils.triangulateShape(contour, [])) {
    w.triangle(pts[a], pts[b], pts[c], want, color, block);
  }
}

function P(ring: Ring, s: number, d: number, y: number): V3 {
  const p = ring.point(s, d);
  return [p.x, y, p.z];
}

function inwardAt(ring: Ring, s: number): V3 {
  const n = ring.normal(s);
  return [-n.x, 0, -n.z];
}

function eachPair(list: number[], cb: (a: number, b: number) => void) {
  for (let i = 0; i + 1 < list.length; i++) cb(list[i], list[i + 1]);
}
