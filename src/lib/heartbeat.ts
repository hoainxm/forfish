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
//      NGOẠI LỆ: TIN CÓ THẬT SỰ MỚI thì đi ngay, không phải chờ đồng hồ — xem
//      `beatSignature`.
//   3. ĐỒNG HỒ 5 giây + `.catch()` nuốt sạch — sóng "sống mà chết" (bắt tay
//      được, gói tin không về) không được để lại một promise treo.
//   4. GỌI TRONG useEffect, KHÔNG await ở đường vẽ màn — màn hình không bao giờ
//      phải đợi nó.
// Và nó là POST nên service worker bỏ qua hẳn: không cache, không cứu, không
// đụng gì tới kho offline.

import { apiUrl } from "@/lib/api-base";
import { countsAsOfflineReady } from "@/lib/app-usage";

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
/*  CHỮ KÝ của nhịp GHI ĐƯỢC gần nhất — xem beatSignature. */
export const HEARTBEAT_SIG_KEY = "forfish.heartbeat.sig.v1";

/** GHI ĐƯỢC rồi thì im 12 giờ (mở app 20 lần/ngày cũng chỉ một nhịp) */
export const HEARTBEAT_MIN_GAP_MS = 12 * 60 * 60 * 1000;
/*  MÁY CHỦ TRẢ LỜI mà chưa ghi được (chưa có hàng khách / chưa đăng nhập) →
    thử lại sau 30 phút. Đã có phản hồi tức là ĐƯỜNG TRUYỀN VẪN TỐT, nên thử
    lại không tốn sóng của bà con. */
export const HEARTBEAT_SOFT_RETRY_MS = 30 * 60 * 1000;
/*  KHÔNG NHẬN ĐƯỢC PHẢN HỒI NÀO (hết giờ · sóng "sống mà chết" · mạng đứt
    giữa chừng) → THANG LÙI DẦN, chủ dự án chốt 2026-08-01g: 3 phút → 5 phút →
    12 giờ. Vì sao không lùi thẳng 12 giờ: máy ĐANG ONLINE mà không nghe được
    máy chủ thường là trục trặc NGẮN (route cold-start, wifi cảng chập chờn,
    vừa đổi 4G↔wifi) — hai lần thử thưa trong 8 phút gỡ được hầu hết, mà tổng
    chi phí chỉ là 2 request nhỏ. Hết thang thì im 12 giờ ĐÚNG BẰNG bản cũ:
    ngoài khơi mỗi lần thử là một lần tranh băng thông với tin bão. */
export const HEARTBEAT_NET_BACKOFF_STEPS_MS = [
  3 * 60 * 1000,
  5 * 60 * 1000,
  12 * 60 * 60 * 1000,
];
/** Số lần hỏng LIÊN TIẾP (không phản hồi) — chọn nấc trong thang lùi */
export const HEARTBEAT_FAILS_KEY = "forfish.heartbeat.fails.v1";

/**
 * Hỏng lần thứ `failCount` (tính cả lần vừa rồi) thì chờ bao lâu — THUẦN, có
 * test. Quá thang → nấc cuối (12 giờ). `failCount` lạ/âm → nấc đầu.
 */
export function netBackoffMs(failCount: number): number {
  const steps = HEARTBEAT_NET_BACKOFF_STEPS_MS;
  if (!Number.isFinite(failCount) || failCount < 1) return steps[0];
  return steps[Math.min(Math.round(failCount), steps.length) - 1];
}

/** Đồng hồ chặn: chờ máy chủ 5 giây, không nghe thì bỏ (chủ dự án chốt) */
const HEARTBEAT_TIMEOUT_MS = 5000;

