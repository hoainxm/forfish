"use client";

/**
 * BẢNG KIỂM TRA TẢI Ô BẢN ĐỒ — chỉ hiện khi URL có `?debug=tiles`.
 * Dành cho người phát triển/hỗ trợ: mở lớp nào cũng thấy ngay mỗi nguồn đã
 * tải bao nhiêu %, bao nhiêu ô lỗi và lỗi gần nhất (mã HTTP / thông điệp).
 * Không gửi gì đi đâu, không lưu gì — chỉ đọc trạng thái MapLibre trong máy.
 */

import { useEffect, useState } from "react";
import type { Map as MaplibreMap } from "maplibre-gl";
import { readTileTallies, type TileTally } from "@/lib/tile-load-stats";
import { LOCAL_BUILD_ID } from "@/lib/app-version";
import { apiUrl } from "@/lib/api-base";
import { timeoutSignal } from "@/lib/abort";

const POLL_MS = 500;

export function TileLoadDebug({
  getMap,
  labels,
}: {
  getMap: () => MaplibreMap | undefined;
  /** tên dễ đọc cho id nguồn, vd ocean-data → "Vùng nhiều mồi" */
  labels: Record<string, string>;
}) {
  const [rows, setRows] = useState<TileTally[]>([]);
  const [lastErr, setLastErr] = useState<Record<string, string>>({});
  // Mã bản máy đang chạy vs máy chủ — lệch là máy đang kẹt code cũ (ca Android
  // 2026-09-29: sửa đã deploy mà điện thoại vẫn vẽ như cũ).
  const [serverBuild, setServerBuild] = useState<string | null>(null);
  useEffect(() => {
    fetch(apiUrl("/api/version"), { cache: "no-store", signal: timeoutSignal(5000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setServerBuild(typeof j?.build === "string" ? j.build : "?"))
      .catch(() => setServerBuild("không hỏi được"));
  }, []);

  useEffect(() => {
    let map: MaplibreMap | undefined;
    const onError = (e: { sourceId?: string; error?: { status?: number; message?: string } }) => {
      if (!e.sourceId) return;
      const msg = e.error?.status ? `HTTP ${e.error.status}` : (e.error?.message ?? "lỗi");
      setLastErr((p) => ({ ...p, [e.sourceId!]: msg }));
    };
    const tick = () => {
      const m = getMap();
      if (m && m !== map) {
        map?.off("error", onError);
        map = m;
        map.on("error", onError);
        // chế độ kiểm tra: để sẵn bản đồ cho DevTools soi tiếp (`__sdfMap`)
        (window as unknown as { __sdfMap?: MaplibreMap }).__sdfMap = m;
      }
      setRows(readTileTallies(m).filter((r) => r.total > 0));
    };
    tick();
    const t = setInterval(tick, POLL_MS);
    return () => {
      clearInterval(t);
      map?.off("error", onError);
    };
  }, [getMap]);

  return (
    <div
      className="glass pointer-events-auto absolute left-2 top-28 z-30 max-w-[20rem] p-3 text-sm text-foreground"
      role="status"
      aria-label="Kiểm tra tải bản đồ"
    >
      <p className="mb-1 font-bold">Tải ô bản đồ</p>
      <p className="mb-1">
        Bản máy: {LOCAL_BUILD_ID || "(trống)"} · máy chủ: {serverBuild ?? "…"}
        {serverBuild && LOCAL_BUILD_ID && serverBuild !== LOCAL_BUILD_ID ? (
          <span className="block font-bold text-danger">↳ Máy đang chạy BẢN CŨ</span>
        ) : null}
      </p>
      {rows.length === 0 ? (
        <p>Chưa có ô nào…</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((r) => (
            <li key={r.source}>
              <span className="font-semibold">{labels[r.source] ?? r.source}</span>{" "}
              <span className={r.errored ? "text-danger" : r.pct === 100 ? "text-ok" : "text-warn"}>
                {r.pct}%
              </span>{" "}
              ({r.loaded}/{r.total}
              {r.loading ? ` · đang ${r.loading}` : ""}
              {r.errored ? ` · lỗi ${r.errored}` : ""})
              {lastErr[r.source] && r.errored ? (
                <span className="block text-danger">↳ {lastErr[r.source]}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
