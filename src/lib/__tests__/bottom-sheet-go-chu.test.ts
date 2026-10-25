// @vitest-environment jsdom
//
// GÕ TRONG KHUNG FORM KHÔNG MẤT CON TRỎ (2026-10-24, khung soạn Kairos "gõ từng chữ một"): bên gọi truyền onClose MỚI
// mỗi lần vẽ (hàm không useCallback) + giữ chữ trong state cha ⇒ mỗi phím cha vẽ lại. BottomSheet không được chạy lại
// hiệu ứng mở (khoá cuộn + đặt con trỏ vào ô đầu) mỗi phím.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement, useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { BottomSheet } from "@/components/ui/bottom-sheet";

afterEach(() => cleanup());

function Khung({ onClose }: { onClose: () => void }) {
  const [chu, setChu] = useState("");
  // onClose là hàm MỚI mỗi lần vẽ — đúng như khung soạn Kairos. Props ép kiểu vì `children` là tham số thứ 3.
  const props = { title: "Soạn bài", onClose: () => onClose(), kieu: "form" } as Parameters<typeof BottomSheet>[0];
  return createElement(
    BottomSheet,
    props,
    createElement("button", { type: "button" }, "Ảnh"),
    createElement("textarea", { "aria-label": "Nội dung", value: chu, onChange: (e: { target: { value: string } }) => setChu(e.target.value) }),
  );
}

describe("BottomSheet — gõ chữ liên tục", () => {
  it("con trỏ ở lại ô đang gõ qua nhiều phím; Escape vẫn gọi onClose mới nhất", async () => {
    vi.useFakeTimers();
    const dong = vi.fn();
    render(createElement(Khung, { onClose: dong }));
    await act(async () => {});
    const o = screen.getByLabelText("Nội dung") as HTMLTextAreaElement;
    o.focus();
    for (const c of ["B", "Bà", "Bà ", "Bà c", "Bà co", "Bà con"]) {
      fireEvent.change(o, { target: { value: c } });
      expect(document.activeElement).toBe(o);
    }
    expect(o.value).toBe("Bà con");
    // đóng nhẹ khi đã gõ ⇒ hỏi trước, không đóng ngay (giữ hành vi cũ)
    fireEvent.input(o);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(dong).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
