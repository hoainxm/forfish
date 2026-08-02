import {
  VASEP_LISTING_URL,
  mergeLivePrices,
  parseVasepBulletin,
  pickLatestBulletinUrl,
} from "@/lib/port-price-source";
import { timeoutSignal } from "@/lib/abort";

/**
 * Giá cá LIVE — server kéo bản tin giá tuần VASEP (Khánh Hòa) rồi map về
 * schema giá của app. Cache 24h (revalidate) — bản tin chỉ ra mỗi tuần, đỡ
 * đập nguồn. Loài tuần này không có thì giữ tĩnh.
 *
 * NGUỒN HỎNG / PARSE VỠ → HTTP 503, KHÔNG PHẢI 200 kèm {ok:false} (2026-07-31,
 * chủ dự án chốt: ra khơi cứ dùng giá cũ). Service worker chỉ cất bản `res.ok`,
 * nên 200-kèm-lỗi cũ ĐÈ MẤT bảng giá tuần đã tải ở bờ. Với 503, SW giữ và trả
 * lại bản cũ; UI in kèm TUẦN của bản tin (price-board.tsx:122) nên bà con biết
 * giá đó của tuần nào. Client `fetchLivePrices` đã có nhánh `!r.ok` → bảng tĩnh,
 * KHÔNG bịa giá.
 */
const REVALIDATE = 86400;

export async function GET() {
  try {
    const opt = {
      next: { revalidate: REVALIDATE },
      headers: { "user-agent": "Mozilla/5.0 (SDFish price bot)" },
      signal: timeoutSignal(15000),
    };
    const listing = await fetch(VASEP_LISTING_URL, opt).then((r) =>
      r.ok ? r.text() : null,
    );
    const url = listing && pickLatestBulletinUrl(listing);
    if (!url) return Response.json({ ok: false }, { status: 503 });

    const html = await fetch(url, opt).then((r) => (r.ok ? r.text() : null));
    const parsed = html && parseVasepBulletin(html);
    // cần ≥4 loài khớp mới coi là parse thành công (bảng vỡ thì ít hơn nhiều)
    if (!parsed || Object.keys(parsed.prices).length < 4) {
      return Response.json({ ok: false }, { status: 503 });
    }

    return Response.json({
      ok: true,
      source: "vasep",
      province: parsed.province,
      week: parsed.week,
      prices: mergeLivePrices(parsed.prices),
    });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
