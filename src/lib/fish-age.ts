// Trục 1 — LỚP CÁ CŨ PHẢI NÓI LÀ CŨ.
//
// Vì sao có file này: bản đồ cá (/api/fish-forecast) được service worker giữ lại
// (network-first) nên ra biển mất sóng vẫn vẽ được điểm nóng — nhưng bản lưu 10
// ngày trước TRÔNG Y HỆT bản mới. Ảnh vệ tinh vốn đã trễ ~2 ngày, tới ngày thứ
// 10 của chuyến là bà con đang nhìn ảnh 12 ngày tuổi mà không hay.
//
// HAI mốc thời gian KHÁC NHAU, không được gộp:
//   · `date`        — ngày chụp ẢNH vệ tinh (nguồn trễ sẵn ~2 ngày)
//   · `generatedAt` — lúc máy chủ TÍNH ra bản đồ này (= lúc bản trong máy được
//                     lấy về; bản do service worker giữ lại vẫn mang mốc cũ)
//
// Hàm ở đây THUẦN (truyền `nowMs` vào, không gọi Date.now ẩn) để test được.

import { clockVN, daysBetweenISO, isoDateVN } from "@/lib/day-labels";
import { formatDateVN } from "@/lib/ocean-map";

/**
 * Quá bấy nhiêu ngày kể từ ngày ẢNH thì phải cảnh báo rõ (nền vàng).
 *
 * Chọn 5 chứ KHÔNG phải 3, có căn cứ đo được (scripts/fish-plankton-*.mjs, 30
 * ngày lưới thật): trường phù du/front rất BỀN theo thời gian — tương quan không
 * gian còn ~0.976 ở lead 5 ngày. Tức ảnh 5 ngày vẫn dùng được; quá 5 ngày là
 * NGOÀI vùng đã đo → lúc đó mới đáng kêu.
 *
 * Vì sao không để 3: ảnh vệ tinh vốn trễ sẵn ~2 ngày nên bản VỪA lấy về đã là
 * "2 ngày trước"; ngưỡng 3 khiến từ ngày thứ 2 ngoài khơi là màn hình vàng suốt
 * 14 ngày còn lại → cảnh báo lúc nào cũng bật thì bà con nhìn quen rồi bỏ qua
 * (mất tác dụng). Tuổi ảnh LUÔN được ghi bằng chữ ở mọi mức, nên màu vàng chỉ
 * dành cho lúc thật sự quá cũ.
 */
export const FISH_STALE_DAYS = 5;

export interface FishAge {
  /** số ngày từ ngày ẢNH tới hôm nay (giờ VN); null nếu ngày ảnh hỏng */
  imageDays: number | null;
  /** lúc bản này được tính/lấy về (epoch ms); null nếu bản cũ không ghi mốc */
  fetchedAtMs: number | null;
  /** true = cũ tới mức phải nói to (nền warn), không được để trông như bản mới */
  warn: boolean;
  /** một dòng nói thật cho UI, vd "Ảnh ngày 23/7 · lấy về 06:15 ngày 25/7" */
  label: string;
}

/**
 * Tuổi của bản đồ cá đang xem. `f.date` = ngày ảnh, `f.generatedAt` = lúc tính.
 * Không có `generatedAt` (bản cũ trong máy từ trước bản cập nhật này) → nói thẳng
 * "chưa rõ lấy về lúc nào" chứ KHÔNG đoán là vừa lấy.
 */
export function fishForecastAge(
  f: { date: string; generatedAt?: string },
  nowMs: number,
): FishAge {
  const todayIso = isoDateVN(nowMs);
  const okDate = /^\d{4}-\d{2}-\d{2}$/.test(f.date);
  // đếm từ NGÀY ẢNH tới HÔM NAY (dương = ảnh đã cũ bấy nhiêu ngày)
  const imageDays = okDate ? daysBetweenISO(f.date, todayIso) : null;

  const parsed = f.generatedAt ? Date.parse(f.generatedAt) : NaN;
  const fetchedAtMs = Number.isFinite(parsed) ? parsed : null;

  const anhPart = okDate
    ? `Ảnh ngày ${formatDateVN(f.date)}${
        imageDays != null && imageDays >= 2 ? ` (${imageDays} ngày trước)` : ""
      }`
    : "Chưa rõ ảnh ngày nào";
  const layPart =
    fetchedAtMs != null
      ? `lấy về ${clockVN(fetchedAtMs)}`
      : "chưa rõ lấy về lúc nào";

  return {
    imageDays,
    fetchedAtMs,
    warn: imageDays == null || imageDays > FISH_STALE_DAYS,
    label: `${anhPart} · ${layPart}`,
  };
}
