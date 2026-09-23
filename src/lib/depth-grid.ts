// Trục 1 — lưới độ sâu tĩnh cho dẫn đường (ràng buộc tĩnh kiểu VISIR:
// bathymetry/shoreline). Đóng gói sẵn bằng scripts/generate-depth-grid.mjs →
// public/data/depth-grid.v1.bin (4 bit/ô, bước 15" = 1/240° ≈ 450 m — ĐÚNG
// bước gốc của ETOPO/GEBCO 15"). Đáy biển không đổi → asset tĩnh, runtime
// không gọi API ngoài. Đổi nguồn độ sâu chỉ sửa script + file này.
//
// BA NGUỒN CHỒNG NHAU, LUÔN LẤY CÁI NGUY HIỂM HƠN (từ 2026-08-29), CỘNG ĐƯỜNG
// BỜ THẬT (từ 2026-09-04):
//   (1) ETOPO 2022 15" — NOAA, public domain
//   (2) GEBCO_2026 15" — qua ODB NTU; hai nguồn vênh thì lấy giá trị NÔNG HƠN
//   (3) mặt nạ rạn/bãi cạn/đá ngầm/xác tàu từ public/data/reef-shapes.v1.json:
//       ô chạm hình hiểm hoạ bị ép về lớp 1, BẤT KỂ mô hình độ sâu nói gì
//   (4) vn-coast.v1.json: ĐẤT = tâm ô trong đa giác đường bờ HOẶC z > 0.
//       Trước đây "đất = z > −2 m" biến bãi bùn ven bờ (nước 0–2 m) thành đất:
//       257/19.865 ô nước bị coi là đất, Rạch Giá không có tuyến (briefing-03).
//
// Vì sao phải có (2) và (3): ô 450 m KHÔNG phân giải nổi một cái rạn — một nửa
// số hình rạn trong reef-shapes.v1.json còn nhỏ hơn một ô. Chỉ có ETOPO thì
// 5/25 tâm rạn được xếp "đủ sâu" trong khi nước sâu 1–2 m, mà "đủ sâu" nghĩa
// là route-plan.ts vạch tuyến chạy thẳng qua. Chi tiết + số đo: chú thích đầu
// scripts/generate-depth-grid.mjs; test giữ: src/lib/__tests__/depth-grid.test.ts.

import { fetchDataBytes } from "@/lib/data-fetch";

/**
 * Sáu lớp, số NHỎ hơn = nguy hiểm hơn. Luật đi/chặn nằm ở route-plan.ts
 * (lớp 0 chặn ngoài 5 km quanh hai đầu · 1–2 chặn ngoài 12 km · 3 chỉ mở khi
 * đã khai mớn và cần ≤ 2,0 m · 4 đi được có cờ · 5 tự do).
 */
export type DepthClass =
  | 0 // ĐẤT LIỀN — tâm ô trong đa giác vn-coast HOẶC z > 0
  | 1 // mặt nạ rạn/bãi cạn/đá ngầm/xác tàu (OSM, đã nở) — tuyến không đi qua
  | 2 // nước rất cạn, z ∈ (−2, 0] — tuyến không đi qua (như lớp 1)
  | 3 // nước cạn, z ∈ (−4, −2] — chỉ tàu đã khai mớn và đủ nước mới qua
  | 4 // nước nông, z ∈ (−12, −4] — đi được, cảnh báo (tàu cá VN mớn 1,5–3 m
  //   chạy vùng 5–8 m hằng ngày; ETOPO ~mực nước trung bình, triều ±2 m)
  | 5; // đủ sâu (z ≤ −12) — và ô thiếu số liệu lẻ tẻ

/** Câu đời thường cho từng lớp — chỗ in chữ dùng bảng này, không tự đoán */
export const DEPTH_CLASS_LABEL: Record<DepthClass, string> = {
  0: "Trên bờ",
  1: "Rạn, đá ngầm, xác tàu — tránh xa",
  2: "Rất cạn, chưa tới 2 m nước",
  3: "Cạn, cỡ 2–4 m nước",
  4: "Nước nông, cỡ 4–12 m",
  5: "Nước đủ sâu, trên 12 m",
};

/**
 * Sàn độ sâu (m, theo mực nước trung bình) của mỗi lớp NƯỚC — lớp 2 sâu ít
 * nhất 0 m, lớp 3 ít nhất 2 m, lớp 4 ít nhất 4 m, lớp 5 ít nhất 12 m. `null`
 * cho đất và mặt nạ rạn (không có con số nào để tin). Chỗ khác đọc bảng này
 * thay vì đoán lại ngưỡng của script.
 */
export const DEPTH_CLASS_MIN_M: Record<DepthClass, number | null> = {
  0: null,
  1: null,
  2: 0,
  3: 2,
  4: 4,
  5: 12,
};

/** Lớp cao nhất — "đủ sâu"; chỗ so sánh "biển khơi" dùng hằng này, không viết số 5 tay */
export const DEPTH_CLASS_DEEP: DepthClass = 5;

