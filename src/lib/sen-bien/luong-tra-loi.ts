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

import { CAU_LANG, chonCau } from "@/lib/sen-bien/cau-vui";
import type { SenReply } from "@/lib/sen-bien/hieu-y";
import { foldVn } from "@/lib/sen-bien/ngram";

/** Độ tin n-gram từ đó mới làm theo đoán — cùng mốc NGRAM_CHAC của hieu-y / lenh-cho. */
export const NGRAM_CHAC = 0.5;

export type LyDoTruot = "mat_song" | "chua_dang_nhap" | "het_gio" | "may_nha";

export type BuocCuoi = { buoc: "app" } | { buoc: "may-nha" } | { buoc: "noi"; say: string };

/** Câu nói khi không có câu trả lời — nói ĐÚNG lý do, không đọc câu đoán của n-gram; câu lảng có duyên xoay vòng
 *  trong kho `cau-vui.CAU_LANG` (không lặp liền). */
export function cauTruot(lyDo: LyDoTruot): string {
  return chonCau(CAU_LANG[lyDo], `lang-${lyDo}`);
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

/*  TIẾNG ĐỆM SAU CÂU TRẢ LỜI (2026-10-24, rà "chồng chéo" trên 39 câu thật đã gửi về): micro tự mở sau mỗi câu trả lời
    thu phải "ừm", "ủa", "Yeah", "em hiểu rồi", "trong khi" — Sen Biển coi là câu hỏi mới và trả lời tiếp, thành nói
    mãi không dứt. Trong lượt micro TỰ mở, câu là tiếng đệm ⇒ không trả lời, khép cuộc nói. Cảm ơn ⇒ đáp một câu rồi khép.
    Lượt bà con CHẠM gọi thì không lọc (bà con chủ động nói "ừ" là có ý). */
const DEM = /^(u+m*|u+h+|o+|a+|a ha|ha+|hm+|ui|uh huh|ok|oke|okay|yeah|yes|ya|vang|da|da vang|uh|um|roi|duoc|duoc roi|hieu roi|em hieu roi|toi hieu roi|tui hieu roi|biet roi|vay ha|the a|the ha|ua|ua vay|trong khi|thoi|thoi duoc roi|khong co gi)$/;
const CAM_ON = /^((da |vang )?(cam on|thank you|thanks|cam on nha|cam on nhieu|cam on sen bien|cam on em|cam on con)( nha| nhe| nhieu| em| con| sen bien)*)$/;

export type CauDem = "dem" | "cam_on" | null;

/** Câu nghe được trong lượt micro tự mở là tiếng đệm / cảm ơn không. */
export function laCauDem(text: string): CauDem {
  const f = foldVn(text);
  if (!f) return "dem";
  if (CAM_ON.test(f)) return "cam_on";
  return DEM.test(f) ? "dem" : null;
}

/** Câu đáp lời cảm ơn rồi khép cuộc nói. */
export const DAP_CAM_ON = "Dạ, có gì bà con cứ gọi Sen Biển.";
