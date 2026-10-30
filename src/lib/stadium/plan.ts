import { CATEGORY_FILLS } from "./categories";
import type { StadiumModel } from "./layout";

/**
 * Hesaplanan modelden 2D blok haritası (plan). Koordinatlar metre: x sağa,
 * z aşağı; yani Maraton üstte, Passo haritasıyla aynı yön. Saf veri döner;
 * SVG olarak hem arayüzde hem sunucuda (link önizlemesi) çizilebilir.
 */
export interface PlanBlock {
  index: number;
  path: string;
  labelX: number;
  labelY: number;
  labelSize: number;
  fill: string;
  textColor: string;
}

export interface PlanLabel {
  text: string;
  x: number;
  y: number;
  rotate: number;
}

export interface Plan {
  viewBox: [number, number, number, number];
  /** Önce dış katlar, sonra iç katlar: alt kat bloklarının tamamı görünür. */
  blocks: PlanBlock[];
  pitch: { halfX: number; halfZ: number; lines: string };
  standLabels: PlanLabel[];
}

const STEP = (6 * Math.PI) / 180;
const f = (v: number) => (Math.round(v * 10) / 10).toString();

export function buildPlan(model: StadiumModel): Plan {
  const blocks: PlanBlock[] = [];
  let maxX = model.data.pitch.length / 2;
  let maxZ = model.data.pitch.width / 2;

  const order = [...model.blocks].sort((a, b) => b.tier - a.tier || a.index - b.index);
  for (const block of order) {
    const ring = model.tiers[block.tier].ring;
    const front = block.fronts[0];
    const depth = block.fronts.at(-1)! + block.profile.tread - front;
    const back = front + depth;
    const stations = ring.sampleStations(block.s0, block.s1, STEP);
    const pts = [...stations.map((s) => ring.point(s, front)), ...[...stations].reverse().map((s) => ring.point(s, back))];
    for (const p of pts) {
      maxX = Math.max(maxX, Math.abs(p.x));
      maxZ = Math.max(maxZ, Math.abs(p.z));
    }
    const mid = (block.s0 + block.s1) / 2;
    // Üst katın iç kısmı alt katın altında kalır; etiketi görünen dış kısma koy
    const labelD = front + depth * (block.tier > 0 ? 0.72 : 0.5);
    const label = ring.point(mid, labelD);
    const width = ring.rowLength(block.s0, block.s1, labelD);
    const fill = (block.category && CATEGORY_FILLS[block.category]) || block.seatColor;
    blocks.push({
      index: block.index,
      path: `M${pts.map((p) => `${f(p.x)} ${f(p.z)}`).join("L")}Z`,
      labelX: label.x,
      labelY: label.z,
      labelSize: Math.min(7, Math.max(3.4, Math.min(width, depth * (block.tier > 0 ? 0.55 : 1)) * 0.55)),
      fill,
      textColor: luminance(fill) > 0.45 ? "#0b1f4b" : "#ffffff",
    });
  }

  const { length, width, markings: m } = model.data.pitch;
  const L = length / 2;
  const W = width / 2;
  const boxes = [-1, 1]
    .map((sg) => {
      const pa = `M${sg * L} ${-m.penaltyAreaWidth / 2}H${sg * (L - m.penaltyAreaDepth)}V${m.penaltyAreaWidth / 2}H${sg * L}`;
      const ga = `M${sg * L} ${-m.goalAreaWidth / 2}H${sg * (L - m.goalAreaDepth)}V${m.goalAreaWidth / 2}H${sg * L}`;
      return pa + ga;
    })
    .join("");
  const r = m.centerCircleRadius;
  const lines = `M0 ${-W}V${W}M${r} 0A${r} ${r} 0 1 0 ${-r} 0A${r} ${r} 0 1 0 ${r} 0${boxes}`;

  const margin = 14;
  const ex = maxX + margin;
  const ez = maxZ + margin;
  const standLabels: PlanLabel[] = model.stands.map((s) => {
    const label = `${s.name.toLocaleUpperCase("tr-TR")}`;
    switch (s.side) {
      case "top":
        return { text: label, x: 0, y: -ez + 6, rotate: 0 };
      case "bottom":
        return { text: label, x: 0, y: ez - 3, rotate: 0 };
      case "left":
        return { text: label, x: -ex + 6, y: 0, rotate: -90 };
      case "right":
        return { text: label, x: ex - 6, y: 0, rotate: 90 };
    }
  });

  return {
    viewBox: [-ex, -ez, ex * 2, ez * 2],
    blocks,
    pitch: { halfX: L, halfZ: W, lines },
    standLabels,
  };
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/**
 * Planı bağımsız bir SVG metni olarak çizer (link önizleme görseli için).
 * Vurgulanan blok sarı çerçeveyle, koltuk kırmızı noktayla işaretlenir.
 */
export function planToSvg(plan: Plan, options: { width: number; height: number; highlight?: number; marker?: { x: number; z: number } }): string {
  const [vx, vy, vw, vh] = plan.viewBox;
  const blocks = plan.blocks
    .map((b) => {
      const on = b.index === options.highlight;
      return `<path d="${b.path}" fill="${b.fill}" stroke="${on ? "#f5c400" : "#ffffff"}" stroke-width="${on ? 2.2 : 0.5}" stroke-linejoin="round"/>`;
    })
    .join("");
  const marker = options.marker
    ? `<circle cx="${f(options.marker.x)}" cy="${f(options.marker.z)}" r="4.5" fill="#e11d48" stroke="#ffffff" stroke-width="1.6"/>`
    : "";
  const { halfX: L, halfZ: W, lines } = plan.pitch;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${options.width}" height="${options.height}" viewBox="${vx} ${vy} ${vw} ${vh}">` +
    `<rect x="${-L - 6}" y="${-W - 5}" width="${L * 2 + 12}" height="${W * 2 + 10}" rx="3" fill="#3f7a31"/>` +
    `<rect x="${-L}" y="${-W}" width="${L * 2}" height="${W * 2}" fill="none" stroke="#ffffff" stroke-opacity="0.8" stroke-width="0.6"/>` +
    `<path d="${lines}" fill="none" stroke="#ffffff" stroke-opacity="0.8" stroke-width="0.6"/>` +
    blocks +
    marker +
    `</svg>`
  );
}
