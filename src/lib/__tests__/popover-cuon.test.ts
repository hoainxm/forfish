// @vitest-environment jsdom
//
// Popover KHÔNG được tự kéo danh sách về đầu khi bà con đang cuộn (2026-10-27, "Ngư trường → Mọi loài không cuộn
// xuống được"). Thủ phạm cũ: nghe `scroll` pha capture ⇒ bắt cả cuộn của CHÍNH lớp nổi ⇒ đo lại ⇒ gỡ maxHeight để đo
// ⇒ khung hết tràn ⇒ trình duyệt kẹp scrollTop về 0 (bản sửa base eabd7197: bỏ qua cuộn của chính lớp nổi + trả lại
// scrollTop sau khi đo). Popover dùng chung 12 chỗ (chợ, tài khoản, lọc tỉnh, chọn tàu,
// hộp thư, bình luận Kairos, thanh toán, tìm điểm…) nên test gác ở primitive.

import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement, type ComponentProps } from "react";
import { act, cleanup, render } from "@testing-library/react";

import { Popover } from "@/components/ui/popover";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function moPopover() {
  const nut = document.createElement("button");
  document.body.appendChild(nut);
  const doNut = vi.spyOn(nut, "getBoundingClientRect").mockReturnValue({ left: 300, top: 10, right: 344, bottom: 54, width: 44, height: 44, x: 300, y: 10, toJSON: () => ({}) } as DOMRect);
  const props = { anchor: nut, onClose: () => {}, label: "Ngư trường — Phân bố cá" } as unknown as ComponentProps<typeof Popover>; // children truyền ở tham số thứ ba (luật react/no-children-prop)
  render(createElement(Popover, props, createElement("div", null, "danh sách loài")));
  const lop = document.querySelector('[role="dialog"]') as HTMLElement;
  return { nut, doNut, lop };
}

describe("Popover — cuộn bên trong không bị kéo về đầu", () => {
  it("cuộn của CHÍNH lớp nổi không đo lại; cuộn trang thì đo lại cho bám nút", () => {
    const { doNut, lop } = moPopover();
    const truoc = doNut.mock.calls.length;
    act(() => {
      lop.dispatchEvent(new Event("scroll")); // scroll không nổi bọt — window chỉ bắt được ở pha capture
    });
    expect(doNut.mock.calls.length).toBe(truoc);
    act(() => {
      document.dispatchEvent(new Event("scroll"));
    });
    expect(doNut.mock.calls.length).toBe(truoc + 1);
  });

  it("đo lại (đổi cỡ / cuộn trang) GIỮ nguyên vị trí cuộn bên trong", () => {
    const { lop } = moPopover();
    // giả lập trình duyệt: gỡ maxHeight ⇒ khung hết tràn ⇒ scrollTop bị kẹp về 0 (jsdom không tự làm việc này)
    let cuon = 0;
    Object.defineProperty(lop, "scrollTop", { configurable: true, get: () => cuon, set: (v: number) => { cuon = v; } });
    const goc = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, "maxHeight");
    const style = lop.style;
    Object.defineProperty(style, "maxHeight", {
      configurable: true,
      get: () => goc?.get?.call(style) ?? "",
      set: (v: string) => {
        if (v === "") cuon = 0;
        goc?.set?.call(style, v);
      },
    });
    cuon = 240; // bà con đã vuốt xuống giữa danh sách
    act(() => {
      window.dispatchEvent(new Event("resize"));
      document.dispatchEvent(new Event("scroll"));
    });
    expect(cuon).toBe(240);
  });
});
