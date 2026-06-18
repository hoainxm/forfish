"use client";

import { useEffect, useMemo, useState } from "react";
import { useBoats } from "@/components/boat-switcher";
import { useCrew } from "@/components/crew-list";
import { loadDocs } from "@/components/document-vault";
import type { TripEntry } from "@/components/trip-log";
import type { BoatDocument } from "@/lib/documents";
import { getExpiryStatus, kindLabel } from "@/lib/documents";
import { ROLE_LABELS } from "@/lib/crew";
import { profitOf } from "@/lib/trip-insights";
import { formatVnd, formatVnDate } from "@/lib/format";
import { PrimaryButton } from "@/components/ui/primitives";

/*
  HỒ SƠ CHUYẾN BIỂN (C1, roadmap 01-product §7 / 06-jtbd nhóm B) — gói một
  chuyến thành bản IN ĐƯỢC (Lưu PDF qua hộp in của máy) để đưa người mua / lưu
  hồ sơ: tàu + chuyến (thu/tổn/lãi) + thuyền viên đi chuyến + giấy tờ còn hạn.
  TRUNG THỰC: số liệu do chủ tàu tự khai (tham khảo). Phần QR truy xuất cần
  máy chủ cấp đường dẫn xác minh — để sau (chưa có backend public).
*/

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TripDossier({
  trip,
  onClose,
}: {
  trip: TripEntry;
  onClose: () => void;
}) {
  const today = useMemo(() => new Date(), []);
  const { current } = useBoats();
  const { crew } = useCrew();
  const [docs, setDocs] = useState<(BoatDocument & { boatId?: string })[]>([]);

  useEffect(() => {
    setDocs(loadDocs(today));
  }, [today]);

  const boatCrew = crew.filter(
    (m) => m.boatId === current?.id || m.boatId == null,
  );
  const boatDocs = docs.filter(
    (d) => d.boatId === current?.id || d.boatId == null,
  );
  const profit = profitOf(trip);

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-white">
      {/* thanh nút — không in; +safe-area-top để nút In/Đóng không chui dưới
          notch/status bar (overlay z-50 edge-to-edge) */}
      <div className="no-print sticky top-0 flex gap-3 border-b border-line bg-white px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <button
          onClick={onClose}
          className="min-h-[3.25rem] flex-1 rounded-full bg-field text-[1.0625rem] font-bold text-foreground/70"
        >
          Đóng
        </button>
        <div className="flex-1">
          <PrimaryButton onClick={() => window.print()}>
            In / Lưu PDF
          </PrimaryButton>
        </div>
      </div>

      <div className="print-area mx-auto max-w-[640px] px-5 py-5 text-foreground">
        <h1 className="display text-[1.5rem] font-bold text-navy">
          Hồ sơ chuyến biển
        </h1>
        <p className="mt-0.5 text-[0.9375rem] text-foreground/65">
          Lập ngày {formatVnDate(todayIso())} · SDFish
        </p>

        {/* Tàu */}
        <section className="mt-4">
          <h2 className="text-[0.8125rem] font-bold uppercase tracking-wide text-foreground/65">
            Tàu
          </h2>
          <p className="mt-1 text-[1.125rem] font-bold text-navy">
            {current?.name ?? "—"}
          </p>
          <p className="text-[0.9375rem] text-foreground/70">
            {current?.maTau ? `Mã tàu: ${current.maTau}` : "Chưa có mã tàu"}
            {current?.lengthM != null ? ` · Dài ${current.lengthM} m` : ""}
          </p>
        </section>

        {/* Chuyến */}
        <section className="mt-4 border-t border-line pt-3">
          <h2 className="text-[0.8125rem] font-bold uppercase tracking-wide text-foreground/65">
            Chuyến biển
          </h2>
          {trip.label && (
            <p className="mt-1 text-[1.0625rem] font-bold text-navy">
              {trip.label}
            </p>
          )}
          <p className="text-[0.9375rem] text-foreground/70">
            Về bờ {formatVnDate(trip.date)}
          </p>
          <table className="mt-2 w-full text-[1rem] tabular-nums">
            <tbody>
              <tr>
                <td className="py-1 text-foreground/70">Tiền bán cá</td>
                <td className="py-1 text-right font-bold">
                  {formatVnd(trip.revenueVnd)}
                </td>
              </tr>
              <tr>
                <td className="py-1 text-foreground/70">Tiền dầu</td>
                <td className="py-1 text-right font-bold">
                  {formatVnd(trip.fuelVnd)}
                </td>
              </tr>
              <tr>
                <td className="py-1 text-foreground/70">Chi khác</td>
                <td className="py-1 text-right font-bold">
                  {formatVnd(trip.otherVnd)}
                </td>
              </tr>
              <tr className="border-t border-line">
                <td className="py-1.5 font-bold text-navy">Lãi/lỗ chuyến</td>
                <td
                  className="py-1.5 text-right font-bold"
                  style={{ color: profit >= 0 ? "var(--ok)" : "var(--danger)" }}
                >
                  {profit >= 0 ? "+" : "−"}
                  {formatVnd(Math.abs(profit))}
                </td>
              </tr>
            </tbody>
          </table>
          {trip.note && (
            <p className="mt-1.5 text-[0.9375rem] text-foreground/70">
              Ghi chú: {trip.note}
            </p>
          )}
        </section>

        {/* Thuyền viên */}
        <section className="mt-4 border-t border-line pt-3">
          <h2 className="text-[0.8125rem] font-bold uppercase tracking-wide text-foreground/65">
            Thuyền viên ({boatCrew.length})
          </h2>
          {boatCrew.length === 0 ? (
            <p className="mt-1 text-[0.9375rem] text-foreground/65">
              Chưa ghi thuyền viên trong sổ.
            </p>
          ) : (
            <ul className="mt-1 space-y-1">
              {boatCrew.map((m) => (
                <li
                  key={m.id}
                  className="flex justify-between gap-3 text-[1rem]"
                >
                  <span className="text-navy">
                    {m.name}{" "}
                    <span className="text-foreground/60">
                      · {ROLE_LABELS[m.role]}
                    </span>
                  </span>
                  <span className="shrink-0 text-foreground/70">
                    {m.hasInsurance ? "Có bảo hiểm" : "Chưa bảo hiểm"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Giấy tờ tàu */}
        <section className="mt-4 border-t border-line pt-3">
          <h2 className="text-[0.8125rem] font-bold uppercase tracking-wide text-foreground/65">
            Giấy tờ tàu
          </h2>
          {boatDocs.length === 0 ? (
            <p className="mt-1 text-[0.9375rem] text-foreground/65">
              Chưa có giấy tờ trong tủ.
            </p>
          ) : (
            <ul className="mt-1 space-y-1">
              {boatDocs.map((d) => {
                const ex = getExpiryStatus(d, today);
                return (
                  <li
                    key={d.id}
                    className="flex justify-between gap-3 text-[1rem]"
                  >
                    <span className="text-navy">
                      {d.label || kindLabel(d.kind)}
                    </span>
                    <span className="shrink-0 text-foreground/70">
                      {d.expiresOn ? ex.label : "Không hạn"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <p className="mt-5 border-t border-line pt-3 text-[0.875rem] leading-snug text-foreground/60">
          Hồ sơ tự lập trên SDFish — số liệu do chủ tàu tự khai, mang tính
          tham khảo, chưa phải chứng từ xác minh của cơ quan. Bản truy xuất có
          mã QR xác minh sẽ bổ sung sau.
        </p>
      </div>
    </div>
  );
}
