// Trục 1 — NEO VỆ TINH + XU HƯỚNG COPERNICUS cho nhiệt mặt biển (SST) ngày mai.
//
// VÌ SAO CÓ FILE NÀY
// Bản đồ cá đang chỉ có MỘT bản (ảnh vệ tinh mới nhất). Muốn kéo sang ngày mai
// thì phải biết nhiệt đổi thế nào. Đã ĐO (scripts/copernicus-tendency-skill.mjs
// → src/data/copernicus-tendency-skill.json, 4 khối 15 ngày rải 4 mùa):
//
//   · NHIỆT (SST): CÓ kỹ năng xu hướng — corrTendency 0,299 (tầm 1) → 0,461
//     (tầm 3); dùng hệ số hãm alphaOpt (cross-validated) thì RMSE tốt hơn
//     persistence +8,5 % (tầm 1) → +22,8 % (tầm 3).
//   · PHÙ DU (chl/phyc): KHÔNG có kỹ năng (corrTendency ≈ 0, gain CV âm)
//     ⇒ GIỮ NGUYÊN ảnh hôm nay (persistence), KHÔNG kéo theo Copernicus.
//   · FRONT nhiệt (|gradient|): neo LÀM XẤU đi (frontCorrPred < frontCorrPersist
//     ở MỌI tầm) ⇒ nhiệt chỉ dùng cho GIÁ TRỊ (cổng nhiệt `tFit`), KHÔNG dùng
//     để tính front — xem tham số `frontSst` của `buildFishForecast`.
//
// CÔNG THỨC (neo có hãm):
//   sst_pred(D+k) = sst_sat(D) + α_k · [ cop(D+k) − cop(D) ]
// α_k = `alphaOpt` của tầm k trong bảng đo. α < 1 vì Copernicus có biên độ đổi
// lớn hơn thực tế + tương quan chưa cao; hãm lại mới thắng persistence.
//
// TRUNG THỰC: các số trong bảng là CẬN TRÊN lạc quan (xem `honestyWarnings`
// trong file JSON — cop(D+k) quá khứ là analysis đã đồng hoá quan trắc, không
// phải dự báo phát ngày D). Vì vậy KHÔNG hứa %; chỉ dùng để (a) chọn α,
// (b) xếp hạng độ tin theo tầm ngày.
//
// File này THUẦN (không mạng, không DOM) → test ở __tests__/sst-tendency.test.ts.

import raw from "@/data/copernicus-tendency-skill.json";
import { nearestIndex, type ScalarGrid } from "@/lib/fish-predict";

/** Tầm ngày TỐI ĐA bản đồ cá dám vẽ (hôm nay = 0). Chốt sản phẩm: +3. */
export const MAX_FISH_LEAD = 3;

interface LeadRow {
  lead: number;
  alphaOpt?: number;
  gainOptCvPct?: number;
  beatsPersistenceOptimalDampingCv?: boolean;
  corrTendency?: { pearson?: number };
  rmsePersist?: number;
  rmsePredOptimalDamping?: number;
}

const SST_ROWS: LeadRow[] = (() => {
  const rows = (raw as { perLead?: { sst?: unknown } })?.perLead?.sst;
  return Array.isArray(rows) ? (rows as LeadRow[]) : [];
})();

function rowFor(lead: number): LeadRow | null {
  return SST_ROWS.find((r) => r?.lead === lead) ?? null;
}

/**
 * Hệ số hãm α cho tầm `lead` ngày. 0 = KHÔNG có kỹ năng đo được ⇒ người gọi
 * phải rơi về persistence (giữ nguyên ảnh vệ tinh hôm nay).
 *
 * Điều kiện nhận α: bảng đo phải nói RÕ là bản hãm-tối-ưu thắng persistence
 * KHI ĐÃ CROSS-VALIDATE (`beatsPersistenceOptimalDampingCv`) — chứ không phải
 * α khớp trên chính dữ liệu đem chấm. Ngoài [1..MAX_FISH_LEAD] → 0.
 */
export function sstTendencyAlpha(lead: number): number {
  if (!Number.isInteger(lead) || lead < 1 || lead > MAX_FISH_LEAD) return 0;
  const r = rowFor(lead);
  if (!r || r.beatsPersistenceOptimalDampingCv !== true) return 0;
  const a = r.alphaOpt;
  if (typeof a !== "number" || !Number.isFinite(a) || a <= 0) return 0;
  // α > 1 = khuếch đại xu hướng: bảng đo chưa bao giờ ra thế; kẹp cho an toàn.
  return Math.min(1, a);
}

