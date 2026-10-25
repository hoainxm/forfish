"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { bamHanhDong, docToast, theoDoiToast, type Toast } from "@/lib/toast";

export { baoToast, tatToast, TOAST_MS, type LoaiToast, type Toast } from "@/lib/toast";

/*
  <ToastHost/> — chỗ VẼ biên nhận nổi, gắn MỘT lần ở vỏ app (app-shell). Có bảo hiểm: gắn thêm ở đâu nữa thì
  chỉ host đầu vẽ (Kairos `use-post-actions` còn gắn một bản dự phòng tới khi vỏ app có).
  Vị trí: ngay trên dock (`--dock-total` + 0.75rem), có thanh dính đáy (`.market-purchase-bar`) thì nâng thêm
  đúng chiều cao thanh — cùng cách đo với khung Sen Biển (sen-bien-toan-app).
*/
let soHost = 0;

function doThanhDay(): number {
  const thanh = typeof document !== "undefined" ? document.querySelector<HTMLElement>(".market-purchase-bar") : null;
  return thanh ? Math.round(thanh.getBoundingClientRect().height) : 0;
}

export function ToastHost() {
  const [chu, setChu] = useState(false);
  useEffect(() => {
    const laChu = soHost === 0;
    soHost += 1;
    setChu(laChu);
    return () => {
      soHost -= 1;
    };
  }, []);
  const t = useSyncExternalStore(theoDoiToast, docToast, () => null);
  if (!chu || !t) return null;
  return <ToastView t={t} />;
}

function ToastView({ t }: { t: Toast }) {
  // đo thanh dính đáy lúc toast hiện (không quan sát liên tục — toast chỉ sống 5 s)
  const [nang, setNang] = useState(0);
  useEffect(() => setNang(doThanhDay()), [t.id]);
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4"
      style={{ bottom: `calc(var(--dock-total) + 0.75rem + ${nang}px)` }}
    >
      <div
        role="status"
        className={`pointer-events-auto flex max-w-(--w-app) items-center gap-3 rounded-2xl px-4 py-3 text-[1rem] font-semibold shadow-md ${
          t.loai === "xau" ? "bg-danger-bg text-danger" : "bg-navy text-white"
        }`}
      >
        <span className="min-w-0">{t.text}</span>
        {t.hanhDong && (
          <button
            type="button"
            onClick={() => bamHanhDong(t)}
            className="h-9 shrink-0 rounded-lg bg-white/15 px-3 text-[0.875rem] font-semibold"
          >
            {t.hanhDong.nhan}
          </button>
        )}
      </div>
    </div>
  );
}