/**
 * CHỮ KÝ của một nhịp = phần TIN TỨC trong đó, rút gọn thành vài ký tự.
 * `"w-"` web chưa đủ đồ · `"wr"` web đã đủ đồ · `"p-"` bản cài chưa đủ đồ ·
 * `"pr"` bản cài + đủ đồ.
 *
 * VÌ SAO CÓ (2026-08-01h, chủ dự án hỏi "mở web rồi 5s sau mở PWA thì có chạy
 * không"): cửa 12 giờ gác theo THỜI GIAN, trong khi thứ cần báo là TRẠNG THÁI
 * ĐÃ ĐỔI. Hai cái lệch nhau đúng ở hai chỗ quan trọng nhất:
 *
 *  · web → BẢN CÀI: trên Android bản cài dùng CHUNG kho với Chrome, nên mở web
 *    lúc 15:00 rồi mở bản cài lúc 15:00:05 là nhịp thứ hai bị cửa 12 giờ chặn
 *    ⇒ `pwa_last_open_at` mãi null ⇒ /quan-tri báo "Chưa mở bản cài" cho ĐÚNG
 *    người vừa mở bản cài — sai đúng con số mà tính năng này sinh ra để đếm.
 *    (iOS không dính, nhưng chỉ vì kho A2HS tách riêng Safari — ăn may, không
 *    phải thiết kế.)
 *  · chưa đủ đồ → ĐỦ ĐỒ ĐI BIỂN: nặng hơn, dính CẢ HAI nền. Bà con tải xong
 *    gói đi biển lúc 15:00 thì `offline_ready_at` vẫn trống tới 03:00 sáng hôm
 *    sau ⇒ người đã sẵn sàng vẫn nằm trong danh sách đáng-gọi-điện, người thật
 *    sự thiếu thì lẫn vào đám đông. Đây là cột an toàn, không phải cột vui.
 *
 * Dùng `countsAsOfflineReady` (luật của MÁY CHỦ) chứ không dùng thẳng cờ
 * `offlineReady`: trên iOS-Safari máy chủ KHÔNG ghi "đủ đồ" dù client báo có,
 * nên cờ đó đổi mà chữ ký không đổi — khỏi gửi một nhịp chẳng ghi được gì.
 *
 * Chi phí sóng gần như không đổi: chữ ký chỉ đổi vài lần trong ĐỜI một máy
 * (lần đầu mở bản cài, lần đầu tải đủ đồ). Mở app hằng ngày thì chữ ký y
 * nguyên và vẫn im 12 tiếng như cũ.
 */
