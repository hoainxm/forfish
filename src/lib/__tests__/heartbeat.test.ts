import { describe, expect, it } from "vitest";
import {
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

// THANG LÙI 3 phút → 5 phút → 12 giờ (chủ dự án chốt 2026-08-01g). Máy ĐANG
// ONLINE mà không nghe được máy chủ thường là trục trặc NGẮN (route cold-start,
// wifi cảng chập chờn) — hai lần thử thưa gỡ được hầu hết, hết thang mới im.
describe("netBackoffMs — thang lùi khi không nghe được máy chủ", () => {
  it("hỏng lần 1 → 3 phút; lần 2 → 5 phút; lần 3 → 12 giờ", () => {
    expect(netBackoffMs(1)).toBe(3 * 60 * 1000);
    expect(netBackoffMs(2)).toBe(5 * 60 * 1000);
    expect(netBackoffMs(3)).toBe(HEARTBEAT_MIN_GAP_MS);
  });

  it("hỏng quá thang → giữ nấc cuối, KHÔNG quay lại nấc nhanh", () => {
    expect(netBackoffMs(4)).toBe(HEARTBEAT_MIN_GAP_MS);
    expect(netBackoffMs(99)).toBe(HEARTBEAT_MIN_GAP_MS);
  });

  it("bộ đếm lạ (0 · âm · NaN) → nấc đầu, không bao giờ ném", () => {
    expect(netBackoffMs(0)).toBe(3 * 60 * 1000);
    expect(netBackoffMs(-5)).toBe(3 * 60 * 1000);
    expect(netBackoffMs(Number.NaN)).toBe(3 * 60 * 1000);
  });

  it("thang chỉ ĐI LÊN — không có nấc nào ngắn hơn nấc trước", () => {
    const steps = HEARTBEAT_NET_BACKOFF_STEPS_MS;
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]).toBeGreaterThan(steps[i - 1]);
    }
  });
});
