// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
  SEN BIỂN — NGHE QUA LẠI (lượt "nghe nhanh hơn" 2026-10-16, doc 07 §Sen Biển):
  · chờ LỆNH NGẮN (đi/thôi/chọn) im 5 s là thôi; nói TÊN CHỖ vẫn 8 s
  · tự nghe sau câu hỏi chỉ khi đủ điều kiện (autoListenOk)
  · micro "đã cho phép" chỉ bật sau một lượt nghe ra chữ
*/

type Fake = {
  onresult: ((e: unknown) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  started: boolean;
  aborted: boolean;
};
let recs: Fake[] = [];

function installSR() {
  recs = [];
  class SR {
    lang = "";
    interimResults = false;
    continuous = false;
    maxAlternatives = 1;
    onresult: Fake["onresult"] = null;
    onerror: Fake["onerror"] = null;
    onend: Fake["onend"] = null;
    onstart: (() => void) | null = null;
    started = false;
    aborted = false;
    constructor() {
      recs.push(this as unknown as Fake);
    }
    start() {
      this.started = true;
    }
    stop() {}
    abort() {
      this.aborted = true;
    }
  }
  (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition = SR;
}

const say = (r: Fake, text: string) =>
  r.onresult?.({ results: [Object.assign([{ transcript: text }], { isFinal: true })] });

describe("listenOnce — im lặng theo ngữ cảnh", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    installSR();
  });
  afterEach(() => {
    vi.useRealTimers();
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
  });

  it("chờ lệnh ngắn: im 5 s ⇒ no-speech; tên chỗ: 5 s chưa hết, 8 s mới hết", async () => {
    const { listenOnce, COMMAND_SILENCE_MS, SILENCE_MS } = await import("@/lib/sen-bien/nghe");
    expect(COMMAND_SILENCE_MS).toBe(5000);
    expect(SILENCE_MS).toBe(8000);
    const errLenh = vi.fn();
    listenOnce({ expect: "lenh", onInterim() {}, onFinal() {}, onError: errLenh });
    await vi.advanceTimersByTimeAsync(4900);
    expect(errLenh).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    expect(errLenh).toHaveBeenCalledWith("no-speech");

    const errTen = vi.fn();
    listenOnce({ expect: "ten", onInterim() {}, onFinal() {}, onError: errTen });
    await vi.advanceTimersByTimeAsync(5100);
    expect(errTen).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(3000);
    expect(errTen).toHaveBeenCalledWith("no-speech");
  });

  it("silenceMsFor: không nói ngữ cảnh = tên chỗ (8 s, như trước)", async () => {
    const { silenceMsFor } = await import("@/lib/sen-bien/nghe");
    expect(silenceMsFor(undefined)).toBe(8000);
    expect(silenceMsFor("ten")).toBe(8000);
    expect(silenceMsFor("lenh")).toBe(5000);
  });

  it("micro 'đã cho phép' chỉ bật sau một lượt nghe ra chữ", async () => {
    const { listenOnce, micGranted } = await import("@/lib/sen-bien/nghe");
    expect(micGranted()).toBe(false);
    const fin = vi.fn();
    listenOnce({ expect: "ten", onInterim() {}, onFinal: fin, onError() {} });
    await vi.advanceTimersByTimeAsync(9000); // im lặng hết giờ — chưa tính là cho phép
    expect(micGranted()).toBe(false);
    listenOnce({ expect: "ten", onInterim() {}, onFinal: fin, onError() {} });
    say(recs[1], "Sa Huỳnh");
    expect(fin).toHaveBeenCalledWith("Sa Huỳnh");
    expect(micGranted()).toBe(true);
  });
});

describe("autoListenOk — khi nào Sen Biển TỰ nghe sau câu hỏi", () => {
  const ok = {
    stt: true,
    typing: false,
    granted: true,
    hidden: false,
    online: true,
    busy: false,
    listening: false,
  };
  it("đủ điều kiện ⇒ nghe", async () => {
    const { autoListenOk } = await import("@/lib/sen-bien/nghe");
    expect(autoListenOk(ok)).toBe(true);
  });
  it("thiếu MỘT điều kiện là không tự nghe", async () => {
    const { autoListenOk } = await import("@/lib/sen-bien/nghe");
    expect(autoListenOk({ ...ok, stt: false })).toBe(false); // máy không có STT
    expect(autoListenOk({ ...ok, typing: true })).toBe(false); // bà con đang gõ
    expect(autoListenOk({ ...ok, granted: false })).toBe(false); // chưa cho micro — không bật hộp xin quyền
    expect(autoListenOk({ ...ok, hidden: true })).toBe(false); // màn tắt / tab ẩn
    expect(autoListenOk({ ...ok, online: false })).toBe(false); // mất sóng: STT cần mạng
    expect(autoListenOk({ ...ok, busy: true })).toBe(false); // loa đang đọc câu khác
    expect(autoListenOk({ ...ok, listening: true })).toBe(false); // đang nghe sẵn
  });
});

describe("hiểu ý — câu nào CHỜ bà con nói lại", () => {
  it("chưa nghe rõ ⇒ ask; chưa hiểu ⇒ không (tiếng ồn máy tàu không được thành vòng hỏi mãi)", async () => {
    const { senBienReply } = await import("@/lib/sen-bien/hieu-y");
    const r1 = senBienReply("", null, [], null);
    expect(r1.kind === "say" && r1.ask).toBe(true);
    const r2 = senBienReply("zzzz qqqq", null, [], null);
    expect(r2.kind === "say" && r2.ask).toBeFalsy();
  });
});