/** Số ĐO độ tin của một tầm ngày (để UI nói thật, KHÔNG bịa %) */
export interface LeadSkill {
  lead: number;
  /** tương quan xu hướng (Pearson) — 0 nếu không đo được */
  corrTendency: number;
  /** % RMSE tốt hơn persistence, đã cross-validate; ≤0 = không hơn */
  gainPct: number;
  /** true khi bản đồ ngày đó dùng xu hướng Copernicus; false = giữ ảnh hôm nay */
  usesTendency: boolean;
}

export function sstLeadSkill(lead: number): LeadSkill {
  const r = rowFor(lead);
  const alpha = sstTendencyAlpha(lead);
  return {
    lead,
    corrTendency: Number.isFinite(r?.corrTendency?.pearson)
      ? (r!.corrTendency!.pearson as number)
      : 0,
    gainPct: Number.isFinite(r?.gainOptCvPct) ? (r!.gainOptCvPct as number) : 0,
    usesTendency: alpha > 0,
  };
}

/**
 * Sai lệch tối đa (°C) cho phép giữa ô Copernicus lấy được và ô cần lấy mẫu.
 * Lưới Copernicus dùng ở đây là 1/3°, lưới NOAA 0,25° — cùng phủ hộp biển VN
 * nên láng giềng gần nhất luôn ≤ ~0,2°. Quá 0,5° nghĩa là lưới đã lệch/rách
 * ⇒ coi như THIẾU (rơi về persistence tại ô đó), KHÔNG kéo nhiệt bậy.
 */
const MAX_SNAP_DEG = 0.5;

/**
 * Chặn biên độ kéo nhiệt (°C). Đo thật: SST đổi RMS ~0,39 °C sau 3 ngày; quá
 * 5 °C chắc chắn là lưới hỏng/fill lọt lưới chứ không phải hải dương học.
 */
const MAX_DELTA_C = 5;

/**
 * Dựng lưới SST cho ngày D+k: neo vào ẢNH VỆ TINH hôm nay, cộng xu hướng
 * Copernicus đã hãm. Trả lưới MỚI trên ĐÚNG trục lat/lon của `sat` (không
 * regrid ngược) để mọi thứ phía sau (front, chấm điểm) không đổi hình học.
 *
 * RƠI VỀ PERSISTENCE (trả bản sao `sat`) khi: α = 0, thiếu lưới Copernicus,
 * hoặc ô không lấy được cả hai mốc. Nguồn Copernicus hỏng ⇒ bản đồ vẫn chạy
 * y như hôm nay, KHÔNG vỡ.
 */
export function anchoredSstGrid(opts: {
  /** ảnh vệ tinh hôm nay (lưới chuẩn, °C) */
  sat: ScalarGrid;
  /** Copernicus tại NGÀY NỀN (cùng ngày với `sat`), °C — null = thiếu */
  copBase: ScalarGrid | null;
  /** Copernicus tại NGÀY ĐÍCH D+k, °C — null = thiếu */
  copLead: ScalarGrid | null;
  /** hệ số hãm (xem `sstTendencyAlpha`) */
  alpha: number;
  /** ngày ISO gán cho lưới trả về (mặc định: giữ ngày của `sat`) */
  date?: string;
}): ScalarGrid {
  const { sat, copBase, copLead, alpha } = opts;
  const date = opts.date ?? sat.date;
  if (!(alpha > 0) || !copBase || !copLead) {
    return { lats: sat.lats, lons: sat.lons, values: sat.values, date };
  }

  // ánh xạ trục 1 lần (nhanh + để kiểm khoảng cách snap)
  const mapAxis = (ref: number[], src: number[]): number[] =>
    ref.map((v) => {
      const k = nearestIndex(src, v);
      return k >= 0 && Math.abs(src[k] - v) <= MAX_SNAP_DEG ? k : -1;
    });
  const bi = mapAxis(sat.lats, copBase.lats);
  const bj = mapAxis(sat.lons, copBase.lons);
  const li = mapAxis(sat.lats, copLead.lats);
  const lj = mapAxis(sat.lons, copLead.lons);

  const values = sat.values.map((row, i) =>
    row.map((v, j) => {
      if (!Number.isFinite(v)) return v; // đất liền / thiếu → giữ nguyên
      if (bi[i] < 0 || bj[j] < 0 || li[i] < 0 || lj[j] < 0) return v;
      const a = copBase.values[bi[i]]?.[bj[j]];
      const b = copLead.values[li[i]]?.[lj[j]];
      if (!Number.isFinite(a) || !Number.isFinite(b)) return v;
      const d = alpha * ((b as number) - (a as number));
      if (!Number.isFinite(d) || Math.abs(d) > MAX_DELTA_C) return v;
      return v + d;
    }),
  );
  return { lats: sat.lats, lons: sat.lons, values, date };
}
