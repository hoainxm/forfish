"use client";

// MÁY TỰ BÁO ĐÃ MỞ APP — gửi về /api/me/heartbeat.
//
// ⚠️ RÀNG BUỘC SỐ MỘT: KHÔNG ĐƯỢC LÀM PHIỀN VIỆC ĐI BIỂN.
// Đây là tính năng cho NGƯỜI QUẢN TRỊ, không phải cho ngư dân. Nó tuyệt đối
// không được: chặn màn hình, ngốn sóng giữa biển, hay ném lỗi ra ngoài.
//
// HAI DÒNG CHẢY ĐỘC LẬP (chủ dự án chốt 2026-08-02c):
//   · MẤT SÓNG  → IM LẶNG TUYỆT ĐỐI. Không request, không hẹn giờ, không đụng
//                 gì tới kho dữ liệu offline.
//   · CÓ SÓNG   → nhịp 30 phút chạy suốt phiên, cộng bốn cú gửi ngay: mở app ·
//                 quay lại app · vừa có sóng lại · chữ ký đổi (đổi tài khoản /
//                 web→bản cài / vừa đủ đồ).
//
// Hàng rào, theo đúng thứ tự (luật thuần ở lib/heartbeat-policy.ts):
//   1. MẤT SÓNG → không gọi gì cả (kiểm `navigator.onLine` trước tiên).
//   2. ĐANG HOÃN vì mạng/máy chủ → không gửi, kể cả khi có tin mới.
//   3. TIN MỚI → đi ngay, không chờ hết nhịp (xem `beatSignature`).
//   4. ĐỒNG HỒ 5 giây + `.catch()` nuốt sạch — sóng "sống mà chết" (bắt tay
//      được, gói tin không về) không được để lại một promise treo.
//   5. GỌI TRONG useEffect, KHÔNG await ở đường vẽ màn.
// Và nó là POST nên service worker bỏ qua hẳn: không cache, không cứu, không
// đụng gì tới kho offline.
//
// HỢP ĐỒNG với máy chủ (ai khai gì, ai xác minh gì, chiều nào được phép) ghi
// đầy đủ ở đầu `lib/heartbeat-policy.ts` — đọc ở đó trước khi sửa.

import { apiUrl } from "@/lib/api-base";
/*  LUẬT NHỊP nằm ở module THUẦN dùng chung với máy chủ — file này chỉ lo phần
    CHẠY TRÊN MÁY (đọc/ghi localStorage, gọi mạng). Xuất lại để chỗ gọi và test
    cũ không phải đổi đường import. */
import {
  clampServerGapMs,
  eventDegradedToState,
  eventRetryMs,
  heartbeatKind,
  shouldKeepChasing,
  stateBackoffMs,
  type HeartbeatNeed,
  HEARTBEAT_MIN_GAP_MS,
  HEARTBEAT_NET_BACKOFF_STEPS_MS,
  HEARTBEAT_SOFT_RETRY_MS,
  netBackoffMs,
  nextHeartbeatDelayMs,
  shouldSendHeartbeat,
} from "@/lib/heartbeat-policy";
import { timeoutSignal } from "@/lib/abort";
import { DEVICE_TOKEN_HEADER } from "@/lib/device-token";
import { writePremiumMark } from "@/lib/tier";
import { readToken } from "@/lib/device-token-store";

export {
  HEARTBEAT_MIN_GAP_MS,
  HEARTBEAT_NET_BACKOFF_STEPS_MS,
  HEARTBEAT_SOFT_RETRY_MS,
  netBackoffMs,
  nextHeartbeatDelayMs,
  shouldSendHeartbeat,
};
import { countsAsOfflineReady, type DevicePlatform } from "@/lib/app-usage";
import {
  effectivePremiumMark,
  readPremiumMark,
  TIER_CACHE_KEY,
  TIER_UNTIL_KEY,
} from "@/lib/tier";

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
/** Số lần hỏng LIÊN TIẾP vì không nghe được máy chủ — chọn nấc trong thang lùi */
export const HEARTBEAT_FAILS_KEY = "forfish.heartbeat.fails.v1";
/*  Số lần MÁY CHỦ NỔ (5xx) LIÊN TIẾP — bộ đếm RIÊNG, cố ý KHÔNG trộn vào
    `fails`: `fails` mang nghĩa "không nghe được máy chủ" và thang định kỳ đang
    đọc nó, trộn vào là đổi nghĩa cả hai. Đây chỉ là cầu dao hạ nhịp SỰ KIỆN về
    ĐỊNH KỲ khi máy chủ chết (xem eventDegradedToState). */
