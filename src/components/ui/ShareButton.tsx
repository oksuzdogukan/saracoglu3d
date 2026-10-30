"use client";

import { useState } from "react";
import { stadium } from "@/lib/stadium/instance";
import { seatSummary, seatUrlPath } from "@/lib/stadium/share";

/** Koltuğun linkini paylaşır: dokunmatik cihazda sistem paylaşımı, diğerlerinde panoya kopyalama. */
export function ShareButton({ seat }: { seat: number }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const share = async () => {
    const url = `${window.location.origin}${seatUrlPath(stadium, seat)}`;
    const title = `${seatSummary(stadium, seat).title} — koltuktan görünüm`;
    if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title, url });
      } catch {
        // Kullanıcı paylaşımı iptal etti
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 2200);
  };

  return (
    <button
      type="button"
      onClick={share}
      className="w-full rounded-xl border border-lacivert/15 bg-white px-3 py-2 text-sm font-medium text-lacivert transition hover:bg-lacivert/5"
    >
      {state === "copied" ? "Link kopyalandı ✓" : state === "failed" ? "Kopyalanamadı — adres çubuğundaki linki kullanın" : "Bu koltuğun linkini paylaş"}
    </button>
  );
}
