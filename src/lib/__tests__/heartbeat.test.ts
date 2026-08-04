import { beforeEach, describe, expect, it } from "vitest";

/*  localStorage + navigator giả (env node — không jsdom), khớp mẫu
    pretrip.test / forecast-cache.test. Cần cho nhóm test `heartbeatNeedsScan`:
    hàm đó ĐỌC KHO để trả lời "có đáng quét kho không". */
const _ls = (() => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  } as Storage;
})();
(globalThis as unknown as { window: unknown }).window = { localStorage: _ls };
(globalThis as unknown as { localStorage: Storage }).localStorage = _ls;
const _nav = { onLine: true };
Object.defineProperty(globalThis, "navigator", {
  value: _nav,
  configurable: true,
  writable: true,
});

import {
  beatSignature,
  shouldSendHeartbeat,
  netBackoffMs,
  nextHeartbeatDelayMs,
  HEARTBEAT_MIN_GAP_MS,
  HEARTBEAT_NET_BACKOFF_STEPS_MS,
  HEARTBEAT_SOFT_RETRY_MS,
  HEARTBEAT_KEY,
  HEARTBEAT_RETRY_KEY,
  HEARTBEAT_SIG_KEY,
  HEARTBEAT_FAILS_KEY,
  HEARTBEAT_5XX_KEY,
  coreSavedUntil,
  fishLockedFromMark,
  heartbeatNeedsScan,
  sendHeartbeat,
  HEARTBEAT_SCAN_MIN_GAP_MS,
} from "@/lib/heartbeat";
import { TIER_CACHE_KEY, TIER_UNTIL_KEY } from "@/lib/tier";
import {
  clampServerGapMs,
  eventDegradedToState,
  eventRetryMs,
  needFromReason,
  serverNextInMs,
  shouldKeepChasing,
  stateBackoffMs,
  EVENT_5XX_GIVEUP,
  EVENT_RETRY_STEPS_MS,
  STATE_BACKOFF_STEPS_MS,
  STATE_GAP_MS,
  SERVER_GAP_MIN_MS,
  SERVER_GAP_MAX_MS,
} from "@/lib/heartbeat-policy";

const NOW = 1_700_000_000_000;

beforeEach(() => {
  localStorage.clear();
  _nav.onLine = true;
});

describe("shouldSendHeartbeat — không được đốt sóng giữa biển", () => {
  it("MẤT SÓNG → không gửi, dù chưa gửi bao giờ", () => {
    expect(
      shouldSendHeartbeat({ online: false, lastAt: null, nowMs: NOW }),
    ).toBe(false);
    expect(
      shouldSendHeartbeat({
        online: false,
        lastAt: NOW - 10 * HEARTBEAT_MIN_GAP_MS,
        nowMs: NOW,
      }),
    ).toBe(false);
  });

  it("có sóng + chưa gửi bao giờ → gửi", () => {
    expect(shouldSendHeartbeat({ online: true, lastAt: null, nowMs: NOW })).toBe(
      true,
    );
  });

  it("vừa gửi xong → im (mở app 20 lần/ngày vẫn chỉ một nhịp)", () => {
    expect(
      shouldSendHeartbeat({ online: true, lastAt: NOW - 60_000, nowMs: NOW }),
    ).toBe(false);
    expect(
      shouldSendHeartbeat({
        online: true,
        lastAt: NOW - (HEARTBEAT_MIN_GAP_MS - 1),
        nowMs: NOW,
      }),
    ).toBe(false);
  });

  it("quá cửa 12 giờ → gửi lại", () => {
    expect(
      shouldSendHeartbeat({
        online: true,
        lastAt: NOW - HEARTBEAT_MIN_GAP_MS,
        nowMs: NOW,
      }),
    ).toBe(true);
  });

  it("mốc lưu hỏng/tương lai (đồng hồ máy sai) → không gửi dồn dập", () => {
    expect(
      shouldSendHeartbeat({ online: true, lastAt: NOW + 86_400_000, nowMs: NOW }),
    ).toBe(false);
  });
});

// HAI MỨC HOÃN (2026-08-01g) — gốc bug "/quan-tri đứng mãi ở Chưa ghi nhận":
// bản cũ ghi dấu TRƯỚC khi gửi và chỉ có một cửa 12 giờ, nên cú gửi đầu hỏng là
// im nửa ngày. Nay hoãn bao lâu tuỳ CÓ NHẬN ĐƯỢC PHẢN HỒI hay không.
describe("shouldSendHeartbeat — mức hoãn sau lần thử hỏng", () => {
  it("chưa tới hạn thử lại → im, dù chưa ghi được lần nào", () => {
    expect(
      shouldSendHeartbeat({
        online: true,
        lastAt: null,
        retryAfter: NOW + 60_000,
        nowMs: NOW,
      }),
    ).toBe(false);
  });

  it("qua hạn thử lại → gửi lại (không phải chờ đủ 12 giờ)", () => {
    expect(
      shouldSendHeartbeat({
        online: true,
        lastAt: null,
        retryAfter: NOW - 1,
        nowMs: NOW,
      }),
    ).toBe(true);
  });

  it("MẤT SÓNG vẫn thắng mọi thứ — hạn thử lại qua rồi cũng không gửi", () => {
    expect(
      shouldSendHeartbeat({
        online: false,
        lastAt: null,
        retryAfter: NOW - 86_400_000,
        nowMs: NOW,
      }),
    ).toBe(false);
  });

  it("ĐÃ GHI ĐƯỢC gần đây thì cửa nhịp vẫn chặn, kể cả hết hạn hoãn", () => {
    expect(
      shouldSendHeartbeat({
        online: true,
        lastAt: NOW - 60_000,
        retryAfter: NOW - 86_400_000,
        nowMs: NOW,
      }),
    ).toBe(false);
  });

  /*  HAI LOẠI NHỊP, HAI THANG (chủ dự án chốt 2026-08-02d):
      ① SỰ KIỆN — bám tới khi máy chủ XÁC NHẬN GÁN ĐƯỢC, không bỏ cuộc
      ② ĐỊNH KỲ — lỡ lượt thì lượt sau bù, không bao giờ thưa hơn nhịp khoẻ  */
  it("thang ĐỊNH KỲ không bao giờ thưa hơn chính nhịp thường", () => {
    for (const n of [1, 2, 3, 4, 99]) {
      expect(stateBackoffMs(n)).toBeLessThanOrEqual(HEARTBEAT_MIN_GAP_MS);
    }
  });

  it("nhịp thường là 30 phút — không phải nửa ngày như bản cũ", () => {
    expect(HEARTBEAT_MIN_GAP_MS).toBe(30 * 60 * 1000);
  });
});

