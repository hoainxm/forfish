// CHẾ ĐỘ BẢN ĐỒ → LỚP NỔI NÀO ĐƯỢC HIỆN (thuần, có test). 07 §10.7 Y.
//
// Anh Long 2026-11-02: "cái của họ thấy nút ít, có che màn hình tùm lum như cái của mình đâu".
// Đo thật (iPhone 375×812): rảnh 24 % bị che · đang tìm 50 % / 20 nút · lộ trình 42 % / 18 nút ·
// dẫn đường 40 % / 278 chữ. Gốc: mỗi nút nổi tự xét lúc nào hiện. Vietmap (dịch ngược 3.4.4)
// làm ngược lại: MỘT bản đồ, MỘT trạng thái (idle · searching · routing · navigation), mỗi trạng
// thái định sẵn lớp nào nổi. Ở đây làm đúng vậy: cha tính `cheDoBanDo` một lần, mọi lớp nổi
// hỏi `lopHien(cheDo, lop)`. Cảnh báo an toàn (tin bão, ranh giới, HUD dẫn đường, dòng đỏ)
// KHÔNG nằm trong bảng — không chế độ nào được giấu chúng.

export type CheDoBanDo = "ranh" | "tim" | "bang" | "tuyen" | "dan";

export type LopNoi =
  /** ô "Đi đâu?" */
  | "oTim"
  /** cột phải trên: nút Lớp + nút ⋯ (và bảng của chúng) */
  | "rail"
  /** ô toạ độ tàu / con trỏ */
  | "toaDo"
  /** icon Sen Biển nổi */
  | "senBien"
  /** nút loa (đọc cảnh báo theo vị trí) */
  | "nutLoa"
  /** nút về vị trí tàu */
  | "nutViTri"
  /** đồng hồ tốc độ góc trái dưới */
  | "tocDo"
  /** viên gió sóng mép phải + ngăn của nó */
  | "ngan"
  /** dock điều hướng chính (Trang chủ · Bản đồ · …) */
  | "dock"
  /** lớp phụ: chú giải, thẻ tiếp tục chuyến, quảng cáo nổi, chip dữ liệu thiếu */
  | "phu";

/** Thứ tự ưu tiên: đang dẫn > đang xem tuyến > đang tìm > đang mở một bảng > rảnh. */
export function cheDoBanDo(s: { dan: boolean; tuyen: boolean; tim: boolean; bang: boolean }): CheDoBanDo {
  if (s.dan) return "dan";
  if (s.tuyen) return "tuyen";
  if (s.tim) return "tim";
  if (s.bang) return "bang";
  return "ranh";
}

const TAT_CA: readonly LopNoi[] = ["oTim", "rail", "toaDo", "senBien", "nutLoa", "nutViTri", "tocDo", "ngan", "dock", "phu"];

export const LOP_THEO_CHE_DO: Record<CheDoBanDo, ReadonlySet<LopNoi>> = {
  ranh: new Set(TAT_CA),
  // tìm: chỉ còn ô tìm + danh sách (Vietmap: màn tìm che kín) — bản đồ mờ phía sau
  tim: new Set<LopNoi>(["oTim"]),
  // một bảng việc đang mở (Lớp/⋯/menu chạm giữ/khu trú bão/thẻ Sen Biển): giữ ô tìm, rail, dock
  bang: new Set<LopNoi>(["oTim", "rail", "dock"]),
  // xem tuyến: bảng Lộ trình ở đáy là việc chính; giữ Lớp (xem sóng gió dọc tuyến) + về tàu
  tuyen: new Set<LopNoi>(["rail", "nutViTri"]),
  // dẫn đường: băng lệnh trên + thanh đáy là đủ; Sen Biển (gọi rảnh tay) + về tàu
  dan: new Set<LopNoi>(["senBien", "nutViTri"]),
};

export function lopHien(cheDo: CheDoBanDo, lop: LopNoi): boolean {
  return LOP_THEO_CHE_DO[cheDo].has(lop);
}
