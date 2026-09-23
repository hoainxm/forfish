import "server-only";

// CẤU HÌNH ỨNG DỤNG lưu DB (2026-07-28) — thay lệ thuộc env máy chủ deploy.
// Đọc DB-TRƯỚC (bảng app_config), thiếu thì rơi về env cùng tên → env cũ vẫn
// chạy, admin dán vào DB thì đè lên NGAY (không cần redeploy). Chỉ dùng phía
// server (service-role); secret KHÔNG bao giờ trả về client.
//
// Khoá + helper THUẦN nằm ở app-config-keys.ts (không "server-only" → test được).

import { createAdminClient } from "@/lib/supabase/admin";
import {
  CONFIG_KEYS,
  CONFIG_META,
  configCacheFresh,
  nextConfigCache,
  resolveConfigCell,
  type ConfigCache,
  type ConfigKey,
  type ConfigStatusRow,
} from "@/lib/app-config-keys";

export {
  CONFIG_KEYS,
  isConfigKey,
  resolveConfigCell,
  type ConfigKey,
  type ConfigKeyMeta,
  type ConfigStatusRow,
} from "@/lib/app-config-keys";

const TABLE = "app_config";
const TTL_MS = 30_000;
/*  Đọc HỎNG thì hẹn lại SỚM — không được để một cái chớp mạng khoá cấu hình
    rỗng suốt 30 giây (xem án lệ ở `nextConfigCache`). */
const FAIL_TTL_MS = 3_000;
/*  Cron chạy trên lambda LẠNH: không có bản cache lần trước để mà giữ, nên
    "giữ bản cũ" một mình chưa cứu được lượt đọc đầu tiên bị hỏng. Thử lại đúng
    MỘT lần, 300 ms — rẻ so với một lượt cron mất trắng vì 401. */
const RETRY_MS = 300;

let cache: ConfigCache | null = null;

/** Một lượt đọc bảng — `ok:false` là KHÔNG HỎI ĐƯỢC (lỗi/ném), khác với hỏi
    được mà bảng trống (`ok:true, map:{}`). */
async function readMapOnce(): Promise<{
  ok: boolean;
  map?: Record<string, string>;
}> {
  const admin = createAdminClient();
  //  Chưa cấu hình Supabase (demo/preview) = đúng là KHÔNG CÓ bản nào, không
  //  phải hỏng — cache bình thường để khỏi gõ lại mỗi lượt.
  if (!admin) return { ok: true, map: {} };
  try {
    const { data, error } = await admin.from(TABLE).select("key,value");
    if (error || !data) return { ok: false };
    const map: Record<string, string> = {};
    for (const r of data as { key: string; value: string }[]) {
      if (r.value) map[r.key] = r.value;
    }
    return { ok: true, map };
  } catch {
    // client ném (mạng/DNS) — vẫn là "không hỏi được", KHÔNG phải "không có"
    return { ok: false };
  }
}

async function loadMap(): Promise<Record<string, string>> {
  if (configCacheFresh(cache, Date.now())) return cache!.map;
  let read = await readMapOnce();
  if (!read.ok) {
    await new Promise((r) => setTimeout(r, RETRY_MS));
    read = await readMapOnce();
  }
  cache = nextConfigCache(cache, read, Date.now(), {
    okMs: TTL_MS,
    failMs: FAIL_TTL_MS,
  });
  return cache.map;
}

/** Xóa cache (gọi sau khi ghi để lần đọc tới thấy giá trị mới ngay). */
export function invalidateConfigCache() {
  cache = null;
}

/** Giá trị hiệu lực của 1 khoá: DB (nếu có) rồi tới env cùng tên. */
export async function getConfigValue(key: ConfigKey): Promise<string | null> {
  const meta = CONFIG_META.get(key);
  if (!meta) return null;
  const map = await loadMap();
  return resolveConfigCell(map[key], process.env[meta.envVar], false).value;
}

/** Bộ 3 khoá VAPID (đủ để gửi Web Push); null nếu thiếu bất kỳ khoá nào. */
export async function getVapidConfig(): Promise<{
  subject: string;
  publicKey: string;
  privateKey: string;
} | null> {
  const [subject, publicKey, privateKey] = await Promise.all([
    getConfigValue("vapid_subject"),
    getConfigValue("vapid_public_key"),
    getConfigValue("vapid_private_key"),
  ]);
  if (!subject || !publicKey || !privateKey) return null;
  return { subject, publicKey, privateKey };
}

/**
 * Khoá xác thực CRON — DB (`app_config.cron_secret`) trước, env `CRON_SECRET`
 * sau. Đặt trong DB dùng chung thì MỌI deploy khớp mà không cần env trên từng
 * Vercel (bên GỬI — GitHub Actions — vẫn phải mang đúng token này). `null` nếu
 * chưa cấu hình ⇒ route CẤM HẲN (401), không mở cửa.
 */
export async function getCronSecret(): Promise<string | null> {
  return getConfigValue("cron_secret");
}

/** Lưu 1 khoá vào DB (upsert). Trả false nếu chưa cấu hình Supabase. */
export async function setConfigValue(
  key: ConfigKey,
  value: string,
  who: string,
): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;
  const { error } = await admin.from(TABLE).upsert({
    key,
    value: value ?? "",
    updated_by: who,
    updated_at: new Date().toISOString(),
  });
  invalidateConfigCache();
  return !error;
}

/** Trạng thái mọi khoá cho trang quản trị — che giá trị secret. */
export async function configStatus(): Promise<ConfigStatusRow[]> {
  const map = await loadMap();
  return CONFIG_KEYS.map((m) => {
    const cell = resolveConfigCell(map[m.key], process.env[m.envVar], m.secret);
    return {
      key: m.key,
      label: m.label,
      secret: m.secret,
      help: m.help,
      source: cell.source,
      set: cell.set,
      value: cell.value,
      generate: m.generate,
      risk: m.risk,
    };
  });
}