export const HEARTBEAT_5XX_KEY = "forfish.heartbeat.5xx.v1";

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
  /** TÀI KHOẢN đang đăng nhập — phần quan trọng nhất của chữ ký, xem dưới */
  account?: string | null;
  standalone: boolean;
  offlineReady: boolean;
  /** MÃ MÁY — vào chữ ký từ 2026-08-02d: "device id để biết nó vẫn còn giữ cái
   *  id đó; nếu đổi thì nó báo NGAY, còn không thì định kỳ báo" (chủ dự án).
   *  Máy chủ dùng mã này để dọn 3 mốc khi bà con đổi điện thoại — mà nó chỉ dọn
   *  đúng nếu biết mã đã đổi, nên đây phải là SỰ KIỆN, không phải chuyện chờ
   *  nhịp định kỳ. */
  deviceId?: string | null;
}): string {
  const ready = countsAsOfflineReady({
    offlineReady: info.offlineReady,
    standalone: info.standalone,
  });
  /* TÀI KHOẢN NẰM TRONG CHỮ KÝ (lỗi đã sửa 2026-08-01o, chủ dự án phát hiện
     trên máy thật: "máy này trước đăng nhập 0938635689, sau đổi acc 012xx, nên
     cả cái trạng thái acc nó cũng không thay đổi").
     Bản trước chữ ký chỉ gồm chế độ chạy + đủ-đồ, nên ĐỔI TÀI KHOẢN trên cùng
     một máy là chữ ký y nguyên ⇒ cửa 12 giờ chặn ⇒ tài khoản MỚI không được ghi
     một mốc nào, /quan-tri đứng mãi ở "Chưa ghi nhận". Mà đổi tài khoản chính
     là TIN MỚI đáng gửi nhất: mốc đang nói về một người khác hẳn. */
  return `${info.account ?? "-"}|${info.standalone ? "p" : "w"}${ready ? "r" : "-"}|${info.deviceId ?? "-"}`;
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

/*  ═══ CỔNG RẺ: CÓ ĐÁNG QUÉT KHO KHÔNG ═══ (2026-08-02e)

    LỖI ĐÃ SỬA: chỗ gọi phải dựng ĐỦ `info` trước khi hỏi `sendHeartbeat`, mà
    hai mảnh của `info` (vỏ app đã cài đủ chưa · mọi lớp dữ liệu đã tải chưa)
    bắt buộc phải QUÉT SẠCH kho offline — hàng chục lượt `JSON.parse` trên vài
    chục MB, chạy TRÊN LUỒNG CHÍNH. Trong khi đó mọi hàng rào lại nằm BÊN TRONG
    `sendHeartbeat` và gần như luôn chặn (chưa tới hạn 30 phút) ⇒ quét sạch kho
    rồi vứt đi, mỗi lần mở/quay lại app. Android rẻ: khoá màn 0,5–1,5 giây.

    Ba trong bốn mảnh chữ ký đọc được KHÔNG cần quét: tài khoản · web/bản cài ·
    mã máy. Chỉ mảnh "đủ đồ đi biển" là đắt. Nên hỏi trước bằng ba mảnh rẻ.

    ⚠️ MẢNH ĐẮT KHÔNG ĐƯỢC RƠI MẤT (hồi quy do chính bản vá này đẻ ra, sửa
    2026-08-02f). Bản đầu chỉ so ba mảnh rẻ rồi thả mảnh thứ tư xuống cửa 30
    phút, và khai "trễ tối đa 30 phút". Con số đó CHỈ ĐÚNG nếu app còn mở và còn
    sóng sau 30 phút. Nhịp thật của bà con thì ngược lại: mở app ở cảng → mẻ
    pretrip chạy → `offlineReady` lật false→true → ĐÓNG APP, NHỔ NEO. Trong cả
    30 phút đó cổng rẻ nói "khỏi quét" ở mọi lượt ⇒ `offline_ready_at` KHÔNG BAO
    GIỜ được ghi ⇒ mất hẳn đường đo duy nhất của cột "máy này ra khơi được chưa".

    Cách vá RẺ NHẤT mà vẫn chắc — hai điều kiện, cả hai đọc được KHÔNG cần quét:
      · CHỈ khi đang chạy BẢN CÀI. Ở web, `countsAsOfflineReady` ép "đủ đồ" về
        false bất kể kho có gì (thang một chiều web → bản cài → tải), nên mảnh
        thứ tư KHÔNG THỂ đổi ⇒ cổng rẻ vốn đã chính xác tuyệt đối ở web.
      · CHỈ khi chữ ký ĐÃ XÁC NHẬN còn ghi "chưa đủ đồ". Ghi rồi thì cú lật
        false→true đã đi xong; chiều ngược (kho bị dọn) là tin xấu chứ không
        phải tin gấp — nhịp định kỳ 30 phút lo là đủ.
    Thoả cả hai thì hạ cửa từ 30 phút xuống 5 phút (`HEARTBEAT_SCAN_MIN_GAP_MS`).
    Giá: nhiều nhất MỘT lượt quét mỗi 5 phút, và chỉ với máy bản-cài-chưa-đủ-đồ
    (ở HEAD là quét MỌI lượt mở app, mọi máy). Máy đã đủ đồ và mọi máy chạy web
    giữ nguyên cửa 30 phút.

    ⛔ BẤT BIẾN KHÔNG ĐỔI: mất sóng vẫn là 0 request và 0 lượt quét kho — hàng
    rào `navigator.onLine` đứng TRƯỚC toàn bộ chỗ này. */

/** Cửa RÚT NGẮN cho riêng ca "bản cài mà chữ ký còn ghi chưa đủ đồ" — xem trên.
 *  Đủ ngắn để bắt được cú lật ngay ở lượt mở app kế tiếp, đủ dài để không biến
 *  việc chuyển qua lại giữa hai app thành một chuỗi quét kho. */
export const HEARTBEAT_SCAN_MIN_GAP_MS = 5 * 60 * 1000;

/** Phần RẺ của chữ ký (tài khoản · chế độ chạy · mã máy) — GIỮ ĐỒNG BỘ với
 *  `beatSignature`: mảnh thứ tư (đủ đồ đi biển) cố ý bỏ ra ngoài vì nó đắt. */
function cheapKey(c: {
  account?: string | null;
  standalone: boolean;
  deviceId?: string | null;
}): string {
  return `${c.account ?? "-"}|${c.standalone ? "p" : "w"}|${c.deviceId ?? "-"}`;
}

/** Cắt phần rẻ ra khỏi một chữ ký ĐẦY ĐỦ đã lưu. Khuôn lạ (chữ ký đời cũ sau
 *  một lần đổi khuôn, dữ liệu hỏng) → `null` = coi như KHÁC ⇒ cứ quét. Thà quét
 *  thừa một lượt còn hơn bỏ rơi một tin. */
function cheapKeyOfSig(sig: string): string | null {
  const p = sig.split("|");
  if (p.length !== 3 || p[1].length < 1) return null;
  return `${p[0]}|${p[1].slice(0, 1)}|${p[2]}`;
}

/** Chữ ký ĐÃ ĐƯỢC MÁY CHỦ XÁC NHẬN có đang nói "đủ đồ đi biển" không (ký tự thứ
 *  hai của mảnh giữa: `"pr"` = bản cài + đủ đồ). Khuôn lạ → trả `false` = coi
 *  như CHƯA đủ, tức nghiêng về phía QUÉT THỪA một lượt; ngược lại là bỏ rơi
 *  đúng cái sự kiện đắt nhất. */
function sigSaysReady(sig: string): boolean {
  const p = sig.split("|");
  return p.length === 3 && p[1].length >= 2 && p[1][1] === "r";
}

/**
 * CÓ ĐÁNG QUÉT KHO KHÔNG — `false` = chắc chắn `sendHeartbeat` sẽ không gửi,
 * nên khỏi dựng `info` (khỏi quét). THUẦN về mặt hành vi (chỉ đọc localStorage
 * + `navigator.onLine`), có test.
 *
 * MIRROR ĐÚNG THỨ TỰ HÀNG RÀO của `shouldSendHeartbeat`, chỉ khác ở chỗ dùng ba
 * mảnh RẺ thay cho chữ ký đầy đủ:
 *   1. mất sóng → false (im lặng tuyệt đối — bất biến số một)
 *   2. đang hoãn (mạng/máy chủ) → false, kể cả khi ba mảnh rẻ vừa đổi
 *   3. chưa có chữ ký nào được xác nhận → true
 *   4. một trong ba mảnh rẻ đã đổi → true (sự kiện: đổi tài khoản/bản cài/máy)
 *   4b. BẢN CÀI mà chữ ký còn ghi "chưa đủ đồ" → cửa rút ngắn còn 5 phút: mảnh
 *       thứ tư có thể vừa lật mà không mảnh rẻ nào nhìn thấy (xem chú thích
 *       khối trên — đây là chỗ hồi quy "offline_ready_at không bao giờ ghi")
 *   5. còn lại → đã qua cửa 30 phút chưa
 */
export function heartbeatNeedsScan(
  c: {
    account?: string | null;
    standalone: boolean;
    deviceId?: string | null;
  },
  nowMs = Date.now(),
): boolean {
  const online =
    typeof navigator === "undefined" ? false : navigator.onLine !== false;
  if (!online) return false;
  const retryAfter = readMark(HEARTBEAT_RETRY_KEY);
  if (retryAfter != null && nowMs < retryAfter) return false;
  const saved = readText(HEARTBEAT_SIG_KEY);
  if (saved == null) return true;
  if (cheapKeyOfSig(saved) !== cheapKey(c)) return true;
  const lastAt = readMark(HEARTBEAT_KEY);
  /* mốc tương lai (đồng hồ máy bị chỉnh lùi) cho `since` ÂM ⇒ cả cửa rút ngắn
     lẫn cửa 30 phút đều ra false — đúng y `shouldSendHeartbeat`, đừng để hai
     bên nói hai thứ khác nhau */
  const since = lastAt == null ? Number.POSITIVE_INFINITY : nowMs - lastAt;
  if (c.standalone && !sigSaysReady(saved) && since >= HEARTBEAT_SCAN_MIN_GAP_MS)
    return true;
  if (since < HEARTBEAT_MIN_GAP_MS) return false;
  return true;
}

/**
 * LỚP CÁ CÓ ĐANG KHOÁ KHÔNG — đọc DẤU HẠNG ĐÃ LƯU trong máy, TUYỆT ĐỐI không
 * gọi mạng. Ở trong `lib/` (không nằm trong component) để có test — đây là một
 * trong hai đầu vào quyết định cột "đủ đồ đi biển".
 *
 * VÌ SAO CÓ (2026-08-02e): nhịp gọi `savedCoverage({})` — không truyền
 * `fishLocked` — nên lớp `fish` luôn `retriable: true`. Khách KHÔNG premium bị
 * middleware chặn `/api/fish-forecast` nên lớp đó VĨNH VIỄN không có trong máy
 * ⇒ `allSaved` mãi false ⇒ `offline_ready_at` không bao giờ được ghi cho NHÓM
 * ĐÔNG NHẤT, tức cột an toàn đó chỉ đo được thiểu số premium.
 *
 * ⚠️ CHỈ `"basic"` MỚI LÀ KHOÁ (hồi quy do chính bản vá 02e đẻ ra, sửa
 * 2026-08-02f). Bản đầu viết `mark !== "premium"`, nên `"unknown"` — khách
 * premium MỞ APP LẦN ĐẦU, hoặc dấu vừa bị xoá / chưa tra xong — cũng bị coi là
 * khoá ⇒ lớp `fish` rơi khỏi phép đếm ⇒ nhịp báo `offlineReady: true` DÙ BẢN ĐỒ
 * CÁ CHƯA HỀ CÓ TRONG MÁY. Với cột "máy này ra khơi được chưa" thì BÁO THỪA mới
 * là chiều nguy hiểm: người trực tổng đài không gọi nhắc, bà con nhổ neo với lớp
 * cá trống. Báo THIẾU thì cùng lắm là một cú điện thoại thừa.
 *
 * Đọc kho ném (chế độ riêng tư / storage bị chặn) → cũng là "chưa biết" ⇒ KHÔNG
 * khoá, tức vẫn đòi lớp cá.
 */
export function fishLockedFromMark(nowMs = Date.now()): boolean {
  try {
    const mark = effectivePremiumMark(
      readPremiumMark(readText(TIER_CACHE_KEY)),
      readText(TIER_UNTIL_KEY),
      nowMs,
    );
    return mark === "basic";
  } catch {
    return false;
  }
}

/**
 * NGÀY PHỦ CỐT LÕI của kho offline — THUẦN, có test.
 *
 * VÌ SAO CÓ (2026-08-02e): nhịp trước đây báo lên `savedUntil = cov.untilIso`,
 * mà `untilIso` chỉ đo ĐÚNG MỘT LỚP — gió sóng theo ĐIỂM GHIM. Sai cả hai chiều,
 * và cả hai chiều đều sai về phía NGUY HIỂM:
 *  · lưới CẢ VÙNG bị dọn mà điểm ghim còn ⇒ /quan-tri báo "tới 18/08" trong khi
 *    thứ bà con thật sự mở ra giữa biển đã mất;
 *  · lớp `point` là BẬC HY SINH ĐẦU khi máy hết chỗ ⇒ nó bị dọn trước ⇒
 *    `untilIso = null` ⇒ máy chủ bỏ qua (`if (savedUntil)`) ⇒ cột giữ nguyên
 *    con số CŨ đã lỗi thời.
 * Đây là số liệu để quyết định có gọi nhắc bà con hay không, nên phải là ngày
 * SỚM NHẤT giữa các lớp cốt lõi CÒN TRONG MÁY.
 *
 * ⚠️ THIẾU MỘT LỚP KHÔNG ĐƯỢC RA `null` (hồi quy do chính bản vá 02e đẻ ra, sửa
 * 2026-08-02f). Bản đầu để `if (!gridUntil || !pointUntil) return null`, mà
 * `point` chính là bậc hy sinh ĐẦU TIÊN — máy vừa bị dọn `point` là gửi lên
 * `null`, và máy chủ đọc `null` thành "bỏ qua, giữ nguyên cột" (`if (savedUntil)`
 * trong `app/api/me/heartbeat/route.ts`) ⇒ `data_until` ĐÓNG BĂNG ở một ngày cũ
 * NẰM TRONG TƯƠNG LAI. Vẫn là lỗi "sai về phía nguy hiểm", chỉ đổi từ *sai số*
 * sang *số chết* — mà số chết còn tệ hơn vì trông y như số đúng.
 * Nay: ngày SỚM NHẤT trong các lớp CÒN LẠI. Mất `point` mà còn lưới ⇒ báo ngày
 * của lưới (lưới mới là thứ bà con mở ra giữa biển) — con số vẫn ĐỘNG, vẫn tụt
 * xuống theo đúng nhịp dữ liệu cũ đi, nên người trực tổng đài nhìn ra.
 *
 * `null` chỉ còn nghĩa DUY NHẤT: **không còn lớp cốt lõi nào** để nói. Ca đó máy
 * chủ hiện vẫn giữ số cũ — cần một đường "xoá cột" ở route (ngoài phạm vi file
 * này, đã báo cáo chủ dự án).
 *
 * KHÔNG đụng `cov.untilIso`: chip màn Ra khơi đang dùng nó với đúng nghĩa
 * "điểm ghim", đổi nghĩa ở đó là hỏng một câu chữ khác.
 */
export function coreSavedUntil(
  gridUntil: string | null | undefined,
  pointUntil: string | null | undefined,
): string | null {
  // ISO `YYYY-MM-DD` so chuỗi là so ngày — không cần Date.parse
  const present = [gridUntil, pointUntil].filter(
    (d): d is string => typeof d === "string" && d.length > 0,
  );
  if (present.length === 0) return null;
  return present.reduce((a, b) => (a < b ? a : b));
}

/** Kết quả một nhịp — chỗ gọi chỉ cần đọc `nextInMs` để hẹn lượt sau */
export interface HeartbeatOutcome {
  /** có gửi thật không (false = bị hàng rào chặn, hoàn toàn bình thường) */
  sent: boolean;
  /** máy chủ đã NHẬN **VÀ GÁN ĐƯỢC** — chỉ khi này mới thôi bám */
  attached: boolean;
  /** còn bao lâu nữa nên gọi lại (đã tính cả hai thang) */
  nextInMs: number;
}

/**
 * Gửi một nhịp. KHÔNG BAO GIỜ ném, không bao giờ chặn.
 */
export async function sendHeartbeat(info: {
  /*  TÀI KHOẢN đang đăng nhập — vào chữ ký để ĐỔI TÀI KHOẢN là gửi ngay, không
      phải chờ hết cửa 30 phút. KHÔNG gửi lên máy chủ (server tự đọc từ phiên,
      client không được khai mình là ai).

      BẮT BUỘC, KHÔNG `?` (sửa 2026-08-02e — MÃ CHẾT): chỗ gọi duy nhất
      (`components/usage-heartbeat.tsx`) quên không truyền trường này, mà kiểu cũ
      để `?` nên TypeScript im lặng ⇒ chữ ký luôn dựng `"-|…"` ⇒ đổi tài khoản
      trên cùng một máy cho ra chữ ký y hệt ⇒ `pending = false` ⇒ bị cửa 30 phút
      chặn ⇒ TOÀN BỘ bản vá "đổi tài khoản = sự kiện" (sinh ra từ đúng ca chủ dự
      án bắt được trên máy thật) chưa từng chạy một lần nào. Để `string | null`
      thì trình biên dịch gác hộ, khỏi cần test runtime. */
  account: string | null;
  standalone: boolean;
  offlineReady: boolean;
  /** loại máy THÔ để nhân viên gọi điện chỉ đúng bước cài (ios|android|khac).
   *  KHÔNG BAO GIỜ gửi user-agent đầy đủ — xem lib/storage-persist.ts */
  platform?: DevicePlatform;
  /** mã máy (app tự sinh) — máy chủ nhận ra ĐỔI MÁY để reset mốc; null khi
   *  storage bị chặn, khi đó máy chủ giữ nguyên hành vi cũ */
  deviceId?: string | null;
  /*  NGÀY XA NHẤT dữ liệu đi biển trong máy còn phủ tới (ISO `YYYY-MM-DD`).
      Đây là thứ người trực tổng đài cần nhất: máy này ra khơi ngày mai thì
      trong tay bà con có dự báo tới ngày nào.
      CỐ Ý KHÔNG VÀO CHỮ KÝ: ngày này đổi sau MỖI lượt tải, đưa vào chữ ký là
      biến mọi lượt tải thành một "sự kiện" và máy bắn nhịp liên tục. Nó thuộc
      về NHỊP ĐỊNH KỲ — 30 phút báo một lần là quá đủ cho một con số ngày. */
  savedUntil?: string | null;
  /*  KHO CỦA MÁY (0029) — `navigator.storage.estimate()`. Thuộc NHỊP ĐỊNH KỲ,
      CỐ Ý KHÔNG vào chữ ký: số này nhúc nhích sau mỗi lượt tải, đưa vào chữ ký
      là biến mọi lượt tải thành "sự kiện" và máy bắn nhịp liên tục. 30 phút một
      lần là quá đủ cho một con số dung lượng. */
  storageQuotaMb?: number | null;
  storageUsedMb?: number | null;
}): Promise<HeartbeatOutcome> {
  /*  Trả về CẢ MỐC HẸN GIỜ, không chỉ true/false (2026-08-02d). Chỗ gọi từng
      phải tự đoán "bao lâu nữa gọi lại" — mà nó không biết nhịp này là SỰ KIỆN
      hay ĐỊNH KỲ, nên đoán sai là hoặc bám quá gắt hoặc bỏ rơi một tin mới. Ai
      biết thì người đó trả lời. */
  const outcome = (sent: boolean, attached: boolean): HeartbeatOutcome => ({
    sent,
    attached,
    nextInMs: nextHeartbeatDelayNow(beatSignature(info)),
  });
  try {
    const online =
      typeof navigator === "undefined" ? false : navigator.onLine !== false;
    const now = Date.now();
    const sig = beatSignature(info);
    /*  CÓ SỰ KIỆN CHỜ KHÔNG = chữ ký hiện tại có khác chữ ký MÁY CHỦ ĐÃ XÁC
        NHẬN không. Chữ ký gồm: tài khoản · web/bản cài · đủ-đồ-đi-biển · MÃ MÁY
        (thêm 2026-08-02d — "device id để biết nó vẫn còn giữ cái id đó, đổi thì
        báo ngay"). Khác một trong bốn = có tin mới chưa ai nhận. */
    const pending = readText(HEARTBEAT_SIG_KEY) !== sig;
    /*  CẦU DAO 5xx: máy chủ nổ liên tiếp thì HẠ nhịp sự kiện về nhịp định kỳ
        (trần 30 phút thay vì bám 5 phút). Tin KHÔNG mất — `pending` vẫn true,
        chữ ký vẫn chưa ghi — chỉ chậm lại. Xem eventDegradedToState. */
    const serverErrors = readMark(HEARTBEAT_5XX_KEY) ?? 0;
    const kind = heartbeatKind(pending && !eventDegradedToState(serverErrors));
    if (
      !shouldSendHeartbeat({
        online,
        lastAt: readMark(HEARTBEAT_KEY),
        retryAfter: readMark(HEARTBEAT_RETRY_KEY),
        sigChanged: pending,
        nowMs: now,
      })
    ) {
      return outcome(false, false);
    }
    /*  HOÃN THEO KIỂU BI QUAN NGAY TRƯỚC KHI GỬI: coi như sẽ không nghe được
        máy chủ, lùi đúng nấc kế tiếp. Hai lý do: (1) chặn gửi dồn nếu component
        mount lại trong cùng phiên; (2) máy tắt/mất sóng giữa chừng thì mốc bi
        quan là mốc còn lại.
        HAI THANG KHÁC HẲN NHAU: nhịp SỰ KIỆN bám 30 giây → 3 phút → 5 phút cho
        tới khi được xác nhận (tin không được mất); nhịp ĐỊNH KỲ lùi 1 → 5 → 15
        → 30 phút rồi thôi (lỡ lượt này thì lượt sau bù). */
    const fails = (readMark(HEARTBEAT_FAILS_KEY) ?? 0) + 1;
    writeMark(HEARTBEAT_FAILS_KEY, fails);
    writeMark(
      HEARTBEAT_RETRY_KEY,
      now + (kind === "event" ? eventRetryMs(fails) : stateBackoffMs(fails)),
    );
    /*  GẮN CHUỖI CỨNG BẰNG TAY, KHÔNG QUA `authedFetch` (2026-08-02).
        `authedFetch` có quyền kết luận "máy bị đá" và xoá chuỗi khi thấy 401 —
        đúng cho các đường bà con vừa bấm, SAI cho một nhịp nền chạy 30 phút một
        lần. Route heartbeat cố ý luôn trả HTTP 200, nhưng chỉ cần một proxy hay
        một bản deploy lỡ trả 401 là cả đội tàu tự gỡ tài khoản trong im lặng.
        Nhịp này chỉ được ĐỌC câu trả lời, không được rút ra kết luận nào về
        quyền đăng nhập. */
    const tokenHeaders: Record<string, string> = {
      "content-type": "application/json",
    };
    const tok = readToken();
    if (tok) tokenHeaders[DEVICE_TOKEN_HEADER] = tok;
    const res = await fetch(apiUrl("/api/me/heartbeat"), {
      method: "POST",
      headers: tokenHeaders,
      // `account` CHỈ dùng cho chữ ký phía máy — máy chủ tự đọc tài khoản từ
      // cookie phiên, client khai gì cũng không được tin.
      body: JSON.stringify({ ...info, account: undefined }),
      /*  KHÔNG gọi thẳng `AbortSignal.timeout` (sửa 2026-08-02e): hàm tĩnh đó
          chỉ có từ Safari 16, máy cũ của bà con (iPhone còn Safari 15) ném
          `TypeError` NGAY TRONG khối try này ⇒ nhịp chết câm, mà `fails` và mốc
          hoãn thì đã ghi ở trên rồi ⇒ trả đủ giá quét kho mà chưa gửi được một
          byte nào. `timeoutSignal` có đường lùi AbortController thật. */
      signal: timeoutSignal(HEARTBEAT_TIMEOUT_MS),
      keepalive: true,
    });
    /*  MÁY CHỦ NỔ (5xx) KHÔNG PHẢI LÀ "ĐÃ TRẢ LỜI" (sửa 2026-08-02c).
        LỖI ĐÃ SỬA — bắt được trên production: route heartbeat trả 500 suốt gần
        một ngày (import nhầm module "use client"), mà client lại coi "có phản
        hồi" = đường truyền tốt ⇒ XOÁ bộ đếm hỏng ⇒ `nextFastRetryDelayMs()`
        trả `null` ⇒ **không hẹn giờ thử lại trong phiên**, chỉ đặt hoãn 30
        phút. Bản cài PWA thì không remount khi mở lại từ nền, nên thực tế mỗi
        máy chỉ thử đúng một lần rồi im — /quan-tri đứng hình mà không ai biết.
        Nay 5xx đi chung đường với mất-sóng: giữ nguyên mốc bi quan đã ghi ở
        trên, để thang lùi và hẹn giờ trong phiên vẫn chạy. */
    if (res.status >= 500) {
      /*  ĐẾM RIÊNG 5xx (2026-08-02e) — nếu không, nhánh này thoát TRƯỚC dòng
          `clearMark(HEARTBEAT_FAILS_KEY)` và chữ ký thì chỉ ghi khi ghi được ⇒
          `pending` mãi true ⇒ `kind` mãi "event" ⇒ bám 5 phút/lần VĨNH VIỄN vào
          một máy chủ đang chết. Quá ngưỡng thì nhịp tự hạ về định kỳ. */
      writeMark(HEARTBEAT_5XX_KEY, serverErrors + 1);
      return outcome(true, false);
    }
    // CÓ PHẢN HỒI THẬT (2xx/4xx) = nghe được máy chủ ⇒ thang lùi-vì-mạng KHÔNG
    // áp dụng nữa: xoá bộ đếm hỏng. Máy chủ sống lại (kể cả trả 4xx) ⇒ nhả cầu
    // dao 5xx, thang sự kiện được bám gắt trở lại.
    clearMark(HEARTBEAT_5XX_KEY);
    clearMark(HEARTBEAT_FAILS_KEY);
    // ĐỌC CÂU TRẢ LỜI (2026-08-01g): trước đây không ai đọc `recorded`, nên
    // "gửi đi rồi" bị coi là "ghi được rồi".
    const body = (await res.json().catch(() => null)) as {
      recorded?: boolean;
      attached?: boolean;
      need?: HeartbeatNeed;
      nextInMs?: number;
      /*  HẠNG ĐI NHỜ NHỊP NÀY (2026-08-02g) — thay hẳn nhịp tra hạng riêng của
          `use-tier`. Chủ dự án: *"token lúc đăng nhập đã biết hạng rồi, check
          riêng làm gì"*. Đúng — thứ duy nhất còn cần máy chủ là hạng ĐỔI SAU khi
          đăng nhập (nhân viên gán premium ở /quan-tri), mà nhịp này đã nói
          chuyện với máy chủ về đúng tài khoản đó, 30 phút/lần, và **im lặng
          tuyệt đối khi mất sóng**. Nhịp riêng vừa thừa vừa còn gọi lúc offline. */
      tier?: string;
      premiumUntil?: string | null;
    } | null;
    /*  MÁY CHỦ NÓI MÁY PHẢI LÀM GÌ (2026-08-02d) — chỗ chặn VÒNG LẶP VÔ ÍCH.
        Chưa gán được mà cứ bám đuổi thì có ca gửi mãi mãi không bao giờ gán
        được: `login` (chưa có phiên) và `wait_admin` (không có hàng khách mang
        SĐT này — việc của người ở bờ). Hai ca đó DỪNG bám, hạ về nhịp định kỳ;
        riêng `login` thì lúc bà con đăng nhập lại chính là một SỰ KIỆN nên nhịp
        tự đi, không cần vòng lặp nào ở đây. */
    const need: HeartbeatNeed = body?.need ?? "none";
    if (kind === "event" && !shouldKeepChasing(need)) {
      clearMark(HEARTBEAT_FAILS_KEY);
    }
    /*  MÁY CHỦ ĐIỀU TIẾT NHỊP — chiều ngược DUY NHẤT được phép. Máy chủ biết
        nhiều hơn máy khách nên để nó xếp lịch, khỏi deploy lại app mỗi lần muốn
        đổi nhịp. NHƯNG máy KHÔNG giao trứng cho ác: `clampServerGapMs` kẹp về
        [30 giây, 6 giờ] — lỡ trả 0 thì không biến máy bà con thành máy đốt
        data, lỡ trả một tháng thì không làm /quan-tri mù.
        Còn đang bám sự kiện thì thang sự kiện (đã ghi ở trên) được ưu tiên —
        máy chủ không được kéo dài một tin chưa ai nhận. */
    const chasing = kind === "event" && shouldKeepChasing(need);
    if (!chasing) {
      const gap =
        body?.nextInMs === undefined
          ? HEARTBEAT_SOFT_RETRY_MS
          : clampServerGapMs(body.nextInMs);
      writeMark(HEARTBEAT_RETRY_KEY, now + gap);
    }
    if (!res.ok || body?.recorded !== true) return outcome(true, false);
    /*  GHI DẤU HẠNG — chỉ khi máy chủ ĐÃ GHI ĐƯỢC (`recorded === true`), tức nó
        thật sự tìm thấy hàng khách và đọc được cột `tier`. Mọi ca khác
        (`no_customer_row`, `write_failed`, 5xx, mất sóng) đều không tới được
        dòng này — ghi bừa ở đây là xoá quyền của người đã trả tiền, giữa biển.
        `tier` chỉ nhận đúng hai giá trị máy chủ phát ra; chuỗi lạ → bỏ qua, giữ
        nguyên dấu cũ (thà cũ còn hơn sai). */
    if (typeof body.tier === "string") {
      /*  `marked` = ĐÚNG CỘT THÔ, không xét hạn ở đây (luật E4). Hạn lưu riêng
          và chỉ đem ra xét lúc ĐỌC, có biên 7 ngày — nhờ vậy hết hạn thật thì
          dấu cũng hết, mà đồng hồ máy lệch vài ngày thì không mất quyền.
          `until` chỉ giữ khi CÓ dấu premium, y như đường ghi cũ trong use-tier. */
      const marked = body.tier === "premium";
      writePremiumMark(marked, marked ? (body.premiumUntil ?? null) : null);
    }
    // GHI ĐƯỢC → đóng cửa 12 giờ, nhớ CHỮ KÝ vừa báo, bỏ mọi mức hoãn.
    // Chữ ký chỉ ghi ở đây (sau khi máy chủ xác nhận) — gửi mà không ghi được
    // thì lần sau vẫn phải coi là tin mới.
    writeMark(HEARTBEAT_KEY, now);
    writeText(HEARTBEAT_SIG_KEY, sig);
    clearMark(HEARTBEAT_RETRY_KEY);
    return outcome(true, true);
  } catch {
    // KHÔNG nghe được máy chủ (hết 5 giây / mạng đứt) → giữ nguyên mốc bi quan
    // đã ghi ở trên (nấc kế tiếp trong thang của đúng loại nhịp).
    return outcome(true, false);
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
/** Bản đọc-thẳng-máy của `nextHeartbeatDelayMs` — cho chỗ đặt hẹn giờ.
 *  `sig` = chữ ký của trạng thái HIỆN TẠI; khác chữ ký đã được máy chủ xác nhận
 *  thì đang có sự kiện chờ, và lúc đó hẹn giờ phải theo thang sự kiện (nhanh)
 *  chứ không phải 30 phút. */
export function nextHeartbeatDelayNow(sig?: string): number {
  return nextHeartbeatDelayMs({
    lastAt: readMark(HEARTBEAT_KEY),
    retryAfter: readMark(HEARTBEAT_RETRY_KEY),
    pending: sig != null && readText(HEARTBEAT_SIG_KEY) !== sig,
    nowMs: Date.now(),
  });
}

export function nextFastRetryDelayMs(): number | null {
  const fails = readMark(HEARTBEAT_FAILS_KEY) ?? 0;
  if (fails < 1) return null;
  // nấc cuối = bỏ cuộc trong phiên này
  if (fails >= HEARTBEAT_NET_BACKOFF_STEPS_MS.length) return null;
  const retryAfter = readMark(HEARTBEAT_RETRY_KEY);
  if (retryAfter == null) return null;
  return Math.max(0, retryAfter - Date.now());
}
