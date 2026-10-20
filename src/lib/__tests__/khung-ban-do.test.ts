// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { DongHoTocDo, NutViTri } from "@/components/ban-do/khung";

afterEach(() => cleanup());

describe("khung bản đồ — đồng hồ tốc độ (kiểu trong suốt) + nút về tàu", () => {
  it("đồng hồ: số + đơn vị, không ô nền (chỉ chữ có quầng sáng)", () => {
    render(createElement(DongHoTocDo, { kmh: 18.52, unit: "nm", stale: false }));
    const el = screen.getByRole("status");
    expect(el.getAttribute("aria-label")).toBe("Tốc độ tàu 10 hải lý/giờ");
    expect(el.className).not.toMatch(/\bbg-card\b|\bborder-4\b|rounded-full/);
    expect(el.textContent).toContain("10");
  });
  it("GPS cũ: đơn vị đổi thành chữ 'GPS cũ' (không chỉ báo bằng màu)", () => {
    render(createElement(DongHoTocDo, { kmh: 5, unit: "km", stale: true }));
    expect(screen.getByRole("status").textContent).toContain("GPS cũ");
  });
  it("nút về tàu: chỉ icon, tên đọc đầy đủ", () => {
    render(createElement(NutViTri, { onClick: () => {} }));
    const b = screen.getByRole("button", { name: "Về chỗ tàu đang đứng" });
    expect(b.textContent).toBe("");
  });
});
