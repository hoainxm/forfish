"use client";

import { AnchorIcon, BriefcaseIcon, FishIcon, StoreIcon } from "@/components/icons";
import { tinhNangHien, VAI_CHON, type Vai } from "@/lib/vai";

/*
  THẺ CHỌN VAI (spec 17 §3.1) — chỉ ở màn /chon-vai (sau đăng ký / tài khoản chưa có vai). Chỉ Đi bạn + Chủ tàu (VAI_CHON —
  Thu mua / Đại lý do nhân viên duyệt, 04/11). Vai chọn MỘT LẦN rồi khoá (§3.3) ⇒ không có ngăn "Đổi vai". Chạm một thẻ là
  xong, không có nút Tiếp. Dưới tên: danh sách ngắn "ô dock · làm được gì" (TINH_NANG_VAI, anh Long 06/11) để bà con
  biết chọn vai này thì app có gì; chưa có gói thì dòng ô cần gói (Bản đồ của Đi bạn) vẽ MỜ + chữ đậm "Quan tâm bản đồ? Bà con dùng gói dự báo, liên hệ SDVICO để nâng cấp" — tránh chọn nhầm. `ICON_VAI` (đủ bốn vai) dùng chung cho chip vai.
*/
export const ICON_VAI: Record<Vai, typeof AnchorIcon> = {
  "ngu-dan": BriefcaseIcon,
  "chu-tau": AnchorIcon,
  "thu-mua": FishIcon,
  "dai-ly": StoreIcon,
};

export function ChonVaiThe({
  hienTai,
  coGoi,
  dangGhi,
  onChon,
}: {
  hienTai: Vai | null;
  /** tài khoản có gói — false thì dòng ô cần gói vẽ mờ + lời mời dùng gói */
  coGoi: boolean;
  /** vai đang được ghi (khoá chạm đúp) */
  dangGhi?: Vai | null;
  onChon: (v: Vai) => void;
}) {
  return (
    <ul className="space-y-2" aria-label="Bà con làm nghề gì">
      {VAI_CHON.map(({ id, ten, phu }) => {
        const Icon = ICON_VAI[id];
        const dang = hienTai === id;
        return (
          <li key={id}>
            <button
              type="button"
              onClick={() => onChon(id)}
              disabled={!!dangGhi}
              aria-pressed={dang}
              className={`flex min-h-[4.25rem] w-full items-start gap-3 py-3 rounded-2xl border bg-card px-4 text-left transition active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-sea disabled:opacity-60 ${
                dang ? "border-sea" : "border-line"
              }`}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sea/10 text-sea">
                <Icon className="h-6 w-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[1.0625rem] font-semibold text-navy">{ten}</span>
                <span className="block text-[0.875rem] leading-snug text-foreground/70">{phu}</span>
                <span className="mt-1.5 block space-y-0.5" aria-label={`Vai ${ten} có`}>
                  {tinhNangHien(id, coGoi).map((t) => (
                    <span key={t.o} className="flex gap-1.5 text-[0.8125rem] leading-snug text-foreground/70">
                      <span className={`w-[3.75rem] shrink-0 font-semibold ${t.khoa ? "text-muted line-through" : "text-navy"}`}>
                        {t.o}
                      </span>
                      <span className={`min-w-0 ${t.khoa ? "font-semibold text-muted" : ""}`}>{t.viec}</span>
                    </span>
                  ))}
                </span>
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
