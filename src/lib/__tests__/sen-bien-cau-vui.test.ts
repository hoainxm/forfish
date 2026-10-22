// Kho câu nói có duyên (lib/sen-bien/cau-vui.ts, anh Long 2026-10-22: câu lảng khi mất sóng, câu giờ khi chờ máy nhà).
import { afterEach, describe, expect, it, vi } from "vitest";
import { CAU_GIO, CAU_LANG, chonCau, henCauGio, MOC_GIO_MS } from "@/lib/sen-bien/cau-vui";
import { HOI_HAN_MS } from "@/lib/sen-bien/hoi-may-chu";

const moiCau = [...Object.values(CAU_LANG).flat(), ...CAU_GIO.flat()];

describe("luật chữ của kho", () => {
  it("gọi đủ 'Sen Biển', không viết tắt 'Sen' đứng một mình", () => {
    for (const c of moiCau) expect(c).not.toMatch(/Sen(?! Biển)/);
  });
  it("câu mất sóng luôn chỉ sang việc làm được không cần sóng hoặc hẹn hỏi lại", () => {
    for (const c of CAU_LANG.mat_song) expect(c).toMatch(/có sóng|bản đồ|gió sóng|đường về|cảng/i);
  });
  it("mỗi nhóm có ít nhất 3 câu (nhịp câu giờ: 3 nhịp, mỗi nhịp ≥ 3)", () => {
    for (const nhom of Object.values(CAU_LANG)) expect(nhom.length).toBeGreaterThanOrEqual(3);
    expect(CAU_GIO).toHaveLength(3);
    for (const nhom of CAU_GIO) expect(nhom.length).toBeGreaterThanOrEqual(3);
  });
  it("câu ngắn để đọc (≤ 140 ký tự)", () => {
    for (const c of moiCau) expect(c.length).toBeLessThanOrEqual(140);
  });
  it("nhịp câu giờ cuối nói TRƯỚC trần chờ máy nhà", () => expect(MOC_GIO_MS[1]).toBeLessThan(HOI_HAN_MS));
});

describe("chonCau — xoay vòng, không lặp liền", () => {
  it("rnd luôn trúng cùng chỗ vẫn không lặp câu vừa nói", () => {
    const bo = ["a", "b", "c"];
    const a = chonCau(bo, "thu-lap", () => 0);
    const b = chonCau(bo, "thu-lap", () => 0);
    expect(a).not.toBe(b);
  });
  it("nhóm rỗng / một câu", () => {
    expect(chonCau([], "rong")).toBe("");
    expect(chonCau(["x"], "mot")).toBe("x");
  });
});

describe("henCauGio — câu giờ theo nhịp, có kết quả là cắt", () => {
  afterEach(() => vi.useRealTimers());
  it("chờ đủ lâu ⇒ nói nhịp 2 rồi nhịp 3", () => {
    vi.useFakeTimers();
    const noi = vi.fn();
    henCauGio(noi, () => true);
    vi.advanceTimersByTime(MOC_GIO_MS[0]);
    expect(noi).toHaveBeenCalledTimes(1);
    expect(CAU_GIO[1]).toContain(noi.mock.calls[0][0]);
    vi.advanceTimersByTime(MOC_GIO_MS[1] - MOC_GIO_MS[0]);
    expect(noi).toHaveBeenCalledTimes(2);
    expect(CAU_GIO[2]).toContain(noi.mock.calls[1][0]);
  });
  it("huỷ (đã có câu trả lời) ⇒ không nói thêm", () => {
    vi.useFakeTimers();
    const noi = vi.fn();
    const huy = henCauGio(noi, () => true);
    huy();
    vi.advanceTimersByTime(10_000);
    expect(noi).not.toHaveBeenCalled();
  });
  it("lượt cũ (conCho false) ⇒ không chen câu giờ", () => {
    vi.useFakeTimers();
    const noi = vi.fn();
    henCauGio(noi, () => false);
    vi.advanceTimersByTime(10_000);
    expect(noi).not.toHaveBeenCalled();
  });
});
