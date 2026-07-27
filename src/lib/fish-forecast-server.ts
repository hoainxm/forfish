// SERVER-ONLY compatibility wrapper cho collector lịch sử local.
// Engine dự báo cá mới nằm ở fish-forecast-run.ts và tự chọn tháng theo ngày
// dữ liệu nguồn; tham số month giữ lại để không phá caller cũ.
import "server-only";
import { computeFishForecast } from "@/lib/fish-forecast-run";
import type { FishForecast } from "@/lib/fish-predict";

export async function loadFishForecast(
  _month: number,
): Promise<FishForecast | null> {
  const forecast = await computeFishForecast();
  return forecast.ok ? forecast : null;
}
