// Danh mục sản phẩm SDVICO theo DÒNG SẢN PHẨM — logic thuần (test được).
//
// CRM không có cột phân loại; tiền tố SKU chính là phân loại nội bộ
// (xác minh trên dữ liệu thật 2026-06-10). User chốt: gợi ý theo TÊN DÒNG
// (lọc nước, xử lý dầu, nhớt, phụ gia diesel, giám sát hành trình, điện
// thoại vệ tinh, internet vệ tinh, sơn tàu…) — KHÔNG phô model/SKU ra
// thẻ gợi ý; model cụ thể là chuyện lúc mua, nhân viên tư vấn.

export interface CatalogProduct {
  id: string;
  sku: string | null;
  name: string;
  unit: string | null;
  warrantyMonths: number;
}

export interface CatalogGroup {
  id: string;
  /** Tên dòng sản phẩm tiếng đời thường */
  label: string;
  /** Một câu vì sao bà con cần */
  blurb: string;
  products: CatalogProduct[];
}

interface GroupDef {
  id: string;
  label: string;
  blurb: string;
  prefixes: string[];
}

/** Thứ tự = thứ tự hiển thị (theo cách user liệt kê các dòng). */
export const CATALOG_GROUPS: GroupDef[] = [
  {
    id: "loc-nuoc",
    label: "Máy lọc nước biển",
    blurb: "Nước ngọt ngay trên tàu — đỡ chở can, dư nước xài cả chuyến.",
    prefixes: ["LN_"],
  },
  {
    id: "xu-ly-dau",
    label: "Xử lý dầu",
    blurb: "Lọc sạch dầu nhiễm bẩn — máy bền, đỡ tiền sửa lớn.",
    prefixes: ["LD_"],
  },
  {
    id: "nhot",
    label: "Dầu nhớt",
    blurb: "Nhớt chuyên cho máy tàu — thay đúng kỳ máy chạy êm.",
    prefixes: ["NHOT_"],
  },
  {
    id: "phu-gia",
    label: "Phụ gia diesel",
    blurb: "Pha vào dầu chạy — máy sạch, đỡ hao dầu.",
    prefixes: ["NG_"],
  },
  {
    id: "giam-sat",
    label: "Thiết bị giám sát hành trình",
    blurb: "Thiết bị bắt buộc để ra khơi — SDVICO lắp tận tàu, lo luôn cước.",
    prefixes: ["GS_"],
  },
  {
    id: "dien-thoai-ve-tinh",
    label: "Điện thoại vệ tinh",
    blurb: "Gọi về nhà từ giữa biển — không cần sóng di động.",
    prefixes: ["GS_VSS_"],
  },
  {
    id: "internet-ve-tinh",
    label: "Internet vệ tinh (wifi biển)",
    blurb: "Cả tàu có mạng — gọi video, xem tin ngay ngoài khơi.",
    prefixes: ["WF_"],
  },
  {
    id: "son",
    label: "Sơn tàu",
    blurb: "Chống hà, chống rỉ — vỏ tàu bền giữa nước mặn.",
    prefixes: ["SONPV_"],
  },
  {
    id: "dien-lai",
    label: "Điện & lái",
    blurb: "Ắc quy, lái thủy lực và đồ điện cho tàu.",
    prefixes: ["AQ_", "TL_"],
  },
];

/** SKU dịch vụ (lắp đặt, vận chuyển) — không phải hàng để gợi ý mua. */
const SERVICE_PREFIX = "DV_";

// Tiền tố DÀI ưu tiên trước (GS_VSS_ thắng GS_) — dựng một lần ở module.
const PREFIX_RULES: { prefix: string; groupId: string }[] = CATALOG_GROUPS
  .flatMap((g) => g.prefixes.map((prefix) => ({ prefix, groupId: g.id })))
  .sort((a, b) => b.prefix.length - a.prefix.length);

export function groupIdOfSku(sku: string | null): string | null {
  if (!sku) return null;
  const s = sku.trim().toUpperCase();
  if (s.startsWith(SERVICE_PREFIX)) return null;
  for (const r of PREFIX_RULES) {
    if (s.startsWith(r.prefix)) return r.groupId;
  }
  return null;
}

/** Gom danh sách sản phẩm CRM thành dòng hiển thị (bỏ dòng rỗng). */
export function groupCatalog(products: CatalogProduct[]): CatalogGroup[] {
  const byId = new Map<string, CatalogProduct[]>();
  for (const p of products) {
    const gid = groupIdOfSku(p.sku);
    if (!gid) continue;
    const list = byId.get(gid) ?? [];
    list.push(p);
    byId.set(gid, list);
  }
  return CATALOG_GROUPS.filter((g) => (byId.get(g.id)?.length ?? 0) > 0).map(
    (g) => ({
      id: g.id,
      label: g.label,
      blurb: g.blurb,
      products: byId.get(g.id)!,
    }),
  );
}

// ── chủ đề yêu cầu gửi SDVICO (dùng chung UI + API) ───────────────────────
// (representativeProducts đã BỎ 2026-06-11 — Khuyến nghị chuyển sang
//  showcase tĩnh data/sdvico-showcase.ts, chỉ sản phẩm chính từ sdvico.vn)

export const REQUEST_TOPICS = [
  { id: "mua", label: "Hỏi mua sản phẩm" },
  { id: "sua-chua", label: "Gọi sửa chữa" },
  { id: "bao-duong", label: "Đặt lịch bảo dưỡng" },
  { id: "cuoc", label: "Hỏi cước / gia hạn" },
  { id: "khac", label: "Việc khác" },
] as const;

export type RequestTopicId = (typeof REQUEST_TOPICS)[number]["id"];

export function topicLabel(id: string): string {
  return REQUEST_TOPICS.find((t) => t.id === id)?.label ?? "Việc khác";
}
