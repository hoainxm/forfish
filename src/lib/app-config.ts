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
  resolveConfigCell,
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

let cache: { at: number; map: Record<string, string> } | null = null;

async function loadMap(): Promise<Record<string, string>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.map;
  const admin = createAdminClient();
  const map: Record<string, string> = {};
  if (admin) {
    const { data, error } = await admin.from(TABLE).select("key,value");
    if (!error && data) {
      for (const r of data as { key: string; value: string }[]) {
        if (r.value) map[r.key] = r.value;
      }
    }
  }
  cache = { at: Date.now(), map };
  return map;
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
    };
  });
}
