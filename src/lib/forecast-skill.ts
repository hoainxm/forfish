// Trục 1 — nạp BẢNG SKILL backtest (sai số dự-báo-cũ vs thực-tế ERA5 theo tầm
// ngày) đã kết tinh sẵn ở src/data/forecast-skill.json (sinh offline bởi
// scripts/forecast-backtest.mjs — xem docs/app-map/ops/forecast-accuracy.md).
// Kết quả commit sẵn → runtime KHÔNG gọi mạng; chỉ đọc JSON tĩnh.

import raw from "@/data/forecast-skill.json";
import type { SkillTable } from "@/lib/forecast-quality";

/** Bảng skill nếu có đủ dữ liệu; null khi file rỗng/hỏng (degrade an toàn). */
export function loadForecastSkill(): SkillTable | null {
  const t = raw as SkillTable;
  if (!t?.perLeadDay?.length) return null;
  return t;
}

/** Bảng skill đã nạp sẵn (đọc 1 lần lúc bundle). */
export const FORECAST_SKILL: SkillTable | null = loadForecastSkill();
