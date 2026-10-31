// SEN BIỂN — HỎI VỀ HÀNG SDVICO (2026-10-31, anh Long: "họ hỏi trc khi đk, nếu họ muốn hỏi" · "cho sen biển giao tiếp đc" ·
// "tổ chức 1 luồng tương tự cho máy lọc nước" · ắc quy). Lớp luật từ khoá THUẦN, chạy trong máy (mất sóng vẫn đáp), đứng
// TRƯỚC lệnh chợ / n-gram / kho:
//   · chỉ bắt khi câu NHẮC đúng món ("lọc dầu"/SF50…, "lọc nước"/SEA…, "ắc quy"/accu) — câu "khói đen" trần không vào đây;
//   · chọn đúng MỘT câu đáp trong `hoiDap` của món (đã qua kiểm duyệt nội dung) theo chủ đề; nhắc chung chung / muốn mua /
//     muốn xem ⇒ câu giá + `moVideo` (món có clip ⇒ chỗ gọi mở thẻ có video ở Trang chủ).
// Vì sao không nạp vào kho hỏi–đáp n-gram: kho là mô hình train trên GPU + anh duyệt từng câu (vòng train), mà bà con cần
// hỏi được NGAY khi thẻ lên. Vòng train sau có thể học các câu này rồi gỡ lớp luật (nợ ghi ở doc 15).
import { KM_AC_QUY, KM_LOC_DAU, KM_LOC_NUOC, type KhuyenMai } from "@/data/khuyen-mai";
import { foldVn } from "@/lib/sen-bien/ngram";

export type DapSanPham = { id: string; say: string; moVideo: boolean; duong: string | null };

type Mon = { km: KhuyenMai; nhac: RegExp; chuDe: [number, RegExp][] };

const GIA = /\b(gia|bao nhieu|may tien|nhieu tien|tien)\b/;

/** Thứ tự CHỦ ĐỀ là ƯU TIÊN (vd câu sửa máy "bao nhiêu" phải thắng câu giá máy); chỉ số = vị trí trong `km.hoiDap`. */
const MON: Mon[] = [
  {
    km: KM_LOC_DAU,
    nhac: /\b(loc dau|may loc dau|bo loc dau|sf ?50b?|sf ?300b?)\b/,
    chuDe: [
      [4, /\b(sua|tui loc|thay tui|thay loc|bao lau thay)\b/],
      [7, /\bkhoi (xanh|trang)\b/],
      [6, /\b(khoi den|yeu may|may yeu)\b/],
      [8, /\b(tat may|chet may|kho no|xa gio|song lon)\b/],
      [1, /\b(khac|co hay dien|co voi dien|ban nao|chon ban|ban co|ban dien|co bom|khong dien)\b/],
      [2, /\b(ton dau|hao dau|tiet kiem|do dau|bot dau|giam dau|an dau)\b/],
      [3, /\b(dang tien|co dang|co nen|nen mua|co loi)\b/],
      [5, /\b(bao hanh|ai lap|lap o dau|lap dat|lap tan|ky thuat|da lap|o dau ban)\b/],
      [0, GIA],
    ],
  },
  {
    km: KM_LOC_NUOC,
    nhac: /\b(loc nuoc|may loc nuoc|loc nuoc bien|sea ?40|sea ?250|sd ?m ?250|nuoc bien thanh nuoc ngot)\b/,
    chuDe: [
      [5, /\b(thay loi|thay mang|loi loc|mang loc|mang ro)\b/],
      [1, /\b(khac|co hay dien|co voi dien|ban nao|chon ban|ban co|ban dien|khong dien)\b/],
      [2, /\b(bao nhieu lit|may lit|cong suat|uong duoc|an toan|sach khong|muoi)\b/],
      [3, /\b(lay nuoc|lap o dau|lap dat|lap tan|cho nao|kich thuoc|nang)\b/],
      [4, /\b(bao hanh)\b/],
      [0, GIA],
    ],
  },
  {
    km: KM_AC_QUY,
    nhac: /\b(ac quy|acquy|accu|ac cu|binh dien|binh ac quy)\b/,
    chuDe: [
      [1, /\b(coc|coc rieng|coc binh|thiet bi dien tu|dinh vi|giam sat)\b/],
      [2, /\b(manh|ah|dung luong|du tru|bao lau|khoi dong)\b/],
      [0, GIA],
    ],
  },
];
const MUON_XEM = /\b(video|clip|coi|xem|mua|dang ky|dat)\b/;

/** Đáp câu hỏi về hàng SDVICO; câu không nhắc món nào ⇒ null (chỗ gọi đi tiếp luồng cũ). */
export function traLoiSanPham(text: string): DapSanPham | null {
  const f = ` ${foldVn(text)} `;
  const mon = MON.find((m) => m.nhac.test(f));
  const ds = mon?.km.hoiDap ?? [];
  if (!mon || !ds.length) return null;
  const hit = mon.chuDe.find(([, re]) => re.test(f));
  const i = hit ? hit[0] : 0;
  const coVideo = !!mon.km.video;
  const moVideo = coVideo && (!hit || MUON_XEM.test(f));
  const dap = ds[i] ?? ds[0];
  const say = moVideo ? `${dap.dap} Sen Biển mở video cho bà con coi nha.` : dap.dap;
  return { id: `${mon.km.id}-${i}`, say, moVideo, duong: moVideo ? duongVideo(mon.km) : null };
}

/** Đường mở thẻ + video ở Trang chủ (khuyen-mai-card đọc `?km=`). */
export function duongVideo(km: KhuyenMai): string {
  return `/?km=${km.id}`;
}

/** Giữ tên cũ cho chỗ gọi / test — clip lọc dầu. */
export const DUONG_VIDEO_LOC_DAU = duongVideo(KM_LOC_DAU);
