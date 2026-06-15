"use client";

import { useEffect, useMemo, useState } from "react";
import {
  loadTrips,
  saveTrips,
  TripLog,
  type TripEntry,
} from "@/components/trip-log";
import { TripSplit } from "@/components/trip-split";
import { TripReport } from "@/components/trip-report";
import { TripEstimator } from "@/components/trip-estimator";
import { TripDossier } from "@/components/trip-dossier";
import { Card } from "@/components/ui/primitives";
import { ChipRow } from "@/components/ui/chip-row";
import { profitOf, tripStats } from "@/lib/trip-insights";
import { formatVndShort } from "@/lib/format";

/*
  PHÂN TÍCH HIỆU QUẢ (nhánh 2 của khu Tiền, user chốt 2026-06-10) —
  nhìn nhanh chuyện làm ăn từ sổ bà con tự ghi: tổng lãi, lãi mỗi chuyến,
  tiền dầu ăn bao nhiêu phần tiền bán. MÔ TẢ con số, không phán.
  Bên dưới là sổ lãi/lỗ + máy chia tiền (chips).
*/

type Section = "lai-lo" | "bao-cao" | "tinh-chuyen" | "chia";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "lai-lo", label: "Sổ lãi/lỗ" },
  { id: "bao-cao", label: "Báo cáo năm" },
  { id: "tinh-chuyen", label: "Tính chuyến" },
  { id: "chia", label: "Chia tiền" },
];

export function MoneyInsights() {
  const [section, setSection] = useState<Section>("lai-lo");
  // CHỦ SỔ duy nhất (hội đồng UX 2026-06-11): trips sống ở đây, TripLog là
  // controlled — ghi/sửa/xóa chuyến là thẻ "Nhìn nhanh" cập nhật TỨC THÌ.
  const [trips, setTrips] = useState<TripEntry[]>([]);
  const [ready, setReady] = useState(false);

  // hydrate sau mount (tránh lệch SSR)
  useEffect(() => {
    setTrips(loadTrips());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) saveTrips(trips);
  }, [trips, ready]);

  const stats = useMemo(() => tripStats(trips), [trips]);

  // "Chia tiền chuyến này" từ sổ lãi/lỗ → nhảy sang máy chia với số sẵn;
  // mặc định tab Chia tiền lấy số chuyến MỚI NHẤT (quy trình thật: về bờ →
  // ghi chuyến → chia luôn)
  const [splitSource, setSplitSource] = useState<TripEntry | null>(null);
  const [dossierTrip, setDossierTrip] = useState<TripEntry | null>(null);
  const latestTrip = useMemo(
    () =>
      trips.length === 0
        ? null
        : [...trips].sort((a, b) => (b.date < a.date ? -1 : 1))[0],
    [trips],
  );
  // lãi 3 chuyến gần nhất — gộp từ thẻ cũ của TripLog về đây (một thẻ tổng)
  const recent3 = useMemo(() => {
    const sorted = [...trips].sort((a, b) =>
      a.date === b.date ? b.id.localeCompare(a.id) : b.date < a.date ? -1 : 1,
    );
    return sorted.slice(0, 3).reduce((s, t) => s + profitOf(t), 0);
  }, [trips]);

  return (
    <div>
      {stats && stats.count > 0 && (
        <div className="mb-4 px-4">
          <Card className="p-4">
            <p className="text-[0.8125rem] font-bold uppercase tracking-wide text-foreground/65">
              Nhìn nhanh {stats.count} chuyến đã ghi
            </p>
            <p
              className="display mt-1 text-[1.75rem] font-bold leading-tight tabular-nums"
              style={{
                color: stats.totalProfit >= 0 ? "var(--ok)" : "var(--danger)",
              }}
            >
              {stats.totalProfit >= 0 ? "+" : "−"}
              {formatVndShort(Math.abs(stats.totalProfit))}
            </p>
            <p className="text-[0.875rem] text-foreground/70">tổng lãi/lỗ</p>

            {stats.count > 3 && (
              <p className="mt-1 text-[0.9375rem] font-semibold text-foreground/70">
                3 chuyến gần nhất:{" "}
                <strong
                  style={{
                    color: recent3 >= 0 ? "var(--ok)" : "var(--danger)",
                  }}
                >
                  {recent3 >= 0 ? "+" : "−"}
                  {formatVndShort(Math.abs(recent3))}
                </strong>
              </p>
            )}

            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 tabular-nums">
              <div>
                <p className="display text-[1.125rem] font-bold text-navy">
                  {stats.totalProfit >= 0 ? "+" : ""}
                  {formatVndShort(stats.avgProfit)}
                </p>
                <p className="text-[0.8125rem] leading-snug text-foreground/70">
                  bình quân mỗi chuyến
                </p>
              </div>
              <div>
                <p className="display text-[1.125rem] font-bold text-navy">
                  {stats.profitableCount}/{stats.count}
                </p>
                <p className="text-[0.8125rem] leading-snug text-foreground/70">
                  chuyến có lãi
                </p>
              </div>
              <div>
                <p className="display text-[1.125rem] font-bold text-navy">
                  {stats.fuelShare != null
                    ? `${Math.round(stats.fuelShare * 100)}%`
                    : "—"}
                </p>
                <p className="text-[0.8125rem] leading-snug text-foreground/70">
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

      {section === "lai-lo" && ready && (
        <TripLog
          trips={trips}
          onChange={setTrips}
          onSplit={(trip) => {
            setSplitSource(trip);
            setSection("chia");
          }}
          onDossier={setDossierTrip}
        />
      )}
      {section === "bao-cao" && ready && <TripReport trips={trips} />}
      {section === "tinh-chuyen" && <TripEstimator />}
      {section === "chia" && (
        <div>
          <p className="mb-2 px-4 text-[0.9375rem] leading-snug text-foreground/70">
            Nhập tiền bán cá và tổn chung — app tự chia theo phần từng người,
            trừ luôn tiền đã ứng.
          </p>
          <TripSplit prefill={splitSource ?? latestTrip} />
        </div>
      )}

      {dossierTrip && (
        <TripDossier
          trip={dossierTrip}
          onClose={() => setDossierTrip(null)}
        />
      )}
    </div>
  );
}
