// TRỌNG SỐ KHI MẤT SÓNG — xem lại được gì, tính lại thì MẤT trọng số nào (2026-11-08, anh Long: "tính toán khi offline muốn
// xem lại thì xem gì, tính lại thì sẽ bị mất trọng số nào"). 09 §5c-b.
//
// Một lộ trình được chấm bằng NHIỀU lớp — mỗi lớp có nguồn, tuổi, và hậu quả riêng khi vắng (thuật toán coi hệ số = 1 và
// ghi chú, KHÔNG bịa). Ngoài biển lớp nào còn trong máy, lớp nào đã cũ, lớp nào hết hạn quyết định "tính lại" có còn
// đáng tin bằng bản đã lưu không. File này:
//  · `bangTrongSo(dauVao)` — bảng từng lớp: còn đủ / cũ / thiếu một phần / mất + câu hậu quả đời thường.
//  · `soVoiLucTinh(cu, moi)` — so bảng lúc TÍNH (cất cùng lộ trình) với bảng BÂY GIỜ ⇒ danh sách lớp sẽ MẤT/YẾU đi nếu
//    tính lại ⇒ màn hình khuyên "xem bản đã lưu" thay vì tính lại.
// THUẦN: màn hình gom trạng thái các kho (bản đồ cá, gió sóng, bão, bãi, model-params, triều, đáy) rồi gọi.

import { getModelParams, type ModelParams } from "@/lib/model-params";
import { gioMayBai, loTrinhParams, moHinhChang } from "./he-so";
import { heSoDay } from "./day-nghe";
import type { Nghe } from "./types";

export type MaTrongSo = "ca" | "muaVu" | "bien" | "bao" | "bai" | "trang" | "chang" | "mayBai" | "day" | "trieu";
export type TrangThaiTrongSo = "du" | "cu" | "thieu" | "mat";

export interface DongTrongSo {
  ma: MaTrongSo;
  ten: string;
  trangThai: TrangThaiTrongSo;
  /** câu đời thường: đang dùng gì / mất thì sao */
  cau: string;
}

export interface DauVaoTrongSo {
  /** giờ máy (epoch ms) */
  now: number;
  /** số ngày của chuyến (đã kẹp 16) */
  soNgay: number;
  /** ngày đi "YYYY-MM-DD" */
  ngayDi: string;
  /** bản đồ cá: mốc ảnh (epoch ms) hoặc null = chưa có */
  caLuc: number | null;
  /** lớp mùa vụ (khí hậu loài) đã có */
  coMuaVu: boolean;
  /** ngày cuối có dự báo sóng gió ("YYYY-MM-DD") hoặc null */
  bienDen: string | null;
  /** tin bão: kiểm được (true) / chưa kiểm được (false) */
  baoKiemDuoc: boolean;
  /** bãi (lớp mật độ theo nghề — tên cho bà con "Bãi dự báo có cá"): ngày đầu của bộ 16 ngày ("YYYY-MM-DD") hoặc null */
  baiTu: string | null;
  /** model-params đã nạp — từng khối */
  thamSo: { trang: boolean; chang: boolean; mayBai: boolean; day: boolean };
  /** trạm triều đã có trong máy (null = không tải được; true/false = có trạm gần cảng hay không) */
  trieu: { coTram: boolean; rangBuoc: boolean } | null;
}

const NGAY = 86_400_000;
const ngayCach = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / NGAY);
const congNgay = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * NGAY).toISOString().slice(0, 10);
/** Bản đồ cá quá ngần này ngày thì coi là CŨ (ảnh vệ tinh/khí tượng đã trôi) */
export const CA_CU_NGAY = 3;

