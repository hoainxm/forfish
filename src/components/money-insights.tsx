"use client";

import { useEffect, useState } from "react";
import { TripLog } from "@/components/trip-log";
import { TripSplit } from "@/components/trip-split";
import { Card } from "@/components/ui/primitives";
import { ChipRow } from "@/components/ui/chip-row";
import { tripStats, type TripStats } from "@/lib/trip-insights";
import { formatVndShort } from "@/lib/format";

/*
  PHÂN TÍCH HIỆU QUẢ (nhánh 2 của khu Tiền, user chốt 2026-06-10) —
  nhìn nhanh chuyện làm ăn từ sổ bà con tự ghi: tổng lãi, lãi mỗi chuyến,
  tiền dầu ăn bao nhiêu phần tiền bán. MÔ TẢ con số, không phán.
  Bên dưới là sổ lãi/lỗ + máy chia tiền (chips).
*/

const TRIPS_KEY = "forfish.trips.v1";

type Section = "lai-lo" | "chia";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "lai-lo", label: "Sổ lãi/lỗ" },
  { id: "chia", label: "Chia tiền" },
];

export function MoneyInsights() {
  const [section, setSection] = useState<Section>("lai-lo");
  const [stats, setStats] = useState<TripStats | null>(null);

  // đọc cùng sổ với trip-log (hydrate sau mount, tránh lệch SSR)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TRIPS_KEY);
      if (raw) {
        setStats(
          tripStats(
            JSON.parse(raw) as {
              revenueVnd: number;
              fuelVnd: number;
              otherVnd: number;
            }[],
          ),
        );
      }
    } catch {
      // sổ hỏng — không hiện thẻ phân tích
    }
  }, []);

  return (
    <div>
      {stats && stats.count > 0 && (
        <div className="mb-4 px-4">
          <Card className="p-4">
            <p className="text-[13px] font-bold uppercase tracking-wide text-foreground/45">
              Nhìn nhanh {stats.count} chuyến đã ghi
            </p>
            <p
              className="display mt-1 text-[28px] font-bold leading-tight tabular-nums"
              style={{
                color: stats.totalProfit >= 0 ? "var(--ok)" : "var(--danger)",
              }}
            >
              {stats.totalProfit >= 0 ? "+" : "−"}
              {formatVndShort(Math.abs(stats.totalProfit))}
            </p>
            <p className="text-[14px] text-foreground/55">tổng lãi/lỗ</p>

            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 tabular-nums">
              <div>
                <p className="display text-[18px] font-bold text-navy">
                  {stats.totalProfit >= 0 ? "+" : ""}
                  {formatVndShort(stats.avgProfit)}
                </p>
                <p className="text-[13px] leading-snug text-foreground/55">
                  bình quân mỗi chuyến
                </p>
              </div>
              <div>
                <p className="display text-[18px] font-bold text-navy">
                  {stats.profitableCount}/{stats.count}
                </p>
                <p className="text-[13px] leading-snug text-foreground/55">
                  chuyến có lãi
                </p>
              </div>
              <div>
                <p className="display text-[18px] font-bold text-navy">
                  {stats.fuelShare != null
                    ? `${Math.round(stats.fuelShare * 100)}%`
                    : "—"}
                </p>
                <p className="text-[13px] leading-snug text-foreground/55">
                  tiền bán đi vào dầu
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      <ChipRow
        options={SECTIONS}
        value={section}
        onChange={setSection}
        accent="t2"
        level={1}
        ariaLabel="Mục hiệu quả"
      />

      {section === "lai-lo" && <TripLog />}
      {section === "chia" && (
        <div>
          <p className="mb-2 px-4 text-[15px] leading-snug text-foreground/70">
            Nhập tiền bán cá và tổn chung — app tự chia theo phần từng người,
            trừ luôn tiền đã ứng.
          </p>
          <TripSplit />
        </div>
      )}
    </div>
  );
}
