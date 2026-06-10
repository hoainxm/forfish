// "AI ĐANG CẦN MUA" — yêu cầu loài + khối lượng + giá từ đầu nậu / vựa /
// nhà máy, để ngư dân xem trong chỗ giao dịch và gọi chào bán.
//
// LỘ TRÌNH (user chốt 2026-06-10): sẽ có app riêng cho bên thu mua tự đăng
// yêu cầu → tin chảy về đây theo thời gian thực. TRONG LÚC CHỜ, file này chỉ
// chứa TIN MẪU (demo: true, không có SĐT thật) để bà con hình dung màn hình —
// UI bắt buộc ghi rõ "tin mẫu". KHÔNG được bịa tin thật.
//
// Types trung lập: app thu mua sau này (hoặc bảng Supabase) chỉ cần trả đúng
// shape BuyRequest là UI chạy, không sửa component.

export type BuyerKind = "nau" | "vua" | "nha-may" | "cho";

export const BUYER_KIND_LABEL: Record<BuyerKind, string> = {
  nau: "Nậu",
  vua: "Vựa / đại lý",
  "nha-may": "Nhà máy",
  cho: "Chợ đầu mối",
};

export interface BuyRequest {
  id: string;
  /** Tên đơn vị cần mua */
  buyer: string;
  kind: BuyerKind;
  /** Loài cần mua, tiếng đời thường */
  species: string;
  /** Khối lượng cần — chữ tự do ("~2 tấn/ngày", "500 kg/chuyến") */
  quantity: string;
  /** Giá đề nghị — chữ tự do ("28–32 nghìn/kg", "theo chợ + 5%") */
  priceText: string;
  province: string;
  /** SĐT liên hệ — tin mẫu KHÔNG có */
  phone?: string;
  /** ISO date ngày đăng */
  postedOn: string;
  note?: string;
  /** true = tin mẫu minh họa, UI phải ghi rõ */
  demo?: true;
}

/** TIN MẪU — minh họa màn hình trong lúc app bên thu mua đang xây. */
export const BUY_REQUESTS: BuyRequest[] = [
  {
    id: "demo-br-1",
    buyer: "Nhà máy chế biến (tin mẫu)",
    kind: "nha-may",
    species: "Cá ngừ sọc dưa",
    quantity: "Cần đều ~3 tấn/ngày",
    priceText: "Giá theo chợ, cộng thêm cho cá ướp đá chuẩn",
    province: "Khánh Hòa",
    postedOn: "2026-06-09",
    note: "Yêu cầu cá ướp đá ngay khi lên khoang.",
    demo: true,
  },
  {
    id: "demo-br-2",
    buyer: "Vựa hải sản (tin mẫu)",
    kind: "vua",
    species: "Mực ống",
    quantity: "500 kg – 1 tấn/chuyến",
    priceText: "Báo giá theo ngày, ứng tổn cho mối quen",
    province: "Bà Rịa - Vũng Tàu",
    postedOn: "2026-06-08",
    demo: true,
  },
  {
    id: "demo-br-3",
    buyer: "Nậu thu gom (tin mẫu)",
    kind: "nau",
    species: "Cá thu",
    quantity: "Gom theo chuyến, không giới hạn",
    priceText: "Thỏa thuận tại bến",
    province: "Quảng Ngãi",
    postedOn: "2026-06-07",
    demo: true,
  },
];
