// KAIROS — CHUÔNG GỌN (14 §16, việc 7 nghiên cứu FB). THUẦN.
//
// Chuông FB trộn sinh nhật, gợi ý, live… Chuông Kairos chỉ có 2 loại tin, đều do `notifyComment`
// (server.ts → account-notify) gửi vào HỘP THƯ đã có: "có người bình luận bài bạn" / "có người trả lời
// bạn" (gộp 1 tin/bài/giờ — notify-gop.ts). Không có cột loại riêng: tin Kairos = tin NHẮM RIÊNG (`mine`)
// có đường dẫn `/kairos/p/<id>` (notifyMessage). Đọc BẢN LƯU hộp thư (forfish.inbox.v2) — không mạng.
// "Chưa đọc" dùng ĐÚNG sổ của hộp thư (forfish.inbox.read.v1, unreportedIds) — đọc ở chuông thì mục
// Thông báo trang chủ cũng tắt chấm, và ngược lại.

import type { InboxMessage } from "@/lib/inbox";

const KAIROS_BAI = /^\/kairos\/p\/([^/?#]+)/;

/** Mã bài của một tin hộp thư nếu đó là tin Kairos, không thì null. */
export function baiCuaTin(m: Pick<InboxMessage, "url" | "mine">): string | null {
  if (!m.mine || !m.url) return null;
  const k = KAIROS_BAI.exec(m.url);
  return k ? decodeURIComponent(k[1]) : null;
}

export interface TinChuong {
  id: string;
  postId: string;
  title: string;
  body: string;
  url: string;
  sentAt: string;
  chuaDoc: boolean;
}

/** Trần dòng trong ngăn — hộp thư giữ ≤50 tin, chuông không cần hơn. */
export const CHUONG_TOI_DA = 30;

/** Tin Kairos trong hộp thư, mới nhất trước. `chuaBao` = id chưa đánh dấu đọc (unreportedIds). */
export function tinChuongKairos(list: readonly InboxMessage[], chuaBao: ReadonlySet<string>): TinChuong[] {
  const ms = (s: string) => {
    const t = Date.parse(s);
    return Number.isFinite(t) ? t : -Infinity;
  };
  const out: TinChuong[] = [];
  for (const m of list) {
    const postId = baiCuaTin(m);
    if (!postId) continue;
    out.push({ id: m.id, postId, title: m.title, body: m.body, url: m.url!, sentAt: m.sentAt, chuaDoc: chuaBao.has(m.id) });
  }
  return out.sort((a, b) => ms(b.sentAt) - ms(a.sentAt)).slice(0, CHUONG_TOI_DA);
}

/** Số trên chấm đếm: 0 ⇒ không vẽ chấm; >9 ⇒ "9+". */
export function nhanDem(n: number): string {
  return n <= 0 ? "" : n > 9 ? "9+" : String(n);
}
