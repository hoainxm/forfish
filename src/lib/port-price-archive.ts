import "server-only";
import { VASEP_LISTING_URL } from "@/lib/port-price-source";
import {
  buildWeeks,
  parseWeekEndFromUrl,
  pickBulletinUrls,
  type WeekPrice,
} from "@/lib/port-price-history";
import { timeoutSignal } from "@/lib/abort";

/*
  Gom KHO bản tin giá tuần VASEP (Khánh Hòa) → chuỗi tuần THẬT. Dùng CHUNG bởi:
  · /api/port-prices/history (fallback khi DB chưa có lịch sử tích luỹ)
  · /api/cron/snapshot-prices (ghi tích luỹ vào bảng price_history)

  Server-only (network fetch, cache 24h/fetch). Mọi lỗi từng bản tin → bỏ bản
  đó (.catch→null), KHÔNG làm hỏng cả lượt.
*/

const REVALIDATE = 86400;
const LISTING_PAGES = 2; // trang 1..2 ≈ 13 tuần ≈ 3 tháng
const MAX_WEEKS = 14; // trần số bản tin tải mỗi lượt (né timeout)

/** Tải + parse các tuần gần nhất từ kho VASEP. Rỗng nếu nguồn fail hoàn toàn. */
export async function gatherArchiveWeeks(): Promise<WeekPrice[]> {
  const opt = {
    next: { revalidate: REVALIDATE },
    headers: { "user-agent": "Mozilla/5.0 (SDFish price bot)" },
    signal: timeoutSignal(15000),
  };

  // 1) Gom URL bản tin từ vài trang danh sách (mới → cũ)
  const urls = new Set<string>();
  for (let p = 1; p <= LISTING_PAGES; p++) {
    const listUrl =
      p === 1 ? VASEP_LISTING_URL : `${VASEP_LISTING_URL}?trang=${p}`;
    const html = await fetch(listUrl, opt)
      .then((r) => (r.ok ? r.text() : null))
      .catch(() => null);
    if (html) for (const u of pickBulletinUrls(html)) urls.add(u);
  }

  // 2) URL → { url, date }, sắp mới→cũ, giữ tối đa MAX_WEEKS bản gần nhất
  const dated = Array.from(urls)
    .map((url) => ({ url, date: parseWeekEndFromUrl(url) }))
    .filter((x): x is { url: string; date: string } => x.date != null)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, MAX_WEEKS);
  if (dated.length === 0) return [];

  // 3) Tải song song từng bản tin (lỗi 1 bản → bỏ bản đó)
  const bulletins = (
    await Promise.all(
      dated.map(async (d) => {
        const html = await fetch(d.url, opt)
          .then((r) => (r.ok ? r.text() : null))
          .catch(() => null);
        return html ? { date: d.date, html } : null;
      }),
    )
  ).filter((b): b is { date: string; html: string } => b != null);

  return buildWeeks(bulletins);
}
