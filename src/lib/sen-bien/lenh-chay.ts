// SEN BIỂN — LỆNH LÚC ĐANG CHẠY + KÊU CỨU (thuần, có test, không mạng).
//
// Anh Long 2026-11-02: "fix toàn bộ để vượt qua Mimi". Mimi (Vietmap Live) có nhóm "thông tin
// chuyến đi" (tốc độ bao nhiêu, còn bao xa, mấy giờ đến), "tìm đường khác" và nhóm khẩn cấp.
// Sen Biển đã có còn bao xa / dừng / im / đọc lại (hieu-y.ts); file này thêm phần còn thiếu:
//   · huong   — "đi hướng nào", "lái sao", "có đúng đường không" (chỉ khi đang dẫn)
//   · toc_do  — "tàu chạy mấy hải lý", "tốc độ bao nhiêu"
//   · ve_lai  — "tìm đường khác", "tính lại đường" (chỉ khi đang dẫn)
//   · cuu_nan — "cứu với", "tàu chìm", "có người rơi xuống biển": đọc TOẠ ĐỘ TÀU + 112 + VHF kênh 16.
//     Kêu cứu là việc ngoài biển cần nhất mà Mimi (đường bộ) không có; luôn nhận, kể cả khi
//     không dẫn đường, và bộ lọc câu hỏi (hoi-kho.goLenhNgan) KHÔNG được gỡ nó.
// Câu đọc lấy số từ màn bản đồ — file này chỉ chọn việc + dựng câu.

import { foldVn } from "./ngram";

export type LenhChay = "huong" | "toc_do" | "ve_lai" | "cuu_nan";

