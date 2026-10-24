"use client";

/*
  MÀN KAIROS ĐẦY ĐỦ (dòng tin chung + Bến) = KairosFeed + hành vi thẻ (usePostActions) + khung
  soạn. Bến truyền `port` ⇒ dòng tin lọc theo cảng, ô mời đăng THẲNG vào Bến (AC14).
  Góc phải: chuông "Thông báo" (chỉ tin bình luận/trả lời mình, chấm đếm chưa đọc — 14 §16, dòng tin chung) + nút bánh răng "Tuỳ chọn dòng tin" (CHỈ dòng tin chung, không ở Bến — 14 §13) + "Trang tôi" ⇒
  /kairos/u/toi (đổi tên gọi, ảnh, số hiệu tàu — AC12).
*/

import Link from "next/link";
import { useState } from "react";
import { SettingsIcon } from "@/components/icons";
import { ManHeader } from "@/components/man-header";
import { loadTuyChon } from "@/lib/kairos/feed-client";
import type { TuyChon } from "@/lib/kairos/tuy-chon";
import { NHAN } from "@/lib/labels";
import { ChuongKairos } from "./chuong-kairos";
import { KairosFeed } from "./kairos-feed";
import { TuyChonSheet } from "./tuy-chon-sheet";
import { usePostActions } from "./use-post-actions";

export function KairosScreen({ port, title = "Kairos", sub }: { port?: string; title?: string; sub?: string }) {
  const a = usePostActions();
  /** tuỳ chọn đã áp cho dòng tin (null = dòng tin tự đọc trong máy lúc mở màn) */
  const [tuyChon, setTuyChon] = useState<TuyChon | null>(null);
  /** ngăn đang mở: bản tuỳ chọn lúc mở (đọc lại từ máy để khớp cái dòng tin đang dùng) */
  const [mo, setMo] = useState<TuyChon | null>(null);
  return (
    <div>
      <ManHeader
        title={title}
        sub={sub}
        right={
          <div className="flex items-center gap-2">
            {!port && <ChuongKairos />}
            {!port && (
              <button
                type="button"
                aria-label={NHAN.tuyChon}
                title={NHAN.tuyChon}
                onClick={() => setMo(tuyChon ?? loadTuyChon())}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-line text-sea transition active:scale-[0.97]"
              >
                <SettingsIcon className="h-5 w-5" />
              </button>
            )}
            <Link href="/kairos/u/toi" className="flex h-11 items-center rounded-xl border border-line px-3 text-[0.875rem] font-semibold text-sea">
              {NHAN.trangToi}
            </Link>
          </div>
        }
      />
      <KairosFeed
        port={port}
        tuyChon={port ? undefined : (tuyChon ?? undefined)}
        actions={a.actions}
        view={a.view}
        added={a.added}
        onCompose={() => a.compose({ kind: "new", port })}
      />
      {mo && (
        <TuyChonSheet
          value={mo}
          onClose={(t) => {
            setMo(null);
            setTuyChon(t);
          }}
        />
      )}
      {a.ui}
    </div>
  );
}
