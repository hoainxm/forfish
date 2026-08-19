/**
 * Trục 1 — NHÃN ĐẢO + TUYẾN HÀNG HẢI trên hải đồ.
 *
 * File này giữ TYPE + LUẬT KIỂM (thuần, test được) cho dataset tĩnh
 * public/data/vn-islands.v1.json và vn-sea-lanes.v1.json (sinh bởi
 * scripts/generate-islands.mjs · generate-sea-lanes.mjs). Component render
 * thẳng bằng lớp symbol/line của MapLibre — file này KHÔNG vẽ, chỉ định nghĩa
 * hình dạng dữ liệu và cổng chủ quyền để test chặn.
 *
 * VÌ SAO CÓ CỔNG CHỦ QUYỀN: tên đảo phải 100% tiếng Việt — chủ dự án chốt
 * 2026-08-07 "không được để bất kỳ nhãn tiếng Trung, tiếng Hán hoặc yếu tố
 * nhạy cảm nào". Generator đã tự kiểm, nhưng dữ liệu là asset ship kèm app nên
 * phải có một test đọc file THẬT canh lại — sửa tay file JSON mà lọt ký tự Hán
 * thì test đỏ, không tới được tay bà con.
 */

export type IslandGroup = "ven-bo" | "hoang-sa" | "truong-sa";
export type IslandType = "dao" | "da" | "bai" | "con" | "quan-dao";

export type IslandProps = {
  name: string;
  type: IslandType;
  group: IslandGroup;
  admin: string;
  /** 1 = lớn (hiện sớm) · 2 · 3 = nhỏ (chỉ khi zoom sâu) — symbol-sort-key */
  rank: 1 | 2 | 3;
};

export type LaneKind =
  | "tuyen" // tuyến hàng hải lớn (vẽ tay, có `ten`)
  | "luong" // luồng vào cảng (fairway)
  | "phanluong" // sơ đồ phân luồng / traffic separation
  | "cap" // cáp/ống ngầm
  | "vungcam" // vùng cấm / khu hạn chế (outline)
  | "giankhoan"; // giàn khoan / công trình biển (điểm)

/** Loại tuyến vẽ dạng đường (LineString); `giankhoan` là điểm (Point). */
export const LANE_KINDS: LaneKind[] = [
  "tuyen",
  "luong",
  "phanluong",
  "cap",
  "vungcam",
  "giankhoan",
];

/**
 * Ký tự Hán/CJK bị CẤM trong nhãn: CJK cơ bản + mở rộng A + nét + ký hiệu +
 * Kangxi + tương thích. Có MỘT ký tự là nhãn coi như bẩn.
 */
export const FORBIDDEN_NAME_RE =
  /[⺀-⿟　-〿㐀-䶿一-鿿豈-﫿]/;

export function hasForbiddenChars(name: string): boolean {
  return FORBIDDEN_NAME_RE.test(name);
}

/** Khung biển VN (gồm Hoàng Sa/Trường Sa) — bắt lỗi đổi DMS→decimal sai. */
export const VN_SEA_BBOX = { lngMin: 102, lngMax: 118, latMin: 4, latMax: 24 };

export function coordInVNSea(lng: number, lat: number): boolean {
  return (
    lng >= VN_SEA_BBOX.lngMin &&
    lng <= VN_SEA_BBOX.lngMax &&
    lat >= VN_SEA_BBOX.latMin &&
    lat <= VN_SEA_BBOX.latMax
  );
}

/** Đơn vị hành chính GÁN CỨNG theo group (chủ quyền VN) — nguồn ngoài không
    được ghi đè. ven-bo có admin riêng từng đảo nên không kiểm ở đây. */
export const EXPECTED_ADMIN: Partial<Record<IslandGroup, string>> = {
  "hoang-sa": "TP Đà Nẵng",
  "truong-sa": "tỉnh Khánh Hòa",
};

export type IslandProblem = { name: string; reason: string };

/**
 * Soát một tập feature đảo (GeoJSON Point) — trả về danh sách vấn đề (rỗng =
 * sạch). Kiểm: (1) tên không có ký tự Hán, (2) toạ độ trong khung VN, (3)
 * admin Hoàng Sa/Trường Sa đúng chủ quyền.
 */
export function validateIslandFeatures(
  features: {
    properties?: Partial<IslandProps> | null;
    geometry?: { type?: string; coordinates?: number[] } | null;
  }[],
): IslandProblem[] {
  const problems: IslandProblem[] = [];
  for (const f of features) {
    const p = f.properties ?? {};
    const name = p.name ?? "(không tên)";
    if (!p.name) problems.push({ name, reason: "thiếu tên" });
    else if (hasForbiddenChars(p.name))
      problems.push({ name, reason: "có ký tự Hán/CJK" });

    const coords = f.geometry?.coordinates;
    if (!coords || coords.length < 2)
      problems.push({ name, reason: "thiếu toạ độ" });
    else if (!coordInVNSea(coords[0], coords[1]))
      problems.push({ name, reason: `toạ độ ngoài khung VN [${coords[0]},${coords[1]}]` });

    const expected = p.group ? EXPECTED_ADMIN[p.group] : undefined;
    if (expected && p.admin !== expected)
      problems.push({ name, reason: `admin phải "${expected}", gặp "${p.admin}"` });
  }
  return problems;
}
