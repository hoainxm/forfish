"use client";

/*
  MÀN KAIROS ĐẦY ĐỦ (dòng tin chung + Bến) = KairosFeed + hành vi thẻ (usePostActions) + khung
  soạn. Bến truyền `port` ⇒ dòng tin lọc theo cảng, ô mời đăng THẲNG vào Bến (AC14).
  Góc phải: chuông "Thông báo" (chỉ tin bình luận/trả lời mình, chấm đếm chưa đọc — 14 §16, dòng tin chung) + nút bánh răng "Tuỳ chọn dòng tin" (CHỈ dòng tin chung, không ở Bến — 14 §13) + "Trang tôi" = ẢNH ĐẠI DIỆN TRÒN
  của mình như FB (K3-09: `KairosAvatar nav`, aria-label "Trang tôi"; tên đọc từ bản lưu dòng tin `authorToi`, KHÔNG gọi /me
  lúc mở màn; chưa có bài nào ⇒ chữ "T" của "Tôi") ⇒ /kairos/u/toi (đổi tên gọi, ảnh, số hiệu tàu — AC12).
  Bến (có `port`) là màn PHỤ ⇒ MarketHeader "‹ Bến X" (không trang trước ⇒ về /kairos), "Trang tôi" ở ô phải;
  tab Kairos gốc giữ tiêu đề lớn ManHeader.
*/

import Link from "next/link";
import { useEffect, useState } from "react";
import { SettingsIcon } from "@/components/icons";
import { ManHeader } from "@/components/man-header";
import { MarketHeader } from "@/components/market/shared/market-header";
import { loadFeedCache, loadTuyChon, portLabel } from "@/lib/kairos/feed-client";
import { hienCauPhu } from "@/lib/kairos/dau-man";
import { authorToi } from "@/lib/kairos/ho-so";
import { useAuthUser } from "@/lib/use-auth";
import type { TuyChon } from "@/lib/kairos/tuy-chon";
import { NHAN } from "@/lib/labels";
import { ChuongKairos } from "./chuong-kairos";
import { KairosAvatar } from "./kairos-avatar";
import { KairosFeed } from "./kairos-feed";
import { KairosFishIcon } from "./kairos-fish-icon";
import { TuyChonSheet } from "./tuy-chon-sheet";
import { usePostActions } from "./use-post-actions";

export function KairosScreen({ port, title = "Kairos", sub }: { port?: string; title?: string; sub?: string }) {
  const a = usePostActions();
  /** tuỳ chọn đã áp cho dòng tin (null = dòng tin tự đọc trong máy lúc mở màn) */
  const [tuyChon, setTuyChon] = useState<TuyChon | null>(null);
  /** ngăn đang mở: bản tuỳ chọn lúc mở (đọc lại từ máy để khớp cái dòng tin đang dùng) */
  const [mo, setMo] = useState<TuyChon | null>(null);
  const { phone, ready: authReady, signedIn } = useAuthUser();
  /** dòng tin trống? (KairosFeed báo; null = chưa đọc máy) — câu phụ chỉ hiện khi trống hoặc khách (E K3-03) */
  const [trong, setTrong] = useState<boolean | null>(null);
  /** mình trong bản lưu dòng tin (chỉ localStorage, không mạng) — null ⇒ chữ cái "T" */
  const [toi, setToi] = useState<{ profileId: string; handle: string } | null>(null);
  useEffect(() => {
    setToi(authorToi(loadFeedCache(phone)?.posts ?? []));
  }, [phone]);
  const trangToi = (
    <Link href="/kairos/u/toi" aria-label={NHAN.trangToi} title={NHAN.trangToi} className="flex shrink-0 rounded-full transition active:scale-[0.95]">
      <KairosAvatar id={toi?.profileId ?? phone ?? "toi"} name={toi?.handle ?? "Tôi"} url={null} nav />
    </Link>
  );
  return (
    <div>
      {port ? (
        // Bến = màn PHỤ (vào từ nhãn cảng trên bài / trang cá nhân) ⇒ thanh ‹ Quay lại như mọi màn phụ
        <MarketHeader title={`Bến ${portLabel(port) ?? ""}`.trim()} fallback="/kairos" right={trangToi} />
      ) : (
        <ManHeader
          // Icon cá lướt vào cạnh tiêu đề (Codex 2026-10-25) — chữ "Kairos" vẫn là tiêu đề, ảnh trang trí
          title={
            <span className="flex items-center gap-1.5">
              {/* cao 1.5rem (≈ chữ tiêu đề) — 2rem ở máy 375px đẩy chữ "Kairos" chạm nút chuông */}
              <KairosFishIcon anim="vao" className="h-6 w-auto shrink-0" />
              {title}
            </span>
          }
          // câu phụ chỉ khi chưa có gì để đọc hoặc khách chưa đăng nhập — có bài thì header 68px như màn khác
          sub={hienCauPhu({ authReady, signedIn, trong }) ? sub : undefined}
          right={
            <div className="flex items-center gap-2">
              <ChuongKairos />
              <button
                type="button"
                aria-label={NHAN.tuyChon}
                title={NHAN.tuyChon}
                onClick={() => setMo(tuyChon ?? loadTuyChon())}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-line text-sea transition active:scale-[0.97]"
              >
                <SettingsIcon className="h-5 w-5" />
              </button>
              {trangToi}
            </div>
          }
        />
      )}
      <KairosFeed
        port={port}
        tuyChon={port ? undefined : (tuyChon ?? undefined)}
        actions={a.actions}
        view={a.view}
        added={a.added}
        onCompose={() => a.compose({ kind: "new", port })}
        onTrong={port ? undefined : setTrong}
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
