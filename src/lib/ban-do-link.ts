/*
  LIÊN KẾT VÀO BẢN ĐỒ — luật THUẦN (2026-10-25, BD-04 + TC-02).

  Hai nơi dẫn sang `/ngu-truong` kèm tham số:
   · thông báo bão (storm-push.ts): `?bao=<khoá cơn>&cap=&muc=&lat=&lon=&t=<giây>`
   · danh bạ cảng (/cang): `?lat=&lon=` — ghim cảng rồi mở ngăn gió sóng.
  Trước đây bản đồ KHÔNG đọc gì (07 §12 ghi nợ) ⇒ chạm thông báo "Siêu bão X" là
  mở bản đồ chung, bản đồ còn bảo "không có bão". Ở đây chỉ phân tích + chọn
  đích đến; việc bay/bung thẻ nằm ở fishing-map-view. Không Date.now() — `nowMs`
  truyền vào để test được. KHÔNG hỏi mạng: cơn tra trong danh sách bão đang có
  trong state (bản mới hoặc bản lưu).
*/

import type { StormAlert } from "@/lib/storms";
import { cungCon, stormKeyOf } from "@/lib/storm-identity";
import { daysBetweenISO } from "@/lib/day-labels";

export type QueryBanDo = {
  lat: number | null;
  lon: number | null;
  /** khoá cơn bão (`stormKeyOf`) — null = không phải link bão */
  bao: string | null;
  /** giờ bản tin lúc gửi (ms) — null nếu link không mang `t` */
  tMs: number | null;
};

/** Tham số bản đồ đọc xong thì DỌN khỏi địa chỉ (quay lại không chạy lại). */
export const THAM_SO_BAN_DO = ["lat", "lon", "bao", "cap", "muc", "t"] as const;

function so(v: string | null, min: number, max: number): number | null {
  if (v == null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

/** Đọc `location.search` — toạ độ chỉ nhận khi CÓ CẢ HAI và nằm trong dải hợp lệ. */
export function docQueryBanDo(search: string): QueryBanDo {
  let p: URLSearchParams;
  try {
    p = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  } catch {
    return { lat: null, lon: null, bao: null, tMs: null };
  }
  let lat = so(p.get("lat"), -90, 90);
  let lon = so(p.get("lon"), -180, 180);
  if (lat == null || lon == null) {
    lat = null;
    lon = null;
  }
  const bao = (p.get("bao") ?? "").trim() || null;
  const tGiay = so(p.get("t"), 1, 4_102_444_800); // tới năm 2100 — chặn số rác
  return { lat, lon, bao, tMs: tGiay != null ? tGiay * 1000 : null };
}

export type DichDenBanDo =
  | { kind: "khong" }
  /** chỉ toạ độ (từ danh bạ cảng) — ghim + mở ngăn gió sóng */
  | { kind: "toa-do"; lat: number; lon: number }
  /** cơn còn trong danh sách bão — bay tới tâm + bung thẻ */
  | { kind: "con-bao"; storm: StormAlert }
  /** link bão nhưng cơn không còn — bay tới toạ độ cũ (nếu có) + chip "đã tan" */
  | { kind: "con-tan"; lat: number | null; lon: number | null; banTinMs: number | null };

/**
 * Tìm cơn theo KHOÁ trước; khoá lệch (áp thấp không tên đổi khoá theo mốc thấy
 * đầu) thì nối theo TÂM + GIỜ bằng `cungCon` — cùng luật kho/push đang dùng.
 */
export function timConTheoLink(q: QueryBanDo, storms: StormAlert[], nowMs: number): StormAlert | null {
  if (!q.bao) return null;
  const theoKhoa = storms.find((s) => stormKeyOf(s, nowMs) === q.bao);
  if (theoKhoa) return theoKhoa;
  if (q.lat == null || q.lon == null) return null;
  const moc = { lat: q.lat, lon: q.lon, tMs: q.tMs };
  return (
    storms.find((s) => {
      const t = Date.parse(s.updated ?? "");
      return cungCon(moc, { lat: s.lat, lon: s.lon, tMs: Number.isFinite(t) ? t : null });
    }) ?? null
  );
}

export function dichDenTuQuery(q: QueryBanDo, storms: StormAlert[], nowMs: number): DichDenBanDo {
  if (q.bao) {
    const storm = timConTheoLink(q, storms, nowMs);
    if (storm) return { kind: "con-bao", storm };
    return { kind: "con-tan", lat: q.lat, lon: q.lon, banTinMs: q.tMs };
  }
  if (q.lat != null && q.lon != null) return { kind: "toa-do", lat: q.lat, lon: q.lon };
  return { kind: "khong" };
}

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Câu chip khi cơn đã tan — kèm ngày bản tin (giờ VN) nếu link có mang. */
export function cauConTan(banTinMs: number | null): string {
  if (banTinMs == null || !Number.isFinite(banTinMs)) return "Cơn này đã tan";
  const d = new Date(banTinMs + VN_OFFSET_MS);
  return `Cơn này đã tan — bản tin ${String(d.getUTCDate()).padStart(2, "0")}/${String(
    d.getUTCMonth() + 1,
  ).padStart(2, "0")}`;
}

/** Đường vào bản đồ tại một toạ độ (danh bạ cảng dùng). 4 chữ số ≈ 11 m, đủ cho cảng. */
export function duongDanBanDoToi(lat: number, lon: number): string {
  return `/ngu-truong?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;
}

const THU_NGAN = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

/**
 * Nhãn chip ngày NGẮN cho ngăn gió sóng (BD-09): "Hôm nay" · "Ngày mai" · "T3 27".
 * Chip cố định 5.5rem nên không ghi tháng — ngày đã qua thì chip tự mờ + khoá,
 * không cần chữ "· qua".
 */
export function nhanChipNgay(isoDate: string, todayIso: string): string {
  const diff = daysBetweenISO(todayIso, isoDate);
  if (diff === 0) return "Hôm nay";
  if (diff === 1) return "Ngày mai";
  const d = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return `${THU_NGAN[d.getUTCDay()]} ${d.getUTCDate()}`;
}
