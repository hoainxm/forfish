// VÙNG BIỂN VIỆT NAM cho DỰ BÁO CÁ — chỉ hiện cá trong vùng biển VN (anh Long 2026-10-29:
// "chỉ hiển thị trong phạm vi vùng biển mới của Việt Nam thôi, đừng hiện ngoài vùng rồi bà con
// lại chạy ra đó là vi phạm"). Lớp cá là lời mời "ra chỗ này có cá" — vẽ ô cá bên kia ranh giới
// là chỉ đường cho tàu vượt biên, đúng lỗi IUU nặng nhất mà geofence.ts đang canh.
//
// VÙNG = HỢP BA VÙNG VMS SDVico gửi (data/vms-zones.json, "biên mới" chốt 2026-07-28):
// "được phép đánh bắt" + "cần chú ý" (gồm Hoàng Sa — vẫn là biển Việt Nam, chỉ cần chú ý) +
// "chỉ đánh cá đáy" (thềm giáp Indonesia). Đo 2026-10-29 với lưới độ sâu: 392/530 điểm biển ven
// bờ đất liền nằm trong hợp; phần còn lại là biển Campuchia quanh 10,3–10,6°B 103°Đ và lạch sông.
// nợ: dùng hình TĨNH trong app, chưa theo vùng admin sửa ở /quan-tri (bảng vms_zones) — nâng cấp
// khi admin bắt đầu sửa hình ba vùng này (lúc đó máy chủ đọc bảng, máy bà con đọc cùng nguồn).
//
// THUẦN, chạy được cả máy chủ (route /api/fish-forecast) lẫn máy bà con. Test: vung-bien-vn.test.ts.

import vmsZonesJson from "@/data/vms-zones.json";
import { insideAllowed } from "@/lib/geofence";
import type { LngLat } from "@/data/vn-maritime-border";

type Fc = { features: { geometry: { type: string; coordinates: unknown } }[] };

function polysOf(fc: Fc): LngLat[][][] {
  const out: LngLat[][][] = [];
  for (const f of fc.features) {
    const g = f.geometry;
    const list =
      g.type === "MultiPolygon"
        ? (g.coordinates as number[][][][])
        : g.type === "Polygon"
          ? [g.coordinates as number[][][]]
          : [];
    for (const poly of list) out.push(poly.map((ring) => ring.map((c) => [c[0], c[1]] as LngLat)));
  }
  return out;
}

/** Mọi polygon của ba vùng — HOẶC giữa các polygon, chẵn-lẻ trong từng polygon (luật của geofence). */
export const VN_SEA_POLYS: LngLat[][][] = [
  ...polysOf(vmsZonesJson.allowed as Fc),
  ...polysOf(vmsZonesJson.caution as Fc),
  ...polysOf(vmsZonesJson.bottomOnly as Fc),
];

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
