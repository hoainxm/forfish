// SEN BIỂN — CHUỖI TRẢ LỜI CÂU HỎI KIẾN THỨC (thuần + một chỗ async do chỗ gọi đưa vào; có test).
//
// Chủ dự án 2026-10-19: "ngoài biển tự trả lời ~99 % câu bà con hỏi, còn lại có sóng mới hỏi máy nhà".
//   (a) luật + n-gram v4 (`hieu-y.senBienReply`) như cũ — lệnh / câu trả lời thật xong là xong.
//   (b) câu "say" chưa trả lời thật, KHÔNG mở bằng động từ đi lại, và (v4 nói `hoi_mo` HOẶC bộ lọc `loc.ts`
//       p ≥ LOC_NGUONG — kể cả khi v4 nói `khong_hieu`) ⇒ v5b đưa 9 câu hỏi chuẩn gần nhất (`dau-kho.ts`):
//         · Android có Gemma: Gemma chọn số 1 (ĐỒNG Ý câu nhất v5b) ⇒ đọc; chọn số khác / 0 ⇒ kho trượt;
//         · không Gemma (web/iOS) / Gemma không ra chữ số / quá giờ ⇒ câu nhất p ≥ Q_CHAC 0,5 ⇒ trả lời, không thì trượt.
//       Mã câu cần kiểm ⇒ câu an toàn (hoi-dap.ts).
//   (c) kho trượt ⇒ chỗ gọi đi luồng một cửa `luong-tra-loi.chonBuoc` (có sóng + đăng nhập hỏi máy nhà; không thì
//       nói đúng lý do — `cauTruot`).
// ⚠ Kho CHƯA DUYỆT — chỉ bản test (hoi-dap.ts).

import { topK, type DauKho } from "./dau-kho";
import { moDauDiLai, type SenReply } from "./hieu-y";
import { cauTraLoi, type KhoHoiDap } from "./hoi-dap";
import { LOC_NGUONG, pHoi, type BoLoc } from "./loc";
import type { NgramCtx } from "./ngram";

export type BoKho = { dk: DauKho; kho: KhoHoiDap; loc: BoLoc | null };

/** Số câu đưa Gemma chọn — đúng lúc train (dung-chon.mjs K). */
export const SO_UNG_VIEN = 9;
/** Không có Gemma: câu nhất từ ngưỡng này thì đọc (test-hd 19/10: phủ 91,7 %, đúng 82,8 %). */
export const Q_CHAC = 0.5;
/** Kho trượt + không hỏi được máy nhà. */
export const CAU_CHUA_CHAC = "Câu này Sen Biển chưa chắc. Có sóng bà con hỏi lại, Sen Biển hỏi máy nhà cho.";

// ý đi lại / chặn ngoài phạm vi KHÔNG bao giờ vào kho (an toàn: lọc không được cướp lệnh dẫn đường)
const KHONG_VAO = new Set(["dan_duong", "dat_cang_nha", "ngoai_pham_vi"]);

/** Câu này có đi bước (b) không. */
export function vaoKho(text: string, r: SenReply, loc: BoLoc | null, ctx: NgramCtx): boolean {
  if (r.kind !== "say" || r.daTraLoi || r.ask || !r.y) return false;
  if (KHONG_VAO.has(r.y) || moDauDiLai(text)) return false;
  if (r.y === "hoi_mo") return true;
  /*  `khong_hieu` CŨNG phải qua lọc (đo 2026-10-19 trên 2.345 câu lệnh kín không phải hoi_mo): cho `khong_hieu` vào
      thẳng thì 32 câu nhiễu ("ờ", câu cụt) bị đọc một câu kho bất kỳ — đầu kho softmax tự tin cả với câu ngoài kho
      ("hôm qua ăn gì" ⇒ p 0,999) — mà chỉ thêm 0,1 % câu hỏi kho được trả lời. Qua lọc: 49 ⇒ 17 câu. */
  return !!loc && pHoi(loc, text, ctx) >= LOC_NGUONG;
}

