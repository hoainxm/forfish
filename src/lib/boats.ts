// Đa tàu — 1 chủ tàu có thể có NHIỀU tàu. Mọi dữ liệu (giấy tờ, thuyền viên,
// sản phẩm) gắn theo `boatId` của tàu đang chọn. Lưu local (chưa đăng nhập);
// khi có auth + Supabase sẽ đồng bộ theo owner_id.

import { readUserList } from "@/lib/user-list-store";
import { saveUserJson } from "@/lib/user-store";

export interface Boat {
  id: string;
  name: string;        // tên gọi tàu
  maTau?: string;      // mã/số đăng ký tàu (vd "BV-1234-TS")
  homeProvince?: string; // tỉnh cảng nhà (lọc "gần tôi")
  homePortId?: string;   // cảng hay cập (id trong fishing-ports)
  lengthM?: number;      // chiều dài Lmax (m) — chi phối quy định

  /* ── HỒ SƠ THEO GIẤY TỜ TÀU (2026-10-06) ────────────────────────────────
     Chép đúng các ô in trên 3 giấy bà con luôn mang theo: Giấy chứng nhận
     ĐĂNG KÝ tàu cá · Giấy chứng nhận AN TOÀN KỸ THUẬT (đăng kiểm) · Giấy phép
     KHAI THÁC thủy sản. Mọi ô TUỲ CHỌN và CHỈ CỘNG THÊM — kho
     `forfish.boats.v1` + gương `user_docs` (jsonb) giữ nguyên khoá, tàu cũ
     không có các ô này vẫn hợp lệ (không bump phiên bản, không migration).
     CỐ Ý KHÔNG có CCCD/địa chỉ chủ tàu: danh sách tàu đi vào tệp sao lưu
     (lib/offline-backup) còn CCCD thì không bao giờ được vào tệp; CCCD
     thuyền trưởng + chứng chỉ ở sổ thuyền viên (/nguoi). */
  ownerName?: string;      // Chủ tàu (in trên giấy đăng ký / giấy phép)
  callSign?: string;       // Hô hiệu
  regPort?: string;        // Cảng đăng ký (vd "Tam Quan")
  gear?: string;           // Nghề chính / công dụng (vd "Câu cá ngừ")
  fishingZone?: FishingZone; // Vùng hoạt động (giấy phép khai thác)
  vesselClass?: VesselClass; // Cấp tàu (giấy an toàn kỹ thuật)
  hullMaterial?: HullMaterial; // Vật liệu vỏ
  builtYear?: number;      // Năm đóng
  builtPlace?: string;     // Nơi đóng
  crewMax?: number;        // Số thuyền viên (theo đăng kiểm)
  grossTonnage?: number;   // Tổng dung tích GT
  deadweightT?: number;    // Trọng tải toàn phần (tấn)
  breadthM?: number;       // Chiều rộng Bmax (m)
  depthM?: number;         // Chiều cao mạn D (m)
  draughtM?: number;       // Chiều chìm d (m)
  engineModel?: string;    // Ký hiệu máy chính (vd "KOMATSU")
  engineSerial?: string;   // Số máy
  engineKw?: number;       // Tổng công suất máy chính (kW)
  engineCount?: number;    // Số lượng máy chính
}

export type FishingZone = "khoi" | "long" | "ven_bo";
export const FISHING_ZONE_LABEL: Record<FishingZone, string> = {
  khoi: "Vùng khơi",
  long: "Vùng lộng",
  ven_bo: "Vùng ven bờ",
};

export type VesselClass = "khong_han_che" | "han_che_1" | "han_che_2" | "han_che_3";
export const VESSEL_CLASS_LABEL: Record<VesselClass, string> = {
  khong_han_che: "Không hạn chế",
  han_che_1: "Hạn chế I",
  han_che_2: "Hạn chế II",
  han_che_3: "Hạn chế III",
};

export type HullMaterial = "go" | "thep" | "composite" | "khac";
export const HULL_MATERIAL_LABEL: Record<HullMaterial, string> = {
  go: "Gỗ",
  thep: "Thép",
  composite: "Composite",
  khac: "Khác",
};

/** Các ô "theo giấy tờ" — đếm để form nói "đã ghi N/M mục" (không tính tên,
 *  mã tàu, tỉnh, chiều dài: bốn ô đó luôn hiện sẵn ở đầu form). */
export const BOAT_PAPER_FIELDS = [
  "ownerName",
  "callSign",
  "regPort",
  "gear",
  "fishingZone",
  "vesselClass",
  "hullMaterial",
  "builtYear",
  "builtPlace",
  "crewMax",
  "grossTonnage",
  "deadweightT",
  "breadthM",
  "depthM",
  "draughtM",
  "engineModel",
  "engineSerial",
  "engineKw",
  "engineCount",
] as const satisfies readonly (keyof Boat)[];

