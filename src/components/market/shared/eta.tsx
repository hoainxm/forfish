"use client";

// HẸN GIAO — mảnh giao diện dùng chung cho chủ shop, chủ sàn, chủ tàu (2026-10-18, "luồng
// giống Shopee như xác nhận đơn, thời gian giao"). Luật ngày ở lib/market/eta.ts.
//  · EtaSheet      : chip Hôm nay / Ngày mai / 2–3 ngày… + "Chọn ngày" (ô date), bấm là gửi
//  · EtaLine       : "Hẹn giao ngày mai" + nhãn TRỄ HẸN đỏ khi quá ngày
//  · AutoCancelNote: đếm ngược đơn chờ tự huỷ (72 giờ)
//  · OrderSteps    : thanh 5 bước Đặt → Xác nhận → Đang giao → Đã giao → Xong
import { useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Field, PrimaryButton, inputClass } from "@/components/ui/primitives";
import { addDaysIso } from "@/lib/days";
import { ETA_MAX_DAYS, ETA_PRESETS, etaLabel, isLate, presetRange, validateEta, vnToday, type EtaPreset } from "@/lib/market/eta";
import { msUntilAutoCancel } from "@/lib/market/order-state";
import type { Order, OrderStatus } from "@/lib/market/types";

export interface EtaPick { etaFrom: string; etaTo: string }

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Chọn hẹn giao. `title` đổi theo việc: "Xác nhận đơn — hẹn ngày giao" / "Dời hẹn giao". */
export function EtaSheet({
  title,
  sendLabel,
  busy,
  initial,
  onClose,
  onSend,
}: {
  title: string;
  sendLabel: string;
  busy: boolean;
  initial?: EtaPick;
  onClose: () => void;
  onSend: (eta: EtaPick) => void;
}) {
  const today = vnToday();
  const [preset, setPreset] = useState<EtaPreset["id"] | "chon" | null>(initial ? "chon" : null);
  const [from, setFrom] = useState(initial?.etaFrom ?? addDaysIso(today, 2));
  const [to, setTo] = useState(initial?.etaTo ?? addDaysIso(today, 3));
  const pick: EtaPick | null = preset == null ? null : preset === "chon" ? { etaFrom: from, etaTo: to < from ? from : to } : presetRange(preset, today);
  const err = pick ? validateEta(pick.etaFrom, pick.etaTo, today) : null;
  return (
    <BottomSheet title={title} onClose={onClose}>
      <div className="px-4 pb-4">
        <p className="mb-3 text-[1rem] text-foreground/80">Người mua sẽ thấy ngày hẹn này. Chưa chắc thì chọn khoảng rộng.</p>
        <div className="grid grid-cols-2 gap-2">
          {ETA_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={preset === p.id}
              onClick={() => setPreset(p.id)}
              className={`min-h-(--row-h) rounded-2xl px-3 text-[1.0625rem] font-bold ${preset === p.id ? "bg-navy text-card" : "bg-field text-navy"}`}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={preset === "chon"}
            onClick={() => setPreset("chon")}
            className={`min-h-(--row-h) rounded-2xl px-3 text-[1.0625rem] font-bold ${preset === "chon" ? "bg-navy text-card" : "bg-field text-navy"}`}
          >
            Chọn ngày
          </button>
        </div>
        {preset === "chon" && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Field label="Sớm nhất">
              <input type="date" className={inputClass} min={today} max={addDaysIso(today, ETA_MAX_DAYS)} value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="Muộn nhất">
              <input type="date" className={inputClass} min={from} max={addDaysIso(today, ETA_MAX_DAYS)} value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
        )}
        {pick && !err && (
          <p className="mt-3 text-[1.125rem] font-bold text-navy">Hẹn giao: {etaLabel(pick.etaFrom, pick.etaTo, today)}</p>
        )}
        {err && <p className="mt-3 text-[1rem] font-bold" style={{ color: "var(--danger)" }}>{err}</p>}
        {!pick && <p className="mt-3 text-[1rem] font-bold text-foreground/70">Chọn một ngày hẹn để gửi.</p>}
        <div className="mt-3">
          <PrimaryButton disabled={busy || !pick || !!err} onClick={() => pick && onSend(pick)}>
            {busy ? "Đang gửi…" : sendLabel}
          </PrimaryButton>
        </div>
      </div>
    </BottomSheet>
  );
}

