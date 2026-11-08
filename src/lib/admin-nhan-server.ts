// CHỮ CHO TRANG QUẢN TRỊ có tên nguồn / hệ thống ngoài (2026-11-08, docs/app-map/ops/khong-lo-nguon.md nợ #10).
// CHỈ route admin import (`/api/admin/he-thong`, sau `requireAdmin`). Chunk JS của /quan-tri là file tĩnh ai cũng tải
// được, nên tên nguồn KHÔNG được viết trong component — component hiện nhãn trung tính, có nhãn này thì thay vào.

export const NHAN_QUAN_TRI = {
  /** nhãn hàng kiểm nguồn sống, theo đường route bà con gọi */
  nguon: {
    "/api/fish-forecast": "Dữ liệu dự báo cá (từ vệ tinh NOAA/Copernicus/HYCOM)",
    "/api/storms": "Thông tin cảnh báo bão khu vực Biển Đông (NCHMF/GDACS)",
    "/api/fuel-price": "Bảng giá dầu DO",
    "/api/port-prices": "Bảng giá thuỷ sản (theo VASEP)",
  } as Record<string, string>,
  /** chú thích cron thời tiết */
  cronThoiTiet:
    "Bản lưu thời tiết (Snapshots) — tiến trình tự động refresh-weather (chạy lúc 02:30 UTC/ngày để dự phòng trường hợp API Open-Meteo gặp sự cố)",
};

export type NhanQuanTri = typeof NHAN_QUAN_TRI;