describe("hai thang thử lại — sự kiện BÁM, định kỳ THÔI", () => {
  it("thang SỰ KIỆN: 30 giây → 3 phút → 5 phút", () => {
    expect(eventRetryMs(1)).toBe(30 * 1000);
    expect(eventRetryMs(2)).toBe(3 * 60 * 1000);
    expect(eventRetryMs(3)).toBe(5 * 60 * 1000);
  });

  it("thang SỰ KIỆN GIỮ nấc cuối — bám tới khi được xác nhận, KHÔNG bỏ cuộc", () => {
    // đang online mà tin thì thật sự mới (đổi tài khoản / đổi máy) — bỏ cuộc là
    // mất luôn tin đó, mà chi phí chỉ là một request nhỏ mỗi 5 phút
    expect(eventRetryMs(4)).toBe(5 * 60 * 1000);
    expect(eventRetryMs(99)).toBe(5 * 60 * 1000);
    for (const n of [1, 2, 3, 4, 99]) {
      expect(eventRetryMs(n)).toBeLessThanOrEqual(5 * 60 * 1000);
    }
  });

  it("thang ĐỊNH KỲ: 1 phút → 5 phút → 15 phút → trần 30 phút", () => {
    expect(stateBackoffMs(1)).toBe(60 * 1000);
    expect(stateBackoffMs(2)).toBe(5 * 60 * 1000);
    expect(stateBackoffMs(3)).toBe(15 * 60 * 1000);
    expect(stateBackoffMs(4)).toBe(HEARTBEAT_MIN_GAP_MS);
    expect(stateBackoffMs(99)).toBe(HEARTBEAT_MIN_GAP_MS);
  });

  it("SỰ KIỆN luôn bám gắt hơn ĐỊNH KỲ ở mọi nấc", () => {
    for (const n of [1, 2, 3, 4]) {
      expect(eventRetryMs(n)).toBeLessThanOrEqual(stateBackoffMs(n));
    }
  });

  it("bộ đếm lạ (0 · âm · NaN) → nấc đầu, không bao giờ ném", () => {
    expect(eventRetryMs(0)).toBe(30 * 1000);
    expect(eventRetryMs(-5)).toBe(30 * 1000);
    expect(stateBackoffMs(Number.NaN)).toBe(60 * 1000);
  });

  it("cả hai thang chỉ ĐI LÊN — không nấc nào ngắn hơn nấc trước", () => {
    for (const steps of [EVENT_RETRY_STEPS_MS, STATE_BACKOFF_STEPS_MS]) {
      for (let i = 1; i < steps.length; i++) {
        expect(steps[i]).toBeGreaterThanOrEqual(steps[i - 1]);
      }
    }
  });
});

/*  CHẶN VÒNG LẶP VÔ ÍCH: máy chủ phải nói máy PHẢI LÀM GÌ, không chỉ "chưa ghi
    được". Có ca gửi lại bao nhiêu lần cũng ra đúng câu trả lời đó.  */
describe("needFromReason + shouldKeepChasing — đừng bám cái không bao giờ gán được", () => {
  it("chưa có phiên → 'login', KHÔNG bám (đăng nhập lại vốn đã là một sự kiện)", () => {
    expect(needFromReason("no_session")).toBe("login");
    expect(shouldKeepChasing("login")).toBe(false);
  });

  it("không có hàng khách → 'wait_admin', KHÔNG bám (việc của người ở bờ)", () => {
    expect(needFromReason("no_customer_row")).toBe("wait_admin");
    expect(shouldKeepChasing("wait_admin")).toBe(false);
  });

  it("ghi hỏng → 'retry', BÁM tiếp (hạ tầng trục trặc thường ngắn)", () => {
    expect(needFromReason("write_failed")).toBe("retry");
    expect(shouldKeepChasing("retry")).toBe(true);
  });

  it("gán xong → 'none', thôi", () => {
    expect(needFromReason(null)).toBe("none");
    expect(shouldKeepChasing("none")).toBe(false);
  });

  it("KHÔNG NGHE ĐƯỢC gì (null) → vẫn bám: tin của mình chưa ai nhận", () => {
    expect(shouldKeepChasing(null)).toBe(true);
  });
});

describe("beatSignature — ĐỔI TÀI KHOẢN trên cùng máy là tin mới", () => {
  // Chủ dự án phát hiện trên máy thật 2026-08-01: đăng nhập 0938635689 lúc
  // 17:02, sau đó đổi sang 0123456154 → chữ ký cũ không có tài khoản nên y
  // nguyên → cửa 12 giờ chặn → tài khoản MỚI không được ghi mốc nào.
  const base = { standalone: false, offlineReady: false };

  it("hai tài khoản khác nhau → hai chữ ký khác nhau", () => {
    expect(beatSignature({ ...base, account: "0938635689" })).not.toBe(
      beatSignature({ ...base, account: "0123456154" }),
    );
  });

  it("đăng xuất (account null) cũng khác với đang đăng nhập", () => {
    expect(beatSignature({ ...base, account: null })).not.toBe(
      beatSignature({ ...base, account: "0123456154" }),
    );
  });

  it("cùng tài khoản + cùng điều kiện → chữ ký y nguyên (vẫn im 12 giờ)", () => {
    expect(beatSignature({ ...base, account: "0123456154" })).toBe(
      beatSignature({ ...base, account: "0123456154" }),
    );
  });

  it("đổi tài khoản 5 giây sau nhịp trước → VẪN GỬI", () => {
    expect(
      shouldSendHeartbeat({
        online: true,
        lastAt: NOW - 5_000,
        sigChanged:
          beatSignature({ ...base, account: "0938635689" }) !==
          beatSignature({ ...base, account: "0123456154" }),
        nowMs: NOW,
      }),
    ).toBe(true);
  });
});

