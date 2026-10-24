"use client";

/*
  NÚT CẢM XÚC KIỂU FACEBOOK (anh Long 2026-10-24: "cho các icon cảm xúc tương tự fb ấy").
   · Chạm  ⇒ 👍 Hay (đã có cảm xúc ⇒ gỡ), như FB.
   · Giữ lâu (~0,4 s, điện thoại) hoặc rê chuột (máy tính) ⇒ thanh 6 cảm xúc nổi lên, chạm một cái để chọn/đổi.
   · Nút hiện cảm xúc ĐANG CHỌN (biểu tượng + tên, màu theo loại); chưa chọn ⇒ icon tay + "Hay".
  `DongCamXuc` = dòng tổng trên chân thẻ: tối đa 3 biểu tượng nhiều nhất chồng lên nhau + tổng số.
*/

import { useEffect, useRef, useState } from "react";
import { ThumbIcon } from "@/components/icons";
import { CAM_XUC, camXucCua, type CamXuc, type DemCamXuc } from "@/lib/kairos/cam-xuc";
import { NHAN } from "@/lib/labels";

const GIU_MS = 400;
const RE_MS = 550;

export function NutCamXuc({
  my,
  onChon,
  disabled = false,
  nho = false,
  dem,
  className = "",
}: {
  my: CamXuc | null;
  /** kiểu FB mới (chân thẻ một hàng): hiện SỐ lượt thay cho tên cảm xúc; 0 ⇒ chỉ biểu tượng */
  dem?: number;
  /** loại người chọn; trùng loại đang có ⇒ bên gọi gỡ (chonCamXuc) */
  onChon: (kind: CamXuc) => void;
  disabled?: boolean;
  /** cỡ bình luận */
  nho?: boolean;
  className?: string;
}) {
  const [mo, setMo] = useState(false);
  const hen = useRef<ReturnType<typeof setTimeout> | null>(null);
  const daGiu = useRef(false);
  const vung = useRef<HTMLSpanElement>(null);

  const huyHen = () => {
    if (hen.current) clearTimeout(hen.current);
    hen.current = null;
  };
  useEffect(() => huyHen, []);
  // bấm ra ngoài / Escape ⇒ đóng thanh cảm xúc
  useEffect(() => {
    if (!mo) return;
    const ngoai = (e: PointerEvent) => {
      if (!vung.current?.contains(e.target as Node)) setMo(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMo(false);
    document.addEventListener("pointerdown", ngoai);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", ngoai);
      document.removeEventListener("keydown", esc);
    };
  }, [mo]);

  const cx = my ? camXucCua(my) : null;
  const chon = (k: CamXuc) => {
    setMo(false);
    onChon(k);
  };

  return (
    <span
      ref={vung}
      className={`relative flex min-w-0 ${nho || dem !== undefined ? "" : "flex-1"}`}
      onMouseEnter={() => {
        if (disabled) return;
        huyHen();
        hen.current = setTimeout(() => setMo(true), RE_MS);
      }}
      onMouseLeave={() => {
        huyHen();
        hen.current = setTimeout(() => setMo(false), 300);
      }}
    >
      {mo && (
        <span
          role="group"
          aria-label="Chọn cảm xúc"
          className={`anim-pop-in absolute bottom-full left-0 z-20 mb-1.5 flex gap-0.5 rounded-full border border-line bg-card px-1.5 py-1 shadow-float`}
        >
          {CAM_XUC.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-label={c.nhan}
              title={c.nhan}
              aria-pressed={my === c.id}
              onClick={() => chon(c.id)}
              className={`flex h-11 w-11 items-center justify-center rounded-full text-[1.75rem] leading-none transition-transform hover:scale-125 active:scale-110 ${my === c.id ? "bg-field" : ""}`}
            >
              <span aria-hidden>{c.emoji}</span>
            </button>
          ))}
        </span>
      )}
      <button
        type="button"
        disabled={disabled}
        aria-pressed={!!my}
        aria-haspopup="true"
        aria-label={`${cx ? `${cx.nhan} — chạm để gỡ, giữ để đổi cảm xúc` : `${NHAN.hay} — giữ để chọn cảm xúc khác`}${dem ? `, ${dem} lượt` : ""}`}
        style={{ WebkitTouchCallout: "none" }}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          if (disabled || e.pointerType === "mouse") return;
          daGiu.current = false;
          huyHen();
          hen.current = setTimeout(() => {
            daGiu.current = true;
            setMo(true);
          }, GIU_MS);
        }}
        onPointerUp={huyHen}
        onPointerCancel={huyHen}
        onClick={() => {
          if (daGiu.current) {
            daGiu.current = false; // vừa giữ để mở thanh — không tính là chạm
            return;
          }
          huyHen();
          setMo(false);
          onChon(my ?? "hay");
        }}
        className={`${className} select-none ${cx ? cx.mau : nho ? "" : "text-foreground/75"} disabled:active:scale-100`}
      >
        {cx ? (
          <span aria-hidden className={nho ? "text-[1rem] leading-none" : "text-[1.25rem] leading-none"}>
            {cx.emoji}
          </span>
        ) : (
          <ThumbIcon className={nho ? "h-4 w-4" : "h-5 w-5"} />
        )}
        {dem === undefined ? (cx ? cx.nhan : NHAN.hay) : dem > 0 ? <span className="tabular-nums">{dem}</span> : null}
      </button>
    </span>
  );
}

/** Dòng tổng kiểu FB: ≤3 biểu tượng nhiều nhất chồng nhau + tổng số. Không ai bấm ⇒ không vẽ. */
export function DongCamXuc({ camXuc, tong, nho = false, chiBieuTuong = false }: { camXuc: DemCamXuc | undefined; tong: number; nho?: boolean; /** chỉ cụm biểu tượng (số đã ở nút) */ chiBieuTuong?: boolean }) {
  if (tong <= 0) return null;
  const top = (camXuc?.length ? camXuc : [{ kind: "hay" as CamXuc, n: tong }]).slice(0, 3);
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${tong} cảm xúc: ${top.map((x) => camXucCua(x.kind).nhan).join(", ")}`}>
      <span className="flex" aria-hidden>
        {top.map((x, i) => (
          <span
            key={x.kind}
            className={`flex items-center justify-center rounded-full border-2 border-card bg-card leading-none ${nho ? "h-5 w-5 text-[0.75rem]" : "h-6 w-6 text-[0.875rem]"} ${i ? "-ml-1.5" : ""}`}
          >
            {camXucCua(x.kind).emoji}
          </span>
        ))}
      </span>
      {!chiBieuTuong && <span className={`tabular-nums text-foreground/65 ${nho ? "text-[0.8125rem]" : "text-[0.875rem]"}`}>{tong}</span>}
    </span>
  );
}
