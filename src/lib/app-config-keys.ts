// Khoá cấu hình + helper THUẦN (không "server-only" nên test được) — tách khỏi
// lib/app-config.ts (phần đọc/ghi DB service-role). Xem app-config.ts.

export type ConfigKey =
  | "vapid_public_key"
  | "vapid_private_key"
  | "vapid_subject"
  | "cron_secret";

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
  {
    key: "cron_secret",
    label: "CRON Secret",
    secret: true,
    envVar: "CRON_SECRET",
    help: "Khoá xác thực cron (GitHub Actions gửi Bearer này). Đặt Ở ĐÂY (DB dùng chung) thì mọi deploy khớp — khỏi set env CRON_SECRET trên từng Vercel. Phải TRÙNG giá trị secret CRON_SECRET bên GitHub.",
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

/* ── CACHE app_config: HỎI KHÔNG ĐƯỢC ≠ KHÔNG CÓ ────────────────────────────
   Án lệ 2026-09-15 (cron ĐỎ 7–16 giây = bị đá về NGAY = 401, không phải hết
   giờ): `loadMap` cũ ghi cache cho MỌI lượt đọc, kể cả lượt Supabase trả lỗi —
   một cái chớp mạng biến `app_config` thành RỖNG suốt 30 giây. Deploy nào đặt
   cron_secret/VAPID trong DB (đúng ý đồ "không cần env trên từng Vercel") thì
   trong 30 giây đó `getCronSecret()` = null ⇒ mọi cron trả 401 ⇒ workflow đỏ;
   `getVapidConfig()` = null ⇒ KHÔNG đẩy được cảnh báo bão. Cùng bài học với
   `loadWeatherSnapshot` (2026-08-02) và `saveUserJson` (2026-07-31): nuốt lỗi
   thành "không có" là mất đồ thật.

   Luật: đọc ĐƯỢC → thay bản mới, hẹn `okMs`. Đọc HỎNG → GIỮ NGUYÊN bản đọc
   được lần trước (rỗng nếu chưa từng có) và hẹn thử lại SỚM (`failMs`), không
   được kéo dài cái rỗng ra tới `okMs`. */
export interface ConfigCache {
  at: number;
  ttlMs: number;
  map: Record<string, string>;
}

export function nextConfigCache(
  prev: ConfigCache | null,
  read: { ok: boolean; map?: Record<string, string> },
  now: number,
  ttl: { okMs: number; failMs: number },
): ConfigCache {
  if (read.ok) return { at: now, ttlMs: ttl.okMs, map: read.map ?? {} };
  return { at: now, ttlMs: ttl.failMs, map: prev?.map ?? {} };
}

/** Cache còn dùng được không (hết hạn theo ttl của CHÍNH lượt ghi ra nó). */
export function configCacheFresh(c: ConfigCache | null, now: number): boolean {
  return c != null && now - c.at < c.ttlMs;
}
