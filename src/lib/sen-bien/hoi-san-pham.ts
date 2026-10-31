// SEN BIỂN — HỎI VỀ MÁY LỌC DẦU SDVICO (2026-10-31, anh Long: "họ hỏi trc khi đk, nếu họ muốn hỏi" · "cho sen biển giao
// tiếp đc"). Lớp luật từ khoá THUẦN, chạy trong máy (mất sóng vẫn đáp), đứng TRƯỚC lệnh chợ / n-gram / kho:
//   · chỉ bắt khi câu NHẮC máy lọc dầu ("lọc dầu", "SF50", "SF300") — câu "khói đen" trần không vào đây (để kho / máy nhà);
//   · chọn đúng MỘT câu đáp trong `KM_LOC_DAU.hoiDap` (mục 8 kịch bản tư vấn, team agent đã qua kiểm duyệt nội dung) theo chủ
//     đề; nhắc chung chung / muốn mua / muốn xem ⇒ câu giá + `moVideo` (chỗ gọi mở thẻ có video ở Trang chủ).
// Vì sao không nạp vào kho hỏi–đáp n-gram: kho là mô hình train trên GPU + anh duyệt từng câu (vòng train), mà bà con cần
// hỏi được NGAY khi video lên. Vòng train sau có thể học các câu này rồi gỡ lớp luật (nợ ghi ở doc 15).
import { KM_LOC_DAU } from "@/data/khuyen-mai";
import { foldVn } from "@/lib/sen-bien/ngram";

export type DapSanPham = { id: string; say: string; moVideo: boolean };

const NHAC_SP = /\b(loc dau|may loc dau|bo loc dau|sf ?50b?|sf ?300b?)\b/;

/** [chỉ số câu trong hoiDap, mẫu] — thứ tự là ƯU TIÊN (câu sửa máy "bao nhiêu" phải thắng câu giá máy). */
const CHU_DE: [number, RegExp][] = [
  [4, /\b(sua|tui loc|thay tui|thay loc|bao lau thay)\b/],
  [7, /\bkhoi (xanh|trang)\b/],
  [6, /\b(khoi den|yeu may|may yeu)\b/],
  [8, /\b(tat may|chet may|kho no|xa gio|song lon)\b/],
  [1, /\b(khac|co hay dien|co voi dien|ban nao|chon ban|ban co|ban dien|co bom|khong dien)\b/],
  [2, /\b(ton dau|hao dau|tiet kiem|do dau|bot dau|giam dau|an dau)\b/],
  [3, /\b(dang tien|co dang|co nen|nen mua|co loi)\b/],
  [5, /\b(bao hanh|ai lap|lap o dau|lap dat|lap tan|ky thuat|da lap|o dau ban)\b/],
  [0, /\b(gia|bao nhieu|may tien|nhieu tien|tien)\b/],
];
const MUON_XEM = /\b(video|clip|coi|xem|mua|dang ky|dat)\b/;

/** Đáp câu hỏi về máy lọc dầu; câu không nhắc sản phẩm ⇒ null (chỗ gọi đi tiếp luồng cũ). */
export function traLoiSanPham(text: string): DapSanPham | null {
  const f = ` ${foldVn(text)} `;
  if (!NHAC_SP.test(f)) return null;
  const ds = KM_LOC_DAU.hoiDap ?? [];
  if (!ds.length) return null;
  const hit = CHU_DE.find(([, re]) => re.test(f));
  const i = hit ? hit[0] : 0;
  const moVideo = !hit || MUON_XEM.test(f);
  const dap = ds[i] ?? ds[0];
  const say = moVideo ? `${dap.dap} Sen Biển mở video máy lọc dầu cho bà con coi nha.` : dap.dap;
  return { id: `loc-dau-${i}`, say, moVideo };
}

/** Đường mở thẻ lọc dầu + video ở Trang chủ (khuyen-mai-card đọc `?km=`). */
export const DUONG_VIDEO_LOC_DAU = `/?km=${KM_LOC_DAU.id}`;
