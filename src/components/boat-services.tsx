"use client";

import Link from "next/link";
import { CheckIcon, ClockIcon } from "@/components/icons";
import { StatusBanner } from "@/components/ui/status-banner";
import { MaintenanceReminders } from "@/components/maintenance-reminders";
import { SdvicoRequestButton } from "@/components/sdvico-request";
import { formatVnd, formatVnDate } from "@/lib/format";
import {
  getServiceDueStatus,
  requestStatusVN,
  serviceKindLabel,
} from "@/lib/owned-assets";
import { useSdvicoAssets } from "@/lib/use-sdvico-assets";
import { useTodayVN } from "@/lib/use-today";

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
  // "hôm nay" theo lịch VN, tính lại khi app đưa ra trước (lib/use-today)
  const { today, todayIso } = useTodayVN();
  // hook dùng chung với tab Sản phẩm — một lần fetch, 4 nấc trạng thái
  const { status: syncStatus, assets: synced, retry } = useSdvicoAssets();

  const activeServices = synced?.services.filter((s) => s.active) ?? [];

  return (
    <div className="px-4 pt-1">
      {/*  Bỏ RefNote "Sửa chữa, bảo dưỡng, cước phí — cần gì bấm nút gọi…" (D1):
          nó DẠY CÁCH DÙNG cái nút nằm ngay 8px bên dưới, không mang số liệu,
          trạng thái hay giới hạn nguồn nào. Nút gọi nay là chip inline cuối
          hàng cấp dữ liệu (luật A2/A3), nhãn rút từ 31 ký tự còn "Gọi SDVICO"
          (luật A4 — gọi TÊN VIỆC, không hứa kết quả). */}
      <div className="mb-5">
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 text-[1rem] font-bold text-navy">
            {activeServices.length} dịch vụ đang dùng
          </p>
          <SdvicoRequestButton topic="sua-chua" label="Gọi SDVICO" />
        </div>
        {/* 4 nấc — chỉ mời đăng nhập khi THẬT SỰ chưa đăng nhập */}
        {syncStatus === "guest" && (
          <div className="mt-2.5 flex items-center gap-2">
            <p className="min-w-0 flex-1 text-[0.9375rem] leading-snug text-foreground/70">
              Bà con đăng nhập bằng số điện thoại lúc mua hàng là dịch vụ tự
              hiện ra ở đây.
            </p>
            <Link
              href="/login"
              className="flex min-h-[3.5rem] shrink-0 items-center rounded-full bg-field px-4 text-[1rem] font-bold text-navy transition active:scale-[0.98]"
            >
              Đăng nhập
            </Link>
          </div>
        )}
        {syncStatus === "error" && (
          <div className="mt-2.5 flex items-center justify-between gap-3 rounded-2xl bg-danger-bg px-3.5 py-2.5">
            <p className="min-w-0 text-[0.9375rem] font-semibold leading-snug text-danger">
              Chưa tải được dịch vụ bên SDVICO — mạng có thể đang yếu.
            </p>
            <button
              type="button"
              onClick={retry}
              className="min-h-[3rem] shrink-0 rounded-full bg-danger px-4 text-[0.9375rem] font-bold text-white"
            >
              Thử lại
            </button>
          </div>
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
                    {/* trạng thái bình thường = màu chữ thường, không vàng
                        (chốt 2026-08-18: màu = chữ) */}
                    <p
                      className={`mt-0.5 flex items-center gap-1.5 text-[0.875rem] font-bold ${
                        st.level === "ok" ? "text-ok" : "text-foreground/70"
                      }`}
                    >
                      {st.level === "ok" ? (
                        <CheckIcon className="h-4 w-4" />
                      ) : (
                        <ClockIcon className="h-4 w-4" />
                      )}
                      {st.label}
                      {r.sentAt && (
                        <span className="font-semibold text-foreground/65">
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
          {/* cước / công nợ chờ đóng — tiền nong lên đầu. Chưa tới hạn = KHÔNG
              băng màu (neutral) — chỉ quá hạn mới đỏ (chốt 2026-08-18) */}
          {synced.payments.map((p) => {
            const overdue = p.dueOn != null && p.dueOn < todayIso;
            return (
              <div key={p.orderCode} className="overflow-hidden surface">
                <StatusBanner
                  level={overdue ? "danger" : "neutral"}
                  icon={overdue ? undefined : <ClockIcon className="h-5 w-5" />}
                >
                  {overdue
                    ? "Khoản nợ quá hạn"
                    : p.dueOn
                      ? `Chờ thanh toán — hạn ${formatVnDate(p.dueOn)}`
                      : "Chờ thanh toán"}
                </StatusBanner>
                <div className="px-4 py-3">
                  <p className="display text-[1.125rem] font-bold leading-snug text-navy">
                    {formatVnd(p.amountVnd)}
                  </p>
                  <p className="text-[1rem] text-foreground/70">
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
                      topic="cuoc"
                      productName={`Đơn ${p.orderCode}`}
                      label="Hỏi về khoản này"
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
                  <p className="text-[0.8125rem] font-bold uppercase tracking-wide text-foreground/65">
                    {serviceKindLabel(s.kind)}
                  </p>
                  <p className="display text-[1.125rem] font-bold leading-snug text-navy">
                    {s.name}
                  </p>
                  {s.nextDueOn && (
                    <p className="text-[1rem] text-foreground/70">
                      Kỳ tới: <strong>{formatVnDate(s.nextDueOn)}</strong>
                    </p>
                  )}
                  {s.startedOn && (
                    <p className="text-[0.9375rem] text-foreground/70">
                      Dùng từ {formatVnDate(s.startedOn)}
                    </p>
                  )}
                  {(due.level === "soon" || due.level === "overdue") && (
                    <div className="mt-2 flex justify-end">
                      <SdvicoRequestButton
                        topic={s.kind === "subscription" ? "cuoc" : "bao-duong"}
                        productName={s.name}
                        label="Đặt lịch / hỏi về kỳ này"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {synced.payments.length === 0 && activeServices.length === 0 && (
            <p className="rounded-[1.25rem] bg-field/70 px-4 py-6 text-center text-[1rem] text-foreground/70">
              Chưa thấy dịch vụ nào đang dùng bên SDVICO.
            </p>
          )}
        </div>
      )}

      {/* sổ nhắc bảo dưỡng tự ghi — của bà con, lưu trên máy */}
      {/* Bỏ dòng "Tự ghi việc thay nhớt…" (D1): dạy cách dùng, không cấp dữ
          liệu — hàng "Sổ nhắc bảo dưỡng · N việc" ngay dưới đã nói đủ. */}
      <h3 className="display mb-1 px-1 text-[1.125rem] font-bold text-navy">
        Sổ nhắc bảo dưỡng của tôi
      </h3>
      <div className="-mx-4">
        <MaintenanceReminders />
      </div>
    </div>
  );
}
