"use client";

import { useViewer } from "@/store/useViewer";
import { BlockMap, MapLegend } from "./BlockMap";

/** Büyütülmüş blok haritası: masaüstünde ortada, mobilde tam ekran. */
export function MapOverlay() {
  const open = useViewer((s) => s.mapOpen);
  const setMapOpen = useViewer((s) => s.setMapOpen);
  if (!open) return null;
  const close = () => setMapOpen(false);

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-lacivert/50 p-2 backdrop-blur-sm sm:p-8" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Blok haritası"
        className="max-h-full w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-3 text-lacivert shadow-2xl sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold">Blok haritası</h2>
          <button
            type="button"
            onClick={close}
            aria-label="Haritayı kapat"
            className="rounded-md px-2 py-1 text-lg leading-none text-lacivert/50 hover:bg-lacivert/5 hover:text-lacivert"
          >
            ×
          </button>
        </div>
        <BlockMap onPick={close} />
        <MapLegend />
      </div>
    </div>
  );
}
