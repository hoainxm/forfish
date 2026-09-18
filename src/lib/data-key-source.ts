import "server-only";

// NGUỒN KHOÁ DỮ LIỆU SDF2 PHÍA SERVER (2026-09-17): đọc `app_config`
// (`data_key_current` / `data_key_prev`, admin đặt ở /quan-tri), thiếu thì rơi
// về env `SDFISH_DATA_KEY` / `SDFISH_DATA_KEY_PREV` — cùng luật lib/app-config.
// Trả danh sách [hiện hành, trước đó] để máy đã tải file bằng khoá cũ vẫn đọc.

import { getConfigValue } from "@/lib/app-config";
import { keyIdOfSync, parseDataKeyHex } from "@/lib/data-key-server";

export interface DataKeyEntry {
  id: string;
  hex: string;
}

/** [hiện hành, trước đó] — lọc giá trị hỏng, bỏ trùng. Rỗng = chưa cấu hình. */
export async function loadDataKeys(): Promise<DataKeyEntry[]> {
  const [cur, prev] = await Promise.all([
    getConfigValue("data_key_current"),
    getConfigValue("data_key_prev"),
  ]);
  const out: DataKeyEntry[] = [];
  for (const v of [cur, prev]) {
    const raw = parseDataKeyHex(v);
    if (!raw) continue;
    const id = keyIdOfSync(raw);
    if (out.some((e) => e.id === id)) continue;
    out.push({ id, hex: v!.trim().toLowerCase() });
  }
  return out;
}
