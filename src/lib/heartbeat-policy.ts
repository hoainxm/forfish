// LUẬT CỦA NHỊP "ĐÃ MỞ APP" — THUẦN, dùng CHUNG cho client (lib/heartbeat.ts)
// và máy chủ (app/api/me/heartbeat/route.ts).
//
// ⚠️ FILE NÀY TUYỆT ĐỐI KHÔNG ĐƯỢC CÓ "use client" — máy chủ import nó. Xem
// `src/lib/__tests__/server-client-boundary.test.ts`: một module "use client"
// bị gọi từ máy chủ là NÉM NGAY (HTTP 500) mà build vẫn xanh, và đúng lỗi đó đã
// làm chết hẳn nhịp gần một ngày (0/717 khách ghi được mã máy).
//
// ═══════════ MÔ HÌNH (chủ dự án chốt 2026-08-02d, sửa lại bản 02c) ═══════════
//
// MẤT SÓNG → KHÔNG CÓ NHỊP NÀO. Hết. Không request, không hẹn giờ.
//
// CÓ SÓNG → HAI LOẠI NHỊP KHÁC HẲN NHAU VỀ BẢN CHẤT, đừng gộp chung một cửa
// thời gian như bản trước:
//
//   ① NHỊP SỰ KIỆN — "một điểm đang theo dõi vừa ĐỔI TRẠNG THÁI"
//      Bốn điểm theo dõi: ĐỔI TÀI KHOẢN · web→BẢN CÀI · chưa đủ→ĐỦ ĐỒ ĐI BIỂN ·
//      ĐỔI MÁY (mã máy khác).
//      Luật: **gửi NGAY**. Máy chủ XÁC NHẬN gán được rồi thì thôi, không gửi
//      lại. Chưa xác nhận thì bám theo thang **30 giây → 3 phút → 5 phút**, giữ
//      5 phút **cho tới khi có xác nhận** — đang online nên không sợ tốn.
//      Đây là tin KHÔNG ĐƯỢC MẤT: mốc đang nói về một người/một máy khác hẳn.
//
//   ② NHỊP ĐỊNH KỲ — "trạng thái hiện giờ vẫn thế"
//      Luật: 30 phút một lần, lỡ một nhịp thì nhịp sau bù, KHÔNG bám đuổi.
//      Nó trả lời hai câu: máy còn giữ đúng mã máy đó không, và dữ liệu đi biển
//      trong máy đang có tới ngày nào.
//
// ═══════════ MÁY CHỦ PHẢI TRẢ LỜI CÓ THỂ HÀNH ĐỘNG ĐƯỢC ═══════════
//
// Không đủ "nhận rồi / chưa ghi được". Máy chủ phải nói THẲNG: gán được vào đâu
// chưa, và NẾU CHƯA thì máy phải làm gì để lần sau gán được. Nếu không, máy cứ
// gửi lại một thứ mà máy chủ vĩnh viễn không gán được ⇒ **vòng lặp vô ích**,
// đúng thứ chủ dự án chỉ ra.
//
//   need = "none"       gán xong rồi — thôi, không gửi lại
//   need = "retry"      hạ tầng trục trặc, gửi lại là có cửa → bám thang
//   need = "login"      chưa có phiên: gửi mấy cũng KHÔNG BAO GIỜ gán được.
//                       DỪNG bám đuổi. Đăng nhập lại chính là một SỰ KIỆN nên
//                       lúc đó nhịp tự đi — không cần vòng lặp nào ở đây.
//   need = "wait_admin" nghe được, đọc được phiên, nhưng KHÔNG có hàng khách
//                       mang SĐT này. Máy sửa không được — việc của người ở bờ.
//                       DỪNG bám đuổi, hạ về nhịp định kỳ.

/** Hai loại nhịp — khác bản chất, khác luật thử lại */
export type HeartbeatKind = "event" | "state";

/** Nhịp ĐỊNH KỲ: 30 phút. "4G 5G khắp nơi, heartbeat thì nhẹ" (chủ dự án) */
export const STATE_GAP_MS = 30 * 60 * 1000;
/** Tên cũ, giữ để chỗ gọi/test cũ không phải đổi */
export const HEARTBEAT_MIN_GAP_MS = STATE_GAP_MS;

