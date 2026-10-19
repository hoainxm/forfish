/*
  TRẠNG THÁI PHÁT HÀNH + ĐỘ TƯƠI DỮ LIỆU (rà Codex 2026-10-19, đợt 2: "gắn metadata
  thống nhất: model version, data version, thời điểm nguồn"; "phân biệt liveness với
  dữ liệu dự báo có còn mới"). /api/version chỉ trả mã bản (client so để báo có bản
  mới); /api/status trả THÊM tham số mô hình đang dùng + tuổi các bản tính sẵn trên
  server — để người vận hành (và health check sau deploy) biết server sống nhưng
  dự báo có đang mắc kẹt ở hôm qua không. Thuần, có test (status-report.test.ts).
*/

/** Bản dự báo cá / thời tiết tính sẵn quá ngần này giờ thì coi là CŨ (cron chạy mỗi ngày). */
export const SNAPSHOT_STALE_H = 36;

export type Tuoi = { at: string; ageHours: number; fresh: boolean } | null;

/** Tuổi của một mốc ISO so với `nowMs`; mốc hỏng / ở tương lai ⇒ null (không đoán). */
export function tuoi(iso: string | null | undefined, nowMs: number, staleH = SNAPSHOT_STALE_H): Tuoi {
  const t = Date.parse(iso ?? "");
  if (!Number.isFinite(t) || t > nowMs + 5 * 60_000) return null;
  const ageHours = Math.round(((nowMs - t) / 3_600_000) * 10) / 10;
  return { at: new Date(t).toISOString(), ageHours, fresh: ageHours <= staleH };
}

export interface StatusInput {
  build: string;
  builtOn: string;
  fishBlendFittedAt: string | null;
  forecastSkillFittedAt: string | null;
  /** null = không đọc được DB (khác với "chưa có bản nào": dbOk true + at null) */
  fishSnapshotAt: string | null;
  weatherSnapshotAt: string | null;
  dbOk: boolean;
  nowMs: number;
}

export function buildStatus(i: StatusInput) {
  const fish = tuoi(i.fishSnapshotAt, i.nowMs);
  const weather = tuoi(i.weatherSnapshotAt, i.nowMs);
  return {
    ok: true as const,
    build: i.build || null,
    builtOn: i.builtOn || null,
    model: { fishBlendFittedAt: i.fishBlendFittedAt, forecastSkillFittedAt: i.forecastSkillFittedAt },
    data: i.dbOk ? { fishSnapshot: fish, weatherSnapshot: weather } : null,
    /** một chữ cho người đọc nhanh / health check: tuoi | cu | khong-doc-duoc */
    duLieu: !i.dbOk ? "khong-doc-duoc" : fish?.fresh && weather?.fresh ? "tuoi" : "cu",
    checkedAt: new Date(i.nowMs).toISOString(),
  };
}
