"use client";

import { AnchorIcon, BriefcaseIcon, FishIcon, StoreIcon } from "@/components/icons";
import { VAI, type Vai } from "@/lib/vai";

/*
  BỐN THẺ CHỌN VAI (spec 17 §3.1) — chỉ ở màn /chon-vai (sau đăng ký / tài khoản chưa có vai). Vai chọn MỘT LẦN rồi
  khoá (§3.3) ⇒ không có ngăn "Đổi vai". Chạm một thẻ là xong, không có nút Tiếp. `ICON_VAI` dùng chung cho chip vai.
*/
export const ICON_VAI: Record<Vai, typeof AnchorIcon> = {
  "ngu-dan": BriefcaseIcon,
  "chu-tau": AnchorIcon,
  "thu-mua": FishIcon,
  "dai-ly": StoreIcon,
};

export function ChonVaiThe({
  hienTai,
  dangGhi,
  onChon,
}: {
  hienTai: Vai | null;
  /** vai đang được ghi (khoá chạm đúp) */
  dangGhi?: Vai | null;
  onChon: (v: Vai) => void;
}) {
  return (
    <ul className="space-y-2" aria-label="Bà con làm nghề gì">
      {VAI.map(({ id, ten, phu }) => {
        const Icon = ICON_VAI[id];
        const dang = hienTai === id;
        return (
          <li key={id}>
            <button
              type="button"
              onClick={() => onChon(id)}
              disabled={!!dangGhi}
              aria-pressed={dang}
              className={`flex min-h-[4.25rem] w-full items-center gap-3 rounded-2xl border bg-card px-4 text-left transition active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-sea disabled:opacity-60 ${
                dang ? "border-sea" : "border-line"
              }`}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sea/10 text-sea">
                <Icon className="h-6 w-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[1.0625rem] font-semibold text-navy">{ten}</span>
                <span className="block text-[0.875rem] leading-snug text-foreground/70">{phu}</span>
              </span>
              {dang && <span className="shrink-0 text-[0.8125rem] font-semibold text-sea">Đang dùng</span>}
              {dangGhi === id && <span className="shrink-0 text-[0.8125rem] text-muted">Đang lưu…</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
