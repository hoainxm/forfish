// Khoá cấu hình + helper THUẦN (không "server-only" nên test được) — tách khỏi
// lib/app-config.ts (phần đọc/ghi DB service-role). Xem app-config.ts.
import { danhSachSdtHopLe } from "@/lib/tau-ais/quyen";

export type ConfigKey =
  | "vapid_public_key"
  | "vapid_private_key"
  | "vapid_subject"
  | "cron_secret"
  | "data_key_current"
  | "data_key_prev"
  | "data_key_premium"
  | "kairos_ingest_key"
  | "tau_ais_key"
  | "stracking_key"
  | "sdfish_renewal_secret"
  | "sdwork_crm_url"
  | "tau_ais_xem"
  | "sdvico_lead_key"
  | "doi_tac_ais"
  | "doi_tac_id_khoa"
  | "kho_o_tran_mb";

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
  /**
   * true = ENV THẮNG DB (ngược luật chung "DB đè env"). Chỉ khoá nhập tin Kairos: máy GPU giữ
   * khoá trong tệp env của nó, deploy đặt env cùng giá trị để đổi khoá không phụ thuộc DB.
   */
  envFirst?: boolean;
}

// BẢNG KHOÁ (nhãn, chữ trợ giúp, hậu quả, tên env) ở `app-config-meta.ts` — CHỈ máy chủ đọc (2026-11-08,
// khong-lo-nguon nợ #10): file này được tab Hệ thống (chunk /quan-tri tải được không cần quyền) import, nên chỉ
// giữ helper thuần. Chữ trợ giúp đi xuống trang quản trị qua `GET /api/admin/app-config` (đã `requireAdmin`).

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
    case "data_key_premium":
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
    case "tau_ais_xem":
      return danhSachSdtHopLe(v);
    case "kho_o_tran_mb":
      return /^\d+$/.test(v) && Number(v) >= 100 && Number(v) <= 100_000;
    case "doi_tac_ais":
      return v.split(",").map((s) => s.trim()).filter(Boolean).every((s) => /^[a-z0-9][a-z0-9-]{1,39}:[0-9a-f]{64}:[1-5]{1,5}:(30|60)$/.test(s)); // = MUC_KHOA_DOI_TAC (lib/doi-tac)
    case "sdwork_crm_url":
      return /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(v);
    case "sdfish_renewal_secret":
      // khoá đã đặt sẵn bên CRM (độ dài do bên đó chọn) — chỉ chặn dán lỗi: đủ dài, không khoảng trắng
      return v.length >= 16 && v.length <= 200 && !/\s/.test(v);
    case "kairos_ingest_key":
    case "doi_tac_id_khoa":
    case "tau_ais_key":
    case "stracking_key":
    case "sdvico_lead_key":
      // khoá chung với máy GPU / AI Assistant — đủ dài để không đoán được, không khoảng trắng (dán lỗi)
      return v.length >= 32 && v.length <= 200 && !/\s/.test(v);
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
  /** env thắng DB với khoá này (ConfigKeyMeta.envFirst) */
  envFirst: boolean;
  /** tên env cùng nghĩa — trang quản trị nói rõ khoá nào đang thắng */
  envVar: string;
  /** cả DB lẫn env đều có giá trị ⇒ bên thua đang bị BỎ QUA */
  overridden: boolean;
}

/**
 * Nguồn hiệu lực của một khoá: DB đè env (mặc định), hoặc env đè DB khi `envFirst`; giá trị
 * secret KHÔNG trả ra. `overridden` = cả hai bên cùng có — bên thua không có hiệu lực.
 */
export function resolveConfigCell(
  dbVal: string | undefined,
  envVal: string | undefined,
  secret: boolean,
  envFirst = false,
): { source: "db" | "env" | "none"; value: string | null; set: boolean; overridden: boolean } {
  const d = dbVal?.trim();
  const e = envVal?.trim();
  const source = envFirst ? (e ? "env" : d ? "db" : "none") : d ? "db" : e ? "env" : "none";
  return {
    source,
    set: source !== "none",
    value: secret ? null : (source === "db" ? d : source === "env" ? e : null) || null,
    overridden: !!d && !!e,
  };
}

/**
 * Câu nói THỨ TỰ ƯU TIÊN cho trang quản trị — khoá nào thắng thì nói khoá đó (sửa 2026-10-24:
 * trang ghi "DB đè env" cho mọi ô, nhưng khoá nhập tin Kairos thì env đè DB). `warn` khi bên
 * thua đang có giá trị: lưu ô này mà env thắng thì ô KHÔNG có hiệu lực.
 */
export function configPrecedenceText(row: Pick<ConfigStatusRow, "envFirst" | "envVar" | "overridden">): { order: string; warn: string | null } {
  if (row.envFirst) {
    return {
      order: `Thứ tự: env ${row.envVar} trên máy chủ (nếu đặt) thắng ô này.`,
      warn: row.overridden
        ? `Env ${row.envVar} đang đè — giá trị trong ô này KHÔNG có hiệu lực. Muốn dùng ô này: xoá env ${row.envVar} trên máy chủ rồi deploy lại.`
        : null,
    };
  }
  return {
    order: `Thứ tự: ô này thắng env ${row.envVar}.`,
    warn: row.overridden ? `Ô này đang đè env ${row.envVar} (env bị bỏ qua).` : null,
  };
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
