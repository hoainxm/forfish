"use client";

import { CommentIcon, PhoneIcon } from "@/components/icons";
import { SQ_BTN } from "@/components/ui/sq-btn";
import { baoToast } from "@/lib/toast";
import { tachSdt, telHref, zaloHref } from "@/lib/cho-ca";
import { NHAN } from "@/lib/labels";
import { useOnline } from "@/lib/use-online";

/*
  CẶP "GỌI · NHẮN" cho thẻ liên hệ ở Chợ cá (CC-18, 2026-10-25): ở ta Zalo là kênh mặc định
  với vựa/nậu — ngoài biển sóng yếu bà con nhắn trước, gọi sau. "Nhắn" chỉ là deep-link ra
  app Zalo (`https://zalo.me/<sđt>`), KHÔNG xây chat trong app.
  · Chỉ vẽ "Nhắn" khi có số DI ĐỘNG (`zaloHref` ⇒ số bàn 02xx không có Zalo) — không có thì
    "Gọi" một mình, trọn bề ngang như cũ.
  · Mất sóng: "Nhắn" mờ + chạm báo "Cần sóng để nhắn Zalo" (toast, 3 s); "Gọi" vẫn sáng vì
    gọi điện không cần dữ liệu.
  · Hai nút SQ_BTN `bg-field`, chia 2 cột đều (như FB/Zalo đặt Nhắn ngang Gọi).
*/
export function LienHe({ phone, className = "" }: { phone: string; className?: string }) {
  const online = useOnline();
  const zalo = zaloHref(phone);
  const so = tachSdt(phone)[0] ?? phone;
  const goi = (
    <a href={telHref(so)} className={`${SQ_BTN} w-full min-w-0 bg-field text-sea`}>
      <PhoneIcon className="h-4 w-4" />
      {NHAN.goi}
    </a>
  );
  if (!zalo) return <div className={className}>{goi}</div>;
  return (
    <div className={`grid grid-cols-2 gap-2 ${className}`}>
      {goi}
      <a
        href={zalo}
        target="_blank"
        rel="noopener"
        aria-disabled={!online || undefined}
        onClick={(e) => {
          if (online) return;
          e.preventDefault();
          baoToast(`${NHAN.canSong} để nhắn Zalo`, { loai: "xau", ms: 3000 });
        }}
        className={`${SQ_BTN} w-full min-w-0 bg-field text-sea ${online ? "" : "opacity-50"}`}
      >
        <CommentIcon className="h-4 w-4" />
        {NHAN.nhan}
      </a>
    </div>
  );
}
