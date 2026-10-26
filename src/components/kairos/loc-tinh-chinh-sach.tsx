"use client";

/*
  LỌC TỈNH CỦA TAB CHÍNH SÁCH (14 §21c) — MỘT nút nhỏ "📍 <Tỉnh> ▾" bên trái dưới thanh tab (anh Long 2026-10-26: "design
  cái lọc quá xấu quá thô" — thay HomeBar ba nút to chồng dưới segmented control). Chạm ⇒ hộp chọn tỉnh dùng chung
  (`ChonTinhPopover`, region-filter) có thêm hàng "Cả nước" ở đầu. Chọn tỉnh ⇒ ghi tỉnh nhà như Chợ cá (`useHome().chonTinh`
  — vào tàu đang chọn, không có tàu thì vào phiên) + về chế độ "Gần". Chưa có tỉnh ⇒ nút ghi "Cả nước" (dòng tin cả nước).
  Không GPS. Không mạng: chỉ đổi tham số `province` của dòng tin.
*/

import { useState } from "react";
import { ChevronDownIcon, PinIcon } from "@/components/icons";
import { ChonTinhPopover } from "@/components/ui/region-filter";
import type { HomePref } from "@/lib/region";
import { NHAN } from "@/lib/labels";

export function LocTinhChinhSach({
  home,
  gan,
  setGan,
  chonTinh,
}: {
  home: HomePref;
  /** true = chỉ tỉnh nhà (+ văn bản cả nước); false = cả nước */
  gan: boolean;
  setGan: (v: boolean) => void;
  chonTinh: (province: string) => boolean;
}) {
  const [nut, setNut] = useState<HTMLButtonElement | null>(null);
  const [mo, setMo] = useState(false);
  const [hong, setHong] = useState(false);
  const theoTinh = gan && !!home.province;
  return (
    <div className="px-4 pb-2">
      <button
        ref={setNut}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={mo}
        aria-label={`${NHAN.chonTinh}: ${theoTinh ? home.province : "Cả nước"}`}
        onClick={() => setMo((v) => !v)}
        className="inline-flex h-9 max-w-full items-center gap-1.5 rounded-full bg-sea/8 pl-3 pr-2.5 text-[0.875rem] font-semibold text-navy transition active:bg-sea/15"
      >
        <PinIcon className="h-4 w-4 shrink-0 text-sea" />
        <span className="min-w-0 truncate">{theoTinh ? home.province : "Cả nước"}</span>
        <ChevronDownIcon className={`h-4 w-4 shrink-0 text-foreground/55 transition ${mo ? "rotate-180" : ""}`} />
      </button>
      {hong && (
        <p role="alert" className="mt-1.5 text-[0.875rem] text-warn">
          Máy chưa lưu được tỉnh — bà con thử lại nhé.
        </p>
      )}
      {mo && (
        <ChonTinhPopover
          anchor={nut}
          dangChon={home.province}
          caNuoc={{
            on: !theoTinh,
            onChon: () => {
              setGan(false);
              setMo(false);
            },
          }}
          onChon={(p) => {
            const ok = chonTinh(p);
            setHong(!ok);
            setMo(false);
            if (ok) setGan(true);
          }}
          onClose={() => setMo(false)}
        />
      )}
    </div>
  );
}
