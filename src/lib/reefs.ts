/**
 * Trục 1 — LỚP RẠN / ĐÁ NGẦM / BÃI CẠN trên hải đồ (toggle "Đá ngầm · Rạn").
 *
 * File này giữ TYPE + LUẬT KIỂM (thuần, test được) cho dataset tĩnh
 * public/data/coral-reefs.v1.json (sinh bởi scripts/generate-coral-reefs.mjs).
 * Component render thẳng bằng lớp symbol của MapLibre — file này KHÔNG vẽ.
 *
 * VÌ SAO TÁCH KHỎI islands.ts: đây là lớp BẬT–TẮT riêng (đá ngầm/rạn chìm dưới
 * nước — hiểm hoạ đi tàu + cấu trúc cá đáy), khác nhãn ĐẢO NỔI luôn-hiện của
 * vn-islands. Nhưng DÙNG LẠI cổng chủ quyền của islands.ts (chặn ký tự Hán/CJK,
 * khung biển VN) — cùng một mối lo, không nhân bản (nguyên tắc 3).
 *
 * CỔNG CHỦ QUYỀN: tên rạn/bãi phải 100% tiếng Việt — chủ dự án chốt "không được
 * để bất kỳ nhãn tiếng Trung/Hán hoặc tên nước ngoài nào". Nguồn tên: Wikipedia
 * tiếng Việt (toạ độ + tên là dữ kiện). Tên nước ngoài (Second Thomas Shoal,
 * Vanguard Bank, Whitsun Reef…) KHÔNG bao giờ vào field `name`.
 *
 * ## Assumptions
 * - Group `them-luc-dia` (cụm nhà giàn DK1: Tư Chính, Vũng Mây…) tách riêng vì
 *   các bãi này ở thềm lục địa phía Nam, KHÔNG thuộc quần đảo Trường Sa về địa
 *   lý. Admin gán "Thềm lục địa phía Nam" (nhãn chủ quyền rõ, tránh khẳng định
 *   một đơn vị tỉnh đang biến động sau sáp nhập 2025).
 * - v1 chỉ có feature điểm (nhãn tên). Hình dạng rạn (polygon) từ Allen Coral
 *   Atlas sẽ thêm sau vào cùng file + mở rộng validate cho Polygon.
 */

import { hasForbiddenChars, coordInVNSea } from "@/lib/islands";

export type ReefGroup = "ven-bo" | "hoang-sa" | "truong-sa" | "them-luc-dia";
/** rạn san hô | đá (ngầm/nửa nổi) | bãi cạn·bãi ngầm | cồn/cát */
export type ReefType = "ran" | "da" | "bai" | "con";

export type ReefProps = {
  name: string;
  type: ReefType;
  group: ReefGroup;
  admin: string;
  /** 1 = lớn (hiện sớm) · 2 · 3 = nhỏ (chỉ khi zoom sâu) — symbol-sort-key */
  rank: 1 | 2 | 3;
};

/** Đơn vị hành chính GÁN CỨNG theo group (chủ quyền VN) — nguồn ngoài không đè. */
export const EXPECTED_REEF_ADMIN: Partial<Record<ReefGroup, string>> = {
  "hoang-sa": "TP Đà Nẵng",
  "truong-sa": "tỉnh Khánh Hòa",
  "them-luc-dia": "Thềm lục địa phía Nam",
};

export type ReefProblem = { name: string; reason: string };

/**
 * Soát một tập feature rạn/bãi (GeoJSON Point) — trả về danh sách vấn đề (rỗng =
 * sạch). Kiểm: (1) tên không có ký tự Hán/CJK, (2) toạ độ trong khung VN, (3)
 * admin Hoàng Sa/Trường Sa/thềm lục địa đúng chủ quyền.
 */
export function validateReefFeatures(
  features: {
    properties?: Partial<ReefProps> | null;
    geometry?: { type?: string; coordinates?: number[] } | null;
  }[],
): ReefProblem[] {
  const problems: ReefProblem[] = [];
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
      problems.push({
        name,
        reason: `toạ độ ngoài khung VN [${coords[0]},${coords[1]}]`,
      });

    const expected = p.group ? EXPECTED_REEF_ADMIN[p.group] : undefined;
    if (expected && p.admin !== expected)
      problems.push({
        name,
        reason: `admin phải "${expected}", gặp "${p.admin}"`,
      });
  }
  return problems;
}
