import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StadiumApp } from "@/components/StadiumApp";
import { stadium } from "@/lib/stadium/instance";
import { resolveSeatParams, seatParams, seatSummary, type SeatParams } from "@/lib/stadium/share";

interface Props {
  params: Promise<SeatParams>;
}

/** Önceden bir örnek koltuk üretilir; diğer koltuklar ilk istekte oluşturulur (ISR). */
export function generateStaticParams(): SeatParams[] {
  return [seatParams(stadium, 0)];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const seat = resolveSeatParams(stadium, await params);
  if (seat === null) return { title: "Koltuk bulunamadı · Saracoğlu Koltuktan Görünüm" };
  const s = seatSummary(stadium, seat);
  const fmt = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
  const description = `${s.title} koltuğundan sahanın görünümü. Saha merkezine ${fmt(s.toCenter)} m, göz yüksekliği çimden ${fmt(s.eyeHeight)} m. Resmi olmayan bir taraftar projesi; görünümler yaklaşıktır.`;
  return {
    title: `${s.title} · Saracoğlu Koltuktan Görünüm`,
    description,
    openGraph: { title: `${s.title} — koltuktan görünüm`, description, type: "website", locale: "tr_TR" },
    twitter: { card: "summary_large_image", title: `${s.title} — koltuktan görünüm`, description },
  };
}

export default async function SeatPage({ params }: Props) {
  const seat = resolveSeatParams(stadium, await params);
  if (seat === null) notFound();
  return <StadiumApp initialSeat={seat} />;
}
