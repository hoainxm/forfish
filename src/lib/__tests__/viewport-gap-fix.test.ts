// @vitest-environment jsdom
//
// ViewportGapFix CHỈ chạy trên iOS (2026-10-27, anh Long: "lỗi tràn viền kìa" — PWA Android khoá --app-vh cao hơn vùng
// nhìn thấy đúng một thanh điều hướng ⇒ dock lọt xuống dưới thanh 3 nút). Android standalone: không gắn pwa-frame.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { cleanup, render } from "@testing-library/react";

import { laIosWebKit, ViewportGapFix } from "@/components/viewport-gap-fix";

const UA = {
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  ipadDesktop: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15",
  oppo: "Mozilla/5.0 (Linux; Android 15; CPH2591) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.documentElement.classList.remove("pwa-frame");
  document.documentElement.style.removeProperty("--app-vh");
});

function moStandalone(ua: string, touch: number, vvH = 900) {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(ua);
  Object.defineProperty(navigator, "maxTouchPoints", { value: touch, configurable: true });
  window.matchMedia = ((q: string) => ({ matches: q.includes("standalone"), addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  Object.defineProperty(window, "visualViewport", { value: { height: vvH, addEventListener() {}, removeEventListener() {} }, configurable: true });
}

describe("laIosWebKit", () => {
  it("iPhone, iPad chế độ desktop (Macintosh + chạm) là iOS; Android và Mac thật thì không", () => {
    expect(laIosWebKit(UA.iphone, 5)).toBe(true);
    expect(laIosWebKit(UA.ipadDesktop, 5)).toBe(true);
    expect(laIosWebKit(UA.ipadDesktop, 0)).toBe(false);
    expect(laIosWebKit(UA.oppo, 5)).toBe(false);
  });
});

describe("ViewportGapFix", () => {
  it("PWA Android: KHÔNG gắn pwa-frame, không đặt --app-vh (dock bám đáy vùng nhìn thấy như thường)", () => {
    moStandalone(UA.oppo, 5);
    render(createElement(ViewportGapFix));
    expect(document.documentElement.classList.contains("pwa-frame")).toBe(false);
    expect(document.documentElement.style.getPropertyValue("--app-vh")).toBe("");
  });
  it("PWA iPhone: vẫn gắn pwa-frame như cũ", () => {
    moStandalone(UA.iphone, 5);
    render(createElement(ViewportGapFix));
    expect(document.documentElement.classList.contains("pwa-frame")).toBe(true);
  });
});
