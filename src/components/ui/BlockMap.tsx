"use client";

import { useState } from "react";
import { categoryLabel, CATEGORY_FILLS, CATEGORY_LABELS } from "@/lib/stadium/categories";
import { stadium } from "@/lib/stadium/instance";
import { buildPlan } from "@/lib/stadium/plan";
import { useViewer } from "@/store/useViewer";

/** Veri dosyasından üretilen plan; stadium.json değişince modülle birlikte yeniden hesaplanır. */
const plan = buildPlan(stadium);

function describe(index: number): string {
  const b = stadium.blocks[index];
  const category = categoryLabel(b.category);
  return `${b.label} · ${b.rowCount} sıra · ${b.seatCount.toLocaleString("tr-TR")} koltuk${category ? ` · ${category}` : ""}`;
}

/**
 * 2D blok haritası. Haritada üzerine gelinen blok 3B sahnede de vurgulanır;
 * dokunmak bloğu seçer.
 */
export function BlockMap({ onPick }: { onPick?: (block: number) => void }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const selected = useViewer((s) => (s.mode === "overview" ? null : s.selectedBlock));
  const selectBlock = useViewer((s) => s.selectBlock);
  const setHover = useViewer((s) => s.setHover);
  const [vx, vy, vw, vh] = plan.viewBox;

  const enter = (index: number) => {
    setHovered(index);
    setHover({ block: index, seat: null });
  };
  const leave = () => {
    setHovered(null);
    setHover(null);
  };
  const pick = (index: number) => {
    leave();
    selectBlock(index);
    onPick?.(index);
  };

  return (
    <div>
      <svg viewBox={`${vx} ${vy} ${vw} ${vh}`} className="block h-auto w-full touch-manipulation select-none" role="group" aria-label="Stat blok haritası">
        <rect x={-plan.pitch.halfX - 6} y={-plan.pitch.halfZ - 5} width={plan.pitch.halfX * 2 + 12} height={plan.pitch.halfZ * 2 + 10} rx={3} fill="#3f7a31" />
        <rect x={-plan.pitch.halfX} y={-plan.pitch.halfZ} width={plan.pitch.halfX * 2} height={plan.pitch.halfZ * 2} fill="none" stroke="#ffffff" strokeOpacity={0.8} strokeWidth={0.6} />
        <path d={plan.pitch.lines} fill="none" stroke="#ffffff" strokeOpacity={0.8} strokeWidth={0.6} />
        {plan.blocks.map((b) => {
          const block = stadium.blocks[b.index];
          const active = hovered === b.index;
          const isSelected = selected === b.index;
          return (
            <g
              key={b.index}
              role="button"
              tabIndex={0}
              aria-label={describe(b.index)}
              className="cursor-pointer outline-none"
              onPointerEnter={() => enter(b.index)}
              onPointerLeave={leave}
              onFocus={() => enter(b.index)}
              onBlur={leave}
              onClick={() => pick(b.index)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  pick(b.index);
                }
              }}
            >
              <path
                d={b.path}
                fill={b.fill}
                stroke={isSelected ? "#f5c400" : active ? "#7fb2ff" : "#ffffff"}
                strokeWidth={isSelected || active ? 1.6 : 0.5}
                strokeLinejoin="round"
              />
              <text
                x={b.labelX}
                y={b.labelY}
                fontSize={b.labelSize}
                fontWeight={700}
                textAnchor="middle"
                dominantBaseline="central"
                fill={b.textColor}
                pointerEvents="none"
              >
                {block.id}
              </text>
            </g>
          );
        })}
        {plan.standLabels.map((l) => (
          <text
            key={l.text}
            x={l.x}
            y={l.y}
            fontSize={5.5}
            fontWeight={700}
            letterSpacing={0.6}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#0b1f4b"
            fillOpacity={0.55}
            transform={l.rotate ? `rotate(${l.rotate} ${l.x} ${l.y})` : undefined}
            pointerEvents="none"
          >
            {l.text}
          </text>
        ))}
      </svg>
      <p className="mt-1.5 min-h-[2.5em] text-xs text-lacivert/70" aria-live="polite">
        {hovered !== null ? describe(hovered) : "Bir bloğa dokunun ya da üzerine gelin."}
      </p>
    </div>
  );
}

/** Haritadaki özel renkler için açıklama. */
export function MapLegend() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-lacivert/60">
      {Object.entries(CATEGORY_FILLS).map(([key, fill]) => (
        <span key={key} className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: fill }} />
          {CATEGORY_LABELS[key]}
        </span>
      ))}
    </div>
  );
}
