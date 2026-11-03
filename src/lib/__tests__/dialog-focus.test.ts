// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { createElement } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { coDauLop, diTrang, laLinkRoiTrang, mucLop, useLichSuDong, vongFocus, vuotDeDong } from "@/lib/dialog-focus";

describe("vongFocus — Tab không chạy ra khỏi hộp thoại", () => {
  const a = { n: "a" }, b = { n: "b" }, c = { n: "c" };
  const items = [a, b, c];
  it("Tab ở phần tử cuối → về đầu; Shift+Tab ở đầu → về cuối", () => {
    expect(vongFocus(items, c, false)).toBe(a);
    expect(vongFocus(items, a, true)).toBe(c);
  });
  it("ở giữa → để trình duyệt tự đi (null)", () => {
    expect(vongFocus(items, b, false)).toBeNull();
    expect(vongFocus(items, b, true)).toBeNull();
  });
  it("focus đang ở NGOÀI hộp (trang dưới nền mờ) → kéo về trong hộp", () => {
    const ngoai = { n: "ngoai" };
    expect(vongFocus(items, ngoai, false)).toBe(a);
    expect(vongFocus(items, ngoai, true)).toBe(c);
  });
  it("hộp không có gì nhận focus → null", () => {
    expect(vongFocus([], a, false)).toBeNull();
  });
});

describe("vuotDeDong — vuốt xuống đóng ngăn đáy", () => {
  it("kéo chậm qua 80px → đóng; dưới 80px chậm → bật về", () => {
    expect(vuotDeDong(90, 2000)).toBe(true);
    expect(vuotDeDong(40, 2000)).toBe(false);
  });
  it("hất nhanh 30px trong 100ms (0,3 px/ms) → đóng", () => {
    expect(vuotDeDong(30, 100)).toBe(true);
  });
  it("kéo lên hoặc không nhúc nhích → không đóng", () => {
    expect(vuotDeDong(-120, 100)).toBe(false);
    expect(vuotDeDong(0, 0)).toBe(false);
  });
});

describe("diTrang — rời trang từ trong lớp nổi không bị kéo về (khay ⋯ → Chuyến biển, 2026-11-03)", () => {
  const goi = () => {
    const ghi: string[] = [];
    return { ghi, router: { push: (h: string) => ghi.push(`push ${h}`), replace: (h: string) => ghi.push(`replace ${h}`) } };
  };
  it("coDauLop: chỉ nhận state có dấu lớp", () => {
    expect(coDauLop(mucLop({ __NA: true }, ":r1:"))).toBe(true);
    expect(coDauLop({ __NA: true })).toBe(false);
    expect(coDauLop(null)).toBe(false);
  });
  it("đang đứng mục của lớp ⇒ THAY mục (replace), Back về đúng trang cũ", () => {
    window.history.replaceState(mucLop(window.history.state, ":r1:"), "");
    const { ghi, router } = goi();
    diTrang(router, "/lo-trinh");
    expect(ghi).toEqual(["replace /lo-trinh"]);
  });
  it("ngoài lớp ⇒ push như thường", () => {
    window.history.replaceState({}, "");
    const { ghi, router } = goi();
    diTrang(router, "/lo-trinh");
    expect(ghi).toEqual(["push /lo-trinh"]);
  });
});

describe("laLinkRoiTrang — <Link> trong lớp nổi (Cài đặt → Trang quản trị, 2026-11-03)", () => {
  const here = "https://sdfish.sdvico.vn/?tab=a#x";
  it("đổi đường dẫn hoặc query trong app ⇒ rời trang", () => {
    expect(laLinkRoiTrang("https://sdfish.sdvico.vn/quan-tri", here)).toBe(true);
    expect(laLinkRoiTrang("/doi-mat-khau", here)).toBe(true);
    expect(laLinkRoiTrang("/?tab=b", here)).toBe(true);
  });
  it("chỉ đổi #… / ra ngoài app / tab mới / tải về ⇒ KHÔNG tính", () => {
    expect(laLinkRoiTrang("/?tab=a#y", here)).toBe(false);
    expect(laLinkRoiTrang("https://zalo.me/123", here)).toBe(false);
    expect(laLinkRoiTrang("/quan-tri", here, "_blank")).toBe(false);
    expect(laLinkRoiTrang("/data/x.pdf", here, null, true)).toBe(false);
    expect(laLinkRoiTrang("/quan-tri", here, "_self")).toBe(true);
  });
});

describe("useLichSuDong — gỡ lớp sau cú bấm link KHÔNG lùi lịch sử (Next đang tải trang mới)", () => {
  function Lop() {
    useLichSuDong(() => {});
    return createElement("a", { href: "/quan-tri", onClick: (e: Event) => e.preventDefault() }, "Trang quản trị");
  }
  const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
  afterEach(() => {
    cleanup();
    back.mockClear();
    vi.useRealTimers();
  });
  it("bấm link rồi gỡ lớp ⇒ không history.back() (lần đầu bấm không còn bị kéo về trang chủ)", () => {
    vi.useFakeTimers();
    // ra khỏi cửa CHO_ROI_TRANG_MS của dấu `diTrang` các ca trước để lại — không thì ca này xanh "ăn ké"
    vi.setSystemTime(Date.now() + 20_000);
    const r = render(createElement(Lop));
    fireEvent.click(r.getByText("Trang quản trị"));
    r.unmount();
    vi.runAllTimers();
    expect(back).not.toHaveBeenCalled();
  });
  it("đối chứng: gỡ lớp mà KHÔNG bấm link ⇒ vẫn lùi dọn mục lịch sử như cũ", () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 40_000); // ra khỏi cửa CHO_ROI_TRANG_MS của các ca trên
    const r = render(createElement(Lop));
    r.unmount();
    vi.runAllTimers();
    expect(back).toHaveBeenCalledTimes(1);
  });
});
