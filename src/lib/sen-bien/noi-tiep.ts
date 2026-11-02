// SEN BIỂN — CÂU NỐI NHIỀU LƯỢT (thuần, có test, không mạng).
//
// Anh Long 2026-11-02 ("vượt qua Mimi"): Mimi hiểu trọn MỘT câu lệnh, không nhớ câu trước. Ngoài
// biển bà con hỏi nối: "xem sóng chiều nay" → "còn ngày mai thì sao?" → "gió thì sao?";
// "chỗ nào nhiều cá ngừ" → "còn cá thu?"; "phía Đông có gì" → "còn phía Bắc?". Ở đây: câu có
// dấu hiệu NỐI ("còn…", "thế còn…", "…thì sao") hoặc rất ngắn và chỉ mang tham số ⇒ lấy việc
// vừa làm, thay đúng tham số mới. Không đủ tham số ⇒ null, để hieu-y hiểu như câu mới.
//
// Nhớ có hạn (NOI_TIEP_MS): hỏi lại sau lâu là chuyện mới, đừng áp ngữ cảnh cũ.

import { tachThamSo, timLoaiCa, type CauHoi } from "./hoi-ban-do";
import { LOP_CO_GIO, tachLop, tachThoiDiem, type LenhBanDo } from "./lenh-ban-do";
import { foldVn } from "./ngram";

export type ViecTruoc = { kind: "map"; lenh: LenhBanDo } | { kind: "hoi"; q: CauHoi };
/** Câu vừa làm + lúc làm (ms) */
export type NhoTruoc = ViecTruoc & { luc: number };

export const NOI_TIEP_MS = 5 * 60_000;

/** "còn …", "thế còn …", "vậy còn …", "rồi …" ở đầu; "… thì sao/thế nào/ra sao" ở cuối */
const DAU_NOI = /^(the con|vay con|con|the|vay|roi|con nhu) /;
/** câu muốn ĐI đâu đó không phải câu nối dù có "còn"/"rồi" ("rồi dẫn về Sa Huỳnh chiều mai") */
const DI = / (dan|chi duong|chay ve|chay ra|ve cang|toi cang|ve ben|ve nha) /;
const CUOI_NOI = / (thi sao|the nao|ra sao|sao|nua|thi|nhi|nhe|vay)$/;
/** câu ngắn chỉ có tham số ("chiều mai?", "cá thu?") — tối đa ngần này chữ */
const NGAN = 4;
/** chữ đệm không tính là "có nội dung khác" */
const DEM = new Set(["the", "vay", "con", "roi", "thi", "sao", "nao", "ra", "nua", "nhi", "nhe", "a", "oi", "xem", "coi", "di", "luon"]);

/**
 * Câu nối → việc mới (cùng loại việc trước, tham số mới); null = không phải câu nối / không áp được.
 * `loaiCa` = danh sách tên ngắn loài app biết (như hieu-y).
 */
export function hieuCauNoi(text: string, truoc: NhoTruoc | null | undefined, now: number, loaiCa: readonly string[] = []): ViecTruoc | null {
  if (!truoc || now - truoc.luc > NOI_TIEP_MS) return null;
  const f = foldVn(text);
  if (!f || DI.test(` ${f} `)) return null;
  const tu = f.split(" ");
  const coNoi = DAU_NOI.test(`${f} `) || CUOI_NOI.test(` ${f}`);
  if (!coNoi && tu.length > NGAN) return null;

  const ca = timLoaiCa(text, loaiCa);
  const luc = tachThoiDiem(text);
  const lop = tachLop(text, false);
  const huong = tachThamSo(text, loaiCa).huong;
  if (!ca && !luc && !lop && huong == null) return null;
  // câu dài mà ngoài tham số còn động từ khác ("còn dẫn về Sa Huỳnh thì sao") ⇒ để hieu-y
  if (!coNoi && tu.some((w) => !DEM.has(w)) && tu.length > 2 && !luc && !ca) return null;

  if (truoc.kind === "map") {
    const l = truoc.lenh;
    if (l.viec === "mo_lop" || l.viec === "doc_gia_tri" || l.viec === "doi_thoi_diem") {
      const cu = l.viec === "doi_thoi_diem" ? undefined : l.lop;
      const lopMoi = ca ? "ca" : (lop ?? cu);
      const lucMoi = luc ?? ("luc" in l ? l.luc : undefined);
      if (l.viec === "doi_thoi_diem" && !lopMoi) return luc ? { kind: "map", lenh: { viec: "doi_thoi_diem", luc } } : null;
      if (!lopMoi) return null;
      const loaiCaMoi = lopMoi === "ca" ? (ca ?? ("loaiCa" in l ? l.loaiCa : undefined)) : undefined;
      const coGio = LOP_CO_GIO.includes(lopMoi);
      if (l.viec === "doc_gia_tri")
        return { kind: "map", lenh: { viec: "doc_gia_tri", lop: lopMoi, ...(lucMoi ? { luc: lucMoi } : {}), ...(loaiCaMoi ? { loaiCa: loaiCaMoi } : {}) } };
      return {
        kind: "map",
        lenh: { viec: "mo_lop", lop: lopMoi, ...(lucMoi && coGio ? { luc: lucMoi } : {}), ...(loaiCaMoi ? { loaiCa: loaiCaMoi } : {}) },
      };
    }
    return null;
  }

  const q = truoc.q;
  if (q.loai === "ca" && ca) return { kind: "hoi", q: { loai: "ca", loaiCa: ca, muonDi: false } };
  if (q.loai === "phia_truoc" && huong != null) return { kind: "hoi", q: { loai: "phia_truoc", huong, muonDi: false } };
  // vừa hỏi chuyện khác mà giờ nói loài cá ⇒ hỏi cá ở đâu
  if (ca && coNoi) return { kind: "hoi", q: { loai: "ca", loaiCa: ca, muonDi: false } };
  return null;
}
