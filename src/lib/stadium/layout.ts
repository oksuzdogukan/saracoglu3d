import { blockKey, seatKey, tierSlug } from "./ids";
import { expandRows, NumberingError, type ExpandedRow } from "./numbering";
import { mod, Ring, RingError } from "./ring";
import { buildRoof, type RoofModel } from "./roof";
import type { AlignName, BlockData, SeatsFromName, SideName, StadiumData, TierData } from "./schema";
import { applySeatPatterns } from "./seatPatterns";
import { placeStructures, type StructureModel } from "./structures";

export interface Issue {
  level: "error" | "warning";
  path: string;
  message: string;
}

export interface ResolvedProfile {
  frontOffset: number;
  frontHeight: number;
  rows: number;
  tread: number;
  riserFirst: number;
  riserLast: number;
}

export interface TierModel {
  index: number;
  id: string;
  name: string;
  ring: Ring;
  profile: ResolvedProfile;
  structure: TierData["structure"];
}

export interface StandModel {
  index: number;
  id: string;
  name: string;
  side: SideName;
}

export interface BlockModel {
  index: number;
  key: string;
  slug: string;
  id: string;
  standId: string;
  tierId: string;
  stand: number;
  tier: number;
  label: string;
  /** Halka üzerindeki küresel istasyonlar (s0 < s1, sarılmamış). */
  s0: number;
  s1: number;
  profile: ResolvedProfile;
  /** Her fiziksel sıranın basamak ön kenarı ötelemesi ve zemin kotu. */
  fronts: number[];
  floors: number[];
  seatWidth: number;
  seatColor: string;
  aisleColor: string;
  seatsFrom: SeatsFromName;
  category?: string;
  estimate: boolean;
  rowStart: number;
  rowCount: number;
  seatStart: number;
  seatCount: number;
}

export interface RowModel {
  block: number;
  label: string;
  phys: number;
  /** Koltuk merkez hattının ötelemesi. */
  offset: number;
  floorY: number;
  seatStart: number;
  seatCount: number;
}

/** Koltuklar düz dizilerde: on binlerce koltuk için nesne üretmeyiz. */
export interface SeatArrays {
  count: number;
  /** Koltuk merkezi, basamak zemini kotunda. */
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
  /** Koltuğun baktığı yön (sahaya doğru) için y ekseni etrafında açı. */
  yaw: Float32Array;
  width: Float32Array;
  block: Uint16Array;
  row: Uint32Array;
  number: Int32Array;
  /** seatPalette içindeki renk (blok rengi ya da koltuk yazısı rengi). */
  color: Uint8Array;
}

export interface StadiumModel {
  data: StadiumData;
  tiers: TierModel[];
  stands: StandModel[];
  blocks: BlockModel[];
  rows: RowModel[];
  seats: SeatArrays;
  seatIndex: Map<string, number>;
  blockIndex: Map<string, number>;
  seatPalette: string[];
  roof: RoofModel | null;
  structures: StructureModel[];
  issues: Issue[];
}

export function resolveProfile(base: ResolvedProfile, override: BlockData["profile"]): ResolvedProfile {
  if (!override) return base;
  return {
    frontOffset: override.frontOffset ?? base.frontOffset,
    frontHeight: override.frontHeight ?? base.frontHeight,
    rows: override.rows ?? base.rows,
    tread: override.tread ?? base.tread,
    riserFirst: override.riser?.first ?? base.riserFirst,
    riserLast: override.riser?.last ?? base.riserLast,
  };
}

/** Her fiziksel sıranın basamak zemini kotu. Rıht ilk değerden son değere doğrusal artar. */
export function rowFloors(p: ResolvedProfile): number[] {
  const floors = [p.frontHeight];
  for (let j = 1; j < p.rows; j++) {
    const t = p.rows > 2 ? (j - 1) / (p.rows - 2) : 0;
    floors.push(floors[j - 1] + p.riserFirst + (p.riserLast - p.riserFirst) * t);
  }
  return floors;
}

export function rowFronts(p: ResolvedProfile): number[] {
  return Array.from({ length: p.rows }, (_, i) => p.frontOffset + i * p.tread);
}

interface PlacedSeat {
  x: number;
  y: number;
  z: number;
  yaw: number;
  width: number;
  number: number;
}

