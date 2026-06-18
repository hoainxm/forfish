"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/primitives";
import { ChipRow } from "@/components/ui/chip-row";
import { CalendarIcon } from "@/components/icons";
import { listYears, yearlyReport } from "@/lib/trip-insights";
import { formatVndShort } from "@/lib/format";
import type { TripEntry } from "@/components/trip-log";

/*
  BÁO CÁO LỜI/LỖ NĂM (A1, roadmap 01-product §7 / 06-jtbd nhóm C) — bà con
  ghi sổ cả năm thì muốn biết "cả năm nghề biển lời hay lỗ". Tổng kết theo
  NĂM + tách theo THÁNG, đọc từ chính sổ lãi/lỗ (forfish.trips.v1), KHÔNG
  thêm dữ liệu mới. Vẫn MÔ TẢ con số, không phán. Logic thuần + test trong
  lib/trip-insights.ts (yearlyReport/listYears).
*/

function signedShort(n: number): string {
  return `${n >= 0 ? "+" : "−"}${formatVndShort(Math.abs(n))}`;
}

const ok = "var(--ok)";
const danger = "var(--danger)";
function profitColor(n: number): string {
  return n >= 0 ? ok : danger;
}

export function TripReport({ trips }: { trips: TripEntry[] }) {
  const years = useMemo(() => listYears(trips), [trips]);
  const [year, setYear] = useState<number | null>(null);

  // Mặc định năm mới nhất; tự bám theo khi sổ đổi (xóa hết chuyến năm đó…).
  useEffect(() => {
    setYear((prev) =>
      prev != null && years.includes(prev) ? prev : (years[0] ?? null),
    );
  }, [years]);

  const report = useMemo(
    () => (year != null ? yearlyReport(trips, year) : null),
    [trips, year],
  );

  if (years.length === 0 || year == null) {
    return (
      <div className="rounded-[1.25rem] bg-field/70 px-4 py-12 text-center">
        <CalendarIcon className="mx-auto h-10 w-10 text-foreground/30" />
        <p className="mt-3 text-[1.125rem] text-foreground/70">
          Chưa có chuyến nào để tổng kết.
          <br />
          Ghi vài chuyến ở mục Sổ lãi/lỗ, báo cáo năm tự hiện ra.
        </p>
      </div>
    );
  }

  return (
    <div>
      {years.length > 1 && (
        <ChipRow
          options={years.map((y) => ({ id: String(y), label: `Năm ${y}` }))}
          value={String(year)}
          onChange={(id) => setYear(Number(id))}
          accent="t2"
          level={2}
          ariaLabel="Chọn năm xem báo cáo"
        />
      )}

      {report && (
        <div className="space-y-4 px-4">
          {/* Tổng cả năm — con số lãi/lỗ là hero */}
          <Card className="p-4">
            <p className="text-[0.8125rem] font-bold uppercase tracking-wide text-foreground/65">
              Cả năm {report.year} · {report.count} chuyến
            </p>
            <p
              className="display mt-1 text-[1.875rem] font-bold leading-tight tabular-nums"
              style={{ color: profitColor(report.totalProfit) }}
            >
              {signedShort(report.totalProfit)}
            </p>
            <p className="text-[0.875rem] text-foreground/70">
              tổng lãi/lỗ cả năm
            </p>

            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 tabular-nums">
              <div>
                <p className="display text-[1.125rem] font-bold text-navy">
                  {formatVndShort(report.totalRevenue)}
                </p>
                <p className="text-[0.8125rem] leading-snug text-foreground/70">
                  tổng tiền bán
                </p>
              </div>
              <div>
                <p className="display text-[1.125rem] font-bold text-navy">
                  {report.profitableCount}/{report.count}
                </p>
                <p className="text-[0.8125rem] leading-snug text-foreground/70">
                  chuyến có lãi
                </p>
              </div>
              <div>
                <p className="display text-[1.125rem] font-bold text-navy">
                  {report.fuelShare != null
                    ? `${Math.round(report.fuelShare * 100)}%`
                    : "—"}
                </p>
                <p className="text-[0.8125rem] leading-snug text-foreground/70">
                  tiền bán đi vào dầu
                </p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3 text-[0.9375rem] tabular-nums">
              <span className="text-foreground/70">
                Chuyến lãi nhất{" "}
                <strong style={{ color: ok }}>
                  {signedShort(report.bestProfit)}
                </strong>
              </span>
              <span className="text-foreground/70">
                Lỗ nặng nhất{" "}
                <strong style={{ color: danger }}>
                  {signedShort(report.worstProfit)}
                </strong>
              </span>
            </div>
          </Card>

          {/* Tách theo tháng — chỉ tháng có chuyến */}
          <section aria-label={`Lãi lỗ theo tháng năm ${report.year}`}>
            <h3 className="display mb-2 px-1 text-[1.0625rem] font-bold text-navy">
              Theo tháng
            </h3>
            <ul className="overflow-hidden surface">
              {report.months.map((m) => (
                <li
                  key={m.month}
                  className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0"
                >
                  <span className="w-[72px] shrink-0 text-[1rem] font-bold text-navy">
                    Tháng {m.month}
                  </span>
                  <span className="shrink-0 text-[0.9375rem] text-foreground/65 tabular-nums">
                    {m.count} chuyến
                  </span>
                  <span
                    className="display flex-1 text-right text-[1.0625rem] font-bold tabular-nums"
                    style={{ color: profitColor(m.profit) }}
                  >
                    {signedShort(m.profit)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <p className="pb-2 text-center text-[0.875rem] text-foreground/65">
            Tổng từ sổ lãi/lỗ bà con tự ghi — chỉ để bà con nhìn lại cả năm.
          </p>
        </div>
      )}
    </div>
  );
}
