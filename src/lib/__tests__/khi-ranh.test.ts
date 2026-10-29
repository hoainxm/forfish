import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sauKhiTaiVaRanh } from "@/lib/khi-ranh";

/* Đăng ký SW sau `load` + lúc rảnh (sw-register.tsx) — thứ tự, đường lùi, trần, huỷ. */

function winGia(readyState: string, idle: boolean) {
  const nghe = new Map<string, () => void>();
  const idleCbs: (() => void)[] = [];
  const w = {
    document: { readyState },
    addEventListener: vi.fn((t: string, cb: () => void) => void nghe.set(t, cb)),
    removeEventListener: vi.fn((t: string) => void nghe.delete(t)),
    requestIdleCallback: idle
      ? vi.fn((cb: () => void) => {
          idleCbs.push(cb);
          return idleCbs.length;
        })
      : undefined,
    cancelIdleCallback: vi.fn(),
  };
  return { w, phatLoad: () => nghe.get("load")?.(), ranh: () => idleCbs.shift()?.() };
}

describe("sauKhiTaiVaRanh", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("chưa load: KHÔNG chạy; load rồi vẫn chờ lúc rảnh; rảnh mới chạy, đúng một lần", () => {
    const g = winGia("interactive", true);
    const fn = vi.fn();
    sauKhiTaiVaRanh(fn, { win: g.w });
    vi.advanceTimersByTime(10_000);
    expect(fn).not.toHaveBeenCalled();
    g.phatLoad();
    expect(fn).not.toHaveBeenCalled();
    expect(g.w.requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), { timeout: 5000 });
    g.ranh();
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000); // trần không chạy lần hai
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("trang đã load xong (mở lại / chuyển màn): chờ rảnh luôn, không đợi sự kiện load", () => {
    const g = winGia("complete", true);
    const fn = vi.fn();
    sauKhiTaiVaRanh(fn, { win: g.w });
    expect(g.w.addEventListener).not.toHaveBeenCalled();
    g.ranh();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("không có requestIdleCallback (Safari): lùi bằng setTimeout sau load", () => {
    const g = winGia("complete", false);
    const fn = vi.fn();
    sauKhiTaiVaRanh(fn, { win: g.w, luiMs: 1000 });
    vi.advanceTimersByTime(999);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("load không bao giờ tới (ảnh treo trên sóng yếu): quá trần vẫn chạy — vỏ offline không bị bỏ cả phiên", () => {
    const g = winGia("loading", true);
    const fn = vi.fn();
    sauKhiTaiVaRanh(fn, { win: g.w, capMs: 20_000 });
    vi.advanceTimersByTime(19_999);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    g.phatLoad();
    g.ranh();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("huỷ trước khi chạy: không chạy nữa, gỡ nghe load", () => {
    const g = winGia("loading", true);
    const fn = vi.fn();
    const huy = sauKhiTaiVaRanh(fn, { win: g.w });
    huy();
    expect(g.w.removeEventListener).toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    g.phatLoad();
    expect(fn).not.toHaveBeenCalled();
  });

  it("fn ném: nuốt, không làm hỏng trang", () => {
    const g = winGia("complete", false);
    sauKhiTaiVaRanh(
      () => {
        throw new Error("x");
      },
      { win: g.w },
    );
    expect(() => vi.advanceTimersByTime(2000)).not.toThrow();
  });

  it("không có window (prerender): no-op", () => {
    expect(() => sauKhiTaiVaRanh(() => {})()).not.toThrow();
  });
});
