// Kho câu nói có duyên (lib/sen-bien/cau-vui.ts, anh Long 2026-10-22: câu lảng khi mất sóng, câu giờ khi chờ máy nhà).
import { afterEach, describe, expect, it, vi } from "vitest";
import { CAU_GIO, CAU_LANG, chonCau, DOI_CAU_GIO_MS, henCauGio, MOC_GIO_MS } from "@/lib/sen-bien/cau-vui";
import { HOI_HAN_MS } from "@/lib/sen-bien/hoi-may-chu";

const moiCau = [...Object.values(CAU_LANG).flat(), ...CAU_GIO.flat()];

describe("luật chữ của kho", () => {
  it("gọi đủ 'Sen Biển', không viết tắt 'Sen' đứng một mình", () => {
    for (const c of moiCau) expect(c).not.toMatch(/Sen(?! Biển)/);
  });
  it("câu mất sóng luôn chỉ sang việc làm được không cần sóng hoặc hẹn hỏi lại", () => {
    for (const c of CAU_LANG.mat_song) expect(c).toMatch(/có sóng|bản đồ|gió sóng|đường về|cảng/i);
  });
  it("mỗi nhóm có ít nhất 3 câu (nhịp câu giờ: 4 nhịp, mỗi nhịp ≥ 3)", () => {
    for (const nhom of Object.values(CAU_LANG)) expect(nhom.length).toBeGreaterThanOrEqual(3);
    expect(CAU_GIO).toHaveLength(MOC_GIO_MS.length);
    for (const nhom of CAU_GIO) expect(nhom.length).toBeGreaterThanOrEqual(3);
  });
  it("câu ngắn để đọc (≤ 140 ký tự)", () => {
    for (const c of moiCau) expect(c.length).toBeLessThanOrEqual(140);
  });
  it("nhịp câu giờ cuối nói TRƯỚC trần chờ máy nhà", () => expect(MOC_GIO_MS[MOC_GIO_MS.length - 1]).toBeLessThan(HOI_HAN_MS));
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

describe("henCauGio — câu giờ theo nhịp, không đè câu trả lời", () => {
  afterEach(() => vi.useRealTimers());
  it("máy nhà trả lời nhanh (< nhịp đầu) ⇒ KHÔNG nói câu giờ nào", async () => {
    vi.useFakeTimers();
    const noi = vi.fn();
    const xong = henCauGio(noi, () => true);
    vi.advanceTimersByTime(MOC_GIO_MS[0] - 1);
    await xong();
    vi.advanceTimersByTime(20_000);
    expect(noi).not.toHaveBeenCalled();
  });
  it("nhịp đầu không nói ngay — chờ ≥ 1 s", () => expect(MOC_GIO_MS[0]).toBeGreaterThanOrEqual(1_000));
  it("các nhịp cách nhau ≥ 2,5 s để câu giờ nói trọn", () => {
    for (let k = 1; k < MOC_GIO_MS.length; k++) expect(MOC_GIO_MS[k] - MOC_GIO_MS[k - 1]).toBeGreaterThanOrEqual(2_500);
  });
  it("chờ đủ lâu ⇒ nói lần lượt cả bốn nhịp", () => {
    vi.useFakeTimers();
    const noi = vi.fn();
    henCauGio(noi, () => true);
    for (let k = 0; k < MOC_GIO_MS.length; k++) {
      vi.advanceTimersByTime(MOC_GIO_MS[k] - (k ? MOC_GIO_MS[k - 1] : 0));
      expect(noi).toHaveBeenCalledTimes(k + 1);
      expect(CAU_GIO[k]).toContain(noi.mock.calls[k][0]);
    }
  });
  it("có kết quả lúc câu giờ ĐANG ĐỌC ⇒ đợi nó đọc xong mới trả", async () => {
    vi.useFakeTimers();
    let baoXong: (() => void) | null = null;
    const xong = henCauGio((_c, x) => (baoXong = x), () => true);
    vi.advanceTimersByTime(MOC_GIO_MS[0]);
    let daTra = false;
    void xong().then(() => (daTra = true));
    await vi.advanceTimersByTimeAsync(500);
    expect(daTra).toBe(false);
    baoXong!();
    await vi.advanceTimersByTimeAsync(0);
    expect(daTra).toBe(true);
  });
  it("câu giờ không báo xong (bị cắt) ⇒ chờ tối đa DOI_CAU_GIO_MS", async () => {
    vi.useFakeTimers();
    const xong = henCauGio(() => {}, () => true);
    vi.advanceTimersByTime(MOC_GIO_MS[0]);
    let daTra = false;
    void xong().then(() => (daTra = true));
    await vi.advanceTimersByTimeAsync(DOI_CAU_GIO_MS - 1);
    expect(daTra).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(daTra).toBe(true);
  });
  it("kết thúc ⇒ không nói thêm nhịp sau", async () => {
    vi.useFakeTimers();
    const noi = vi.fn((_c: string, x: () => void) => x());
    const xong = henCauGio(noi, () => true);
    vi.advanceTimersByTime(MOC_GIO_MS[0]);
    await xong();
    vi.advanceTimersByTime(20_000);
    expect(noi).toHaveBeenCalledTimes(1);
  });
  it("lượt cũ (conCho false) ⇒ không chen câu giờ", () => {
    vi.useFakeTimers();
    const noi = vi.fn();
    henCauGio(noi, () => false);
    vi.advanceTimersByTime(20_000);
    expect(noi).not.toHaveBeenCalled();
  });
});
