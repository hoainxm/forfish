// DANH BẠ "BÁN Ở ĐÂU" do ADMIN quản lý (2026-07-28) — gộp 3 mục công khai của
// trục Giao dịch (/tien → "Bán ở đâu"): Nậu vựa · Chợ đầu mối · Nhà máy. Thay 3
// bộ dữ liệu tĩnh (data/wholesalers, market-channels, seafood-buyers) bằng bảng
// Supabase `sell_contacts` — admin sửa/ẩn/hiện/xóa/thêm ngay trong /quan-tri tab
// "Chỗ bán", áp dụng NGAY cho app. ("Mối quen" vẫn là localStorage RIÊNG của bà
// con — KHÔNG đụng.)
//
// Đọc CÔNG KHAI (RLS visible=true). Chưa cấu hình / lỗi / bảng TRỐNG → app rơi về
// STATIC_SELL_CONTACTS (gộp từ 3 bộ tĩnh) — giữ nguyên hành vi cũ. Admin bấm
// "Nạp danh bạ mặc định" (POST action=seed) để đưa dữ liệu tĩnh vào bảng rồi
// quản lý tiếp.

import { createClient } from "@/lib/supabase/client";
import { WHOLESALERS } from "@/data/wholesalers";
import { WHOLESALE_MARKETS } from "@/data/market-channels";
import { SEAFOOD_BUYERS } from "@/data/seafood-buyers";

/** Nhóm đầu mối: vựa (nậu vựa/vựa) · cho (chợ đầu mối) · nhamay (nhà máy/DN) */
export type SellKind = "vua" | "cho" | "nhamay";
export const SELL_KINDS: SellKind[] = ["vua", "cho", "nhamay"];
export const SELL_KIND_LABEL: Record<SellKind, string> = {
  vua: "Nậu vựa",
  cho: "Chợ đầu mối",
  nhamay: "Nhà máy",
};

export interface SellContact {
  id: string;
  kind: SellKind;
  name: string;
  /** nhãn phụ (loại vựa: "Nậu vựa"/"Đại lý"…, hoặc loại nhà máy) — chỉ hiển thị */
  subLabel?: string;
  province?: string;
  address?: string;
  phone?: string;
  /** giờ họp (chợ đầu mối) */
  hours?: string;
  species: string[];
  /** thị trường bán đi (nhà máy): EU/Mỹ/Nhật… */
  markets: string[];
  /** URL nguồn/website */
  website?: string;
  /** nhà máy mua trực tiếp từ tàu/cảng */
  direct: boolean;
  note?: string;
  visible: boolean;
  sortOrder: number;
  createdAt?: string;
}

export interface SellContactDraft {
  kind: SellKind;
  name: string;
  subLabel?: string;
  province?: string;
  address?: string;
  phone?: string;
  hours?: string;
  species: string[];
  markets: string[];
  website?: string;
  direct: boolean;
  note?: string;
  visible: boolean;
}

const TABLE = "sell_contacts";

const WHOLESALER_KIND_LABEL: Record<string, string> = {
  vua: "Vựa hải sản",
  "co-so-thu-mua": "Cơ sở thu mua",
  "dai-ly": "Đại lý thu mua",
  "nau-vua": "Nậu vựa",
};

// ── STATIC fallback (gộp 3 bộ tĩnh) — cũng là nguồn cho "Nạp danh bạ mặc định" ─
export const STATIC_SELL_CONTACTS: SellContact[] = (() => {
  const out: SellContact[] = [];
  let i = 0;
  for (const w of WHOLESALERS) {
    out.push({
      id: `w-${w.id}`,
      kind: "vua",
      name: w.name,
      subLabel: WHOLESALER_KIND_LABEL[w.kind] ?? "Vựa",
      province: w.province,
      address: w.address,
      phone: w.phone,
      species: w.species ?? [],
      markets: [],
      website: w.source,
      direct: false,
      note: w.note,
      visible: true,
      sortOrder: i++,
    });
  }
  for (const m of WHOLESALE_MARKETS) {
    out.push({
      id: `m-${m.id}`,
      kind: "cho",
      name: m.name,
      province: m.province,
      address: m.address,
      hours: m.hours,
      species: m.species ?? [],
      markets: [],
      direct: false,
      note: m.note,
      visible: true,
      sortOrder: i++,
    });
  }
  for (const b of SEAFOOD_BUYERS) {
    out.push({
      id: `b-${b.id}`,
      kind: "nhamay",
      name: b.name,
      province: b.province,
      species: b.species ?? [],
      markets: b.markets ?? [],
      website: b.website,
      direct: b.direct ?? false,
      note: b.note,
      visible: true,
      sortOrder: i++,
    });
  }
  return out;
})();

/** Bản draft (không id/visible/sortOrder) cho seed — dùng ở API "Nạp mặc định". */
export function defaultSellContactDrafts(): SellContactDraft[] {
  return STATIC_SELL_CONTACTS.map((c) => ({
    kind: c.kind,
    name: c.name,
    subLabel: c.subLabel,
    province: c.province,
    address: c.address,
    phone: c.phone,
    hours: c.hours,
    species: c.species,
    markets: c.markets,
    website: c.website,
    direct: c.direct,
    note: c.note,
    visible: true,
  }));
}

// ── Helper THUẦN (test được) ────────────────────────────────────────────────

export function validateSellContactDraft(d: SellContactDraft): string | null {
  if (!d.name.trim()) return "Nhập tên đầu mối.";
  if (!SELL_KINDS.includes(d.kind)) return "Nhóm đầu mối không hợp lệ.";
  return null;
}

function toStrArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

type Row = {
  id: string;
  kind: string;
  name: string;
  sub_label: string | null;
  province: string | null;
  address: string | null;
  phone: string | null;
  hours: string | null;
  species: unknown;
  markets: unknown;
  website: string | null;
  direct: boolean;
  note: string | null;
  visible: boolean;
  sort_order: number;
  created_at: string;
};

export function rowToSellContact(r: Row): SellContact {
  return {
    id: r.id,
    kind: SELL_KINDS.includes(r.kind as SellKind) ? (r.kind as SellKind) : "vua",
    name: r.name,
    subLabel: r.sub_label ?? undefined,
    province: r.province ?? undefined,
    address: r.address ?? undefined,
    phone: r.phone ?? undefined,
    hours: r.hours ?? undefined,
    species: toStrArr(r.species),
    markets: toStrArr(r.markets),
    website: r.website ?? undefined,
    direct: r.direct,
    note: r.note ?? undefined,
    visible: r.visible,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
  };
}

const COLS =
  "id,kind,name,sub_label,province,address,phone,hours,species,markets,website,direct,note,visible,sort_order,created_at";

/**
 * Danh bạ đang HIỆN cho app. null = chưa cấu hình / lỗi → caller dùng
 * STATIC_SELL_CONTACTS. Mảng RỖNG cũng coi như "chưa nạp" → fallback tĩnh (để
 * app không bao giờ trắng danh bạ nếu admin chưa bấm "Nạp mặc định").
 */
export async function fetchPublicSellContacts(): Promise<SellContact[] | null> {
  const supabase = createClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from(TABLE)
    .select(COLS)
    .eq("visible", true)
    .order("sort_order", { ascending: true })
    .limit(1000)
    // đồng hồ 12 giây (D-PH9) — hỏng thì rơi về danh bạ tĩnh, nhưng không có
    // trần là để lại kết nối treo suốt phiên ở sóng "sống mà chết"
    .abortSignal(AbortSignal.timeout(12000));
  if (error || !data || data.length === 0) return null;
  return (data as Row[]).map(rowToSellContact);
}
