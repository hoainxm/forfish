// LUỒNG TRẢ LỜI MỘT CỬA — bước cuối khi Sen Biển KHÔNG làm lệnh và kho trong máy KHÔNG trúng (anh Long 2026-10-22:
// "cần tổ chức logic chuyển cho mượt vào, xác định rõ cái nào là ngram cái nào ngoài phạm vi thì xử lý sao, nói user
// sao, trong lúc đợi time out thì sao, kiểu như chưa tra xong m đã đẩy ngram vô rồi").
//
// Hai màn (Bản đồ · toàn app) gọi CÙNG hàm này, không tự xếp thứ tự riêng nữa. Bảng quyết định (doc 15 §luồng):
//   1. ý việc-trong-app mà n-gram CHẮC (≥ NGRAM_CHAC) và máy trả lời được ⇒ "app" (dữ liệu trong máy, chạy mất sóng)
//   2. câu máy CHƯA trả lời thật (kém chắc / không hiểu / ngoài nghề kém chắc / kho trượt):
//        có sóng + đăng nhập ⇒ "may-nha" — KHÔNG phát câu đoán trước, chỉ báo "đang hỏi"
//        mất sóng / chưa đăng nhập ⇒ "noi" câu nói rõ lý do, không đoán
//   3. câu đã có lời đáp thật của máy (daTraLoi, hỏi lại r.ask, ngoài phạm vi CHẮC) ⇒ "noi" đúng câu đó
// Máy nhà trượt (quá giờ / lỗi) ⇒ `cauTruot(lyDo)`; lượt cũ về muộn khi đã có câu mới ⇒ chỗ gọi bỏ (xem `luotMoi`).

import type { SenReply } from "@/lib/sen-bien/hieu-y";

/** Độ tin n-gram từ đó mới làm theo đoán — cùng mốc NGRAM_CHAC của hieu-y / lenh-cho. */
export const NGRAM_CHAC = 0.5;

export type LyDoTruot = "mat_song" | "chua_dang_nhap" | "het_gio" | "may_nha";

export type BuocCuoi = { buoc: "app" } | { buoc: "may-nha" } | { buoc: "noi"; say: string };

/** Câu nói khi không có câu trả lời — nói ĐÚNG lý do, không đọc câu đoán của n-gram. */
export function cauTruot(lyDo: LyDoTruot): string {
  switch (lyDo) {
    case "mat_song":
      return "Câu này cần sóng để Sen Biển hỏi thêm. Có sóng bà con hỏi lại nhé.";
    case "chua_dang_nhap":
      return "Bà con đăng nhập thì Sen Biển mới hỏi thêm được câu này.";
    case "het_gio":
      return "Máy chủ đang chậm, Sen Biển chưa có câu trả lời. Bà con hỏi lại sau ít phút nhé.";
    case "may_nha":
      return "Sen Biển chưa trả lời được câu này. Bà con thử hỏi cách khác nhé.";
  }
}

/** Câu "đã có lời đáp thật" — không cần (và không được) hỏi máy nhà. Ngoài phạm vi mà n-gram KÉM CHẮC thì chưa chắc
 *  là ngoài phạm vi ("một năm có mấy tháng" 0,29) ⇒ để máy nhà xét (máy nhà tự chặn chính trị / chủ quyền). */
function daCoLoiDap(r: SenReply, chac: boolean): boolean {
  if (r.kind !== "say") return true;
  if (r.ask) return true;
  if (r.daTraLoi) return !(r.y === "ngoai_pham_vi" && !chac);
  return false;
}

export function chonBuoc(o: {
  r: SenReply;
  /** độ tin n-gram cho câu này (null = chưa có mô hình) */
  conf: number | null;
  /** traLoiApp có câu trả lời cho ý này */
  coApp: boolean;
  online: boolean;
  /** máy có chuỗi thiết bị (đã đăng nhập) */
  coChuoi: boolean;
  text: string;
}): BuocCuoi {
  const chac = o.conf != null && o.conf >= NGRAM_CHAC;
  if (o.coApp && chac) return { buoc: "app" };
  if (daCoLoiDap(o.r, chac)) return { buoc: "noi", say: o.r.kind === "say" ? o.r.say : "" };
  // câu một chữ ("ừ", "hả") không đáng hỏi máy nhà — nói câu của máy
  if ((o.text.trim().match(/\p{L}+/gu) || []).length < 2) return { buoc: "noi", say: o.r.kind === "say" ? o.r.say : "" };
  if (!o.online) return { buoc: "noi", say: cauTruot("mat_song") };
  if (!o.coChuoi) return { buoc: "noi", say: cauTruot("chua_dang_nhap") };
  return { buoc: "may-nha" };
}

/** Số lượt — mỗi câu nghe được tăng một; câu trả lời của lượt cũ về muộn thì bỏ, không đọc chèn câu mới. */
export function luotMoi(ref: { current: number }): () => boolean {
  const toi = ++ref.current;
  return () => ref.current === toi;
}