describe("beatSignature — phần TIN TỨC của một nhịp", () => {
  const web = { standalone: false, offlineReady: false };

  it("web vs bản cài là hai chữ ký KHÁC nhau", () => {
    expect(beatSignature(web)).not.toBe(
      beatSignature({ ...web, standalone: true }),
    );
  });

  it("chưa đủ đồ vs đủ đồ đi biển là hai chữ ký KHÁC nhau (trên BẢN CÀI)", () => {
    // phải xét trên bản cài: luật một chiều nên ở web thì "đủ đồ" chưa với tới
    const pwa = { standalone: true, offlineReady: false };
    expect(beatSignature(pwa)).not.toBe(
      beatSignature({ ...pwa, offlineReady: true }),
    );
  });

  it("CHƯA CÀI mà báo 'đủ đồ' KHÔNG đổi chữ ký — máy chủ vốn không ghi", () => {
    // luật một chiều: chưa qua bản cài thì bậc "đủ đồ" không với tới được, nên
    // cờ offlineReady đổi cũng chẳng có tin gì mới để báo
    expect(beatSignature({ standalone: false, offlineReady: true })).toBe(
      beatSignature({ standalone: false, offlineReady: false }),
    );
    // còn BẢN CÀI + đủ đồ thì có ghi ⇒ phải đổi
    expect(beatSignature({ standalone: true, offlineReady: true })).not.toBe(
      beatSignature({ standalone: true, offlineReady: false }),
    );
  });

  it("mở app lần nữa y hệt điều kiện → chữ ký y nguyên (vẫn im 12 giờ)", () => {
    expect(beatSignature(web)).toBe(beatSignature({ ...web }));
  });
});

describe("shouldSendHeartbeat — tin mới vượt cửa 12 giờ, nhưng không vượt mức hoãn vì mạng", () => {
  it("VỪA gửi 5 giây trước mà chữ ký ĐỔI (web → bản cài) → vẫn gửi", () => {
    expect(
      shouldSendHeartbeat({
        online: true,
        lastAt: NOW - 5_000,
        sigChanged: true,
        nowMs: NOW,
      }),
    ).toBe(true);
  });

  it("chữ ký KHÔNG đổi → cửa 12 giờ vẫn chặn như cũ", () => {
    expect(
      shouldSendHeartbeat({
        online: true,
        lastAt: NOW - 5_000,
        sigChanged: false,
        nowMs: NOW,
      }),
    ).toBe(false);
  });

  it("MẤT SÓNG thì tin mới cũng nằm im", () => {
    expect(
      shouldSendHeartbeat({
        online: false,
        lastAt: NOW - 5_000,
        sigChanged: true,
        nowMs: NOW,
      }),
    ).toBe(false);
  });

  it("ĐANG HOÃN VÌ MẠNG thì tin mới cũng phải chờ — đường truyền vẫn hỏng", () => {
    expect(
      shouldSendHeartbeat({
        online: true,
        lastAt: NOW - 5_000,
        retryAfter: NOW + 60_000,
        sigChanged: true,
        nowMs: NOW,
      }),
    ).toBe(false);
  });
});

/*  HAI DÒNG CHẢY ĐỘC LẬP (chủ dự án chốt 2026-08-02c).
    Mất sóng → im lặng tuyệt đối, không một request, không một hẹn giờ.
    Có sóng  → nhịp 30 phút, chạy suốt phiên chứ không chỉ lúc mở app.  */
describe("nextHeartbeatDelayMs — hẹn giờ cho nhịp kế tiếp", () => {
  it("chưa gửi lần nào → gửi NGAY (0 ms)", () => {
    expect(nextHeartbeatDelayMs({ lastAt: null, nowMs: NOW })).toBe(0);
  });

  it("vừa ghi được → đợi cho đủ 30 phút", () => {
    expect(nextHeartbeatDelayMs({ lastAt: NOW - 60_000, nowMs: NOW })).toBe(
      HEARTBEAT_MIN_GAP_MS - 60_000,
    );
  });

  it("quá hạn rồi → 0, không trả số âm", () => {
    expect(
      nextHeartbeatDelayMs({ lastAt: NOW - 10 * HEARTBEAT_MIN_GAP_MS, nowMs: NOW }),
    ).toBe(0);
  });

  it("mức hoãn vì mạng gác TRƯỚC — lấy mốc xa hơn trong hai mốc", () => {
    expect(
      nextHeartbeatDelayMs({
        lastAt: NOW - HEARTBEAT_MIN_GAP_MS, // cửa nhịp đã mở
        retryAfter: NOW + 5 * 60_000, // nhưng đang hoãn vì mạng
        nowMs: NOW,
      }),
    ).toBe(5 * 60_000);
  });

  it("đồng hồ máy bị chỉnh LÙI (mốc nằm ở tương lai) → gửi ngay, không kẹt", () => {
    expect(
      nextHeartbeatDelayMs({ lastAt: NOW + 86_400_000, nowMs: NOW }),
    ).toBe(0);
  });

  it("hẹn giờ KHÔNG BAO GIỜ thưa hơn nhịp thường khi máy khoẻ", () => {
    for (const troi of [0, 1_000, 60_000, HEARTBEAT_MIN_GAP_MS - 1]) {
      const d = nextHeartbeatDelayMs({ lastAt: NOW - troi, nowMs: NOW });
      expect(d).toBeLessThanOrEqual(HEARTBEAT_MIN_GAP_MS);
    }
  });
});

/*  CHIỀU NGƯỢC DUY NHẤT: máy chủ điều tiết nhịp — nhưng máy KHÔNG giao trứng
    cho ác. Kênh này là MỘT CHIỀU CÓ TRẢ LỜI, không phải kênh lệnh: máy chủ chỉ
    được nói "bao lâu nữa gửi lại", và con số đó luôn bị kẹp trước khi nghe.  */
describe("clampServerGapMs — máy chủ điều tiết nhịp, máy vẫn tự vệ", () => {
  it("số hợp lệ thì nghe theo", () => {
    expect(clampServerGapMs(45 * 60_000)).toBe(45 * 60_000);
  });

  it("máy chủ lỡ trả 0 / âm → KHÔNG được biến máy thành máy đốt data", () => {
    expect(clampServerGapMs(0)).toBe(SERVER_GAP_MIN_MS);
    expect(clampServerGapMs(-1)).toBe(SERVER_GAP_MIN_MS);
    expect(clampServerGapMs(1000)).toBe(SERVER_GAP_MIN_MS);
  });

  it("máy chủ lỡ trả một tháng → KHÔNG được làm /quan-tri mù", () => {
    expect(clampServerGapMs(30 * 24 * 3600_000)).toBe(SERVER_GAP_MAX_MS);
  });

  it("thiếu / rác / NaN → dùng nhịp mặc định của máy, không ném", () => {
    expect(clampServerGapMs(undefined)).toBe(HEARTBEAT_MIN_GAP_MS);
    expect(clampServerGapMs("30 phút")).toBe(HEARTBEAT_MIN_GAP_MS);
    expect(clampServerGapMs(null)).toBe(HEARTBEAT_MIN_GAP_MS);
    expect(clampServerGapMs(Number.NaN)).toBe(HEARTBEAT_MIN_GAP_MS);
  });
});

