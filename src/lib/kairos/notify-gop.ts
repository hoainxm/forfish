// KAIROS — AI ĐƯỢC BÁO KHI CÓ BÌNH LUẬN / TRẢ LỜI (14 §3.4, A3, A8, AC10). THUẦN.
//
// Hạ tầng gửi là cái sẵn có (account-notify: hộp thư + đẩy). Ở đây chỉ quyết định NGƯỜI NHẬN
// và CÂU CHỮ. Gộp "1 tin/bài/người nhận/giờ" do kho đóng dấu (`takeNotifyMark`), nên câu chữ
// không đếm chính xác số bình luận — nói chung "có bình luận mới".
// Luật: không tự báo mình · bài báo / Chính thức không có chủ bà con ⇒ không báo chủ bài (A8)
// · chủ bài và chủ bình luận gốc là một người ⇒ một tin · SĐT sentinel (sdvico:…) không nhận.

import { isValidVnPhone } from "@/lib/phone";

export const NOTIFY_WINDOW_MS = 60 * 60 * 1000;
export const KAIROS_PUSH_SENT_BY = "system:kairos";

export interface NotifyTarget {
  phone: string;
  why: "post" | "reply";
}

export function commentRecipients(input: {
  postKind: string;
  postAuthor: string | null;
  /** chủ bình luận gốc khi đây là trả lời */
  parentAuthor: string | null;
  commenter: string;
}): NotifyTarget[] {
  const out: NotifyTarget[] = [];
  const add = (phone: string | null, why: NotifyTarget["why"]) => {
    if (!phone || phone === input.commenter || !isValidVnPhone(phone)) return;
    if (out.some((t) => t.phone === phone)) return;
    out.push({ phone, why });
  };
  // trả lời ⇒ chủ bình luận gốc trước (tin cụ thể hơn), rồi chủ bài
  add(input.parentAuthor, "reply");
  if (input.postKind === "ba-con") add(input.postAuthor, "post");
  return out;
}

/** Câu chữ thông báo — tiếng Việt đời thường, không lộ SĐT, có tên gọi người bình luận. */
export function notifyMessage(t: NotifyTarget, commenterHandle: string, postId: string, commentId?: string): { title: string; body: string; url: string; tag: string } {
  const who = commenterHandle.slice(0, 20) || "Bà con";
  // `#bl-<id>` ⇒ trang bài cuộn tới + bung luồng chứa bình luận đó (comment-thread)
  const url = `/kairos/p/${postId}${commentId ? `#bl-${commentId}` : ""}`;
  return t.why === "reply"
    ? { title: "Có người trả lời bạn", body: `${who} vừa trả lời bình luận của bạn trên Kairos.`, url, tag: `kairos-${postId}` }
    : { title: "Bài của bạn có bình luận mới", body: `${who} vừa bình luận bài của bạn trên Kairos.`, url, tag: `kairos-${postId}` };
}

/** Tin "được nhắc tên" (0071) — trỏ thẳng chỗ nhắc: bình luận ⇒ `#bl-<id>`, bài ⇒ trang bài. */
export function nhacTenMessage(byHandle: string, postId: string, commentId?: string): { title: string; body: string; url: string; tag: string } {
  const who = byHandle.slice(0, 20) || "Bà con";
  return {
    title: "Có người nhắc đến bạn",
    body: `${who} đã nhắc đến bạn trong ${commentId ? "một bình luận" : "một bài viết"} trên Kairos.`,
    url: `/kairos/p/${postId}${commentId ? `#bl-${commentId}` : ""}`,
    tag: `kairos-${postId}`,
  };
}
