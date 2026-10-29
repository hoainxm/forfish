// VÙNG BIỂN VIỆT NAM cho DỰ BÁO CÁ — chỉ hiện cá trong vùng biển VN (anh Long 2026-10-29:
// "chỉ hiển thị trong phạm vi vùng biển mới của Việt Nam thôi, đừng hiện ngoài vùng rồi bà con
// lại chạy ra đó là vi phạm"). Lớp cá là lời mời "ra chỗ này có cá" — vẽ ô cá bên kia ranh giới
// là chỉ đường cho tàu vượt biên, đúng lỗi IUU nặng nhất mà geofence.ts đang canh.
//
// VÙNG = "KHU VỰC ĐƯỢC PHÉP ĐÁNH BẮT" (vùng VMS `allowed`, data/vms-zones.json, "biên mới" chốt
// 2026-07-28) — tức BÊN TRONG đường ranh đỏ nét đứt bà con thấy trên bản đồ, và là đúng hình mà
// cảnh báo "x hải lý tới ranh giới" của geofence.ts đang đo. KHÔNG gộp vùng "cần chú ý" (quanh
// Hoàng Sa) và "chỉ đánh cá đáy" (giáp Indonesia): hai vùng đó nằm NGOÀI đường đỏ — bản đầu gộp
// cả ba, anh Long gửi ảnh 2026-10-29 "vẫn hiện ngoài ranh vn à". Không gộp chúng không phải nói
// Hoàng Sa không phải của Việt Nam: nhãn chủ quyền vẫn vẽ như cũ, chỉ là không MỜI tàu tới đánh cá.
// Đo 2026-10-29 với lưới độ sâu: ven bờ đất liền 392/530 điểm biển nằm trong vùng; phần còn lại là
// biển Campuchia quanh 10,3–10,6°B 103°Đ và lạch sông.
// nợ: dùng hình TĨNH trong app, chưa theo vùng admin sửa ở /quan-tri (bảng vms_zones) — nâng cấp
// khi admin bắt đầu sửa hình vùng này (lúc đó máy chủ đọc bảng, máy bà con đọc cùng nguồn).
//
// THUẦN, chạy được cả máy chủ (route /api/fish-forecast) lẫn máy bà con. Test: vung-bien-vn.test.ts.

import { insideAllowed, VN_ALLOWED_POLYS } from "@/lib/geofence";
import type { LngLat } from "@/data/vn-maritime-border";

/** Vùng được phép — DÙNG LẠI đúng hình của geofence (cảnh báo ranh giới), không dựng bản thứ hai. */
export const VN_SEA_POLYS: LngLat[][][] = VN_ALLOWED_POLYS;

/** Khung bao — loại nhanh điểm xa trước khi chạy chẵn-lẻ trên hàng nghìn đỉnh. */
const BBOX = (() => {
  let s = 90, n = -90, w = 180, e = -180;
  for (const p of VN_SEA_POLYS)
    for (const [lo, la] of p[0]) {
      if (la < s) s = la;
      if (la > n) n = la;
      if (lo < w) w = lo;
      if (lo > e) e = lo;
    }
  return { s, n, w, e };
})();

/*  NHỚ KẾT QUẢ THEO TOẠ ĐỘ: ô cá luôn nằm trên cùng một lưới 0,25°, mà mỗi lần đổi ngày / pha mùa
    vụ / đọc kho là lọc lại vài nghìn ô — đo 134 ms cho 4.485 ô trên máy chủ, điện thoại yếu chậm hơn
    nhiều lần. Lần sau tra bảng là xong. Trần 60.000 điểm (cả mảnh cắt biên) rồi xoá làm lại. */
const NHO = new Map<number, boolean>();
const NHO_TRAN = 60_000;

/** Điểm (lat, lon) có nằm trong vùng biển Việt Nam (hợp ba vùng VMS) không. */
export function trongVungBienVN(lat: number, lon: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (lat < BBOX.s || lat > BBOX.n || lon < BBOX.w || lon > BBOX.e) return false;
  // khoá = toạ độ làm tròn 1e-5° (≈ 1 m) gói vào một số — không dựng chuỗi cho mỗi ô
  const khoa = Math.round(lat * 1e5) * 1e8 + Math.round(lon * 1e5);
  const co = NHO.get(khoa);
  if (co !== undefined) return co;
  const kq = insideAllowed(lat, lon, VN_SEA_POLYS);
  if (NHO.size >= NHO_TRAN) NHO.clear();
  NHO.set(khoa, kq);
  return kq;
}

/** Bỏ mọi ô có TÂM ngoài vùng biển VN. Trả mảng mới, không đụng mảng cũ. */
export function locOTrongVung<T extends { lat: number; lon: number }>(cells: readonly T[]): T[] {
  return cells.filter((c) => trongVungBienVN(c.lat, c.lon));
}

/**
 * Bản đồ cá chỉ còn ô trong vùng biển VN. Dùng ở MỌI cửa dữ liệu cá đi qua (route máy chủ, tải
 * về, kho SW, kho bền, sau pha mùa vụ) để Sen Biển, gợi ý điểm cá, chạm xem cũng không thấy ô
 * ngoài vùng — không chỉ lớp màu. Không có `cells` thì trả nguyên.
 */
export function locBanDoCaTrongVung<F extends { cells?: readonly { lat: number; lon: number }[] }>(f: F): F {
  if (!f || !Array.isArray(f.cells)) return f;
  return { ...f, cells: locOTrongVung(f.cells) };
}

/** Số mảnh chia mỗi chiều cho ô vắt qua biên: ô 0,25° ⇒ mảnh ≈ 0,03° (≈ 3,5 km). */
const CHIA = 8;

/**
 * Hình vẽ của MỘT ô cá tâm (lat, lon), nửa cạnh `h` độ, cắt theo vùng biển VN. Ô nằm trọn trong
 * vùng ⇒ một hình vuông như cũ. Ô vắt qua biên (hoặc chạm bờ) ⇒ chia CHIA×CHIA mảnh, chỉ giữ mảnh
 * có tâm trong vùng, nên màu dừng ở sát biên thay vì tràn nửa ô (≈ 14 km) sang vùng nước ngoài.
 * Trả danh sách khung [tây, nam, đông, bắc].
 */
export function khungOTrongVung(lat: number, lon: number, h: number): [number, number, number, number][] {
  const x0 = lon - h, x1 = lon + h, y0 = lat - h, y1 = lat + h;
  const goc: [number, number][] = [[y0, x0], [y0, x1], [y1, x0], [y1, x1]];
  if (goc.every(([la, lo]) => trongVungBienVN(la, lo)) && trongVungBienVN(lat, lon))
    return [[x0, y0, x1, y1]];
  const d = (2 * h) / CHIA;
  const out: [number, number, number, number][] = [];
  for (let i = 0; i < CHIA; i++)
    for (let j = 0; j < CHIA; j++) {
      const a = x0 + j * d, b = y0 + i * d;
      if (trongVungBienVN(b + d / 2, a + d / 2)) out.push([a, b, a + d, b + d]);
    }
  return out;
}
