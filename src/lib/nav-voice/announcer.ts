// CHẾ ĐỘ ĐANG CHẠY — BỘ PHÁT NGÔN (thuần, không DOM, không âm thanh).
//
// Một cửa duy nhất quyết định câu nào được ĐỌC TO, lúc nào, câu nào bị nuốt.
// Mọi nguồn (hải đồ/độ sâu, ranh giới, bão, sóng gió, lệch tuyến, GPS, phao,
// bản tin) đổ `VoiceEvent` vào đây; hook `use-nav-voice` chỉ việc phát.
// Luật lấy từ doc 15 §6 + pattern VietMap/OsmAnd/IMO BAM (§7b):
//
//  1. MỘT câu một lúc. Câu ĐỎ tới khi đang đọc câu không-đỏ ⇒ cắt ngang.
//     Đỏ không cắt đỏ.
//  2. HẢI ĐỒ TRƯỚC HẾT (chủ dự án 2026-10-13: "lưới độ sâu, rạn, hải đồ là
//     quan trọng nhất"): câu `chart` xếp trên mọi câu cùng mức, và KHÔNG chế
//     độ nào ngoài "tắt hẳn" chặn được CẢNH BÁO hải đồ (đỏ/vàng) — kể cả "ít
//     nói", "im 30 phút". Câu tin hải đồ (phao, đèn) theo mức nói.
//  3. Mỗi `key` đọc MỘT lần (nhớ 30 phút). Mốc mới của cùng vật = key mới.
//  4. Câu không-đỏ cách câu trước ≥ 8 giây (tai nghỉ — NHTSA "constant audio").
//  5. Hàng chờ ≤ 2 (đỏ không bao giờ bị đẩy ra; tràn thì bỏ câu thấp nhất —
//     tin hải đồ xếp trên tin thường); câu mới cùng nhóm thay câu cũ đang chờ;
//     câu chờ quá 20 giây KHI LOA RẢNH là chuyện cũ (khoảng cách đã khác) ⇒ bỏ.
//  6. Đỏ CÒN HIỆU LỰC (`persist`: ranh giới ≤6 hl, bão gần) chưa chạm
//     "Đã nghe" ⇒ nhắc lại sau 30 giây, tối đa 2 lần (BAM 7.3.5).
//  7. Bị chặn bởi chế độ vẫn ĐÁNH DẤU đã nói: bật lại giọng không xả cả
//     đống câu cũ.

export type VoiceTier = "do" | "vang" | "bantin" | "tin";
export type VoiceMode = "day-du" | "it" | "tat";

export type VoiceEvent = {
  /** đọc một lần cho mỗi key */
  key: string;
  /** cùng một "vật" — key mới cùng group thay câu cũ đang chờ */
  group: string;
  tier: VoiceTier;
  text: string;
  /** cảnh báo HẢI ĐỒ: độ sâu, rạn, bờ/đảo, xác tàu, giàn khoan, chướng ngại, vùng cấm */
  chart?: boolean;
  /** đỏ còn hiệu lực — được nhắc lại khi chưa "Đã nghe" */
  persist?: boolean;
  /** thứ tự trong cùng mức, nhỏ = trước */
  rank?: number;
  /**
   * TRẢ LỜI Sen Biển (bà con vừa hỏi/ra lệnh bằng giọng) — một giọng chung với
   * cảnh báo (2026-10-16): đứng ngay SAU câu đỏ, không chờ nhịp 8 giây, không
   * chuông, chế độ nào cũng đọc (người ta đang hỏi). Đỏ tới vẫn cắt ngang.
   */
  reply?: boolean;
};

export type Utterance = VoiceEvent & { queuedMs: number; repeat: number };

export type AnnouncerState = {
  said: Record<string, number>;
  repeats: Record<string, { lastMs: number; n: number }>;
  acked: Record<string, true>;
  queue: Utterance[];
  current: Utterance | null;
  lastEndMs: number;
  /** lần gần nhất BẮT ĐẦU đọc câu đỏ/vàng — điểm tin nhường nếu < 5 phút */
  lastAlarmMs: number;
  lastRed: { text: string; atMs: number } | null;
  mutedUntil: number;
};

