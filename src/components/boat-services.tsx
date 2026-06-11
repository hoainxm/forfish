"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckIcon, ClockIcon } from "@/components/icons";
import { StatusBanner } from "@/components/ui/status-banner";
import { RefNote } from "@/components/ui/primitives";
import { MaintenanceReminders } from "@/components/maintenance-reminders";
import { SdvicoRequestButton } from "@/components/sdvico-request";
import { formatVnd, formatVnDate } from "@/lib/format";
import {
  getServiceDueStatus,
  requestStatusVN,
  serviceKindLabel,
  type OwnedAssets,
} from "@/lib/owned-assets";

/*
  Tab DỊCH VỤ (thay tab Bảo dưỡng cũ) — ForFish là kênh CSKH của SDVICO:
  · dịch vụ đang dùng (đồng bộ từ SDVICO): sửa chữa / bảo trì định kỳ /
    thuê bao — kèm KỲ TỚI để bà con khỏi quên
  · khoản cước / công nợ chờ đóng — quá hạn thì đỏ
  · nút "Gọi SDVICO": sửa chữa, đặt bảo dưỡng, hỏi cước — yêu cầu chảy
    thẳng vào SDWork, nhân viên gọi lại
  · sổ nhắc bảo dưỡng TỰ GHI của bà con vẫn giữ nguyên bên dưới
*/

