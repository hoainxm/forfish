// Trục 1 — BẢNG SKILL backtest (sai số dự-báo-cũ vs thực-tế ERA5 theo tầm
// ngày), sinh offline bởi scripts/forecast-backtest.mjs vào
// src/data/forecast-skill.json (xem docs/app-map/ops/forecast-accuracy.md).
//
// 2026-09-16: KHÔNG nhúng vào bundle nữa — đi qua lib/model-params (file SDF2
// `/data/model-params.v1.json`, tải sau đăng nhập, SW giữ sẵn). Chưa nạp ⇒ null
// ⇒ độ tin không bị hạ thêm (đúng đường degrade đã có).

import { getModelParams, type ModelParams } from "@/lib/model-params";
import type { SkillTable } from "@/lib/forecast-quality";

/** Bảng skill nếu có đủ dữ liệu; null khi chưa nạp / rỗng / hỏng (degrade an toàn). */
export function loadForecastSkill(params: ModelParams | null = getModelParams()): SkillTable | null {
  const t = params?.forecastSkill as SkillTable | undefined;
  if (!t?.perLeadDay?.length) return null;
  return t;
}