export type AnnounceResult = {
  state: AnnouncerState;
  /** câu cần đọc NGAY (null = không đọc gì lúc này) */
  start: Utterance | null;
  /** phải cắt câu đang đọc trước khi đọc `start` */
  interrupt: boolean;
  /** còn câu chờ nhưng phải đợi ngần này ms (nhịp 8 giây) */
  waitMs: number | null;
};

export const VOICE_GAP_MS = 8_000;
export const VOICE_STALE_MS = 20_000;
export const VOICE_QUEUE_MAX = 2;
export const VOICE_REPEAT_MS = 30_000;
export const VOICE_REPEAT_MAX = 2;
export const VOICE_FORGET_MS = 30 * 60_000;
export const VOICE_MUTE_MS = 30 * 60_000;

export function initAnnouncer(): AnnouncerState {
  return {
    said: {},
    repeats: {},
    acked: {},
    queue: [],
    current: null,
    lastEndMs: -Infinity,
    lastAlarmMs: -Infinity,
    lastRed: null,
    mutedUntil: -Infinity,
  };
}

/** Độ ưu tiên: nhỏ = trước. Hải đồ đứng trên cùng mức của nó. */
export function priority(u: Pick<VoiceEvent, "tier" | "chart" | "reply">): number {
  if (u.reply && u.tier !== "do") return 1.5;
  switch (u.tier) {
    case "do":
      return u.chart ? 0 : 1;
    case "vang":
      return u.chart ? 2 : 3;
    case "bantin":
      return 4;
    default:
      return u.chart ? 5 : 6;
  }
}

function sortQueue(q: Utterance[]): Utterance[] {
  return [...q].sort(
    (a, b) =>
      priority(a) - priority(b) ||
      (a.rank ?? 5) - (b.rank ?? 5) ||
      a.queuedMs - b.queuedMs,
  );
}

/** Chế độ có cho câu này ra loa không. */
export function allowed(ev: VoiceEvent, mode: VoiceMode, muted: boolean): boolean {
  if (ev.reply) return true;
  if (mode === "tat") return false;
  // CẢNH BÁO hải đồ (đỏ/vàng): không chế độ nào ngoài "tắt" chặn. Câu TIN hải
  // đồ (phao, đèn, vùng nước sâu) thì theo mức nói như mọi câu tin.
  if (ev.chart && ev.tier !== "tin") return true;
  if (muted) return ev.tier === "do";
  if (mode === "it") return ev.tier !== "tin";
  return true;
}

function clone(s: AnnouncerState): AnnouncerState {
  return {
    ...s,
    said: { ...s.said },
    repeats: { ...s.repeats },
    acked: { ...s.acked },
    queue: [...s.queue],
  };
}

