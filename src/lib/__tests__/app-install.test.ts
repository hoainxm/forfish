// CÀI APP — ẩn/hiện thông minh (2026-10-27, anh Long: "phải check luôn là đã cài hay chưa để ẩn hay hiện thông minh").
import { describe, expect, it } from "vitest";
import { quyetDinhCai } from "@/lib/app-install";
import manifest from "@/app/manifest";

const goc = { standalone: false, phatHien: null, soNhoDaCai: false, coHopCai: false, ios: false, android: false };

describe("quyetDinhCai", () => {
  it("đang mở bằng app ⇒ ẩn hẳn, bất kể nguồn khác", () => {
    expect(quyetDinhCai({ ...goc, standalone: true, coHopCai: true, android: true })).toBe("an");
  });
  it("Chrome báo đã cài (getInstalledRelatedApps) ⇒ đã cài, kể cả khi còn hộp cài", () => {
    expect(quyetDinhCai({ ...goc, phatHien: true, coHopCai: true, android: true })).toBe("da-cai");
  });
  it("có API mà API nói CHƯA ⇒ tin API, bỏ qua sổ máy cũ (gỡ app rồi)", () => {
    expect(quyetDinhCai({ ...goc, phatHien: false, soNhoDaCai: true, android: true })).toBe("tay-android");
  });
  it("không có API (iPhone) mà sổ máy nhớ đã cài ⇒ đã cài", () => {
    expect(quyetDinhCai({ ...goc, soNhoDaCai: true, ios: true })).toBe("da-cai");
  });
  it("chưa cài: có hộp cài ⇒ nút; iPhone ⇒ hướng dẫn Chia sẻ; Android không hộp ⇒ hướng dẫn menu ⋮; máy tính ⇒ ẩn", () => {
    expect(quyetDinhCai({ ...goc, coHopCai: true, android: true })).toBe("nut");
    expect(quyetDinhCai({ ...goc, coHopCai: true })).toBe("nut"); // Chrome máy tính có hộp cài
    expect(quyetDinhCai({ ...goc, ios: true })).toBe("tay-ios");
    expect(quyetDinhCai({ ...goc, android: true })).toBe("tay-android");
    expect(quyetDinhCai(goc)).toBe("an");
  });
});

describe("manifest", () => {
  it("khai related_applications trỏ chính manifest (để Chrome biết PWA đã cài), không ép sang app khác", () => {
    const m = manifest();
    expect(m.related_applications).toEqual([{ platform: "webapp", url: "/manifest.webmanifest" }]);
    expect(m.prefer_related_applications).toBeUndefined();
  });
});
