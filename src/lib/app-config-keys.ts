// Khoá cấu hình + helper THUẦN (không "server-only" nên test được) — tách khỏi
// lib/app-config.ts (phần đọc/ghi DB service-role). Xem app-config.ts.

export type ConfigKey =
  | "vapid_public_key"
  | "vapid_private_key"
  | "vapid_subject"
  | "cron_secret"
  | "anthropic_api_key"
  | "assistant_daily_limit"
  | "assistant_engine"
  | "qwen_base_url"
  | "qwen_model"
  | "qwen_api_key";

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
  {
    key: "anthropic_api_key",
    label: "Anthropic API Key (Trợ lý)",
    secret: true,
    envVar: "ANTHROPIC_API_KEY",
    help: "Khoá gọi Claude cho Trợ lý giọng nói. Không hiện lại sau khi lưu. Thiếu ⇒ trợ lý chỉ trả lời việc trong máy.",
  },
  {
    key: "assistant_daily_limit",
    label: "Trợ lý — số lượt hỏi mạng / ngày / tài khoản",
    secret: false,
    envVar: "ASSISTANT_DAILY_LIMIT",
    help: "Mặc định 30. Đếm lượt gọi tầng mạng (Claude hoặc Qwen); việc trong máy không tính.",
  },
  {
    key: "assistant_engine",
    label: "Trợ lý — engine tầng mạng",
    secret: false,
    envVar: "ASSISTANT_ENGINE",
    help: "'qwen' = LLM tự host (Qwen qua endpoint OpenAI, 0đ vendor) · 'claude' = Claude Opus (mặc định khi trống). Đổi engine là áp dụng ngay, không redeploy.",
  },
  {
    key: "qwen_base_url",
    label: "Qwen — base URL (chuẩn OpenAI)",
    secret: false,
    envVar: "QWEN_BASE_URL",
    help: "Endpoint chuẩn OpenAI, KHÔNG kèm /chat/completions. Test máy trạm: http://127.0.0.1:11434/v1 (Ollama). Prod: URL server/tunnel/host Qwen. Thiếu ⇒ engine qwen coi như chưa cấu hình.",
  },
  {
    key: "qwen_model",
    label: "Qwen — tên model",
    secret: false,
    envVar: "QWEN_MODEL",
    help: "Mặc định qwen3.5:9b. Tên model theo endpoint đang trỏ tới.",
  },
  {
    key: "qwen_api_key",
    label: "Qwen — API key (nếu endpoint cần)",
    secret: true,
    envVar: "QWEN_API_KEY",
    help: "Bearer cho endpoint có xác thực (vLLM/host). Ollama localhost KHÔNG cần — để trống.",
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
