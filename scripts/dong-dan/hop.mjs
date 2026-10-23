// hop.mjs — MỘT nguồn định nghĩa hộp nước trồi Nam VN cho mọi script "Dòng Dẫn" VÀ cho app: dung-chain-params.mjs
// chép nguyên vào src/data/fish-chain-params.json (khối "hop"), lib/fish-chain.ts đọc từ đó. Sửa ở đây rồi dựng lại.
// Theo mô tả Herrmann và cộng sự 2023 (Ocean Science 19, 453–467); bài KHÔNG in toạ độ hộp (chỉ có trên hình 1b)
// nên toạ độ dưới đây là giả định của nghiên cứu (docs/research/du-bao-ca-dong-dan-2026-10/10-buoc-C2-ekman.md §1).
//   [vĩ độ nam, vĩ độ bắc, kinh độ tây, kinh độ đông]
export const BOXES = {
  SCU: [10.5, 12.5, 108.5, 110.5], // nước trồi ven bờ phía nam (Ninh Thuận – Bình Thuận), do gió dọc bờ
  NCU: [12.5, 14.5, 109.0, 110.5], // nước trồi ven bờ phía bắc (Khánh Hoà – Phú Yên)
  OFU: [11.0, 13.0, 110.5, 112.5], // nước trồi ngoài khơi, do bơm Ekman (curl ứng suất)
  MKU: [8.0, 10.5, 106.5, 109.0], // thềm ngoài châu thổ Mê Kông, sau Côn Đảo
  REF: [11.0, 13.0, 113.0, 115.0], // vùng tham chiếu phía đông (T_ref của chỉ số UI)
};
/** Trục dọc bờ (độ, tính từ bắc sang đông) — dương = gió đẩy về đông-bắc ⇒ vận chuyển Ekman ra khơi. */
export const COAST_AXIS_DEG = { SCU: 25, NCU: 10 };
export const inBox = (b, la, lo) => la >= b[0] - 1e-6 && la <= b[1] + 1e-6 && lo >= b[2] - 1e-6 && lo <= b[3] + 1e-6;
