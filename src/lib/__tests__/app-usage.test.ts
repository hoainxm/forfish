import { describe, expect, it } from "vitest";
import {
  countsAsOfflineReady,
  usageCallPriority,
  usageStage,
} from "@/lib/app-usage";

describe("countsAsOfflineReady — iOS có kho RIÊNG cho bản cài", () => {
  it("iOS + BẢN CÀI → tính (đúng cái kho sẽ dùng ngoài biển)", () => {
    expect(
      countsAsOfflineReady({ offlineReady: true, standalone: true, ios: true }),
    ).toBe(true);
  });

  it("iOS + SAFARI → KHÔNG tính, dù máy báo đã tải đủ", () => {
    // đây là ca TC-13: tải đủ trong Safari rồi Thêm vào Màn hình chính, kho của
    // bản cài vẫn trống trơn — báo xanh ở đây là nói dối đúng lúc nguy hiểm nhất
    expect(
      countsAsOfflineReady({ offlineReady: true, standalone: false, ios: true }),
    ).toBe(false);
  });

  it("Android + web thường → VẪN tính (bản cài dùng chung kho với Chrome)", () => {
    expect(
      countsAsOfflineReady({ offlineReady: true, standalone: false, ios: false }),
    ).toBe(true);
  });

  it("Android + bản cài → tính", () => {
    expect(
      countsAsOfflineReady({ offlineReady: true, standalone: true, ios: false }),
    ).toBe(true);
  });

  it("máy báo CHƯA đủ → không tính, bất kể chế độ nào", () => {
    for (const ios of [true, false])
      for (const standalone of [true, false])
        expect(
          countsAsOfflineReady({ offlineReady: false, standalone, ios }),
        ).toBe(false);
  });
});

describe("usageStage — bậc CAO NHẤT đạt được", () => {
  const S = (
    pwaLastOpenAt: string | null,
    webLastOpenAt: string | null,
    offlineReadyAt: string | null,
  ) => usageStage({ pwaLastOpenAt, webLastOpenAt, offlineReadyAt });

  it("chưa gửi nhịp nào → chua-ghi-nhan", () => {
    expect(S(null, null, null)).toBe("chua-ghi-nhan");
  });
  it("chỉ mở web → moi-vo-web", () => {
    expect(S(null, "2026-08-01", null)).toBe("moi-vo-web");
  });
  it("đã mở bản cài, chưa đủ dữ liệu → da-mo-ban-cai", () => {
    expect(S("2026-08-01", "2026-08-01", null)).toBe("da-mo-ban-cai");
  });
  it("có mốc đủ đồ → du-do-di-bien (bậc cao nhất thắng)", () => {
    expect(S("2026-08-01", "2026-08-01", "2026-08-01")).toBe("du-do-di-bien");
    // Android web-only vẫn lên được bậc 3 — kho dùng chung, không phải lỗi
    expect(S(null, "2026-08-01", "2026-08-01")).toBe("du-do-di-bien");
  });
});

describe("usageCallPriority — ai gọi trước", () => {
  it("mới-vô-web đứng ĐẦU: sẽ ra khơi với máy trắng tay mà không biết", () => {
    const order = (
      ["du-do-di-bien", "chua-ghi-nhan", "da-mo-ban-cai", "moi-vo-web"] as const
    )
      .slice()
      .sort((a, b) => usageCallPriority(a) - usageCallPriority(b));
    expect(order).toEqual([
      "moi-vo-web",
      "da-mo-ban-cai",
      "chua-ghi-nhan",
      "du-do-di-bien",
    ]);
  });
});
