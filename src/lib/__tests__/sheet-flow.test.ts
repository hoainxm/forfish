// @vitest-environment jsdom
//
// LUỒNG NGĂN GIÓ SÓNG TRỌN VẸN (rà Codex lần 8–9): SnapSheet `side` + ĐÚNG hai hook
// `useSheetAutoHide` / `useSheetAutoHideSync` mà fishing-map-view gọi (đồng hồ 3 s,
// nạp lại khi chạm trong sheet, ép ẩn của lớp nổi, ghim, ranh giới, đang tải),
// chạy với đồng hồ giả. Không chép luật ở đây — sửa hook là test thấy ngay.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { SnapSheet } from "@/components/ui/snap-sheet";
import { SHEET_AUTO_HIDE_MS, useSheetAutoHide, useSheetAutoHideSync } from "@/lib/use-sheet-auto-hide";

const HIDE_MS = SHEET_AUTO_HIDE_MS;
type Size = "hidden" | "peek" | "half";

function Cha({ border = false, start = "peek" as Size }: { border?: boolean; start?: Size }) {
  const [size, setSize] = useState<Size>(start);
  // ĐÚNG hai hook màn bản đồ dùng — không chép lại luật
  const ctl = useSheetAutoHide(size, setSize);
  useSheetAutoHideSync(ctl, setSize, { size, border, loading: false, resetKey: "p" });
  const { held, setHeld } = ctl;
  const epAn = () => void ctl.forceHide();
  return createElement(
    "div",
    null,
    createElement("button", { type: "button", onClick: epAn }, "Lớp"),
    createElement(
      SnapSheet,
      {
        size,
        onSizeChange: setSize,
        label: "Gió sóng",
        side: true,
        sideTab: "Hôm nay",
        sideDense: createElement("p", null, border ? "RẤT GẦN RANH GIỚI" : "LƯỚI SỐ"),
        sideHold: held,
        onSideHoldChange: setHeld,
        onInteract: ctl.arm,
        peek: createElement("p", null, "peek"),
      } as never,
      createElement("p", null, "XEM ĐỦ"),
    ),
  );
}

