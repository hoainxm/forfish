import { describe, expect, it } from "vitest";
import { normalizePlatform, normalizeDataUntil } from "@/lib/app-usage";

// LOẠI MÁY (0022) — giá trị này đi THẲNG vào cột có CHECK constraint, nên chỉ
// được để lọt đúng 3 giá trị hợp lệ. "chưa biết" (null) KHÁC "hỏi rồi mà không
// phải iOS/Android" (khac) — đừng gộp.
describe("normalizePlatform", () => {
  it("giữ đúng 3 giá trị hợp lệ", () => {
    expect(normalizePlatform("ios")).toBe("ios");
    expect(normalizePlatform("android")).toBe("android");
    expect(normalizePlatform("khac")).toBe("khac");
  });

  it("client CŨ không gửi gì → null (chưa biết), KHÔNG đoán thành 'khac'", () => {
    expect(normalizePlatform(undefined)).toBeNull();
    expect(normalizePlatform(null)).toBeNull();
  });

  it("giá trị lạ / sai kiểu → null, không bao giờ lọt xuống DB", () => {
    expect(normalizePlatform("iOS")).toBeNull(); // phân biệt hoa-thường
    expect(normalizePlatform("windows")).toBeNull();
    expect(normalizePlatform(123)).toBeNull();
    expect(normalizePlatform({ platform: "ios" })).toBeNull();
    expect(normalizePlatform("'; drop table customers; --")).toBeNull();
  });
});
import {
  countsAsOfflineReady,
  usageCallPriority,
  usageStage,
} from "@/lib/app-usage";

