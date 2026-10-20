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

describe("NHỊP theo loại câu (lượt nói nhanh hơn 2026-10-16) — hằng số khoá", () => {
  it("nghỉ dấu phẩy 120 ms, giữa câu 180 ms; đáp ngắn 1,12, cảnh báo 1,0", async () => {
    const t = await import("@/lib/voice/tts");
    expect(t.PAUSE_COMMA_MS).toBe(120);
    expect(t.PAUSE_SENTENCE_MS).toBe(180);
    expect(t.TTS_RATE).toBe(1);
    expect(t.TTS_RATE_SHORT).toBe(1.12);
  });

  it("speechRate: câu ĐÁP ngắn nhanh; cảnh báo và câu đáp dài (kèm cảnh báo) giữ nhịp thường", async () => {
    const { speechRate, TTS_RATE, TTS_RATE_SHORT } = await import("@/lib/voice/tts");
    for (const t of ["Dạ, chưa chạy. Đường vẫn để trên bản đồ.", "Bắt đầu dẫn đường. Sen Biển canh và đọc cảnh báo.", "Còn 12 hải lý, chừng 1 giờ 30 phút."])
      expect(speechRate({ reply: true }, t), t).toBe(TTS_RATE_SHORT);
    // tóm tắt đường có kèm cảnh báo thiếu dự báo — dài, phải rõ
    expect(
      speechRate(
        { reply: true },
        "Tới Sa Huỳnh: 14 hải lý, chừng 2 giờ. Đường này chưa có dự báo sóng gió, máy chỉ né bờ và bãi cạn. Bà con nghe đài trước khi chạy. Nói đi để bắt đầu.",
      ),
    ).toBe(TTS_RATE);
    // cảnh báo đỏ/vàng, bản tin: không phải câu đáp
    expect(speechRate({}, "Xác tàu phía trước chừng 400 mét.")).toBe(TTS_RATE);
    expect(speechRate({ reply: false }, "Còn 3 hải lý.")).toBe(TTS_RATE);
  });

  it("mp3: câu ĐÁP ngắn đánh dấu nhanh, câu cảnh báo / độ sâu / định vị / bão KHÔNG", () => {
    const nhanh = new Set(catalog.items.filter((i) => (i as { nhanh?: boolean }).nhanh).map((i) => i.id));
    for (const id of ["bat_dau_dan", "da_chua_chay", "noi_di", "dung_dan", "chua_nghe_ro", "cham_chon_dung"]) expect(nhanh.has(id), id).toBe(true);
    for (const id of ["song_gio_lon", "rat_can", "di_tren_ran", "mat_dinh_vi", "bao_qua_gan", "hai_do_chua_co", "thu_giong_1"]) expect(nhanh.has(id), id).toBe(false);
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
  });

  it("gạch ngang có khoảng trắng là chỗ ngắt; câu rỗng ra rỗng", async () => {
    const { speechParts } = await import("@/lib/voice/tts");
    expect(speechParts("Đảo Lý Sơn – phía trước chừng 2 hải lý.").map((x) => x.text)).toEqual([
      "Đảo Lý Sơn",
      "phía trước chừng hai hải lý",
    ]);
    expect(speechParts("   ")).toEqual([]);
  });

  /*  MỘT CÂU MỘT GIỌNG (anh Long 2026-10-20: "sao giọng đọc lúc nam lúc nữ thế"):
      trước đây khúc tên ngoài danh mục đọc giọng máy XEN GIỮA mảnh mp3 Mỹ Duyên ⇒
      nữ–nam–nữ trong một câu. Nay câu thiếu dù một mảnh ⇒ CẢ CÂU giọng máy. */
  it("tên ngoài danh mục: câu thiếu một mảnh ⇒ CẢ CÂU giọng máy, không nửa mp3 nửa máy", async () => {
    const { speechParts } = await import("@/lib/voice/tts");
    const p = speechParts("Rạn có tên gần nhất là Xyz Qwe, 3 hải lý.");
    expect(p.map((x) => [x.text, x.clips ? "mp3" : "máy", x.pauseMs])).toEqual([
      ["Rạn có tên gần nhất là Xyz Qwe, 3 hải lý.", "máy", 0],
    ]);
    // câu phủ đủ mảnh thì vẫn trọn mp3 (không đọc giọng máy khúc nào)
    expect(speechParts("Còn 3 hải lý.").every((x) => x.clips)).toBe(true);
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

let rates: number[] = [];
type FakeUtter = { text: string; voice: { name: string } | null; rate: number; onstart?: () => void; onend?: () => void; onerror?: () => void };

function installSynth(
  voices: { lang: string; localService: boolean; name: string; voiceURI?: string }[],
  dead: string[] = [],
  startMs = 5,
) {
  const log: string[] = [];
  rates = [];
  const synth = {
    getVoices: () => voices,
    addEventListener: () => {},
    cancel: vi.fn(),
    speak: (u: FakeUtter) => {
      if (!u.text) return;
      if (u.voice && dead.includes(u.voice.name)) return; // giọng mạng chết: không bao giờ onstart
      log.push(`synth:${u.text}@${Date.now()}|${u.voice?.name}`);
      rates.push(u.rate);
      setTimeout(() => u.onstart?.(), startMs);
      setTimeout(() => u.onend?.(), startMs + 95);
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

  it("câu không có mảnh đọc MỘT lượt giọng máy (nữ), câu cố định phát mp3, có nghỉ giữa câu; onEnd đúng 1 lần", async () => {
    const log = installSynth([
      { lang: "vi-VN", localService: true, name: "Microsoft An - Vietnamese" },
      { lang: "vi-VN", localService: true, name: "Linh" },
    ]);
    installAudio(log);
    const tts = await import("@/lib/voice/tts");
    const onEnd = vi.fn();
    tts.ttsSpeak("Qwe Xyz: Asd Zxc, Rty Uio. Nói đi để bắt đầu.", { onEnd });
    await vi.advanceTimersByTimeAsync(3000);
    expect(log.map((l) => l.replace(/@\d+/, ""))).toEqual(["synth:Qwe Xyz: Asd Zxc, Rty Uio.|Linh", "clip"]);
    // nghỉ thật giữa hai câu: câu 1 xong ở +100 ms, câu 2 bắt đầu sau ≥ PAUSE_SENTENCE_MS
    const t = log.map((l) => Number(/@(\d+)/.exec(l)![1]));
    expect(t[1] - t[0]).toBeGreaterThanOrEqual(100 + tts.PAUSE_SENTENCE_MS);
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

  it("giọng mạng không chịu phát (sóng yếu): câu đó đọc lại bằng giọng trong máy", async () => {
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
    expect(log.map((l) => l.replace(/@\d+/, ""))).toEqual(["synth:Qwe Xyz, Asd Zxc.|Microsoft An - Vietnamese"]);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  /*  LỖI 2026-10-18 (Chrome Android, bà con Bình Định: "để 1 lát lâu thì nó báo tắt
      tiếng"): giọng Việt DUY NHẤT khởi động chậm một lần là bị loại vĩnh viễn ⇒ im cả chế độ. */
  it("chỉ MỘT giọng Việt khởi động chậm 2 s: vẫn đọc, KHÔNG bị loại, ttsCheck vẫn có giọng máy", async () => {
    const log = installSynth([{ lang: "vi-VN", localService: false, name: "Google tiếng Việt" }], [], 2000);
    installAudio(log);
    const tts = await import("@/lib/voice/tts");
    tts.ttsSpeak("Qwe Xyz.");
    await vi.advanceTimersByTimeAsync(5000);
    tts.ttsSpeak("Asd Zxc.");
    await vi.advanceTimersByTimeAsync(5000);
    expect(log.map((l) => l.replace(/@\d+/, ""))).toEqual(["synth:Qwe Xyz.|Google tiếng Việt", "synth:Asd Zxc.|Google tiếng Việt"]);
    const p = tts.ttsCheck();
    await vi.advanceTimersByTimeAsync(2000);
    expect(await p).toMatchObject({ ok: true, giongMay: true });
  });

  it("giọng Việt duy nhất không chịu phát: KHÔNG gác — lần sau vẫn thử, không thành 'máy chưa có giọng'", async () => {
    const dead = ["Google tiếng Việt"];
    const log = installSynth([{ lang: "vi-VN", localService: false, name: "Google tiếng Việt" }], dead);
    installAudio(log);
    const tts = await import("@/lib/voice/tts");
    tts.ttsSpeak("Qwe Xyz.");
    await vi.advanceTimersByTimeAsync(6000);
    expect(log).toHaveLength(0);
    dead.length = 0; // sóng về
    tts.ttsSpeak("Asd Zxc.");
    await vi.advanceTimersByTimeAsync(2000);
    expect(log.map((l) => l.replace(/@\d+/, ""))).toEqual(["synth:Asd Zxc.|Google tiếng Việt"]);
  });

  /*  GHIM GIỌNG CẢ PHIÊN (anh Long 2026-10-20: "giọng lúc nam lúc nữ"): trước đây hết
      hạn gác là quay lại giọng mạng ⇒ nam rồi nữ rồi nam theo sóng chập chờn. Nay giọng
      đã rơi xuống thì GIỮ — một phiên một giọng. */
  it("giọng mạng chết ⇒ rơi xuống giọng trong máy rồi GHIM cả phiên, không quay lại khi hết hạn gác", async () => {
    const dead = ["Google tiếng Việt"];
    const log = installSynth(
      [
        { lang: "vi-VN", localService: false, name: "Google tiếng Việt" },
        { lang: "vi-VN", localService: true, name: "Microsoft An - Vietnamese" },
      ],
      dead,
    );
    installAudio(log);
    const tts = await import("@/lib/voice/tts");
    tts.ttsSpeak("Qwe Xyz.");
    await vi.advanceTimersByTimeAsync(5000);
    dead.length = 0;
    tts.ttsSpeak("Asd Zxc.");
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(tts.BAD_VOICE_MS);
    tts.ttsSpeak("Rty Uio.");
    await vi.advanceTimersByTimeAsync(2000);
    expect(log.map((l) => l.replace(/@\d+/, ""))).toEqual([
      "synth:Qwe Xyz.|Microsoft An - Vietnamese",
      "synth:Asd Zxc.|Microsoft An - Vietnamese",
      "synth:Rty Uio.|Microsoft An - Vietnamese",
    ]);
  });

  it("ttsCheck: không giọng máy nhưng phát được mp3 ⇒ đọc được (ok), giongMay false; không cả hai ⇒ không", async () => {
    installSynth([{ lang: "en-US", localService: true, name: "Samantha" }]);
    installAudio([]);
    let tts = await import("@/lib/voice/tts");
    let p = tts.ttsCheck();
    await vi.advanceTimersByTimeAsync(2000);
    expect(await p).toMatchObject({ ok: true, giongMay: false });
    vi.resetModules();
    vi.stubGlobal("Audio", undefined);
    tts = await import("@/lib/voice/tts");
    p = tts.ttsCheck();
    await vi.advanceTimersByTimeAsync(2000);
    expect(await p).toMatchObject({ ok: false, giongMay: false });
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

  it("onEnd báo completed: đọc hết ⇒ true, bị huỷ / câu mới thay ⇒ false", async () => {
    installSynth([{ lang: "vi-VN", localService: true, name: "Linh" }]);
    installAudio([]);
    const tts = await import("@/lib/voice/tts");
    const a = vi.fn();
    tts.ttsSpeak("Còn 3 hải lý, chừng 20 phút.", { onEnd: a });
    await vi.advanceTimersByTimeAsync(2000);
    expect(a).toHaveBeenCalledWith(true);
    const b = vi.fn();
    const c = vi.fn();
    tts.ttsSpeak("Còn 3 hải lý, chừng 20 phút.", { onEnd: b });
    await vi.advanceTimersByTimeAsync(50);
    tts.ttsSpeak("Còn 2 hải lý.", { onEnd: c });
    await vi.advanceTimersByTimeAsync(2000);
    expect(b).toHaveBeenCalledWith(false);
    expect(c).toHaveBeenCalledWith(true);
    const d = vi.fn();
    tts.ttsSpeak("Còn 3 hải lý, chừng 20 phút.", { onEnd: d });
    await vi.advanceTimersByTimeAsync(50);
    tts.ttsCancel();
    expect(d).toHaveBeenCalledWith(false);
  });

  it("rate truyền xuống giọng máy (câu không mảnh = một lượt đọc)", async () => {
    installSynth([{ lang: "vi-VN", localService: true, name: "Linh" }]);
    installAudio([]);
    const tts = await import("@/lib/voice/tts");
    // câu KHÔNG có mảnh mp3 (câu có mảnh đi trọn mp3 Mỹ Duyên — không qua giọng máy)
    tts.ttsSpeak("Qwe Xyz, Asd Zxc.", { rate: tts.TTS_RATE_SHORT });
    await vi.advanceTimersByTimeAsync(2000);
    expect(rates).toEqual([1.12]);
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
    expect(log.map((l) => l.replace(/@\d+/, ""))).toEqual(["synth:Qwe Xyz, Asd Zxc, Rty Uio.|Linh", "clip"]);
  });

  it("warmVoiceClips tải đủ mọi clip một lượt khi có sóng; đủ rồi thì phiên này thôi", async () => {
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
    // lần mở bản đồ sau trong phiên: không xin lại (rà soát prod 2026-10-16)
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(1) })));
    await tts.warmVoiceClips();
    expect(goi()).toHaveLength(0);
  });

  it("warmVoiceClips dừng ở lỗi đầu, lần sau thử lại", async () => {
    installSynth([]);
    const log: string[] = [];
    installAudio(log);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 504 })));
    const tts = await import("@/lib/voice/tts");
    await tts.warmVoiceClips();
    const goi = () => (fetch as unknown as { mock: { calls: [string][] } }).mock.calls.map((c) => c[0]);
    // lỗi đầu ⇒ dừng (mỗi luồng song song dừng sau lượt đang bay)
    expect(goi().length).toBeLessThanOrEqual(4);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(1) })));
    await tts.warmVoiceClips();
    expect(goi().length).toBeGreaterThan(catalog.items.length);
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
