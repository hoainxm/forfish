// @vitest-environment jsdom
//
// CHÂN HUỶ|LƯU DO SHEET VẼ + useDongSheet (lô 2 rà FB 2026-10-25, TAU-07/TAU-10): có `chan` ⇒ cặp nút theo nhãn
// NHAN, Lưu gọi onLuu, Huỷ khi ĐÃ GÕ hỏi "Bỏ phần đang ghi?" (không đóng thẳng), `xoa` là hàng đỏ riêng; không `chan`
// ⇒ không vẽ gì thêm (21 ngăn cũ nguyên vẹn).
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { BottomSheet, useDongSheet } from "@/components/ui/bottom-sheet";
import { NHAN } from "@/lib/labels";
import { CHO_POPSTATE_MS } from "@/lib/dialog-focus";

afterEach(() => cleanup());

/** Huỷ đi qua `dongTay`: lùi lịch sử rồi chờ popstate (jsdom không bắn) ⇒ sau CHO_POPSTATE_MS mới hỏi. */
const choDong = () => act(() => new Promise<void>((r) => setTimeout(r, CHO_POPSTATE_MS + 100)));

function NutHuyTuChe() {
  const dong = useDongSheet();
  return createElement("button", { type: "button", onClick: dong }, "Thôi");
}

describe("BottomSheet chan", () => {
  it("vẽ Huỷ|Lưu theo nhãn chuẩn, Lưu gọi onLuu, dangLuu khoá nút, xoa là hàng riêng", async () => {
    const onLuu = vi.fn();
    const onXoa = vi.fn();
    render(
      createElement(
        BottomSheet,
        { title: "Sửa đồ", onClose: () => {}, kieu: "form", chan: { luu: NHAN.luu, onLuu, xoa: { nhan: NHAN.xoa, onXoa } } } as unknown as Parameters<typeof BottomSheet>[0],
        createElement("input", { "aria-label": "Tên" }),
      ),
    );
    await act(async () => {});
    fireEvent.click(screen.getByRole("button", { name: NHAN.luu }));
    expect(onLuu).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: NHAN.xoa }));
    expect(onXoa).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: NHAN.huy })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Đóng Sửa đồ" })).toBeNull(); // form không có ×
  });

  it("Huỷ sau khi đã gõ ⇒ hỏi 'Bỏ phần đang ghi?', chưa gọi onClose", async () => {
    const onClose = vi.fn();
    render(
      createElement(
        BottomSheet,
        { title: "Sửa đồ", onClose, kieu: "form", chan: { luu: NHAN.luu, onLuu: () => {} } } as unknown as Parameters<typeof BottomSheet>[0],
        createElement("input", { "aria-label": "Tên" }),
      ),
    );
    await act(async () => {});
    fireEvent.input(screen.getByLabelText("Tên"));
    fireEvent.click(screen.getByRole("button", { name: NHAN.huy }));
    await choDong();
    expect(screen.getByText("Bỏ phần đang ghi?")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("useDongSheet: nút tự chế trong ngăn đi cùng đường (đã gõ ⇒ hỏi); ngoài ngăn là hàm rỗng", async () => {
    const onClose = vi.fn();
    render(
      createElement(
        BottomSheet,
        { title: "Ghi chú", onClose, kieu: "form" } as unknown as Parameters<typeof BottomSheet>[0],
        createElement("input", { "aria-label": "Chữ" }),
        createElement(NutHuyTuChe),
      ),
    );
    await act(async () => {});
    expect(screen.queryByRole("button", { name: NHAN.luu })).toBeNull(); // không chan ⇒ không chân
    fireEvent.input(screen.getByLabelText("Chữ"));
    fireEvent.click(screen.getByRole("button", { name: "Thôi" }));
    await choDong();
    expect(screen.getByText("Bỏ phần đang ghi?")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    cleanup();
    render(createElement(NutHuyTuChe));
    expect(() => fireEvent.click(screen.getByRole("button", { name: "Thôi" }))).not.toThrow();
  });
});
