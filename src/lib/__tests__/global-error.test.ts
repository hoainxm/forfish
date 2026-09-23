// @vitest-environment jsdom
//
// REGRESSION cho MÀN TRẮNG CÂM Ở TẦNG GỐC (soát 2026-09-06 — iPhone 12 iOS cũ).
//
// VÌ SAO PHẢI CÓ: repo có `error.tsx` nhưng thiếu `global-error.tsx`, nên lỗi
// crash ở root-layout tree (AppShell/SwRegister/UsageHeartbeat/… trên Safari đời
// cũ) rơi vào MÀN TRẮNG mặc định của Next — bà con thoát ra vào lại vẫn trắng.
// Test này chốt: khi boundary gốc nhận lỗi, nó PHẢI hiện chữ đọc được (không
// trắng) + nút "Mở lại" thật sự gọi reset() để dựng lại cây React không cần sóng.
// Nếu ai xoá/hỏng global-error.tsx, test này đỏ.

import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import GlobalError from "@/app/global-error";

afterEach(() => cleanup());

describe("global-error (lưới an toàn tầng gốc)", () => {
  it("KHÔNG trắng: hiện thông báo tiếng Việt đọc được thay vì màn trống", () => {
    render(
      createElement(GlobalError, {
        error: Object.assign(new Error("boom"), { digest: "abc" }),
        reset: () => {},
      }),
    );
    // Có tiêu đề + trấn an dữ liệu còn nguyên → không phải màn trắng câm.
    expect(screen.getByText("App đang trục trặc")).toBeTruthy();
    expect(
      screen.getByText(/Dữ liệu bà con đã lưu trong máy vẫn còn nguyên/),
    ).toBeTruthy();
  });

  it('nút "Mở lại" gọi reset() (dựng lại cây React, không tải lại trang)', () => {
    const reset = vi.fn();
    render(
      createElement(GlobalError, {
        error: new Error("boom"),
        reset,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Mở lại" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("gợi ý cập nhật iOS/trình duyệt khi mở lại vẫn trắng (cách đã cứu iPhone 12)", () => {
    render(
      createElement(GlobalError, {
        error: new Error("boom"),
        reset: () => {},
      }),
    );
    expect(screen.getByText(/cập nhật iOS/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tải lại trang" })).toBeTruthy();
  });
});