describe("serverNextInMs — máy chủ xếp lịch theo tình huống", () => {
  it("ghi được → nhịp thường", () => {
    expect(serverNextInMs(null)).toBe(HEARTBEAT_MIN_GAP_MS);
  });

  it("chưa đăng nhập → thưa hẳn (gửi mấy cũng không quy về ai được)", () => {
    expect(serverNextInMs("no_session")).toBeGreaterThan(HEARTBEAT_MIN_GAP_MS);
  });

  it("hạ tầng trục trặc → thử lại sớm (thường là trục trặc ngắn)", () => {
    expect(serverNextInMs("write_failed")).toBeLessThan(HEARTBEAT_MIN_GAP_MS);
  });

  it("mọi con số máy chủ đưa ra đều SỐNG SÓT qua bộ kẹp của máy", () => {
    // nếu một ngày ai đó chỉnh serverNextInMs ra ngoài dải, bộ kẹp sẽ âm thầm
    // bóp lại — test này bắt ngay để hai bên không nói hai thứ khác nhau.
    for (const r of [null, "no_session", "no_customer_row", "write_failed"] as const) {
      expect(clampServerGapMs(serverNextInMs(r))).toBe(serverNextInMs(r));
    }
  });
});

/*  MÃ MÁY VÀO CHỮ KÝ (2026-08-02d, chủ dự án: "device id để biết nó vẫn còn giữ
    cái id đó; nếu đổi thì nó báo NGAY, còn không thì định kỳ báo").
    Máy chủ dùng mã này để dọn 3 mốc khi bà con đổi điện thoại — nó chỉ dọn đúng
    nếu BIẾT mã đã đổi, nên đây phải là SỰ KIỆN chứ không phải chuyện chờ nhịp. */
describe("beatSignature — đổi MÁY là tin mới, báo ngay", () => {
  const base = { standalone: false, offlineReady: false, account: "0912345678" };

  it("hai mã máy khác nhau → hai chữ ký khác nhau", () => {
    expect(beatSignature({ ...base, deviceId: "may-cu" })).not.toBe(
      beatSignature({ ...base, deviceId: "may-moi" }),
    );
  });

  it("mất mã máy (storage bị chặn) cũng khác với đang có mã", () => {
    expect(beatSignature({ ...base, deviceId: null })).not.toBe(
      beatSignature({ ...base, deviceId: "may-cu" }),
    );
  });

  it("cùng máy, cùng người, cùng trạng thái → chữ ký y nguyên (không gửi thừa)", () => {
    expect(beatSignature({ ...base, deviceId: "may-cu" })).toBe(
      beatSignature({ ...base, deviceId: "may-cu" }),
    );
  });
});

describe("nextHeartbeatDelayMs — có sự kiện chờ thì KHÔNG chờ 30 phút", () => {
  it("đang bám sự kiện → theo mốc hoãn của thang sự kiện, không phải nhịp định kỳ", () => {
    // vừa ghi được nhịp định kỳ 1 phút trước, nhưng có tin mới đang chờ xác nhận
    expect(
      nextHeartbeatDelayMs({
        lastAt: NOW - 60_000,
        retryAfter: NOW + 30_000, // nấc đầu thang sự kiện
        pending: true,
        nowMs: NOW,
      }),
    ).toBe(30_000);
  });

  it("KHÔNG có sự kiện chờ → vẫn là nhịp 30 phút", () => {
    expect(
      nextHeartbeatDelayMs({ lastAt: NOW - 60_000, pending: false, nowMs: NOW }),
    ).toBe(HEARTBEAT_MIN_GAP_MS - 60_000);
  });
});

/*  ═══ OFFLINE LÀ LUỒNG RIÊNG — NHỊP KHÔNG ĐƯỢC CHẠM VÀO ═══
    Chủ dự án yêu cầu xác nhận: offline chạy độc lập, KHÔNG cần heartbeat,
    KHÔNG cần máy chủ; có sóng lại thì mới bắt đầu nhịp. Ba bất biến dưới đây
    khoá lại điều đó bằng code chứ không bằng lời hứa.  */
describe("nhịp KHÔNG được ảnh hưởng chế độ offline", () => {
  it("MẤT SÓNG → không gửi, dù có tin mới, dù đã quá hạn từ lâu", () => {
    expect(
      shouldSendHeartbeat({
        online: false,
        lastAt: null,
        retryAfter: NOW - 86_400_000, // hạn hoãn qua từ đời nào
        sigChanged: true, // và đang có SỰ KIỆN chờ
        nowMs: NOW,
      }),
    ).toBe(false);
  });

  it("mọi khoá nhịp dùng đều nằm trong `forfish.heartbeat.*` — không đụng kho dự báo/hộp thư/danh tính", () => {
    for (const k of [
      HEARTBEAT_KEY,
      HEARTBEAT_RETRY_KEY,
      HEARTBEAT_SIG_KEY,
      HEARTBEAT_FAILS_KEY,
    ]) {
      expect(k.startsWith("forfish.heartbeat.")).toBe(true);
    }
  });

  it("khoá nhịp KHÔNG trùng khoá của bất kỳ dữ liệu đi biển nào", () => {
    // dữ liệu bà con cần ngoài biển: dự báo · hộp thư · danh tính · mã máy ·
    // giấy tờ · thuyền viên. Nhịp chỉ được đọc, không được ghi vào đó.
    const kho = [
      "forfish.fc.",
      "forfish.inbox.",
      "forfish.identity.",
      "forfish.tier.",
      "forfish.documents.",
      "forfish.crew.",
      "forfish.device.",
    ];
    for (const k of [
      HEARTBEAT_KEY,
      HEARTBEAT_RETRY_KEY,
      HEARTBEAT_SIG_KEY,
      HEARTBEAT_FAILS_KEY,
    ]) {
      for (const p of kho) expect(k.startsWith(p)).toBe(false);
    }
  });
});

/*  ═══ CỔNG RẺ: KHÔNG QUÉT KHO KHI CHẮC CHẮN KHÔNG GỬI ═══ (2026-08-02e)

    Nhịp trước đây quét SẠCH kho offline (hàng chục lượt JSON.parse trên ~33 MB,
    LUỒNG CHÍNH) rồi mới hỏi `sendHeartbeat` có gửi không — mà câu trả lời gần
    như luôn là KHÔNG. `heartbeatNeedsScan` hỏi trước bằng BA MẢNH RẺ của chữ ký
    (tài khoản · web/bản cài · mã máy); chỉ mảnh "đủ đồ đi biển" là đắt.
    Bảng chân trị dưới khoá lại đúng thứ tự hàng rào của shouldSendHeartbeat. */
