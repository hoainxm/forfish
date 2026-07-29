// Trục 1 — NHỊP PHÁT HÀNH CỦA NGUỒN: đừng kéo lại khi nguồn CHƯA có bản mới.
//
// Vì sao có file này (user 2026-07-29, sau khi dính Open-Meteo 429 "Daily API
// request limit"): trước đây mỗi lần bật lớp gió / đổi khung ngày / có sóng lại
// là gọi thẳng nguồn — trong khi bản tin chỉ đổi vài giờ một lần. Bật tắt lớp
// chục lần trong một buổi = chục lần tải cùng một con số, vừa tốn tiền sóng của
// bà con vừa đốt hạn ngạch IP (bị khoá thì CẢ APP mất dự báo).
//
// Open-Meteo chạy trên GFS: mô hình chạy 4 lần/ngày (00/06/12/18 UTC), dữ liệu
// lên API chậm hơn giờ chạy khoảng 3,5–5 giờ. Lấy mốc AN TOÀN là 04/10/16/22
// UTC — sau các mốc này mới thật sự có số mới; trước đó kéo lại chỉ nhận lại
// đúng bản cũ.
//
// Thuần (truyền `nowMs` vào), test được.

/** Giờ UTC bản tin mới thật sự có trên API (GFS run + độ trễ phát hành) */
export const OM_RELEASE_HOURS_UTC = [4, 10, 16, 22] as const;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Sàn cứng: dù vừa qua mốc phát hành cũng KHÔNG kéo lại trong vòng ngần này kể
 * từ lần lưu. Chống trường hợp mở app đúng lúc giao mốc rồi bật/tắt lớp liên
 * tục (mỗi lần lại một lượt tải cả lưới).
 */
export const MIN_REFETCH_MS = 45 * 60 * 1000;

/**
 * Trần: quá lâu thì cứ thử lại dù tính toán mốc có sai (đồng hồ máy lệch, nguồn
 * đổi lịch) — thà một lượt tải thừa còn hơn ôm số cũ mãi.
 */
export const MAX_CACHE_MS = 12 * HOUR_MS;

/** Mốc phát hành KẾ TIẾP sau `ms` (epoch ms, UTC) */
export function nextReleaseAfter(ms: number): number {
  const d = new Date(ms);
  const dayStart = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    0,
    0,
    0,
    0,
  );
  for (const h of OM_RELEASE_HOURS_UTC) {
    const t = dayStart + h * HOUR_MS;
    if (t > ms) return t;
  }
  // đã qua mốc cuối trong ngày → mốc đầu của ngày mai
  return dayStart + DAY_MS + OM_RELEASE_HOURS_UTC[0] * HOUR_MS;
}

/**
 * Bản đã lưu lúc `savedAt` CÓ CÒN LÀ BẢN HIỆN HÀNH không (tại `nowMs`)?
 *  · true  → dùng luôn, KHÔNG gọi nguồn (không phải "số cũ" — nguồn chưa có bản mới)
 *  · false → nguồn đã ra bản mới (hoặc quá cũ) → nên kéo
 *
 * Ba điều kiện: chưa qua mốc phát hành kế tiếp · đã lưu ≥ MIN_REFETCH_MS thì mới
 * xét mốc · không quá MAX_CACHE_MS.
 */
export function isCacheCurrent(
  savedAt: number | null | undefined,
  nowMs: number,
): boolean {
  if (savedAt == null || !Number.isFinite(savedAt)) return false;
  if (savedAt > nowMs) return false; // đồng hồ máy chỉnh lùi → coi như phải kéo
  const age = nowMs - savedAt;
  if (age > MAX_CACHE_MS) return false;
  if (age < MIN_REFETCH_MS) return true; // vừa tải xong, khỏi tính mốc
  return nowMs < nextReleaseAfter(savedAt);
}
