import "server-only";
import {
  anomGridUrl,
  bathyGridUrl,
  buildFishForecast,
  chlBackupGridUrl,
  chlGridUrl,
  ERDDAP_UA,
  parseBathyGrid,
  gridDateSkewDays,
  parseErddapGrid,
  slaGridUrl,
  sstBackupGridUrl,
  sstGridUrl,
  type CurrentGrids,
  type FishForecastResult,
  type GridUnit,
  type ScalarGrid,
} from "@/lib/fish-predict";
import { isoDateVN } from "@/lib/day-labels";
import { fetchCopernicusCurrents } from "@/lib/copernicus";
import { fetchHycomGrids, type HycomGrids } from "@/lib/hycom";
import {
  dataQuality,
  monthOfIsoDate,
  oldestIsoDate,
  resolveField,
  STATIC_MAX_AGE_DAYS,
  type FieldCandidate,
  type FieldProvenance,
  type QualityField,
  type Resolved,
} from "@/lib/source-registry";

/**
 * TÍNH bản đồ dự báo cá (PFZ) — kéo lưới SST + phù du mới nhất từ nguồn công
 * khai (chậm, vài trăm KB/lưới) rồi chấm điểm bằng lib thuần, trả PAYLOAD gọn
 * (KHÔNG bọc Response — caller tự bọc).
 *
 * TÁCH KHỎI ROUTE (2026-07-26): trước đây thân này nằm thẳng trong
 * `app/api/fish-forecast/route.ts`. Nay dùng CHUNG cho:
 *   · cron `/api/cron/refresh-fish` — tính sẵn theo lịch rồi GHI snapshot Supabase
 *   · `/api/fish-forecast` — FALLBACK khi chưa có snapshot (lần đầu deploy / cron
 *     chưa chạy) để không bao giờ trắng bản đồ.
 *
 * NHIỀU NGUỒN CHO MỘT TRƯỜNG (yêu cầu chủ dự án 2026-07-26): "dữ liệu có nhiều
 * nguồn thì down về SO NGÀY (lấy ngày mới nhất), 1 nguồn lỗi thì hệ thống vẫn
 * luôn hoạt động". Luật chọn ở `lib/source-registry.ts` (thuần, có test); ở đây
 * chỉ DỰNG danh sách ứng viên + ghi lý lịch nguồn vào payload.
 */

// Lưới ERDDAP vài trăm KB nên timeout rộng hơn 15s mặc định nhưng PHẢI có
// (invariant 02 §5): nguồn treo → fail-fast thay vì treo cả serverless function.
const GRID_TIMEOUT_MS = 20000;

// NGUỒN HAY TREO (HYCOM OPeNDAP tds.hycom.org · Copernicus ARCO Zarr) — đều
// TUỲ CHỌN, nhưng compute gom mọi trường bằng Promise.all nên MỘT nguồn treo tới
// 20s là KÉO CẢ lần tính quá mốc hủy 35s của client → "dự báo cá chưa tải được"
// dù SST + phù du (bắt buộc, ~3s) đã sẵn sàng. Chẩn 2026-07-26: HYCOM .dds treo
// > 25s. Cho hai nguồn này timeout NGẮN hơn: treo thì bỏ term (bất biến
// monotonic ở buildFishForecast bảo đảm mất term chỉ GIẢM điểm, không bịa) —
// còn hơn để bà con mất cả bản đồ cá. ERDDAP bắt buộc giữ 20s (nhanh + cốt lõi).
const SLOW_SOURCE_TIMEOUT_MS = 12000;

// NOAA coastwatch ERDDAP CHẶN 403 nếu thiếu User-Agent "thật" (undici/node
// mặc định bị chặn) — phải gửi UA, không thì lưới không tải được = cá không
// chạy (chẩn 2026-06-23, trước tưởng do timeout/cache).
const opt = () => ({
  next: { revalidate: 21600 },
  signal: AbortSignal.timeout(GRID_TIMEOUT_MS),
  headers: { "User-Agent": ERDDAP_UA },
});

/** Tuổi tối đa coi là "hiện tại" cho ảnh vệ tinh ngày (trễ xử lý 1–2 ngày) */
const DAILY_MAX_AGE_DAYS = 3;
/** Phù du hay bị mây che → DINEOF vá lỗ nhưng vẫn trễ hơn; nới tuổi */
const CHL_MAX_AGE_DAYS = 7;

