import {
  VASEP_LISTING_URL,
  mergeLivePrices,
  parseVasepBulletin,
  pickLatestBulletinUrl,
} from "@/lib/port-price-source";

/**
 * Giá cá LIVE — server kéo bản tin giá tuần VASEP (Khánh Hòa) rồi map về
 * schema giá của app. Cache 24h (revalidate) — bản tin chỉ ra mỗi tuần, đỡ
 * đập nguồn. Nguồn fail / parse vỡ (bảng prose rowspan) → { ok:false },
 * client lùi về bảng tĩnh — KHÔNG bịa giá. Loài tuần này không có thì giữ tĩnh.
 */
const REVALIDATE = 86400;

export async function GET() {
  try {
    const opt = {
      next: { revalidate: REVALIDATE },
      headers: { "user-agent": "Mozilla/5.0 (SDFish price bot)" },
      signal: AbortSignal.timeout(15000),
    };
    const listing = await fetch(VASEP_LISTING_URL, opt).then((r) =>
      r.ok ? r.text() : null,
    );
    const url = listing && pickLatestBulletinUrl(listing);
    if (!url) return Response.json({ ok: false });

    const html = await fetch(url, opt).then((r) => (r.ok ? r.text() : null));
    const parsed = html && parseVasepBulletin(html);
    // cần ≥4 loài khớp mới coi là parse thành công (bảng vỡ thì ít hơn nhiều)
    if (!parsed || Object.keys(parsed.prices).length < 4) {
      return Response.json({ ok: false });
    }

    return Response.json({
      ok: true,
      source: "vasep",
      province: parsed.province,
      week: parsed.week,
      prices: mergeLivePrices(parsed.prices),
    });
  } catch {
    return Response.json({ ok: false });
  }
}