const ngan = () => document.querySelector("[id$='-ngan']");
const vien = () => screen.getByRole("button", { name: /Mở bảng gió sóng/ });
const moNgan = () => act(() => fireEvent.click(vien()));
const troi = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("luồng ngăn gió sóng", () => {
  it("sát ranh giới: đang là viên (peek) thì TỰ MỞ, cảnh báo hiện ngay", () => {
    render(createElement(Cha, { border: true }));
    expect(ngan()).not.toBeNull();
    expect(screen.getByText("RẤT GẦN RANH GIỚI")).toBeTruthy();
  });

  it("sát ranh giới: đồng hồ không thu, lớp nổi khác cũng không ép ẩn được", () => {
    render(createElement(Cha, { border: true }));
    troi(HIDE_MS * 3);
    expect(ngan()).not.toBeNull();
    act(() => fireEvent.click(screen.getByRole("button", { name: "Lớp" })));
    expect(ngan()).not.toBeNull();
  });

  it("bình thường: mở ngăn rồi buông tay 3 giây là tự thu", () => {
    render(createElement(Cha));
    moNgan();
    troi(HIDE_MS - 100);
    expect(ngan()).not.toBeNull();
    troi(200);
    expect(ngan()).toBeNull();
  });

  it("ghim: qua 3 giây vẫn mở; tắt ghim thì đồng hồ chạy lại", () => {
    render(createElement(Cha));
    moNgan();
    act(() => fireEvent.click(screen.getByRole("button", { name: "Giữ mở" })));
    troi(HIDE_MS * 3);
    expect(ngan()).not.toBeNull();
    act(() => fireEvent.click(screen.getByRole("button", { name: "Giữ mở" })));
    troi(HIDE_MS + 100);
    expect(ngan()).toBeNull();
  });

  it("ghim → lớp nổi khác ép ẩn → mở lại: KHÔNG còn ghim, về luật 3 giây", () => {
    render(createElement(Cha));
    moNgan();
    act(() => fireEvent.click(screen.getByRole("button", { name: "Giữ mở" })));
    act(() => fireEvent.click(screen.getByRole("button", { name: "Lớp" })));
    expect(ngan()).toBeNull();
    moNgan();
    expect(screen.getByRole("button", { name: "Giữ mở" }).getAttribute("aria-pressed")).toBe("false");
    troi(HIDE_MS + 100);
    expect(ngan()).toBeNull();
  });

  it("viên là <button> gốc — Enter/Space của bàn phím kích hoạt được (trình duyệt tự bắn click)", () => {
    render(createElement(Cha));
    const b = vien();
    expect(b.tagName).toBe("BUTTON");
    expect(b.getAttribute("tabindex")).not.toBe("-1");
    expect(b.getAttribute("aria-controls")).toBeTruthy();
  });

  it("chạm/cuộn trong ngăn (onInteract) nạp lại đồng hồ — đang đọc thì không bị thu", () => {
    render(createElement(Cha));
    moNgan();
    troi(HIDE_MS - 500);
    act(() => fireEvent.pointerDown(screen.getByText("LƯỚI SỐ")));
    troi(HIDE_MS - 500);
    expect(ngan()).not.toBeNull();
    troi(600);
    expect(ngan()).toBeNull();
  });

  it("đang tải số: chưa đếm giờ; tải xong mới đếm 3 giây", () => {
    function ChaTai({ loading }: { loading: boolean }) {
      const [size, setSize] = useState<Size>("half");
      const ctl = useSheetAutoHide(size, setSize);
      useSheetAutoHideSync(ctl, setSize, { size, border: false, loading, resetKey: "p" });
      return createElement(SnapSheet, {
        size,
        onSizeChange: setSize,
        label: "Gió sóng",
        side: true,
        sideDense: createElement("p", null, "LƯỚI SỐ"),
        onInteract: ctl.arm,
        peek: createElement("p", null, "peek"),
      } as never, null);
    }
    const { rerender } = render(createElement(ChaTai, { loading: true }));
    troi(HIDE_MS * 3);
    expect(ngan()).not.toBeNull();
    // chạm/cuộn trong ngăn lúc ĐANG TẢI không được lên lịch thu (lỗi rà Codex lần 10)
    act(() => fireEvent.pointerDown(screen.getByText("LƯỚI SỐ")));
    act(() => fireEvent.scroll(screen.getByText("LƯỚI SỐ")));
    troi(HIDE_MS * 3);
    expect(ngan()).not.toBeNull();
    rerender(createElement(ChaTai, { loading: false }));
    troi(HIDE_MS + 100);
    expect(ngan()).toBeNull();
  });

  it("đang ẩn (người dùng Thu) rồi điểm trở thành sát ranh giới: tôn trọng, không ép mở", () => {
    function ChaThu({ border }: { border: boolean }) {
      const [size, setSize] = useState<Size>("hidden");
      const ctl = useSheetAutoHide(size, setSize);
      useSheetAutoHideSync(ctl, setSize, { size, border, loading: false, resetKey: border ? "b" : "a" });
      return createElement(SnapSheet, {
        size,
        onSizeChange: setSize,
        label: "Gió sóng",
        side: true,
        sideDense: createElement("p", null, "LƯỚI SỐ"),
        peek: createElement("p", null, "peek"),
      } as never, null);
    }
    const { rerender } = render(createElement(ChaThu, { border: false }));
    rerender(createElement(ChaThu, { border: true }));
    expect(ngan()).toBeNull();
  });

  it("đổi điểm giữa lúc đang đếm: đếm lại 3 giây từ điểm mới", () => {
    function ChaDiem({ k }: { k: string }) {
      const [size, setSize] = useState<Size>("half");
      const ctl = useSheetAutoHide(size, setSize);
      useSheetAutoHideSync(ctl, setSize, { size, border: false, loading: false, resetKey: k });
      return createElement(SnapSheet, {
        size,
        onSizeChange: setSize,
        label: "Gió sóng",
        side: true,
        sideDense: createElement("p", null, "LƯỚI SỐ"),
        peek: createElement("p", null, "peek"),
      } as never, null);
    }
    const { rerender } = render(createElement(ChaDiem, { k: "a" }));
    troi(HIDE_MS - 500);
    rerender(createElement(ChaDiem, { k: "b" }));
    troi(HIDE_MS - 500);
    expect(ngan()).not.toBeNull();
    troi(600);
    expect(ngan()).toBeNull();
  });
});