/*  NHỊP SỰ KIỆN bám theo thang này cho tới khi máy chủ XÁC NHẬN: 30 giây → 3
    phút → 5 phút, rồi GIỮ 5 phút (không lùi xa hơn, không bỏ cuộc).
    Vì sao không lùi tiếp như nhịp định kỳ: nhịp này chỉ chạy khi máy ĐANG
    ONLINE và đang có tin thật sự mới — bỏ cuộc là mất luôn tin đó. Chi phí tối
    đa là một request nhỏ mỗi 5 phút, và chỉ tới khi gán xong. */
export const EVENT_RETRY_STEPS_MS = [30 * 1000, 3 * 60 * 1000, 5 * 60 * 1000];

/** Hỏng lần thứ `failCount` thì chờ bao lâu trước khi bám lại (giữ nấc cuối) */
export function eventRetryMs(failCount: number): number {
  const steps = EVENT_RETRY_STEPS_MS;
  if (!Number.isFinite(failCount) || failCount < 1) return steps[0];
  return steps[Math.min(Math.round(failCount), steps.length) - 1];
}

/*  NHỊP ĐỊNH KỲ mà không nghe được máy chủ → lùi dần rồi thôi: 1 phút → 5 phút
    → 15 phút → trần 30 phút (đúng bằng nhịp thường — không bao giờ thưa hơn
    lúc khoẻ). Nhịp này KHÔNG bám đuổi: lỡ một lượt thì lượt sau bù. */
export const STATE_BACKOFF_STEPS_MS = [
  60 * 1000,
  5 * 60 * 1000,
  15 * 60 * 1000,
  STATE_GAP_MS,
];

export function stateBackoffMs(failCount: number): number {
  const steps = STATE_BACKOFF_STEPS_MS;
  if (!Number.isFinite(failCount) || failCount < 1) return steps[0];
  return steps[Math.min(Math.round(failCount), steps.length) - 1];
}

/** Tên cũ — nhịp định kỳ. Giữ cho chỗ gọi/test cũ. */
export const HEARTBEAT_NET_BACKOFF_STEPS_MS = STATE_BACKOFF_STEPS_MS;
export const netBackoffMs = stateBackoffMs;

/** Trần/sàn cho con số máy chủ điều tiết — máy KHÔNG giao trứng cho ác */
export const SERVER_GAP_MIN_MS = 30 * 1000;
export const SERVER_GAP_MAX_MS = 6 * 60 * 60 * 1000;
/** Máy chủ trả lời mà chưa gán được → nhịp định kỳ lo tiếp */
export const HEARTBEAT_SOFT_RETRY_MS = STATE_GAP_MS;

/**
 * Máy chủ bảo "bao lâu nữa gửi lại" → kẹp về khoảng dùng được.
 *
 * Đây là thứ DUY NHẤT máy chủ điều khiển được trên máy bà con, nên nó phải là
 * thứ KHÔNG THỂ dùng để gây hại: trả 0/âm/NaN mà máy nghe theo thì thành máy
 * đốt data; trả một tháng thì /quan-tri mù mà không ai biết vì sao.
 * Sàn 30 giây = đúng nấc đầu của nhịp sự kiện (máy chủ được phép giục nhanh
 * bằng nhưng không nhanh hơn).
 */
export function clampServerGapMs(v: unknown): number {
  const n = typeof v === "number" ? v : Number.NaN;
  if (!Number.isFinite(n)) return STATE_GAP_MS;
  return Math.min(SERVER_GAP_MAX_MS, Math.max(SERVER_GAP_MIN_MS, Math.round(n)));
}

/** Vì sao máy chủ chưa gán được — dùng chung cho cả hai phía */
export type HeartbeatReason =
  | "no_session"
  | "no_customer_row"
  | "write_failed";

/** Máy phải làm gì tiếp — máy chủ nói, máy nghe */
export type HeartbeatNeed = "none" | "retry" | "login" | "wait_admin";

/**
 * Máy chủ chưa gán được vì lý do này thì MÁY PHẢI LÀM GÌ — THUẦN, có test.
 *
 * Đây là chỗ chặn VÒNG LẶP VÔ ÍCH: chỉ `retry` mới đáng bám đuổi. Hai lý do
 * còn lại, gửi lại bao nhiêu lần cũng cho ra đúng câu trả lời đó.
 */
export function needFromReason(reason: HeartbeatReason | null): HeartbeatNeed {
  switch (reason) {
    case "no_session":
      return "login";
    case "no_customer_row":
      return "wait_admin";
    case "write_failed":
      return "retry";
    default:
      return "none";
  }
}

