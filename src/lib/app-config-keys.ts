// Khoá cấu hình + helper THUẦN (không "server-only" nên test được) — tách khỏi
// lib/app-config.ts (phần đọc/ghi DB service-role). Xem app-config.ts.

export type ConfigKey =
  | "vapid_public_key"
  | "vapid_private_key"
  | "vapid_subject"
  | "cron_secret"
  | "data_key_current"
  | "data_key_prev";

export interface ConfigKeyMeta {
  key: ConfigKey;
  label: string;
  /** true = giá trị KHÔNG trả về admin (chỉ báo đã đặt hay chưa) */
  secret: boolean;
  /** env fallback cùng nghĩa (di trú từ env sang DB) */
  envVar: string;
  help?: string;
  /** Trang quản trị hiện nút "Tạo ngẫu nhiên" — giá trị sinh ở máy admin theo khuôn này */
  generate?: "hex32";
  /** HẬU QUẢ nếu lưu sai — hiện ở bước xác nhận trước khi ghi (2026-09-17) */
  risk: string;
}

export const CONFIG_KEYS: ConfigKeyMeta[] = [
  {
    key: "vapid_public_key",
    label: "VAPID Public Key",
    risk: "Sai khoá công khai là MỌI máy đã bật thông báo ngừng nhận tin bão/tin mới, và phải bật lại từng máy.",
    secret: false,
    envVar: "VAPID_PUBLIC_KEY",
    help: "Khoá công khai Web Push (tạo bằng: npx web-push generate-vapid-keys).",
  },
  {
    key: "vapid_private_key",
    label: "VAPID Private Key",
    risk: "Sai khoá bí mật là server không gửi được thông báo nào nữa, không báo lỗi rõ.",
    secret: true,
    envVar: "VAPID_PRIVATE_KEY",
    help: "Khoá bí mật Web Push — không hiện lại sau khi lưu.",
  },
  {
    key: "vapid_subject",
    label: "VAPID Subject",
    risk: "Sai subject là dịch vụ đẩy của Apple/Google từ chối mọi thông báo.",
    secret: false,
    envVar: "VAPID_SUBJECT",
    help: "mailto:ban@domain.com hoặc URL https liên hệ.",
  },
  {
    key: "cron_secret",
    label: "CRON Secret",
    risk: "Không trùng GitHub là mọi cron (bão, thời tiết, cá, giá) ngừng chạy — dữ liệu cũ dần mà không ai biết.",
    secret: true,
    envVar: "CRON_SECRET",
    help: "Khoá xác thực cron (GitHub Actions gửi Bearer này). Đặt Ở ĐÂY (DB dùng chung) thì mọi deploy khớp — khỏi set env CRON_SECRET trên từng Vercel. Phải TRÙNG giá trị secret CRON_SECRET bên GitHub.",
  },
  /*  KHOÁ DỮ LIỆU BẢN ĐỒ (2026-09-17): mã 15 file biên tập lúc build (scripts/
      encode-data.mjs đọc DB qua service-role) và phát cho tài khoản đã đăng nhập
      (/api/data-key). Lần build đầu chưa có thì build TỰ SINH và ghi vào đây —
      admin không phải làm gì. Đổi khoá: bấm "Tạo ngẫu nhiên" → Lưu; route
      /api/admin/app-config tự chuyển khoá cũ sang "trước đó" để máy đang dùng
      file cũ vẫn đọc được; file MỚI chỉ dùng khoá mới sau lần deploy kế. */
  {
    key: "data_key_current",
    label: "Khoá dữ liệu bản đồ (hiện hành)",
    risk: "Sai khoá là sau lần deploy kế, 15 file dữ liệu bản đồ mã bằng khoá này không máy nào giải được.",
    secret: true,
    envVar: "SDFISH_DATA_KEY",
    generate: "hex32",
    help: "Mã 15 file dữ liệu biên tập (độ sâu, báo hiệu, luồng, chất đáy, mùa vụ cá…). Build đầu tự sinh. Đổi: bấm Tạo ngẫu nhiên → Lưu, khoá cũ tự chuyển xuống ô dưới; deploy lại để file mới dùng khoá mới.",
  },
  {
    key: "data_key_prev",
    label: "Khoá dữ liệu bản đồ (trước đó)",
    risk: "Đè sai là máy đã tải file bằng khoá cũ mất lớp độ sâu/báo hiệu cho tới khi tải lại.",
    secret: true,
    envVar: "SDFISH_DATA_KEY_PREV",
    help: "Tự chuyển từ khoá hiện hành khi đổi khoá — máy đã tải file bằng khoá cũ vẫn đọc được. Xoá bằng cách dán một khoá mới đè lên.",
  },
];

/** Khoá dữ liệu phải đúng 64 ký tự hex (32 byte). */
export function isDataKeyValue(v: string): boolean {
  return /^[0-9a-f]{64}$/i.test(v.trim());
}

/**
 * KIỂM Ở RANH GIỚI trước khi ghi DB (2026-09-17, sau ảnh prod: trình duyệt tự
 * điền SĐT vào ô VAPID Public Key). Một giá trị sai dạng ghi vào là thông báo
 * chết / file dữ liệu không giải được — nên chặn ở đây, không tin ô nhập.
 */
export function validateConfigValue(key: ConfigKey, value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  switch (key) {
    case "data_key_current":
    case "data_key_prev":
      return isDataKeyValue(v);
    case "vapid_public_key":
      // P-256 điểm công khai 65 byte → base64url 87 ký tự (web-push sinh ra thế)
      return /^[A-Za-z0-9_-]{80,100}$/.test(v);
    case "vapid_private_key":
      // 32 byte → base64url 43 ký tự
      return /^[A-Za-z0-9_-]{40,50}$/.test(v);
    case "vapid_subject":
      return /^(mailto:[^\s@]+@[^\s@]+|https:\/\/\S+)$/.test(v);
    case "cron_secret":
      return v.length >= 16 && !/\s/.test(v);
    default:
      return true;
  }
}

/**
 * Ghi khoá hiện hành mới thì khoá cũ (nếu có và KHÁC) trượt xuống "trước đó".
 * Thuần, trả danh sách ô cần ghi theo thứ tự.
 */
export function dataKeyShift(
  oldCurrent: string | null,
  newCurrent: string,
): Array<{ key: ConfigKey; value: string }> {
  const neu = newCurrent.trim().toLowerCase();
  const cu = oldCurrent?.trim().toLowerCase() ?? "";
  const rows: Array<{ key: ConfigKey; value: string }> = [];
  if (cu && cu !== neu) rows.push({ key: "data_key_prev", value: cu });
  rows.push({ key: "data_key_current", value: neu });
  return rows;
}

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
  generate?: "hex32";
  risk: string;
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