/** Số ô theo giấy tờ đã ghi (rỗng/undefined không tính). */
export function countPaperFields(b: Boat): number {
  return BOAT_PAPER_FIELDS.filter((k) => {
    const v = b[k];
    return v !== undefined && v !== null && v !== "";
  }).length;
}

/**
 * Đọc SỐ bà con gõ theo thói quen Việt: dấu PHẨY thập phân ("55,60", "5,25")
 * như in trên giấy đăng kiểm. `parseFloat("55,60")` cũ ra 55 — sai lặng lẽ.
 *  · rỗng            → { ok: true, value: undefined } (ô tuỳ chọn)
 *  · số hợp lệ ≥ 0   → { ok: true, value }
 *  · chữ lạ / âm / nhiều dấu thập phân / > max → { ok: false } (form báo, không lưu)
 */
export function parseBoatNumber(
  raw: string,
  max = 100_000,
): { ok: true; value: number | undefined } | { ok: false } {
  const t = (raw ?? "").trim().replace(/\s+/g, "");
  if (t === "") return { ok: true, value: undefined };
  if (!/^\d+([.,]\d+)?$/.test(t)) return { ok: false };
  const v = Number(t.replace(",", "."));
  if (!Number.isFinite(v) || v > max) return { ok: false };
  return { ok: true, value: v };
}

/** Năm đóng: 4 chữ số, 1950 … năm nay (không nhận năm tương lai). */
export function parseBuiltYear(
  raw: string,
  thisYear: number,
): { ok: true; value: number | undefined } | { ok: false } {
  const t = (raw ?? "").trim();
  if (t === "") return { ok: true, value: undefined };
  if (!/^\d{4}$/.test(t)) return { ok: false };
  const y = Number(t);
  if (y < 1950 || y > thisYear) return { ok: false };
  return { ok: true, value: y };
}

/** kW → mã lực (CV) như giấy đăng kiểm in kèm: 566 kW ⇒ 770 CV. */
export function kwToCv(kw: number): number {
  return Math.round(kw * 1.35962);
}

/** Số in ra theo kiểu Việt ("55,6") để đổ lại vào ô sửa. */
export function formatBoatNumber(n: number | undefined): string {
  return n == null ? "" : String(n).replace(".", ",");
}

const BOATS_KEY = "forfish.boats.v1";
const CURRENT_KEY = "forfish.currentBoat.v1";

/**
 * KHÔNG ĐỌC ĐƯỢC DANH SÁCH TÀU ⇒ KHOÁ CỬA GHI (K4, 2026-08-02).
 *
 * Đây đúng cảnh mà `lib/user-store.ts` gọi tên: đọc hỏng thì ĐỪNG cho ghi đè.
 * Một ký tự JSON hỏng mà vẫn cho `saveBoats` chạy là cú `addBoat`/`updateBoat`
 * đầu tiên ĐÈ danh sách rỗng lên sổ thật: mất cả đội tàu, mà MỌI dữ liệu khác
 * (giấy tờ, thuyền viên, bảo dưỡng) đều gắn theo `boatId` nên mất tàu là mất
 * đường về của hết thảy.
 *
 * Cờ đặt Ở TẦNG KHO vì `boat-store.ts` (chỗ gọi) không có ô hiện câu báo. Đọc
 * hỏng thì `loadBoats` trả [] để app còn mở được, nhưng KHÔNG cho ghi đè — mở
 * lại app là đọc lại sổ gốc.
 */
let readFailed = false;

/** Lần đọc danh sách tàu gần nhất có hỏng không (chỗ gọi muốn báo thì đã có). */
export function boatsReadFailed(): boolean {
  return readFailed;
}

export function loadBoats(): Boat[] {
  if (typeof window === "undefined") return [];
  const r = readUserList<Boat>(BOATS_KEY);
  readFailed = !r.ok;
  // KHÔNG seed tàu mẫu — sdvico đã bỏ demo (chốt 2026-07-29); user tự thêm tàu thật.
  return r.list ?? [];
}

/** Trả `false` khi máy KHÔNG giữ được (đọc hỏng → cấm đè; hoặc hết chỗ). */
export function saveBoats(boats: Boat[]): boolean {
  if (readFailed) return false;
  return saveUserJson(BOATS_KEY, boats);
}

export function loadCurrentBoatId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(CURRENT_KEY);
  } catch {
    return null;
  }
}

export function saveCurrentBoatId(id: string) {
  try {
    window.localStorage.setItem(CURRENT_KEY, id);
  } catch {
    /* ignore */
  }
}
