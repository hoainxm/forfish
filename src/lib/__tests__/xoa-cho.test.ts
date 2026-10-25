import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { taoXoaCho, XOA_CHO_MS } from "@/lib/xoa-cho";
import { TOAST_MS } from "@/lib/toast";

type Hang = { id: string; ten: string };

function dung(ban: Hang[]) {
  let list = ban;
  const ghi = vi.fn((n: Hang[]) => {
    list = n;
  });
  const hien = vi.fn((n: Hang[]) => {
    list = n;
  });
  const khiChot = vi.fn();
  const bao = vi.fn<(text: string, hoanTac: () => void) => void>();
  const x = taoXoaCho<Hang>({
    hienTai: () => list,
    hien,
    ghi,
    ten: (h) => h.ten,
    khiChot,
    bao,
  });
  return { x, ghi, hien, khiChot, bao, doc: () => list };
}

describe("xoa-cho — xoá chờ 5 s có Hoàn tác (TAU-12)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("cùng đồng hồ với toast", () => {
    expect(XOA_CHO_MS).toBe(TOAST_MS);
  });

  it("xoá: hàng biến khỏi màn ngay, toast nêu tên, CHƯA ghi máy; hết giờ mới ghi + dọn kèm", () => {
    const d = dung([
      { id: "a", ten: "Thay dầu" },
      { id: "b", ten: "Bơm mỡ" },
    ]);
    d.x.xoa("a");
    expect(d.hien).toHaveBeenCalledWith([{ id: "b", ten: "Bơm mỡ" }]);
    expect(d.bao.mock.calls[0][0]).toBe("Đã xoá «Thay dầu»");
    expect(d.ghi).not.toHaveBeenCalled();
    expect(d.khiChot).not.toHaveBeenCalled();
    expect(d.x.dangCho()?.id).toBe("a");
    vi.advanceTimersByTime(XOA_CHO_MS - 1);
    expect(d.ghi).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(d.ghi).toHaveBeenCalledWith([{ id: "b", ten: "Bơm mỡ" }]);
    expect(d.khiChot).toHaveBeenCalledWith({ id: "a", ten: "Thay dầu" });
    expect(d.x.dangCho()).toBeNull();
  });

  it("Hoàn tác: hàng về, ghi lại danh sách đủ, không dọn kèm, đồng hồ huỷ", () => {
    const d = dung([{ id: "a", ten: "Thay dầu" }]);
    d.x.xoa("a");
    const hoanTac = d.bao.mock.calls[0][1];
    hoanTac();
    expect(d.ghi).toHaveBeenCalledTimes(1);
    expect(d.doc()).toEqual([{ id: "a", ten: "Thay dầu" }]);
    vi.advanceTimersByTime(XOA_CHO_MS * 2);
    expect(d.ghi).toHaveBeenCalledTimes(1);
    expect(d.khiChot).not.toHaveBeenCalled();
  });

  it("chốt đọc danh sách HIỆN TẠI — sửa hàng khác trong lúc chờ không bị đè", () => {
    const d = dung([
      { id: "a", ten: "A" },
      { id: "b", ten: "B" },
    ]);
    d.x.xoa("a");
    // màn sửa hàng b trong 5 s (commit của màn ghi thẳng)
    d.ghi([{ id: "b", ten: "B đã sửa" }]);
    vi.advanceTimersByTime(XOA_CHO_MS);
    expect(d.doc()).toEqual([{ id: "b", ten: "B đã sửa" }]);
  });

  it("xoá tiếp bản khác ⇒ bản trước chốt ngay (một bản chờ một lúc); rời màn `chot()` ghi luôn", () => {
    const d = dung([
      { id: "a", ten: "A" },
      { id: "b", ten: "B" },
    ]);
    d.x.xoa("a");
    d.x.xoa("b");
    expect(d.ghi).toHaveBeenCalledTimes(1);
    expect(d.khiChot).toHaveBeenCalledWith({ id: "a", ten: "A" });
    expect(d.x.dangCho()?.id).toBe("b");
    d.x.chot();
    expect(d.ghi).toHaveBeenCalledTimes(2);
    expect(d.doc()).toEqual([]);
    d.x.chot(); // không có gì chờ ⇒ không ghi thêm
    expect(d.ghi).toHaveBeenCalledTimes(2);
  });

  it("id không có trong danh sách ⇒ không làm gì", () => {
    const d = dung([{ id: "a", ten: "A" }]);
    d.x.xoa("zzz");
    expect(d.hien).not.toHaveBeenCalled();
    expect(d.bao).not.toHaveBeenCalled();
  });
});