export function bangTrongSo(x: DauVaoTrongSo): DongTrongSo[] {
  const d: DongTrongSo[] = [];
  const den = congNgay(x.ngayDi, Math.max(1, x.soNgay) - 1);
  // cá
  if (x.caLuc == null) d.push({ ma: "ca", ten: "Bản đồ cá", trangThai: "mat", cau: "Chưa có bản đồ cá trong máy — chỉ tính được theo điểm quen." });
  else {
    const tuoi = Math.floor((x.now - x.caLuc) / NGAY);
    d.push(
      tuoi > CA_CU_NGAY
        ? { ma: "ca", ten: "Bản đồ cá", trangThai: "cu", cau: `Bản đồ cá từ ${tuoi} ngày trước — vùng cá có thể đã dời.` }
        : { ma: "ca", ten: "Bản đồ cá", trangThai: "du", cau: tuoi <= 0 ? "Bản đồ cá hôm nay." : `Bản đồ cá từ ${tuoi} ngày trước.` },
    );
  }
  d.push(
    x.coMuaVu
      ? { ma: "muaVu", ten: "Mùa vụ", trangThai: "du", cau: "Có mùa vụ — ngày xa trong chuyến dựa vào vụ cá." }
      : { ma: "muaVu", ten: "Mùa vụ", trangThai: "mat", cau: "Thiếu mùa vụ — ngày xa chỉ dựa vào bản đồ cá hiện tại." },
  );
  // sóng gió
  if (!x.bienDen) d.push({ ma: "bien", ten: "Sóng gió", trangThai: "mat", cau: "Chưa có dự báo sóng gió — chưa né được ngày biển động." });
  else if (x.bienDen < den) {
    const thieu = ngayCach(x.bienDen, den);
    d.push({ ma: "bien", ten: "Sóng gió", trangThai: "thieu", cau: `Dự báo sóng gió chỉ tới ${x.bienDen.slice(8, 10)}/${x.bienDen.slice(5, 7)} — ${thieu} ngày cuối chưa né được biển động.` });
  } else d.push({ ma: "bien", ten: "Sóng gió", trangThai: "du", cau: "Có dự báo sóng gió cả chuyến." });
  d.push(
    x.baoKiemDuoc
      ? { ma: "bao", ten: "Tin bão", trangThai: "du", cau: "Đã kiểm tin bão." }
      : { ma: "bao", ten: "Tin bão", trangThai: "mat", cau: "Chưa kiểm được tin bão — app không chặn bão, phải nghe đài." },
  );
  // bãi — bộ 16 ngày từ baiTu. Tên cho bà con là "Bãi dự báo có cá" (anh Long 10/11: không nhắc bãi tàu cùng nghề)
  const BAI = "Bãi dự báo có cá";
  if (!x.baiTu) d.push({ ma: "bai", ten: BAI, trangThai: "mat", cau: "Chưa có bãi dự báo có cá của nghề này — lộ trình chỉ dựa vào bản đồ cá." });
  else {
    const het = congNgay(x.baiTu, 15);
    if (het < x.ngayDi) d.push({ ma: "bai", ten: BAI, trangThai: "mat", cau: "Bãi dự báo có cá đã quá hạn cho ngày đi — chưa tính bãi." });
    else if (het < den) d.push({ ma: "bai", ten: BAI, trangThai: "thieu", cau: `Bãi dự báo có cá chỉ tới ${het.slice(8, 10)}/${het.slice(5, 7)} — mấy ngày cuối chưa tính bãi.` });
    else d.push({ ma: "bai", ten: BAI, trangThai: "du", cau: "Có bãi dự báo có cá cả chuyến." });
  }
  const ts = (ma: MaTrongSo, ten: string, co: boolean, cauCo: string, cauMat: string) =>
    d.push({ ma, ten, trangThai: co ? "du" : "mat", cau: co ? cauCo : cauMat });
  ts("trang", "Con trăng", x.thamSo.trang, "Có ảnh hưởng trăng theo nghề.", "Thiếu số trăng — chưa tính đêm sáng trăng.");
  ts("chang", "Giờ chạy", x.thamSo.chang, "Giờ chạy theo số đo tàu cùng nghề.", "Thiếu số đo giờ chạy — tính dè dặt 5 hải lý/giờ.");
  ts("mayBai", "Dầu lúc đánh", x.thamSo.mayBai, "Dầu gồm giờ máy lúc đánh.", "Thiếu giờ máy lúc đánh — dầu chỉ tính giờ chạy.");
  ts("day", "Đáy biển", x.thamSo.day, "Đã tránh rạn, chỗ cạn theo nghề.", "Thiếu số đáy — chưa tránh rạn, chỗ cạn theo nghề.");
  if (!x.trieu) d.push({ ma: "trieu", ten: "Con nước", trangThai: "mat", cau: "Chưa có bảng con nước — chưa tính giờ ra/vào cửa." });
  else if (!x.trieu.coTram) d.push({ ma: "trieu", ten: "Con nước", trangThai: "mat", cau: "Cảng này chưa có trạm con nước gần — chưa tính giờ ra/vào cửa." });
  else
    d.push({
      ma: "trieu",
      ten: "Con nước",
      trangThai: "du",
      cau: x.trieu.rangBuoc ? "Giờ ra/vào cửa theo con nước và mớn tàu." : "Có giờ nước lớn (chưa có độ sâu luồng hoặc mớn — chỉ báo).",
    });
  return d;
}

