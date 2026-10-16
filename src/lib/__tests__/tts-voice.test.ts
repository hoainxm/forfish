// @vitest-environment jsdom
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import catalog from "@/data/giong-sen-bien.json";
import { senBienReply } from "@/lib/sen-bien/hieu-y";
import { chartLine, DEPTH_HERE_SHORT } from "@/lib/nav-voice/opening";
import { DEPTH_ZONE_SPEECH } from "@/lib/nav-voice/events";
import { VOICE_TEST_TEXT } from "@/lib/nav-voice/use-nav-voice";

/*
  GIỌNG NỮ SEN BIỂN (2026-10-16) — lib/voice/tts.ts vẫn là MỘT CỬA đọc.
  · câu cố định → mp3 sinh sẵn (VieNeu, danh mục src/data/giong-sen-bien.json)
  · câu động → giọng máy, ưu tiên giọng nữ, tách đoạn có nghỉ
  Cổng danh mục: câu trong code đổi chữ mà quên sinh lại mp3 ⇒ ĐỎ ở đây.
*/

const CLIP_DIR = join(process.cwd(), "public", catalog.dir.replace(/^\//, ""));

describe("danh mục giọng Sen Biển ↔ file mp3", () => {
  it("mỗi câu có đúng một mp3, không file mồ côi, không trùng khoá", async () => {
    const { clipKey } = await import("@/lib/voice/tts");
    const ids = catalog.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    const keys = catalog.items.map((i) => clipKey(i.text));
    expect(new Set(keys).size).toBe(keys.length);
    for (const id of ids) expect(existsSync(join(CLIP_DIR, `${id}.mp3`)), id).toBe(true);
    const files = readdirSync(CLIP_DIR).filter((f) => f.endsWith(".mp3"));
    expect(files.sort()).toEqual(ids.map((i) => `${i}.mp3`).sort());
  });

  it("mỗi mục là MỘT câu (khoá tra theo câu, nhiều câu thì không bao giờ khớp)", async () => {
    const { splitSentences } = await import("@/lib/voice/tts");
    for (const it of catalog.items) expect(splitSentences(it.text), it.id).toHaveLength(1);
  });
});

describe("câu cố định trong code đều có giọng Sen Biển", () => {
  async function expectAllClipped(text: string) {
    const { speechParts } = await import("@/lib/voice/tts");
    const miss = speechParts(text).filter((p) => !p.clip);
    expect(miss.map((p) => p.text), text).toEqual([]);
  }

  it("lời đáp cố định của Sen Biển", async () => {
    const run = (t: string, ctx = { awaitingGo: false, running: false }) =>
      senBienReply(t, null, [], null, ctx);
    const says: string[] = [];
    for (const r of [
      run(""),
      run("thôi", { awaitingGo: true, running: false }),
      run("đi", { awaitingGo: true, running: false }),
      run("dừng lại", { awaitingGo: false, running: true }),
      run("im"),
      run("bật tiếng"),
      run("về cảng nhà"),
      run("zzzz qqqq"),
    ]) {
      if ("say" in r) says.push(r.say);
    }
    expect(says.length).toBeGreaterThan(5);
    for (const s of says) await expectAllClipped(s);
  });

  it("bản tin mở đầu (hải đồ), vùng nước dưới tàu, câu nghe thử", async () => {
    for (const c of ["du", "thieu", "chua-co"] as const) await expectAllClipped(chartLine(c));
    for (const s of Object.values(DEPTH_HERE_SHORT)) await expectAllClipped(s);
    for (const z of Object.values(DEPTH_ZONE_SPEECH)) {
      if (!z) continue;
      await expectAllClipped(z.text);
      if (z.first) await expectAllClipped(z.first);
    }
    await expectAllClipped(VOICE_TEST_TEXT);
  });
});

describe("speechParts — câu nói → đoạn đọc có nghỉ", () => {
  it("câu động tách ở dấu phẩy / hai chấm, KHÔNG tách số thập phân 2,5", async () => {
    const { speechParts, PAUSE_COMMA_MS, PAUSE_SENTENCE_MS } = await import("@/lib/voice/tts");
    const p = speechParts("Tới Sa Huỳnh: 2,5 hải lý, chừng 1 giờ. Nói đi để bắt đầu.");
    expect(p.map((x) => x.text)).toEqual(["Tới Sa Huỳnh", "2,5 hải lý", "chừng 1 giờ.", "Nói đi để bắt đầu."]);
    expect(p.map((x) => x.clip != null)).toEqual([false, false, false, true]);
    expect(p[0].pauseMs).toBe(PAUSE_COMMA_MS);
    expect(p[2].pauseMs).toBe(PAUSE_SENTENCE_MS);
    expect(p[3].pauseMs).toBe(0);
    expect(PAUSE_COMMA_MS).toBeGreaterThanOrEqual(150);
    expect(PAUSE_SENTENCE_MS).toBeLessThanOrEqual(250);
  });

  it("gạch ngang có khoảng trắng là chỗ ngắt; câu rỗng ra rỗng", async () => {
    const { speechParts } = await import("@/lib/voice/tts");
    expect(speechParts("Đảo Lý Sơn – phía trước chừng 2 hải lý.").map((x) => x.text)).toEqual([
      "Đảo Lý Sơn",
      "phía trước chừng 2 hải lý.",
    ]);
    expect(speechParts("   ")).toEqual([]);
  });

  it("khoá tra không phân biệt hoa thường, khoảng trắng, dấu chấm cuối", async () => {
    const { clipFor } = await import("@/lib/voice/tts");
    expect(clipFor("bật tiếng lại")).toBe(`${catalog.dir}/bat_tieng.mp3`);
    expect(clipFor("  Bật  tiếng lại !")).toBe(`${catalog.dir}/bat_tieng.mp3`);
    expect(clipFor("Bật tiếng lại đi.")).toBeNull();
  });
});

describe("voiceRank — giọng nữ trước, mất sóng thì giọng trong máy", () => {
  it("HoaiMy/Linh/Google trên NamMinh/An; mất sóng giọng mạng xuống đáy", async () => {
    const { voiceRank } = await import("@/lib/voice/tts");
    const hoaiMy = { name: "Microsoft HoaiMy Online (Natural) - Vietnamese", localService: false };
    const namMinh = { name: "Microsoft NamMinh Online (Natural) - Vietnamese", localService: false };
    const an = { name: "Microsoft An - Vietnamese (Vietnam)", localService: true };
    const linh = { name: "Linh", localService: true };
    expect(voiceRank(hoaiMy, true)).toBeLessThan(voiceRank(namMinh, true));
    expect(voiceRank(hoaiMy, true)).toBeLessThan(voiceRank(an, true));
    expect(voiceRank(linh, true)).toBeLessThan(voiceRank(hoaiMy, true));
    // mất sóng: giọng nam CÀI TRONG MÁY vẫn hơn giọng nữ qua mạng (đọc được mới là chính)
    expect(voiceRank(an, false)).toBeLessThan(voiceRank(hoaiMy, false));
  });
});

/* ── PHÁT: mp3 + giọng máy nối nhau, có nghỉ, onEnd đúng một lần ──────────── */

type FakeUtter = { text: string; voice: { name: string } | null; rate: number; onstart?: () => void; onend?: () => void; onerror?: () => void };

function installSynth(voices: { lang: string; localService: boolean; name: string; voiceURI?: string }[], dead: string[] = []) {
  const log: string[] = [];
  const synth = {
    getVoices: () => voices,
    addEventListener: () => {},
    cancel: vi.fn(),
    speak: (u: FakeUtter) => {
      if (!u.text) return;
      if (u.voice && dead.includes(u.voice.name)) return; // giọng mạng chết: không bao giờ onstart
      log.push(`synth:${u.text}@${Date.now()}|${u.voice?.name}`);
      setTimeout(() => u.onstart?.(), 5);
      setTimeout(() => u.onend?.(), 100);
    },
  };
  class Utter {
    text: string;
    lang = "";
    voice: FakeUtter["voice"] = null;
    rate = 1;
    onstart?: () => void;
    onend?: () => void;
    onerror?: () => void;
    constructor(t: string) {
      this.text = t;
    }
  }
  Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
  (globalThis as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = Utter;
  return log;
}

function installAudio(log: string[], opts: { failFetch?: boolean } = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (opts.failFetch) throw new TypeError("offline");
      return { ok: true, status: 200, blob: async () => new Blob([url]), arrayBuffer: async () => new ArrayBuffer(1) };
    }),
  );
  URL.createObjectURL = vi.fn((b: Blob) => `blob:${(b as Blob & { size: number }).size}:${Math.random()}`);
  class FakeAudio {
    src = "";
    currentTime = 0;
    onended: (() => void) | null = null;
    onerror: (() => void) | null = null;
    play() {
      if (this.src.startsWith("data:")) return Promise.resolve();
      log.push(`clip@${Date.now()}`);
      setTimeout(() => this.onended?.(), 120);
      return Promise.resolve();
    }
    pause() {}
  }
  vi.stubGlobal("Audio", FakeAudio);
}

