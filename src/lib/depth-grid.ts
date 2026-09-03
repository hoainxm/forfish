// Trục 1 — lưới độ sâu tĩnh cho dẫn đường (ràng buộc tĩnh kiểu VISIR:
// bathymetry/shoreline). Đóng gói sẵn bằng scripts/generate-depth-grid.mjs →
// public/data/depth-grid.v1.bin (2 bit/ô, bước 15" = 1/240° ≈ 450 m — ĐÚNG
// bước gốc của ETOPO/GEBCO 15"). Đáy biển không đổi → asset tĩnh, runtime
// không gọi API ngoài. Đổi nguồn độ sâu chỉ sửa script + file này.
//
// BA NGUỒN CHỒNG NHAU, LUÔN LẤY CÁI NGUY HIỂM HƠN (từ 2026-08-29):
//   (1) ETOPO 2022 15" — NOAA, public domain
//   (2) GEBCO_2026 15" — qua ODB NTU; hai nguồn vênh thì lấy giá trị NÔNG HƠN
//   (3) mặt nạ rạn/bãi cạn/đá ngầm/xác tàu từ public/data/reef-shapes.v1.json:
//       ô chạm hình hiểm hoạ bị ép về lớp 1, BẤT KỂ mô hình độ sâu nói gì
//
// Vì sao phải có (2) và (3): ô 450 m KHÔNG phân giải nổi một cái rạn — một nửa
// số hình rạn trong reef-shapes.v1.json còn nhỏ hơn một ô. Chỉ có ETOPO thì
// 5/25 tâm rạn được xếp "đủ sâu" trong khi nước sâu 1–2 m, mà "đủ sâu" nghĩa
// là route-plan.ts vạch tuyến chạy thẳng qua. Chi tiết + số đo: chú thích đầu
// scripts/generate-depth-grid.mjs; test giữ: src/lib/__tests__/depth-grid.test.ts.

import { timeoutSignal } from "@/lib/abort";

export type DepthClass =
  | 0 // đất liền (z > -2 m)
  | 1 // rất cạn (z > -4 m HOẶC ô chạm hình rạn/bãi cạn/đá ngầm/xác tàu) —
  //   tuyến không đi qua
  | 2 // nước nông (z > -12 m) — đi được, cảnh báo (tàu cá VN mớn 1,5–3 m
  //   chạy vùng 5–8 m hằng ngày; ETOPO ~mực nước trung bình, triều ±2 m)
  | 3; // đủ sâu

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

export function decodeDepthGrid(buf: ArrayBuffer): DepthGrid {
  const data = new Uint8Array(buf);
  const need = Math.ceil((DEPTH_META.nLat * DEPTH_META.nLon) / 4);
  if (data.length !== need) {
    throw new Error(`depth grid sai cỡ: ${data.length} ≠ ${need}`);
  }
  return { data };
}

/** Lớp độ sâu tại một điểm — null khi ngoài vùng lưới (không kết luận gì) */
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
  return ((g.data[k >> 2] >> ((k & 3) * 2)) & 3) as DepthClass;
}

let cached: Promise<DepthGrid> | null = null;

/*  Trần chờ mạng cho lưới độ sâu. 60 s CHỨ KHÔNG 15 s NHƯ TRƯỚC (2026-08-29):
    file nở từ ~30 KB lên ~4,1 MB khi lên độ phân giải gốc 15", mà 15 s là cắt
    ngang giữa mẻ tải trên sóng 3G ở cảng (~200 KB/s ⇒ cần ~20 s) — bà con mất
    luôn ràng buộc cạn/rạn của tuyến đường một cách IM LẶNG. Cùng tinh thần với
    `ASSET_NETWORK_MS` 20 s của service worker: đừng cắt oan sóng chậm thật, chỉ
    cắt ca treo vĩnh viễn. */
const DEPTH_NETWORK_MS = 60000;

/**
 * Tải lưới độ sâu (≈4,1 MB, cùng origin, service worker ghim sẵn trong vỏ
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
    cached = fetch("/data/depth-grid.v1.bin", {
      signal: timeoutSignal(DEPTH_NETWORK_MS),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`depth grid ${r.status}`);
        return r.arrayBuffer();
      })
      .then(decodeDepthGrid)
      .catch((e) => {
        cached = null; // lần sau thử lại
        throw e;
      });
  }
  return cached;
}
