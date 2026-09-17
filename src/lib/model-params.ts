// THAM SỐ MÔ HÌNH ĐÃ ĐO (trọng số pha trộn cá × mùa vụ, bảng skill dự báo) —
// nạp từ file SDF2 `/data/model-params.v1.json` thay vì nhúng vào bundle JS
// (2026-09-16). Nguồn sự thật vẫn là `src/data/*.json` (script fit/backtest ghi
// vào đó); `scripts/build-model-params.mjs` gộp thành file phát hành, có cổng
// test bắt lệch.
//
// VÌ SAO: bundle JS ai cũng đọc được; hai bảng này là công sức đo backtest thật.
// Nằm trong SDF2 thì chỉ tài khoản đã đăng nhập giải được (lib/data-key).
//
// OFFLINE: file trong CRITICAL_SHELL của SW; chưa nạp/không nạp được ⇒ các hàm
// dùng tham số tự rơi về mặc định an toàn (blend tắt = giữ dự báo, skill = null
// = không hạ độ tin) — đúng đường "suy biến" đã có sẵn trong fish-blend.
// KHÔNG BAO GIỜ ném; hỏng thì xoá đệm để lần sóng về sau thử lại.

import { useSyncExternalStore } from "react";
import { fetchDataJson } from "@/lib/data-fetch";

export const MODEL_PARAMS_URL = "/data/model-params.v1.json";

export interface ModelParams {
  v?: number;
  fishBlend?: unknown;
  forecastSkill?: unknown;
}

let current: ModelParams | null = null;
let loading: Promise<ModelParams | null> | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) {
    try {
      l();
    } catch {
      /* một listener hỏng không được chặn người khác */
    }
  }
}

/** Bảng hiện hành, đồng bộ. null = chưa nạp. */
export function getModelParams(): ModelParams | null {
  return current;
}

/** Đặt thẳng (loader + test). */
export function setModelParams(p: ModelParams | null): void {
  current = p && typeof p === "object" ? p : null;
  notify();
}

/** Nạp một lần cho cả phiên; hỏng ⇒ null và cho phép thử lại lần sau. */
export function loadModelParams(): Promise<ModelParams | null> {
  if (current) return Promise.resolve(current);
  if (loading) return loading;
  loading = fetchDataJson<ModelParams>(MODEL_PARAMS_URL, 15000, "model-params")
    .then((p) => {
      setModelParams(p);
      return current;
    })
    .catch(() => {
      loading = null; // lần sau thử lại — mất sóng/thiếu khoá không khoá vĩnh viễn
      return null;
    });
  return loading;
}

export function subscribeModelParams(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Hook: component vẽ lại khi tham số nạp xong. Tự kích nạp nếu chưa có. */
export function useModelParams(): ModelParams | null {
  const p = useSyncExternalStore(subscribeModelParams, getModelParams, () => null);
  if (!p && typeof window !== "undefined") void loadModelParams();
  return p;
}

/** Cho test: về trạng thái trống. */
export function __resetModelParamsForTest(): void {
  current = null;
  loading = null;
  listeners.clear();
}
