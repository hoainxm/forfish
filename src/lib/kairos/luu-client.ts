// KAIROS — LƯU BÀI MANG THEO, phía app (14 §18). Ghép luật thuần (luu-bai.ts) + kho ảnh (luu-anh.ts) +
// ngăn SĐT (cache.ts `cacheBucket`). Chỉ chạy khi bà con BẤM Lưu / Bỏ lưu — không gửi ngầm.
// KHÔNG ném: mọi đường hỏng trả kết quả có nhãn để màn báo câu thật.

import { cacheBucket } from "./cache";
import { catAnh, layAnh, xoaAnh } from "./luu-anh";
import { anhCuaBai, anhKhongDung, boLuu, daLuu, docLuu, ghiLuu, listLuu, themLuu, type BaiLuu } from "./luu-bai";
import type { KairosPost } from "./types";

/** Màn khác (Trang tôi › Đã lưu) nghe sự kiện này để đọc lại danh sách. */
export const LUU_EVENT = "kairos:luu";

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

const bao = () => {
  try {
    window.dispatchEvent(new Event(LUU_EVENT));
  } catch {
    /* SSR / không có window */
  }
};

export function docBaiLuu(phone: string | null | undefined): BaiLuu[] {
  return listLuu(docLuu(storage()), cacheBucket(phone));
}

export function daLuuBai(phone: string | null | undefined, id: string): boolean {
  return daLuu(docLuu(storage()), cacheBucket(phone), id);
}

export type LuuKetQua =
  | { ok: true; anhLuu: number; anhThieu: number }
  | { ok: false; reason: "bai" | "anh" | "chu" | "ghi" };

/**
 * Lưu một bài: lấy ảnh (đo cỡ) ⇒ kiểm trần ⇒ ghi ảnh vào kho ⇒ ghi chữ. Đầy ⇒ KHÔNG ghi gì, trả trần nào
 * đầy. Ghi chữ hỏng ⇒ gỡ ảnh vừa ghi mà không bài nào khác dùng (không để mồ côi).
 */
export async function luuBaiMangTheo(phone: string | null | undefined, post: KairosPost, now = Date.now()): Promise<LuuKetQua> {
  const s = storage();
  const ngan = cacheBucket(phone);
  const truoc = docLuu(s);
  // kiểm trần bài/chữ TRƯỚC khi tốn sóng tải ảnh
  const thu = themLuu(truoc, ngan, post, [], now);
  if (!thu.ok) return { ok: false, reason: thu.reason };
  const urls = anhCuaBai(post);
  const { lay, thieu } = await layAnh(urls);
  const kiem = themLuu(truoc, ngan, post, lay.map(({ url, bytes }) => ({ url, bytes })), now);
  if (!kiem.ok) return { ok: false, reason: kiem.reason };
  const anh = await catAnh(lay);
  // đọc lại ngay trước khi ghi: một lần Lưu khác có thể đã ghi trong lúc chờ ảnh
  const moi = docLuu(s);
  const ghi = themLuu(moi, ngan, post, anh, now);
  if (!ghi.ok) {
    void xoaAnh(anhKhongDung({ v: 1, ngan: { tam: [{ post, savedAt: now, anh }] } }, moi));
    return { ok: false, reason: ghi.reason };
  }
  if (!ghiLuu(s, ghi.state)) {
    void xoaAnh(anhKhongDung({ v: 1, ngan: { tam: [{ post, savedAt: now, anh }] } }, moi));
    return { ok: false, reason: "ghi" };
  }
  void xoaAnh(anhKhongDung(moi, ghi.state)); // lưu lại bài đã sửa: ảnh cũ bị thay thì dọn
  bao();
  // bài lấy từ bản lưu dòng tin (chỉ chữ: images rỗng, còn imageCount) ⇒ ảnh của nó cũng là "chưa lưu được"
  const chiChu = post.images.length === 0 ? (post.imageCount ?? 0) : 0;
  return { ok: true, anhLuu: anh.length, anhThieu: thieu + (lay.length - anh.length) + chiChu };
}

/** Bỏ lưu: gỡ chữ + ảnh không còn bài nào dùng. false = máy không ghi được. */
export async function boLuuBai(phone: string | null | undefined, id: string): Promise<boolean> {
  const s = storage();
  const truoc = docLuu(s);
  const sau = boLuu(truoc, cacheBucket(phone), id);
  if (sau === truoc) return true;
  if (!ghiLuu(s, sau)) return false;
  await xoaAnh(anhKhongDung(truoc, sau));
  bao();
  return true;
}