describe("heartbeatNeedsScan — cổng rẻ trước, quét kho sau", () => {
  const me = { account: "0912345678", standalone: false, deviceId: "may-1" };
  /** chữ ký ĐẦY ĐỦ mà máy chủ đã xác nhận, cho đúng bộ ba rẻ ở trên */
  const savedSig = (
    over: Partial<typeof me> & { offlineReady?: boolean } = {},
  ) =>
    beatSignature({
      account: over.account ?? me.account,
      standalone: over.standalone ?? me.standalone,
      deviceId: over.deviceId ?? me.deviceId,
      offlineReady: over.offlineReady ?? false,
    });

  it("MẤT SÓNG → false: không quét, không gửi, không đụng gì (bất biến số một)", () => {
    _nav.onLine = false;
    // chưa có chữ ký nào, hạn hoãn qua từ đời nào — vẫn phải là false
    expect(heartbeatNeedsScan(me, NOW)).toBe(false);
  });

  it("ĐANG HOÃN → false, KỂ CẢ khi cả ba mảnh rẻ vừa đổi hết", () => {
    localStorage.setItem(HEARTBEAT_RETRY_KEY, String(NOW + 60_000));
    localStorage.setItem(HEARTBEAT_SIG_KEY, savedSig());
    expect(
      heartbeatNeedsScan(
        { account: "khac-han", standalone: true, deviceId: "may-2" },
        NOW,
      ),
    ).toBe(false);
  });

  it("chưa có chữ ký nào được xác nhận → true (máy mới, phải quét)", () => {
    expect(heartbeatNeedsScan(me, NOW)).toBe(true);
  });

  it("ĐỔI TÀI KHOẢN → true, dù vừa ghi được 1 phút trước", () => {
    localStorage.setItem(HEARTBEAT_SIG_KEY, savedSig());
    localStorage.setItem(HEARTBEAT_KEY, String(NOW - 60_000));
    expect(heartbeatNeedsScan({ ...me, account: "0999999999" }, NOW)).toBe(true);
  });

  it("web → BẢN CÀI → true", () => {
    localStorage.setItem(HEARTBEAT_SIG_KEY, savedSig());
    localStorage.setItem(HEARTBEAT_KEY, String(NOW - 60_000));
    expect(heartbeatNeedsScan({ ...me, standalone: true }, NOW)).toBe(true);
  });

  it("ĐỔI MÁY (mã máy khác) → true", () => {
    localStorage.setItem(HEARTBEAT_SIG_KEY, savedSig());
    localStorage.setItem(HEARTBEAT_KEY, String(NOW - 60_000));
    expect(heartbeatNeedsScan({ ...me, deviceId: "may-2" }, NOW)).toBe(true);
  });

  it("mất mã máy (storage bị chặn) cũng là đổi → true", () => {
    localStorage.setItem(HEARTBEAT_SIG_KEY, savedSig());
    localStorage.setItem(HEARTBEAT_KEY, String(NOW - 60_000));
    expect(heartbeatNeedsScan({ ...me, deviceId: null }, NOW)).toBe(true);
  });

  it("ba mảnh rẻ Y NGUYÊN + mới ghi được 29 phút trước → false", () => {
    localStorage.setItem(HEARTBEAT_SIG_KEY, savedSig());
    localStorage.setItem(HEARTBEAT_KEY, String(NOW - 29 * 60_000));
    expect(heartbeatNeedsScan(me, NOW)).toBe(false);
  });

  it("ba mảnh rẻ Y NGUYÊN + đã 31 phút → true (nhịp định kỳ tới hạn)", () => {
    localStorage.setItem(HEARTBEAT_SIG_KEY, savedSig());
    localStorage.setItem(HEARTBEAT_KEY, String(NOW - 31 * 60_000));
    expect(heartbeatNeedsScan(me, NOW)).toBe(true);
  });

  /*  ═══ MẢNH ĐẮT KHÔNG ĐƯỢC RƠI MẤT ═══ (hồi quy 2026-08-02f)

      Bản đầu của cổng rẻ thả hẳn mảnh "đủ đồ đi biển" xuống cửa 30 phút và khai
      "trễ tối đa 30 phút". Con số đó chỉ đúng nếu app CÒN MỞ và CÒN SÓNG sau 30
      phút — trong khi nhịp thật của bà con là: mở app ở cảng → mẻ pretrip chạy →
      `offlineReady` lật false→true → ĐÓNG APP, NHỔ NEO. Cổng rẻ nói "khỏi quét"
      ở mọi lượt trong 30 phút đó ⇒ `offline_ready_at` KHÔNG BAO GIỜ được ghi ⇒
      mất hẳn đường đo duy nhất của cột "máy này ra khơi được chưa".
      Cửa rút ngắn (5 phút) chỉ mở cho ĐÚNG ca có thể lật: đang chạy BẢN CÀI và
      chữ ký đã xác nhận còn ghi "chưa đủ đồ".  */
  const pwa = { ...me, standalone: true };

  it("BẢN CÀI + chữ ký còn ghi 'chưa đủ đồ' + 6 phút → PHẢI QUÉT (cú lật có thể vừa xảy ra)", () => {
    localStorage.setItem(
      HEARTBEAT_SIG_KEY,
      savedSig({ standalone: true, offlineReady: false }),
    );
    localStorage.setItem(HEARTBEAT_KEY, String(NOW - 6 * 60_000));
    expect(heartbeatNeedsScan(pwa, NOW)).toBe(true);
  });

  it("cùng ca đó mà MẤT SÓNG → false: 0 lượt quét, 0 request (bất biến số một)", () => {
    _nav.onLine = false;
    localStorage.setItem(
      HEARTBEAT_SIG_KEY,
      savedSig({ standalone: true, offlineReady: false }),
    );
    localStorage.setItem(HEARTBEAT_KEY, String(NOW - 6 * 60_000));
    expect(heartbeatNeedsScan(pwa, NOW)).toBe(false);
    // và kể cả khi đã quá cửa 30 phút — mất sóng thắng mọi hàng rào
    localStorage.setItem(HEARTBEAT_KEY, String(NOW - 31 * 60_000));
    expect(heartbeatNeedsScan(pwa, NOW)).toBe(false);
  });

  it("BẢN CÀI + 'chưa đủ đồ' nhưng mới ghi 1 phút trước → false (không quét dồn)", () => {
    localStorage.setItem(
      HEARTBEAT_SIG_KEY,
      savedSig({ standalone: true, offlineReady: false }),
    );
    localStorage.setItem(HEARTBEAT_KEY, String(NOW - 60_000));
    expect(heartbeatNeedsScan(pwa, NOW)).toBe(false);
  });

  it("BẢN CÀI + chữ ký ĐÃ ghi 'đủ đồ' → về lại cửa 30 phút (cú lật đã đi xong)", () => {
    localStorage.setItem(
      HEARTBEAT_SIG_KEY,
      savedSig({ standalone: true, offlineReady: true }),
    );
    localStorage.setItem(HEARTBEAT_KEY, String(NOW - 6 * 60_000));
    expect(heartbeatNeedsScan(pwa, NOW)).toBe(false);
    localStorage.setItem(HEARTBEAT_KEY, String(NOW - 31 * 60_000));
    expect(heartbeatNeedsScan(pwa, NOW)).toBe(true);
  });

  /*  Ở WEB thì cổng rẻ vốn ĐÃ chính xác tuyệt đối: `countsAsOfflineReady` ép
      "đủ đồ" về false bất kể kho có gì (thang một chiều web → bản cài → tải),
      nên mảnh thứ tư KHÔNG THỂ đổi ⇒ không có tin nào để bỏ rơi ⇒ không đáng
      trả giá quét kho. Đừng "sửa" test này bằng cách cho web cũng quét.  */
  it("WEB + chỉ 'đủ đồ đi biển' đổi → KHÔNG quét: ở web bậc đó không với tới được", () => {
    localStorage.setItem(HEARTBEAT_SIG_KEY, savedSig({ offlineReady: false }));
    localStorage.setItem(HEARTBEAT_KEY, String(NOW - 6 * 60_000));
    expect(heartbeatNeedsScan(me, NOW)).toBe(false);
  });

  it("cửa rút ngắn phải NGẮN HƠN HẲN cửa định kỳ, và không được về 0", () => {
    expect(HEARTBEAT_SCAN_MIN_GAP_MS).toBeLessThan(HEARTBEAT_MIN_GAP_MS);
    expect(HEARTBEAT_SCAN_MIN_GAP_MS).toBeGreaterThanOrEqual(60_000);
  });

  it("BẢN CÀI + 'chưa đủ đồ' + đồng hồ chỉnh LÙI → false, không quét vòng vòng", () => {
    localStorage.setItem(
      HEARTBEAT_SIG_KEY,
      savedSig({ standalone: true, offlineReady: false }),
    );
    localStorage.setItem(HEARTBEAT_KEY, String(NOW + 86_400_000));
    expect(heartbeatNeedsScan(pwa, NOW)).toBe(false);
  });

  it("chữ ký ĐỜI CŨ (khuôn khác) → true: thà quét thừa còn hơn bỏ rơi một tin", () => {
    localStorage.setItem(HEARTBEAT_SIG_KEY, "w-"); // khuôn trước 2026-08-01o
    localStorage.setItem(HEARTBEAT_KEY, String(NOW - 60_000));
    expect(heartbeatNeedsScan(me, NOW)).toBe(true);
  });

  it("đồng hồ máy chỉnh LÙI (mốc ở tương lai) → false, y hệt shouldSendHeartbeat", () => {
    localStorage.setItem(HEARTBEAT_SIG_KEY, savedSig());
    localStorage.setItem(HEARTBEAT_KEY, String(NOW + 86_400_000));
    expect(heartbeatNeedsScan(me, NOW)).toBe(false);
    // hai bên phải nói cùng một câu
    expect(
      shouldSendHeartbeat({
        online: true,
        lastAt: NOW + 86_400_000,
        sigChanged: false,
        nowMs: NOW,
      }),
    ).toBe(false);
  });
});