const HANG: Record<TrangThaiTrongSo, number> = { du: 3, cu: 2, thieu: 1, mat: 0 };

/**
 * So bảng lúc TÍNH (`cu`, cất cùng lộ trình) với BÂY GIỜ (`moi`). Trả các lớp sẽ YẾU ĐI nếu tính lại bây giờ — rỗng ⇒ tính
 * lại không mất gì. `cu` vắng (lộ trình lưu trước 2026-11-08) ⇒ null: không biết lúc tính có gì, chỗ gọi nói thật.
 */
export function soVoiLucTinh(cu: readonly DongTrongSo[] | null | undefined, moi: readonly DongTrongSo[]): DongTrongSo[] | null {
  if (!cu || !Array.isArray(cu) || cu.length === 0) return null;
  const truoc = new Map<MaTrongSo, DongTrongSo>((cu as readonly DongTrongSo[]).map((r) => [r.ma, r]));
  return moi.filter((r) => {
    const t = truoc.get(r.ma);
    return t != null && HANG[r.trangThai] < HANG[t.trangThai];
  });
}

/** Câu tóm tắt cho đầu màn khi mất sóng: "Tính lại bây giờ sẽ mất: sóng gió, bãi dự báo có cá — nên xem bản đã lưu." */
export function cauMatKhiTinhLai(mat: readonly DongTrongSo[] | null): string | null {
  if (mat == null) return "Bản lưu này chưa ghi lúc tính có những dữ liệu gì — tính lại có thể khác.";
  if (mat.length === 0) return null;
  return `Tính lại bây giờ sẽ mất: ${mat.map((r) => r.ten.toLowerCase()).join(", ")} — nên xem bản đã lưu.`;
}

/** Khối model-params nào đã nạp cho nghề (đọc thẳng tham số đang dùng — cùng nguồn thuật toán đọc). */
export function thamSoTrongSo(nghe: Nghe, p: ModelParams | null = getModelParams()): DauVaoTrongSo["thamSo"] {
  return {
    trang: loTrinhParams(p).hieuUngRam != null,
    chang: moHinhChang(nghe, p).doDuoc,
    mayBai: gioMayBai(nghe, p) != null,
    day: heSoDay(nghe, 0, 0, p) !== null,
  };
}

/** Ngày cuối có dự báo trong lưới gió sóng (mốc `times` là giờ VN ISO) — null nếu lưới rỗng. */
export function bienDenCuaLuoi(grid: { times?: readonly string[]; cells?: readonly unknown[] } | null | undefined): string | null {
  const t = grid?.cells?.length ? grid.times : null;
  const cuoi = t?.length ? t[t.length - 1] : null;
  return typeof cuoi === "string" && /^\d{4}-\d{2}-\d{2}/.test(cuoi) ? cuoi.slice(0, 10) : null;
}

