// Chuông cảnh báo ranh giới biển — "logo âm thanh" SDVICO (bản v1 chốt 2026-08-26).
//
// Tái tạo ĐÚNG THIẾT KẾ v1 bằng Web Audio (không file asset): motif mở
// D5 → A5 → D6 (gốc → quãng 5 → quãng 8), đuôi gốc+quãng5 ngân cùng; âm sắc
// chuông ấm (bồi âm mềm, bồi cao tắt nhanh hơn); vào êm ~15ms.
//
// VÌ SAO KHÔNG DÙNG FILE .wav: cảnh báo ranh giới nổ lúc bà con ở gần biên,
// thường MẤT SÓNG. Tổng hợp tại chỗ → luôn kêu được offline, KHÔNG cần cache
// qua sw.js (khỏi đụng SHELL), KHÔNG thêm asset. Có thể đổi thiết kế sau bằng
// cách sửa NOTES/PARTIALS dưới đây.
//
// Nền/khoá màn (push có sound) là việc RIÊNG (Phase 2) — Web Audio chỉ kêu khi
// app đang mở. Ở đây làm phần "app đang mở, đang dẫn đường" trước.

const D5 = 587.33;
const A5 = 880.0;
const D6 = 1174.66;

/** [freq, start(s), gain 0..1, decay(s) tới gần im] */
const NOTES: ReadonlyArray<readonly [number, number, number, number]> = [
  [D5, 0.0, 1.0, 1.3],
  [A5, 0.22, 0.92, 1.3],
  [D6, 0.44, 0.85, 1.4],
  [D5, 0.72, 0.55, 1.8], // đuôi quãng-5 ngân
  [A5, 0.72, 0.45, 1.8],
];

/** Bồi âm chuông: [bội số tần, biên độ]. Bồi cao tắt nhanh hơn (xem decayFor). */
const PARTIALS: ReadonlyArray<readonly [number, number]> = [
  [1, 1.0],
  [2, 0.45],
  [3, 0.22],
  [2.76, 0.12], // hơi lệch → lấp lánh kiểu chuông
];

const ATTACK = 0.015;

/** Bồi cao tắt nhanh hơn bồi thấp (giữ "hồn" chuông). */
function decayFor(noteDecay: number, mult: number): number {
  return noteDecay / (1 + 0.6 * (mult - 1));
}

export interface WarningVoice {
  freq: number; // Hz
  startOffset: number; // s kể từ lúc phát
  attack: number; // s
  decay: number; // s tới gần im
  peakGain: number; // 0..1
}

/**
 * Bung motif × bồi âm thành danh sách "giọng" (thuần, không đụng trình duyệt —
 * để test được). Mỗi giọng = 1 oscillator + 1 envelope khi phát thật.
 */
export function warningVoices(): WarningVoice[] {
  const out: WarningVoice[] = [];
  for (const [freq, start, gain, decay] of NOTES) {
    for (const [mult, amp] of PARTIALS) {
      out.push({
        freq: freq * mult,
        startOffset: start,
        attack: ATTACK,
        decay: decayFor(decay, mult),
        peakGain: gain * amp,
      });
    }
  }
  return out;
}

// ── Phần Web Audio (chỉ chạy ở trình duyệt) ──────────────────────────────────

type AC = typeof AudioContext;
let ctx: AudioContext | null = null;
let unlockArmed = false;

function audioCtor(): AC | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: AC }).webkitAudioContext ||
    null
  );
}

function getCtx(): AudioContext | null {
  const Ctor = audioCtor();
  if (!Ctor) return null;
  if (!ctx) {
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  return ctx;
}

/**
 * Mở khoá AudioContext theo chính sách autoplay: trình duyệt bắt phải có thao
 * tác người dùng trước khi phát tiếng. Gắn 1 lần, tự gỡ sau lần chạm đầu. Bà
 * con luôn có chạm (mở app, bấm Dẫn đường…) trước khi cảnh báo nổ.
 */
export function armWarningSound(): void {
  if (unlockArmed || typeof window === "undefined") return;
  unlockArmed = true;
  const resume = () => {
    const c = getCtx();
    if (c && c.state === "suspended") c.resume().catch(() => {});
  };
  const opts = { passive: true } as const;
  for (const ev of ["pointerdown", "touchstart", "keydown"] as const) {
    window.addEventListener(ev, resume, opts);
  }
}

/** Mức GẤP (≤6 hl) lặp thêm lần 2 sau ngần này giây — cùng chuông, đọc ra "gần rồi". */
const URGENT_REPEAT_GAP = 0.9;

/** Lên lịch MỘT lượt chuông (mọi giọng) bắt đầu từ mốc t0 trên timeline ctx. */
function scheduleChime(c: AudioContext, dest: AudioNode, t0: number): void {
  for (const v of warningVoices()) {
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = v.freq;
    const g = c.createGain();
    const start = t0 + v.startOffset;
    const end = start + v.decay;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(Math.max(v.peakGain, 0.0002), start + v.attack);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(g);
    g.connect(dest);
    osc.start(start);
    osc.stop(end + 0.05);
  }
}

/**
 * Phát chuông cảnh báo ranh giới. `urgent` (≤6 hải lý, level "very_near") = CÙNG
 * chuông SDVICO nhưng **lặp 2 lần + nhỉnh to hơn** → đọc ra "sắp vượt biên" mà
 * vẫn KHÔNG thành còi hú; mức êm (>6 hl) chỉ 1 lượt. Nuốt MỌI lỗi (thiếu Web
 * Audio, ngữ cảnh bị chặn…) — cảnh báo HÌNH vẫn là đường chính, tiếng chỉ là
 * phần thêm; không bao giờ để tiếng làm treo / ném lỗi ra màn giữa biển.
 */
export function playBorderWarning(opts?: { urgent?: boolean }): void {
  const c = getCtx();
  if (!c) return;
  try {
    if (c.state === "suspended") c.resume().catch(() => {});
    const urgent = opts?.urgent ?? false;

    // limiter chống méo khi các giọng (và 2 lượt lúc gấp) chồng lên nhau
    const master = c.createGain();
    master.gain.value = urgent ? 0.72 : 0.6;
    const limiter = c.createDynamicsCompressor();
    master.connect(limiter);
    limiter.connect(c.destination);

    const base = c.currentTime + 0.02;
    scheduleChime(c, master, base);
    if (urgent) scheduleChime(c, master, base + URGENT_REPEAT_GAP);
  } catch {
    /* offline / audio bị chặn → im lặng, KHÔNG throw */
  }
}
