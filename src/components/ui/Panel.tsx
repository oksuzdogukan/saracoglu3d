"use client";

import { stadium } from "@/lib/stadium/instance";
import { seatSummary } from "@/lib/stadium/share";
import { useViewer } from "@/store/useViewer";
import { BlockPanel } from "./BlockPanel";
import { OverviewPanel } from "./OverviewPanel";
import { SeatViewPanel } from "./SeatViewPanel";

/** Masaüstünde sağda kart, mobilde alttan açılan panel. */
export function Panel() {
  const mode = useViewer((s) => s.mode);
  const selectedBlock = useViewer((s) => s.selectedBlock);
  const selectedSeat = useViewer((s) => s.selectedSeat);
  const collapsed = useViewer((s) => s.panelCollapsed);
  const setCollapsed = useViewer((s) => s.setPanelCollapsed);
  const seatMode = mode === "seat" && selectedSeat !== null;

  return (
    <aside className="absolute inset-x-0 bottom-0 z-20 max-h-[55%] overflow-y-auto rounded-t-2xl bg-white/95 p-4 text-lacivert shadow-2xl backdrop-blur sm:inset-x-auto sm:top-20 sm:right-4 sm:bottom-auto sm:max-h-[calc(100%-6rem)] sm:w-80 sm:rounded-2xl">
      {seatMode && (
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-expanded={!collapsed}
          className="-mt-1 mb-2 flex w-full items-center justify-between gap-2 text-left sm:hidden"
        >
          <span className="truncate text-sm font-semibold">{collapsed ? seatSummary(stadium, selectedSeat).title : "Koltuk görünümü"}</span>
          <span className="shrink-0 rounded-md bg-lacivert/8 px-2 py-1 text-xs font-medium">{collapsed ? "Ayarlar ▴" : "Gizle ▾"}</span>
        </button>
      )}
      <div className={seatMode && collapsed ? "hidden sm:block" : undefined}>
        {mode === "overview" && <OverviewPanel />}
        {mode === "block" && selectedBlock !== null && <BlockPanel key={selectedBlock} block={selectedBlock} />}
        {mode === "seat" && <SeatViewPanel />}
      </div>
    </aside>
  );
}
