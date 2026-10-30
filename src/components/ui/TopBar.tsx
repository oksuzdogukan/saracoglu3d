"use client";

import { stadium } from "@/lib/stadium/instance";
import { useViewer } from "@/store/useViewer";

export function TopBar() {
  const mode = useViewer((s) => s.mode);
  const selectedBlock = useViewer((s) => s.selectedBlock);
  const backToOverview = useViewer((s) => s.backToOverview);
  const searchOpen = useViewer((s) => s.searchOpen);
  const setSearchOpen = useViewer((s) => s.setSearchOpen);
  const block = selectedBlock !== null ? stadium.blocks[selectedBlock] : null;

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 sm:p-4">
      <div className="pointer-events-auto rounded-xl bg-lacivert/90 px-3.5 py-2 text-white shadow-lg backdrop-blur">
        <h1 className="text-sm font-semibold whitespace-nowrap leading-tight sm:text-base">
          Saracoğlu <span className="text-sari">Koltuktan<span className="hidden sm:inline"> Görünüm</span></span>
        </h1>
        <p className="text-[11px] text-white/70">
          {mode === "overview" && "Genel görünüm"}
          {mode !== "overview" && block && block.label}
        </p>
      </div>
      <div className="pointer-events-auto flex gap-2">
        <button
          type="button"
          onClick={() => setSearchOpen(!searchOpen)}
          aria-pressed={searchOpen}
          className="flex items-center gap-1.5 rounded-xl bg-white/90 px-3 py-2 text-sm font-medium text-lacivert shadow-lg backdrop-blur transition hover:bg-white"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
            <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M13 13l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="hidden sm:inline">Koltuk ara</span>
        </button>
        {mode !== "overview" && (
          <button
            type="button"
            onClick={backToOverview}
            className="rounded-xl bg-white/90 px-3 py-2 text-sm font-medium text-lacivert shadow-lg backdrop-blur transition hover:bg-white"
          >
            <span className="sm:hidden">Genel</span>
            <span className="hidden sm:inline">Genel görünüm</span>
          </button>
        )}
      </div>
    </header>
  );
}
