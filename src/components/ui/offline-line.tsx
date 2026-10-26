"use client";

import type { ReactNode } from "react";
import { StatusBanner } from "@/components/ui/status-banner";
import { cauChuaTai, cauMatSong } from "@/lib/offline-line";
import { useOnline } from "@/lib/use-online";

/*
  OfflineLine — MỘT khuôn dòng mất sóng (VO-APP-08). Băng vàng `StatusBanner warn` (icon đồng hồ mặc định) +
  câu chuẩn từ `lib/offline-line cauMatSong`. `extra` = vế thêm ngắn của màn (vd " · 12 món"), nối sau câu.
  Màn nào còn tự viết "Mất sóng…" thì thay bằng cái này — không chế câu mới.
*/
/** Câu màn trống vì tải lỗi — "Mạng yếu…" khi máy vẫn có mạng, câu `matSong` riêng của màn khi mất mạng thật. */
export function CauChuaTai({ matSong, thuLai }: { matSong: string; thuLai?: string }) {
  const online = useOnline();
  return <>{cauChuaTai(online, matSong, thuLai)}</>;
}

export function OfflineLine({ savedAt, extra, icon }: { savedAt?: number | string | null; extra?: ReactNode; icon?: ReactNode }) {
  /*  Máy vẫn báo có mạng mà màn vẫn tới đây (tải lỗi / quá giờ) ⇒ "Mạng yếu", không "Mất sóng" (2026-10-26).
      SSR coi như có mạng (useOnline server snapshot = true) — dòng này chỉ hiện sau khi tải lỗi ở client. */
  const online = useOnline();
  return (
    <StatusBanner level="warn" icon={icon}>
      {cauMatSong(savedAt, undefined, online)}
      {extra}
    </StatusBanner>
  );
}
