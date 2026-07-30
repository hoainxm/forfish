// Lịch sử giá cá — dựng chuỗi giá tuần THẬT từ KHO bản tin VASEP (Khánh Hòa).
// VASEP đăng bản tin giá nguyên liệu tại bến MỖI TUẦN và lưu trữ nhiều tuần cũ
// (trang danh sách phân trang bằng ?trang=N). Ta gom URL các bản tin, đọc ngày
// CUỐI tuần ngay từ slug URL (…-tu-{d1}-{m1}-{d2}-{m2}-{yyyy}-{id}.html), rồi
// parse bảng giá từng bản tin bằng đúng parser của giá tuần (parseVasepBulletin).
//
// TRUNG THỰC: mọi điểm trên biểu đồ là GIÁ THẬT VASEP đã đăng — KHÔNG nội suy,
// KHÔNG bịa. Tuần nào parse hỏng / thiếu loài thì BỎ tuần đó (thành khoảng
// trống), không đắp số giả. Nguồn/route fail → { ok:false }, UI báo chưa có
// lịch sử chứ không vẽ đường ma.

import { parseVasepBulletin } from "@/lib/port-price-source";
import { apiUrl } from "@/lib/api-base";

/** Giá 1 loài trong 1 tuần (đồng/kg). */
export interface WeekSpeciesPrice {
  minVnd: number;
  maxVnd: number;
}

/** 1 bản tin tuần: ngày cuối tuần (ISO) + giá theo id loài. */
export interface WeekPrice {
  /** ISO yyyy-mm-dd — NGÀY CUỐI của tuần bản tin (trục thời gian của biểu đồ). */
  date: string;
  /** tỉnh bản tin (vd "Khánh Hòa") — để lưu DB; client không dùng. */
  province?: string;
  prices: Record<string, WeekSpeciesPrice>;
}

export interface PriceHistoryResult {
  ok: boolean;
  /** Các tuần, TĂNG DẦN theo ngày (cũ → mới). Rỗng khi ok:false. */
  weeks: WeekPrice[];
}

/** 1 điểm trên biểu đồ của 1 loài. */
export interface PricePoint {
  date: string;
  minVnd: number;
  maxVnd: number;
}

/** 1 dòng phẳng trong bảng `price_history` (1 loài × 1 tuần). */
export interface PriceRow {
  week_end: string;
  species_id: string;
  min_vnd: number;
  max_vnd: number;
  province?: string | null;
}

/** Gộp các dòng phẳng DB → chuỗi tuần TĂNG DẦN theo ngày (pure — có test). */
export function rowsToWeeks(rows: PriceRow[]): WeekPrice[] {
  const byDate = new Map<string, WeekPrice>();
  for (const r of rows) {
    let w = byDate.get(r.week_end);
    if (!w) {
      w = { date: r.week_end, province: r.province || undefined, prices: {} };
      byDate.set(r.week_end, w);
    }
    w.prices[r.species_id] = { minVnd: r.min_vnd, maxVnd: r.max_vnd };
  }
  return Array.from(byDate.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

/** Trải các tuần → dòng phẳng để UPSERT vào DB (pure — có test). */
export function weeksToRows(weeks: WeekPrice[]): PriceRow[] {
  const rows: PriceRow[] = [];
  for (const w of weeks) {
    for (const [species_id, p] of Object.entries(w.prices)) {
      rows.push({
        week_end: w.date,
        species_id,
        min_vnd: p.minVnd,
        max_vnd: p.maxVnd,
        province: w.province ?? null,
      });
    }
  }
  return rows;
}

const KH_BULLETIN_RE =
  /https:\/\/vasep\.com\.vn\/gia-thuy-san\/gia-trong-nuoc\/gia-thuy-san-tai-khanh-hoa-[a-z0-9-]*\.html/gi;

/** Lấy MỌI URL bản tin Khánh Hòa trên 1 trang danh sách (đã khử trùng lặp). */
export function pickBulletinUrls(listingHtml: string): string[] {
  const found = listingHtml.match(KH_BULLETIN_RE) ?? [];
  return Array.from(new Set(found));
}

/**
 * Slug URL bản tin → ISO ngày CUỐI tuần. Định dạng slug:
 * `…-tu-{d1}-{m1}-{d2}-{m2}-{yyyy}-{id}.html` (ngày/tháng có thể 1–2 chữ số).
 * Lấy cặp ngày–tháng THỨ HAI (d2,m2) làm mốc cuối tuần. null nếu không khớp
 * hoặc ngày/tháng vô lý → bỏ bản tin đó, không đoán.
 */
export function parseWeekEndFromUrl(url: string): string | null {
  const m = url.match(
    /-tu-(\d{1,2})-(\d{1,2})-(\d{1,2})-(\d{1,2})-(\d{4})-\d+\.html/i,
  );
  if (!m) return null;
  const dd = m[3].padStart(2, "0");
  const mm = m[4].padStart(2, "0");
  const yyyy = m[5];
  const dN = Number(dd);
  const mN = Number(mm);
  if (mN < 1 || mN > 12 || dN < 1 || dN > 31) return null;
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Ghép các bản tin đã tải → chuỗi tuần tăng dần theo ngày. Bỏ tuần parse hỏng
 * (dưới `minSpecies` loài — bảng prose vỡ) và tuần trùng ngày (giữ bản đầu).
 */
export function buildWeeks(
  bulletins: { date: string; html: string }[],
  minSpecies = 4,
): WeekPrice[] {
  const byDate = new Map<string, WeekPrice>();
  for (const b of bulletins) {
    if (byDate.has(b.date)) continue;
    const parsed = parseVasepBulletin(b.html);
    if (!parsed || Object.keys(parsed.prices).length < minSpecies) continue;
    byDate.set(b.date, {
      date: b.date,
      province: parsed.province || undefined,
      prices: parsed.prices,
    });
  }
  return Array.from(byDate.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

/** Rút chuỗi điểm giá của 1 loài từ các tuần (chỉ tuần CÓ loài đó). */
export function seriesForSpecies(
  weeks: WeekPrice[],
  speciesId: string,
): PricePoint[] {
  const out: PricePoint[] = [];
  for (const w of weeks) {
    const p = w.prices[speciesId];
    if (p) out.push({ date: w.date, minVnd: p.minVnd, maxVnd: p.maxVnd });
  }
  return out;
}

/** Client gọi route nội bộ; lỗi/nguồn fail → rỗng (KHÔNG bịa lịch sử). */
export async function fetchPriceHistory(): Promise<PriceHistoryResult> {
  try {
    const r = await fetch(apiUrl("/api/port-prices/history"), {
      signal: AbortSignal.timeout(20000),
    });
    if (r.ok) {
      const j = (await r.json()) as PriceHistoryResult;
      if (j.ok && Array.isArray(j.weeks)) return j;
    }
  } catch {
    // mạng/nguồn lỗi → rỗng
  }
  return { ok: false, weeks: [] };
}
