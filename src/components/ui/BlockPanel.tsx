"use client";

import { useState } from "react";
import { categoryLabel } from "@/lib/stadium/categories";
import { seatKey } from "@/lib/stadium/ids";
import { stadium } from "@/lib/stadium/instance";
import { useViewer } from "@/store/useViewer";

function seatNumbers(rowIndex: number): number[] {
  const row = stadium.rows[rowIndex];
  const out: number[] = [];
  for (let i = row.seatStart; i < row.seatStart + row.seatCount; i++) out.push(stadium.seats.number[i]);
  return out.sort((a, b) => a - b);
}

/** Seçili blok: sıra ve koltuk seçip o koltuğun görünümüne geçiş. */
export function BlockPanel({ block: blockIndex }: { block: number }) {
  const selectSeat = useViewer((s) => s.selectSeat);
  const backToOverview = useViewer((s) => s.backToOverview);
  const block = stadium.blocks[blockIndex];
  const rowIndices = Array.from({ length: block.rowCount }, (_, i) => block.rowStart + i);
  const [rowIndex, setRowIndex] = useState(rowIndices[0]);
  const numbers = seatNumbers(rowIndex);
  const [seatNo, setSeatNo] = useState(numbers[0]);
  const row = stadium.rows[rowIndex];
  const seat = stadium.seatIndex.get(seatKey(block.key, row.label, seatNo));

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">
            {block.label} <span className="font-normal text-lacivert/60">Blok</span>
          </h2>
          <p className="text-sm text-lacivert/70">
            {block.rowCount} sıra · {block.seatCount.toLocaleString("tr-TR")} koltuk
            {block.estimate && <span className="text-lacivert/50"> · temsili numaralar</span>}
          </p>
          {block.category && <p className="mt-0.5 text-xs font-medium text-amber-700">{categoryLabel(block.category)}</p>}
        </div>
        <button
          type="button"
          onClick={backToOverview}
          aria-label="Bloğu kapat"
          className="-mt-1 -mr-1 rounded-md px-2 py-1 text-lg leading-none text-lacivert/50 hover:bg-lacivert/5 hover:text-lacivert"
        >
          ×
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-lacivert/70">
          Sıra
          <select
            value={rowIndex}
            onChange={(e) => {
              const next = Number(e.target.value);
              setRowIndex(next);
              const nums = seatNumbers(next);
              if (!nums.includes(seatNo)) setSeatNo(nums[0]);
            }}
            className="mt-1 block w-full rounded-lg border border-lacivert/15 bg-white px-2 py-2 text-sm text-lacivert"
          >
            {rowIndices.map((i) => (
              <option key={i} value={i}>
                {stadium.rows[i].label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-lacivert/70">
          Koltuk
          <select
            value={seatNo}
            onChange={(e) => setSeatNo(Number(e.target.value))}
            className="mt-1 block w-full rounded-lg border border-lacivert/15 bg-white px-2 py-2 text-sm text-lacivert"
          >
            {numbers.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        type="button"
        disabled={seat === undefined}
        onClick={() => seat !== undefined && selectSeat(seat)}
        className="w-full rounded-xl bg-sari px-4 py-2.5 text-sm font-semibold text-lacivert shadow transition hover:brightness-95 disabled:opacity-50"
      >
        Bu koltuktan bak
      </button>
      <p className="text-xs text-lacivert/55">Ya da 3B görünümde bir koltuğa dokun.</p>
    </div>
  );
}