/** Đổ sự kiện mới vào; trả câu cần đọc ngay (nếu có). `prev` không bị sửa. */
export function announce(
  prev: AnnouncerState,
  events: readonly VoiceEvent[],
  nowMs: number,
  mode: VoiceMode,
): AnnounceResult {
  const s = clone(prev);
  const muted = nowMs < s.mutedUntil;

  for (const k of Object.keys(s.said)) {
    if (nowMs - s.said[k] > VOICE_FORGET_MS) delete s.said[k];
  }
  // Câu chỉ GIÀ khi loa RẢNH: đứng chờ sau một bản tin 25 giây không làm câu
  // vùng nước thành chuyện cũ. Bản tin mở đầu không bao giờ "cũ".
  s.queue = s.queue.filter((u) => {
    if (!allowed(u, mode, muted)) return false;
    if (u.tier === "bantin" || s.current) return true;
    return nowMs - Math.max(u.queuedMs, s.lastEndMs) <= VOICE_STALE_MS;
  });

  let enqueuedRed = false;
  let enqueuedReply = false;
  for (const ev of events) {
    if (!ev || !ev.key || !ev.text) continue;
    const busy = (g: string) =>
      s.current?.group === g || s.queue.some((u) => u.group === g);
    if (s.said[ev.key] != null) {
      // NHẮC LẠI đỏ còn hiệu lực, chưa "Đã nghe"
      if (ev.persist && ev.tier === "do" && !s.acked[ev.group] && !busy(ev.group)) {
        const r = s.repeats[ev.group] ?? { lastMs: s.said[ev.key], n: 0 };
        if (r.n < VOICE_REPEAT_MAX && nowMs - r.lastMs >= VOICE_REPEAT_MS) {
          s.repeats[ev.group] = { lastMs: nowMs, n: r.n + 1 };
          if (allowed(ev, mode, muted)) {
            s.queue.push({ ...ev, queuedMs: nowMs, repeat: r.n + 1 });
            enqueuedRed = true;
          }
        }
      }
      continue;
    }
    s.said[ev.key] = nowMs;
    // mốc mới của cùng vật: quên lượt nhắc + "Đã nghe" của mốc cũ, bỏ câu cũ đang chờ
    s.repeats[ev.group] = { lastMs: nowMs, n: 0 };
    delete s.acked[ev.group];
    s.queue = s.queue.filter((u) => u.group !== ev.group);
    if (!allowed(ev, mode, muted)) continue;
    s.queue.push({ ...ev, queuedMs: nowMs, repeat: 0 });
    if (ev.tier === "do") enqueuedRed = true;
    if (ev.reply) enqueuedReply = true;
  }

  s.queue = sortQueue(s.queue);
  // trần hàng chờ — đỏ không bao giờ bị đẩy ra
  while (s.queue.length > VOICE_QUEUE_MAX) {
    let drop = -1;
    for (let i = s.queue.length - 1; i >= 0; i--) {
      if (s.queue[i].tier !== "do") {
        drop = i;
        break;
      }
    }
    if (drop < 0) break;
    s.queue.splice(drop, 1);
  }

  const head = s.queue[0];
  if (
    enqueuedRed &&
    s.current &&
    head &&
    head.tier === "do" &&
    s.current.tier !== "do"
  ) {
    s.queue.shift();
    return { state: started(s, head, nowMs), start: head, interrupt: true, waitMs: null };
  }
  // trả lời Sen Biển cắt câu TIN / bản tin đang đọc (bà con đang chờ nghe đáp),
  // KHÔNG cắt cảnh báo đỏ/vàng
  if (
    enqueuedReply &&
    s.current &&
    head?.reply &&
    (s.current.tier === "tin" || s.current.tier === "bantin")
  ) {
    s.queue.shift();
    return { state: started(s, head, nowMs), start: head, interrupt: true, waitMs: null };
  }
  return pump(s, nowMs);
}

function started(s: AnnouncerState, u: Utterance, nowMs: number): AnnouncerState {
  s.current = u;
  if (u.tier === "do" || u.tier === "vang") s.lastAlarmMs = nowMs;
  if (u.tier === "do") s.lastRed = { text: u.text, atMs: nowMs };
  return s;
}

/** Không có câu đang đọc ⇒ lấy câu đầu hàng (tôn trọng nhịp 8 giây). */
export function pump(prev: AnnouncerState, nowMs: number): AnnounceResult {
  const s = prev.current ? prev : { ...prev, queue: [...prev.queue] };
  if (s.current || s.queue.length === 0) {
    return { state: s, start: null, interrupt: false, waitMs: null };
  }
  const head = s.queue[0];
  const since = nowMs - s.lastEndMs;
  if (head.tier !== "do" && !head.reply && since < VOICE_GAP_MS) {
    return { state: s, start: null, interrupt: false, waitMs: VOICE_GAP_MS - since };
  }
  s.queue.shift();
  return { state: started(s, head, nowMs), start: head, interrupt: false, waitMs: null };
}

/** Câu đang đọc đã xong (hoặc máy không đọc được) ⇒ sang câu kế. */
export function finished(prev: AnnouncerState, nowMs: number): AnnounceResult {
  return pump({ ...prev, current: null, lastEndMs: nowMs }, nowMs);
}

/** Bà con chạm "Đã nghe": thôi nhắc lại câu đỏ đang đọc / vừa đọc. */
export function acknowledge(prev: AnnouncerState, group: string | null): AnnouncerState {
  const g = group ?? prev.current?.group ?? null;
  if (!g) return prev;
  return { ...prev, acked: { ...prev.acked, [g]: true } };
}

/** "Im 30 phút" — đỏ và hải đồ vẫn đọc (tầng 1 §12 không tắt bằng một chạm). */
export function muteFor(prev: AnnouncerState, nowMs: number, ms = VOICE_MUTE_MS): AnnouncerState {
  return { ...prev, mutedUntil: nowMs + ms };
}

export function unmute(prev: AnnouncerState): AnnouncerState {
  return { ...prev, mutedUntil: -Infinity };
}