describe("countsAsOfflineReady — MỌI nền đều phải gửi TỪ BẢN CÀI", () => {
  it("bản cài + đã tải đủ → tính (đúng cái kho sẽ dùng ngoài biển)", () => {
    expect(countsAsOfflineReady({ offlineReady: true, standalone: true })).toBe(
      true,
    );
  });

  it("iOS-Safari (chưa cài) → KHÔNG tính, dù máy báo đã tải đủ", () => {
    // ca TC-13: tải đủ trong Safari rồi mới Thêm vào Màn hình chính, kho của
    // bản cài vẫn trống trơn — báo xanh ở đây là nói dối đúng lúc nguy hiểm nhất
    expect(countsAsOfflineReady({ offlineReady: true, standalone: false })).toBe(
      false,
    );
  });

  it("ANDROID + tab Chrome → CŨNG KHÔNG tính (siết 2026-08-01j)", () => {
    // Trước đây Android được miễn vì bản cài dùng chung kho với Chrome, nên xét
    // về DỮ LIỆU thì tải ở tab cũng như tải ở bản cài. Nhưng thang này là DANH
    // SÁCH GỌI ĐIỆN: miễn cho Android là người chưa cài nhảy thẳng lên bậc cao
    // nhất (usageCallPriority 3 "yên tâm nhất") và rơi khỏi danh sách nhắc cài,
    // dù màn hình họ chưa có cái icon nào. Chủ dự án chốt: "1 chiều thôi, web →
    // PWA → tải; nếu không PWA thì cứ nằm ở Web để đảm bảo họ có PWA".
    expect(countsAsOfflineReady({ offlineReady: true, standalone: false })).toBe(
      false,
    );
  });

  it("máy báo CHƯA đủ → không tính, bất kể chế độ nào", () => {
    for (const standalone of [true, false])
      expect(countsAsOfflineReady({ offlineReady: false, standalone })).toBe(
        false,
      );
  });

  it("BẬC 'đủ đồ' KHÔNG có đường tắt — muốn tới phải qua bản cài", () => {
    // đúng một tổ hợp cho ra true
    const combos = [
      { offlineReady: false, standalone: false },
      { offlineReady: false, standalone: true },
      { offlineReady: true, standalone: false },
      { offlineReady: true, standalone: true },
    ];
    expect(combos.filter(countsAsOfflineReady)).toEqual([
      { offlineReady: true, standalone: true },
    ]);
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

describe("usageStage — bậc 'tải dở dang' (2026-08-03)", () => {
  /*  Chủ dự án hỏi: "trong thang nấc… đã lưu dữ liệu qua các bậc chưa, hay vẫn
      ở web?" Thang cũ nhảy thẳng từ "đã mở bản cài" sang "đủ đồ", gộp làm MỘT
      hai người cần hai cuộc gọi khác hẳn nhau. */
  it("mở bản cài mà kho TRỐNG ⇒ 'da-mo-ban-cai'", () => {
    expect(
      usageStage({
        pwaLastOpenAt: "2026-08-02T10:00:00Z",
        webLastOpenAt: null,
        offlineReadyAt: null,
        dataUntil: null,
      }),
    ).toBe("da-mo-ban-cai");
  });

  it("mở bản cài + kho ĐÃ CÓ ngày phủ ⇒ 'da-tai-mot-phan'", () => {
    expect(
      usageStage({
        pwaLastOpenAt: "2026-08-02T10:00:00Z",
        webLastOpenAt: null,
        offlineReadyAt: null,
        dataUntil: "2026-08-17",
      }),
    ).toBe("da-tai-mot-phan");
  });

  it("đủ đồ thì vẫn là bậc cao nhất, không bị bậc mới nuốt", () => {
    expect(
      usageStage({
        pwaLastOpenAt: "2026-08-02T10:00:00Z",
        webLastOpenAt: null,
        offlineReadyAt: "2026-08-02T10:05:00Z",
        dataUntil: "2026-08-17",
      }),
    ).toBe("du-do-di-bien");
  });

  it("CHƯA mở bản cài thì dù có ngày phủ cũng KHÔNG lên bậc mới", () => {
    /*  Ca thật đã gặp trên prod: nhịp web từ máy mới ghi nhầm vào cột bản cài
        (đã vá ở 829abfa). Thang phải đòi ĐỦ CẢ HAI, không tin mỗi ngày phủ. */
    expect(
      usageStage({
        pwaLastOpenAt: null,
        webLastOpenAt: "2026-08-02T10:00:00Z",
        offlineReadyAt: null,
        dataUntil: "2026-08-17",
      }),
    ).toBe("moi-vo-web");
  });

  it("bậc mới phải gọi SAU 'bản cài trống' và TRƯỚC 'đủ đồ'", () => {
    expect(usageCallPriority("da-mo-ban-cai")).toBeLessThan(
      usageCallPriority("da-tai-mot-phan"),
    );
    expect(usageCallPriority("da-tai-mot-phan")).toBeLessThan(
      usageCallPriority("du-do-di-bien"),
    );
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

/*  NGÀY PHỦ DỮ LIỆU (0025) — client khai, máy chủ KHÔNG tin.
    Giá trị này đi thẳng vào một cột `date`: một chuỗi rác lọt xuống là CẢ LỆNH
    UPDATE HỎNG ⇒ mất luôn 3 mốc thời gian vốn đang chạy tốt. Đúng khuôn lỗi mà
    cột 0022 đã dính một lần rồi.  */
describe("normalizeDataUntil — chặn rác trước khi xuống cột date", () => {
  it("nhận đúng dạng YYYY-MM-DD", () => {
    expect(normalizeDataUntil("2026-08-10")).toBe("2026-08-10");
  });

  it("từ chối mọi thứ không phải chuỗi ngày", () => {
    for (const v of [null, undefined, 42, {}, [], true, "", "hôm nay"]) {
      expect(normalizeDataUntil(v)).toBeNull();
    }
  });

  it("từ chối ngày SAI DẠNG (có giờ, thiếu số 0, ngăn cách khác)", () => {
    expect(normalizeDataUntil("2026-08-10T00:00:00Z")).toBeNull();
    expect(normalizeDataUntil("2026-8-10")).toBeNull();
    expect(normalizeDataUntil("10/08/2026")).toBeNull();
  });

  it("từ chối ngày KHÔNG CÓ THẬT", () => {
    expect(normalizeDataUntil("2026-02-31")).toBeNull();
    expect(normalizeDataUntil("2026-13-01")).toBeNull();
  });

  it("từ chối ngày ngoài dải dùng được (đồng hồ máy hỏng nặng)", () => {
    expect(normalizeDataUntil("1970-01-01")).toBeNull();
    expect(normalizeDataUntil("2999-01-01")).toBeNull();
  });

  it("KHÔNG ném với chuỗi cố tình phá", () => {
    expect(() => normalizeDataUntil("2026-08-10'; drop table")).not.toThrow();
    expect(normalizeDataUntil("2026-08-10'; drop table")).toBeNull();
  });
});
