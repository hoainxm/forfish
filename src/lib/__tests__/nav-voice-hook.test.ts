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

type Spoken = { text: string; rate: number };
/** câu đỏ mẫu khi đi giọng máy: số đã thành chữ nói (mảnh ghép Mỹ Duyên, doc 15 §21) */
const RED_NOI = "Xác tàu phía trước chừng bốn trăm mét";
let spoken: Spoken[] = [];
let hasVi = true;

function installSynth() {
  spoken = [];
  const synth = {
    getVoices: () => (hasVi ? [{ lang: "vi-VN", localService: true, name: "Linh" }] : [{ lang: "en-US", localService: true, name: "Sam" }]),
    addEventListener: () => {},
    removeEventListener: () => {},
    cancel: () => {},
    speak: (u: { text: string; rate: number; onstart?: () => void; onend?: () => void }) => {
      if (!u.text) return;
      spoken.push({ text: u.text, rate: u.rate });
      setTimeout(() => u.onstart?.(), 10);
      setTimeout(() => u.onend?.(), 1000);
    },
  };
  Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
  // mp3 Sen Biển không tải được trong test ⇒ mọi câu đi giọng máy (đếm được qua `spoken`);
  // KHÔNG để fetch thật chạy tới localhost — test không được phụ thuộc máy có server hay không
  vi.stubGlobal("fetch", () => Promise.reject(new TypeError("offline")));
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
    expect(spoken[0].text).toMatch(/^(Máy đang canh độ sâu|Máy chưa có tin bão)/);
    expect(spoken.some((s) => /vùng nước sâu/.test(s.text))).toBe(true);
  });

  it("câu ĐỎ không phải chờ bản tin", async () => {
    const { rerender } = renderHook((p: NavVoiceInput) => useNavVoice(p), { initialProps: base() });
    rerender(base({ on: true }));
    await tick(300);
    rerender(base({ on: true, alerts: [RED] }));
    await tick(1500);
    // câu có số nay GHÉP mảnh giọng Sen Biển: đoạn đọc mang chữ nói (doc 15 §21)
    expect(spoken[0]?.text).toBe("Xác tàu phía trước chừng bốn trăm mét");
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
    // bản tin mở đầu nay đọc THÀNH ĐOẠN (nghỉ giữa câu/dấu phẩy) — ghép lại để soi
    expect(after.map((s) => s.text).join(" ")).toMatch(/Máy đang canh độ sâu/);
    expect(after.some((s) => /vùng nước 4 đến 12/.test(s.text))).toBe(true);
  });

  it("Sen Biển 'dừng': đẩy câu đáp rồi tắt chế độ NGAY — câu đáp vẫn được đọc", async () => {
    const { result, rerender } = renderHook((p: NavVoiceInput) => useNavVoice(p), { initialProps: base() });
    rerender(base({ on: true, chart: "du" }));
    await tick(3000);
    // câu đáp TRƯỚC còn đang đọc ⇒ câu "dừng" phải xếp hàng sau nó
    act(() => result.current.say("Bắt đầu dẫn đường. Sen Biển canh và đọc cảnh báo."));
    await tick(200);
    act(() => result.current.say("Đã dừng dẫn đường."));
    rerender(base({ on: false, chart: "du" })); // stopNav cùng nhịp
    await tick(3000);
    expect(spoken.filter((s) => s.text === "Đã dừng dẫn đường.")).toHaveLength(1);
    // câu đang đọc dở không bị đọc lại từ đầu
    expect(spoken.filter((s) => s.text === "Bắt đầu dẫn đường.")).toHaveLength(1);
  });

  it("Sen Biển 'đi' khi tóm tắt đường CÒN ĐANG ĐỌC: câu đáp vẫn tới tai sau khi bật chế độ", async () => {
    // Bà con nghe "…Nói đi để bắt đầu." là nói "đi" liền — lúc đó câu tóm tắt còn
    // đọc (chế độ tắt ⇒ hàng câu đáp lúc tắt), senStart bật chế độ + say "Bắt đầu…".
    // Rà soát prod 2026-10-16: tóm tắt đọc xong thì hàng chờ bị BỎ vì chế độ đã
    // bật ⇒ nói "đi" mà máy im, chỉ nghe bản tin.
    const { result, rerender } = renderHook((p: NavVoiceInput) => useNavVoice(p), { initialProps: base() });
    await tick(100);
    act(() => result.current.say("Tới Sa Huỳnh: 14 hải lý, chừng 2 giờ. Nói đi để bắt đầu."));
    await tick(500);
    act(() => result.current.say("Bắt đầu dẫn đường. Sen Biển canh và đọc cảnh báo."));
    rerender(base({ on: true, chart: "du" }));
    await tick(30_000);
    const texts = spoken.map((s) => s.text);
    expect(texts.filter((t) => t === "Bắt đầu dẫn đường.")).toHaveLength(1);
    expect(texts.filter((t) => t === "Sen Biển canh và đọc cảnh báo.")).toHaveLength(1);
  });

  it("Sen Biển 'đi' sau khi tóm tắt đọc xong: câu đáp ĐANG đọc không bị bản tin cắt ngang", async () => {
    // như máy thật: mở bản đồ là tự Đang chạy (máy đã biết đọc được tiếng Việt),
    // bà con bấm Dừng, rồi nhờ Sen Biển vẽ đường và nói "đi"
    const { result, rerender } = renderHook((p: NavVoiceInput) => useNavVoice(p), { initialProps: base({ on: true, chart: "du" }) });
    await tick(20_000);
    rerender(base({ on: false, chart: "du" }));
    await tick(500);
    const n0 = spoken.length;
    act(() => result.current.say("Bắt đầu dẫn đường. Sen Biển canh và đọc cảnh báo. Bà con giữ máy sáng nhé."));
    rerender(base({ on: true, chart: "du" }));
    // bước nhỏ: để effect bản tin mở đầu chạy ĐÚNG nhịp 1,2 s như trên máy (một
    // tick dài thì React chỉ vẽ lại ở cuối, bản tin tới muộn và lỗi không lộ)
    for (let i = 0; i < 100; i++) await tick(300);
    const texts = spoken.slice(n0).map((s) => s.text);
    // mp3 không tải được ⇒ đọc giọng máy TỪNG MẢNH ở dạng chữ nói (ghép mảnh, doc 15 §21):
    // "Bà con giữ máy" · "sáng" · "nhé" — mốc là mảnh CUỐI của câu cuối
    const iCuoi = texts.findIndex((t) => /(^| )nhé\.?$/.test(t));
    const iBanTin = texts.findIndex((t) => /^(Máy đang canh|Máy chưa có tin bão|Bản tin)/.test(t));
    expect(iCuoi).toBeGreaterThan(0);
    expect(iBanTin).toBeGreaterThan(iCuoi);
  });

  it("câu ĐỎ tới lúc câu đáp (chế độ tắt) còn đọc: đỏ không phải chờ", async () => {
    const { result, rerender } = renderHook((p: NavVoiceInput) => useNavVoice(p), { initialProps: base() });
    await tick(100);
    act(() => result.current.say("Bắt đầu dẫn đường. Sen Biển canh và đọc cảnh báo."));
    rerender(base({ on: true }));
    await tick(300);
    rerender(base({ on: true, alerts: [RED] }));
    await tick(1500);
    expect(spoken.map((s) => s.text)).toContain(RED_NOI);
  });

  it("chế độ TẮT: hai câu Sen Biển liên tiếp NỐI HÀNG, câu sau không cắt câu trước", async () => {
    const { result } = renderHook((p: NavVoiceInput) => useNavVoice(p), { initialProps: base() });
    await tick(100);
    act(() => {
      result.current.say("Điểm 14 độ 34 phút Bắc. Đang vẽ đường.");
      result.current.say("Tới Sa Huỳnh: 14 hải lý.");
    });
    await tick(10_000);
    const texts = spoken.map((s) => s.text);
    expect(texts).toEqual(["Điểm mười bốn độ ba mươi tư phút Bắc", "Đang vẽ đường.", "Tới Sa Huỳnh", "mười bốn hải lý"]);
  });

  it("máy không có giọng Việt VÀ không phát được mp3: không đọc, báo avail.ok=false để HUD nói thật", async () => {
    hasVi = false;
    installSynth();
    vi.stubGlobal("Audio", undefined);
    const { result, rerender } = renderHook((p: NavVoiceInput) => useNavVoice(p), { initialProps: base() });
    rerender(base({ on: true, chart: "du", alerts: [RED] }));
    await tick(10_000);
    expect(spoken).toHaveLength(0);
    expect(result.current.avail?.ok).toBe(false);
  });

  it("không giọng Việt nhưng có mp3 Mỹ Duyên: VẪN đọc được (avail.ok), chỉ thiếu giọng máy", async () => {
    hasVi = false;
    installSynth();
    vi.stubGlobal("Audio", class {}); // ca trước gỡ Audio — trả lại thẻ phát mp3
    const { result, rerender } = renderHook((p: NavVoiceInput) => useNavVoice(p), { initialProps: base() });
    rerender(base({ on: true, chart: "du", alerts: [RED] }));
    await tick(10_000);
    expect(result.current.avail).toMatchObject({ ok: true, giongMay: false });
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
    await tick(12_000);
    expect(spoken.map((s) => s.text).join(" ")).toMatch(/Máy đang canh độ sâu/);
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
  });

  it("onSpoken (chế độ TẮT): gọi SAU KHI câu hỏi đọc xong, không gọi lúc loa còn kêu", async () => {
    const { result } = renderHook((p: NavVoiceInput) => useNavVoice(p), { initialProps: base() });
    await tick(100);
    const done = vi.fn();
    act(() => result.current.say("Tới Sa Huỳnh: 14 hải lý, chừng 2 giờ. Nói đi để bắt đầu.", { onSpoken: done }));
    await tick(1500); // đoạn đầu còn đang đọc
    expect(done).not.toHaveBeenCalled();
    await tick(10_000);
    expect(done).toHaveBeenCalledTimes(1);
    expect(spoken.map((s) => s.text).at(-1)).toBe("Nói đi để bắt đầu.");
  });

  it("onSpoken (đang chạy): gọi khi câu đáp đọc xong", async () => {
    const { result, rerender } = renderHook((p: NavVoiceInput) => useNavVoice(p), { initialProps: base() });
    rerender(base({ on: true, chart: "du" }));
    await tick(30_000); // bản tin mở đầu đọc xong
    const done = vi.fn();
    act(() => result.current.say("Có 2 chỗ tên giống nhau. Bà con chạm chọn đúng chỗ.", { onSpoken: done }));
    await tick(500);
    expect(done).not.toHaveBeenCalled();
    await tick(5000);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("câu ĐỎ chen vào cắt câu hỏi ⇒ KHÔNG báo đọc xong (không mở micro)", async () => {
    const { result, rerender } = renderHook((p: NavVoiceInput) => useNavVoice(p), { initialProps: base() });
    rerender(base({ on: true, chart: "du" }));
    await tick(30_000);
    const done = vi.fn();
    act(() => result.current.say("Tới Sa Huỳnh: 14 hải lý, chừng 2 giờ. Nói đi để bắt đầu.", { onSpoken: done }));
    await tick(300);
    rerender(base({ on: true, chart: "du", alerts: [RED] }));
    await tick(20_000);
    expect(spoken.map((s) => s.text)).toContain(RED_NOI);
    expect(done).not.toHaveBeenCalled();
  });

  it("tắt màn giữa câu hỏi ⇒ không báo đọc xong", async () => {
    let vis: DocumentVisibilityState = "visible";
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => vis });
    const { result, rerender } = renderHook((p: NavVoiceInput) => useNavVoice(p), { initialProps: base() });
    rerender(base({ on: true, chart: "du" }));
    await tick(30_000);
    const done = vi.fn();
    act(() => result.current.say("Bà con chạm chọn đúng chỗ.", { onSpoken: done }));
    await tick(300);
    vis = "hidden";
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await tick(5000);
    expect(done).not.toHaveBeenCalled();
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
  });

  it("tốc độ: câu đáp ngắn đọc 1,12; câu ĐỎ giữ 1,0", async () => {
    const { result, rerender } = renderHook((p: NavVoiceInput) => useNavVoice(p), { initialProps: base() });
    rerender(base({ on: true, chart: "du" }));
    await tick(30_000);
    act(() => result.current.say("Còn 12 hải lý, chừng 1 giờ."));
    await tick(5000);
    rerender(base({ on: true, chart: "du", alerts: [RED] }));
    await tick(5000);
    const reply = spoken.filter((s) => s.text === "Còn mười hai hải lý"); // số thành chữ nói (doc 15 §21)
    expect(reply.length).toBe(1);
    expect(reply[0].rate).toBe(1.12);
    expect(spoken.find((s) => s.text === RED_NOI)?.rate).toBe(1);
  });
});
