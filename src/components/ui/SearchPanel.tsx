"use client";

import { useMemo, useState } from "react";
import { seatKey } from "@/lib/stadium/ids";
import { stadium } from "@/lib/stadium/instance";
import { blockRows, rowNumbers, searchSeat } from "@/lib/stadium/search";
import { useViewer } from "@/store/useViewer";

/** Tribün-kat seçenekleri ("Maraton Üst" → maraton-ust), tanımlı blokları olanlar. */
const tierOptions = stadium.stands.flatMap((stand) =>
  [...stadium.tiers].reverse().flatMap((tier) => {
    const blocks = stadium.blocks.filter((b) => b.stand === stand.index && b.tier === tier.index);
    return blocks.length ? [{ slug: blocks[0].slug, label: `${stand.name} ${tier.name}`, blocks }] : [];
  }),
);

/** Koltuk arama: serbest metin ya da adım adım seçim. İkisi de aynı koltuğa gider. */
export function SearchPanel() {
  const open = useViewer((s) => s.searchOpen);
  if (!open) return null;
  return <SearchCard />;
}

function SearchCard() {
  const setSearchOpen = useViewer((s) => s.setSearchOpen);
  const selectSeat = useViewer((s) => s.selectSeat);
  const selectBlock = useViewer((s) => s.selectBlock);
  const [text, setText] = useState("");
  const result = useMemo(() => searchSeat(stadium, text), [text]);

  const goSeat = (seat: number) => {
    setSearchOpen(false);
    selectSeat(seat);
  };
  const go = () => {
    if (result.seat !== null) goSeat(result.seat);
    else if (result.block !== null) {
      setSearchOpen(false);
      selectBlock(result.block);
    }
  };
  const resolved =
    result.seat !== null
      ? `${stadium.blocks[result.block!].label} · Sıra ${result.rowLabel} · Koltuk ${result.seatNumber}`
      : null;

  return (
    <div
      role="dialog"
      aria-label="Koltuk ara"
      className="absolute inset-x-2 top-[4.5rem] z-30 max-h-[calc(100%-5rem)] overflow-y-auto rounded-2xl bg-white/97 p-4 text-lacivert shadow-2xl sm:right-auto sm:left-4 sm:w-96"
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-base font-semibold">Koltuk ara</h2>
        <button
          type="button"
          onClick={() => setSearchOpen(false)}
          aria-label="Aramayı kapat"
          className="rounded-md px-2 py-1 text-lg leading-none text-lacivert/50 hover:bg-lacivert/5 hover:text-lacivert"
        >
          ×
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
      >
        <div className="flex gap-2">
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Örn. Maraton Üst A 12 7"
            aria-label="Tribün, kat, blok, sıra ve koltuk"
            enterKeyHint="go"
            className="min-w-0 flex-1 rounded-lg border border-lacivert/15 bg-white px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={result.seat === null && result.block === null}
            className="rounded-lg bg-sari px-3 py-2 text-sm font-semibold transition hover:brightness-95 disabled:opacity-40"
          >
            Git
          </button>
        </div>
      </form>
      <div className="mt-1.5 min-h-[1.25rem] text-xs" aria-live="polite">
        {resolved ? <span className="font-medium text-lacivert">→ {resolved}</span> : <span className="text-lacivert/60">{result.message}</span>}
      </div>
      {result.blocks.length > 1 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {result.blocks.slice(0, 12).map((i) => {
            const b = stadium.blocks[i];
            const query = [stadium.stands[b.stand].name, stadium.tiers[b.tier].name, b.id, result.rowLabel, result.seatNumber]
              .filter((v) => v !== null)
              .join(" ");
            return (
              <button
                key={i}
                type="button"
                onClick={() => setText(query)}
                className="rounded-md bg-lacivert/8 px-2 py-1 text-xs font-medium hover:bg-sari"
              >
                {b.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="my-3 flex items-center gap-2 text-[11px] text-lacivert/45">
        <span className="h-px flex-1 bg-lacivert/10" />
        ya da adım adım seç
        <span className="h-px flex-1 bg-lacivert/10" />
      </div>
      <StepPicker onGo={goSeat} />
    </div>
  );
}

function StepPicker({ onGo }: { onGo: (seat: number) => void }) {
  const [slug, setSlug] = useState(tierOptions[0]?.slug ?? "");
  const option = tierOptions.find((o) => o.slug === slug) ?? tierOptions[0];
  const [blockIndex, setBlockIndex] = useState(option.blocks[0].index);
  const block = stadium.blocks[blockIndex];
  const rows = blockRows(stadium, block);
  const [rowIndex, setRowIndex] = useState(0);
  const row = rows[Math.min(rowIndex, rows.length - 1)];
  const numbers = rowNumbers(stadium, row.seatStart, row.seatCount);
  const [seatNo, setSeatNo] = useState(numbers[0]);
  const number = numbers.includes(seatNo) ? seatNo : numbers[0];
  const seat = stadium.seatIndex.get(seatKey(block.key, row.label, number));

  const field = "mt-1 block w-full rounded-lg border border-lacivert/15 bg-white px-2 py-2 text-sm text-lacivert";
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-lacivert/70">
          Tribün
          <select
            value={slug}
            onChange={(e) => {
              const next = tierOptions.find((o) => o.slug === e.target.value)!;
              setSlug(next.slug);
              setBlockIndex(next.blocks[0].index);
              setRowIndex(0);
            }}
            className={field}
          >
            {tierOptions.map((o) => (
              <option key={o.slug} value={o.slug}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-lacivert/70">
          Blok
          <select
            value={blockIndex}
            onChange={(e) => {
              setBlockIndex(Number(e.target.value));
              setRowIndex(0);
            }}
            className={field}
          >
            {option.blocks.map((b) => (
              <option key={b.index} value={b.index}>
                {b.id}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-lacivert/70">
          Sıra
          <select value={rowIndex} onChange={(e) => setRowIndex(Number(e.target.value))} className={field}>
            {rows.map((r, i) => (
              <option key={r.label} value={i}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-lacivert/70">
          Koltuk
          <select value={number} onChange={(e) => setSeatNo(Number(e.target.value))} className={field}>
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
        onClick={() => seat !== undefined && onGo(seat)}
        className="w-full rounded-xl bg-lacivert px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-lacivert/90 disabled:opacity-50"
      >
        Bu koltuktan bak
      </button>
    </div>
  );
}
