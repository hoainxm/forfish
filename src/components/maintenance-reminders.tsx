"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckIcon,
  EditIcon,
  PlusIcon,
  TrashIcon,
  WrenchIcon,
} from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { StatusBanner } from "@/components/ui/status-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, inputClass, PrimaryButton } from "@/components/ui/primitives";
import { formatVnDate } from "@/lib/format";
import { useBoats } from "@/components/boat-switcher";

/*
  Nhắc bảo dưỡng — same shape as the document vault so users learn it once:
  · each job is ONE card with ONE colour-coded status banner
  · "Vừa làm xong hôm nay" is the most common action, so it sits right
    on the card — one tap and the clock resets
  · add/edit happens in a bottom sheet with big inputs and two big buttons
*/

const STORAGE_KEY = "forfish.maintenance.v1";

interface MaintenanceEntry {
  id: string;
  item: string;
  lastDone: string; // ISO date
  intervalDays: number;
  note?: string;
  boatId?: string; // tàu sở hữu việc này (legacy entries: undefined)
}

// ── due-date logic (mirrors src/lib/documents.ts style, kept local) ──

type DueLevel = "overdue" | "soon" | "ok";

interface DueStatus {
  level: DueLevel;
  /** signed days until due; negative = already overdue */
  days: number;
  label: string;
}

const SOON_DAYS = 7;

/** Days between today and an ISO date, computed in UTC to avoid TZ drift. */
function daysUntil(isoDate: string, today: Date): number {
  const target = new Date(isoDate + "T00:00:00Z");
  const base = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  return Math.round((target.getTime() - base) / 86_400_000);
}

/** ISO date that is `lastDone + intervalDays`. */
function dueDateOf(entry: MaintenanceEntry): string {
  const d = new Date(entry.lastDone + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + entry.intervalDays);
  return d.toISOString().slice(0, 10);
}

function getDueStatus(entry: MaintenanceEntry, today: Date): DueStatus {
  const days = daysUntil(dueDateOf(entry), today);
  if (days < 0) {
    return { level: "overdue", days, label: `Quá hạn ${Math.abs(days)} ngày` };
  }
  if (days === 0) return { level: "soon", days, label: "Đến hạn hôm nay" };
  if (days <= SOON_DAYS) {
    return { level: "soon", days, label: `Còn ${days} ngày` };
  }
  return { level: "ok", days, label: `Còn ${days} ngày` };
}

// ── storage ──────────────────────────────────────────────────

function isoDaysAgo(today: Date, days: number): string {
  const d = new Date(today);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Demo seed so the screen demonstrates itself before first use. */
function demoEntries(today: Date): MaintenanceEntry[] {
  return [
    {
      id: "demo-bd-1",
      item: "Thay lọc dầu",
      lastDone: isoDaysAgo(today, 100),
      intervalDays: 90,
      note: "Mua lọc đúng mã máy, xem bảng giá bên dưới.",
    },
    {
      id: "demo-bd-2",
      item: "Thay dầu máy",
      lastDone: isoDaysAgo(today, 54),
      intervalDays: 60,
    },
    {
      id: "demo-bd-3",
      item: "Bơm mỡ trục láp",
      lastDone: isoDaysAgo(today, 5),
      intervalDays: 30,
    },
  ];
}

function loadEntries(today: Date): MaintenanceEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as MaintenanceEntry[];
  } catch {
    // corrupt storage — fall through to demo seed
  }
  return demoEntries(today);
}

function saveEntries(entries: MaintenanceEntry[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // storage full / disabled — keep working in-memory
  }
}

// ── component ────────────────────────────────────────────────