/**
 * LUẬT LỆNH NGẮN BẮT NHẦM ĐUÔI CÂU HỎI (chủ dự án 2026-10-19, chọn phương án an toàn): `REPEAT` của hieu-y bắt
 * "…là gì vậy", `HOWFAR` bắt "…bao lâu một lần" ⇒ câu hỏi kiến thức thành "nhắc lại" / "còn bao xa". Bộ lọc chắc là
 * câu hỏi (p ≥ LOC_NGUONG) và câu không mở bằng động từ đi lại ⇒ đổi thành câu hỏi (`hoi_mo`) cho chuỗi kho. Lệnh
 * thật ("nhắc lại", "còn bao xa nữa tới") lọc ≤ 0,05 nên giữ nguyên. CHỈ hai luật này — KHÔNG đè chặn ngoài phạm
 * vi, câu hỏi bản đồ, dẫn đường (đo: +3,8 điểm phủ, không thêm câu lệnh nào bị kho trả lời). Gọi ngay sau
 * `senBienReply` (và Gemma tham số), trước khi chỗ gọi rẽ theo `kind`.
 */
export function goLenhNgan(text: string, r: SenReply, loc: BoLoc | null, ctx: NgramCtx): SenReply {
  if (r.kind !== "repeat" && r.kind !== "howfar") return r;
  if (!loc || moDauDiLai(text) || pHoi(loc, text, ctx) < LOC_NGUONG) return r;
  return { kind: "say", say: CAU_CHUA_CHAC, y: "hoi_mo" };
}

export type UngVien = { id: string; hoi: string; p: number };

/** 9 câu hỏi chuẩn gần nhất theo v5b — = dung-chon.mjs: lấy 12, gộp trùng mã, cắt 9, giữ thứ tự n-gram. */
export function ungVien(bo: BoKho, cau: string, ctx: NgramCtx): UngVien[] {
  const ra: UngVien[] = [];
  for (const t of topK(bo.dk, cau, ctx, SO_UNG_VIEN + 3)) {
    const id = bo.kho.q[t.i];
    if (!id || ra.some((x) => x.id === id)) continue;
    ra.push({ id, hoi: bo.kho.cauHoi[t.i], p: t.p });
    if (ra.length === SO_UNG_VIEN) break;
  }
  return ra;
}

export type CachChon = "nhanh" | "gemma" | "ngram";
export type KetQuaKho = { vao: false } | { vao: true; dap: { id: string; say: string; cach: CachChon } | null };

/** Gemma chọn câu: số 1–9 / 0 / null (không có, lỗi, quá giờ, không ra chữ số). Chỗ gọi đưa `gemma.chonCauHoi`. */
export type ChonFn = (cau: string, hoi: readonly string[]) => Promise<number | null>;

/** Bước (b). Không bao giờ ném. `bo` null (chưa tải được kho) ⇒ vào mà trượt — chỗ gọi đi (c). */
export async function hoiKho(text: string, r: SenReply, bo: BoKho | null, ctx: NgramCtx, chon: ChonFn | null): Promise<KetQuaKho> {
  if (!vaoKho(text, r, bo?.loc ?? null, ctx)) return { vao: false };
  if (!bo) return { vao: true, dap: null };
  try {
    const uv = ungVien(bo, text, ctx);
    if (!uv.length) return { vao: true, dap: null };
    const doc = (u: UngVien, cach: CachChon) => {
      const say = cauTraLoi(bo.kho, u.id);
      return { vao: true as const, dap: say ? { id: u.id, say, cach } : null };
    };
    const k = chon ? await chon(text, uv.map((u) => u.hoi)).catch(() => null) : null;
    /*  Gemma g270v5r (QAT int4, 2026-10-20, 6.000 câu kín test-hd): Gemma CHỌN MỘT MÌNH đúng 81,2 % khi trả lời — không
        hơn câu nhất v5b (78,3 %); nhưng Gemma ĐỒNG Ý câu nhất v5b (k = 1) ⇒ trả lời 60,8 %, đúng 95,5 %, sai 2,7 % trên
        tổng (v5b một mình sai 21,7 %). Ngoài biển câu sai tệ hơn câu "chưa chắc" ⇒ chỉ đọc khi hai bên đồng ý; Gemma
        chọn số khác / 0 ⇒ trượt (máy nhà / câu an toàn). Bỏ lối tắt p ≥ 0,9: có Gemma thì luôn kiểm chéo. */
    if (k === 1) return doc(uv[0], "gemma");
    if (k != null && k >= 0 && k <= 9) return { vao: true, dap: null };
    // không có Gemma / Gemma không ra chữ số (mô hình hiện tại chưa học vai chọn — nợ ở gemma.ts) ⇒ như web
    return uv[0].p >= Q_CHAC ? doc(uv[0], "ngram") : { vao: true, dap: null };
  } catch {
    return { vao: true, dap: null };
  }
}
