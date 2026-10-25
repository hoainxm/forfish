// @vitest-environment jsdom
//
// "… Xem thêm" kiểu Facebook (anh Long 2026-10-24): chỉ hiện khi chữ TRÀN THẬT (đo, không đoán theo số ký tự);
// chạm là mở hết tại chỗ; chữ ngắn không có nút.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { biCat, ChuXemThem } from "@/components/kairos/chu-xem-them";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function doCao(scroll: number, client: number) {
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(scroll);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(client);
}

describe("biCat", () => {
  it("cao thật hơn cao đang hiện quá 1 điểm ảnh mới tính là cắt", () => {
    expect(biCat(120, 72)).toBe(true);
    expect(biCat(72, 72)).toBe(false);
    expect(biCat(73, 72)).toBe(false);
  });
});

describe("ChuXemThem", () => {
  it("chữ tràn ⇒ có '… Xem thêm'; chạm ⇒ bỏ cắt dòng, nút biến mất", () => {
    doCao(200, 72);
    const { container } = render(createElement(ChuXemThem, { text: "Bão ở xa Biển Đông mình, nhưng theo kinh nghiệm …".repeat(5), dong: 3 }));
    const nut = screen.getByRole("button", { name: /Xem thêm/ });
    expect(container.querySelector("p")?.className).toContain("line-clamp-3");
    fireEvent.click(nut);
    expect(screen.queryByRole("button", { name: /Xem thêm/ })).toBeNull();
    expect(container.querySelector("p")?.className).not.toContain("line-clamp");
  });
  it("chữ không tràn ⇒ không có nút; chữ rỗng ⇒ không vẽ gì", () => {
    doCao(48, 72);
    render(createElement(ChuXemThem, { text: "chuẩn r ae", dong: 3 }));
    expect(screen.queryByRole("button")).toBeNull();
    cleanup();
    const { container } = render(createElement(ChuXemThem, { text: "", dong: 3 }));
    expect(container.innerHTML).toBe("");
  });
  it("bấm Xem thêm không lan ra thẻ bài (thẻ bấm được mở chi tiết)", () => {
    doCao(200, 72);
    const moThe = vi.fn();
    render(createElement("div", { onClick: moThe }, createElement(ChuXemThem, { text: "dài ".repeat(200), dong: 3 })));
    fireEvent.click(screen.getByRole("button", { name: /Xem thêm/ }));
    expect(moThe).not.toHaveBeenCalled();
  });
});
