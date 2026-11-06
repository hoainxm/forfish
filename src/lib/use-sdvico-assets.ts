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
import { timeoutSignal } from "@/lib/abort";
import { noteResponse, tokenHeader } from "@/lib/device-token-store";

export type SdvicoStatus = "loading" | "guest" | "unlinked" | "error" | "ok";

export interface SdvicoSync {
  status: SdvicoStatus;
  /** chỉ khác null khi status === "ok" */
  assets: OwnedAssets | null;
  /** xóa cache + tải lại — dùng cho nút "Thử lại" khi status === "error" */
  retry: () => void;
  /** "Số khác" bà con đã gửi, nhân viên chưa duyệt (0086) — để nói "đang chờ SDVICO xác nhận" */
  choDuyet: string[];
}

/** Phân loại phản hồi /api/me/sdvico → 1 trong 4 nấc (logic thuần, có test). */
export function classifySdvicoResponse(
  httpOk: boolean,
  body: { ok?: boolean; code?: string; assets?: unknown; choDuyet?: unknown } | null,
): { status: Exclude<SdvicoStatus, "loading">; assets: OwnedAssets | null; choDuyet: string[] } {
  const choDuyet = Array.isArray(body?.choDuyet) ? body.choDuyet.filter((s): s is string => typeof s === "string") : [];
  if (!httpOk) return { status: "error", assets: null, choDuyet };
  if (body?.ok && body.assets) {
    return { status: "ok", assets: body.assets as OwnedAssets, choDuyet };
  }
  switch (body?.code) {
    case "not_signed_in":
      return { status: "guest", assets: null, choDuyet };
    /*  not_configured = MÁY CHỦ thiếu cấu hình/DB, KHÔNG phải bà con chưa đăng nhập (anh Long 06/11: "vô đây là đang
        vô app rồi còn đăng nhập gì nữa"). Trước đây gộp vào guest ⇒ người đã vào app bị mời Đăng nhập. */
    case "no_link":
      return { status: "unlinked", assets: null, choDuyet };
    default:
      return { status: "error", assets: null, choDuyet };
  }
}

type CacheEntry = { status: SdvicoStatus; assets: OwnedAssets | null; choDuyet: string[] };

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
        headers: tokenHeader(),
        signal: timeoutSignal(20000),
      });
      /* MỘT DÒNG NÀY = chỗ này cũng phát hiện được máy bị đá. Bộ não vẫn
         nằm ở `noteResponse`; ở đây chỉ đưa phản hồi cho nó soi. */
      void noteResponse(r);
      const j = await r.json().catch(() => null);
      next = classifySdvicoResponse(r.ok, j);
    } catch {
      next = { status: "error", assets: null, choDuyet: cache?.choDuyet ?? [] };
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

/**
 * Bà con gửi / rút "số khác" (số mua hàng SDVICO, số máy giám sát) — /api/me/sdt-khac (0086). Cần sóng; trả mã lỗi để
 * màn nói đúng câu. Xong ⇒ cập nhật `choDuyet` ngay (không đợi tải lại — route /api/me/sdvico có cache 10 phút).
 */
export async function guiSoKhac(sdt: string, rut = false): Promise<{ ok: true } | { ok: false; code: string }> {
  try {
    const r = await fetch(apiUrl("/api/me/sdt-khac"), {
      method: rut ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json", ...tokenHeader() },
      body: JSON.stringify({ sdt }),
      signal: timeoutSignal(15000),
    });
    const j = (await r.json().catch(() => null)) as { ok?: boolean; code?: string; sdt?: string } | null;
    if (!j?.ok) return { ok: false, code: j?.code ?? `http_${r.status}` };
    if (cache) {
      const so = j.sdt ?? sdt;
      const ds = cache.choDuyet.filter((x) => x !== so);
      cache = { ...cache, choDuyet: rut ? ds : [...ds, so] };
      notify();
    }
    return { ok: true };
  } catch {
    return { ok: false, code: "mat_song" };
  }
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
    choDuyet: cache?.choDuyet ?? [],
  };
}
