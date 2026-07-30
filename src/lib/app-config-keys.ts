// Khoá cấu hình + helper THUẦN (không "server-only" nên test được) — tách khỏi
// lib/app-config.ts (phần đọc/ghi DB service-role). Xem app-config.ts.

export type ConfigKey =
  | "vapid_public_key"
  | "vapid_private_key"
  | "vapid_subject";

export interface ConfigKeyMeta {
  key: ConfigKey;
  label: string;
  /** true = giá trị KHÔNG trả về admin (chỉ báo đã đặt hay chưa) */
  secret: boolean;
  /** env fallback cùng nghĩa (di trú từ env sang DB) */
  envVar: string;
  help?: string;
}

export const CONFIG_KEYS: ConfigKeyMeta[] = [
  {
    key: "vapid_public_key",
    label: "VAPID Public Key",
    secret: false,
    envVar: "VAPID_PUBLIC_KEY",
    help: "Khoá công khai Web Push (tạo bằng: npx web-push generate-vapid-keys).",
  },
  {
    key: "vapid_private_key",
    label: "VAPID Private Key",
    secret: true,
    envVar: "VAPID_PRIVATE_KEY",
    help: "Khoá bí mật Web Push — không hiện lại sau khi lưu.",
  },
  {
    key: "vapid_subject",
    label: "VAPID Subject",
    secret: false,
    envVar: "VAPID_SUBJECT",
    help: "mailto:ban@domain.com hoặc URL https liên hệ.",
  },
];

export const CONFIG_META = new Map(CONFIG_KEYS.map((m) => [m.key, m]));

export interface ConfigStatusRow {
  key: ConfigKey;
  label: string;
  secret: boolean;
  help?: string;
  source: "db" | "env" | "none";
  set: boolean;
  /** null với khoá secret (không lộ) */
  value: string | null;
}

/** Nguồn hiệu lực của một khoá: DB đè env; giá trị secret KHÔNG trả ra. */
export function resolveConfigCell(
  dbVal: string | undefined,
  envVal: string | undefined,
  secret: boolean,
): { source: "db" | "env" | "none"; value: string | null; set: boolean } {
  const d = dbVal?.trim();
  const e = envVal?.trim();
  const source = d ? "db" : e ? "env" : "none";
  return {
    source,
    set: source !== "none",
    value: secret ? null : d || e || null,
  };
}

/** Khoá có hợp lệ không (chặn ghi khoá lạ từ API). */
export function isConfigKey(k: string): k is ConfigKey {
  return CONFIG_META.has(k as ConfigKey);
}
