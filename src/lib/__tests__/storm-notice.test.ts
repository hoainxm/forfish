// Câu cho nhánh "chưa hỏi được tin bão" + luật hiện bão ở Trang chủ
// (2026-08-18, audit S10/S11/S13/M5).
import { describe, expect, it } from "vitest";
import {
  STORM_HOME_STALE_MS,
  shouldShowStormOnHome,
  stormAgeLabel,
  stormNoticeShort,
  stormNoticeText,
  type StormStatus,
} from "../storms";

const NOW = Date.parse("2026-08-18T09:00:00+07:00");
const H = 3_600_000;

describe("stormAgeLabel", () => {
  it("giờ dưới 48h, ngày từ 48h; tối thiểu 1 giờ", () => {
    expect(stormAgeLabel(NOW - 10 * 60_000, NOW)).toBe("1 giờ");
    expect(stormAgeLabel(NOW - 3 * H, NOW)).toBe("3 giờ");
    expect(stormAgeLabel(NOW - 47 * H, NOW)).toBe("47 giờ");
    expect(stormAgeLabel(NOW - 72 * H, NOW)).toBe("3 ngày");
  });
  it("null / rác / tương lai → null", () => {
    expect(stormAgeLabel(null, NOW)).toBeNull();
    expect(stormAgeLabel(NaN, NOW)).toBeNull();
    expect(stormAgeLabel(NOW + H, NOW)).toBeNull();
  });
});

describe("stormNoticeText — chỉ nói cho nhánh khong-hoi-duoc, bằng TUỔI tin", () => {
  it("nhánh khác → null (không có gì để nhắc)", () => {
    expect(stormNoticeText({ kind: "dang-hoi" }, NOW, false)).toBeNull();
    expect(
      stormNoticeText({ kind: "khong-co", checkedAt: NOW - H }, NOW, false),
    ).toBeNull();
    expect(
      stormNoticeText(
        { kind: "co-bao", storms: [], checkedAt: NOW, cu: false },
        NOW,
        true,
      ),
    ).toBeNull();
  });

  it("mất sóng + có tin cũ → nói tuổi tin, KHÔNG nói 'không có bão'", () => {
    const s: StormStatus = { kind: "khong-hoi-duoc", checkedAt: NOW - 3 * H };
    const t = stormNoticeText(s, NOW, false)!;
    expect(t).toContain("đã cũ 3 giờ");
    expect(t).toContain("đài duyên hải");
    expect(t.toLowerCase()).not.toContain("không có bão");
    expect(t).not.toContain("Nguồn tin bão đang lỗi");
    // >48h → ngày
    expect(
      stormNoticeText({ kind: "khong-hoi-duoc", checkedAt: NOW - 3 * 24 * H }, NOW, false),
    ).toContain("3 ngày");
  });

  it("mất sóng + chưa từng có tin → 'chưa hỏi được lần nào'", () => {
    const t = stormNoticeText({ kind: "khong-hoi-duoc", checkedAt: null }, NOW, false)!;
    expect(t).toContain("Chưa hỏi được tin bão lần nào");
    expect(t).toContain("đài duyên hải");
  });

  it("máy CÓ sóng mà vẫn hỏng → nói NGUỒN lỗi, không đổ cho máy; vẫn kèm tuổi tin", () => {
    const t1 = stormNoticeText({ kind: "khong-hoi-duoc", checkedAt: NOW - 5 * H }, NOW, true)!;
    expect(t1).toContain("Nguồn tin bão đang lỗi");
    expect(t1).toContain("5 giờ");
    expect(t1).not.toContain("mất sóng");
    expect(t1).not.toContain("không có sóng");
    const t2 = stormNoticeText({ kind: "khong-hoi-duoc", checkedAt: null }, NOW, true)!;
    expect(t2).toContain("Nguồn tin bão đang lỗi");
    expect(t2).toContain("chưa có tin nào");
  });

  it("câu ngắn cho chip: có tuổi thì nói tuổi, không thì 'chưa hỏi được' (không bao giờ 'không có')", () => {
    expect(
      stormNoticeShort({ kind: "khong-hoi-duoc", checkedAt: NOW - 2 * H }, NOW),
    ).toBe("Tin bão cũ 2 giờ");
    expect(stormNoticeShort({ kind: "khong-hoi-duoc", checkedAt: null }, NOW)).toBe(
      "Chưa hỏi được tin bão",
    );
    expect(stormNoticeShort({ kind: "dang-hoi" }, NOW)).toBeNull();
  });
});

describe("shouldShowStormOnHome — Trang chủ chỉ lên tiếng khi đáng nói", () => {
  it("có bão → hiện (kể cả tin cũ)", () => {
    expect(
      shouldShowStormOnHome(
        { kind: "co-bao", storms: [], checkedAt: NOW - 30 * H, cu: true },
        NOW,
      ),
    ).toBe(true);
  });
  it("không có bão / đang hỏi → im", () => {
    expect(shouldShowStormOnHome({ kind: "khong-co", checkedAt: NOW }, NOW)).toBe(false);
    expect(shouldShowStormOnHome({ kind: "dang-hoi" }, NOW)).toBe(false);
  });
  it("chưa hỏi được: tin dưới 24h → im; quá 24h hoặc chưa từng có → hiện", () => {
    expect(
      shouldShowStormOnHome({ kind: "khong-hoi-duoc", checkedAt: NOW - 13 * H }, NOW),
    ).toBe(false);
    expect(
      shouldShowStormOnHome(
        { kind: "khong-hoi-duoc", checkedAt: NOW - STORM_HOME_STALE_MS - 1 },
        NOW,
      ),
    ).toBe(true);
    expect(shouldShowStormOnHome({ kind: "khong-hoi-duoc", checkedAt: null }, NOW)).toBe(
      true,
    );
    // mốc tương lai (đồng hồ lệch) → không tin được → hiện
    expect(
      shouldShowStormOnHome({ kind: "khong-hoi-duoc", checkedAt: NOW + 2 * H }, NOW),
    ).toBe(true);
  });
});