/*  ═══ CÚ LẬT "VỪA ĐỦ ĐỒ ĐI BIỂN" PHẢI ĐI ĐƯỢC HẾT ĐƯỜNG ═══ (2026-08-02f)

    Không chỉ "cổng rẻ cho quét" — phải QUÉT RỒI GỬI THẬT trong cùng một lượt.
    Đây là mạch đúng như ở cảng: nhịp định kỳ vừa ghi được vài phút trước (chữ ký
    đã xác nhận = bản cài, CHƯA đủ đồ), mẻ pretrip chạy xong, bà con đóng app.  */
describe("offlineReady lật false→true trong cửa 30 phút — phải quét VÀ phải gửi", () => {
  const me = { account: "0912345678", standalone: true, deviceId: "may-1" };

  it("quét (cổng rẻ mở) rồi GỬI THẬT, và chữ ký mới được ghi lại", async () => {
    const now = Date.now();
    // chữ ký máy chủ đã xác nhận: BẢN CÀI, chưa đủ đồ
    localStorage.setItem(
      HEARTBEAT_SIG_KEY,
      beatSignature({ ...me, offlineReady: false }),
    );
    localStorage.setItem(HEARTBEAT_KEY, String(now - 6 * 60_000));

    // 1) cổng rẻ PHẢI cho quét — nếu không thì `offlineReady` mới không ai đọc
    expect(heartbeatNeedsScan(me, now)).toBe(true);

    // 2) quét xong thấy đã đủ đồ → PHẢI gửi ngay, không chờ hết 30 phút
    const prev = globalThis.fetch;
    let called = 0;
    globalThis.fetch = (async () => {
      called++;
      return {
        status: 200,
        ok: true,
        json: async () => ({
          ok: true,
          recorded: true,
          attached: true,
          need: "none",
          nextInMs: STATE_GAP_MS,
        }),
      } as unknown as Response;
    }) as typeof fetch;
    try {
      const r = await sendHeartbeat({ ...me, offlineReady: true });
      expect(called).toBe(1);
      expect(r.sent).toBe(true);
      expect(r.attached).toBe(true);
      // chữ ký MỚI đã ghi ⇒ lượt sau về lại cửa 30 phút, không gửi lặp
      expect(localStorage.getItem(HEARTBEAT_SIG_KEY)).toBe(
        beatSignature({ ...me, offlineReady: true }),
      );
      expect(heartbeatNeedsScan(me, Date.now())).toBe(false);
    } finally {
      globalThis.fetch = prev;
    }
  });

  it("MẤT SÓNG ở đúng ca đó → 0 lượt quét, 0 request", async () => {
    const now = Date.now();
    localStorage.setItem(
      HEARTBEAT_SIG_KEY,
      beatSignature({ ...me, offlineReady: false }),
    );
    localStorage.setItem(HEARTBEAT_KEY, String(now - 6 * 60_000));
    _nav.onLine = false;
    const prev = globalThis.fetch;
    let called = 0;
    globalThis.fetch = (async () => {
      called++;
      return { status: 200, ok: true, json: async () => ({}) } as unknown as Response;
    }) as typeof fetch;
    try {
      expect(heartbeatNeedsScan(me, now)).toBe(false);
      const r = await sendHeartbeat({ ...me, offlineReady: true });
      expect(called).toBe(0);
      expect(r.sent).toBe(false);
      // và không đụng gì tới chữ ký đã lưu
      expect(localStorage.getItem(HEARTBEAT_SIG_KEY)).toBe(
        beatSignature({ ...me, offlineReady: false }),
      );
    } finally {
      globalThis.fetch = prev;
    }
  });
});

