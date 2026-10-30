"use client";

import { stadium } from "@/lib/stadium/instance";
import { useViewer } from "@/store/useViewer";

/** Tribün tribün blok listesi. Üst kat üstte, alt kat altta. */
export function BlockPicker() {
  const selectBlock = useViewer((s) => s.selectBlock);
  const tiersTopDown = [...stadium.tiers].reverse();
  const modeled = stadium.stands.filter((s) => stadium.blocks.some((b) => b.stand === s.index));
  const pending = stadium.stands.filter((s) => !modeled.includes(s));

  return (
    <div className="space-y-4">
      {modeled.map((stand) => (
        <section key={stand.id} className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wide text-lacivert/60 uppercase">{stand.name} Tribünü</h3>
          {tiersTopDown.map((tier) => {
            const blocks = stadium.blocks.filter((b) => b.stand === stand.index && b.tier === tier.index);
            if (!blocks.length) return null;
            return (
              <div key={tier.id} className="flex items-center gap-2">
                <span className="w-8 shrink-0 text-xs text-lacivert/60">{tier.name}</span>
                <div className="flex flex-wrap gap-1">
                  {blocks.map((b) => (
                    <button
                      key={b.key}
                      type="button"
                      onClick={() => selectBlock(b.index)}
                      title={`${b.label} · ${b.seatCount.toLocaleString("tr-TR")} koltuk`}
                      className="h-8 w-8 rounded-md bg-lacivert/8 text-sm font-semibold transition hover:bg-sari hover:text-lacivert focus-visible:ring-2 focus-visible:ring-sari focus-visible:outline-none"
                    >
                      {b.id}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      ))}
      {pending.length > 0 && (
        <p className="text-xs text-lacivert/50">
          {pending.map((s) => s.name).join(", ")} tribünleri sonraki aşamada eklenecek.
        </p>
      )}
    </div>
  );
}