export function BoatServices() {
  const today = useMemo(() => new Date(), []);
  const [synced, setSynced] = useState<OwnedAssets | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/me/sdvico", { signal: AbortSignal.timeout(20000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j?.ok && j.assets) setSynced(j.assets as OwnedAssets);
      })
      .catch(() => {
        // chưa đăng nhập / chưa cấu hình → chỉ hiện sổ tự ghi + nút gọi
      });
    return () => {
      alive = false;
    };
  }, []);

  const todayIso = today.toISOString().slice(0, 10);
  const activeServices = synced?.services.filter((s) => s.active) ?? [];

  return (
    <div className="px-4 pt-1">
      <div className="mb-4">
        <RefNote tone="var(--t3)" bg="var(--t3-bg)">
          Sửa chữa, bảo dưỡng, cước phí — cần gì bấm nút gọi, SDVICO gọi lại
          tận nơi.
        </RefNote>
      </div>

      <div className="mb-5">
        <SdvicoRequestButton topic="sua-chua" label="Gọi SDVICO sửa chữa / bảo dưỡng" />
        {!synced && (
          <Link
            href="/login"
            className="mt-2.5 flex min-h-[3.5rem] w-full items-center justify-center rounded-full bg-field text-[1.0625rem] font-bold text-navy transition active:scale-[0.98]"
          >
            Đăng nhập để thấy dịch vụ của mình
          </Link>
        )}
      </div>

      {/* yêu cầu đã gửi — để bà con biết mình ĐƯỢC tiếp nhận */}
      {synced && synced.requests.length > 0 && (
        <div className="mb-5">
          <h3 className="display mb-1.5 px-1 text-[1.125rem] font-bold text-navy">
            Yêu cầu đã gửi
          </h3>
          <div className="overflow-hidden surface">
            <ul>
              {synced.requests.map((r, i) => {
                const st = requestStatusVN(r.status);
                return (
                  <li
                    key={r.id}
                    className={`px-4 py-3 ${i > 0 ? "border-t border-line" : ""}`}
                  >
                    <p className="text-[1rem] font-semibold leading-snug text-foreground/85">
                      {r.summary}
                    </p>
                    <p
                      className="mt-0.5 flex items-center gap-1.5 text-[0.875rem] font-bold"
                      style={{
                        color: st.level === "ok" ? "var(--ok)" : "var(--warn)",
                      }}
                    >
                      {st.level === "ok" ? (
                        <CheckIcon className="h-4 w-4" />
                      ) : (
                        <ClockIcon className="h-4 w-4" />
                      )}
                      {st.label}
                      {r.sentAt && (
                        <span className="font-semibold text-foreground/45">
                          · gửi {formatVnDate(r.sentAt.slice(0, 10))}
                        </span>
                      )}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {synced && (
        <div className="mb-5 space-y-3">
          {/* cước / công nợ chờ đóng — tiền nong lên đầu */}
          {synced.payments.map((p) => {
            const overdue = p.dueOn != null && p.dueOn < todayIso;
            return (
              <div key={p.orderCode} className="overflow-hidden surface">
                <StatusBanner level={overdue ? "danger" : "warn"}>
                  {overdue ? "Khoản nợ quá hạn" : "Khoản chờ thanh toán"}
                </StatusBanner>
                <div className="px-4 py-3">
                  <p className="display text-[1.1875rem] font-bold leading-snug text-navy">
                    {formatVnd(p.amountVnd)}
                  </p>
                  <p className="text-[1rem] text-foreground/60">
                    Đơn hàng: <strong>{p.orderCode}</strong>
                    {p.dueOn && (
                      <>
                        {" "}
                        — hạn <strong>{formatVnDate(p.dueOn)}</strong>
                      </>
                    )}
                  </p>
                  <div className="mt-2 flex justify-end">
                    <SdvicoRequestButton
                      variant="chip"
                      topic="cuoc"
                      productName={`Đơn ${p.orderCode}`}
                      label="Hỏi khoản này"
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {/* dịch vụ đang dùng */}
          {activeServices.map((s) => {
            const due = getServiceDueStatus(s, today);
            const level =
              due.level === "overdue"
                ? "danger"
                : due.level === "soon"
                  ? "warn"
                  : due.level === "ok"
                    ? "ok"
                    : "neutral";
            return (
              <div key={s.id} className="overflow-hidden surface">
                <StatusBanner
                  level={level}
                  icon={
                    level === "neutral" ? (
                      <ClockIcon className="h-5 w-5" />
                    ) : undefined
                  }
                >
                  {due.label}
                </StatusBanner>
                <div className="px-4 py-3">
                  <p className="text-[0.8125rem] font-bold uppercase tracking-wide text-foreground/40">
                    {serviceKindLabel(s.kind)}
                  </p>
                  <p className="display text-[1.1875rem] font-bold leading-snug text-navy">
                    {s.name}
                  </p>
                  {s.nextDueOn && (
                    <p className="text-[1rem] text-foreground/60">
                      Kỳ tới: <strong>{formatVnDate(s.nextDueOn)}</strong>
                    </p>
                  )}
                  {s.startedOn && (
                    <p className="text-[0.9375rem] text-foreground/55">
                      Dùng từ {formatVnDate(s.startedOn)}
                    </p>
                  )}
                  {(due.level === "soon" || due.level === "overdue") && (
                    <div className="mt-2 flex justify-end">
                      <SdvicoRequestButton
                        variant="chip"
                        topic={s.kind === "subscription" ? "cuoc" : "bao-duong"}
                        productName={s.name}
                        label="Đặt lịch / hỏi kỳ này"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {synced.payments.length === 0 && activeServices.length === 0 && (
            <p className="rounded-[1.25rem] bg-field/70 px-4 py-6 text-center text-[1rem] text-foreground/60">
              Chưa thấy dịch vụ nào đang dùng bên SDVICO.
            </p>
          )}
        </div>
      )}

      {/* sổ nhắc bảo dưỡng tự ghi — của bà con, lưu trên máy */}
      <h3 className="display mb-1 px-1 text-[1.125rem] font-bold text-navy">
        Sổ nhắc bảo dưỡng của tôi
      </h3>
      <p className="mb-2 px-1 text-[0.875rem] text-foreground/55">
        Tự ghi việc thay nhớt, thay lọc… app nhắc tới kỳ.
      </p>
      <div className="-mx-4">
        <MaintenanceReminders />
      </div>
    </div>
  );
}
