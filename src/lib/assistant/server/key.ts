import "server-only";

// TRỢ LÝ — KHOÁ + TRẦN + CHẾ ĐỘ (14 §6.2). Khoá đọc `app_config` TRƯỚC rồi rơi
// về env cùng tên (`getConfigValue` — admin dán ở /quan-tri là áp dụng ngay,
// không redeploy). Khoá là `secret: true`, không bao giờ trả về client.

import { getConfigValue } from "@/lib/app-config";
import { clampDailyLimit } from "./quota";

export async function getAssistantApiKey(): Promise<string | null> {
  const v = await getConfigValue("anthropic_api_key");
  return v && v.trim() ? v.trim() : null;
}

/** Mặc định 30, kẹp 1..500. */
export async function getAssistantDailyLimit(): Promise<number> {
  return clampDailyLimit(await getConfigValue("assistant_daily_limit"));
}

export type AssistantMode = "mock" | "live" | "no_key";

/**
 * `ASSISTANT_MOCK=1` → mock · có khoá → live · không khoá và không production
 * → mock (dev/e2e không tốn tiền) · còn lại → `no_key` (prod chưa cấu hình:
 * 503 rõ ràng, client nói "phần hỏi thêm chưa mở" — không đổ cho sóng).
 */
export async function resolveMode(): Promise<{ mode: AssistantMode; key: string | null }> {
  if (process.env.ASSISTANT_MOCK === "1") return { mode: "mock", key: null };
  const key = await getAssistantApiKey();
  if (key) return { mode: "live", key };
  if (process.env.NODE_ENV !== "production") return { mode: "mock", key: null };
  return { mode: "no_key", key: null };
}
