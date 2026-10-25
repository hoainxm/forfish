// @vitest-environment jsdom
//
// BACK CỦA MÁY ĐÓNG LỚP NỔI TRƯỚC KHI RỜI TRANG (rà FB 2026-10-25): phần thuần quyết định đẩy/đóng theo
// state lịch sử + hook nối với window.history (mục có dấu, popstate đóng, đóng tay lùi mục, lớp chồng).

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

import { CHO_POPSTATE_MS, DAU_LOP, laMucCuaLop, mucLop, popLaDong, useLichSuDong } from "@/lib/dialog-focus";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("phần thuần — mục lịch sử của lớp", () => {
  it("mucLop giữ nguyên state Next đang có (__NA, cây route) và chỉ thêm dấu", () => {
    const next = { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: ["", {}] };
    expect(mucLop(next, "a")).toEqual({ ...next, [DAU_LOP]: "a" });
    expect(mucLop(null, "a")).toEqual({ [DAU_LOP]: "a" });
    expect(mucLop("rác", "a")).toEqual({ [DAU_LOP]: "a" });
  });
  it("laMucCuaLop: đúng id mới là của mình", () => {
    expect(laMucCuaLop({ [DAU_LOP]: "a" }, "a")).toBe(true);
    expect(laMucCuaLop({ [DAU_LOP]: "b" }, "a")).toBe(false);
    expect(laMucCuaLop(null, "a")).toBe(false);
    expect(laMucCuaLop({}, "a")).toBe(false);
  });
  it("popstate: còn đứng ở mục của mình (lớp trên vừa đóng) thì KHÔNG đóng; rời mục thì đóng", () => {
    expect(popLaDong({ [DAU_LOP]: "sheet" }, "sheet")).toBe(false);
    expect(popLaDong({ __NA: true }, "sheet")).toBe(true);
    expect(popLaDong({ [DAU_LOP]: "hop" }, "sheet")).toBe(true);
  });
});

/** popstate của jsdom về bất đồng bộ — đợi tới khi state đổi */
async function doiPop(truoc: unknown) {
  for (let i = 0; i < 50 && window.history.state === truoc; i++) await new Promise((r) => setTimeout(r, 5));
}

describe("useLichSuDong — hook nối window.history", () => {
  it("mở ⇒ đẩy MỘT mục có dấu; back ⇒ gọi đóng; gỡ sau khi back ⇒ không lùi thêm", async () => {
    const len0 = window.history.length;
    const dong = vi.fn();
    const h = renderHook(() => useLichSuDong(dong));
    expect(window.history.length).toBe(len0 + 1);
    expect(typeof (window.history.state as Record<string, unknown>)[DAU_LOP]).toBe("string");
    h.rerender(); // vẽ lại không đẩy thêm
    expect(window.history.length).toBe(len0 + 1);

    const truoc = window.history.state;
    await act(async () => {
      window.history.back();
      await doiPop(truoc);
    });
    expect(dong).toHaveBeenCalledTimes(1);
    h.unmount();
    await act(() => new Promise((r) => setTimeout(r, 10)));
    expect(window.history.state?.[DAU_LOP]).toBeUndefined();
  });

  it("đóng tay khi mục còn ⇒ lùi lịch sử, popstate mới gọi đóng (một lần)", async () => {
    const dong = vi.fn();
    const h = renderHook(() => useLichSuDong(dong));
    const truoc = window.history.state;
    await act(async () => {
      h.result.current.dongTay();
      expect(dong).not.toHaveBeenCalled();
      await doiPop(truoc);
    });
    expect(dong).toHaveBeenCalledTimes(1);
    await act(() => new Promise((r) => setTimeout(r, CHO_POPSTATE_MS + 50)));
    expect(dong).toHaveBeenCalledTimes(1); // đồng hồ dự phòng đã bị huỷ
    h.unmount();
  });

  it("đóng tay khi mục KHÔNG còn của mình ⇒ đóng ngay, không lùi", () => {
    const dong = vi.fn();
    const h = renderHook(() => useLichSuDong(dong));
    window.history.replaceState({ __NA: true }, ""); // Next đã đè mục (router.push)
    const len = window.history.length;
    act(() => h.result.current.dongTay());
    expect(dong).toHaveBeenCalledTimes(1);
    expect(window.history.length).toBe(len);
    h.unmount();
  });

  it("hai lớp chồng: back đóng lớp TRÊN, lớp dưới đứng yên; back nữa mới đóng lớp dưới", async () => {
    const dongA = vi.fn();
    const dongB = vi.fn();
    const a = renderHook(() => useLichSuDong(dongA));
    const b = renderHook(() => useLichSuDong(dongB));
    let truoc = window.history.state;
    await act(async () => {
      window.history.back();
      await doiPop(truoc);
    });
    expect(dongB).toHaveBeenCalledTimes(1);
    expect(dongA).not.toHaveBeenCalled();
    b.unmount();
    await act(() => new Promise((r) => setTimeout(r, 10)));
    truoc = window.history.state;
    await act(async () => {
      window.history.back();
      await doiPop(truoc);
    });
    expect(dongA).toHaveBeenCalledTimes(1);
    a.unmount();
  });

  it("bên gọi gỡ lớp thẳng (nút Lưu) ⇒ dọn mục còn thừa; giuLai đẩy lại mục sau khi back ăn mất", async () => {
    const dong = vi.fn();
    const h = renderHook(() => useLichSuDong(dong));
    const truoc = window.history.state;
    await act(async () => {
      window.history.back();
      await doiPop(truoc);
    });
    expect(laMucCuaLop(window.history.state, "x")).toBe(false);
    act(() => h.result.current.giuLai());
    expect(typeof (window.history.state as Record<string, unknown>)[DAU_LOP]).toBe("string");
    const truoc2 = window.history.state;
    h.unmount(); // gỡ thẳng khi mục còn
    await act(async () => {
      await doiPop(truoc2);
    });
    expect(window.history.state?.[DAU_LOP]).toBeUndefined();
  });

  it("bat=false ⇒ không đẩy mục, không bắt popstate", () => {
    const len0 = window.history.length;
    const dong = vi.fn();
    const h = renderHook(() => useLichSuDong(dong, false));
    expect(window.history.length).toBe(len0);
    h.unmount();
  });
});
