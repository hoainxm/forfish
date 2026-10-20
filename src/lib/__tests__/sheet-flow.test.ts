// @vitest-environment jsdom
//
// LUỒNG NGĂN GIÓ SÓNG TRỌN VẸN (rà Codex lần 8): SnapSheet `side` + CHÍNH các hàm
// luật của lib/sheet-hold mà fishing-map-view dùng (đồng hồ 3 s, ép ẩn của lớp
// nổi, ghim, ranh giới), chạy với đồng hồ giả. Khung `Cha` dưới đây chép đúng
// cách map view nối các hàm đó — đổi luật ở một bên mà quên bên kia là test đỏ.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, useEffect, useRef, useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { SnapSheet } from "@/components/ui/snap-sheet";
import { canAutoHide, canForceHide, heldAfterSize, mustOpenForBorder } from "@/lib/sheet-hold";

const HIDE_MS = 3000;
type Size = "hidden" | "peek" | "half";

function Cha({ border = false, start = "peek" as Size }: { border?: boolean; start?: Size }) {
  const [size, setSize] = useState<Size>(start);
  const [heldRaw, setHeld] = useState(false);
  const held = heldAfterSize(heldRaw, size);
  if (heldRaw && !held) setHeld(false);
  if (mustOpenForBorder({ border, held: false }, size)) setSize("half");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (size === "hidden" || !canAutoHide({ border, held })) return;
    timer.current = setTimeout(() => setSize("hidden"), HIDE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [size, border, held]);
  const epAn = () => {
    if (canForceHide({ border, held: false })) setSize("hidden");
  };
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
});
