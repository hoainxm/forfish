"use client";

/**
 * Trục 1 — banner tin bão / áp thấp trên Biển Đông (nguồn qua lib/storms.ts).
 * Ba trạng thái:
 *   · có bão  → thẻ đỏ/vàng to, không thể bỏ qua
 *   · không có (đã kiểm tra được) → một dòng xanh trấn an
 *   · chưa kiểm tra được → KHÔNG render gì (không nói bừa "không có bão")
 */
import { useEffect, useState } from "react";
import { fetchStormCheck, type StormCheck } from "@/lib/storms";
import { beaufort } from "@/lib/marine-weather";
import { AlertIcon, CheckIcon } from "@/components/icons";

export function StormBanner({
  variant = "page",
}: {
  /** "overlay" = nổi trên bản đồ full-screen: chip gọn khi yên, thẻ đầy đủ khi có bão */
  variant?: "page" | "overlay";
}) {
  const [check, setCheck] = useState<StormCheck | null>(null);

  useEffect(() => {
    let alive = true;
    fetchStormCheck().then((c) => alive && setCheck(c));
    return () => {
      alive = false;
    };
  }, []);

  if (!check) return null; // đang kiểm tra — chưa nói gì

  // Nguồn fail: nói rõ "chưa kiểm tra được" — khác hẳn với "không có bão".
  // (Audit flow: im lặng hoàn toàn khiến người dùng không phân biệt được
  // hai trạng thái; vẫn giữ nguyên tắc KHÔNG BAO GIỜ nói "không có bão" bừa.)
  if (!check.ok) {
    if (variant === "overlay") {
      return (
        <p role="status" className="pointer-events-auto mx-auto flex w-fit items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[13px] font-bold text-foreground/65">
          Chưa kiểm tra được tin bão — nghe đài duyên hải
        </p>
      );
    }
    return (
      <p role="status" className="mx-4 mb-3 rounded-xl bg-card px-3 py-2 text-[15px] font-semibold text-foreground/65">
        Chưa kiểm tra được tin bão — bà con nghe đài duyên hải.
      </p>
    );
  }

  if (check.storms.length === 0) {
    if (variant === "overlay") {
      return (
        <p role="status" className="pointer-events-auto mx-auto flex w-fit items-center gap-1.5 rounded-full bg-ok-bg px-3 py-1.5 text-[13px] font-bold text-ok">
          <CheckIcon className="h-4 w-4 shrink-0" />
          Không có tin bão trên Biển Đông
        </p>
      );
    }
    return (
      <p role="status" className="mx-4 mb-3 flex items-center gap-2 rounded-xl bg-ok-bg px-3 py-2 text-[15px] font-semibold text-ok">
        <CheckIcon className="h-4.5 w-4.5 shrink-0" />
        Hiện không có tin bão, áp thấp trên Biển Đông.
      </p>
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
      {check.storms.map((s) => {
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
                className={`text-[18px] font-bold leading-snug ${
                  danger ? "text-danger" : "text-warn"
                }`}
              >
                {s.kindLabel} {s.name} đang trên vùng Biển Đông
              </p>
              <p className="mt-0.5 text-[16px] leading-snug text-foreground/80">
                {s.windKmh != null &&
                  `Gió mạnh nhất khoảng ${s.windKmh} km/giờ (cấp ${beaufort(s.windKmh)}). `}
                Đừng ra khơi vùng ảnh hưởng — nghe ngay đài duyên hải hoặc
                đồn biên phòng.
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
