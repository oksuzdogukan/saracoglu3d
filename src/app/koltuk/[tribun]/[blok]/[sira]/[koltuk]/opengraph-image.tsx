import { ImageResponse } from "next/og";
import { stadium } from "@/lib/stadium/instance";
import { buildPlan, planToSvg } from "@/lib/stadium/plan";
import { resolveSeatParams, seatSummary, type SeatParams } from "@/lib/stadium/share";

export const alt = "Saracoğlu stadyum planında seçilen koltuk";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const plan = buildPlan(stadium);

/** Link önizlemesi: stadyum planında koltuğun yeri ve koltuk bilgisi. */
export default async function Image({ params }: { params: Promise<SeatParams> }) {
  const seat = resolveSeatParams(stadium, await params);
  const s = seat !== null ? seatSummary(stadium, seat) : null;
  const svg = planToSvg(plan, {
    width: 600,
    height: 520,
    highlight: seat !== null ? stadium.seats.block[seat] : undefined,
    marker: seat !== null ? { x: stadium.seats.x[seat], z: stadium.seats.z[seat] } : undefined,
  });
  const fmt = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 0 });

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#0b1f4b", color: "#ffffff", padding: 48 }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 500 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 28, color: "#f5c400" }}>Saracoğlu Koltuktan Görünüm</div>
            {s ? (
              <div style={{ display: "flex", flexDirection: "column", marginTop: 36 }}>
                <div style={{ fontSize: 60, lineHeight: 1.1 }}>{`${s.standName} ${s.tierName}`}</div>
                <div style={{ fontSize: 60, lineHeight: 1.1 }}>{`${s.blockId} Blok`}</div>
                <div style={{ fontSize: 44, marginTop: 16, color: "#dbe4f5" }}>{`Sıra ${s.rowLabel} · Koltuk ${s.number}`}</div>
                {s.category ? <div style={{ fontSize: 28, marginTop: 12, color: "#f5c400" }}>{s.category}</div> : null}
                <div style={{ fontSize: 26, marginTop: 28, color: "#aab8d6" }}>
                  {`Merkeze ${fmt(s.toCenter)} m · çimden ${fmt(s.eyeHeight)} m yukarıda`}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 52, marginTop: 36 }}>Koltuk bulunamadı</div>
            )}
          </div>
          <div style={{ fontSize: 20, color: "#8b9bc0" }}>Resmi olmayan bir taraftar projesidir. Görünümler yaklaşıktır.</div>
        </div>
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center" }}>
          <img width={600} height={520} src={`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`} alt="" />
        </div>
      </div>
    ),
    size,
  );
}
