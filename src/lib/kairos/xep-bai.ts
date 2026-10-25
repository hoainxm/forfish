// KAIROS — XẾP BÀI THEO THÓI QUEN, TRONG MÁY (14 §3.2, AC04, A4). THUẦN.
//
// Máy chủ trả mỗi trang theo `feed_at desc` (giờ lên dòng tin). App xếp lại TRONG TỪNG TRANG (không đảo bài
// giữa các trang ⇒ cuộn vô tận không nhảy, không lặp). Bài ghim (Chính thức còn hạn) luôn trên.
// Điểm = độ mới + chủ đề hay đọc + gần nhà. Không điểm "hot", không đếm Hay (spec §1 Không làm).

import type { Habit } from "./thoi-quen";
import { homeRegions, topicAffinity } from "./thoi-quen";

export interface RankablePost {
  id: string;
  topic: string;
  publishedAt: string;
  pinnedUntil: string | null;
  regions: readonly string[];
  provinces: readonly string[];
  ports: readonly string[];
}

/** Nửa đời độ mới: bài cũ 12 giờ còn nửa điểm mới. */
const HALF_LIFE_H = 12;
/** Trọng số — độ mới vẫn là trục chính (đây là chỗ đọc báo), thói quen chỉ đẩy nhẹ. */
const W = { fresh: 1, topic: 0.6, port: 0.6, province: 0.4, region: 0.2 } as const;

export function isPinned(p: Pick<RankablePost, "pinnedUntil">, now: number): boolean {
  if (!p.pinnedUntil) return false;
  const t = Date.parse(p.pinnedUntil);
  return Number.isFinite(t) && t > now;
}

/** Điểm một bài (không tính ghim). Thuần, để test. */
export function scorePost(p: RankablePost, h: Habit, now: number, aff = topicAffinity(h), regions = homeRegions(h)): number {
  const t = Date.parse(p.publishedAt);
  const ageH = Number.isFinite(t) ? Math.max(0, (now - t) / 3_600_000) : 1e6;
  let s = W.fresh * Math.pow(0.5, ageH / HALF_LIFE_H);
  s += W.topic * (aff[p.topic as keyof typeof aff] ?? 0);
  if (h.home.port && p.ports.includes(h.home.port)) s += W.port;
  else if (h.home.province && p.provinces.includes(h.home.province)) s += W.province;
  else if (regions.some((r) => p.regions.includes(r))) s += W.region;
  return s;
}

/**
 * Xếp lại MỘT trang. Ghim lên đầu (giữ thứ tự máy chủ); còn lại theo điểm, hoà thì giữ thứ tự
 * máy chủ (sort ổn định). Không thêm, không bớt bài.
 */
export function rankPage<T extends RankablePost>(page: readonly T[], h: Habit, now: number): T[] {
  const aff = topicAffinity(h);
  const regions = homeRegions(h);
  const pinned: T[] = [];
  const rest: { p: T; s: number; i: number }[] = [];
  page.forEach((p, i) => {
    if (isPinned(p, now)) pinned.push(p);
    else rest.push({ p, s: scorePost(p, h, now, aff, regions), i });
  });
  rest.sort((a, b) => b.s - a.s || a.i - b.i);
  return [...pinned, ...rest.map((r) => r.p)];
}