/** chữ thường giữ dấu, dấu câu ⇒ cách — so có dấu để "gió" khỏi lẫn "giờ" */
const giuDau = (s: string) => ` ${s.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;
const coDau = (s: string) => /[̀-ͯ]/.test(s.normalize("NFD")) || /đ/i.test(s);

/*  KÊU CỨU — bắt rộng, vì bỏ sót là chết người, còn bắt thừa chỉ tốn một câu đọc toạ độ.
    Trừ câu HỎI về xác tàu / luật / tiền hỗ trợ ("tàu chìm gần nhất ở đâu", "luật cứu nạn"). */
const CUU = / (cuu (toi|voi|tau|nguoi|minh|tui|em|anh)|cuu nan|cuu ho|gap nan|bi nan|keu cuu|cap cuu|mayday|tau (bi )?(chim|thung|lat|mac can)|nuoc vao tau|(nguoi|ban|ae|anh em) (roi|te|nhay) (xuong )?(bien|nuoc)|roi xuong bien|te xuong bien|tau dang chim) /;
// bỏ dấu thì "tàu cháy" = "tàu chạy", "tàu vỡ" = "tàu vô" ⇒ hai việc này chỉ nhận trên chữ CÒN dấu
const CUU_D = / (tàu (bị )?(cháy|vỡ|thủng)|cháy (tàu|máy|ca bin)|nước vô tàu) /;
// chỉ chữ chắc là HỎI/KỂ — "thế nào", "bãi đá", "phía Nam" vẫn có thể nằm trong câu kêu cứu thật
const CUU_KHONG = / (xac tau|xac|o dau|gan nhat|gan day|luat|quy dinh|muc phat|ho tro|bao hiem|kairos|hoi xua|lan truoc|nam ngoai) /;

// HƯỚNG — có dấu: "gió hướng nào" không phải hỏi lái
const HUONG_D = / (hướng nào|hướng gì|hướng mấy độ|lái hướng|lái sao|lái thế nào|lái làm sao|bẻ lái|quẹo bên nào|rẽ bên nào|bẻ bên nào|đúng đường|đúng hướng|đi đúng|lệch đường|lệch không|lệch chưa) /;
const HUONG_F = / (huong nao|huong may do|lai huong|lai sao|lai the nao|be lai|que ben nao|re ben nao|be ben nao|dung duong|dung huong|lech duong|lech khong) /;
const HUONG_KHONG_D = / (gió|sóng|dòng chảy|cá|rạn|bão|có gì|đảo|cảng|đèn|phao) /;
const HUONG_KHONG_F = / (gio|song|dong chay|ca|ran|bao|co gi|dao|cang|den|phao) /;

// TỐC ĐỘ của TÀU — "tốc độ gió" / "dòng chảy mấy hải lý" là chuyện khác
const TOC_D = / (tốc độ|mấy nút|mấy hải lý một giờ|mấy hải lý giờ|mấy cây số một giờ|chạy nhanh không|chạy chậm không|đang chạy bao nhiêu|chạy được bao nhiêu|chạy mấy hải lý) /;
const TOC_F = / (toc do|may nut|hai ly mot gio|may hai ly gio|km mot gio|chay nhanh khong|chay cham khong|dang chay bao nhieu|chay duoc bao nhieu|chay may hai ly) /;
const TOC_KHONG_D = / (gió|sóng|dòng chảy|bão|nước chảy|còn) /;
// không dấu: "gio" có thể là "giờ" ("km một giờ"), "bao" có thể là "bao nhiêu" ⇒ chỉ loại khi rõ là gió / bão
const TOC_KHONG_F = / (toc do gio|gio manh|gio cap|song|dong chay|nuoc chay|con) | bao (?!nhieu|xa|lau|gio)/;

const VE_LAI = / (ve lai duong|ve lai|tinh lai|duong khac|tim duong khac|doi duong|kiem duong khac) /;

/** Câu dài hơn thế này là câu hỏi/kể chuyện, không phải lệnh lúc lái */
const LENH_TOI_DA = 8;

/** Câu → việc; null = không phải lệnh lúc chạy / kêu cứu. `dangDan` = đang dẫn tới một đích. */
export function lenhChay(text: string, dangDan: boolean): LenhChay | null {
  const f = ` ${foldVn(text)} `;
  if (f.trim() === "") return null;
  const so = f.trim().split(" ").length;
  const d = coDau(text) ? giuDau(text) : null;
  if (so <= 14 && (CUU.test(f) || (d != null && CUU_D.test(d))) && !CUU_KHONG.test(f)) return "cuu_nan";
  if (so > LENH_TOI_DA) return null;
  if (d ? TOC_D.test(d) && !TOC_KHONG_D.test(d) : TOC_F.test(f) && !TOC_KHONG_F.test(f)) return "toc_do";
  if (!dangDan) return null;
  if (VE_LAI.test(f)) return "ve_lai";
  if (d ? HUONG_D.test(d) && !HUONG_KHONG_D.test(d) : HUONG_F.test(f) && !HUONG_KHONG_F.test(f)) return "huong";
  return null;
}

/** 14,5754 → "14 độ 34,5 phút Bắc" — đọc toạ độ cho người nghe chép lên máy bộ đàm (phút một số lẻ) */
export function toaDoDoc(v: number, axis: "lat" | "lon"): string {
  const a = Math.abs(v);
  let d = Math.floor(a);
  let m = Math.round((a - d) * 600) / 10;
  if (m >= 60) {
    d += 1;
    m = 0;
  }
  const h = axis === "lat" ? (v >= 0 ? "Bắc" : "Nam") : v >= 0 ? "Đông" : "Tây";
  return `${d} độ ${String(m).replace(".", ",")} phút ${h}`;
}

/**
 * Câu kêu cứu: toạ độ trước (người nghe cần nhất), rồi hai đường gọi. `viTri` null = máy chưa
 * có định vị ⇒ nói thật, không đọc toạ độ cũ như thể mới. `cuMs` = định vị cũ bao lâu.
 */
export function cauCuuNan(viTri: { lat: number; lon: number } | null, cuMs: number | null): string {
  const goi = "Gọi một một hai để báo tìm kiếm cứu nạn. Mất sóng điện thoại thì gọi máy bộ đàm VHF kênh mười sáu.";
  if (!viTri) return `Máy chưa có định vị của tàu. ${goi}`;
  const cu = cuMs != null && cuMs > 5 * 60_000 ? ` Định vị này cũ ${Math.round(cuMs / 60_000)} phút.` : "";
  return `Toạ độ tàu: ${toaDoDoc(viTri.lat, "lat")}, ${toaDoDoc(viTri.lon, "lon")}.${cu} ${goi}`;
}
