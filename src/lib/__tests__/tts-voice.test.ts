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
    // câu cố định = MỘT mp3 nguyên câu (không phải ghép mảnh /m/)
    const miss = speechParts(text).filter((p) => p.clips?.length !== 1 || p.clips[0].includes("/m/"));
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
    // câu động: số đọc bằng chữ, mỗi đoạn ghép bằng mảnh mp3 (doc 15 §21)
    const p = speechParts("Tới Sa Huỳnh: 2,5 hải lý, chừng 1 giờ. Nói đi để bắt đầu.");
    expect(p.map((x) => x.text)).toEqual(["Tới Sa Huỳnh", "hai phẩy năm hải lý", "chừng một giờ", "Nói đi để bắt đầu."]);
    // mọi đoạn đều mp3; số mảnh mỗi đoạn tuỳ mảnh GỘP học từ kịch bản (ít chỗ nối hơn = tốt)
    expect(p.every((x) => x.clips && x.clips.length >= 1 && x.clips.length <= x.text.split(" ").length)).toBe(true);
    expect(p[3].clips).toHaveLength(1);
    expect(p[0].clips![1]).toMatch(/\/m\/sa_huynh\.mp3$/);
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
      "phía trước chừng hai hải lý",
    ]);
    expect(speechParts("   ")).toEqual([]);
  });

  it("tên ngoài danh mục: CHỈ khúc tên đọc giọng máy, nối liền (không nghỉ) với mảnh hai bên", async () => {
    const { speechParts, PAUSE_COMMA_MS } = await import("@/lib/voice/tts");
    const p = speechParts("Rạn có tên gần nhất là Xyz Qwe, 3 hải lý.");
    expect(p.map((x) => [x.text, x.clips ? "mp3" : "máy", x.pauseMs])).toEqual([
      ["Rạn có tên gần nhất là", "mp3", 0],
      ["Xyz Qwe", "máy", PAUSE_COMMA_MS],
      ["ba hải lý", "mp3", 0],
    ]);
    // cả đoạn không mảnh nào ⇒ giọng máy đọc CHỮ GỐC
    expect(speechParts("Qwe Asd Xyz.")).toEqual([{ text: "Qwe Asd Xyz.", clips: null, pauseMs: 0 }]);
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

  it("câu có số + tên trong danh mục: TRỌN giọng Sen Biển (mảnh ghép), không câu nào giọng máy", async () => {
    const log = installSynth([{ lang: "vi-VN", localService: true, name: "Linh" }]);
    installAudio(log);
    const tts = await import("@/lib/voice/tts");
    const onEnd = vi.fn();
    tts.ttsSpeak("Tới Sa Huỳnh: 8 hải lý, chừng 1 giờ. Nói đi để bắt đầu.", { onEnd });
    await vi.advanceTimersByTimeAsync(5000);
    // không Web Audio (jsdom) ⇒ thẻ <audio> từng mảnh (số mảnh tuỳ mảnh gộp) + câu nguyên cuối
    expect(log.length).toBeGreaterThanOrEqual(5);
    expect(log.every((l) => l.startsWith("clip@"))).toBe(true);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("đoạn không có mảnh đọc giọng nữ từng đoạn có nghỉ, câu cố định phát mp3; onEnd đúng 1 lần", async () => {
    const log = installSynth([
      { lang: "vi-VN", localService: true, name: "Microsoft An - Vietnamese" },
      { lang: "vi-VN", localService: true, name: "Linh" },
    ]);
    installAudio(log);
    const tts = await import("@/lib/voice/tts");
    const onEnd = vi.fn();
    tts.ttsSpeak("Qwe Xyz: Asd Zxc, Rty Uio. Nói đi để bắt đầu.", { onEnd });
    await vi.advanceTimersByTimeAsync(3000);
    expect(log.map((l) => l.replace(/@\d+/, ""))).toEqual([
      "synth:Qwe Xyz|Linh",
      "synth:Asd Zxc|Linh",
      "synth:Rty Uio.|Linh",
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
    tts.ttsSpeak("Qwe Xyz. Mất định vị.", { onEnd });
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
    tts.ttsSpeak("Qwe Xyz, Asd Zxc.", { onEnd });
    await vi.advanceTimersByTimeAsync(5000);
    expect(log.map((l) => l.replace(/@\d+/, ""))).toEqual([
      "synth:Qwe Xyz|Microsoft An - Vietnamese",
      "synth:Asd Zxc.|Microsoft An - Vietnamese",
    ]);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("huỷ giữa chừng: không đọc đoạn sau, onEnd đúng 1 lần", async () => {
    const log = installSynth([{ lang: "vi-VN", localService: true, name: "Linh" }]);
    installAudio(log);
    const tts = await import("@/lib/voice/tts");
    const onEnd = vi.fn();
    const cancel = tts.ttsSpeak("Qwe Xyz, Asd Zxc, Rty Uio.", { onEnd });
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
    tts.ttsSpeak("Qwe Xyz: Asd Zxc, Rty Uio. Máy chưa có hải đồ để canh.", { onEnd });
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
    tts.ttsSpeak("Qwe Xyz, Asd Zxc, Rty Uio.", { onEnd: end1 });
    await vi.advanceTimersByTimeAsync(50);
    tts.ttsSpeak("Đã dừng dẫn đường.", { onEnd: end2 });
    await vi.advanceTimersByTimeAsync(5000);
    expect(end1).toHaveBeenCalledTimes(1);
    expect(end2).toHaveBeenCalledTimes(1);
    expect(log.map((l) => l.replace(/@\d+/, ""))).toEqual(["synth:Qwe Xyz|Linh", "clip"]);
  });

  it("warmVoiceClips tải đủ mọi clip một lượt khi có sóng, dừng ở lỗi đầu", async () => {
    installSynth([]);
    const log: string[] = [];
    installAudio(log);
    const tts = await import("@/lib/voice/tts");
    await tts.warmVoiceClips();
    // câu nguyên trước, rồi mọi mảnh ghép
    const urls = tts.allClipUrls();
    expect(urls.length).toBeGreaterThan(catalog.items.length + 2000);
    expect(urls.slice(0, catalog.items.length).every((u) => !u.includes("/m/"))).toBe(true);
    const goi = () => (fetch as unknown as { mock: { calls: [string][] } }).mock.calls.map((c) => c[0]);
    // lõi trước (trả về ngay khi xong), tên rạn hẹn 2 phút sau — không chặn bộ nghe
    const loi = goi().length;
    expect(loi).toBeGreaterThan(catalog.items.length + 500);
    expect(loi).toBeLessThan(urls.length);
    await vi.advanceTimersByTimeAsync(130_000);
    expect(new Set(goi())).toEqual(new Set(urls));
    // lỗi đầu ⇒ dừng (mỗi luồng song song dừng sau lượt đang bay)
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 504 })));
    await tts.warmVoiceClips();
    expect(goi().length).toBeLessThanOrEqual(4);
  });

  it("Web Audio: mảnh xếp lịch NỐI ĐUÔI (chồng mép 12 ms), huỷ là dừng mọi mảnh đã xếp", async () => {
    installSynth([{ lang: "vi-VN", localService: true, name: "Linh" }]);
    const log: string[] = [];
    installAudio(log);
    const starts: number[] = [];
    const stops = vi.fn();
    class FakeCtx {
      state = "running";
      currentTime = 0;
      destination = {};
      resume = async () => {};
      decodeAudioData = async () => ({ duration: 0.5 });
      createGain = () => ({ connect() {}, gain: { setValueAtTime() {}, linearRampToValueAtTime() {} } });
      createBufferSource = () => {
        const s = {
          buffer: null as unknown,
          onended: null as null | (() => void),
          connect() {},
          start(t: number) {
            starts.push(t);
            setTimeout(() => s.onended?.(), (t + 0.5) * 1000);
          },
          stop: stops,
        };
        return s;
      };
    }
    vi.stubGlobal("AudioContext", FakeCtx);
    const tts = await import("@/lib/voice/tts");
    const onEnd = vi.fn();
    tts.ttsSpeak("Còn chừng 3 hải lý tới ranh giới.", { onEnd });
    await vi.advanceTimersByTimeAsync(5000);
    expect(log).toEqual([]); // không qua thẻ <audio>
    expect(starts.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < starts.length; i++) expect(starts[i] - starts[i - 1]).toBeCloseTo(0.5 - 0.012, 5);
    expect(onEnd).toHaveBeenCalledTimes(1);

    starts.length = 0;
    const end2 = vi.fn();
    tts.ttsSpeak("Còn chừng 3 hải lý tới ranh giới.", { onEnd: end2 });
    await vi.advanceTimersByTimeAsync(10);
    tts.ttsCancel();
    await vi.advanceTimersByTimeAsync(5000);
    expect(stops).toHaveBeenCalledTimes(starts.length);
    expect(end2).toHaveBeenCalledTimes(1);
  });
});