/** Nạp một lưới vô hướng ERDDAP → {grid, date}; không dùng được thì null */
function erddapScalar(
  url: string,
  opts: { hasAltitude: boolean; kelvin?: boolean; unit?: GridUnit },
): () => Promise<{ grid: ScalarGrid; date: string } | null> {
  return async () => {
    const res = await fetch(url, opt());
    if (!res.ok) return null;
    const g = parseErddapGrid(await res.json(), opts);
    if (g.lats.length === 0 || !g.date) return null;
    return { grid: g, date: g.date };
  };
}

/* ----------------------------------------------------------------------------
   DANH SÁCH ỨNG VIÊN theo TRƯỜNG — xếp theo ƯU TIÊN (hoà ngày thì lấy cái trước)
---------------------------------------------------------------------------- */

// SST — BẮT BUỘC. Hai nguồn NOAA khác nhau, ĐÃ FETCH THỬ THẬT (2026-07-26):
// Blended trả ảnh 23/7, CoralTemp trả ảnh 24/7 → luật "so ngày lấy mới nhất"
// hôm đó chọn CoralTemp. Hai nguồn cùng lưới 0,05° (stride 5 = 0,25°) nên ô
// khớp nhau; đơn vị KHÁC nhau (Blended kelvin, CoralTemp °C) — đã khai đúng.
const SST_CANDIDATES: FieldCandidate<ScalarGrid>[] = [
  {
    id: "noaa-blended-sst",
    label: "NOAA Blended SST daily (noaacwBLENDEDsstDaily)",
    maxAgeDays: DAILY_MAX_AGE_DAYS,
    load: erddapScalar(sstGridUrl(), {
      hasAltitude: false,
      kelvin: true,
      unit: "degC", // đã trừ Kelvin trong parser
    }),
  },
  {
    id: "noaa-coraltemp-sst",
    label: "NOAA Coral Reef Watch CoralTemp SST daily (noaacrwsstDaily)",
    maxAgeDays: DAILY_MAX_AGE_DAYS,
    load: erddapScalar(sstBackupGridUrl(), {
      hasAltitude: false,
      unit: "degC", // CoralTemp trả °C SẴN — KHÔNG kelvin (sai là lệch 273°)
    }),
  },
];

// PHÙ DU — BẮT BUỘC. Cùng thuật toán DINEOF (vá lỗ mây), khác bộ cảm biến:
// VIIRS NPP+N20 (chính) vs VIIRS + Sentinel-3 OLCI (dự phòng). Fetch thử thật
// 2026-07-26: chính 23/7, dự phòng 14/7 → chính thắng, dự phòng chỉ đỡ khi
// chính hỏng. Cùng lưới 0,083° (stride 3 = 0,25°) + có chiều altitude.
const CHL_CANDIDATES: FieldCandidate<ScalarGrid>[] = [
  {
    id: "noaa-viirs-dineof-chl",
    label: "NOAA VIIRS NPP+N20 DINEOF chlor_a (noaacwNPPN20VIIRSDINEOFDaily)",
    maxAgeDays: CHL_MAX_AGE_DAYS,
    load: erddapScalar(chlGridUrl(), { hasAltitude: true, unit: "mg/m3" }),
  },
  {
    id: "noaa-multisensor-dineof-chl",
    label:
      "NOAA VIIRS + Sentinel-3 OLCI DINEOF chlor_a (noaacwNPPN20S3ASCIDINEOFDaily)",
    maxAgeDays: CHL_MAX_AGE_DAYS,
    load: erddapScalar(chlBackupGridUrl(), { hasAltitude: true, unit: "mg/m3" }),
  },
];

// Các trường dưới đây TUỲ CHỌN: hỏng thì bỏ yếu tố, dự báo vẫn ra.
// Mới có MỘT nguồn mỗi trường — kiến trúc đã đúng, thêm nguồn sau = thêm phần tử.
const SLA_CANDIDATES: FieldCandidate<ScalarGrid>[] = [
  {
    id: "noaa-blended-ssh",
    label: "NOAA Blended SSHA daily (noaacwBLENDEDsshDaily)",
    maxAgeDays: DAILY_MAX_AGE_DAYS,
    load: erddapScalar(slaGridUrl(), { hasAltitude: false, unit: "m" }),
  },
];

