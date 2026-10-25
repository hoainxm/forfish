import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bamHanhDong, baoToast, docToast, tatToast, theoDoiToast, TOAST_MS } from "@/lib/toast";
import { NHAN, nhanHopLe } from "@/lib/labels";

describe("toast — kho module một câu một lúc", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    tatToast();
    vi.useRealTimers();
  });

  it("báo mới đè báo cũ, chỉ MỘT toast; người nghe được gọi", () => {
    const nghe = vi.fn();
    const thoi = theoDoiToast(nghe);
    baoToast("Đã lưu.");
    const id2 = baoToast("Đã xoá.", { loai: "xau" });
    expect(docToast()).toMatchObject({ id: id2, text: "Đã xoá.", loai: "xau" });
    expect(nghe).toHaveBeenCalledTimes(2);
    thoi();
  });

  it("tự tắt sau TOAST_MS; báo mới nạp lại đồng hồ", () => {
    baoToast("A");
    vi.advanceTimersByTime(TOAST_MS - 1);
    expect(docToast()?.text).toBe("A");
    baoToast("B");
    vi.advanceTimersByTime(TOAST_MS - 1);
    expect(docToast()?.text).toBe("B"); // đồng hồ của A không tắt nhầm B
    vi.advanceTimersByTime(1);
    expect(docToast()).toBeNull();
  });

  it("tắt theo id: id đã bị đè thì bỏ qua", () => {
    const a = baoToast("A");
    baoToast("B");
    tatToast(a);
    expect(docToast()?.text).toBe("B");
    tatToast();
    expect(docToast()).toBeNull();
  });

  it("nút phụ 'Hoàn tác' ≤2 chữ: bấm = chạy việc + tắt ngay", () => {
    const hoan = vi.fn();
    baoToast("Đã xoá.", { hanhDong: { nhan: NHAN.hoanTac, onClick: hoan } });
    const t = docToast()!;
    expect(nhanHopLe(t.hanhDong!.nhan)).toBe(true);
    bamHanhDong(t);
    expect(hoan).toHaveBeenCalledTimes(1);
    expect(docToast()).toBeNull();
  });
});
