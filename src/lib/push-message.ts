// NỘI DUNG THÔNG BÁO TỰ KHAI TUỔI — luật THUẦN, có test.
//
// VÌ SAO (chủ dự án chốt 2026-08-01): giữ TTL 4 tuần, nhưng "user nhận biết
// được tin đó trễ bao nhiêu ngày". Web Push mất sóng thì Apple/Google GIỮ tin
// rồi đẩy khi máy online lại — nên tin "Bão số 5 đang vào Biển Đông" gửi hôm
// nay hoàn toàn có thể nổ trên máy bà con HAI TUẦN SAU, đọc như đang xảy ra.
// Với app của ngư dân thì đó là nói dối chuyện tính mạng.
//
// GIỮ ĐỒNG BỘ với bản sao trong `public/sw.js` (file tĩnh, không import được
// TS) — test `push-message.test.ts` đọc sw.js và bắt hai bên lệch ngưỡng.

/** Trễ dưới ngần này thì coi như tin tươi, không cần kêu */
export const PUSH_FRESH_MS = 2 * 60 * 60 * 1000; // 2 giờ

/** "14:30 01/08" — giờ Việt Nam, không phụ thuộc locale máy */
export function formatSentAtVN(sentAtMs: number): string {
  const d = new Date(sentAtMs + 7 * 3600 * 1000); // UTC+7
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())} ${p(d.getUTCDate())}/${p(
    d.getUTCMonth() + 1,
  )}`;
}

/**
 * Câu ĐỨNG TRƯỚC nội dung khi tin tới muộn — null nếu còn tươi.
 *
 * Đặt TRƯỚC chứ không phải sau: bà con liếc dòng đầu là biết ngay đây là tin
 * cũ, không phải đọc hết rồi mới thấy ghi chú cuối.
 */
export function staleWarningVN(
  sentAtMs: number,
  nowMs: number,
): string | null {
  const late = nowMs - sentAtMs;
  if (!Number.isFinite(late) || late < PUSH_FRESH_MS) return null;
  const hours = Math.round(late / 3600000);
  if (hours < 24) return `TIN CŨ ${hours} GIỜ TRƯỚC —`;
  const days = Math.round(hours / 24);
  return `TIN CŨ ${days} NGÀY TRƯỚC —`;
}

/**
 * Nội dung cuối cùng hiện trên thông báo: [cảnh báo cũ] + nội dung + giờ gửi.
 * Giờ gửi LUÔN in, kể cả tin tươi — bà con ngoài biển không có gì để đối chiếu
 * thời gian ngoài chính dòng này.
 */
export function pushBodyVN(args: {
  body: string;
  sentAtMs: number | null;
  nowMs: number;
}): string {
  const { body, sentAtMs, nowMs } = args;
  if (sentAtMs == null || !Number.isFinite(sentAtMs)) return body;
  const warn = staleWarningVN(sentAtMs, nowMs);
  const stamp = `(tin lúc ${formatSentAtVN(sentAtMs)})`;
  return [warn, body, stamp].filter(Boolean).join(" ");
}
