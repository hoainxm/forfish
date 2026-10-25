// @vitest-environment jsdom
//
// KHOÁ VUỐT NỀN iOS (VO-APP-09, QUYET-DINH J): ngoài panel luôn chặn touchmove; trong panel chỉ chặn khi
// từ chỗ chạm lên tới panel không có vùng nào cuộn được; khoá body thêm overscroll-behavior:none có đếm.
import { afterEach, describe, expect, it } from "vitest";

import { chanVuotNen, coVungCuonTrong, khoaVuotNen, lockBodyScroll, unlockBodyScroll } from "@/lib/dialog-focus";

function cuonDuoc(el: HTMLElement, duoc: boolean) {
  Object.defineProperty(el, "scrollHeight", { value: duoc ? 500 : 100, configurable: true });
  Object.defineProperty(el, "clientHeight", { value: 100, configurable: true });
  Object.defineProperty(el, "scrollWidth", { value: 100, configurable: true });
  Object.defineProperty(el, "clientWidth", { value: 100, configurable: true });
}

describe("chanVuotNen (thuần)", () => {
  it("ngoài panel ⇒ chặn; trong panel ⇒ chỉ chặn khi không có vùng cuộn", () => {
    expect(chanVuotNen(false, false)).toBe(true);
    expect(chanVuotNen(false, true)).toBe(true);
    expect(chanVuotNen(true, false)).toBe(true);
    expect(chanVuotNen(true, true)).toBe(false);
  });
});

describe("coVungCuonTrong + khoaVuotNen (DOM)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });
  it("panel cuộn được ⇒ không chặn; panel không cuộn ⇒ chặn; chạm ngoài panel ⇒ chặn", () => {
    document.body.innerHTML = `<div id="scrim"><div id="panel"><p id="p">x</p></div></div>`;
    const scrim = document.getElementById("scrim")!;
    const panel = document.getElementById("panel")!;
    const p = document.getElementById("p")!;
    cuonDuoc(panel, true);
    cuonDuoc(p, false);
    expect(coVungCuonTrong(p, panel)).toBe(true);
    const go = khoaVuotNen(scrim, () => panel);
    const ban = (target: Element) => {
      const e = new Event("touchmove", { bubbles: true, cancelable: true });
      target.dispatchEvent(e);
      return e.defaultPrevented;
    };
    expect(ban(p)).toBe(false);
    cuonDuoc(panel, false);
    expect(coVungCuonTrong(p, panel)).toBe(false);
    expect(ban(p)).toBe(true);
    expect(ban(scrim)).toBe(true);
    go();
    expect(ban(scrim)).toBe(false); // đã gỡ
  });
  it("vùng cuộn con (overflow auto) trong panel không cuộn ⇒ vẫn cho cuộn", () => {
    document.body.innerHTML = `<div id="panel"><div id="hang" style="overflow:auto"><span id="s">y</span></div></div>`;
    const panel = document.getElementById("panel")!;
    const hang = document.getElementById("hang")!;
    const s = document.getElementById("s")!;
    cuonDuoc(panel, false);
    cuonDuoc(hang, true);
    cuonDuoc(s, false);
    expect(coVungCuonTrong(s, panel)).toBe(true);
  });
});

describe("lockBodyScroll — overscroll-behavior:none có đếm tham chiếu", () => {
  it("khoá hai lớp, mở hai lần mới trả về", () => {
    document.documentElement.style.overscrollBehavior = "auto";
    lockBodyScroll();
    lockBodyScroll();
    expect(document.documentElement.style.overscrollBehavior).toBe("none");
    expect(document.body.style.overflow).toBe("hidden");
    unlockBodyScroll();
    expect(document.documentElement.style.overscrollBehavior).toBe("none");
    unlockBodyScroll();
    expect(document.documentElement.style.overscrollBehavior).toBe("auto");
    expect(document.body.style.overflow).toBe("");
  });
});