/**
 * Nhịp SỰ KIỆN có được bám đuổi tiếp không — THUẦN, có test.
 *
 * `null` = KHÔNG NGHE ĐƯỢC MÁY CHỦ (hết giờ · 5xx · mạng đứt) ⇒ vẫn bám: máy
 * chủ chưa hề nói gì thì tin của mình chưa ai nhận.
 */
export function shouldKeepChasing(need: HeartbeatNeed | null): boolean {
  return need == null || need === "retry";
}

/**
 * MÁY CHỦ ĐIỀU TIẾT NHỊP theo tình huống — THUẦN, có test.
 *  · gán xong            → nhịp định kỳ (30 phút)
 *  · chưa đăng nhập      → 2 giờ: gửi mấy cũng không quy về ai được
 *  · chưa có hàng khách  → 30 phút: việc của người ở bờ, sửa được trong ngày
 *  · ghi hỏng            → 1 phút: hạ tầng trục trặc, thường ngắn
 */
export function serverNextInMs(reason: HeartbeatReason | null): number {
  switch (reason) {
    case "no_session":
      return 2 * 60 * 60 * 1000;
    case "write_failed":
      return 60 * 1000;
    case "no_customer_row":
      return STATE_GAP_MS;
    default:
      return STATE_GAP_MS;
  }
}

/**
 * Có nên gửi lúc này không — THUẦN, có test.
 *
 * Thứ tự hàng rào KHÔNG được đổi:
 *  1. MẤT SÓNG → không bao giờ gửi (dòng chảy offline: im lặng tuyệt đối)
 *  2. ĐANG HOÃN → không gửi. Nhịp SỰ KIỆN dùng thang riêng (30 s) nên mốc hoãn
 *     của nó ngắn hơn hẳn; hoãn vẫn là hoãn, kể cả với tin mới — đường truyền
 *     đang hỏng thì gửi thêm chỉ tốn sóng.
 *  3. CÓ SỰ KIỆN CHƯA ĐƯỢC XÁC NHẬN → đi ngay, không chờ nhịp định kỳ.
 *  4. còn lại: đủ 30 phút thì gửi.
 */
export function shouldSendHeartbeat(args: {
  online: boolean;
  /** mốc lần nhịp ĐỊNH KỲ ghi được gần nhất */
  lastAt: number | null;
  /** sớm nhất được thử lại (mốc tuyệt đối) */
  retryAfter?: number | null;
  /** chữ ký hiện tại KHÁC chữ ký máy chủ đã xác nhận → có sự kiện chờ */
  sigChanged?: boolean;
  nowMs: number;
}): boolean {
  if (!args.online) return false;
  if (args.retryAfter != null && args.nowMs < args.retryAfter) return false;
  if (args.sigChanged) return true;
  if (args.lastAt != null && args.nowMs - args.lastAt < STATE_GAP_MS) {
    return false;
  }
  return true;
}

/**
 * Loại nhịp sắp gửi — THUẦN, có test. Có sự kiện chờ thì là nhịp SỰ KIỆN.
 */
export function heartbeatKind(sigChanged: boolean): HeartbeatKind {
  return sigChanged ? "event" : "state";
}

/**
 * Còn bao lâu nữa tới nhịp kế tiếp — THUẦN, có test.
 *
 * `UsageHeartbeat` đặt hẹn giờ theo con số này để nhịp chạy SUỐT PHIÊN. Trước
 * đây nhịp chỉ gửi lúc component mount, mà bản cài PWA mở lại từ nền KHÔNG
 * remount React ⇒ một máy dùng cả ngày vẫn chỉ có đúng một nhịp.
 *
 * CÓ SỰ KIỆN CHỜ thì mốc chờ là mốc hoãn của thang sự kiện, KHÔNG phải 30 phút.
 */
export function nextHeartbeatDelayMs(args: {
  lastAt: number | null;
  retryAfter?: number | null;
  /** đang có sự kiện chưa được máy chủ xác nhận */
  pending?: boolean;
  nowMs: number;
}): number {
  const dueByGap = args.pending
    ? args.nowMs
    : args.lastAt == null || args.lastAt > args.nowMs
      ? args.nowMs
      : args.lastAt + STATE_GAP_MS;
  const due = Math.max(dueByGap, args.retryAfter ?? 0);
  return Math.max(0, due - args.nowMs);
}
