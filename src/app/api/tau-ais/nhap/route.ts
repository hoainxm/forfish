// POST /api/tau-ais/nhap — MÁY THU AIS (gpu-desktop, scripts/tau-ais-thu.mjs) gửi một BẢN vị trí
// tàu quanh biển VN mỗi ~10 phút. Cửa: `x-tau-ais-key` (lib/tau-ais/khoa). Máy chủ kiểm lại từng
// hàng (lib/tau-ais/chuan-hoa kiemGoi) rồi GHI ĐÈ một khoá snapshot `tau-ais:latest` trong bảng
// snapshot chung (`weather_snapshot`, lib/weather-snapshot — không thêm bảng mới). Client đọc ở
// GET /api/tau-ais. Gói: { luc: iso, tau: [{ id, ten, loai, co, lat, lon, kn, huong, mui, phut, dai, dich }] }.
// THÂN NÉN (2026-10-29, vùng quét cả Biển Đông ~25–30 nghìn tàu): Vercel chặn thân request > 4,5 MB ⇒ máy thu gửi
// `content-encoding: gzip`; ở đây tự giải (vẫn nhận thân thường cho máy thu đời cũ). Trần sau giải nén 40 MB.
import { kiemGoi, thamSoVet } from "@/lib/tau-ais/chuan-hoa.mjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { tauAisKeyDenied } from "@/lib/tau-ais/khoa";
import { TAU_AIS_SNAPSHOT_ID } from "@/lib/tau-ais";
import { saveWeatherSnapshot } from "@/lib/weather-snapshot";
import { banGoiCanGhi, banGoiId, GOI_DOI_TAC } from "@/lib/doi-tac";
import { gunzipSync } from "node:zlib";

const TRAN_GIAI_NEN = 40 * 1024 * 1024;

/** Đọc thân JSON, giải gzip khi máy thu báo nén. Hỏng / quá trần ⇒ null (route trả 400). */
async function docThan(req: Request): Promise<unknown> {
  try {
    const buf = Buffer.from(await req.arrayBuffer());
    const nen = /gzip/i.test(req.headers.get("content-encoding") ?? "");
    const raw = nen ? gunzipSync(buf, { maxOutputLength: TRAN_GIAI_NEN }) : buf;
    return JSON.parse(raw.toString("utf8"));
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  const denied = await tauAisKeyDenied(req);
  if (denied) return denied;
  const body = await docThan(req);
  const r = kiemGoi(body);
  if (!r.ok || !r.ban) return Response.json({ ok: false, code: r.code ?? "bad_body" }, { status: 400 });
  const saved = await saveWeatherSnapshot(TAU_AIS_SNAPSHOT_ID, r.ban);
  if (!saved) return Response.json({ ok: false, code: "store_down" }, { status: 503 });
  /*  LỘ TRÌNH 7 NGÀY (2026-10-29, bảng tau_ais_vet): ghi một điểm/tàu/giờ — hàm SQL tự bỏ qua khi giờ này đã ghi
      (máy thu gửi ~10 phút/lần), tự xoá ngày cũ hơn 7 ngày. Hỏng thì chỉ log: bản vị trí hiện tại đã lưu ở trên. */
  const tsv = thamSoVet(r.ban);
  const admin = tsv ? createAdminClient() : null;
  let vet: number | null = null;
  if (admin && tsv) {
    const { data, error } = await admin.rpc("ghi_vet_ais", tsv);
    if (error) console.error("[tàu AIS] ghi lộ trình hỏng:", error.message);
    else vet = typeof data === "number" ? data : null;
  }
  /*  BẢN THEO GÓI API ĐỐI TÁC (2026-11-02, báo giá BG-AIS-2026-01: gói 60 / 30 phút): chép bản này sang `tau-ais:goi-N` khi
      bản gói đã cũ hơn chu kỳ − 5 phút (lib/doi-tac banGoiCanGhi). Chỉ hỏi cột updated_at (không kéo vài MB payload).
      Hỏng thì chỉ log — bản cho app đã lưu ở trên, đối tác đọc bản gói cũ thêm một nhịp. */
  const goiGhi: number[] = [];
  const adminGoi = admin ?? createAdminClient();
  if (adminGoi) {
    const { data: moc, error } = await adminGoi
      .from("weather_snapshot")
      .select("id, updated_at")
      .in("id", GOI_DOI_TAC.map(banGoiId));
    if (error) console.error("[tàu AIS] đọc mốc bản gói hỏng:", error.message);
    else {
      const now = Date.now();
      for (const goi of GOI_DOI_TAC) {
        const dong = (moc as { id: string; updated_at: string }[]).find((d) => d.id === banGoiId(goi));
        if (banGoiCanGhi(dong?.updated_at, now, goi) && (await saveWeatherSnapshot(banGoiId(goi), r.ban))) goiGhi.push(goi);
      }
    }
  }
  return Response.json({ ok: true, soTau: r.ban.soTau, luc: r.ban.luc, vet, goiGhi });
}