// PHẢI khớp scripts/generate-depth-grid.mjs (test depth-grid.test.ts đọc file
// .bin thật và bắt lệch — sửa một bên mà quên bên kia là đỏ ngay).
// Ô ETOPO 15" là ô TÂM: tâm ô ở (k + 0,5)/240 độ, nên lat0/lon0 lệch nửa bước
// so với mốc 5°B/102°Đ để mọi toạ độ nguồn rơi trúng chỉ số nguyên.
const STEP_15S = 1 / 240;
export const DEPTH_META = {
  lat0: 5 + STEP_15S / 2,
  lon0: 102 + STEP_15S / 2,
  step: STEP_15S,
  nLat: 4441,
  nLon: 3841,
} as const;

export type DepthGrid = { data: Uint8Array };

/** Số byte đúng của file 4 bit/ô (2 ô/byte) — lệch một byte là file khác định dạng */
export const DEPTH_GRID_BYTES = Math.ceil((DEPTH_META.nLat * DEPTH_META.nLon) / 2);

export function decodeDepthGrid(buf: ArrayBuffer): DepthGrid {
  const data = new Uint8Array(buf);
  // Bản 2 bit cũ (4 ô/byte) có cỡ đúng một nửa → ném ⇒ chỗ gọi rơi về
  // `depthChecked=false` (đường xử đã có), không đọc sai lớp mà không ai biết.
  if (data.length !== DEPTH_GRID_BYTES) {
    throw new Error(`depth grid sai cỡ: ${data.length} ≠ ${DEPTH_GRID_BYTES}`);
  }
  return { data };
}

/**
 * Lớp độ sâu tại một điểm — null khi ngoài vùng lưới (không kết luận gì).
 * O(1): hai phép dịch bit trên Uint8Array. Ô chẵn ở 4 bit thấp, ô lẻ ở 4 bit
 * cao. Giá trị ngoài 0–5 không thể do script sinh ra → coi như không biết.
 */
export function depthClassAt(
  g: DepthGrid,
  lat: number,
  lon: number,
): DepthClass | null {
  const { lat0, lon0, step, nLat, nLon } = DEPTH_META;
  const i = Math.round((lat - lat0) / step);
  const j = Math.round((lon - lon0) / step);
  if (i < 0 || i >= nLat || j < 0 || j >= nLon) return null;
  const k = i * nLon + j;
  const v = (g.data[k >> 1] >> ((k & 1) * 4)) & 15;
  return v <= DEPTH_CLASS_DEEP ? (v as DepthClass) : null;
}

let cached: Promise<DepthGrid> | null = null;

/*  Trần chờ mạng cho lưới độ sâu. 60 s CHỨ KHÔNG 15 s NHƯ TRƯỚC (2026-08-29):
    file nở từ ~30 KB lên ~4,1 MB khi lên độ phân giải gốc 15", mà 15 s là cắt
    ngang giữa mẻ tải trên sóng 3G ở cảng (~200 KB/s ⇒ cần ~20 s) — bà con mất
    luôn ràng buộc cạn/rạn của tuyến đường một cách IM LẶNG. Cùng tinh thần với
    `ASSET_NETWORK_MS` 20 s của service worker: đừng cắt oan sóng chậm thật, chỉ
    cắt ca treo vĩnh viễn.
    2026-09-04: file lên ~8,5 MB (4 bit/ô). Vercel nén Brotli sẵn — lưới toàn
    dải dài cùng giá trị nên qua sóng nhỏ hơn nhiều; và bình thường SW đã ghim
    file trong vỏ sống-còn nên nhánh mạng này chỉ chạy lần đầu. 60 s giữ nguyên:
    8,5 MB thô ở 200 KB/s ≈ 43 s vẫn lọt. */
const DEPTH_NETWORK_MS = 60000;

/**
 * Tải lưới độ sâu (≈8,5 MB thô, cùng origin, service worker ghim sẵn trong vỏ
 * sống-còn nên ngoài biển đọc từ kho) — cache cho cả phiên.
 *
 * `async` LÀ LÁ CHẮN THỨ HAI (soát 2026-08-02). Trước đây hàm này KHÔNG async
 * mà vẫn trả `Promise`: mọi thứ ném ĐỒNG BỘ trong thân hàm (máy cũ thiếu
 * `AbortSignal.timeout` ném `TypeError` ngay tại chỗ) bay thẳng ra ngoài trước
 * khi promise kịp tồn tại ⇒ `.catch` của chỗ gọi KHÔNG với tới ⇒ cây React sập,
 * bản đồ trắng cả chuyến. Lá chắn thứ nhất là `timeoutSignal` (không bao giờ
 * ném); `async` bọc mọi cú ném còn lại thành promise hỏng để chỗ gọi bắt được.
 */
export async function fetchDepthGrid(): Promise<DepthGrid> {
  if (!cached) {
    cached = fetchDataBytes("/data/depth-grid.v1.bin", DEPTH_NETWORK_MS, "depth grid")
      .then(decodeDepthGrid)
      .catch((e) => {
        cached = null; // lần sau thử lại
        throw e;
      });
  }
  return cached;
}
