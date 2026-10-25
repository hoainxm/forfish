import { describe, it, expect } from "vitest";
import { EMPTY_NUDGE } from "@/lib/install-nudge";
import { CHUONG_NUDGE_GAP_MS, chonKhoiTang5, nenNhacChuong, type TrangThaiTang5 } from "@/lib/tang-5";

const NOW = 1_800_000_000_000;
const NGAY = 24 * 3600000;

function tt(o: Partial<TrangThaiTang5> = {}): TrangThaiTang5 {
  return {
    online: true,
    coCangNha: true,
    pushHoTro: true,
    pushState: "off",
    chuongNudge: EMPTY_NUDGE,
    caiAppHienDuoc: true,
    now: NOW,
    ...o,
  };
}

describe("chonKhoiTang5 — một khối, ưu tiên cố định", () => {
  it("mất sóng ⇒ không khối nào, dù mọi điều kiện khác đủ", () => {
    expect(chonKhoiTang5(tt({ online: false, coCangNha: false }))).toBeNull();
  });
  it("chưa có cảng nhà ⇒ cang-nha, đứng trên chuông và cài app", () => {
    expect(chonKhoiTang5(tt({ coCangNha: false }))).toBe("cang-nha");
  });
  it("có cảng nhà + push tắt + chưa nhắc ⇒ chuông", () => {
    expect(chonKhoiTang5(tt())).toBe("chuong");
  });
  it("push đã bật ⇒ bỏ chuông, xuống cài app", () => {
    expect(chonKhoiTang5(tt({ pushState: "on" }))).toBe("cai-app");
  });
  it("máy không hỗ trợ push (iPhone chưa cài PWA) ⇒ Cài app tự lên thay", () => {
    expect(chonKhoiTang5(tt({ pushHoTro: false }))).toBe("cai-app");
  });
  it("chưa tra xong push (unknown) ⇒ không nhắc chuông vội", () => {
    expect(chonKhoiTang5(tt({ pushState: "unknown" }))).toBe("cai-app");
  });
  it("chuông đã Ẩn (hoãn) ⇒ cài app; hết hạn hoãn ⇒ chuông lại", () => {
    const hoan = { ...EMPTY_NUDGE, count: 1, lastAt: NOW - 10 * NGAY, snoozeUntil: NOW + NGAY };
    expect(chonKhoiTang5(tt({ chuongNudge: hoan }))).toBe("cai-app");
    expect(chonKhoiTang5(tt({ chuongNudge: hoan, now: NOW + 2 * NGAY }))).toBe("chuong");
  });
  it("không còn gì để mời ⇒ null (không khối trống)", () => {
    expect(chonKhoiTang5(tt({ pushState: "on", caiAppHienDuoc: false }))).toBeNull();
  });
});

describe("nenNhacChuong — ≤3 lần, cách ≥7 ngày", () => {
  it("chưa nhắc lần nào ⇒ nhắc", () => {
    expect(nenNhacChuong(EMPTY_NUDGE, NOW)).toBe(true);
  });
  it("vừa nhắc hôm kia ⇒ chưa (cách < 7 ngày); đủ 7 ngày ⇒ nhắc", () => {
    const s = { ...EMPTY_NUDGE, count: 1, lastAt: NOW - 2 * NGAY };
    expect(nenNhacChuong(s, NOW)).toBe(false);
    expect(nenNhacChuong(s, NOW - 2 * NGAY + CHUONG_NUDGE_GAP_MS)).toBe(true);
  });
  it("đủ 3 lần ⇒ im hẳn; dismissed ⇒ im hẳn", () => {
    expect(nenNhacChuong({ ...EMPTY_NUDGE, count: 3, lastAt: NOW - 30 * NGAY }, NOW)).toBe(false);
    expect(nenNhacChuong({ ...EMPTY_NUDGE, dismissed: true }, NOW)).toBe(false);
  });
});
