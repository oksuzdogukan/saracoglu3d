"use client";

import { categoryLabel } from "@/lib/stadium/categories";
import { stadium } from "@/lib/stadium/instance";
import { EYE_RANGE, FOV_RANGE, useViewer } from "@/store/useViewer";
import { ShareButton } from "./ShareButton";

const fmt = (n: number, digits = 0) => n.toLocaleString("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Koltuk görünümü: görüş açısı, göz yüksekliği ve geri dönüş. */
export function SeatViewPanel() {
  const seat = useViewer((s) => s.selectedSeat);
  const fov = useViewer((s) => s.fov);
  const eyeHeight = useViewer((s) => s.eyeHeight);
  const setFov = useViewer((s) => s.setFov);
  const setEyeHeight = useViewer((s) => s.setEyeHeight);
  const backToBlock = useViewer((s) => s.backToBlock);
  const backToOverview = useViewer((s) => s.backToOverview);
  if (seat === null) return null;

  const { seats, blocks, rows, data } = stadium;
  const block = blocks[seats.block[seat]];
  const row = rows[seats.row[seat]];
  const toCenter = Math.hypot(seats.x[seat], seats.z[seat]);
  const eyeAbovePitch = seats.y[seat] + eyeHeight;
  const seated = data.defaults.eyeHeight;
  const standing = data.defaults.standingEyeHeight;

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">
          {block.label} · Sıra {row.label} · Koltuk {seats.number[seat]}
        </h2>
        <p className="text-sm text-lacivert/70">
          Saha merkezine {fmt(toCenter)} m · gözün çimden yüksekliği {fmt(eyeAbovePitch, 1)} m
        </p>
        {block.category && <p className="mt-0.5 text-xs font-medium text-amber-700">{categoryLabel(block.category)}</p>}
      </div>

      <label className="block text-xs text-lacivert/70">
        <span className="flex justify-between">
          <span>Görüş açısı</span>
          <span className="font-medium text-lacivert">{fmt(fov)}°</span>
        </span>
        <input
          type="range"
          min={FOV_RANGE.min}
          max={FOV_RANGE.max}
          step={1}
          value={fov}
          onChange={(e) => setFov(Number(e.target.value))}
          className="mt-1 w-full accent-lacivert"
        />
      </label>

      <div className="text-xs text-lacivert/70">
        <label className="block">
          <span className="flex justify-between">
            <span>Göz yüksekliği (basamaktan)</span>
            <span className="font-medium text-lacivert">{fmt(eyeHeight, 2)} m</span>
          </span>
          <input
            type="range"
            min={EYE_RANGE.min}
            max={EYE_RANGE.max}
            step={0.05}
            value={eyeHeight}
            onChange={(e) => setEyeHeight(Number(e.target.value))}
            className="mt-1 w-full accent-lacivert"
          />
        </label>
        <div className="mt-1.5 flex gap-1.5">
          {[
            { label: "Oturarak", value: seated },
            { label: "Ayakta", value: standing },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setEyeHeight(o.value)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                Math.abs(eyeHeight - o.value) < 0.01 ? "bg-lacivert text-white" : "bg-lacivert/8 text-lacivert hover:bg-lacivert/15"
              }`}
            >
              {o.label} {fmt(o.value, 1)} m
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          type="button"
          onClick={backToBlock}
          className="rounded-xl bg-lacivert/8 px-3 py-2 text-sm font-medium text-lacivert transition hover:bg-lacivert/15"
        >
          Bloğa dön
        </button>
        <button
          type="button"
          onClick={backToOverview}
          className="rounded-xl bg-sari px-3 py-2 text-sm font-semibold text-lacivert transition hover:brightness-95"
        >
          Genel görünüm
        </button>
      </div>
      <ShareButton seat={seat} />
      <p className="text-xs text-lacivert/55">
        Sürükleyerek etrafına bak · tekerlek ya da iki parmakla görüş açısını değiştir · Esc ile geri
      </p>
    </div>
  );
}