export function buildStadiumModel(data: StadiumData): StadiumModel {
  const issues: Issue[] = [];
  const error = (path: string, message: string) => issues.push({ level: "error", path, message });
  const warn = (path: string, message: string) => issues.push({ level: "warning", path, message });

  const tiers: TierModel[] = [];
  const tierById = new Map<string, TierModel>();
  data.tiers.forEach((t, index) => {
    try {
      const ring = new Ring(t.ring);
      const model: TierModel = {
        index,
        id: t.id,
        name: t.name,
        ring,
        profile: {
          frontOffset: t.profile.frontOffset,
          frontHeight: t.profile.frontHeight,
          rows: t.profile.rows,
          tread: t.profile.tread,
          riserFirst: t.profile.riser.first,
          riserLast: t.profile.riser.last,
        },
        structure: t.structure,
      };
      tiers.push(model);
      tierById.set(t.id, model);
    } catch (e) {
      if (e instanceof RingError) error(`tiers[${t.id}].ring`, e.message);
      else throw e;
    }
  });

  const stands: StandModel[] = data.stands.map((s, index) => ({ index, id: s.id, name: s.name, side: s.side }));
  const standById = new Map(data.stands.map((s, i) => [s.id, { data: s, model: stands[i] }]));

  const blocks: BlockModel[] = [];
  const rows: RowModel[] = [];
  const placed: PlacedSeat[] = [];
  const seatRow: number[] = [];
  const seatBlock: number[] = [];
  const seatIndex = new Map<string, number>();
  const blockIndex = new Map<string, number>();

  for (const b of data.blocks) {
    const tier = tierById.get(b.tier);
    const stand = standById.get(b.stand);
    if (!tier || !stand) continue;
    const key = blockKey(b.stand, b.tier, b.id);
    const path = `blocks[${key}]`;
    const center = tier.ring.sideCenters[stand.model.side];
    const s0 = center + b.from;
    const s1 = center + b.to;
    if (s1 - s0 >= tier.ring.perimeter) {
      error(path, "Blok tüm halkadan uzun");
      continue;
    }

    const profile = resolveProfile(tier.profile, b.profile);
    const fronts = rowFronts(profile);
    const floors = rowFloors(profile);
    const seatWidth = b.seatWidth ?? data.defaults.seatWidth;
    const seatsFrom = b.seatsFrom ?? data.defaults.seatsFrom;
    const align = b.align ?? data.defaults.align;
    const standTier = stand.data.tiers[b.tier];

    let expanded: ExpandedRow[];
    try {
      const result = expandRows(b.rows);
      expanded = result.rows;
      if (result.physCount > profile.rows) {
        error(path, `Numaralandırma ${result.physCount} fiziksel sıra tanımlıyor, profilde ${profile.rows} sıra var`);
        continue;
      }
      if (result.physCount < profile.rows) {
        warn(path, `Profilde ${profile.rows} sıra var, numaralandırma ${result.physCount} sıra tanımlıyor; arka sıralar koltuksuz kalır`);
      }
    } catch (e) {
      if (e instanceof NumberingError) {
        error(path, e.message);
        continue;
      }
      throw e;
    }

    const index = blocks.length;
    const block: BlockModel = {
      index,
      key,
      slug: tierSlug(b.stand, b.tier),
      id: b.id.toUpperCase(),
      standId: b.stand,
      tierId: b.tier,
      stand: stand.model.index,
      tier: tier.index,
      label: `${stand.data.name} ${tier.name} · ${b.id.toUpperCase()}`,
      s0,
      s1,
      profile,
      fronts,
      floors,
      seatWidth,
      seatColor: b.seatColor ?? standTier.seatColor,
      aisleColor: standTier.aisleColor,
      seatsFrom,
      category: b.category,
      estimate: b.estimate === true,
      rowStart: rows.length,
      rowCount: 0,
      seatStart: placed.length,
      seatCount: 0,
    };
    blocks.push(block);
    blockIndex.set(key, index);

    for (const row of expanded) {
      const offset = fronts[row.phys] + data.defaults.seatOffset;
      const seats = placeRow(tier.ring, block, row, offset, floors[row.phys], row.align ?? align, (msg) => warn(`${path} sıra ${row.label}`, msg));
      const rowIndex = rows.length;
      rows.push({ block: index, label: row.label, phys: row.phys, offset, floorY: floors[row.phys], seatStart: placed.length, seatCount: seats.length });
      for (const seat of seats) {
        seatIndex.set(seatKey(key, row.label, seat.number), placed.length);
        placed.push(seat);
        seatRow.push(rowIndex);
        seatBlock.push(index);
      }
    }
    block.rowCount = rows.length - block.rowStart;
    block.seatCount = placed.length - block.seatStart;
  }

  checkOverlaps(tiers, blocks, error);

  const count = placed.length;
  const seats: SeatArrays = {
    count,
    x: new Float32Array(count),
    y: new Float32Array(count),
    z: new Float32Array(count),
    yaw: new Float32Array(count),
    width: new Float32Array(count),
    block: new Uint16Array(seatBlock),
    row: new Uint32Array(seatRow),
    number: new Int32Array(count),
    color: new Uint8Array(count),
  };
  placed.forEach((p, i) => {
    seats.x[i] = p.x;
    seats.y[i] = p.y;
    seats.z[i] = p.z;
    seats.yaw[i] = p.yaw;
    seats.width[i] = p.width;
    seats.number[i] = p.number;
  });

  const seatPalette: string[] = [];
  const blockColor = blocks.map((b) => {
    const i = seatPalette.indexOf(b.seatColor);
    return i >= 0 ? i : seatPalette.push(b.seatColor) - 1;
  });
  for (let i = 0; i < count; i++) seats.color[i] = blockColor[seats.block[i]];
  applySeatPatterns(
    data.seatPatterns,
    { tiers: tierById, stands: new Map(stands.map((s) => [s.id, s])), blocks, rows, seats, colorIndex: seats.color, palette: seatPalette },
    error,
  );

  let roof: RoofModel | null = null;
  if (data.roof) {
    try {
      roof = buildRoof(data.roof);
    } catch (e) {
      if (e instanceof RingError) error("roof", e.message);
      else throw e;
    }
  }
  const structures = placeStructures(data.structures, tierById, new Map(stands.map((s) => [s.id, s])), error);

  return { data, tiers, stands, blocks, rows, seats, seatIndex, blockIndex, seatPalette, roof, structures, issues };
}

