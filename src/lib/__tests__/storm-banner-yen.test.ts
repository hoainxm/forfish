// @vitest-environment jsdom
//
// BẢN ĐỒ LÚC YÊN (anh Long 2026-10-27: "ẩn đi sau khi báo"): pill "Không có bão · hỏi …" báo NOTIFY_HIDE_MS rồi ẩn hẳn;
// nhịp hỏi lại 30 phút (check mới, vẫn yên) KHÔNG bật lại; vừa hết bão ⇒ báo lại. Có bão / trang chủ không đổi.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";

import type { StormCheck } from "@/lib/storms";
import { NOTIFY_HIDE_MS } from "@/lib/notify";

const NOW = Date.parse("2026-10-27T06:11:00Z");
let check: StormCheck | null = null;
vi.mock("@/lib/use-storm-check", () => ({ useStormCheck: () => ({ check, nowMs: NOW }) }));
vi.mock("@/lib/use-online", () => ({ useOnline: () => true }));

const { StormBanner } = await import("@/components/storm-banner");

const yen = (): StormCheck => ({ ok: true, checkedAt: new Date(NOW - 60_000).toISOString(), storms: [] }) as unknown as StormCheck;
const coBao = (): StormCheck =>
  ({
    ok: true,
    checkedAt: new Date(NOW - 60_000).toISOString(),
    storms: [{ id: "b1", kindLabel: "Bão", name: "số 9", alert: "warning", windKmh: 90, updated: new Date(NOW - 3_600_000).toISOString() }],
  }) as unknown as StormCheck;

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("StormBanner overlay lúc yên", () => {
  it("báo 'Không có bão' rồi ẩn sau NOTIFY_HIDE_MS; hỏi lại vẫn yên thì không bật lại", () => {
    check = yen();
    const { rerender } = render(createElement(StormBanner, { variant: "overlay" }));
    expect(screen.queryByText(/Không có bão/)).toBeTruthy();
    act(() => vi.advanceTimersByTime(NOTIFY_HIDE_MS + 50));
    expect(screen.queryByText(/Không có bão/)).toBeNull();
    check = yen(); // nhịp 30 phút: object mới, vẫn yên
    rerender(createElement(StormBanner, { variant: "overlay" }));
    expect(screen.queryByText(/Không có bão/)).toBeNull();
  });
  it("có bão rồi hết bão ⇒ báo 'Không có bão' lại một lần", () => {
    check = coBao();
    const { rerender } = render(createElement(StormBanner, { variant: "overlay" }));
    expect(screen.queryByText(/Bão số 9/)).toBeTruthy();
    check = yen();
    rerender(createElement(StormBanner, { variant: "overlay" }));
    expect(screen.queryByText(/Không có bão/)).toBeTruthy();
    act(() => vi.advanceTimersByTime(NOTIFY_HIDE_MS + 50));
    expect(screen.queryByText(/Không có bão/)).toBeNull();
  });
  it("màn Sen Biển (page always) vẫn thường trực dòng yên — không tự ẩn", () => {
    check = yen();
    render(createElement(StormBanner, { variant: "page", always: true }));
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.queryByText(/Không có tin bão trên Biển Đông/)).toBeTruthy();
  });
});
