/*
  Giá THAM KHẢO tổng hợp từ báo công khai, KHÔNG phải giá trực tiếp từ cảng.
  Khoảng giá là giá bán tại bến/cảng cho thương lái (thấp hơn giá chợ lẻ).

  Nguồn tổng hợp (tra cứu 06/2026):
  · Cá ngừ đại dương 100.000–110.000 đ/kg tại cảng Tam Quan (04/2026):
    https://dantri.com.vn/lao-dong-viec-lam/cau-duoc-ca-ngu-hon-300kg-ngu-dan-phai-thue-xe-cau-dua-len-bo-20260429212601814.htm
  · Cá ngừ sọc dưa (cá ngừ vằn) 20.000–30.000 đ/kg, giá giảm vì quy định size:
    https://nongnghiepmoitruong.vn/gia-ca-ngu-soc-dua-qua-thap-ngu-dan-muon-bo-bien-d750429.html
    https://baokhanhhoa.vn/kinh-te/202410/gia-ca-ngu-van-giam-manh-ngu-dan-gap-kho-24373cd/
  · Cá bạc má thương lái mua tại cảng 40.000–60.000 đ/kg (Nghệ An):
    https://thuysanvietnam.com.vn/nghe-an-ngu-dan-trung-dam-ca-bac-ma-dau-nam/
    https://vnexpress.net/ngu-dan-trung-dam-ca-bac-ma-4806285.html
  · Cá nục 55.000–80.000 đ/kg chợ lẻ (tại bến thấp hơn):
    https://haisansaigon.com.vn/bao-gia-ca-nuc-cac-loai-nam-2021/
  · Tôm, ghẹ xanh, cua tăng giá mạnh dịp Tết:
    https://vnexpress.net/tom-ghe-xanh-cua-tang-gia-manh-truoc-tet-4560051.html
  · Cá hố loại 1 cao hơn 20–30% loại nhỏ: https://nongsandungha.com/gia-ca-ho/
  · Bảng giá thủy sản chung: https://tepbac.com/gia-thuy-san/cat/2-thuy-san/
  Các loài không có bài báo riêng (cá cơm, mực nang, cá chim, cá thu, mực ống,
  tôm sú, ghẹ xanh) lấy theo mặt bằng giá tại bến phổ biến 2025–2026 do tổng
  hợp viên ước lượng từ giá chợ lẻ trừ phần chênh thương lái.
*/

export const PRICE_DATE = "2026-06-10"; // ngày tổng hợp

export interface PortPrice {
  id: string;
  species: string;
  unit: "đ/kg";
  minVnd: number;
  maxVnd: number;
  trend: "up" | "down" | "flat";
  region?: string;
  note?: string;
}

export const PORT_PRICES: PortPrice[] = [
  {
    id: "ca-ngu-dai-duong",
    species: "Cá ngừ đại dương",
    unit: "đ/kg",
    minVnd: 100000,
    maxVnd: 140000,
    trend: "flat",
    region: "Bình Định, Phú Yên, Khánh Hòa",
    note: "Cá trên 30 kg, câu tay được giá hơn",
  },
  {
    id: "ca-ngu-soc-dua",
    species: "Cá ngừ sọc dưa (cá ngừ vằn)",
    unit: "đ/kg",
    minVnd: 20000,
    maxVnd: 30000,
    trend: "down",
    region: "Miền Trung",
    note: "Giá thấp vì quy định cá phải dài từ 50 cm",
  },
  {
    id: "ca-thu",
    species: "Cá thu",
    unit: "đ/kg",
    minVnd: 110000,
    maxVnd: 160000,
    trend: "up",
    note: "Cá to trên 3 kg được giá hơn",
  },
  {
    id: "ca-nuc",
    species: "Cá nục",
    unit: "đ/kg",
    minVnd: 25000,
    maxVnd: 45000,
    trend: "flat",
    note: "Nục suôn được giá hơn nục gai",
  },
  {
    id: "ca-com",
    species: "Cá cơm",
    unit: "đ/kg",
    minVnd: 15000,
    maxVnd: 30000,
    trend: "flat",
    note: "Cá cơm than làm mắm được giá cao",
  },
  {
    id: "ca-chim",
    species: "Cá chim trắng biển",
    unit: "đ/kg",
    minVnd: 130000,
    maxVnd: 200000,
    trend: "up",
    note: "Hàng tươi, còn nguyên vảy bán được giá",
  },
  {
    id: "muc-ong",
    species: "Mực ống",
    unit: "đ/kg",
    minVnd: 120000,
    maxVnd: 220000,
    trend: "up",
    note: "Mực câu đêm, còn trong được giá nhất",
  },
  {
    id: "muc-nang",
    species: "Mực nang",
    unit: "đ/kg",
    minVnd: 100000,
    maxVnd: 180000,
    trend: "flat",
    note: "Con to trên nửa ký được giá hơn",
  },
  {
    id: "tom-su",
    species: "Tôm sú biển",
    unit: "đ/kg",
    minVnd: 250000,
    maxVnd: 450000,
    trend: "up",
    note: "Loại 20–30 con một ký, còn sống giá cao",
  },
  {
    id: "ghe-xanh",
    species: "Ghẹ xanh",
    unit: "đ/kg",
    minVnd: 250000,
    maxVnd: 450000,
    trend: "up",
    note: "Ghẹ chắc thịt, còn sống mới được giá này",
  },
  {
    id: "ca-ho",
    species: "Cá hố",
    unit: "đ/kg",
    minVnd: 60000,
    maxVnd: 120000,
    trend: "flat",
    note: "Cá dài 70–90 cm, thân sáng bạc là loại 1",
  },
  {
    id: "ca-bac-ma",
    species: "Cá bạc má",
    unit: "đ/kg",
    minVnd: 40000,
    maxVnd: 60000,
    trend: "up",
    region: "Nghệ An, miền Trung",
    note: "Thương lái mua ngay tại cảng",
  },
  {
    id: "ca-trich",
    species: "Cá trích",
    unit: "đ/kg",
    minVnd: 10000,
    maxVnd: 20000,
    trend: "flat",
  },
];
