// Trục 1 — "CHUẨN BỊ ĐI BIỂN": tải sẵn trước khi rời bờ.
//
// Vì sao có file này: máy VẪN giữ dự báo để xem lúc mất sóng, nhưng trước đây
// chỉ giữ được thứ bà con TÌNH CỜ mở ra xem (chạm điểm, bật lớp gió). Ra khơi 5–16
// ngày mà không biết trong máy có gì = may rủi. Nay máy TỰ tải đủ lúc còn sóng
// (bà con không phải bấm gì) — cửa chặn 6 giờ cho khỏi tốn tiền sóng nằm ở
// lib/pretrip-auto.ts, file này chỉ lo phần tải.
//
// Nguyên tắc: KHÔNG thêm nguồn dữ liệu mới — chỉ gọi đúng những hàm màn Ra khơi
// vẫn gọi (fetchSeaPoint / fetchFishForecast / fetchForecastGrid), vì bản thân
// chúng đã tự lưu vào máy. Chạy TUẦN TỰ cho khỏi dội nguồn miễn phí.

import { fetchSeaPoint, POINT_NS, type SeaPointConditions } from "@/lib/marine-weather";
import { fetchFishForecast } from "@/lib/fish-predict";
import { fetchClimatology } from "@/lib/fish-blend";
import { fetchForecastGrid, savedGridDays } from "@/lib/forecast-grid";
import { fetchScalarField } from "@/lib/scalar-field";
import { fetchCurDepthGridClient } from "@/lib/cur-depth";
import { CUR_DEPTH_MAX_DAYS } from "@/lib/weather-snapshot-id";
import { coordId, lastStorageFullAt, loadAll } from "@/lib/forecast-cache";

/** Tầng SÂU tải sẵn (tầng mặt đã nằm trong lưới gió/sóng SMOC) */
export const CUR_DEPTH_PRETRIP_TIERS = [50, 150, 300] as const;

/**
 * Khung ngày lưới gió/sóng tải sẵn: gần (3) · giữa (7) · cả chuyến dài (16).
 * KHÔNG lấy đủ cả 5 khung: mỗi khung là một lưới 80 điểm × mấy chục mốc giờ
 * (~0,2–0,4 MB trong máy, tải về nặng hơn nhiều) — 3 khung đã phủ mọi tầm nhìn,
 * 5 khung chỉ tổ chiếm chỗ và tốn sóng lúc còn ở bờ.
 */
export const PRETRIP_GRID_DAYS = [3, 7, 16] as const;

/**
 * Khung ngày LỚP DẢI MÀU (mây/mưa/nhiệt/dông/áp suất) tải sẵn — màn Ra khơi
 * chỉ xin đúng 3 (thường) hoặc 16 (premium) từ khi bỏ chip chọn khung, nên tải
 * cả hai là offline chạy được ở mọi hạng. MỖI lượt là MỘT request Open-Meteo
 * ra cả 5 lớp (fetchScalarField tự lưu cả 5).
 */
export const PRETRIP_SCALAR_DAYS = [3, 16] as const;

export interface PretripStep {
  /** câu bà con đọc được, vd "Gió sóng — Cảng nhà" */
  label: string;
  run: () => Promise<void>;
}

export interface PretripProgress {
  /** đã xong mấy việc */
  done: number;
  /** tổng số việc */
  total: number;
  /** đang làm việc gì */
  label: string;
}

export interface PretripResult {
  /** số việc tải được */
  ok: number;
  /** số việc hỏng (mạng chập chờn) */
  failed: number;
  /** máy hết chỗ nhớ — có tải cũng không giữ được */
  full: boolean;
  /** tóm tắt "trong máy đang có gì" sau khi tải */
  saved: SavedSummary;
}

export interface PretripPoint {
  lat: number;
  lon: number;
  /** tên chỗ để hiện trong thanh tiến trình */
  name: string;
}

/* --------------------------------------------------------------------------
   TRONG MÁY ĐANG CÓ GÌ — đọc thẳng bản đã lưu, không đoán
-------------------------------------------------------------------------- */

export interface SavedSummary {
  /** số CHỖ có dự báo gió sóng trong máy */
  places: number;
  /** ngày xa nhất còn dự báo (ISO) — null nếu chưa có gì */
  untilIso: string | null;
  /** các khung ngày lưới gió/sóng đang giữ (3/7/16…) */
  gridDays: number[];
}

/** Đọc localStorage → "trong máy đang có gì" (thuần đọc, không gọi mạng). */
export function savedSummary(): SavedSummary {
  const pts = loadAll<SeaPointConditions>(POINT_NS);
  let untilIso: string | null = null;
  for (const p of pts) {
    const days = p.data?.days ?? [];
    const last = days.length ? days[days.length - 1]?.date : null;
    if (last && (untilIso == null || last > untilIso)) untilIso = last;
  }
  return { places: pts.length, untilIso, gridDays: savedGridDays() };
}

/* Câu chữ cho màn hình KHÔNG còn ở đây: từ 2026-07-25 bà con không bấm nút nữa
   (máy tự tải) và chỉ thấy MỘT dòng báo tự tắt — dòng đó dựng ở
   lib/pretrip-auto.ts (autoPretripLine). File này chỉ còn lo phần TẢI. */

