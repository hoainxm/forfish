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

/**
 * Bản lưu lúc `savedAt` CHẬM bao nhiêu LƯỢT CẬP NHẬT của nguồn (mốc OM_RELEASE_HOURS_UTC, 4 lượt/ngày) tính tới `nowMs`.
 * 0 = vẫn là bản mới nhất nguồn có. Dùng để so hai bản lùi (trong máy vs DB) theo cùng một thước — anh Long 2026-10-30:
 * "cho con số chênh theo chu kỳ để chọn nguồn cho thông minh". Hỏng / đồng hồ lùi ⇒ Infinity (không bao giờ thắng).
 */
export function soLuotCham(savedAt: number | null | undefined, nowMs: number): number {
  if (savedAt == null || !Number.isFinite(savedAt) || savedAt > nowMs) return Infinity;
  let n = 0;
  for (let t = nextReleaseAfter(savedAt); t <= nowMs && n < 400; t = nextReleaseAfter(t)) n++;
  return n;
}

/** Đuôi câu "· chậm N lượt cập nhật" cho nhãn bản lưu; 0 / không rõ ⇒ "" (bản lưu vẫn là bản mới nhất nguồn có). */
export function cauLuotCham(n: number | null | undefined): string {
  return n != null && Number.isFinite(n) && n >= 1 ? ` · chậm ${n} lượt cập nhật` : "";
}

/* ══════════════ NGUỒN CHẠY THEO NGÀY (Copernicus) ══════════════
   (2026-08-03, chủ dự án bắt được trên máy thật: "để ở DB đang load cực kỳ chậm")

   VÌ SAO PHẢI TÁCH RA KHỎI `isCacheCurrent`: hàm trên đo độ tươi bằng lịch chạy
   của GFS/Open-Meteo — 4 mốc một ngày. Nhưng DÒNG CHẢY THEO TẦNG và ĐỘ MẶN là
   sản phẩm Copernicus trung bình NGÀY (`P1D`), một ngày ra ĐÚNG MỘT bản. Áp lịch
   6 tiếng lên nguồn 24 tiếng nghĩa là ngày bốn lần tuyên bản trong máy "hết hiện
   hành", vứt bản 10 KB đang có, rồi đi gọi route live — mà route live cho tầng
   sâu là 10 giây snapshot + 45 giây tải Copernicus (server đọc 20 chunk × 1,37
   MB tuần tự) để nhận về ĐÚNG CON SỐ CŨ. Bà con ngồi nhìn màn hình quay gần một
   phút cho một lần đổi chip tầng, mỗi ngày bốn lượt, không đổi được gì.

   Đo trên kho thật (2026-08-03): `curdepth:t50:d10` cron ghi 08:51 UTC, tới
   10:00 UTC là bị `isCacheCurrent` xử "cũ" — trong khi nguồn không hề có bản mới. */

/** Giờ UTC nguồn NGÀY ra bản mới. Cron của app chạy `50 5,17 * * *` UTC, nguồn
    Copernicus phy-cur/độ mặn phát hành quanh trưa UTC — lấy 12h làm mốc AN TOÀN
    (sau mốc này mới thật sự có số mới). */
export const DAILY_RELEASE_HOUR_UTC = 12;

/** Trần cho nguồn NGÀY: quá ngần này thì cứ thử lại dù tính mốc có sai (đồng hồ
    máy lệch, nguồn đổi lịch). 26 giờ = một ngày + hai giờ dư. */
export const MAX_DAILY_CACHE_MS = 26 * HOUR_MS;

/** Mốc phát hành NGÀY kế tiếp sau `ms` (epoch ms, UTC) */
export function nextDailyReleaseAfter(ms: number): number {
  const d = new Date(ms);
  const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const t = dayStart + DAILY_RELEASE_HOUR_UTC * HOUR_MS;
  return t > ms ? t : t + DAY_MS;
}

/**
 * Như `isCacheCurrent` nhưng cho NGUỒN CHẠY THEO NGÀY (dòng chảy tầng sâu, độ
 * mặn). Cùng ba điều kiện, chỉ đổi lịch phát hành và trần tuổi.
 */
export function isDailyCacheCurrent(
  savedAt: number | null | undefined,
  nowMs: number,
): boolean {
  if (savedAt == null || !Number.isFinite(savedAt)) return false;
  if (savedAt > nowMs) return false; // đồng hồ máy chỉnh lùi → coi như phải kéo
  const age = nowMs - savedAt;
  if (age > MAX_DAILY_CACHE_MS) return false;
  if (age < MIN_REFETCH_MS) return true; // vừa tải xong, khỏi tính mốc
  return nowMs < nextDailyReleaseAfter(savedAt);
}
