"use client";

// MÁY TỰ BÁO ĐÃ MỞ APP — gửi về /api/me/heartbeat.
//
// ⚠️ RÀNG BUỘC SỐ MỘT: KHÔNG ĐƯỢC LÀM PHIỀN VIỆC ĐI BIỂN.
// Đây là tính năng cho NGƯỜI QUẢN TRỊ, không phải cho ngư dân. Nó tuyệt đối
// không được: chặn màn hình, ngốn sóng giữa biển, hay ném lỗi ra ngoài. Bốn
// hàng rào, theo đúng thứ tự:
//   1. MẤT SÓNG → không gọi gì cả (kiểm `navigator.onLine` trước tiên).
//   2. CỬA CHẶN 12 GIỜ/máy — mở app 20 lần/ngày cũng chỉ gửi một lần. Ngoài
//      khơi sóng yếu, mỗi request thừa là một lần tranh băng thông với tin bão.
//   3. ĐỒNG HỒ 8 giây + `.catch()` nuốt sạch — sóng "sống mà chết" (bắt tay
//      được, gói tin không về) không được để lại một promise treo.
//   4. GỌI TRONG useEffect, KHÔNG await ở đường vẽ màn — màn hình không bao giờ
//      phải đợi nó.
// Và nó là POST nên service worker bỏ qua hẳn: không cache, không cứu, không
// đụng gì tới kho offline.

import { apiUrl } from "@/lib/api-base";

/*  Mốc lần GHI ĐƯỢC gần nhất — quy ước key forfish.* (state-registry).
    v1 → v2 (2026-08-01g) VÌ ĐỔI NGHĨA: v1 là "đã GỬI ĐI" (ghi trước khi gửi),
    v2 là "máy chủ XÁC NHẬN GHI ĐƯỢC". Dùng lại tên cũ thì mọi máy đang mang
    dấu v1 của một cú gửi HỎNG sẽ bị đọc thành đã-thành-công và im tiếp tới 12
    giờ — đúng cái bug này. Dấu v1 để lại vô hại, không ai đọc nữa. */
export const HEARTBEAT_KEY = "forfish.heartbeat.v2";
/*  SỚM NHẤT ĐƯỢC THỬ LẠI (mốc tuyệt đối, không phải mốc lần thử) — tách khỏi
    mốc ghi được, 2026-08-01g. Xem ghi chú ở sendHeartbeat: hoãn bao lâu tuỳ
    kiểu hỏng, nên phải lưu MỐC chứ không lưu khoảng cách. */
export const HEARTBEAT_RETRY_KEY = "forfish.heartbeat.retry.v1";

/** GHI ĐƯỢC rồi thì im 12 giờ (mở app 20 lần/ngày cũng chỉ một nhịp) */
export const HEARTBEAT_MIN_GAP_MS = 12 * 60 * 60 * 1000;
/*  MÁY CHỦ TRẢ LỜI mà chưa ghi được (chưa có hàng khách / chưa đăng nhập) →
    thử lại sau 30 phút. Đã có phản hồi tức là ĐƯỜNG TRUYỀN VẪN TỐT, nên thử
    lại không tốn sóng của bà con. */
export const HEARTBEAT_SOFT_RETRY_MS = 30 * 60 * 1000;
/*  KHÔNG NHẬN ĐƯỢC PHẢN HỒI NÀO (hết 8 giây · sóng "sống mà chết" · mạng đứt
    giữa chừng) → lùi hẳn 12 giờ, ĐÚNG BẰNG bản cũ. Ngoài khơi đây là ca
    THƯỜNG, và mỗi lần thử là một lần tranh băng thông với tin bão — tuyệt đối
    không được thử dày hơn chỉ vì muốn đếm cho đủ số liệu quản trị. */
export const HEARTBEAT_NET_BACKOFF_MS = 12 * 60 * 60 * 1000;

/** Đồng hồ chặn: sóng treo thì bỏ, đừng để promise lửng lơ */
const HEARTBEAT_TIMEOUT_MS = 8000;

/**
 * Có nên gửi lúc này không — THUẦN, có test.
 *
 * LỖI ĐÃ SỬA (2026-08-01g) — "MỘT LẦN HỎNG = IM 12 TIẾNG": bản trước ghi dấu
 * TRƯỚC khi gửi và chỉ có MỘT cửa 12 giờ, nên bất kỳ trục trặc nào ở cú gửi đầu
 * (route cold-start · 503 · SĐT chưa khớp hàng khách) đều tiêu mất suất của cả
 * nửa ngày. Mà cú ĐẦU TIÊN chính là cú dễ hỏng nhất — nó rơi đúng lúc vừa đăng
 * nhập xong, service worker đang cài. Triệu chứng ngoài đời: khách dùng app cả
 * buổi mà /quan-tri vẫn ghi "Chưa ghi nhận", không ai biết vì sao.
 *
 * Cửa mở lại NHANH HƠN **chỉ khi máy chủ có trả lời** — tức đường truyền đang
 * tốt. Mất sóng thì vẫn lùi 12 giờ như cũ (xem sendHeartbeat).
 */
