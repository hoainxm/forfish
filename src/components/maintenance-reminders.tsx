"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertIcon,
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
import { saveUserJson, storageFullCopy } from "@/lib/user-store";
import { readUserList } from "@/lib/user-list-store";
import {
  SOON_DAYS_SERVICE,
  addDaysIso,
  daysUntil,
  todayIsoVN,
} from "@/lib/days";
import { useTodayVN } from "@/lib/use-today";
import { useBoats } from "@/components/boat-switcher";

/*
  Nhắc bảo dưỡng — same shape as the document vault so users learn it once:
  · each job is ONE card with ONE colour-coded status banner
  · "Vừa làm xong hôm nay" is the most common action, so it sits right
    on the card — one tap and the clock resets
  · add/edit happens in a bottom sheet with big inputs and two big buttons
*/

export const MAINTENANCE_STORAGE_KEY = "forfish.maintenance.v1";
const STORAGE_KEY = MAINTENANCE_STORAGE_KEY;

export interface MaintenanceEntry {
  id: string;
  item: string;
  lastDone: string; // ISO date
  intervalDays: number;
  note?: string;
  boatId?: string; // tàu sở hữu việc này (legacy entries: undefined)
}

// ── due-date logic — ngày + ngưỡng dùng chung lib/days.ts (2026-08-18) ──

type DueLevel = "overdue" | "soon" | "ok";

interface DueStatus {
  level: DueLevel;
  /** signed days until due; negative = already overdue */
  days: number;
  label: string;
}

/** ISO date that is `lastDone + intervalDays`. */
export function dueDateOf(entry: MaintenanceEntry): string {
  return addDaysIso(entry.lastDone, entry.intervalDays);
}

/** Bảo dưỡng: ngưỡng SOON_DAYS_SERVICE (14 — cần hẹn thợ trước, 7 là báo
 *  muộn nhất app); đến hạn HÔM NAY = quá hạn (đỏ). Export cho badge tab /tau. */
export function getDueStatus(entry: MaintenanceEntry, today: Date): DueStatus {
  const days = daysUntil(dueDateOf(entry), today);
  if (days < 0) {
    return { level: "overdue", days, label: `Quá hạn ${Math.abs(days)} ngày` };
  }
  if (days === 0) return { level: "overdue", days, label: "Đến hạn hôm nay" };
  if (days <= SOON_DAYS_SERVICE) {
    return { level: "soon", days, label: `Còn ${days} ngày` };
  }
  return { level: "ok", days, label: `Còn ${days} ngày` };
}

// ── storage ──────────────────────────────────────────────────

/*
  App đã đưa vào sử dụng (chủ dự án 2026-07-29): KHÔNG seed lịch mẫu nữa. User
  mới mở thấy màn RỖNG, tự thêm việc bảo dưỡng thật. (Trước có lịch mẫu tự-xưng
  theo hội đồng UX 2026-06-11 — bỏ khi lên thật.)

  HAI TRẠNG THÁI qua `readUserList` (T1, audit 2026-08-18 — cùng khuôn
  document-vault): JSON hỏng / khoá giữ thứ không phải mảng ⇒ `readFailed`,
  KHÔNG dựng lịch rỗng trông y như thật và KHÔNG mở cửa ghi — ghi đè là mất
  chuỗi gốc còn cứu được. Mảng (kể cả rỗng) hoặc chưa có khoá = lịch THẬT.
  Export cho badge tab /tau (tau-tabs.tsx).
*/
export function loadEntries(): {
  entries: MaintenanceEntry[];
  /** true = khoá đang giữ thứ ĐỌC KHÔNG ĐƯỢC ⇒ CẤM ghi đè, phải báo */
  readFailed: boolean;
} {
  if (typeof window === "undefined") return { entries: [], readFailed: false };
  const r = readUserList<MaintenanceEntry>(STORAGE_KEY);
  if (!r.ok) return { entries: [], readFailed: true };
  return { entries: Array.isArray(r.list) ? r.list : [], readFailed: false };
}

/* Trả `false` khi máy KHÔNG giữ được (hết chỗ / trình duyệt chặn) — trước đây
   nuốt im, mốc bảo dưỡng vừa ghi biến mất lúc mở lại app. Dự báo tải sẵn nhường
   chỗ cho việc bà con tự ghi (lib/user-store.ts); nhường vẫn không đủ thì BÁO. */
function saveEntries(entries: MaintenanceEntry[]): boolean {
  return saveUserJson(STORAGE_KEY, entries);
}

// ── component ────────────────────────────────────────────────

