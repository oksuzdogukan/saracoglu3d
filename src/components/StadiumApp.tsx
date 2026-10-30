"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { stadium } from "@/lib/stadium/instance";
import { seatUrlPath } from "@/lib/stadium/share";
import { useViewer } from "@/store/useViewer";
import { HoverTooltip } from "./ui/HoverTooltip";
import { MapOverlay } from "./ui/MapOverlay";
import { Panel } from "./ui/Panel";
import { SearchPanel } from "./ui/SearchPanel";
import { TopBar } from "./ui/TopBar";

const Scene = dynamic(() => import("./scene/Scene"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center text-sm text-lacivert/70">Stat yükleniyor…</div>
  ),
});

/** initialSeat: paylaşım linkinden gelindiyse açılışta uçulacak koltuk. */
export function StadiumApp({ initialSeat }: { initialSeat?: number }) {
  // Adres çubuğu seçili koltuğu izler; sayfa yeniden yüklenmez, sahne korunur
  useEffect(() => {
    const sync = (s: ReturnType<typeof useViewer.getState>) => {
      const path = s.mode === "seat" && s.selectedSeat !== null ? seatUrlPath(stadium, s.selectedSeat) : "/";
      if (window.location.pathname !== path) window.history.replaceState(null, "", path);
    };
    return useViewer.subscribe((s, prev) => {
      if (s.mode !== prev.mode || s.selectedSeat !== prev.selectedSeat) sync(s);
    });
  }, []);

  // Abonelikten sonra çalışır: linkle gelindiyse adres kanonik biçime de çevrilir (…/e/… → …/E/…)
  useEffect(() => {
    if (initialSeat !== undefined) useViewer.getState().selectSeat(initialSeat);
  }, [initialSeat]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") useViewer.getState().escape();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-dvh flex-col bg-sky-100">
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className="absolute inset-0">
          <Scene />
        </div>
        <TopBar />
        <HoverTooltip />
        <Panel />
        <SearchPanel />
        <MapOverlay />
      </div>
      <footer className="shrink-0 bg-lacivert px-3 py-1.5 text-center text-[11px] text-white/75">
        Resmi olmayan bir taraftar projesidir. Görünümler yaklaşıktır.
      </footer>
    </div>
  );
}