export function beatSignature(info: {
  standalone: boolean;
  ios: boolean;
  offlineReady: boolean;
}): string {
  const ready = countsAsOfflineReady({
    offlineReady: info.offlineReady,
    standalone: info.standalone,
    ios: info.ios,
  });
  return `${info.standalone ? "p" : "w"}${ready ? "r" : "-"}`;
}

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
  /** chữ ký nhịp này KHÁC lần ghi được gần nhất → tin mới, đi ngay */
  sigChanged?: boolean;
  nowMs: number;
}): boolean {
  if (!args.online) return false;
  // MỨC HOÃN VÌ MẠNG gác TRƯỚC và không ai vượt được: tin có mới tới đâu thì
  // đường truyền vẫn đang hỏng, gửi thêm chỉ tốn sóng.
  if (args.retryAfter != null && args.nowMs < args.retryAfter) return false;
  // TIN MỚI (đổi chế độ chạy / vừa đủ đồ đi biển) → không phải chờ đồng hồ.
  if (args.sigChanged) return true;
  if (args.lastAt != null && args.nowMs - args.lastAt < HEARTBEAT_MIN_GAP_MS) {
    return false;
  }
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

function readText(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeText(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* hết chỗ / chế độ riêng tư — bỏ qua */
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
    const sig = beatSignature(info);
    if (
      !shouldSendHeartbeat({
        online,
        lastAt: readMark(HEARTBEAT_KEY),
        retryAfter: readMark(HEARTBEAT_RETRY_KEY),
        sigChanged: readText(HEARTBEAT_SIG_KEY) !== sig,
        nowMs: now,
      })
    ) {
      return false;
    }
    // HOÃN THEO KIỂU BI QUAN NGAY TRƯỚC KHI GỬI: coi như sẽ không nghe được
    // máy chủ, lùi đúng nấc kế tiếp trong thang. Hai lý do: (1) chặn gửi dồn
    // nếu component mount lại trong cùng phiên; (2) máy tắt/mất sóng giữa
    // chừng thì mốc bi quan là mốc còn lại — an toàn cho đường truyền. Có
    // phản hồi thì hạ xuống 30 phút ngay bên dưới.
    const fails = (readMark(HEARTBEAT_FAILS_KEY) ?? 0) + 1;
    writeMark(HEARTBEAT_FAILS_KEY, fails);
    writeMark(HEARTBEAT_RETRY_KEY, now + netBackoffMs(fails));
    const res = await fetch(apiUrl("/api/me/heartbeat"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(info),
      signal: AbortSignal.timeout(HEARTBEAT_TIMEOUT_MS),
      keepalive: true,
    });
    // CÓ PHẢN HỒI = nghe được máy chủ ⇒ thang lùi-vì-mạng KHÔNG áp dụng nữa:
    // xoá bộ đếm hỏng và hạ mức hoãn xuống 30 phút. Thử lại lúc này không tốn
    // sóng của bà con, mà lại gỡ được đúng ca "máy chủ chưa ghi được" (chưa có
    // hàng khách, chưa đăng nhập, cột chưa apply).
    clearMark(HEARTBEAT_FAILS_KEY);
    writeMark(HEARTBEAT_RETRY_KEY, now + HEARTBEAT_SOFT_RETRY_MS);
    // ĐỌC CÂU TRẢ LỜI (2026-08-01g): trước đây không ai đọc `recorded`, nên
    // "gửi đi rồi" bị coi là "ghi được rồi".
    const body = (await res.json().catch(() => null)) as {
      recorded?: boolean;
    } | null;
    if (!res.ok || body?.recorded !== true) return false;
    // GHI ĐƯỢC → đóng cửa 12 giờ, nhớ CHỮ KÝ vừa báo, bỏ mọi mức hoãn.
    // Chữ ký chỉ ghi ở đây (sau khi máy chủ xác nhận) — gửi mà không ghi được
    // thì lần sau vẫn phải coi là tin mới.
    writeMark(HEARTBEAT_KEY, now);
    writeText(HEARTBEAT_SIG_KEY, sig);
    clearMark(HEARTBEAT_RETRY_KEY);
    return true;
  } catch {
    // KHÔNG nghe được máy chủ (hết 5 giây / mạng đứt) → giữ nguyên mốc bi quan
    // đã ghi ở trên (nấc kế tiếp trong thang 3 phút → 5 phút → 12 giờ).
    return false;
  }
}

/**
 * Còn được thử lại SỚM trong phiên này không, và sau bao lâu — để
 * `UsageHeartbeat` đặt hẹn giờ. Trả `null` khi đã hết thang nhanh (nấc cuối là
 * 12 giờ, không ai ngồi chờ trong một phiên) hoặc chưa hỏng lần nào.
 *
 * VÌ SAO CẦN: `sendHeartbeat` chỉ chạy lúc component mount, mà bà con thường
 * MỞ APP RỒI ĐỂ ĐÓ. Không có hẹn giờ thì "3 phút sau gửi lại" chỉ đúng nếu họ
 * tình cờ mở lại app đúng lúc — tức gần như không bao giờ.
 */
export function nextFastRetryDelayMs(): number | null {
  const fails = readMark(HEARTBEAT_FAILS_KEY) ?? 0;
  if (fails < 1) return null;
  // nấc cuối = bỏ cuộc trong phiên này
  if (fails >= HEARTBEAT_NET_BACKOFF_STEPS_MS.length) return null;
  const retryAfter = readMark(HEARTBEAT_RETRY_KEY);
  if (retryAfter == null) return null;
  return Math.max(0, retryAfter - Date.now());
}
