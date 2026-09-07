import "server-only";

// TRỢ LÝ — BỘ ĐẾM LƯỢT SỐNG QUA RESTART Ở KHO FILE (14 §6.3, brief §4 "file-mode file").
//
// Chỉ chạy khi `isDevFileMode()` (MARKET_STORE=file, không Vercel, không
// production). Ghi `assistant-quota.json` CÙNG thư mục kho chợ (`devLocalDir`)
// — bộ e2e xoá file này lúc global-setup để ca quota đếm từ 0. Prod: không
// đụng đĩa, đếm trong bộ nhớ (nợ bảng — ghi ở quota.ts).

import { promises as fs } from "node:fs";
import path from "node:path";
import { isDevFileMode } from "@/lib/market/dev-mode";
import { devLocalDir } from "@/lib/market/file-store";
import { defaultStore, hydrateQuota, serializeQuota, vnDayKey, type QuotaStore } from "./quota";

export const QUOTA_FILE_NAME = "assistant-quota.json";

function quotaFile(): string {
  return path.join(devLocalDir(), QUOTA_FILE_NAME);
}

let hydratedDay: string | null = null;

/** Nạp bộ đếm từ file (một lần mỗi ngày VN) — chỉ kho file. */
export async function hydrateQuotaFromFile(now = Date.now(), store: QuotaStore = defaultStore): Promise<void> {
  if (!isDevFileMode()) return;
  const day = vnDayKey(now);
  if (hydratedDay === day) return;
  hydratedDay = day;
  try {
    const raw = await fs.readFile(quotaFile(), "utf8");
    hydrateQuota(store, JSON.parse(raw), day);
  } catch (e) {
    // chưa có file = lần đầu trong ngày, bình thường; lỗi khác thì ghi để tra
    if ((e as { code?: string })?.code !== "ENOENT") console.error("[tro-ly] quota file đọc hỏng:", (e as Error)?.message);
  }
}

/** Ghi bộ đếm ra file — chỉ kho file; lỗi ghi không chặn lượt hỏi. */
export async function persistQuotaToFile(now = Date.now(), store: QuotaStore = defaultStore): Promise<void> {
  if (!isDevFileMode()) return;
  try {
    await fs.mkdir(devLocalDir(), { recursive: true });
    await fs.writeFile(quotaFile(), JSON.stringify({ day: vnDayKey(now), counts: serializeQuota(store, now) }), "utf8");
  } catch (e) {
    console.error("[tro-ly] quota file ghi hỏng:", (e as Error)?.message);
  }
}
