// POST /api/kairos/nhap — MÁY THU TIN (gpu-desktop, scripts/kairos-thu.mjs) GỬI BÀI BÁO ĐÃ
// TÓM TẮT (14 §9, AC17/AC18/AC21).
//
// Cửa: header `x-kairos-key` (ingestKeyDenied — so thời-gian-hằng; thiếu khoá ở cả env lẫn
// app_config ⇒ 503, sai ⇒ 401). Gói ≤50 bài (+ trạng thái nguồn). Máy chủ CHẠY LẠI chặn trùng
// link (vĩnh viễn) + tiêu đề (7 ngày) + chủ quyền + chủ đề + khu vực bằng cùng hàm .mjs
// (lib/kairos/ingest.ts planIngest) — không tin máy thu. Bài vào `cho-kiem`: CHỈ lên dòng tin khi
// agent kiểm duyệt cho đạt (AC24a).
//
// Hợp đồng gói (máy thu phải theo):
//   { items: [{ sourceId, outlet, url, title, description?, summary?, summaryBy: "ai"|"rss",
//               coverUrl?, section, publishedAt? }],
//     sources?: [{ id, outlet, feedUrl, section, topic, ok, error? }] }
// Trả { ok, inserted, stats: {nhan, trungLink, trungTieuDe, chuQuyen, linkHong}, invalid }.
import { NextResponse } from "next/server";
import { FISHING_PORTS } from "@/data/fishing-ports";
import { urlHash, titleNorm } from "@/lib/kairos/lien-ket.mjs";
import { parseIngestBody, planIngest, sourceRows, titleWindowStart } from "@/lib/kairos/ingest";
import { auditQuiet, ingestKeyDenied, jsonBody, kErr, kairosErrorResponse, storeOr503 } from "@/lib/kairos/server";

export async function POST(req: Request) {
  const denied = await ingestKeyDenied(req);
  if (denied) return denied;
  const parsed = parseIngestBody(await jsonBody(req));
  if (!parsed.ok) return kErr(400, parsed.code);
  const s = await storeOr503();
  if (!s.ok) return s.res;
  const { store } = s;
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  try {
    const hashes = parsed.items.map((i) => urlHash(i.url)).filter((h): h is string => !!h);
    const norms = parsed.items.map((i) => titleNorm(i.title)).filter((t): t is string => !!t);
    const [seenHashes, recentTitles] = await Promise.all([store.seenHashes(hashes), store.recentTitles(norms, titleWindowStart(now))]);
    const plan = planIngest(parsed.items, { seenHashes, recentTitles, now, ports: FISHING_PORTS });
    // Bài trước, sổ "đã thấy" sau: bài hỏng thì lượt sau xét lại (chưa ghi sổ); sổ hỏng thì
    // url_hash unique của bài vẫn chặn trùng.
    const inserted = await store.insertBao(plan.posts);
    await store.insertSeen(plan.seen);
    if (parsed.sources.length) await store.upsertSources(sourceRows(parsed.sources, nowIso));
    await auditQuiet(store, { actor: "may-thu", actor_kind: "he-thong", action: "ingest", detail: { ...plan.stats, inserted, invalid: parsed.invalid } });
    return NextResponse.json({ ok: true, inserted, stats: plan.stats, invalid: parsed.invalid });
  } catch (e) {
    return kairosErrorResponse(e);
  }
}
