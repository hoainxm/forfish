import { describe, expect, it } from "vitest";
import {
  beatSignature,
  shouldSendHeartbeat,
  netBackoffMs,
  HEARTBEAT_MIN_GAP_MS,
  HEARTBEAT_NET_BACKOFF_STEPS_MS,
  HEARTBEAT_SOFT_RETRY_MS,
} from "@/lib/heartbeat";

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

  it("ĐÃ GHI ĐƯỢC gần đây thì cửa 12 giờ vẫn chặn, kể cả hết hạn hoãn", () => {
    expect(
      shouldSendHeartbeat({
        online: true,
        lastAt: NOW - 60_000,
        retryAfter: NOW - 86_400_000,
        nowMs: NOW,
      }),
    ).toBe(false);
  });

  it("nấc CUỐI của thang lùi bằng đúng cửa 12 giờ của bản cũ", () => {
    const steps = HEARTBEAT_NET_BACKOFF_STEPS_MS;
    expect(steps[steps.length - 1]).toBe(HEARTBEAT_MIN_GAP_MS);
    // còn ca máy chủ CÓ trả lời thì mở lại sớm hơn hẳn
    expect(HEARTBEAT_SOFT_RETRY_MS).toBeLessThan(steps[steps.length - 1]);
  });
});

// THANG LÙI 30 giây → 3 phút → 5 phút → 12 giờ (chủ dự án chốt). Máy ĐANG
// ONLINE mà không nghe được máy chủ thường là trục trặc NGẮN (route cold-start,
// wifi cảng chập chờn) — ba lần thử thưa gỡ được hầu hết, hết thang mới im.
describe("netBackoffMs — thang lùi khi không nghe được máy chủ", () => {
  it("hỏng lần 1 → 30 giây; lần 2 → 3 phút; lần 3 → 5 phút; lần 4 → 12 giờ", () => {
    expect(netBackoffMs(1)).toBe(30 * 1000);
    expect(netBackoffMs(2)).toBe(3 * 60 * 1000);
    expect(netBackoffMs(3)).toBe(5 * 60 * 1000);
    expect(netBackoffMs(4)).toBe(HEARTBEAT_MIN_GAP_MS);
  });

  it("hỏng quá thang → giữ nấc cuối, KHÔNG quay lại nấc nhanh", () => {
    expect(netBackoffMs(5)).toBe(HEARTBEAT_MIN_GAP_MS);
    expect(netBackoffMs(99)).toBe(HEARTBEAT_MIN_GAP_MS);
  });

  it("bộ đếm lạ (0 · âm · NaN) → nấc đầu, không bao giờ ném", () => {
    expect(netBackoffMs(0)).toBe(30 * 1000);
    expect(netBackoffMs(-5)).toBe(30 * 1000);
    expect(netBackoffMs(Number.NaN)).toBe(30 * 1000);
  });

  it("ba nấc NHANH đều dưới 10 phút — hết thang mới im nửa ngày", () => {
    expect(netBackoffMs(1)).toBeLessThan(10 * 60 * 1000);
    expect(netBackoffMs(2)).toBeLessThan(10 * 60 * 1000);
    expect(netBackoffMs(3)).toBeLessThan(10 * 60 * 1000);
    expect(netBackoffMs(4)).toBe(HEARTBEAT_MIN_GAP_MS);
  });

  it("thang chỉ ĐI LÊN — không có nấc nào ngắn hơn nấc trước", () => {
    const steps = HEARTBEAT_NET_BACKOFF_STEPS_MS;
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]).toBeGreaterThan(steps[i - 1]);
    }
  });
});

// TIN MỚI ĐI NGAY (2026-08-01h) — gốc: cửa 12 giờ gác theo THỜI GIAN trong khi
// thứ cần báo là TRẠNG THÁI ĐÃ ĐỔI. Ca chủ dự án chỉ ra: mở web rồi 5 giây sau
// mở bản cài, trên Android (bản cài dùng CHUNG kho với Chrome) nhịp thứ hai bị
// chặn ⇒ pwa_last_open_at mãi null.
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
