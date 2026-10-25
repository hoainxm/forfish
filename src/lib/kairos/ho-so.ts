// KAIROS — TRANG CÁ NHÂN KIỂU FACEBOOK (14 §3.8, AC13 — bản 2026-10-24). THUẦN, dùng ở cả
// máy chủ (me-patch, route) lẫn màn (user-profile, profile-sheet).
//
// Danh mục nghề + trần giới thiệu + luật "mời đặt tên" + lưới ảnh. Quê dùng danh mục 34 tỉnh
// của khu-vuc.mjs, cảng nhà dùng fishing-ports.ts — không có danh mục thứ hai.

import { PROVINCES } from "./khu-vuc.mjs";
import type { KairosPost } from "./types";

/** Nghề — mã lưu ở cột `kairos_profiles.nghe` (check của 0067 khớp từng ký tự). */
export const NGHE = [
  { id: "cau-muc", name: "Câu mực" },
  { id: "luoi-vay", name: "Lưới vây" },
  { id: "luoi-re", name: "Lưới rê" },
  { id: "luoi-keo", name: "Lưới kéo" },
  { id: "cau-tay", name: "Câu tay" },
  { id: "lan", name: "Lặn" },
  { id: "nuoi-trong", name: "Nuôi trồng" },
  { id: "thu-mua", name: "Thu mua, vựa" },
  { id: "khac", name: "Nghề khác" },
] as const;
export type NgheId = (typeof NGHE)[number]["id"];

/** Dòng tự giới thiệu — tối đa 150 ký tự (code point, khớp char_length). */
export const GIOI_THIEU_MAX = 150;

const NGHE_NAME = new Map<string, string>(NGHE.map((n) => [n.id, n.name]));
const TINH_NAME = new Map<string, string>(PROVINCES.map((p) => [p.id, p.name]));

export const isNghe = (v: unknown): v is NgheId => typeof v === "string" && NGHE_NAME.has(v);
export const isTinh = (v: unknown): v is string => typeof v === "string" && TINH_NAME.has(v);
export const ngheName = (id: string | null | undefined): string => (id ? NGHE_NAME.get(id) ?? "" : "");
export const tinhName = (id: string | null | undefined): string => (id ? TINH_NAME.get(id) ?? "" : "");

/** Tỉnh xếp theo tên (ô chọn quê). */
export const TINH_LIST: readonly { id: string; name: string }[] = [...PROVINCES]
  .map((p) => ({ id: p.id, name: p.name }))
  .sort((a, b) => a.name.localeCompare(b.name, "vi"));

/** Tên mặc định máy đặt (ten-goi.defaultHandle): "Bà con 5689", "Bà con 5689 2", "Bà con mới". */
export function isDefaultHandle(handle: string): boolean {
  return /^Bà con (\d{1,4}|mới)( \d{1,2})?$/u.test(handle.normalize("NFC").trim());
}

/**
 * Có mời "Bà con muốn được gọi là gì?" trên trang của mình không: chưa đổi tên lần nào
 * (`handle_changed_at` null) + tên còn dạng mặc định + không phải hồ sơ Chính thức.
 */
export function shouldAskName(p: { handle: string; handle_changed_at: string | null; official: boolean }): boolean {
  return !p.official && !p.handle_changed_at && isDefaultHandle(p.handle);
}

export interface GridPhoto {
  postId: string;
  url: string;
}

/**
 * Lưới ảnh của trang người dùng: ảnh trong các bài CỦA CHÍNH người đó (bỏ ảnh của bài gốc khi
 * họ đăng lại — ảnh đó của người khác), theo thứ tự bài, bỏ trùng, tối đa `max`.
 */
export function gridPhotos(posts: readonly KairosPost[], profileId: string, max = 60): GridPhoto[] {
  const out: GridPhoto[] = [];
  const seen = new Set<string>();
  for (const p of posts) {
    if (p.author?.profileId !== profileId) continue;
    for (const url of p.images) {
      if (!url || seen.has(url)) continue;
      seen.add(url);
      out.push({ postId: p.id, url });
      if (out.length >= max) return out;
    }
  }
  return out;
}

/** Cùng cảng nhà — cả hai phải có cảng. */
export function samePort(a: string | null | undefined, b: string | null | undefined): boolean {
  return !!a && !!b && a === b;
}

/**
 * Khoá máy nhớ "Để sau" của lời mời đặt tên (ops/state-registry.md): mảng profileId đã bấm Để
 * sau trên máy này. Chỉ là phép lịch sự — mất khoá thì lời mời hiện lại, không hỏng gì.
 */
export const MOI_TEN_KEY = "forfish.kairos.moiten.v1";
const MOI_TEN_MAX = 20;

/** Đọc khoá; hỏng / sai kiểu ⇒ []. */
export function parseMoiTen(raw: string | null | undefined): string[] {
  try {
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(-MOI_TEN_MAX) : [];
  } catch {
    return [];
  }
}

/** Thêm một hồ sơ vào danh sách "Để sau" (giữ 20 mục mới nhất, không trùng). */
export function addMoiTen(list: readonly string[], profileId: string): string[] {
  return [...list.filter((x) => x !== profileId), profileId].slice(-MOI_TEN_MAX);
}

/**
 * Hồ sơ CỦA MÌNH lấy từ bản lưu dòng tin (bài/bình luận có `mine`) — để góc "Trang tôi" vẽ ảnh đại diện
 * chữ cái ngay lúc mở màn KHÔNG gọi `/me` (K3-09). Bản lưu đã bỏ ảnh đại diện ⇒ chỉ có tên; không có bài nào
 * của mình ⇒ null (màn dùng "Tôi").
 */
export function authorToi(posts: readonly KairosPost[]): { profileId: string; handle: string } | null {
  for (const p of posts) {
    if (p.mine && p.author?.profileId) return { profileId: p.author.profileId, handle: p.author.handle };
    const c = p.topComments.find((x) => x.mine && x.author?.profileId);
    if (c) return { profileId: c.author.profileId, handle: c.author.handle };
  }
  return null;
}