const ANOM_CANDIDATES: FieldCandidate<ScalarGrid>[] = [
  {
    id: "noaa-crw-sst-anomaly",
    label: "NOAA Coral Reef Watch SST anomaly daily (noaacrwsstanomalyDaily)",
    maxAgeDays: DAILY_MAX_AGE_DAYS,
    load: erddapScalar(anomGridUrl(), { hasAltitude: false, unit: "degC" }),
  },
];

/** Dòng chảy giờ (1 mốc/giờ) — quá 1 ngày là đã cũ hẳn với yếu tố hội tụ */
const HOURLY_MAX_AGE_DAYS = 1;

// DÒNG CHẢY — chỉ dùng cho yếu tố HỘI TỤ (`conv`). CHỈ MỘT ỨNG VIÊN, VÀ ĐÓ LÀ Ý
// ĐỒ (2026-07-26): NOAA địa chuyển bị gỡ vì phân kỳ của nó là nhiễu số học (lùi
// về nhiễu tệ hơn không có). Copernicus hỏng ⇒ trường này = null ⇒
// buildFishForecast BỎ HẲN term `conv` (bất biến monotonic: mất nguồn = điểm giảm).
const CURRENT_CANDIDATES: FieldCandidate<CurrentGrids>[] = [
  {
    id: "copernicus-glo-phy-uv-total",
    label:
      "Copernicus Marine GLOBAL_ANALYSISFORECAST_PHY_001_024 " +
      "utotal/vtotal 1/12° (ARCO Zarr, asset timeChunked)",
    maxAgeDays: HOURLY_MAX_AGE_DAYS,
    load: async () => {
      const g = await fetchCopernicusCurrents({
        timeoutMs: SLOW_SOURCE_TIMEOUT_MS,
      });
      if (!g) return null;
      // ngày = ngày UTC của MỐC GIỜ đã chọn (dataset bước 1 giờ)
      return { grid: { u: g.u, v: g.v }, date: g.timeISO.slice(0, 10) };
    },
  },
];

// HYCOM: MỘT cube → ba lưới (D20 tầng cá ngừ + nhiệt đáy + nhiệt 250 m).
// Giữ chung một trường `hycom` vì chúng cùng một lần tải, cùng một ngày.
const HYCOM_CANDIDATES: FieldCandidate<HycomGrids>[] = [
  {
    id: "hycom-gofs",
    label: "HYCOM GOFS (OPeNDAP) — nhiệt theo tầng sâu",
    maxAgeDays: DAILY_MAX_AGE_DAYS,
    load: async () => {
      const g = await fetchHycomGrids(SLOW_SOURCE_TIMEOUT_MS);
      if (!g) return null;
      const date = g.d20?.date || g.bottom?.date || g.deep250?.date || "";
      return date ? { grid: g, date } : null;
    },
  },
];

/** Trường TĨNH: xem hàm dựng ứng viên bên dưới (ngày = hôm nay theo định nghĩa) */
function bathyCandidates(todayIso: string): FieldCandidate<ScalarGrid>[] {
  return [
    {
      id: "etopo-2022-15s",
      label: "ETOPO 2022 15s độ sâu đáy (NOAA PIFSC ERDDAP)",
      // Đáy biển KHÔNG đổi theo ngày → không có khái niệm "ảnh cũ"; đánh stale
      // ở đây sẽ hạ chất lượng oan.
      maxAgeDays: STATIC_MAX_AGE_DAYS,
      load: async () => {
        const res = await fetch(bathyGridUrl(), opt());
        if (!res.ok) return null;
        // ETOPO không có cột time → parser riêng, ngày = hôm nay (dữ liệu tĩnh)
        const g = parseBathyGrid(await res.json());
        return g.lats.length > 0 ? { grid: g, date: todayIso } : null;
      },
    },
  ];
}

/** Trường nào THIẾU HẲN thì phải trả {ok:false} */
const REQUIRED_FIELDS = new Set(["sst", "chl"]);

