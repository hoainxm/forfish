/**
 * Trục 1 — ĐỌC `vn-sea-lanes.v1.json` (+ `coral-reefs.v1.json`) VÀO JAVASCRIPT.
 *
 * Lớp này đã có trên bản đồ từ lâu, nhưng theo đường `<Source data={URL}>` —
 * MapLibre tự tải và tự giữ, mã JavaScript KHÔNG bao giờ nhìn thấy feature nào.
 * Tính đường và dẫn đường thì cần chính những feature đó (giàn khoan, vùng cấm
 * vào, cáp ngầm, đường ống, vùng cấm neo), nên phải có một cửa đọc thật.
 *
 * MỘT CỬA DUY NHẤT + đệm cả phiên: bản đồ, thẻ tuyến và dẫn đường cùng gọi hàm
 * này thì chỉ có ĐÚNG MỘT lượt tải, và ngoài biển thì lượt đó lấy từ kho service
 * worker chứ không ra mạng.
 *
 * `async` LÀ LÁ CHẮN THỨ HAI (cùng án lệ `fetchXacTau`, `fetchDepthGrid`): hàm
 * trả Promise mà không `async` thì cú ném ĐỒNG BỘ trong thân (máy cũ thiếu
 * `AbortSignal.timeout`) bay ra trước khi promise kịp tồn tại ⇒ `.catch` của
 * chỗ gọi không với tới ⇒ bản đồ trắng cả chuyến.
 */

import { fetchDataJson } from "@/lib/data-fetch";
import { haversineKm } from "@/lib/route-plan";
import { ISLANDS_DATA_URL, REEFS_DATA_URL, SEA_LANES_DATA_URL } from "@/lib/ocean-map";

/**
 * Một cửa đọc chung cho MỌI lớp GeoJSON tĩnh mà thuật toán cần: đệm theo URL,
 * hỏng thì xoá đệm để lần sóng về sau thử lại. Viết một lần ở đây thay vì chép
 * `fetchX` cho từng lớp (nguyên tắc 15 bậc 2).
 */
const cache = new Map<string, Promise<GeoJSON.Feature[]>>();

async function fetchFeatures(url: string, nhan: string): Promise<GeoJSON.Feature[]> {
  let p = cache.get(url);
  if (!p) {
    p = fetchDataJson(url, 20000, nhan)
      .then((j) => {
        const fc = j as Partial<GeoJSON.FeatureCollection> | null;
        return Array.isArray(fc?.features) ? fc.features : [];
      })
      .catch((e) => {
        cache.delete(url); // lần sóng về sau thử lại
        throw e;
      });
    cache.set(url, p);
  }
  return p;
}

/**
 * Feature của luồng/cáp/ống/giàn khoan/vùng cấm (~348 cái, ~1 MB). Hỏng thì
 * XOÁ đệm để lần sóng về sau thử lại — mất sóng ngoài khơi không được khoá
 * vĩnh viễn một lớp dữ liệu.
 */
export async function fetchSeaLanes(): Promise<GeoJSON.Feature[]> {
  return fetchFeatures(SEA_LANES_DATA_URL, "sea-lanes");
}

/**
 * Rạn / đá ngầm / bãi cạn CÓ TÊN (`coral-reefs.v1.json`). Hậu kiểm tuyến dùng
 * để GẮN TÊN cho đoạn cạn — "bãi rất cạn" thành "gần Đá Lát", tên bà con đối
 * chiếu được với hải đồ giấy và với nhau qua bộ đàm.
 */
export async function fetchCoralReefs(): Promise<GeoJSON.Feature[]> {
  return fetchFeatures(REEFS_DATA_URL, "coral-reefs");
}

/** Đảo CÓ TÊN (`vn-islands.v1.json`) — giọng đọc "phía trước là đảo Lý Sơn". */
export async function fetchIslands(): Promise<GeoJSON.Feature[]> {
  return fetchFeatures(ISLANDS_DATA_URL, "vn-islands");
}

/** Tên điểm (Point có `name`) gần nhất trong `maxKm` — gọi tên đảo/bãi cho câu nói. */
export function nearestNamedPoint(
  features: readonly GeoJSON.Feature[] | null | undefined,
  p: { lat: number; lon: number },
  maxKm: number,
): { name: string; type: string | null } | null {
  if (!features) return null;
  const pad = maxKm / 100; // độ ≈ 111 km — hộp thô rộng hơn chút cho chắc
  const cosLat = Math.cos((p.lat * Math.PI) / 180);
  let best: { name: string; type: string | null } | null = null;
  let bestKm = maxKm;
  for (const f of features) {
    const g = f?.geometry;
    if (!g || g.type !== "Point") continue;
    const [lon, lat] = g.coordinates;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (Math.abs(lat - p.lat) > pad || Math.abs(lon - p.lon) > pad / Math.max(cosLat, 0.1)) continue;
    const props = f.properties as { name?: string; type?: string } | null;
    if (!props?.name) continue;
    const km = haversineKm(p, { lat, lon });
    if (km < bestKm) {
      bestKm = km;
      best = { name: props.name, type: props.type ?? null };
    }
  }
  return best;
}

const CO_LOAI = /^(đảo|hòn|cù lao|bãi|đá|cồn|rạn|mũi)\s/i;

/**
 * Tên để ĐỌC cho chỗ nón phía trước chạm (nav-hazards `nameAt`):
 *  · bờ/đảo → đảo có tên trong 6 km ("đảo Lý Sơn"; tên đã có "Hòn/Cù Lao…" thì
 *    giữ nguyên), không có thì đá/cồn nổi trong 3 km;
 *  · rạn → bãi/đá/rạn có tên trong 3 km.
 * Không thấy tên ⇒ null: câu cũ "bờ hoặc đảo", KHÔNG đoán.
 */
export function tenChoPhiaTruoc(
  islands: readonly GeoJSON.Feature[] | null,
  reefs: readonly GeoJSON.Feature[] | null,
  p: { lat: number; lon: number },
  kind: "bo" | "ran",
): string | null {
  if (kind === "bo") {
    const dao = nearestNamedPoint(islands, p, 6);
    if (dao) return CO_LOAI.test(dao.name) ? dao.name : `đảo ${dao.name}`;
  }
  const bai = nearestNamedPoint(reefs, p, 3);
  return bai?.name ?? null;
}
