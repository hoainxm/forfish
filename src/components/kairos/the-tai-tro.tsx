"use client";

/*
  THẺ TÀI TRỢ trong dòng tin Kairos (14 §20, lib/kairos/quang-cao.ts). Cùng khung `.surface` với thẻ bài để không
  lạc giọng, nhưng ĐẦU THẺ luôn ghi "Tài trợ · <nhà tài trợ>" (Luật Quảng cáo 75/2025: phải nhận biết được là quảng
  cáo) — không có Hay/Bình luận/Chia sẻ (không phải bài của bà con). Nút mở trang đích ở thẻ mới, `rel="sponsored"`.
  Không đếm lượt xem/bấm, không gửi gì về máy chủ (không theo dõi). Mạng yếu ⇒ ảnh hoãn như thẻ bài (KhungAnh).
  Mất sóng: màn không vẽ thẻ (bản lưu không giữ quảng cáo — trang đích cũng cần sóng).
*/

import { useState } from "react";
import { ShareIcon } from "@/components/icons";
import type { TheTaiTro } from "@/lib/kairos/quang-cao";
import { NHAN } from "@/lib/labels";
import { KhungAnh, useHoanAnh } from "./de-dung";

export function TheTaiTroCard({ ad }: { ad: TheTaiTro }) {
  const hoan = useHoanAnh();
  const [xem, setXem] = useState(false);
  return (
    <article className="surface overflow-hidden" aria-label={`${NHAN.taiTro}: ${ad.tieuDe}`}>
      <p className="truncate px-4 pt-3 pb-1 text-[0.8125rem] text-foreground/65">
        <span className="font-bold text-foreground/75">{NHAN.taiTro}</span> · {ad.nhaTaiTro}
      </p>
      <h2 className="px-4 pb-1 text-[1.0625rem] font-bold leading-snug text-navy">{ad.tieuDe}</h2>
      {ad.noiDung && <p className="px-4 pb-2 text-[1rem] leading-relaxed">{ad.noiDung}</p>}
      {ad.anh && hoan && !xem && <KhungAnh soAnh={1} onXem={() => setXem(true)} className="h-16" />}
      {ad.anh && (!hoan || xem) && (
        <div className="aspect-[16/9] bg-field">
          {/* eslint-disable-next-line @next/next/no-img-element -- ảnh do quản trị đặt (kho kairos-media / https ngoài) */}
          <img src={ad.anh} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
        </div>
      )}
      <a
        href={ad.link}
        target="_blank"
        rel="sponsored noopener noreferrer"
        className="mx-4 my-3 flex h-11 items-center justify-center gap-2 rounded-xl bg-sea text-[1rem] font-semibold text-white transition active:scale-[0.98]"
      >
        {ad.nut}
        <ShareIcon className="h-4 w-4" />
      </a>
    </article>
  );
}