/**
 * Tính một bản đồ dự báo cá MỚI. Trả payload đúng như route vẫn trả (ok/date/
 * cells/species/generatedAt/sources/dataQuality/targetDate/dateSkewDays), hoặc
 * `{ ok:false }` khi SST/phù du hết sạch nguồn.
 */
export async function computeFishForecast(): Promise<FishForecastResult> {
  try {
    // Ngày hôm nay theo GIỜ VIỆT NAM — máy chủ Vercel chạy UTC, lấy đồng hồ máy
    // chủ sẽ lệch ngày (và lệch THÁNG mùa vụ) trong khoảng 00:00–07:00 giờ VN.
    const todayIso = isoDateVN();

    // MỌI ứng viên của MỌI trường chạy SONG SONG (resolveField dùng allSettled
    // bên trong, các trường lại nằm trong một Promise.all) — tổng thời gian =
    // lưới CHẬM NHẤT, không cộng dồn. Ngân sách route 60s giữ nguyên.
    const [sstR, chlR, slaR, anomR, curR, hycomR, bathyR] = await Promise.all([
      resolveField(SST_CANDIDATES, todayIso),
      resolveField(CHL_CANDIDATES, todayIso),
      resolveField(SLA_CANDIDATES, todayIso),
      resolveField(ANOM_CANDIDATES, todayIso),
      resolveField(CURRENT_CANDIDATES, todayIso),
      resolveField(HYCOM_CANDIDATES, todayIso),
      resolveField(bathyCandidates(todayIso), todayIso),
    ]);

    // SST + phù du BẮT BUỘC: hết sạch nguồn thì không bịa bản đồ cá
    if (!sstR || !chlR) return { ok: false };

    // TARGET DATE = ngày dữ liệu THỰC TẾ đang dùng (ảnh cũ hơn trong 2 trường
    // bắt buộc), KHÔNG phải hôm nay. Mùa vụ phải lọc theo ngày này.
    const targetDate = oldestIsoDate([sstR.date, chlR.date]);
    const month = monthOfIsoDate(targetDate) || monthOfIsoDate(todayIso);

    const hycom = hycomR?.grid ?? null;

    // LÝ LỊCH NGUỒN (provenance) — trường nào KHÔNG có mặt trong `sources` tức
    // là không nguồn nào dùng được cho trường đó.
    const fields: Record<string, Resolved<unknown> | null> = {
      sst: sstR,
      chl: chlR,
      sla: slaR,
      anom: anomR,
      currents: curR,
      hycom: hycomR,
      bathy: bathyR,
    };
    const sources: Record<string, FieldProvenance> = {};
    const quality: QualityField[] = [];
    for (const [key, r] of Object.entries(fields)) {
      quality.push({
        key,
        required: REQUIRED_FIELDS.has(key),
        resolved: r ? { stale: r.stale } : null,
      });
      if (r) {
        sources[key] = {
          id: r.id,
          date: r.date,
          ageDays: r.ageDays,
          stale: r.stale,
        };
      }
    }

    // LỆCH NGÀY giữa các lưới: mỗi nguồn một nhịp → đo và NÓI (dataQuality trừ).
    const skewDays = gridDateSkewDays([
      sstR.grid,
      chlR.grid,
      slaR?.grid,
      anomR?.grid,
      curR?.grid?.u,
      hycom?.d20,
      hycom?.bottom,
    ]);
    return {
      ...buildFishForecast(sstR.grid, chlR.grid, slaR?.grid ?? null, month, {
        anom: anomR?.grid ?? null,
        cur: curR?.grid ?? null,
        thermo: hycom?.d20 ?? null,
        depth: bathyR?.grid ?? null,
        bottomTemp: hycom?.bottom ?? null,
        // nhiệt 250 m — hạ tầng giữ sẵn, chưa gán loài (xem 01-product)
        deepTemp: hycom?.deep250 ?? null,
      }),
      // `generatedAt` = LÚC TÍNH bản đồ này (khác `date` = ngày ẢNH vệ tinh).
      generatedAt: new Date().toISOString(),
      sources,
      dataQuality: dataQuality(quality, skewDays),
      targetDate,
      dateSkewDays: skewDays,
    };
  } catch {
    return { ok: false };
  }
}
