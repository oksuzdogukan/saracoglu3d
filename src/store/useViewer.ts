import { create } from "zustand";
import { stadium } from "@/lib/stadium/instance";

export type ViewMode = "overview" | "block" | "seat";

export interface HoverInfo {
  block: number;
  seat: number | null;
  /** Kanvasa göre ekran konumu; yalnızca 3B'den gelince (ipucu kutusu için). */
  x?: number;
  y?: number;
}

export const FOV_RANGE = { min: 30, max: 100, default: 65 } as const;
export const EYE_RANGE = { min: 0.9, max: 1.8 } as const;

interface ViewerState {
  mode: ViewMode;
  hover: HoverInfo | null;
  selectedBlock: number | null;
  selectedSeat: number | null;
  /** Koltuk görünümündeki dikey görüş açısı (derece). */
  fov: number;
  /** Basamak zemininden göz yüksekliği (m). */
  eyeHeight: number;
  /** Kamera uçuşu sürüyor mu (bu sırada etkileşim kapalı). */
  flying: boolean;
  searchOpen: boolean;
  mapOpen: boolean;
  /** Mobilde koltuk görünümünde panel küçültülür ki görüş kapanmasın. */
  panelCollapsed: boolean;
  setPanelCollapsed: (collapsed: boolean) => void;
  setHover: (hover: HoverInfo | null) => void;
  selectBlock: (block: number) => void;
  selectSeat: (seat: number) => void;
  backToBlock: () => void;
  backToOverview: () => void;
  stepBack: () => void;
  setFov: (fov: number) => void;
  setEyeHeight: (height: number) => void;
  setFlying: (flying: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  setMapOpen: (open: boolean) => void;
  /** Esc: önce açık katmanı kapatır, yoksa bir adım geri gider. */
  escape: () => void;
}

const isNarrow = () => typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const useViewer = create<ViewerState>((set, get) => ({
  mode: "overview",
  hover: null,
  selectedBlock: null,
  selectedSeat: null,
  fov: FOV_RANGE.default,
  eyeHeight: stadium.data.defaults.eyeHeight,
  flying: false,
  searchOpen: false,
  mapOpen: false,
  panelCollapsed: false,
  setPanelCollapsed: (panelCollapsed) => set({ panelCollapsed }),
  setHover: (hover) => {
    const prev = get().hover;
    if (prev === hover) return;
    if (prev && hover && prev.block === hover.block && prev.seat === hover.seat && prev.x === hover.x && prev.y === hover.y) return;
    set({ hover });
  },
  selectBlock: (block) => set({ mode: "block", selectedBlock: block, selectedSeat: null, hover: null, panelCollapsed: false }),
  selectSeat: (seat) =>
    set({ mode: "seat", selectedSeat: seat, selectedBlock: stadium.seats.block[seat], hover: null, panelCollapsed: isNarrow() }),
  backToBlock: () => set((s) => (s.selectedBlock === null ? { mode: "overview" } : { mode: "block", hover: null, panelCollapsed: false })),
  backToOverview: () => set({ mode: "overview", selectedBlock: null, selectedSeat: null, hover: null, panelCollapsed: false }),
  stepBack: () => {
    const { mode } = get();
    if (mode === "seat") get().backToBlock();
    else if (mode === "block") get().backToOverview();
  },
  setFov: (fov) => set({ fov: clamp(fov, FOV_RANGE.min, FOV_RANGE.max) }),
  setEyeHeight: (eyeHeight) => set({ eyeHeight: clamp(eyeHeight, EYE_RANGE.min, EYE_RANGE.max) }),
  setFlying: (flying) => set({ flying }),
  setSearchOpen: (searchOpen) => set({ searchOpen, mapOpen: false }),
  setMapOpen: (mapOpen) => set({ mapOpen, searchOpen: false }),
  escape: () => {
    const s = get();
    if (s.searchOpen) s.setSearchOpen(false);
    else if (s.mapOpen) s.setMapOpen(false);
    else s.stepBack();
  },
}));
