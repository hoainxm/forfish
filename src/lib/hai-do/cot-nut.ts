/*
  CỘT NÚT "THÔNG MINH" của chế độ Hải đồ (2026-11-04, anh Long: "hàng nút hơi nhiều
  nên làm smart như cái bản đồ ấy"). Cùng cách màn bản đồ cũ (`lib/ban-do-lop.ts`):
  MỘT bảng quy tắc quyết định nút nào nổi, thay vì mỗi nút tự xét. Thuần, có test.

  Luôn nổi (việc làm nhiều lần mỗi chuyến): Hướng bản đồ · Về tàu · Thêm (⋯).
  Chỉ nổi khi có việc:
    · Chuông — khi có báo động (đỏ hay vàng); hết báo động thì tự lui vào khay
    · Neo    — khi đang canh neo (để thấy ngay vòng/khoảng cách, nhổ neo)
    · Đo     — khi đang đo (để tắt)
    · Phóng to / thu nhỏ — chỉ khi bà con bật trong Cài đặt (iSailor: "Zoom Buttons")
  Còn lại vào khay ⋯: Màu · Đo · Neo · Lớp · Tuyến · Vết · Cài đặt · Bản đồ thường.
  MOB KHÔNG thuộc bảng này — nút đỏ riêng góc trái, luôn có khi có GPS.
*/

export type NutNoi = "zoom" | "huong" | "chuong" | "neo" | "do" | "viTri" | "them";

export interface TinhHinhCot {
  coBaoDong: boolean;
  dangNeo: boolean;
  dangDo: boolean;
  nutZoom: boolean;
}

/** Thứ tự từ trên xuống của các nút đang nổi. */
export function nutNoi(t: TinhHinhCot): NutNoi[] {
  const ds: NutNoi[] = [];
  if (t.nutZoom) ds.push("zoom");
  ds.push("huong");
  if (t.coBaoDong) ds.push("chuong");
  if (t.dangNeo) ds.push("neo");
  if (t.dangDo) ds.push("do");
  ds.push("viTri", "them");
  return ds;
}

export type MucKhay = "mau" | "do" | "neo" | "lop" | "tuyen" | "vet" | "caiDat" | "banDo";

/** Mục trong khay ⋯ — mục đã nổi ngoài cột thì không lặp trong khay (trừ khi khay là chỗ duy nhất). */
export function mucKhay(t: TinhHinhCot, co: { lop: boolean; tuyen: boolean; vet: boolean }): MucKhay[] {
  const ds: MucKhay[] = ["mau"];
  if (!t.dangDo) ds.push("do");
  if (!t.dangNeo) ds.push("neo");
  if (co.lop) ds.push("lop");
  if (co.tuyen) ds.push("tuyen");
  if (co.vet) ds.push("vet");
  ds.push("caiDat", "banDo");
  return ds;
}
