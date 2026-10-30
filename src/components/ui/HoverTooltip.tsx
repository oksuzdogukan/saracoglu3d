"use client";

import { categoryLabel } from "@/lib/stadium/categories";
import { stadium } from "@/lib/stadium/instance";
import { useViewer } from "@/store/useViewer";

/** Fareyle blok ya da koltuk üzerine gelince kısa bilgi. */
export function HoverTooltip() {
  const hover = useViewer((s) => s.hover);
  const mode = useViewer((s) => s.mode);
  if (!hover || hover.x === undefined || hover.y === undefined || mode === "seat") return null;

  const block = stadium.blocks[hover.block];
  let detail: string;
  if (hover.seat !== null) {
    const row = stadium.rows[stadium.seats.row[hover.seat]];
    detail = `Sıra ${row.label} · Koltuk ${stadium.seats.number[hover.seat]}`;
  } else {
    const first = stadium.rows[block.rowStart];
    const last = stadium.rows[block.rowStart + block.rowCount - 1];
    detail = `Sıra ${first?.label}–${last?.label} · ${block.seatCount.toLocaleString("tr-TR")} koltuk`;
  }

  return (
    <div
      className="pointer-events-none absolute z-10 rounded-lg bg-lacivert/95 px-2.5 py-1.5 text-xs text-white shadow-lg"
      style={{ left: hover.x + 14, top: hover.y + 14 }}
    >
      <div className="font-semibold">
        {block.label}
        {block.estimate && <span className="ml-1.5 font-normal text-white/60">(tahmini)</span>}
      </div>
      <div className="text-white/80">{detail}</div>
      {block.category && <div className="text-sari">{categoryLabel(block.category)}</div>}
    </div>
  );
}
