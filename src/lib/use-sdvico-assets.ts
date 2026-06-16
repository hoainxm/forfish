"use client";

/*
  useSdvicoAssets — MỘT nguồn cho đồ SDVICO của khách trên cả trang /tau
  (roadmap hội đồng UX 2026-06-11):
  · gom fetch /api/me/sdvico về một chỗ (boat-products + boat-services trước
    đây mỗi bên tự gọi một lần)
  · phân biệt 4 nấc: loading / guest (chưa đăng nhập) / error (mạng, server)
    / ok — hết cảnh người ĐÃ đăng nhập bị mời "Đăng nhập để thấy đồ" chỉ vì
    sóng 3G yếu; thêm nấc unlinked (đăng nhập rồi nhưng chưa khớp đơn hàng)
  · cache module-level + danh sách listener → các tab dùng chung kết quả,
    retry() là cả trang cập nhật
  · addOptimisticRequest(): sau khi gửi yêu cầu CSKH thành công, mục "Yêu cầu
    đã gửi" hiện ngay — chống khách gửi trùng vì tưởng chưa ăn
*/

import { useCallback, useEffect, useState } from "react";
import type { OwnedAssets } from "@/lib/owned-assets";
import { apiUrl } from "@/lib/api-base";

export type SdvicoStatus = "loading" | "guest" | "unlinked" | "error" | "ok";

export interface SdvicoSync {
  status: SdvicoStatus;
  /** chỉ khác null khi status === "ok" */
  assets: OwnedAssets | null;
  /** xóa cache + tải lại — dùng cho nút "Thử lại" khi status === "error" */
  retry: () => void;
}

/** Phân loại phản hồi /api/me/sdvico → 1 trong 4 nấc (logic thuần, có test). */
export function classifySdvicoResponse(
  httpOk: boolean,
  body: { ok?: boolean; code?: string; assets?: unknown } | null,
): { status: Exclude<SdvicoStatus, "loading">; assets: OwnedAssets | null } {
  if (!httpOk) return { status: "error", assets: null };
  if (body?.ok && body.assets) {
    return { status: "ok", assets: body.assets as OwnedAssets };
  }
  switch (body?.code) {
    case "not_signed_in":
    case "not_configured":
      return { status: "guest", assets: null };
    case "no_link":
      return { status: "unlinked", assets: null };
    default:
      return { status: "error", assets: null };
  }
}

type CacheEntry = { status: SdvicoStatus; assets: OwnedAssets | null };

let cache: CacheEntry | null = null;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function startFetch() {
  if (inflight) return;
  inflight = (async () => {
    let next: CacheEntry;
    try {
      const r = await fetch(apiUrl("/api/me/sdvico"), {
        signal: AbortSignal.timeout(20000),
      });
      const j = await r.json().catch(() => null);
      next = classifySdvicoResponse(r.ok, j);
    } catch {
      next = { status: "error", assets: null };
    }
    cache = next;
    inflight = null;
    notify();
  })();
}

/** Yêu cầu vừa gửi xong → chèn ngay vào "Yêu cầu đã gửi" (optimistic). */
export function addOptimisticRequest(summary: string) {
  if (!cache || cache.status !== "ok" || !cache.assets) return;
  cache = {
    ...cache,
    assets: {
      ...cache.assets,
      requests: [
        {
          id: `local-${Date.now()}`,
          summary,
          status: "pending",
          sentAt: new Date().toISOString(),
        },
        ...cache.assets.requests,
      ],
    },
  };
  notify();
}

export function useSdvicoAssets(): SdvicoSync {
  const [, force] = useState(0);

  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    if (!cache) startFetch();
    return () => {
      listeners.delete(l);
    };
  }, []);

  const retry = useCallback(() => {
    cache = null;
    startFetch();
    force((n) => n + 1);
  }, []);

  return {
    status: cache?.status ?? "loading",
    assets: cache?.status === "ok" ? cache.assets : null,
    retry,
  };
}
