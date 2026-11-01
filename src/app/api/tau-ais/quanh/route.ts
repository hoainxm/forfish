// GET /api/tau-ais/quanh?lat=&lon= — TÀU ĐÃ PHÁT AIS TRONG 6 HẢI LÝ QUANH MỘT ĐIỂM, 6 GIỜ QUA (2026-10-31; lib/tau-ais-quanh).
// Gác ở middleware như /api/tau-ais (feature "ais" — tài khoản được bật). Bán kính/giờ CỐ ĐỊNH ở máy chủ (không nhận
// tham số) ⇒ không ai xin vòng 500 hải lý để kéo cả bảng.
// Lộ trình theo giờ (hàm SQL tau_ais_quanh, migration 0078) + bản mới nhất (tên/loại, tin ~10 phút). Hàm hỏng / chưa áp
// ⇒ vẫn trả 200 với `chiBan: true` (chỉ tàu còn trong bản) — nói thật ở UI, không giả là đủ 6 giờ. Cả hai hỏng ⇒ 503.
import { TAU_AIS_SNAPSHOT_ID, type TauAisBan } from "@/lib/tau-ais";
import { QUANH_GIO, QUANH_NM, gopTauQuanh, tamHopLe, thamSoQuanh, type DongVetQuanh } from "@/lib/tau-ais-quanh";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadWeatherSnapshot } from "@/lib/weather-snapshot";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const lat = Number(sp.get("lat"));
  const lon = Number(sp.get("lon"));
  if (!sp.get("lat") || !sp.get("lon") || !tamHopLe(lat, lon)) return Response.json({ ok: false, code: "bad_point" }, { status: 400 });
  const tam = { lat, lon };
  const now = Date.now();
  const ts = thamSoQuanh(tam, now);

  const admin = createAdminClient();
  const [snap, vetKq] = await Promise.all([
    loadWeatherSnapshot(TAU_AIS_SNAPSHOT_ID, { noStore: true }),
    admin ? admin.rpc("tau_ais_quanh", ts) : Promise.resolve({ data: null, error: { message: "no_admin" } }),
  ]);
  const ban = (snap.payload as TauAisBan | null) ?? null;
  const banHopLe = !!ban && Array.isArray(ban.tau) && typeof ban.luc === "string";
  if (vetKq.error) console.error("[tàu AIS] tàu quanh điểm — đọc lộ trình hỏng:", vetKq.error.message);
  const vet = !vetKq.error && Array.isArray(vetKq.data) ? (vetKq.data as DongVetQuanh[]) : null;
  if (!vet && !banHopLe) return Response.json({ ok: false, code: "source_down" }, { status: 503 });

  const tau = gopTauQuanh({ vet: vet ?? [], ban: banHopLe ? ban : null, tam, tuGiay: ts.p_tu });
  return Response.json(
    { ok: true, nm: QUANH_NM, gio: QUANH_GIO, luc: banHopLe ? ban!.luc : null, chiBan: !vet, tau },
    { headers: { "cache-control": "public, s-maxage=120, stale-while-revalidate=600" } },
  );
}
