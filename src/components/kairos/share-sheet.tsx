"use client";

/*
  BẢNG CHIA SẺ 4 VIỆC (14 §3.5, AC11) — học khung SharePostSheet của Forlife, bỏ phần thừa:
   · Đăng lại  — mở khung soạn kèm thẻ bài gốc + lời mình (bên gọi lo)
   · Gửi đi    — navigator.share link /k/[id] (Zalo, Messenger…); máy không có ⇒ chép link
   · Chép link — clipboard; không chép được ⇒ hiện link để giữ ngón chép tay
   · Tải ảnh   — chỉ khi bài có ảnh; tải từng ảnh về máy, không được ⇒ mở ảnh ở tab mới
  Link công khai không mang SĐT (chỉ id bài). Mọi việc báo kết quả thật trong bảng.
*/

import { useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { inputClass } from "@/components/ui/primitives";
import { baoToast } from "@/components/ui/toast";
import type { KairosPost } from "@/lib/kairos/types";
import { shareLink, shareText } from "@/lib/kairos/write-client";
import { downloadOne } from "@/lib/kairos/tai-anh";
import { NHAN } from "@/lib/labels";
import { useOnline } from "@/lib/use-online";

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function ShareSheet({
  post,
  onClose,
  onReshare,
}: {
  post: KairosPost;
  onClose: () => void;
  onReshare: (p: KairosPost) => void;
}) {
  const online = useOnline();
  const [showLink, setShowLink] = useState(false);
  const [busy, setBusy] = useState(false);
  const link = shareLink(post.id, typeof window === "undefined" ? "" : window.location.origin);

  const doCopy = async () => {
    if (await copy(link)) {
      // như FB: chép xong là đóng bảng, biên nhận nổi trên dock (toast chung) — không để câu nằm trong sheet
      baoToast("Đã chép link. Dán vào Zalo hoặc tin nhắn để gửi.");
      onClose();
    } else {
      // không chép tự động được ⇒ hiện link ngay trong bảng để giữ ngón chép tay (câu dẫn đi kèm ô, không toast)
      setShowLink(true);
    }
  };

  const doSend = async () => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Kairos — SDFish", text: shareText(post), url: link });
        onClose();
      } catch (e) {
        // bà con tự đóng bảng của máy ⇒ không báo lỗi
        if ((e as Error)?.name !== "AbortError") baoToast("Chưa gửi được. Thử Chép link.", { loai: "xau" });
      }
      return;
    }
    await doCopy();
  };

  const doDownload = async () => {
    setBusy(true);
    let fail = 0;
    for (let i = 0; i < post.images.length; i++) {
      const ok = await downloadOne(post.images[i], `kairos-${post.id.slice(0, 8)}-${i + 1}.jpg`);
      if (!ok) {
        fail++;
        window.open(post.images[i], "_blank", "noopener");
      }
    }
    setBusy(false);
    if (fail) baoToast("Có ảnh chưa tải về được — đã mở ảnh ở tab mới, giữ ngón lên ảnh để lưu.", { loai: "xau" });
    else baoToast(`Đã tải ${post.images.length} ảnh về máy.`);
  };

  const row = "flex min-h-14 w-full items-center rounded-xl px-3 text-left text-[1rem] font-semibold text-navy active:bg-field disabled:opacity-40";
  return (
    <BottomSheet title={NHAN.chiaSe} onClose={onClose}>
      <div className="divide-y divide-line">
        <button type="button" className={row} onClick={() => onReshare(post)}>
          {NHAN.dangLai}
          <span className="ml-auto text-[0.875rem] font-normal text-foreground/65">lên Kairos kèm lời bạn</span>
        </button>
        <button type="button" className={row} onClick={() => void doSend()}>
          {NHAN.guiDi}
          <span className="ml-auto text-[0.875rem] font-normal text-foreground/65">Zalo, tin nhắn…</span>
        </button>
        <button type="button" className={row} onClick={() => void doCopy()}>
          {NHAN.chepLink}
        </button>
        {post.images.length > 0 && (
          <button type="button" className={row} disabled={busy || !online} onClick={() => void doDownload()}>
            {NHAN.taiAnh}
            <span className="ml-auto text-[0.875rem] font-normal text-foreground/65">
              {!online ? NHAN.canSong : busy ? NHAN.dangTai : `${NHAN.anh} ${post.images.length}`}
            </span>
          </button>
        )}
      </div>
      {showLink && (
        <>
          <input readOnly value={link} aria-label="Link bài" className={`${inputClass} mt-3`} onFocus={(e) => e.currentTarget.select()} />
          <p role="status" className="mt-2 text-[0.875rem] text-foreground/65">
            Máy không cho chép tự động — giữ ngón lên link để chép.
          </p>
        </>
      )}
    </BottomSheet>
  );
}