/*  ═══ CẦU DAO KHI MÁY CHỦ NỔ 5xx ═══ (2026-08-02e)

    Từ bản 02c, 5xx đi chung đường với mất-sóng: chữ ký KHÔNG được ghi ⇒ `pending`
    mãi true ⇒ nhịp mãi là "sự kiện" ⇒ giữ nấc cuối 5 phút và bám VĨNH VIỄN vào
    một máy chủ đang chết. Cộng thêm: đổi khuôn chữ ký (lần gần nhất thêm
    `|deviceId`) làm MỌI máy có "sự kiện chờ" ngay sau deploy.
    LƯU Ý: test "thang SỰ KIỆN GIỮ nấc cuối — KHÔNG bỏ cuộc" ở trên GIỮ NGUYÊN —
    nó nói về THANG, và thang không đổi. Cầu dao đổi LOẠI NHỊP, không đổi thang. */
describe("eventDegradedToState — máy chủ nổ liên tiếp thì hạ nhịp, KHÔNG bỏ tin", () => {
  it("chưa tới ngưỡng → vẫn bám thang sự kiện", () => {
    expect(eventDegradedToState(0)).toBe(false);
    expect(eventDegradedToState(EVENT_5XX_GIVEUP - 1)).toBe(false);
    expect(eventDegradedToState(4)).toBe(false);
  });

  it("tới ngưỡng → hạ về nhịp định kỳ", () => {
    expect(eventDegradedToState(5)).toBe(true);
    expect(eventDegradedToState(EVENT_5XX_GIVEUP)).toBe(true);
    expect(eventDegradedToState(99)).toBe(true);
  });

  it("bộ đếm rác (NaN) → KHÔNG hạ nhịp (nghiêng về phía giữ tin)", () => {
    expect(eventDegradedToState(Number.NaN)).toBe(false);
  });

  it("khoá đếm 5xx nằm trong `forfish.heartbeat.*`, và TÁCH khỏi bộ đếm mạng", () => {
    expect(HEARTBEAT_5XX_KEY.startsWith("forfish.heartbeat.")).toBe(true);
    expect(HEARTBEAT_5XX_KEY).not.toBe(HEARTBEAT_FAILS_KEY);
  });
});

describe("sendHeartbeat — 5 lần 5xx liên tiếp thì nhịp tự giãn ra", () => {
  const info = {
    account: "0912345678",
    standalone: false,
    offlineReady: false,
    deviceId: "may-1",
  };
  /** một lượt gửi; xoá mốc hoãn trước để mô phỏng "đã tới hạn thử lại" */
  const beatOnce = async () => {
    localStorage.removeItem(HEARTBEAT_RETRY_KEY);
    await sendHeartbeat(info);
    return Number(localStorage.getItem(HEARTBEAT_RETRY_KEY)) - Date.now();
  };

  it("bốn lượt đầu còn bám gắt (≤ 5 phút), lượt thứ sáu đã ≥ 30 phút", async () => {
    const prev = globalThis.fetch;
    globalThis.fetch = (async () =>
      ({
        status: 500,
        ok: false,
        json: async () => ({}),
      }) as unknown as Response) as typeof fetch;
    try {
      let gap = 0;
      for (let i = 0; i < 4; i++) gap = await beatOnce();
      // chưa đủ 5 lần nổ ⇒ còn ở thang SỰ KIỆN
      expect(gap).toBeLessThanOrEqual(5 * 60_000 + 1_000);
      expect(Number(localStorage.getItem(HEARTBEAT_5XX_KEY))).toBe(4);

      await beatOnce(); // lượt thứ 5 → bộ đếm chạm ngưỡng
      expect(
        eventDegradedToState(Number(localStorage.getItem(HEARTBEAT_5XX_KEY))),
      ).toBe(true);

      const after = await beatOnce(); // lượt thứ 6 đã hạ về nhịp ĐỊNH KỲ
      expect(after).toBeGreaterThanOrEqual(STATE_GAP_MS - 1_000);

      /*  TIN KHÔNG MẤT: chữ ký vẫn chưa được ghi ⇒ vẫn còn "sự kiện chờ", chỉ
          chậm lại. Máy chủ sống lại là gửi tiếp. */
      expect(localStorage.getItem(HEARTBEAT_SIG_KEY)).toBe(null);
    } finally {
      globalThis.fetch = prev;
    }
  });

  it("MẤT SÓNG thì không gửi gì — bộ đếm 5xx cũng không nhúc nhích", async () => {
    _nav.onLine = false;
    const prev = globalThis.fetch;
    let called = 0;
    globalThis.fetch = (async () => {
      called++;
      return {
        status: 500,
        ok: false,
        json: async () => ({}),
      } as unknown as Response;
    }) as typeof fetch;
    try {
      const r = await sendHeartbeat(info);
      expect(called).toBe(0);
      expect(r.sent).toBe(false);
      expect(localStorage.getItem(HEARTBEAT_5XX_KEY)).toBe(null);
    } finally {
      globalThis.fetch = prev;
    }
  });
});

/*  ═══ NGÀY PHỦ CỐT LÕI ═══ (2026-08-02e)
    Con số này quyết định người trực tổng đài có gọi nhắc bà con hay không, nên
    sai về phía "nhìn như đủ" là sai về phía nguy hiểm. Trước đây nhịp báo lên
    ngày của RIÊNG lớp điểm ghim — mà lớp đó là bậc hy sinh ĐẦU TIÊN khi máy hết
    chỗ, còn lưới cả vùng mới là thứ bà con mở ra giữa biển. */
