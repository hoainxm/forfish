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

export {
  HEARTBEAT_MIN_GAP_MS,
  HEARTBEAT_NET_BACKOFF_STEPS_MS,
  HEARTBEAT_SOFT_RETRY_MS,
  netBackoffMs,
  nextHeartbeatDelayMs,
  shouldSendHeartbeat,
};
import { countsAsOfflineReady, type DevicePlatform } from "@/lib/app-usage";

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
  /** TÀI KHOẢN đang đăng nhập — vào chữ ký để ĐỔI TÀI KHOẢN là gửi ngay, không
   *  phải chờ hết cửa 12 giờ. KHÔNG gửi lên máy chủ (server tự đọc từ phiên,
   *  client không được khai mình là ai). */
  account?: string | null;
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
    const kind = heartbeatKind(pending);
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
    const res = await fetch(apiUrl("/api/me/heartbeat"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      // `account` CHỈ dùng cho chữ ký phía máy — máy chủ tự đọc tài khoản từ
      // cookie phiên, client khai gì cũng không được tin.
      body: JSON.stringify({ ...info, account: undefined }),
      signal: AbortSignal.timeout(HEARTBEAT_TIMEOUT_MS),
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
    if (res.status >= 500) return outcome(true, false);
    // CÓ PHẢN HỒI THẬT (2xx/4xx) = nghe được máy chủ ⇒ thang lùi-vì-mạng KHÔNG
    // áp dụng nữa: xoá bộ đếm hỏng.
    clearMark(HEARTBEAT_FAILS_KEY);
    // ĐỌC CÂU TRẢ LỜI (2026-08-01g): trước đây không ai đọc `recorded`, nên
    // "gửi đi rồi" bị coi là "ghi được rồi".
    const body = (await res.json().catch(() => null)) as {
      recorded?: boolean;
      attached?: boolean;
      need?: HeartbeatNeed;
      nextInMs?: number;
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