export function MaintenanceReminders() {
  const today = useMemo(() => new Date(), []);
  const { current, ready: boatReady } = useBoats();
  const [entries, setEntries] = useState<MaintenanceEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState<MaintenanceEntry | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<MaintenanceEntry | null>(
    null,
  );

  // Hydrate from localStorage on mount (avoids SSR/CSR mismatch).
  useEffect(() => {
    setEntries(loadEntries(today));
    setReady(true);
  }, [today]);

  useEffect(() => {
    if (ready) saveEntries(entries);
  }, [entries, ready]);

  // Only this boat's entries. Legacy entries with no boatId belong to the
  // current boat for back-compat.
  const boatEntries = useMemo(
    () => entries.filter((e) => e.boatId === current?.id || e.boatId == null),
    [entries, current],
  );

  const sorted = useMemo(
    () =>
      [...boatEntries].sort(
        (a, b) => getDueStatus(a, today).days - getDueStatus(b, today).days,
      ),
    [boatEntries, today],
  );

  function upsert(entry: MaintenanceEntry) {
    const withBoat: MaintenanceEntry = { ...entry, boatId: current?.id };
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === withBoat.id);
      if (idx === -1) return [...prev, withBoat];
      const next = [...prev];
      next[idx] = withBoat;
      return next;
    });
    setShowForm(false);
    setEditing(null);
  }

  function markDoneToday(id: string) {
    const todayIso = new Date().toISOString().slice(0, 10);
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, lastDone: todayIso } : e)),
    );
  }

  function remove(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setConfirmDelete(null);
  }

  return (
    <div className="px-4 pt-1">
      <button
        onClick={() => {
          setEditing(null);
          setShowForm(true);
        }}
        className="display mb-4 flex min-h-[3.75rem] w-full items-center justify-center gap-2.5 rounded-full bg-trim text-[1.1875rem] font-bold text-white shadow-[0_10px_24px_-8px_rgba(228,87,46,0.55)] transition active:scale-[0.98]"
      >
        <PlusIcon className="h-6 w-6" />
        Thêm việc bảo dưỡng
      </button>

      {ready && boatReady && sorted.length === 0 && (
        <div className="rounded-[1.25rem] bg-field/70 px-4 py-12 text-center">
          <WrenchIcon className="mx-auto h-10 w-10 text-foreground/30" />
          <p className="mt-3 text-[1.125rem] text-foreground/60">
            Chưa có việc bảo dưỡng nào.
            <br />
            Bấm nút cam ở trên để thêm.
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {sorted.map((entry) => {
          const status = getDueStatus(entry, today);
          const level =
            status.level === "overdue"
              ? ("danger" as const)
              : status.level === "soon"
                ? ("warn" as const)
                : ("ok" as const);
          return (
            <li
              key={entry.id}
              className="overflow-hidden surface"
            >
              {/* status banner — the first thing the eye lands on */}
              <StatusBanner level={level}>{status.label}</StatusBanner>

              <div className="px-4 py-3">
                <p className="display text-[1.1875rem] font-bold leading-snug text-navy">
                  {entry.item}
                </p>
                <p className="text-[1rem] text-foreground/60">
                  Làm gần nhất:{" "}
                  <strong>{formatVnDate(entry.lastDone)}</strong>
                </p>
                <p className="text-[1rem] text-foreground/60">
                  Chu kỳ: mỗi {entry.intervalDays} ngày
                </p>
                {entry.note && (
                  <p className="mt-1.5 rounded-xl bg-background px-3 py-1.5 text-[0.9375rem] text-foreground/70">
                    {entry.note}
                  </p>
                )}

                <button
                  onClick={() => markDoneToday(entry.id)}
                  className="mt-3 flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-xl text-[1rem] font-bold transition active:scale-[0.98]"
                  style={{
                    backgroundColor: "var(--ok-bg)",
                    color: "var(--ok)",
                  }}
                >
                  <CheckIcon className="h-5 w-5" />
                  Vừa làm xong hôm nay
                </button>
              </div>

              <div className="grid grid-cols-2 border-t border-line">
                <button
                  onClick={() => {
                    setEditing(entry);
                    setShowForm(true);
                  }}
                  className="flex min-h-[3.25rem] items-center justify-center gap-2 text-[1.125rem] font-bold text-sea active:bg-background"
                >
                  <EditIcon className="h-5 w-5" />
                  Sửa
                </button>
                <button
                  onClick={() => setConfirmDelete(entry)}
                  className="flex min-h-[3.25rem] items-center justify-center gap-2 border-l border-line text-[1.125rem] font-bold text-danger active:bg-background"
                >
                  <TrashIcon className="h-5 w-5" />
                  Xóa
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="py-4 text-center text-[0.875rem] text-foreground/40">
        Lịch bảo dưỡng lưu ngay trên máy của bà con.
      </p>

      {showForm && (
        <MaintenanceForm
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
          title="Xóa việc này?"
          message={`“${confirmDelete.item}” sẽ bị xóa, không lấy lại được.`}
          cancelLabel="Không xóa"
          confirmLabel="Xóa luôn"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => remove(confirmDelete.id)}
        />
      )}
    </div>
  );
}

// ── bottom-sheet form ────────────────────────────────────────

const TASK_SUGGESTIONS = [
  "Thay dầu máy",
  "Thay lọc dầu",
  "Thay lọc nhiên liệu",
  "Bơm mỡ",
  "Kiểm tra kẽm chống ăn mòn",
];

const OTHER = "__khac__";
const INTERVAL_CHIPS = [30, 60, 90, 180];

function MaintenanceForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: MaintenanceEntry | null;
  onCancel: () => void;
  onSave: (entry: MaintenanceEntry) => void;
}) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const initialIsSuggestion =
    initial !== null && TASK_SUGGESTIONS.includes(initial.item);

  const [picked, setPicked] = useState<string>(
    initial === null
      ? TASK_SUGGESTIONS[0]
      : initialIsSuggestion
        ? initial.item
        : OTHER,
  );
  const [customItem, setCustomItem] = useState(
    initial !== null && !initialIsSuggestion ? initial.item : "",
  );
  const [lastDone, setLastDone] = useState(initial?.lastDone ?? todayIso);
  const [intervalDays, setIntervalDays] = useState(
    String(initial?.intervalDays ?? 60),
  );
  const [note, setNote] = useState(initial?.note ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const item =
      picked === OTHER ? customItem.trim() || "Việc bảo dưỡng" : picked;
    const interval = Math.max(1, Math.round(Number(intervalDays) || 60));
    onSave({
      id: initial?.id ?? `bd-${Date.now()}`,
      item,
      lastDone: lastDone || todayIso,
      intervalDays: interval,
      note: note.trim() || undefined,
    });
  }

  return (
    <BottomSheet
      title={initial ? "Sửa việc bảo dưỡng" : "Thêm việc bảo dưỡng"}
      onClose={onCancel}
    >
      <form onSubmit={submit}>
        <Field label="Việc gì?">
          <select
            value={picked}
            onChange={(e) => setPicked(e.target.value)}
            className={inputClass}
          >
            {TASK_SUGGESTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
            <option value={OTHER}>Việc khác</option>
          </select>
        </Field>

        {picked === OTHER && (
          <Field label="Ghi tên việc đó">
            <input
              value={customItem}
              onChange={(e) => setCustomItem(e.target.value)}
              className={inputClass}
              placeholder="VD: Xiết lại bu lông chân máy"
            />
          </Field>
        )}

        <Field label="Làm gần nhất ngày nào?">
          <input
            type="date"
            value={lastDone}
            max={todayIso}
            onChange={(e) => setLastDone(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Bao lâu làm một lần? (số ngày)">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={intervalDays}
            onChange={(e) => setIntervalDays(e.target.value)}
            className={inputClass}
          />
          <div className="mt-2 grid grid-cols-4 gap-2">
            {INTERVAL_CHIPS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setIntervalDays(String(d))}
                className={`min-h-[2.75rem] rounded-xl text-[1rem] font-bold transition active:scale-[0.97] ${
                  Number(intervalDays) === d
                    ? "bg-navy text-white"
                    : "bg-field text-foreground/70"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Ghi chú thêm">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className={inputClass}
            placeholder="VD: Dùng dầu 15W-40, can 18 lít"
          />
        </Field>

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