export function shouldSendHeartbeat(args: {
  online: boolean;
  /** mốc lần GHI ĐƯỢC gần nhất */
  lastAt: number | null;
  /** sớm nhất được thử lại (mốc tuyệt đối); null = không hoãn */
  retryAfter?: number | null;
  nowMs: number;
}): boolean {
  if (!args.online) return false;
  if (args.lastAt != null && args.nowMs - args.lastAt < HEARTBEAT_MIN_GAP_MS) {
    return false;
  }
  if (args.retryAfter != null && args.nowMs < args.retryAfter) return false;
  return true;
}

function readMark(key: string): number | null {
  try {
    const raw = window.localStorage.getItem(key);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeMark(key: string, at: number): void {
  try {
    window.localStorage.setItem(key, String(at));
  } catch {
    /* hết chỗ / chế độ riêng tư — bỏ qua, lần sau gửi lại */
  }
}

function clearMark(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* bỏ qua */
  }
}

/**
 * Gửi một nhịp. KHÔNG BAO GIỜ ném, không bao giờ chặn. Trả về `true` nếu có
 * gửi thật (dùng cho test/gỡ lỗi, chỗ gọi không cần đọc).
 */
export async function sendHeartbeat(info: {
  standalone: boolean;
  /** máy iOS — máy chủ cần biết để KHÔNG tính "đủ đồ" khi nhịp gửi từ Safari
   *  (bản cài trên iOS có kho riêng — xem lib/app-usage.ts) */
  ios: boolean;
  offlineReady: boolean;
}): Promise<boolean> {
  try {
    const online =
      typeof navigator === "undefined" ? false : navigator.onLine !== false;
    const now = Date.now();
    if (
      !shouldSendHeartbeat({
        online,
        lastAt: readMark(HEARTBEAT_KEY),
        retryAfter: readMark(HEARTBEAT_RETRY_KEY),
        nowMs: now,
      })
    ) {
      return false;
    }
    // HOÃN THEO KIỂU BI QUAN NGAY TRƯỚC KHI GỬI: coi như sẽ mất sóng (lùi 12
    // giờ). Hai lý do: (1) chặn gửi dồn nếu component mount lại trong cùng
    // phiên; (2) nếu máy tắt/mất sóng giữa chừng thì mốc bi quan là mốc còn
    // lại — an toàn cho đường truyền. Có phản hồi thì hạ xuống 30 phút ngay
    // bên dưới.
    writeMark(HEARTBEAT_RETRY_KEY, now + HEARTBEAT_NET_BACKOFF_MS);
    const res = await fetch(apiUrl("/api/me/heartbeat"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(info),
      signal: AbortSignal.timeout(HEARTBEAT_TIMEOUT_MS),
      keepalive: true,
    });
    // CÓ PHẢN HỒI = đường truyền tốt ⇒ hạ mức hoãn xuống 30 phút. Thử lại lúc
    // này không tốn sóng của bà con, mà lại gỡ được đúng ca "máy chủ chưa ghi
    // được" (chưa có hàng khách, chưa đăng nhập, cột chưa apply).
    writeMark(HEARTBEAT_RETRY_KEY, now + HEARTBEAT_SOFT_RETRY_MS);
    // ĐỌC CÂU TRẢ LỜI (2026-08-01g): trước đây không ai đọc `recorded`, nên
    // "gửi đi rồi" bị coi là "ghi được rồi".
    const body = (await res.json().catch(() => null)) as {
      recorded?: boolean;
    } | null;
    if (!res.ok || body?.recorded !== true) return false;
    // GHI ĐƯỢC → đóng cửa 12 giờ và bỏ mức hoãn
    writeMark(HEARTBEAT_KEY, now);
    clearMark(HEARTBEAT_RETRY_KEY);
    return true;
  } catch {
    // KHÔNG có phản hồi (hết giờ / mạng đứt) → giữ nguyên mốc bi quan 12 giờ
    // đã ghi ở trên. Đúng bằng nhịp của bản cũ, không đốt thêm sóng.
    return false;
  }
}
