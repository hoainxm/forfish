// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

/*
  Hook `useNavVoice` (doc 15 §4) — đo đúng thứ chạy trên máy: bật chế độ →
  BẢN TIN MỞ ĐẦU đọc TRƯỚC mọi câu không-đỏ; câu đỏ không phải chờ; tắt rồi bật
  lại vẫn đọc; máy không có giọng Việt thì im mà không kẹt.
*/

import { useNavVoice, type NavVoiceInput } from "@/lib/nav-voice/use-nav-voice";
import type { NavAlert } from "@/lib/nav-hazards";

type Spoken = { text: string };
let spoken: Spoken[] = [];
let hasVi = true;

function installSynth() {
  spoken = [];
  const synth = {
    getVoices: () => (hasVi ? [{ lang: "vi-VN", localService: true, name: "Linh" }] : [{ lang: "en-US", localService: true, name: "Sam" }]),
    addEventListener: () => {},
    removeEventListener: () => {},
    cancel: () => {},
    speak: (u: { text: string; onstart?: () => void; onend?: () => void }) => {
      if (!u.text) return;
      spoken.push({ text: u.text });
      setTimeout(() => u.onstart?.(), 10);
      setTimeout(() => u.onend?.(), 1000);
    },
  };
  Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
  class Utter {
    text: string;
    lang = "";
    voice: unknown = null;
    rate = 1;
    onstart?: () => void;
    onend?: () => void;
    onerror?: () => void;
    constructor(t: string) {
      this.text = t;
    }
  }
  (globalThis as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = Utter;
}

const base = (over: Partial<NavVoiceInput> = {}): NavVoiceInput => ({
  on: false,
  unit: "nm",
  pos: { lat: 10.15, lon: 107.03 },
  headingDeg: 0,
  speedKmh: 13,
  moving: true,
  gps: "tracking",
  alerts: [],
  border: null,
  offRoute: null,
  info: null,
  storm: { kind: "khong-hoi-duoc", checkedAt: null },
  depthHere: null,
  legsPassed: 0,
  legsTotal: 0,
  arrived: false,
  chart: null,
  lengthM: null,
  ...over,
});

const RED: NavAlert = { id: "x", bac: 1, muc: "do", cau: "Xác tàu phía trước chừng 400 m.", chuong: true, rung: true, distKm: 0.4, etaMin: 2 };

async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("useNavVoice", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    hasVi = true;
    installSynth();
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("bật: BẢN TIN đọc trước câu vùng nước tới cùng lúc", async () => {
    const { rerender } = renderHook((p: NavVoiceInput) => useNavVoice(p), { initialProps: base() });
    rerender(base({ on: true, depthHere: 5 }));
    await tick(2100);
    rerender(base({ on: true, depthHere: 5, chart: "du" }));
    await tick(3000);
    rerender(base({ on: true, depthHere: 5, chart: "du", headingDeg: 1 }));
    await tick(30_000);
    expect(spoken.length).toBeGreaterThanOrEqual(2);
    expect(spoken[0].text).toMatch(/Máy đang canh độ sâu|Máy chưa có tin bão/);
    expect(spoken.some((s) => /vùng nước sâu/.test(s.text))).toBe(true);
  });

  it("câu ĐỎ không phải chờ bản tin", async () => {
    const { rerender } = renderHook((p: NavVoiceInput) => useNavVoice(p), { initialProps: base() });
    rerender(base({ on: true }));
    await tick(300);
    rerender(base({ on: true, alerts: [RED] }));
    await tick(1500);
    expect(spoken[0]?.text).toBe("Xác tàu phía trước chừng 400 mét.");
  });

  it("tắt rồi bật lại: vẫn có bản tin mới và vẫn đọc", async () => {
    const { rerender } = renderHook((p: NavVoiceInput) => useNavVoice(p), { initialProps: base() });
    rerender(base({ on: true, chart: "du" }));
    await tick(20_000);
    const n1 = spoken.length;
    expect(n1).toBeGreaterThanOrEqual(1);
    rerender(base({ on: false, chart: "du" }));
    await tick(500);
    rerender(base({ on: true, chart: "du", depthHere: 4 }));
    await tick(3000);
    rerender(base({ on: true, chart: "du", depthHere: 4, headingDeg: 2 }));
    await tick(30_000);
    const after = spoken.slice(n1);
    expect(after[0]?.text).toMatch(/Máy đang canh độ sâu/);
    expect(after.some((s) => /vùng nước 4 đến 12/.test(s.text))).toBe(true);
  });

  it("máy không có giọng Việt: không đọc, báo avail.ok=false để HUD nói thật", async () => {
    hasVi = false;
    installSynth();
    const { result, rerender } = renderHook((p: NavVoiceInput) => useNavVoice(p), { initialProps: base() });
    rerender(base({ on: true, chart: "du", alerts: [RED] }));
    await tick(10_000);
    expect(spoken).toHaveLength(0);
    expect(result.current.avail?.ok).toBe(false);
  });

  it("màn tắt đúng lúc tới lượt bản tin: KHÔNG nuốt — mở màn lại thì đọc", async () => {
    let vis: DocumentVisibilityState = "hidden";
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => vis });
    const { rerender } = renderHook((p: NavVoiceInput) => useNavVoice(p), { initialProps: base() });
    rerender(base({ on: true, chart: "du" }));
    await tick(30_000);
    expect(spoken).toHaveLength(0);
    vis = "visible";
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await tick(3000);
    expect(spoken[0]?.text).toMatch(/Máy đang canh độ sâu/);
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
  });
});