export function MaintenanceReminders() {
  const { today } = useTodayVN();
  const { current, boats, ready: boatReady } = useBoats();
  const [entries, setEntries] = useState<MaintenanceEntry[]>([]);
  const [ready, setReady] = useState(false);
  /** máy không giữ được việc vừa ghi → phải nói ra, không im */
  const [saveFailed, setSaveFailed] = useState(false);
  /** lịch trong máy ĐỌC KHÔNG ĐƯỢC → cấm mọi đường ghi đè, báo đỏ */
  const [readFailed, setReadFailed] = useState(false);
  const [editing, setEditing] = useState<MaintenanceEntry | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<MaintenanceEntry | null>(
    null,
  );

  // Hydrate from localStorage on mount (avoids SSR/CSR mismatch).
  useEffect(() => {
    const loaded = loadEntries();
    setEntries(loaded.entries);
    setReadFailed(loaded.readFailed);
    setReady(true);
  }, []);

  /*  GHI KHI BÀ CON THAO TÁC, KHÔNG GHI SAU HYDRATE (N5, audit 2026-08-18):
      effect cũ `if (ready) save(entries)` chạy ngay khi mở màn ⇒ máy đầy thì
      băng đỏ "CHƯA lưu được" bật dù chưa nhập gì. Nay chỉ `commit()` từ upsert
      / vừa làm xong / xoá. Đọc hỏng thì KHÔNG ghi. */
  function commit(next: MaintenanceEntry[]) {
    setEntries(next);
    if (readFailed) return;
    setSaveFailed(!saveEntries(next));
  }

  // Xóa tàu → lịch bảo dưỡng tàu đó đã bị purge (ba-spec 08 R3); đọc lại.
  // Đọc lại không được → GIỮ NGUYÊN thứ đang hiện, khoá cửa ghi.
  useEffect(() => {
    if (!ready) return;
    const loaded = loadEntries();
    if (loaded.readFailed) {
      setReadFailed(true);
      return;
    }
    setEntries(loaded.entries);
    setReadFailed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boats.length]);

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
    const idx = entries.findIndex((e) => e.id === withBoat.id);
    const next = [...entries];
    if (idx === -1) next.push(withBoat);
    else next[idx] = withBoat;
    commit(next);
    setShowForm(false);
    setEditing(null);
  }

  function markDoneToday(id: string) {
    const todayIso = todayIsoVN();
    const next = entries.map((e) =>
      e.id === id ? { ...e, lastDone: todayIso } : e,
    );
    commit(next);
  }

  function remove(id: string) {
    const next = entries.filter((e) => e.id !== id);
    commit(next);
    setConfirmDelete(null);
  }

  return (
    <div className="px-4 pt-1">
      {/* ĐỌC KHÔNG ĐƯỢC — nói thẳng và KHOÁ cửa ghi (T1): thêm việc lúc này là
          ghi đè lên chuỗi gốc còn cứu được, mất cả lịch. */}
      {readFailed ? (
        <div className="mb-4 overflow-hidden surface">
          <StatusBanner level="danger" icon={<AlertIcon className="h-5 w-5" />}>
            Lịch bảo dưỡng trong máy đang ĐỌC KHÔNG ĐƯỢC — việc cũ vẫn nằm trong
            máy nhưng app chưa mở ra được. Bà con ĐỪNG ghi việc mới ở đây (ghi là
            đè mất bản cũ); thử tắt hẳn app mở lại, hoặc phục hồi từ tệp sao lưu.
          </StatusBanner>
        </div>
      ) : (
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="display mb-4 flex min-h-[3.75rem] w-full items-center justify-center gap-2.5 rounded-full bg-trim text-[1.1875rem] font-bold text-white shadow-trim-cta transition active:scale-[0.98]"
        >
          <PlusIcon className="h-6 w-6" />
          Thêm việc bảo dưỡng
        </button>
      )}

      {/* MÁY KHÔNG GIỮ ĐƯỢC — nói ngay, đừng để tưởng đã ghi rồi quên luôn việc */}
      {saveFailed && (
        <div className="mb-4 overflow-hidden surface">
          <StatusBanner level="danger" icon={<AlertIcon className="h-5 w-5" />}>
            {storageFullCopy("việc vừa ghi")}
          </StatusBanner>
        </div>
      )}

      {ready && boatReady && sorted.length === 0 && (
        <div className="rounded-[1.25rem] bg-field/70 px-4 py-12 text-center">
          <WrenchIcon className="mx-auto h-10 w-10 text-foreground/30" />
          <p className="mt-3 text-[1.125rem] text-foreground/70">
            {readFailed ? (
              <>
                Chưa mở được lịch bảo dưỡng trong máy.
                <br />
                Việc cũ chưa mất — xem dải đỏ ở trên.
              </>
            ) : (
              <>
                Chưa có việc bảo dưỡng nào.
                <br />
                Bấm nút cam ở trên để thêm.
              </>
            )}
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
                <p className="text-[1rem] text-foreground/70">
                  Làm gần nhất:{" "}
                  <strong>{formatVnDate(entry.lastDone)}</strong>
                </p>
                <p className="text-[1rem] text-foreground/70">
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

      <p className="py-4 text-center text-[0.875rem] text-foreground/65">
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
  const todayIso = todayIsoVN();
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