describe("coreSavedUntil — ngày SỚM NHẤT giữa lưới cả vùng và điểm ghim", () => {
  it("hai lớp cùng phủ tới 18/8 → 18/8", () => {
    expect(coreSavedUntil("2026-08-18", "2026-08-18")).toBe("2026-08-18");
  });

  it("lưới chỉ tới 12/8 dù điểm ghim tới 18/8 → 12/8 (lấy cái NGẮN)", () => {
    expect(coreSavedUntil("2026-08-12", "2026-08-18")).toBe("2026-08-12");
  });

  /*  ═══ THIẾU MỘT LỚP KHÔNG ĐƯỢC RA `null` ═══ (hồi quy 2026-08-02f)

      `null` đi lên máy chủ là "BỎ QUA IM LẶNG": route đọc `if (savedUntil)` rồi
      không đụng cột ⇒ `data_until` ĐÓNG BĂNG ở một ngày cũ NẰM TRONG TƯƠNG LAI.
      Mà `point` là bậc hy sinh ĐẦU TIÊN khi máy hết chỗ, nên ca "thiếu point,
      còn lưới" là ca THƯỜNG GẶP chứ không phải ca hiếm. Số chết còn tệ hơn số
      sai: nó trông y như số đúng, không ai nhìn ra.  */
  it("mất ĐIỂM GHIM mà còn lưới → báo ngày của lưới, KHÔNG được trả null", () => {
    expect(coreSavedUntil("2026-08-18", null)).toBe("2026-08-18");
    expect(coreSavedUntil("2026-08-18", undefined)).toBe("2026-08-18");
    expect(coreSavedUntil("2026-08-18", "")).toBe("2026-08-18");
  });

  it("mất LƯỚI mà còn điểm ghim → báo ngày của điểm ghim, cũng không null", () => {
    expect(coreSavedUntil(null, "2026-08-12")).toBe("2026-08-12");
  });

  it("`null` chỉ còn NGHĨA DUY NHẤT: không còn lớp cốt lõi nào", () => {
    expect(coreSavedUntil(null, null)).toBe(null);
    expect(coreSavedUntil("", "")).toBe(null);
    expect(coreSavedUntil(undefined, undefined)).toBe(null);
  });

  it("con số phải ĐỘNG theo kho: dọn bớt lớp thì không bao giờ CAO HƠN lúc đủ", () => {
    // đủ hai lớp → 12/8; dọn mất lớp nào cũng không được nhảy lên số đẹp hơn
    const full = coreSavedUntil("2026-08-12", "2026-08-18");
    expect(full).toBe("2026-08-12");
    expect(coreSavedUntil("2026-08-12", null)! <= full!).toBe(true);
  });
});

/*  ═══ LỚP CÁ: "CHƯA TRA ĐƯỢC HẠNG" ≠ "HẠNG THƯỜNG" ═══ (hồi quy 2026-08-02f)

    Bản vá 02e chữa đúng ca khách hạng thường (không premium thì lớp cá vĩnh
    viễn không tải được, đòi nó là đòi thứ không bao giờ có) — nhưng viết
    `mark !== "premium"`, nên `"unknown"` cũng thành "khoá". Khách PREMIUM mở app
    lần đầu / dấu vừa bị xoá ⇒ lớp cá rơi khỏi phép đếm ⇒ nhịp báo "đủ đồ đi
    biển" DÙ BẢN ĐỒ CÁ CHƯA HỀ CÓ TRONG MÁY.
    Với cột "máy này ra khơi được chưa", BÁO THỪA là chiều nguy hiểm: người trực
    tổng đài không gọi nhắc. Báo thiếu cùng lắm tốn một cú điện thoại.  */
describe("fishLockedFromMark — báo thiếu thì gọi thừa, báo thừa thì bỏ rơi", () => {
  const NOW_REAL = Date.now();

  it("CHƯA CÓ DẤU (khách premium mở app lần đầu) → KHÔNG khoá: lớp cá vẫn phải có", () => {
    expect(fishLockedFromMark(NOW_REAL)).toBe(false);
  });

  it("dấu rác / khuôn lạ → cũng là 'chưa biết' ⇒ KHÔNG khoá", () => {
    localStorage.setItem(TIER_CACHE_KEY, "co-le-la-premium");
    expect(fishLockedFromMark(NOW_REAL)).toBe(false);
  });

  it("dấu nói THẲNG 'hạng thường' → khoá: khách thường vẫn ra khơi được", () => {
    localStorage.setItem(TIER_CACHE_KEY, "0");
    expect(fishLockedFromMark(NOW_REAL)).toBe(true);
  });

  it("dấu premium còn hạn → không khoá", () => {
    localStorage.setItem(TIER_CACHE_KEY, "1");
    localStorage.setItem(
      TIER_UNTIL_KEY,
      new Date(NOW_REAL + 30 * 86_400_000).toISOString().slice(0, 10),
    );
    expect(fishLockedFromMark(NOW_REAL)).toBe(false);
  });

  it("dấu premium HẾT HẠN (quá cả biên) → thành hạng thường ⇒ khoá", () => {
    localStorage.setItem(TIER_CACHE_KEY, "1");
    localStorage.setItem(
      TIER_UNTIL_KEY,
      new Date(NOW_REAL - 60 * 86_400_000).toISOString().slice(0, 10),
    );
    expect(fishLockedFromMark(NOW_REAL)).toBe(true);
  });

  /*  Hệ quả trên cột thật. Luật `allSaved` chép từ `savedCoverage`
      (lib/pretrip.ts): chỉ các lớp `retriable` mới bị đòi, và `fishLocked` là
      thứ DUY NHẤT quyết định lớp `fish` có `retriable` hay không.  */
  const offlineReady = (fishLocked: boolean) => {
    const layers = [
      { id: "point", saved: true, retriable: true },
      { id: "grid", saved: true, retriable: true },
      { id: "fish", saved: false, retriable: !fishLocked }, // bản đồ cá CHƯA có
    ];
    const essential = layers.filter((l) => l.retriable);
    return essential.length > 0 && essential.every((l) => l.saved);
  };

  it("dấu 'chưa biết' + kho KHÔNG có bản đồ cá → offlineReady FALSE", () => {
    expect(offlineReady(fishLockedFromMark(NOW_REAL))).toBe(false);
  });

  it("dấu 'hạng thường' + kho không có bản đồ cá → offlineReady TRUE", () => {
    localStorage.setItem(TIER_CACHE_KEY, "0");
    expect(offlineReady(fishLockedFromMark(NOW_REAL))).toBe(true);
  });
});
