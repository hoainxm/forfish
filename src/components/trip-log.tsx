"use client";

import { useMemo, useState } from "react";
import {
  CalendarIcon,
  DocIcon,
  EditIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Field,
  inputClass,
  MoneyField,
  PrimaryButton,
} from "@/components/ui/primitives";
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

// export cho money-insights (chủ sổ duy nhất — hội đồng UX 2026-06-11)
export function loadTrips(): TripEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as TripEntry[];
  } catch {
    // corrupt storage — start fresh
  }
  return [];
}

export function saveTrips(trips: TripEntry[]) {
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

/*
  CONTROLLED (hội đồng UX 2026-06-11): trips + onChange do money-insights
  cầm — một nguồn sự thật, thẻ "Nhìn nhanh" phía trên cập nhật TỨC THÌ khi
  ghi/sửa/xóa chuyến ở đây.
*/
export function TripLog({
  trips,
  onChange,
  onSplit,
  onDossier,
}: {
  trips: TripEntry[];
  onChange: (next: TripEntry[]) => void;
  /** "Chia tiền chuyến này" — nhảy sang máy chia với số của chuyến đó */
  onSplit?: (trip: TripEntry) => void;
  /** "Hồ sơ chuyến" — mở bản in được (PDF) cho người mua/lưu hồ sơ */
  onDossier?: (trip: TripEntry) => void;
}) {
  const ready = true; // parent chỉ render sau khi hydrate xong
  const [editing, setEditing] = useState<TripEntry | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isCopy, setIsCopy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<TripEntry | null>(null);


  const sorted = useMemo(
    () =>
      [...trips].sort((a, b) =>
        a.date === b.date ? b.id.localeCompare(a.id) : b.date < a.date ? -1 : 1,
      ),
    [trips],
  );

  function upsert(trip: TripEntry) {
    const idx = trips.findIndex((t) => t.id === trip.id);
    onChange(
      idx === -1
        ? [...trips, trip]
        : trips.map((t) => (t.id === trip.id ? trip : t)),
    );
    setShowForm(false);
    setEditing(null);
    setIsCopy(false);
  }

  function remove(id: string) {
    onChange(trips.filter((t) => t.id !== id));
    setConfirmDelete(null);
  }

  return (
    <div>
      {/* thẻ tổng kết đã GỘP về "Nhìn nhanh" của money-insights (roadmap hội
          đồng UX 2026-06-11: 2 thẻ nói cùng một tổng bằng 2 định dạng) —
          nút cam ghi chuyến lên đầu */}
      <button
        onClick={() => {
          setEditing(null);
          setIsCopy(false);
          setShowForm(true);
        }}
        className="display mb-4 flex min-h-[3.75rem] w-full items-center justify-center gap-2.5 rounded-full bg-trim text-[1.1875rem] font-bold text-white shadow-[0_10px_24px_-8px_rgba(228,87,46,0.55)] transition active:scale-[0.98]"
      >
        <PlusIcon className="h-6 w-6" />
        Ghi chuyến biển mới
      </button>

      {ready && trips.length === 0 && (
        <div className="rounded-[1.25rem] bg-field/70 px-4 py-12 text-center">
          <CalendarIcon className="mx-auto h-10 w-10 text-foreground/30" />
          <p className="mt-3 text-[1.125rem] text-foreground/70">
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
                    <p className="text-[0.9375rem] font-bold text-foreground/70">
                      Về bờ {formatVnDate(trip.date)}
                    </p>
                    {trip.label && (
                      <p className="display text-[1.125rem] font-bold leading-snug text-navy">
                        {trip.label}
                      </p>
                    )}
                  </div>
                  <p
                    className="display shrink-0 text-[1.375rem] font-bold leading-tight tabular-nums"
                    style={{ color: gain ? "var(--ok)" : "var(--danger)" }}
                  >
                    {formatSignedVnd(profit)}
                  </p>
                </div>

                <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-foreground/70">
                  Bán cá {formatVnd(trip.revenueVnd)} · Tiền dầu{" "}
                  {formatVnd(trip.fuelVnd)} · Chi khác {formatVnd(trip.otherVnd)}
                </p>
                {trip.note && (
                  <p className="mt-1.5 rounded-xl bg-background px-3 py-1.5 text-[0.9375rem] text-foreground/70">
                    {trip.note}
                  </p>
                )}
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => {
                      // chép SỐ TỔN chuyến cũ làm nền chuyến mới: id mới +
                      // ngày hôm nay → lưu riêng, không đè chuyến cũ.
                      setEditing({
                        ...trip,
                        id: `trip-${Date.now()}`,
                        date: todayIso(),
                        note: undefined,
                      });
                      setIsCopy(true);
                      setShowForm(true);
                    }}
                    className="flex min-h-[2.75rem] flex-1 items-center justify-center gap-2 rounded-full bg-field text-[1rem] font-bold text-navy active:scale-[0.98]"
                  >
                    <PlusIcon className="h-5 w-5" />
                    Lặp lại chuyến
                  </button>
                  {onDossier && (
                    <button
                      onClick={() => onDossier(trip)}
                      className="flex min-h-[2.75rem] flex-1 items-center justify-center gap-2 rounded-full bg-field text-[1rem] font-bold text-navy active:scale-[0.98]"
                    >
                      <DocIcon className="h-5 w-5" />
                      Hồ sơ (PDF)
                    </button>
                  )}
                </div>
              </div>

              <div
                className={`grid border-t border-line ${onSplit ? "grid-cols-3" : "grid-cols-2"}`}
              >
                {onSplit && (
                  <button
                    onClick={() => onSplit(trip)}
                    className="flex min-h-[3.25rem] items-center justify-center gap-1.5 text-[1.0625rem] font-bold text-t2 active:bg-background"
                  >
                    Chia tiền
                  </button>
                )}
                <button
                  onClick={() => {
                    setEditing(trip);
                    setIsCopy(false);
                    setShowForm(true);
                  }}
                  className={`flex min-h-[3.25rem] items-center justify-center gap-2 text-[1.0625rem] font-bold text-sea active:bg-background ${onSplit ? "border-l border-line" : ""}`}
                >
                  <EditIcon className="h-5 w-5" />
                  Sửa
                </button>
                <button
                  onClick={() => setConfirmDelete(trip)}
                  className="flex min-h-[3.25rem] items-center justify-center gap-2 border-l border-line text-[1.0625rem] font-bold text-danger active:bg-background"
                >
                  <TrashIcon className="h-5 w-5" />
                  Xóa
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="py-4 text-center text-[0.875rem] text-foreground/65">
        Sổ lãi lỗ lưu ngay trên máy của bà con.
      </p>

      {showForm && (
        <TripForm
          initial={editing}
          heading={isCopy ? "Chuyến mới (chép số chuyến cũ)" : undefined}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
            setIsCopy(false);
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

function TripForm({
  initial,
  heading,
  onCancel,
  onSave,
}: {
  initial: TripEntry | null;
  /** tiêu đề sheet ghi đè (vd chế độ "lặp lại chuyến") */
  heading?: string;
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
      title={heading ?? (initial ? "Sửa chuyến biển" : "Ghi chuyến biển")}
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

        <MoneyField
          label="Tiền bán cá (đồng)"
          digits={revenue}
          onDigits={setRevenue}
          placeholder="VD: 45.000.000"
        />

        <MoneyField
          label="Tiền dầu (đồng)"
          digits={fuel}
          onDigits={setFuel}
          placeholder="VD: 20.000.000"
        />

        <MoneyField
          label="Chi phí khác — đá, mồi, công (đồng)"
          digits={other}
          onDigits={setOther}
          placeholder="VD: 8.000.000"
        />

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
            className="mb-1 flex items-baseline justify-between rounded-xl px-4 py-3 text-[1.125rem] font-bold"
            style={{
              backgroundColor:
                preview >= 0 ? "var(--ok-bg)" : "var(--danger-bg)",
              color: preview >= 0 ? "var(--ok)" : "var(--danger)",
            }}
          >
            <span>{preview >= 0 ? "Chuyến này lãi" : "Chuyến này lỗ"}</span>
            <span className="display text-[1.25rem]">
              {formatSignedVnd(preview)}
            </span>
          </p>
        )}

        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[3.75rem] rounded-full bg-field text-[1.125rem] font-bold text-foreground/70"
          >
            Hủy
          </button>
          <PrimaryButton type="submit">Lưu lại</PrimaryButton>
        </div>
      </form>
    </BottomSheet>
  );
}
