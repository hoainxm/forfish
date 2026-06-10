"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarIcon,
  EditIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, inputClass, PrimaryButton } from "@/components/ui/primitives";
import { formatVnd, formatVnDate } from "@/lib/format";

/*
  Sổ lãi lỗ chuyến biển — one card per trip, the profit/loss number is the
  hero: big, bold, green for lãi / red for lỗ. Everything lives on-device
  in localStorage; hydrate-on-mount mirrors document-vault to avoid
  SSR/CSR mismatch.
*/

const STORAGE_KEY = "forfish.trips.v1";

export interface TripEntry {
  id: string;
  date: string; // ISO yyyy-mm-dd, ngày về bờ
  label?: string;
  revenueVnd: number;
  fuelVnd: number;
  otherVnd: number;
  note?: string;
}

function tripProfit(t: TripEntry): number {
  return t.revenueVnd - t.fuelVnd - t.otherVnd;
}

function loadTrips(): TripEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as TripEntry[];
  } catch {
    // corrupt storage — start fresh
  }
  return [];
}

function saveTrips(trips: TripEntry[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
  } catch {
    // storage full / disabled — keep working in-memory
  }
}

function formatSignedVnd(n: number): string {
  const sign = n < 0 ? "-" : "+";
  return `${sign}${Math.abs(n).toLocaleString("vi-VN")} đ`;
}

function todayIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function TripLog() {
  const [trips, setTrips] = useState<TripEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState<TripEntry | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<TripEntry | null>(null);

  // Hydrate from localStorage on mount (avoids SSR/CSR mismatch).
  useEffect(() => {
    setTrips(loadTrips());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) saveTrips(trips);
  }, [trips, ready]);

  const sorted = useMemo(
    () =>
      [...trips].sort((a, b) =>
        a.date === b.date ? b.id.localeCompare(a.id) : b.date < a.date ? -1 : 1,
      ),
    [trips],
  );

  const totalAll = useMemo(
    () => sorted.reduce((sum, t) => sum + tripProfit(t), 0),
    [sorted],
  );
  const recent3 = useMemo(
    () => sorted.slice(0, 3).reduce((sum, t) => sum + tripProfit(t), 0),
    [sorted],
  );

  function upsert(trip: TripEntry) {
    setTrips((prev) => {
      const idx = prev.findIndex((t) => t.id === trip.id);
      if (idx === -1) return [...prev, trip];
      const next = [...prev];
      next[idx] = trip;
      return next;
    });
    setShowForm(false);
    setEditing(null);
  }

  function remove(id: string) {
    setTrips((prev) => prev.filter((t) => t.id !== id));
    setConfirmDelete(null);
  }

  return (
    <div>
      {ready && trips.length > 0 && (
        <div className="mb-4 surface p-4">
          <p className="text-[15px] font-bold text-foreground/55">
            Lãi {Math.min(3, sorted.length)} chuyến gần nhất
          </p>
          <p
            className="display text-[26px] font-bold leading-tight"
            style={{ color: recent3 >= 0 ? "var(--ok)" : "var(--danger)" }}
          >
            {formatSignedVnd(recent3)}
          </p>
          <div className="mt-2 flex items-baseline justify-between border-t border-line pt-2">
            <p className="text-[15px] font-bold text-foreground/55">
              Tổng tất cả {sorted.length} chuyến
            </p>
            <p
              className="text-[18px] font-bold"
              style={{ color: totalAll >= 0 ? "var(--ok)" : "var(--danger)" }}
            >
              {formatSignedVnd(totalAll)}
            </p>
          </div>
        </div>
      )}

      <button
        onClick={() => {
          setEditing(null);
          setShowForm(true);
        }}
        className="display mb-4 flex min-h-[60px] w-full items-center justify-center gap-2.5 rounded-full bg-trim text-[19px] font-bold text-white shadow-[0_10px_24px_-8px_rgba(228,87,46,0.55)] transition active:scale-[0.98]"
      >
        <PlusIcon className="h-6 w-6" />
        Ghi chuyến biển mới
      </button>

      {ready && trips.length === 0 && (
        <div className="rounded-[20px] bg-field/70 px-4 py-12 text-center">
          <CalendarIcon className="mx-auto h-10 w-10 text-foreground/30" />
          <p className="mt-3 text-[18px] text-foreground/60">
            Chưa có chuyến nào trong sổ.
            <br />
            Cá về bờ, bấm nút cam ở trên để ghi lại.
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {sorted.map((trip) => {
          const profit = tripProfit(trip);
          const gain = profit >= 0;
          return (
            <li
              key={trip.id}
              className="overflow-hidden surface"
            >
              <div className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-bold text-foreground/55">
                      Về bờ {formatVnDate(trip.date)}
                    </p>
                    {trip.label && (
                      <p className="display text-[18px] font-bold leading-snug text-navy">
                        {trip.label}
                      </p>
                    )}
                  </div>
                  <p
                    className="display shrink-0 text-[22px] font-bold leading-tight"
                    style={{ color: gain ? "var(--ok)" : "var(--danger)" }}
                  >
                    {formatSignedVnd(profit)}
                  </p>
                </div>

                <p className="mt-1.5 text-[15px] leading-relaxed text-foreground/55">
                  Bán cá {formatVnd(trip.revenueVnd)} · Tiền dầu{" "}
                  {formatVnd(trip.fuelVnd)} · Chi khác {formatVnd(trip.otherVnd)}
                </p>
                {trip.note && (
                  <p className="mt-1.5 rounded-xl bg-background px-3 py-1.5 text-[15px] text-foreground/70">
                    {trip.note}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 border-t border-line">
                <button
                  onClick={() => {
                    setEditing(trip);
                    setShowForm(true);
                  }}
                  className="flex min-h-[52px] items-center justify-center gap-2 text-[18px] font-bold text-sea active:bg-background"
                >
                  <EditIcon className="h-5 w-5" />
                  Sửa
                </button>
                <button
                  onClick={() => setConfirmDelete(trip)}
                  className="flex min-h-[52px] items-center justify-center gap-2 border-l border-line text-[18px] font-bold text-danger active:bg-background"
                >
                  <TrashIcon className="h-5 w-5" />
                  Xóa
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="py-4 text-center text-[14px] text-foreground/40">
        Sổ lãi lỗ lưu ngay trên máy của bà con.
      </p>

      {showForm && (
        <TripForm
          initial={editing}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSave={upsert}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          icon={<TrashIcon className="h-9 w-9 text-danger" />}
          title="Xóa chuyến này khỏi sổ?"
          message={`Chuyến về bờ ${formatVnDate(confirmDelete.date)} sẽ bị xóa, không lấy lại được.`}
          cancelLabel="Không xóa"
          confirmLabel="Xóa luôn"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => remove(confirmDelete.id)}
        />
      )}
    </div>
  );
}

/* ---------- form ---------- */

// "12500000" -> "12.500.000" while typing; empty stays empty.
function formatDigits(digits: string): string {
  if (!digits) return "";
  return Number(digits).toLocaleString("vi-VN");
}

function parseDigits(raw: string): string {
  return raw.replace(/[^\d]/g, "").slice(0, 12);
}

function TripForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: TripEntry | null;
  onCancel: () => void;
  onSave: (trip: TripEntry) => void;
}) {
  const [date, setDate] = useState(initial?.date ?? todayIso());
  const [label, setLabel] = useState(initial?.label ?? "");
  const [revenue, setRevenue] = useState(
    initial ? String(initial.revenueVnd) : "",
  );
  const [fuel, setFuel] = useState(initial ? String(initial.fuelVnd) : "");
  const [other, setOther] = useState(initial ? String(initial.otherVnd) : "");
  const [note, setNote] = useState(initial?.note ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      id: initial?.id ?? `trip-${Date.now()}`,
      date: date || todayIso(),
      label: label.trim() || undefined,
      revenueVnd: Number(revenue || 0),
      fuelVnd: Number(fuel || 0),
      otherVnd: Number(other || 0),
      note: note.trim() || undefined,
    });
  }

  const preview =
    Number(revenue || 0) - Number(fuel || 0) - Number(other || 0);
  const hasMoney = revenue !== "" || fuel !== "" || other !== "";

  return (
    <BottomSheet
      title={initial ? "Sửa chuyến biển" : "Ghi chuyến biển"}
      onClose={onCancel}
    >
      <form onSubmit={submit}>
        <Field label="Ngày về bờ">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Tên chuyến (không cần cũng được)">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className={inputClass}
            placeholder="VD: Chuyến trăng tháng 5"
          />
        </Field>

        <Field label="Tiền bán cá (đồng)">
          <input
            inputMode="numeric"
            value={formatDigits(revenue)}
            onChange={(e) => setRevenue(parseDigits(e.target.value))}
            className={inputClass}
            placeholder="VD: 45.000.000"
          />
        </Field>

        <Field label="Tiền dầu (đồng)">
          <input
            inputMode="numeric"
            value={formatDigits(fuel)}
            onChange={(e) => setFuel(parseDigits(e.target.value))}
            className={inputClass}
            placeholder="VD: 20.000.000"
          />
        </Field>

        <Field label="Chi phí khác — đá, mồi, công (đồng)">
          <input
            inputMode="numeric"
            value={formatDigits(other)}
            onChange={(e) => setOther(parseDigits(e.target.value))}
            className={inputClass}
            placeholder="VD: 8.000.000"
          />
        </Field>

        <Field label="Ghi chú thêm">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className={inputClass}
            placeholder="VD: Bán cho vựa cô Sáu, giá nhỉnh hơn"
          />
        </Field>

        {hasMoney && (
          <p
            className="mb-1 flex items-baseline justify-between rounded-xl px-4 py-3 text-[18px] font-bold"
            style={{
              backgroundColor:
                preview >= 0 ? "var(--ok-bg)" : "var(--danger-bg)",
              color: preview >= 0 ? "var(--ok)" : "var(--danger)",
            }}
          >
            <span>{preview >= 0 ? "Chuyến này lãi" : "Chuyến này lỗ"}</span>
            <span className="display text-[20px]">
              {formatSignedVnd(preview)}
            </span>
          </p>
        )}

        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[60px] rounded-full bg-field text-[18px] font-bold text-foreground/70"
          >
            Hủy
          </button>
          <PrimaryButton type="submit">Lưu lại</PrimaryButton>
        </div>
      </form>
    </BottomSheet>
  );
}