/** "Hẹn giao ngày mai" · đỏ "Trễ hẹn — hẹn 20/10" khi quá ngày mà chưa giao. */
export function EtaLine({ order, className = "" }: { order: Pick<Order, "status" | "etaFrom" | "etaTo">; className?: string }) {
  if (!order.etaFrom) return null;
  const today = vnToday();
  const late = isLate(order, today);
  const label = etaLabel(order.etaFrom, order.etaTo, today);
  if (late)
    return (
      <span className={`block rounded-2xl px-3.5 py-2.5 text-[1rem] font-bold ${className}`} style={{ backgroundColor: "var(--danger-bg)", color: "var(--danger)" }}>
        Trễ hẹn — đã hẹn giao {label}
      </span>
    );
  const done = order.status === "da_giao" || order.status === "hoan_thanh" || order.status === "da_huy";
  return (
    <span className={`block rounded-2xl bg-field px-3.5 py-2.5 text-[1rem] font-bold text-navy ${className}`}>
      {done ? `Đã hẹn giao ${label}` : `${cap("hẹn giao")} ${label}`}
    </span>
  );
}

/** Đơn chờ: "Còn 1 ngày 5 giờ để xác nhận — quá hạn đơn tự huỷ". */
export function AutoCancelNote({ order, who }: { order: Pick<Order, "status" | "createdAt">; who: "shop" | "buyer" }) {
  const ms = msUntilAutoCancel(order, new Date().toISOString());
  if (ms == null) return null;
  const h = Math.floor(ms / 3_600_000);
  const left = h >= 24 ? `${Math.floor(h / 24)} ngày ${h % 24} giờ` : h >= 1 ? `${h} giờ` : "dưới 1 giờ";
  const urgent = h < 24;
  return (
    <span
      className="block rounded-2xl px-3.5 py-2.5 text-[1rem] font-bold"
      style={{ backgroundColor: urgent ? "var(--warn-bg)" : "var(--field)", color: urgent ? "var(--warn)" : "var(--navy)" }}
    >
      {who === "shop"
        ? `Còn ${left} để xác nhận — quá hạn đơn tự huỷ.`
        : `Shop có ${left} để xác nhận — quá hạn đơn tự huỷ, không mất tiền.`}
    </span>
  );
}

const STEPS: { s: OrderStatus; label: string }[] = [
  { s: "cho_xac_nhan", label: "Đặt" },
  { s: "da_xac_nhan", label: "Xác nhận" },
  { s: "dang_giao", label: "Đang giao" },
  { s: "da_giao", label: "Đã giao" },
  { s: "hoan_thanh", label: "Xong" },
];
/** Thanh tiến độ kiểu Shopee — đơn huỷ thì không vẽ (dòng thời gian nói rõ hơn). */
export function OrderSteps({ status }: { status: OrderStatus }) {
  if (status === "da_huy") return null;
  const at = STEPS.findIndex((x) => x.s === status);
  return (
    <ol className="flex items-start justify-between gap-1" aria-label="Tiến độ đơn">
      {STEPS.map((x, i) => {
        const done = i <= at;
        return (
          <li key={x.s} className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center" aria-current={i === at ? "step" : undefined}>
            <span className="relative flex w-full items-center justify-center">
              {i > 0 && <span className="absolute right-1/2 h-1 w-full" style={{ backgroundColor: i <= at ? "var(--sea)" : "var(--line)" }} />}
              <span
                className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-[0.875rem] font-bold"
                style={{ backgroundColor: done ? "var(--sea)" : "var(--line)", color: done ? "var(--card)" : "var(--navy)" }}
              >
                {i + 1}
              </span>
            </span>
            <span className={`text-[0.875rem] leading-tight ${i === at ? "font-bold text-navy" : "text-foreground/70"}`}>{x.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
