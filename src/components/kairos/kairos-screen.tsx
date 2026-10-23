"use client";

/*
  MÀN KAIROS ĐẦY ĐỦ (dòng tin chung + Bến) = KairosFeed + hành vi thẻ (usePostActions) + khung
  soạn. Bến truyền `port` ⇒ dòng tin lọc theo cảng, ô mời đăng THẲNG vào Bến (AC14).
  Góc phải: "Trang tôi" ⇒ /kairos/u/toi (đổi tên gọi, ảnh, số hiệu tàu — AC12).
*/

import Link from "next/link";
import { ManHeader } from "@/components/man-header";
import { NHAN } from "@/lib/labels";
import { KairosFeed } from "./kairos-feed";
import { usePostActions } from "./use-post-actions";

export function KairosScreen({ port, title = "Kairos", sub }: { port?: string; title?: string; sub?: string }) {
  const a = usePostActions();
  return (
    <div>
      <ManHeader
        title={title}
        sub={sub}
        right={
          <Link href="/kairos/u/toi" className="flex h-11 items-center rounded-xl border border-line px-3 text-[0.875rem] font-semibold text-sea">
            {NHAN.trangToi}
          </Link>
        }
      />
      <KairosFeed port={port} actions={a.actions} view={a.view} added={a.added} onCompose={() => a.compose({ kind: "new", port })} />
      {a.ui}
    </div>
  );
}
