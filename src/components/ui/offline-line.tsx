import type { ReactNode } from "react";
import { StatusBanner } from "@/components/ui/status-banner";
import { cauMatSong } from "@/lib/offline-line";

/*
  OfflineLine — MỘT khuôn dòng mất sóng (VO-APP-08). Băng vàng `StatusBanner warn` (icon đồng hồ mặc định) +
  câu chuẩn từ `lib/offline-line cauMatSong`. `extra` = vế thêm ngắn của màn (vd " · 12 món"), nối sau câu.
  Màn nào còn tự viết "Mất sóng…" thì thay bằng cái này — không chế câu mới.
*/
export function OfflineLine({ savedAt, extra, icon }: { savedAt?: number | string | null; extra?: ReactNode; icon?: ReactNode }) {
  return (
    <StatusBanner level="warn" icon={icon}>
      {cauMatSong(savedAt)}
      {extra}
    </StatusBanner>
  );
}
