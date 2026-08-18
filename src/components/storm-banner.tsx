"use client";

/**
 * Trục 1 — banner tin bão / áp thấp trên Biển Đông (nguồn qua lib/storms.ts).
 * BA trạng thái, không được nhập nhằng (xem stormStatus trong lib/storms.ts):
 *   · có bão  → thẻ đỏ/vàng to, không thể bỏ qua, KÈM GIỜ CỦA BẢN TIN
 *   · hỏi được & không có bão → dòng xanh trấn an, KÈM GIỜ ĐÃ HỎI
 *   · KHÔNG hỏi được (mất sóng / nguồn lỗi / tin quá cũ) → nền VÀNG cảnh báo,
 *     tuyệt đối không được nói "không có bão"
 */
import { useEffect, useState } from "react";
import { stormStatus } from "@/lib/storms";
import { useStormCheck } from "@/lib/use-storm-check";
import { clockVN } from "@/lib/day-labels";
import { beaufort } from "@/lib/marine-weather";
import { AlertIcon, CheckIcon, ChevronDownIcon, ChevronUpIcon } from "@/components/icons";

export function StormBanner({
  variant = "page",
}: {
  /** "overlay" = nổi trên bản đồ full-screen: chip gọn khi yên, thẻ đầy đủ khi có bão */
  variant?: "page" | "overlay";
}) {
  // Hỏi tin bão + TỰ THỬ LẠI khi có sóng lại / mở lại app / định kỳ.
  // KHÔNG gọi fetchStormCheck một lần rồi thôi — xem lib/use-storm-check.ts.
  const { check, nowMs } = useStormCheck();
  // Overlay: cho thu/mở để tin bão không chiếm hết view (user 2026-06-23).
  // Mặc định MỞ (an toàn — bà con phải thấy ít nhất 1 lần), thu lại thành 1
  // chip đỏ/vàng vẫn nổi bật, chạm để mở lại.
  const [open, setOpen] = useState(true);


  // Trạng thái thật của tin bão — tin để lâu quá thì tự rớt về "chưa hỏi được"
  // (không bao giờ để tin cũ trông như tin mới).
  const status = stormStatus(check, nowMs);

  // Overlay có bão: hiện đầy đủ ~3s lúc mở/refresh bản đồ rồi TỰ THU thành chip
  // (user 2026-06-23) — bà con thấy 1 lần, sau đó không chiếm view; chạm mở lại.
  useEffect(() => {
    if (variant !== "overlay") return;
    if (!check?.ok || check.storms.length === 0) return;
    const t = setTimeout(() => setOpen(false), 3000);
    return () => clearTimeout(t);
  }, [check, variant]);

  if (status.kind === "dang-hoi") return null; // đang hỏi — chưa nói gì

  // KHÔNG hỏi được (mất sóng / nguồn lỗi / tin trong máy đã quá cũ): nền VÀNG,
  // nói thẳng là app CHƯA hỏi được — khác hẳn "không có bão".
  if (status.kind === "khong-hoi-duoc") {
    if (variant === "overlay") {
      return (
        <p
          role="status"
          className="pointer-events-auto mx-auto flex w-fit max-w-[92%] items-start gap-1.5 rounded-2xl bg-warn-bg px-3 py-2 text-[0.9375rem] font-bold leading-snug text-warn shadow-md"
        >
          <AlertIcon className="mt-0.5 h-5 w-5 shrink-0" />
          <span>
            Chưa hỏi được tin bão — máy không có sóng. Nghe thêm đài duyên hải /
            Icom.
          </span>
        </p>
      );
    }
    return (
      <p
        role="status"
        className="mx-4 mb-3 flex items-start gap-2 rounded-xl bg-warn-bg px-3 py-2.5 text-[1rem] font-bold leading-snug text-warn"
      >
        <AlertIcon className="mt-0.5 h-5 w-5 shrink-0" />
        <span>
          Chưa hỏi được tin bão — máy không có sóng. Nghe thêm đài duyên hải /
          Icom.
        </span>
      </p>
    );
  }

  // Hỏi được thật và không có bão → nói kèm GIỜ ĐÃ HỎI.
  if (status.kind === "khong-co") {
    const at = clockVN(status.checkedAt);
    if (variant === "overlay") {
      return (
        <p role="status" className="pointer-events-auto mx-auto flex w-fit max-w-[92%] items-center gap-1.5 rounded-full bg-ok-bg px-3 py-1.5 text-[0.875rem] font-bold leading-snug text-ok">
          <CheckIcon className="h-4 w-4 shrink-0" />
          Không có tin bão — hỏi lúc {at}
        </p>
      );
    }
    return (
      <p role="status" className="mx-4 mb-3 flex items-center gap-2 rounded-xl bg-ok-bg px-3 py-2 text-[0.9375rem] font-semibold text-ok">
        <CheckIcon className="h-4.5 w-4.5 shrink-0" />
        Không có tin bão trên Biển Đông (hỏi lúc {at}).
      </p>
    );
  }

  // Overlay đã thu: 1 chip cảnh báo gọn, vẫn nổi bật, chạm để mở lại.
  if (variant === "overlay" && !open) {
    const anyDanger = status.storms.some((s) => s.alert === "danger");
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`pointer-events-auto mx-auto flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8125rem] font-bold shadow-md ${
          anyDanger ? "bg-danger-bg text-danger" : "bg-warn-bg text-warn"
        }`}
      >
        <AlertIcon className="h-4 w-4 shrink-0" />
        {status.storms.length} tin bão — chạm xem
        <ChevronDownIcon className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div
      role="alert"
      className={
        variant === "overlay"
          ? "pointer-events-auto space-y-2 shadow-md"
          : "mx-4 mb-3 space-y-2"
      }
    >
      {status.storms.map((s) => {
        const danger = s.alert === "danger";
        return (
          <div
            key={s.id}
            role="alert"
            className={`flex items-start gap-3 rounded-xl border-l-4 p-4 ${
              danger
                ? "border-danger bg-danger-bg"
                : "border-warn bg-warn-bg"
            }`}
          >
            <span
              className={`mt-0.5 shrink-0 ${danger ? "text-danger" : "text-warn"}`}
              aria-hidden
            >
              <AlertIcon className="h-7 w-7" />
            </span>
            <div className="min-w-0">
              <p
                className={`text-[1.125rem] font-bold leading-snug ${
                  danger ? "text-danger" : "text-warn"
                }`}
              >
                {/* TÊN CÓ THÌ GHÉP, KHÔNG CÓ THÌ THÔI (sửa 2026-08-18): bản tin
                    ATNĐ của NCHMF không đặt tên riêng (chỉ bão mới có "số N"),
                    ghép chuỗi rỗng cũ ra câu lặp "…trên Biển Đông đang trên
                    vùng Biển Đông". */}
                {s.kindLabel}
                {s.name ? ` ${s.name}` : ""} đang trên vùng Biển Đông
              </p>
              <p className="mt-0.5 text-[1rem] leading-snug text-foreground/80">
                {s.windKmh != null &&
                  `Gió mạnh nhất khoảng ${s.windKmh} km/giờ (cấp ${beaufort(s.windKmh)}). `}
                Đừng ra khơi vùng ảnh hưởng — nghe ngay đài duyên hải hoặc
                đồn biên phòng.
              </p>
              {/* GIỜ THẬT của bản tin — bão đi rất nhanh, tin mấy hôm trước
                  không được để trông như tin vừa xong.

                  ⚠️ ƯU TIÊN GIỜ PHÁT BẢN TIN, KHÔNG PHẢI GIỜ APP HỎI (sửa
                  2026-08-18, thấy trên máy thật): `checkedAt` là lúc app gọi
                  nguồn — bản tin NCHMF phát 08h00 mà app hỏi lúc 09h12 thì
                  banner ghi "Tin lúc 09:12", lệch hẳn với thứ bà con vừa nghe
                  trên đài. Bản tin VN mang `updated` = GIỜ PHÁT TIN, dùng nó
                  thì hai bên khớp nhau. Không có `updated` (nguồn cũ) thì mới
                  lùi về `checkedAt`. */}
              <p
                className={`mt-1 text-[0.9375rem] font-bold leading-snug ${
                  status.cu ? "text-warn" : "text-foreground/65"
                }`}
              >
                {(() => {
                  const phat = Date.parse(s.updated ?? "");
                  if (Number.isFinite(phat)) return `Bản tin ${clockVN(phat)}`;
                  return status.checkedAt != null
                    ? `Tin lúc ${clockVN(status.checkedAt)}`
                    : "Chưa rõ tin lúc nào";
                })()}
                {status.cu && " — tin cũ trong máy, nghe lại đài duyên hải"}
              </p>
            </div>
            {variant === "overlay" && (
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Thu gọn tin bão"
                className={`-mr-1 -mt-1 ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  danger ? "text-danger" : "text-warn"
                }`}
              >
                <ChevronUpIcon className="h-5 w-5" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
