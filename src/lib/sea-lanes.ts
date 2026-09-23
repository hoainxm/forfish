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
import { REEFS_DATA_URL, SEA_LANES_DATA_URL } from "@/lib/ocean-map";

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
