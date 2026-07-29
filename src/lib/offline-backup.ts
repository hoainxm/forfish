// Trục 1 — SAO LƯU / PHỤC HỒI dữ liệu offline ra TỆP.
//
// Vì sao: bản tải sẵn nằm ở localStorage (gió/sóng/lớp màu/độ mặn/nước dâng/dòng
// chảy) + kho Service Worker (bản đồ cá). Máy/trình duyệt CÓ THỂ tự xoá cache
// (hết chỗ, "xoá dữ liệu web", cài lại app). Bà con đi biển dài mà mất sạch là
// nguy. Nay cho LƯU RA TỆP .json cầm theo, và PHỤC HỒI lại khi app lỡ xoá.
//
// Thuần dữ liệu — KHÔNG nguồn mới. parseBackup tách riêng để test được.

/** Khoá localStorage của app đều bắt đầu forfish.* (quy ước dự án) */
const LS_PREFIX = "forfish.";
/**
 * KHÔNG sao lưu các khoá QUYỀN/định danh — nếu không, chia tệp cho người khác là
 * chia luôn "dấu premium" (forfish.tier.premium.v1) → import vào máy thường sẽ
 * MỞ KHOÁ bản đồ cá premium offline (leo thang quyền). Tệp chỉ mang DỮ LIỆU dự
 * báo CÔNG KHAI, không mang entitlement. (Đăng nhập nằm ở cookie Supabase, không
 * ở localStorage, nên không lo giả mạo user.)
 */
const SKIP_PREFIXES = ["forfish.tier."];
const isBackupable = (k: string) =>
  k.startsWith(LS_PREFIX) && !SKIP_PREFIXES.some((p) => k.startsWith(p));
/** Kho /api/* của Service Worker — khớp SDFISH_API_V trong public/sw.js */
const API_CACHE = "sdfish-api-v1";
const FISH_URL = "/api/fish-forecast";

export interface OfflineBackup {
  v: 1;
  savedAt: number;
  /** mọi cặp key→value forfish.* trong localStorage */
  ls: Record<string, string>;
  /** payload bản đồ cá lấy từ kho SW (nếu có) */
  fish?: unknown;
}

/** Kiểm tra + ép kiểu chuỗi JSON → bản sao lưu hợp lệ (thuần, có test). */
export function parseBackup(json: string): OfflineBackup | null {
  let b: unknown;
  try {
    b = JSON.parse(json);
  } catch {
    return null;
  }
  if (
    !b ||
    typeof b !== "object" ||
    (b as OfflineBackup).v !== 1 ||
    typeof (b as OfflineBackup).ls !== "object" ||
    (b as OfflineBackup).ls == null
  ) {
    return null;
  }
  return b as OfflineBackup;
}

/** Gom mọi bản đã lưu (localStorage forfish.* + bản đồ cá trong kho SW) → JSON. */
export async function exportOfflineData(): Promise<string> {
  const ls: Record<string, string> = {};
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && isBackupable(k)) ls[k] = window.localStorage.getItem(k) ?? "";
    }
  } catch {
    /* SSR / chặn lưu — trả phần gom được */
  }
  let fish: unknown;
  try {
    if (typeof caches !== "undefined") {
      const c = await caches.open(API_CACHE);
      const r = await c.match(FISH_URL);
      if (r) fish = await r.json();
    }
  } catch {
    /* không có kho SW / khác origin — bỏ qua phần cá */
  }
  const backup: OfflineBackup = { v: 1, savedAt: Date.now(), ls, fish };
  return JSON.stringify(backup);
}

/** Ghi bản sao lưu trở lại máy (localStorage + kho SW bản đồ cá). */
export async function importOfflineData(
  json: string,
): Promise<{ ok: boolean; keys: number }> {
  const b = parseBackup(json);
  if (!b) return { ok: false, keys: 0 };
  let keys = 0;
  for (const [k, v] of Object.entries(b.ls)) {
    // PHÒNG THỦ 2 LỚP: kể cả tệp cũ / sửa tay có lẫn khoá quyền → KHÔNG ghi
    // (không cho import mở khoá premium bằng dấu tier của người khác).
    if (isBackupable(k) && typeof v === "string") {
      try {
        window.localStorage.setItem(k, v);
        keys++;
      } catch {
        /* hết chỗ — dừng ghi khoá này, thử khoá kế */
      }
    }
  }
  if (b.fish != null) {
    try {
      if (typeof caches !== "undefined") {
        const c = await caches.open(API_CACHE);
        await c.put(
          new Request(FISH_URL),
          new Response(JSON.stringify(b.fish), {
            headers: { "content-type": "application/json" },
          }),
        );
      }
    } catch {
      /* không ghi được kho SW — bản đồ cá sẽ tự tải lại khi có sóng */
    }
  }
  return { ok: true, keys };
}
