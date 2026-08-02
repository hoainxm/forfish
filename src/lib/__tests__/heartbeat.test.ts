import { describe, expect, it } from "vitest";
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
} from "@/lib/heartbeat";
import {
  clampServerGapMs,
  eventRetryMs,
  needFromReason,
  serverNextInMs,
  shouldKeepChasing,
  stateBackoffMs,
  EVENT_RETRY_STEPS_MS,
  STATE_BACKOFF_STEPS_MS,
  SERVER_GAP_MIN_MS,
  SERVER_GAP_MAX_MS,
} from "@/lib/heartbeat-policy";

const NOW = 1_700_000_000_000;

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
