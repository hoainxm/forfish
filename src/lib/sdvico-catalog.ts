// Danh mục sản phẩm SDVICO theo NHÓM — logic thuần (test được).
//
// CRM không có cột phân loại; tiền tố SKU chính là phân loại nội bộ
// (xác minh trên dữ liệu thật 2026-06-10): LN_=lọc nước biển, GS_*=giám
// sát hành trình, WF_=wifi biển, LD_=lọc dầu, NHOT_/NG_=dầu nhớt,
// SONPV_=sơn tàu, AQ_/TL_=điện & lái, DV_=dịch vụ (không gợi ý bán).
//
// Nhóm để GỢI Ý cho ngư dân: khách mua rồi → app theo dõi bảo hành;
// nhóm chưa mua → hiện cho bà con biết SDVICO có gì (kèm nút hỏi mua).

export interface CatalogProduct {
  id: string;
  sku: string | null;
  name: string;
  unit: string | null;
  warrantyMonths: number;
}

export interface CatalogGroup {
  id: string;
  /** Tên nhóm tiếng đời thường */
  label: string;
  /** Một câu vì sao bà con cần */
  blurb: string;
  products: CatalogProduct[];
  /** Vài món tiêu biểu (máy/thiết bị chính) để hiện trên thẻ nhóm */
  highlights: string[];
}

interface GroupDef {
  id: string;
  label: string;
  blurb: string;
  prefixes: string[];
}

/** Thứ tự = thứ tự hiển thị: máy chính trước, vật tư tiêu hao sau. */
export const CATALOG_GROUPS: GroupDef[] = [
  {
    id: "loc-nuoc",
    label: "Máy lọc nước biển",
    blurb: "Nước ngọt ngay trên tàu — đỡ chở can, dư nước xài cả chuyến.",
    prefixes: ["LN_"],
  },
  {
    id: "giam-sat",
    label: "Giám sát hành trình (VMS)",
    blurb: "Thiết bị bắt buộc để ra khơi — SDVICO lắp tận tàu, lo luôn cước.",
    prefixes: ["GS_"],
  },
  {
    id: "wifi",
    label: "Wifi trên biển",
    blurb: "Gọi video về nhà, xem tin ngay ngoài khơi.",
    prefixes: ["WF_"],
  },
  {
    id: "loc-dau",
    label: "Lọc dầu",
    blurb: "Dầu sạch thì máy bền, đỡ tiền sửa lớn.",
    prefixes: ["LD_"],
  },
  {
    id: "nhot",
    label: "Dầu nhớt",
    blurb: "Nhớt chuyên cho máy tàu — thay đúng kỳ máy chạy êm.",
    prefixes: ["NHOT_", "NG_"],
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

export function groupIdOfSku(sku: string | null): string | null {
  if (!sku) return null;
  const s = sku.trim().toUpperCase();
  if (s.startsWith(SERVICE_PREFIX)) return null;
  for (const g of CATALOG_GROUPS) {
    if (g.prefixes.some((p) => s.startsWith(p))) return g.id;
  }
  return null;
}

/** Món "tiêu biểu" của nhóm = máy/thiết bị chính, không phải ốc vít. */
function pickHighlights(products: CatalogProduct[]): string[] {
  const main = products.filter((p) =>
    /^(máy|thiết bị|bộ |anten)/i.test(p.name),
  );
  const pool = main.length > 0 ? main : products;
  // khử model gần trùng: lấy phần tên trước chữ "Model"/số hiệu
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of pool) {
    const base = p.name.split(/ model /i)[0].trim();
    if (seen.has(base)) continue;
    seen.add(base);
    out.push(base);
    if (out.length >= 2) break;
  }
  return out;
}

/** Gom danh sách sản phẩm CRM thành nhóm hiển thị (bỏ nhóm rỗng). */
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
    (g) => {
      const list = byId.get(g.id)!;
      return {
        id: g.id,
        label: g.label,
        blurb: g.blurb,
        products: list,
        highlights: pickHighlights(list),
      };
    },
  );
}

// ── chủ đề yêu cầu gửi SDVICO (dùng chung UI + API) ───────────────────────

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