describe("ttsSpeak — ghép mp3 Sen Biển với giọng máy", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("câu động đọc giọng nữ từng đoạn có nghỉ, câu cố định phát mp3; onEnd đúng 1 lần", async () => {
    const log = installSynth([
      { lang: "vi-VN", localService: true, name: "Microsoft An - Vietnamese" },
      { lang: "vi-VN", localService: true, name: "Linh" },
    ]);
    installAudio(log);
    const tts = await import("@/lib/voice/tts");
    const onEnd = vi.fn();
    tts.ttsSpeak("Tới Sa Huỳnh: 8 hải lý, chừng 1 giờ. Nói đi để bắt đầu.", { onEnd });
    await vi.advanceTimersByTimeAsync(3000);
    expect(log.map((l) => l.replace(/@\d+/, ""))).toEqual([
      "synth:Tới Sa Huỳnh|Linh",
      "synth:8 hải lý|Linh",
      "synth:chừng 1 giờ.|Linh",
      "clip",
    ]);
    // nghỉ thật giữa hai đoạn: đoạn 1 xong ở +100 ms, đoạn 2 bắt đầu sau ≥ PAUSE_COMMA_MS
    const t = log.map((l) => Number(/@(\d+)/.exec(l)![1]));
    expect(t[1] - t[0]).toBeGreaterThanOrEqual(100 + tts.PAUSE_COMMA_MS);
    expect(t[3] - t[2]).toBeGreaterThanOrEqual(100 + tts.PAUSE_SENTENCE_MS);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("không tải được mp3 (máy chưa có trong kho, mất sóng): đọc câu đó bằng giọng máy", async () => {
    const log = installSynth([{ lang: "vi-VN", localService: true, name: "Linh" }]);
    installAudio(log, { failFetch: true });
    const tts = await import("@/lib/voice/tts");
    const onEnd = vi.fn();
    tts.ttsSpeak("Bật tiếng lại.", { onEnd });
    await vi.advanceTimersByTimeAsync(1000);
    expect(log.map((l) => l.replace(/@\d+/, ""))).toEqual(["synth:Bật tiếng lại.|Linh"]);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("máy KHÔNG có giọng Việt: câu cố định vẫn đọc bằng mp3, câu động im (không giọng lạ)", async () => {
    const log = installSynth([{ lang: "en-US", localService: true, name: "Samantha" }]);
    installAudio(log);
    const tts = await import("@/lib/voice/tts");
    const onEnd = vi.fn();
    tts.ttsSpeak("Còn 3 hải lý. Mất định vị.", { onEnd });
    await vi.advanceTimersByTimeAsync(3000);
    expect(log.map((l) => l.replace(/@\d+/, ""))).toEqual(["clip"]);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("giọng mạng không chịu phát (sóng yếu): đoạn đó đọc lại bằng giọng trong máy", async () => {
    const log = installSynth(
      [
        { lang: "vi-VN", localService: false, name: "Google tiếng Việt" },
        { lang: "vi-VN", localService: true, name: "Microsoft An - Vietnamese" },
      ],
      ["Google tiếng Việt"],
    );
    installAudio(log);
    const tts = await import("@/lib/voice/tts");
    const onEnd = vi.fn();
    tts.ttsSpeak("Còn 3 hải lý, chừng 20 phút.", { onEnd });
    await vi.advanceTimersByTimeAsync(5000);
    expect(log.map((l) => l.replace(/@\d+/, ""))).toEqual([
      "synth:Còn 3 hải lý|Microsoft An - Vietnamese",
      "synth:chừng 20 phút.|Microsoft An - Vietnamese",
    ]);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("huỷ giữa chừng: không đọc đoạn sau, onEnd đúng 1 lần", async () => {
    const log = installSynth([{ lang: "vi-VN", localService: true, name: "Linh" }]);
    installAudio(log);
    const tts = await import("@/lib/voice/tts");
    const onEnd = vi.fn();
    const cancel = tts.ttsSpeak("Còn 3 hải lý, chừng 20 phút, hướng bắc.", { onEnd });
    await vi.advanceTimersByTimeAsync(50);
    cancel();
    await vi.advanceTimersByTimeAsync(2000);
    expect(log).toHaveLength(1);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("ttsCancel giữa câu nhiều đoạn: dừng HẲN, không đọc tiếp đoạn sau", async () => {
    const log = installSynth([{ lang: "vi-VN", localService: true, name: "Linh" }]);
    installAudio(log);
    const tts = await import("@/lib/voice/tts");
    const onEnd = vi.fn();
    tts.ttsSpeak("Nhắc lại: còn 3 hải lý, chừng 20 phút. Máy chưa có hải đồ để canh.", { onEnd });
    await vi.advanceTimersByTimeAsync(50);
    tts.ttsCancel();
    await vi.advanceTimersByTimeAsync(5000);
    expect(log).toHaveLength(1);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("câu mới THAY câu cũ — không bao giờ hai câu chồng nhau", async () => {
    const log = installSynth([{ lang: "vi-VN", localService: true, name: "Linh" }]);
    installAudio(log);
    const tts = await import("@/lib/voice/tts");
    const end1 = vi.fn();
    const end2 = vi.fn();
    tts.ttsSpeak("Còn 3 hải lý, chừng 20 phút, hướng bắc.", { onEnd: end1 });
    await vi.advanceTimersByTimeAsync(50);
    tts.ttsSpeak("Đã dừng dẫn đường.", { onEnd: end2 });
    await vi.advanceTimersByTimeAsync(5000);
    expect(end1).toHaveBeenCalledTimes(1);
    expect(end2).toHaveBeenCalledTimes(1);
    expect(log.map((l) => l.replace(/@\d+/, ""))).toEqual(["synth:Còn 3 hải lý|Linh", "clip"]);
  });

  it("warmVoiceClips tải đủ mọi clip một lượt khi có sóng; đủ rồi thì phiên này thôi", async () => {
    installSynth([]);
    const log: string[] = [];
    installAudio(log);
    const tts = await import("@/lib/voice/tts");
    await tts.warmVoiceClips();
    expect((fetch as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(catalog.items.length);
    // lần mở bản đồ sau: không xin lại 63 clip
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, blob: async () => new Blob(["x"]) })));
    await tts.warmVoiceClips();
    expect((fetch as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(0);
  });

  it("đang phát một clip mà tải trước chạy cùng lúc: mỗi clip chỉ tải MỘT lần", async () => {
    installSynth([]);
    const log: string[] = [];
    installAudio(log);
    const tts = await import("@/lib/voice/tts");
    tts.ttsSpeak("Nói đi để bắt đầu.");
    await tts.warmVoiceClips();
    const urls = (fetch as unknown as { mock: { calls: [string][] } }).mock.calls.map((c) => c[0]);
    expect(urls).toHaveLength(catalog.items.length);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("warmVoiceClips dừng ở lỗi đầu, lần sau thử lại", async () => {
    installSynth([]);
    const log: string[] = [];
    installAudio(log);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 504 })));
    const tts = await import("@/lib/voice/tts");
    await tts.warmVoiceClips();
    expect((fetch as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(1);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, blob: async () => new Blob(["x"]) })));
    await tts.warmVoiceClips();
    expect((fetch as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(catalog.items.length);
  });
});
