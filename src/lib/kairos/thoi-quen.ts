// KAIROS — THÓI QUEN ĐỌC TRONG MÁY (14 §3.2, §8, AC03/AC04). THUẦN (không chạm localStorage —
// bên gọi đọc/ghi chuỗi `forfish.kairos.thoiquen.v1`).
//
// ⚠️ HỒ SƠ ĐỌC KHÔNG BAO GIỜ RỜI MÁY. Không gửi trong request, không đồng bộ tài khoản. Chip
// "Cảng tôi"/"Gần tôi" chỉ gửi MÃ cảng/tỉnh làm bộ lọc, không gửi số lần đọc.
// Trần ≤4 KB: chỉ đếm theo mã chip/chủ đề (tập cố định), số đếm có trần + co lại khi lớn.

import { TOPICS, isTopic, type Topic } from "./chu-de.mjs";
import { PROVINCE_IDS, regionsOfProvince } from "./khu-vuc.mjs";

export const HABIT_KEY = "forfish.kairos.thoiquen.v1";
export const HABIT_MAX_BYTES = 4096;

/** Mã chip, đúng thứ tự mặc định (14 §3.2). Nhãn hiển thị ở labels.ts. */
export const CHIPS = [
  "moi",
  "nghe-ca",
  "cang-toi",
  "gan-toi",
  "theo-doi",
  "thoi-su",
  "phap-luat",
  "doi-song",
  "the-thao",
  "giai-tri",
  "kinh-te",
  // 2026-10-26: tab "Chính sách" của màn Kairos (14 §21) — dòng tin chỉ bài topic chinh-sach (thông báo nhà nước)
  "chinh-sach",
] as const;
export type ChipId = (typeof CHIPS)[number];

export function isChip(v: unknown): v is ChipId {
  return typeof v === "string" && (CHIPS as readonly string[]).includes(v);
}

export interface Habit {
  v: 1;
  /** số lần bấm từng chip */
  chips: Partial<Record<ChipId, number>>;
  /** số bài đã mở đọc theo chủ đề */
  topics: Partial<Record<Topic, number>>;
  /** nơi nhà — lấy từ cảng nhà của hồ sơ, KHÔNG từ vị trí máy */
  home: { port: string | null; province: string | null };
}

/** Một số đếm vượt trần thì cả bảng chia đôi — giữ tỉ lệ, chuộng thói quen gần đây hơn. */
const COUNT_CAP = 500;

export function emptyHabit(): Habit {
  return { v: 1, chips: {}, topics: {}, home: { port: null, province: null } };
}

function cleanCounts<K extends string>(raw: unknown, ok: (k: string) => k is K): Partial<Record<K, number>> {
  const out: Partial<Record<K, number>> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (ok(k) && typeof v === "number" && Number.isFinite(v) && v > 0) out[k] = Math.min(Math.floor(v), COUNT_CAP);
  }
  return out;
}

/** Chuỗi đã lưu ⇒ Habit. Hỏng/lạ/phiên bản khác ⇒ trống (thói quen mất thì chỉ là xếp mặc định). */
export function parseHabit(raw: string | null | undefined): Habit {
  if (!raw || raw.length > HABIT_MAX_BYTES * 2) return emptyHabit();
  let j: unknown;
  try {
    j = JSON.parse(raw);
  } catch {
    return emptyHabit();
  }
  if (!j || typeof j !== "object" || (j as { v?: unknown }).v !== 1) return emptyHabit();
  const o = j as Record<string, unknown>;
  const home = (o.home ?? {}) as Record<string, unknown>;
  const port = typeof home.port === "string" && /^[a-z0-9-]{1,60}$/.test(home.port) ? home.port : null;
  const province = typeof home.province === "string" && PROVINCE_IDS.includes(home.province) ? home.province : null;
  return {
    v: 1,
    chips: cleanCounts(o.chips, isChip),
    topics: cleanCounts(o.topics, isTopic as (k: string) => k is Topic),
    home: { port, province },
  };
}

export function serializeHabit(h: Habit): string {
  return JSON.stringify(h);
}

function bump<K extends string>(counts: Partial<Record<K, number>>, k: K): Partial<Record<K, number>> {
  const next = { ...counts, [k]: (counts[k] ?? 0) + 1 } as Partial<Record<K, number>>;
  if ((next[k] ?? 0) <= COUNT_CAP) return next;
  const halved: Partial<Record<K, number>> = {};
  for (const [key, v] of Object.entries(next) as [K, number][]) {
    const n = Math.floor(v / 2);
    if (n > 0) halved[key] = n;
  }
  return halved;
}

/** Bấm một chip. "Mới" không đếm — nó luôn đứng đầu. */
export function recordChip(h: Habit, chip: ChipId): Habit {
  if (chip === "moi") return h;
  return { ...h, chips: bump(h.chips, chip) };
}

/** Mở đọc một bài (chạm vào thẻ / Đọc bài gốc / xem bình luận). */
export function recordRead(h: Habit, topic: string): Habit {
  return isTopic(topic) ? { ...h, topics: bump(h.topics, topic) } : h;
}

export function setHome(h: Habit, home: { port: string | null; province: string | null }): Habit {
  return { ...h, home: { port: home.port, province: home.province && PROVINCE_IDS.includes(home.province) ? home.province : null } };
}

/**
 * Thứ tự chip: "Mới" luôn đầu; còn lại theo số lần bấm giảm dần, hoà thì giữ thứ tự mặc định.
 */
export function orderChips(h: Habit): ChipId[] {
  const rest = CHIPS.filter((c) => c !== "moi");
  const idx = new Map(rest.map((c, i) => [c, i]));
  rest.sort((a, b) => (h.chips[b] ?? 0) - (h.chips[a] ?? 0) || idx.get(a)! - idx.get(b)!);
  return ["moi", ...rest];
}

/** Tỉ lệ đọc từng chủ đề (0..1) — đầu vào cho xếp bài. Chưa đọc gì ⇒ {}. */
export function topicAffinity(h: Habit): Partial<Record<Topic, number>> {
  const total = TOPICS.reduce((s, t) => s + (h.topics[t] ?? 0), 0);
  if (!total) return {};
  const out: Partial<Record<Topic, number>> = {};
  for (const t of TOPICS) if (h.topics[t]) out[t] = (h.topics[t] ?? 0) / total;
  return out;
}

/** Vùng biển nhà, suy từ tỉnh nhà. */
export function homeRegions(h: Habit): string[] {
  return h.home.province ? regionsOfProvince(h.home.province) : [];
}
