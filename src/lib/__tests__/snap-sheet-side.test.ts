// @vitest-environment jsdom
//
// HÀNH VI NGĂN GIÓ SÓNG BÊN PHẢI (SnapSheet `side`) — rà Codex lần 7: test cũ chỉ
// giữ logic dữ liệu (sea-cells, sheet-hold); đây chốt luồng người dùng thật:
// viên mở được bằng click/bàn phím, mở thì focus vào ngăn, "Thu" trả focus về
// viên, nút "Giữ mở" báo đúng trạng thái và gọi lại cha.

import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement, useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { SnapSheet } from "@/components/ui/snap-sheet";

afterEach(() => cleanup());

type Size = "hidden" | "peek" | "half";

function Harness({ onHold }: { onHold?: (v: boolean) => void }) {
  const [size, setSize] = useState<Size>("peek");
  const [held, setHeld] = useState(false);
  return createElement(
    SnapSheet,
    {
      size,
      onSizeChange: (s: Size) => setSize(s),
      label: "Gió sóng",
      side: true,
      sideTab: "Hôm nay · 0,6 m",
      sideTabLabel: "Ngày mai, sóng 0,6 mét, gió cấp 3, bản lưu",
      sideDense: createElement("p", null, "LƯỚI SỐ"),
      sideHold: held,
      onSideHoldChange: (v: boolean) => {
        setHeld(v);
        onHold?.(v);
      },
      peek: createElement("p", null, "peek"),
    } as never,
    createElement("p", null, "XEM ĐỦ"),
  );
}

const vien = () => screen.getByRole("button", { name: /Mở bảng gió sóng/ });

describe("ngăn gió sóng bên phải", () => {
  it("viên mở được bằng click (Enter/Space của bàn phím bắn click)", () => {
    render(createElement(Harness));
    expect(screen.queryByText("LƯỚI SỐ")).toBeNull();
    expect(vien().getAttribute("aria-expanded")).toBe("false");
    act(() => fireEvent.click(vien()));
    expect(screen.getByText("LƯỚI SỐ")).toBeTruthy();
  });

  it("mở thì focus vào ngăn; 'Thu' thì focus quay về viên", () => {
    render(createElement(Harness));
    act(() => fireEvent.click(vien()));
    const ngan = screen.getByText("LƯỚI SỐ").closest("[id$='-ngan']") as HTMLElement;
    expect(document.activeElement).toBe(ngan);
    const thu = screen.getByRole("button", { name: "Thu bảng sang phải" });
    act(() => {
      thu.focus();
      fireEvent.click(thu);
    });
    expect(document.activeElement).toBe(vien());
  });

  it("'Giữ mở' bật/tắt có aria-pressed và báo cha", () => {
    const onHold = vi.fn();
    render(createElement(Harness, { onHold }));
    act(() => fireEvent.click(vien()));
    const giu = screen.getByRole("button", { name: "Giữ mở" });
    expect(giu.getAttribute("aria-pressed")).toBe("false");
    act(() => fireEvent.click(giu));
    expect(onHold).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole("button", { name: "Giữ mở" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("'Xem đủ' nối phần giải thích DƯỚI lưới số, không thay lưới", () => {
    render(createElement(Harness));
    act(() => fireEvent.click(vien()));
    act(() => fireEvent.click(screen.getByRole("button", { name: /Xem đủ/ })));
    expect(screen.getByText("LƯỚI SỐ")).toBeTruthy();
    expect(screen.getByText("XEM ĐỦ")).toBeTruthy();
  });

  it("viên đọc được bằng trình đọc màn hình: tên nút nói đủ ngày · số · bản lưu", () => {
    render(createElement(Harness));
    expect(vien().getAttribute("aria-label")).toBe("Mở bảng gió sóng — Ngày mai, sóng 0,6 mét, gió cấp 3, bản lưu");
  });
});