/**
 * Bir sıranın koltuklarını blok sınırları arasına dizer. Koltuk sırası
 * numaralandırmanın başladığı uçtan (sahaya bakarken sol/sağ) ölçülür;
 * sol uç saat yönündeki (büyük s) uçtur.
 */
function placeRow(
  ring: Ring,
  block: BlockModel,
  row: ExpandedRow,
  offset: number,
  floorY: number,
  align: AlignName,
  warn: (msg: string) => void,
): PlacedSeat[] {
  const rowLength = ring.rowLength(block.s0, block.s1, offset);
  let width = block.seatWidth;
  const tokens =
    row.tokens === "auto"
      ? Array.from({ length: Math.floor(rowLength / width + 1e-6) }, (_, i) => i + 1)
      : row.tokens;
  const k = tokens.length;
  if (k === 0) return [];
  if (k * width > rowLength + 1e-6) {
    warn(`${k} yer ${rowLength.toFixed(2)} m'ye sığmıyor; koltuk aralığı ${(rowLength / k).toFixed(3)} m'ye sıkıştırıldı`);
    width = rowLength / k;
  }
  const slack = rowLength - k * width;
  let base = align === "start" ? 0 : align === "end" ? slack : slack / 2;
  base += row.shift * width;
  if (base < -1e-6 || base > slack + 1e-6) warn(`shift (${row.shift}) koltukları blok dışına taşıyor`);

  const out: PlacedSeat[] = [];
  tokens.forEach((token, i) => {
    if (token === null) return;
    const fromStart = base + (i + 0.5) * width;
    const fromLow = block.seatsFrom === "left" ? rowLength - fromStart : fromStart;
    const s = ring.stationAtRowDistance(block.s0, fromLow, offset);
    const p = ring.point(s, offset);
    const n = ring.normal(s);
    out.push({ x: p.x, y: floorY, z: p.z, yaw: Math.atan2(-n.x, -n.z), width, number: token });
  });
  return out;
}

function checkOverlaps(tiers: TierModel[], blocks: BlockModel[], error: (path: string, msg: string) => void) {
  for (const tier of tiers) {
    const P = tier.ring.perimeter;
    const list = blocks
      .filter((b) => b.tier === tier.index)
      .map((b) => ({ b, start: mod(b.s0, P), end: mod(b.s0, P) + (b.s1 - b.s0) }))
      .sort((a, b) => a.start - b.start);
    list.forEach((cur, i) => {
      if (list.length < 2) return;
      const next = list[(i + 1) % list.length];
      const nextStart = i + 1 < list.length ? next.start : next.start + P;
      if (cur.end > nextStart + 1e-6) {
        error(`blocks[${cur.b.key}]`, `${next.b.key} bloğuyla ${(cur.end - nextStart).toFixed(2)} m çakışıyor`);
      }
    });
  }
}

/** Aynı kattaki komşu blok (saat yönünde sonraki) ve aradaki boşluk. */
export function nextBlockInTier(model: StadiumModel, block: BlockModel): { block: BlockModel; gap: number } | null {
  const tier = model.tiers[block.tier];
  const P = tier.ring.perimeter;
  let best: { block: BlockModel; gap: number } | null = null;
  for (const other of model.blocks) {
    if (other.tier !== block.tier || other === block) continue;
    const gap = mod(other.s0 - block.s1, P);
    if (gap < P - (other.s1 - other.s0) && (!best || gap < best.gap)) best = { block: other, gap };
  }
  return best;
}
