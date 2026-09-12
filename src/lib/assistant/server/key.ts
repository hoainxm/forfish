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
export type AssistantEngine = "claude" | "qwen";

/** Engine tầng mạng: `qwen` (LLM tự host) hoặc `claude` (mặc định khi trống/lạ). */
export async function getAssistantEngine(): Promise<AssistantEngine> {
  const v = (await getConfigValue("assistant_engine"))?.trim().toLowerCase();
  return v === "qwen" ? "qwen" : "claude";
}

export interface QwenConfig {
  baseUrl: string;
  model: string;
  apiKey: string | null;
}

/** Cấu hình Qwen; `null` khi thiếu `qwen_base_url` (coi như chưa cấu hình engine qwen). */
export async function getQwenConfig(): Promise<QwenConfig | null> {
  const baseUrl = (await getConfigValue("qwen_base_url"))?.trim();
  if (!baseUrl) return null;
  const model = (await getConfigValue("qwen_model"))?.trim() || "qwen3.5:9b";
  const apiKey = (await getConfigValue("qwen_api_key"))?.trim() || null;
  return { baseUrl: baseUrl.replace(/\/+$/, ""), model, apiKey };
}

export interface ResolvedEngine {
  mode: AssistantMode;
  engine: AssistantEngine;
  /** khoá Claude (chỉ khi engine=claude, mode=live) */
  key: string | null;
  /** cấu hình Qwen (chỉ khi engine=qwen, mode=live) */
  qwen: QwenConfig | null;
}

/**
 * `ASSISTANT_MOCK=1` → mock. Rồi theo ENGINE:
 * - `qwen`: có `qwen_base_url` → live · không + không production → mock · còn lại → no_key.
 * - `claude`: có khoá → live · không + không production → mock · còn lại → no_key.
 * `no_key` = prod chưa cấu hình: 503 rõ ràng ("phần hỏi thêm chưa mở"), không đổ cho sóng.
 */
export async function resolveMode(): Promise<ResolvedEngine> {
  if (process.env.ASSISTANT_MOCK === "1") return { mode: "mock", engine: "claude", key: null, qwen: null };
  const engine = await getAssistantEngine();
  if (engine === "qwen") {
    const qwen = await getQwenConfig();
    if (qwen) return { mode: "live", engine, key: null, qwen };
    if (process.env.NODE_ENV !== "production") return { mode: "mock", engine, key: null, qwen: null };
    return { mode: "no_key", engine, key: null, qwen: null };
  }
  const key = await getAssistantApiKey();
  if (key) return { mode: "live", engine, key, qwen: null };
  if (process.env.NODE_ENV !== "production") return { mode: "mock", engine, key: null, qwen: null };
  return { mode: "no_key", engine, key: null, qwen: null };
}
