// Trục 3 — Vật tư & máy. Danh mục vật tư tham khảo cho tàu cá.
//
// Giá THAM KHẢO từ nguồn công khai (tra cứu 06/2026), giá thật theo đại lý:
// - https://tipashop.com/san-pham/nhot-castrol-crb-15w40-cf-4-18l-new (Castrol CRB 15W-40 CF-4 18L: 1.430.000 đ)
// - https://daunhotchinhhang.vn/gia-dau-nhot-castrol-crb-turbo-moi-nhat.html
// - https://dauthuyluc.org.vn/shell-rimula-r4x-15w40-chinh-hang-gia-moi-nhat/ (Shell Rimula R4 X 15W-40 xô 18L)
// - https://daunhonvietmy.com/san-pham/shell-rimula-r4-x-15w-40/
// - https://maianduc.vn/mua-mo-bo-boi-tron-o-dau-gia-mo-bo-boi-tron/ (mỡ bôi trơn 65.000–125.000 đ/kg)
// - https://www.phutungmaythuynhat.com/loc-dau-nhot-dong-co-tau-thuyen-chuyen-phu-tung-may-thuy-nhat-chinh-hang1.html
//   (lọc dầu/lọc nhiên liệu Yanmar 6HA, kẽm chống ăn mòn — đại lý báo giá theo mã máy)
// Các mặt hàng không công bố giá công khai (lọc theo mã máy, kẽm, impeller, bơm nước biển)
// lấy theo mặt bằng giá đại lý phụ tùng máy thủy phổ biến — chỉ để bà con ước lượng.

export const SUPPLY_PRICE_DATE = "2026-06-10";

export type SupplyCategory = "dau_nhot" | "loc" | "phu_tung" | "khac";

export const CATEGORY_LABELS: Record<SupplyCategory, string> = {
  dau_nhot: "Dầu nhớt",
  loc: "Lọc dầu, lọc gió",
  phu_tung: "Phụ tùng máy",
  khac: "Đồ dùng khác",
};

export interface Supply {
  id: string;
  category: SupplyCategory;
  name: string;
  spec?: string;
  priceVnd: number;
  unit: string;
}

export const SUPPLIES: Supply[] = [
  // ── Dầu nhớt ────────────────────────────────────────────────
  {
    id: "oil-castrol-crb",
    category: "dau_nhot",
    name: "Dầu máy Castrol CRB 15W-40",
    spec: "Diesel CF-4, máy tàu và máy tải nặng",
    priceVnd: 1_430_000,
    unit: "can 18 lít",
  },
  {
    id: "oil-shell-rimula",
    category: "dau_nhot",
    name: "Dầu máy Shell Rimula R4 X 15W-40",
    spec: "Diesel CI-4, máy chạy nhiều giờ",
    priceVnd: 1_680_000,
    unit: "xô 18 lít",
  },
  {
    id: "oil-total-rubia",
    category: "dau_nhot",
    name: "Dầu máy Total Rubia TIR 7400 15W-40",
    spec: "Diesel CI-4, dùng được cho máy đời cũ",
    priceVnd: 1_550_000,
    unit: "can 18 lít",
  },
  {
    id: "oil-hydraulic",
    category: "dau_nhot",
    name: "Dầu thủy lực Shell Tellus S2 M 46",
    spec: "Cho tời thu lưới, hệ lái thủy lực",
    priceVnd: 1_250_000,
    unit: "can 18 lít",
  },
  // ── Lọc dầu, lọc gió ───────────────────────────────────────
  {
    id: "filter-oil-yanmar",
    category: "loc",
    name: "Lọc dầu nhớt máy Yanmar",
    spec: "Dòng 6HA, 4JH — báo mã máy khi mua",
    priceVnd: 350_000,
    unit: "cái",
  },
  {
    id: "filter-fuel-yanmar",
    category: "loc",
    name: "Lọc nhiên liệu máy Yanmar",
    spec: "6HA2M, mã 41650-501140",
    priceVnd: 420_000,
    unit: "cái",
  },
  {
    id: "filter-oil-mitsubishi",
    category: "loc",
    name: "Lọc dầu nhớt máy Mitsubishi",
    spec: "Dòng S6R, 6D — báo mã máy khi mua",
    priceVnd: 380_000,
    unit: "cái",
  },
  {
    id: "filter-water-separator",
    category: "loc",
    name: "Lọc dầu tách nước",
    spec: "Tách nước lẫn trong dầu, đỡ hư bơm cao áp",
    priceVnd: 450_000,
    unit: "cái",
  },
  // ── Phụ tùng máy ───────────────────────────────────────────
  {
    id: "part-zinc-anode",
    category: "phu_tung",
    name: "Kẽm chống ăn mòn (zinc anode)",
    spec: "Thanh 1 kg, gắn vỏ tàu và két nước máy",
    priceVnd: 120_000,
    unit: "thanh",
  },
  {
    id: "part-impeller",
    category: "phu_tung",
    name: "Cánh bơm nước biển (impeller cao su)",
    spec: "Theo cỡ bơm — mang cánh cũ ra so",
    priceVnd: 550_000,
    unit: "cái",
  },
  {
    id: "part-belt",
    category: "phu_tung",
    name: "Dây curoa máy",
    spec: "Bản B, đo chiều dài dây cũ trước khi mua",
    priceVnd: 150_000,
    unit: "sợi",
  },
  {
    id: "part-seawater-pump",
    category: "phu_tung",
    name: "Bơm nước biển làm mát (cụm rời)",
    spec: "Cho máy Yanmar, Mitsubishi cỡ vừa",
    priceVnd: 4_500_000,
    unit: "cụm",
  },
  // ── Đồ dùng khác ───────────────────────────────────────────
  {
    id: "misc-grease",
    category: "khac",
    name: "Mỡ bò chịu nước (lithium)",
    spec: "Bơm trục láp, cối tời — không tan trong nước mặn",
    priceVnd: 95_000,
    unit: "hộp 1 kg",
  },
  {
    id: "misc-rust-spray",
    category: "khac",
    name: "Chai xịt chống rỉ sét RP7",
    spec: "Xịt ốc vít, khớp nối bị két muối",
    priceVnd: 65_000,
    unit: "chai 283 ml",
  },
  {
    id: "misc-coolant",
    category: "khac",
    name: "Nước làm mát động cơ",
    spec: "Đổ két nước ngọt, chống đóng cặn",
    priceVnd: 260_000,
    unit: "can 4 lít",
  },
];
