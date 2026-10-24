import "server-only";

// KAIROS — KHO BÀI TÀI TRỢ (14 §20): MỘT ô `app_config.kairos_ads` (JSON danh sách, kiểm bằng quang-cao.kiemDanhSach).
// KHÔNG đưa vào CONFIG_KEYS: đó là bộ khoá hệ thống (secret, có câu hậu quả) của tab Hệ thống — bài tài trợ là
// NỘI DUNG, soạn ở tab Kairos. Dùng chung bảng (không migration), chỉ service-role (bảng không có policy).
//
// Đọc cho dòng tin: cache 60 s trong instance; đọc HỎNG ⇒ GIỮ bản đọc được lần trước (như app-config.nextConfigCache)
// — không có thì []. Quảng cáo hỏng KHÔNG BAO GIỜ được làm hỏng dòng tin (route bắt mọi lỗi ⇒ không có thẻ).

import { createAdminClient } from "@/lib/supabase/admin";
import { docOCauHinh, type QuangCao } from "./quang-cao";

const KEY = "kairos_ads";
const TTL_MS = 60_000;
const FAIL_TTL_MS = 5_000;

let cache: { at: number; ttl: number; list: QuangCao[] } | null = null;

async function docMotLan(): Promise<{ ok: true; list: QuangCao[] } | { ok: false }> {
  const admin = createAdminClient();
  if (!admin) return { ok: true, list: [] }; // demo/preview chưa cấu hình Supabase = đúng là không có
  try {
    const { data, error } = await admin.from("app_config").select("value").eq("key", KEY).maybeSingle();
    if (error) return { ok: false };
    return { ok: true, list: docOCauHinh((data as { value?: string } | null)?.value) };
  } catch {
    return { ok: false };
  }
}

/** Danh sách bài tài trợ (cả bài tắt) — cho dòng tin (có cache) và cho quản trị (`tuoi: true` ⇒ đọc thẳng). */
export async function docQuangCao(opts: { tuoi?: boolean } = {}): Promise<QuangCao[]> {
  const now = Date.now();
  if (!opts.tuoi && cache && now - cache.at < cache.ttl) return cache.list;
  const r = await docMotLan();
  if (r.ok) cache = { at: now, ttl: TTL_MS, list: r.list };
  else {
    if (opts.tuoi) throw new Error("ads_read_failed");
    cache = { at: now, ttl: FAIL_TTL_MS, list: cache?.list ?? [] };
  }
  return cache.list;
}

/** Ghi cả danh sách (đã kiểm). false = chưa cấu hình Supabase / ghi hỏng — route báo, KHÔNG nói "đã lưu". */
export async function ghiQuangCao(list: QuangCao[], who: string): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;
  const { error } = await admin
    .from("app_config")
    .upsert({ key: KEY, value: JSON.stringify(list), updated_by: who, updated_at: new Date().toISOString() });
  if (!error) cache = { at: Date.now(), ttl: TTL_MS, list };
  return !error;
}
