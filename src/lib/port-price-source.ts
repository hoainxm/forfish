// Nguồn giá cá LIVE — bản tin giá nguyên liệu hằng TUẦN của VASEP
// (vasep.com.vn/gia-thuy-san/gia-trong-nuoc), bản Khánh Hòa (cập nhật đều,
// "giá nguyên liệu tại địa phương" = giá mua tại bến/vựa, đúng thứ ngư dân cần).
//
// TRUNG THỰC: đây là giá TUẦN, không phải hằng ngày — VN chưa có nguồn giá
// tại bến hằng ngày máy-đọc-được. Bảng giá trong scrape là HTML prose (bảng
// rowspan lộn xộn) nên parser làm PHÒNG THỦ: lỗi bất kỳ → route trả ok:false,
// UI lùi về bảng tĩnh `data/port-prices.ts`. Loài tuần này VASEP không có →
// giữ giá tĩnh, đánh dấu là tham khảo. UI bắt buộc ghi "Nguồn: VASEP, tuần X".

import { PORT_PRICES, type PortPrice } from "@/data/port-prices";
import { apiUrl } from "@/lib/api-base";

export const VASEP_LISTING_URL =
  "https://vasep.com.vn/gia-thuy-san/gia-trong-nuoc";

export interface LivePortPrice extends PortPrice {
  /** true = giá tuần này lấy từ VASEP; false = giá tĩnh tham khảo */
  live: boolean;
}

export interface LivePriceResult {
  ok: boolean;
  /** "vasep" khi có giá tuần; "static" khi lùi về bảng tĩnh */
  source: "vasep" | "static";
  /** tỉnh của bản tin, vd "Khánh Hòa" */
  province?: string;
  /** khoảng tuần, vd "30/5 – 05/6/2026" */
  week?: string;
  prices: LivePortPrice[];
}

/** Khớp tên mặt hàng VASEP → id loài trong app. `not` để loại hàng khác chất
 *  (khô, giống) khỏi giá tươi. Thứ tự QUAN TRỌNG: rule cụ thể hơn đặt trước. */
interface SpeciesRule {
  id: string;
  kw: string[];
  not: string[];
}
export const VASEP_RULES: SpeciesRule[] = [
  { id: "ca-ngu-soc-dua", kw: ["sọc dưa"], not: ["khô"] },
  { id: "ca-ngu-dai-duong", kw: ["ngừ đại dương"], not: ["khô"] },
  { id: "ca-bac-ma", kw: ["bạc má"], not: ["khô"] },
  { id: "ca-thu", kw: ["cá thu"], not: ["khô"] },
  { id: "ca-nuc", kw: ["cá nục"], not: ["khô"] },
  { id: "ca-com", kw: ["cá cơm"], not: ["khô"] },
  { id: "ca-trich", kw: ["cá trích"], not: ["khô"] },
  { id: "ca-chim", kw: ["cá chim"], not: ["khô"] },
  { id: "ca-ho", kw: ["cá hố"], not: ["khô"] },
  { id: "muc-nang", kw: ["mực nang"], not: ["khô"] },
  { id: "muc-ong", kw: ["mực ống"], not: ["khô"] },
  { id: "tom-su", kw: ["tôm sú"], not: ["giống", "khô"] },
  { id: "ghe-xanh", kw: ["ghẹ"], not: ["khô"] },
];

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, " ");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&ndash;/gi, "–")
    .replace(/&mdash;/gi, "—")
    .replace(/&ge;/gi, "≥")
    .replace(/&le;/gi, "≤")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

/** Tách các ô <td> của một bảng thành text sạch theo đúng thứ tự DOM. */
export function tableCells(tableHtml: string): string[] {
  return tableHtml
    .split(/<\/td>/i)
    .map((c) => decodeEntities(stripTags(c)).replace(/\s+/g, " ").trim())
    .filter((c) => c.length > 0);
}

