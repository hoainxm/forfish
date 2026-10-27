// @vitest-environment jsdom
//
// Ghim khung --app-vh (ViewportGapFix) CHỈ chạy trên iOS (2026-10-27): chạy trên
// Android, trần `screen.height` gồm cả thanh điều hướng ⇒ mốc lỡ chốt cao hơn vùng
// nhìn thấy một thanh ⇒ dock kẹt sau thanh ☰ □ ◁ (ảnh bản cài Android).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { cleanup, render } from "@testing-library/react";

import { ViewportGapFix } from "@/components/viewport-gap-fix";

const ANDROID = "Mozilla/5.0 (Linux; Android 14; CPH2591) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

function giaBanCai(ua: string, mocLuu: number) {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(ua);
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: /display-mode:\s*standalone/.test(q), media: q, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("visualViewport", Object.assign(new EventTarget(), { height: 728, width: 360 }));
  localStorage.setItem(`forfish.pwa-frame.${screen.width}x${screen.height}`, String(mocLuu));
}

describe("ViewportGapFix chỉ ghim khung trên iOS", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.documentElement.classList.remove("pwa-frame");
    document.documentElement.style.removeProperty("--app-vh");
  });

  it("bản cài Android: KHÔNG gắn pwa-frame, KHÔNG đặt --app-vh dù máy còn mốc cũ", () => {
    giaBanCai(ANDROID, 1);
    render(createElement(ViewportGapFix));
    expect(document.documentElement.classList.contains("pwa-frame")).toBe(false);
    expect(document.documentElement.style.getPropertyValue("--app-vh")).toBe("");
    // khoá cũ của bà con để nguyên, không xoá
    expect(localStorage.getItem(`forfish.pwa-frame.${screen.width}x${screen.height}`)).toBe("1");
  });

  it("bản cài iPhone: vẫn gắn pwa-frame + nạp mốc đã lưu như cũ", () => {
    giaBanCai(IPHONE, 1);
    render(createElement(ViewportGapFix));
    expect(document.documentElement.classList.contains("pwa-frame")).toBe(true);
    expect(document.documentElement.style.getPropertyValue("--app-vh")).toBe("1px");
  });
});
