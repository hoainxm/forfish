// Cảng cá lớn dọc bờ biển VN — tọa độ đã kiểm chứng với Open-Meteo Marine API (ngày kiểm: 2026-06-10)
export interface FishingPort {
  id: string;        // slug khong dau, vd "vung-tau"
  name: string;      // "Vũng Tàu"
  province: string;  // "Bà Rịa – Vũng Tàu"
  lat: number;
  lon: number;
}

// Sắp xếp Bắc → Nam. Mỗi điểm đã chạy curl Marine API và nhận wave_height_max hợp lệ.
export const PORTS: FishingPort[] = [
  { id: 'cat-ba', name: 'Cát Bà', province: 'Hải Phòng', lat: 20.72, lon: 107.06 },              // verified — 0.24 m
  { id: 'lach-hoi', name: 'Lạch Hới (Sầm Sơn)', province: 'Thanh Hóa', lat: 19.74, lon: 105.95 }, // verified — 0.54 m
  { id: 'cua-lo', name: 'Cửa Lò', province: 'Nghệ An', lat: 18.8, lon: 105.75 },                  // verified — 0.58 m
  { id: 'tho-quang', name: 'Thọ Quang', province: 'Đà Nẵng', lat: 16.12, lon: 108.26 },           // verified — 0.58 m
  { id: 'sa-ky', name: 'Sa Kỳ', province: 'Quảng Ngãi', lat: 15.22, lon: 108.95 },                // verified — 0.38 m
  { id: 'quy-nhon', name: 'Quy Nhơn', province: 'Bình Định', lat: 13.76, lon: 109.27 },           // verified — 0.34 m
  { id: 'hon-ro', name: 'Hòn Rớ (Nha Trang)', province: 'Khánh Hòa', lat: 12.2, lon: 109.25 },    // verified — 0.36 m
  { id: 'phan-thiet', name: 'Phan Thiết', province: 'Bình Thuận', lat: 10.91, lon: 108.13 },      // verified — 0.86 m
  { id: 'vung-tau', name: 'Vũng Tàu', province: 'Bà Rịa – Vũng Tàu', lat: 10.34, lon: 107.09 },   // verified — 0.46 m
  { id: 'rach-gia', name: 'Rạch Giá', province: 'Kiên Giang', lat: 9.99, lon: 104.98 },           // verified — 0.64 m
];