/** Ô giá "360-380" / "1.500" / "11-12" / "900-1.000" → đồng/kg (×1000). null nếu không phải giá. */
export function parsePriceCell(text: string): { minVnd: number; maxVnd: number } | null {
  const t = text.replace(/\s/g, "");
  if (!/^\d{1,3}(?:[.,]\d{3})*(?:[-–]\d{1,3}(?:[.,]\d{3})*)?$/.test(t)) return null;
  const parts = t.split(/[-–]/);
  const toN = (x: string) => parseInt(x.replace(/[.,]/g, ""), 10);
  const a = toN(parts[0]);
  const b = parts[1] != null ? toN(parts[1]) : a;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  // giá nghìn đồng/kg hợp lý: 1..5000 (tôm hùm ~1.500) → ×1000
  if (a < 1 || a > 5000 || b < 1 || b > 5000) return null;
  return { minVnd: Math.min(a, b) * 1000, maxVnd: Math.max(a, b) * 1000 };
}

/** Tên mặt hàng VASEP → id loài, hoặc null nếu không khớp / bị loại (khô, giống). */
export function matchSpecies(name: string): string | null {
  const n = name.toLowerCase();
  for (const r of VASEP_RULES) {
    if (r.not.some((x) => n.includes(x))) continue;
    if (r.kw.some((k) => n.includes(k))) return r.id;
  }
  return null;
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase())
    .trim();
}

/** Parse 1 trang bản tin VASEP → tỉnh + tuần + giá theo loài. null nếu không đọc được. */
export function parseVasepBulletin(html: string): {
  province: string;
  week: string;
  prices: Record<string, { minVnd: number; maxVnd: number }>;
} | null {
  const m = html.match(/<table[^>]*class="?Table"?[^>]*>([\s\S]*?)<\/table>/i);
  if (!m) return null;
  const cells = tableCells(m[1]);
  if (cells.length < 6) return null;

  const titleCell = cells.find((c) => /BẢNG GIÁ/i.test(c)) ?? "";
  const tm = titleCell.match(/T[ẠA]I\s+(.+?),\s*(?:từ\s*)?(.+)$/i);
  const province = tm ? titleCase(tm[1]) : "";
  const week = tm ? tm[2].trim() : "";

  const prices: Record<string, { minVnd: number; maxVnd: number }> = {};
  for (let i = 0; i < cells.length; i++) {
    const id = matchSpecies(cells[i]);
    if (!id || prices[id]) continue;
    // giá nằm trong vài ô ngay sau tên (qua ô "quy cách")
    for (let j = i + 1; j <= i + 3 && j < cells.length; j++) {
      const p = parsePriceCell(cells[j]);
      if (p) {
        prices[id] = p;
        break;
      }
    }
  }
  return { province, week, prices };
}

/** Lấy URL bản tin Khánh Hòa MỚI NHẤT từ trang danh sách (đăng theo thứ tự mới→cũ). */
export function pickLatestBulletinUrl(listingHtml: string): string | null {
  const m = listingHtml.match(
    /href="(https:\/\/vasep\.com\.vn\/gia-thuy-san\/gia-trong-nuoc\/gia-thuy-san-tai-khanh-hoa-[^"]*\.html)"/i,
  );
  return m ? m[1] : null;
}

/** Ghép giá tuần (VASEP) đè lên bảng tĩnh; loài chưa có giá tuần giữ giá tĩnh. */
export function mergeLivePrices(
  prices: Record<string, { minVnd: number; maxVnd: number }>,
): LivePortPrice[] {
  return PORT_PRICES.map((p) => {
    const live = prices[p.id];
    return live
      ? { ...p, minVnd: live.minVnd, maxVnd: live.maxVnd, live: true }
      : { ...p, live: false };
  });
}

/** Client gọi route nội bộ; lỗi/nguồn fail → lùi về bảng tĩnh (không bịa). */
export async function fetchLivePrices(): Promise<LivePriceResult> {
  try {
    const r = await fetch(apiUrl("/api/port-prices"));
    if (r.ok) {
      const j = (await r.json()) as LivePriceResult;
      if (j.ok) return j;
    }
  } catch {
    // mạng lỗi → fallback
  }
  return {
    ok: false,
    source: "static",
    prices: PORT_PRICES.map((p) => ({ ...p, live: false })),
  };
}