/* --------------------------------------------------------------------------
   DANH SÁCH VIỆC + CHẠY
-------------------------------------------------------------------------- */

/** Bỏ các chỗ trùng ô lưới ~0,25° (chạm mấy lần quanh một chỗ = một bản lưu) */
export function dedupePoints(points: PretripPoint[]): PretripPoint[] {
  const seen = new Set<string>();
  const out: PretripPoint[] = [];
  for (const p of points) {
    const id = coordId(p.lat, p.lon);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(p);
  }
  return out;
}

/** Dựng danh sách việc — tách riêng để test được thứ tự/số việc, không gọi mạng. */
export function pretripSteps(points: PretripPoint[]): PretripStep[] {
  const steps: PretripStep[] = [];
  for (const p of dedupePoints(points)) {
    steps.push({
      label: `Gió sóng — ${p.name}`,
      run: async () => {
        await fetchSeaPoint({ lat: p.lat, lon: p.lon });
      },
    });
  }
  steps.push({
    label: "Bản đồ cá",
    run: async () => {
      const r = await fetchFishForecast();
      // BỊ KHOÁ (chưa đăng nhập / chưa premium) ≠ lỗi mạng: bỏ qua ÊM —
      // auto-pretrip chạy mỗi lần mở app, không được ngày nào cũng báo
      // "thiếu bản đồ cá" với người vốn không có quyền xem nó.
      if (!r.ok && (r.code === "login_required" || r.code === "premium_required"))
        return;
      if (!r.ok) throw new Error("bản đồ cá chưa tải được");
    },
  });
  for (const d of PRETRIP_GRID_DAYS) {
    steps.push({
      label: `Gió sóng cả vùng biển — ${d} ngày`,
      run: async () => {
        await fetchForecastGrid(d);
      },
    });
  }
  // LỚP DẢI MÀU (mây/mưa/nhiệt/dông/áp suất) — một request/khung ra cả 5 lớp,
  // tự lưu vào máy (2026-07-29: trước đây KHÔNG tải sẵn → ra khơi mở lớp lần
  // đầu là trống).
  for (const d of PRETRIP_SCALAR_DAYS) {
    steps.push({
      label: `Lớp mây mưa nhiệt — ${d} ngày`,
      run: async () => {
        await fetchScalarField("cloud", d);
      },
    });
  }
  // ĐỘ MẶN (Copernicus, same-origin ~140 KB, 4 mốc ngày) — một khoá cache duy
  // nhất nên một lần tải là đủ mọi hạng.
  steps.push({
    label: "Độ mặn",
    run: async () => {
      await fetchScalarField("salinity");
    },
  });
  // DÒNG CHẢY THEO TẦNG (2026-07-29, same-origin ~50 KB/tầng từ snapshot) —
  // 3 tầng sâu; thử khung premium 10 ngày trước, bị chặn thì rơi về 3 (không
  // biết hạng ở đây — route tự chặn). Một tầng tải được là coi như xong việc.
  steps.push({
    label: "Dòng chảy theo tầng",
    run: async () => {
      let ok = 0;
      for (const t of CUR_DEPTH_PRETRIP_TIERS) {
        try {
          await fetchCurDepthGridClient(t, CUR_DEPTH_MAX_DAYS);
          ok++;
          continue;
        } catch {}
        try {
          await fetchCurDepthGridClient(t, 3);
          ok++;
        } catch {}
      }
      if (ok === 0) throw new Error("dòng chảy theo tầng chưa tải được");
    },
  });
  // BẢN ĐỒ MÙA VỤ — asset tĩnh cùng origin (~70 KB), lớp cá của chuyến dài pha
  // trộn với nó. Service worker đã pre-cache lúc cài app; gọi ở đây là lưới an
  // toàn cho máy cài từ bản cũ (chưa có file trong kho). Không bao giờ ném.
  steps.push({
    label: "Bản đồ mùa vụ",
    run: async () => {
      await fetchClimatology();
    },
  });
  return steps;
}

/**
 * Chạy tuần tự, báo tiến trình từng bước. Một việc hỏng KHÔNG dừng cả mẻ —
 * tải được gì giữ nấy, rồi nói thật còn thiếu bao nhiêu.
 */
export async function runPretrip(
  points: PretripPoint[],
  onProgress?: (p: PretripProgress) => void,
): Promise<PretripResult> {
  const steps = pretripSteps(points);
  const total = steps.length;
  const startedAt = Date.now();
  let ok = 0;
  let failed = 0;
  for (let i = 0; i < total; i++) {
    onProgress?.({ done: i, total, label: steps[i].label });
    try {
      await steps[i].run();
      ok++;
    } catch {
      failed++;
    }
  }
  onProgress?.({ done: total, total, label: "Xong" });
  // Tầng lưu báo HẾT CHỖ trong lúc chạy → nói thật, đừng để bà con tưởng máy đã
  // giữ đủ rồi ra khơi mới biết trống.
  const full = lastStorageFullAt() >= startedAt;
  return { ok, failed, full, saved: savedSummary() };
}
