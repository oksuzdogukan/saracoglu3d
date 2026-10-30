"use client";

import { useViewer } from "@/store/useViewer";
import { BlockMap, MapLegend } from "./BlockMap";
import { BlockPicker } from "./BlockPicker";

/** Genel görünüm paneli: blok haritası, arama ve liste. */
export function OverviewPanel() {
  const setMapOpen = useViewer((s) => s.setMapOpen);
  const setSearchOpen = useViewer((s) => s.setSearchOpen);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Koltuğunu bul</h2>
          <p className="mt-0.5 text-sm text-lacivert/70">Haritada ya da statta bir bloğa dokun.</p>
        </div>
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="shrink-0 rounded-lg bg-sari px-3 py-1.5 text-sm font-semibold transition hover:brightness-95"
        >
          Ara
        </button>
      </div>
      <div className="relative">
        <BlockMap />
        <button
          type="button"
          onClick={() => setMapOpen(true)}
          className="absolute top-0 right-0 rounded-md bg-white/85 px-2 py-1 text-xs font-medium text-lacivert shadow-sm hover:bg-white"
        >
          Büyüt
        </button>
      </div>
      <MapLegend />
      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-lacivert/80 select-none">Listeden seç</summary>
        <div className="mt-2">
          <BlockPicker />
        </div>
      </details>
    </div>
  );
}
