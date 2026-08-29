"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertIcon,
  CheckIcon,
  CloseIcon,
  EditIcon,
  PlusIcon,
  TrashIcon,
  WrenchIcon,
} from "@/components/icons";
import { SQ_BTN } from "@/components/ui/sq-btn";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { StatusBanner } from "@/components/ui/status-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, inputClass } from "@/components/ui/primitives";
import { formatVnDate } from "@/lib/format";
import { saveUserJson, storageFullCopy } from "@/lib/user-store";
import { readUserList } from "@/lib/user-list-store";
import { markLocalWrite, USER_SYNC_EVENT } from "@/lib/user-sync";
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
  const ok = saveUserJson(STORAGE_KEY, entries);
  if (ok) markLocalWrite("maintenance"); // đồng bộ lên server (lib/user-sync)
  return ok;
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

  // Máy khác kéo về (lib/user-sync) → đọc lại sổ bảo dưỡng từ localStorage.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onSync = (e: Event) => {
      if ((e as CustomEvent<{ kind?: string }>).detail?.kind !== "maintenance") return;
      const loaded = loadEntries();
      setEntries(loaded.entries);
      setReadFailed(loaded.readFailed);
    };
    window.addEventListener(USER_SYNC_EVENT, onSync);
    return () => window.removeEventListener(USER_SYNC_EVENT, onSync);
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
      {/*  MỘT HÀNG CHUẨN thay nút cam full-width (2026-08-29, luật A2/A3/B1).
          Chuỗi class cam full-width này từng có 4 bản chép tay (document-vault,
          maintenance-reminders, boat-products, sdvico-request) — sửa một chỗ là
          lệch, nay gom về SQ_BTN dùng chung (nguyên tắc 3). */}
      <div className="mb-4 flex items-stretch gap-2">
        <div className="flex min-w-0 flex-1 items-center rounded-2xl bg-background px-4 py-3">
          <p className="text-[1rem] font-bold text-navy">
            Sổ nhắc bảo dưỡng · {sorted.length} việc
          </p>
        </div>
        {/* ĐỌC KHÔNG ĐƯỢC thì KHOÁ cửa ghi (T1): ghi việc lúc này là đè lên
            chuỗi gốc còn cứu được, mất cả lịch. */}
        {readFailed ? (
          <span className="w-16 shrink-0" aria-hidden />
        ) : (
          <button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className={`${SQ_BTN} bg-trim text-white shadow-trim-cta`}
          >
            <PlusIcon className="h-6 w-6" />
            Thêm
          </button>
        )}
      </div>

      {readFailed && (
        <div className="mb-4 overflow-hidden surface">
          <StatusBanner level="danger" icon={<AlertIcon className="h-5 w-5" />}>
            Lịch bảo dưỡng trong máy đang ĐỌC KHÔNG ĐƯỢC — việc cũ vẫn nằm trong
            máy nhưng app chưa mở ra được. Bà con ĐỪNG ghi việc mới ở đây (ghi là
            đè mất bản cũ); thử tắt hẳn app mở lại, hoặc phục hồi từ tệp sao lưu.
          </StatusBanner>
        </div>
      )}

      {/* MÁY KHÔNG GIỮ ĐƯỢC — nói ngay, đừng để tưởng đã ghi rồi quên luôn việc */}
      {saveFailed && (
        <div className="mb-4 overflow-hidden surface">
          <StatusBanner level="danger" icon={<AlertIcon className="h-5 w-5" />}>
            {storageFullCopy("việc vừa ghi")}
          </StatusBanner>
        </div>
      )}

      {/* Bỏ ô empty-state "Chưa có việc bảo dưỡng nào" (user chốt 2026-08-25) —
          nút cam ở trên đã mời thêm. GIỮ cảnh báo ĐỌC-HỎNG (đọc được ≠ chưa có
          gì): mất nó là mất lá chắn chống-mất-dữ-liệu (nguyên tắc 4). */}
      {ready && boatReady && sorted.length === 0 && readFailed && (
        <div className="rounded-[1.25rem] bg-field/70 px-4 py-12 text-center">
          <WrenchIcon className="mx-auto h-10 w-10 text-foreground/30" />
          <p className="mt-3 text-[1.125rem] text-foreground/70">
            Chưa mở được lịch bảo dưỡng trong máy.
            <br />
            Việc cũ chưa mất — xem dải đỏ ở trên.
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

              {/*  THÂN THẺ theo khuôn hàng chung (luật B1): mỗi dòng là
                  [thân flex-1 min-w-0] + [ô nút w-16]. Nút "Xong" (trước là
                  "Vừa làm xong hôm nay" full-width, bấm nhiều nhất màn nên trả
                  giá chiều cao trên MỌI thẻ) nay inline cuối chính hàng "Chu kỳ"
                  mà nó thao tác lên. */}
              <div className="space-y-1.5 p-2">
                <div className="flex items-stretch gap-2">
                  <div className="flex min-w-0 flex-1 items-center rounded-2xl bg-background px-3 py-2">
                    <p className="display break-words text-[1.125rem] font-bold leading-snug text-navy">
                      {entry.item}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setEditing(entry);
                      setShowForm(true);
                    }}
                    className={`${SQ_BTN} bg-background text-sea`}
                  >
                    <EditIcon className="h-6 w-6" />
                    Sửa
                  </button>
                  <button
                    onClick={() => setConfirmDelete(entry)}
                    className={`${SQ_BTN} bg-background text-danger`}
                  >
                    <TrashIcon className="h-6 w-6" />
                    Xóa
                  </button>
                </div>

                <div className="flex items-stretch gap-2">
                  <div className="flex min-w-0 flex-1 items-center rounded-2xl bg-background px-3 py-2">
                    <p className="text-[1rem] text-foreground/70">
                      Chu kỳ: mỗi {entry.intervalDays} ngày · làm gần nhất{" "}
                      <strong>{formatVnDate(entry.lastDone)}</strong>
                    </p>
                  </div>
                  <button
                    onClick={() => markDoneToday(entry.id)}
                    className={SQ_BTN}
                    style={{
                      backgroundColor: "var(--ok-bg)",
                      color: "var(--ok)",
                    }}
                  >
                    <CheckIcon className="h-6 w-6" />
                    Xong
                  </button>
                </div>

                {entry.note && (
                  <div className="flex items-stretch gap-2">
                    <div className="flex min-w-0 flex-1 items-center rounded-2xl bg-background px-3 py-2">
                      <p className="text-[0.9375rem] text-foreground/70">
                        {entry.note}
                      </p>
                    </div>
                    <span className="w-16 shrink-0" aria-hidden />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/*  Bỏ dòng chân trang "lưu ngay trên máy" (D1) — không cấp dữ liệu,
          không dặn dò an toàn, chỉ giải thích app hoạt động thế nào; chỗ đúng
          của nó là màn cài đặt/sao lưu. */}

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
  /*  Ba thứ THU LẠI mặc định (luật C1): KEY chỉ là "việc gì" + "chu kỳ".
      Chu kỳ ngoài 4 chip thì mở ô số qua chip "Khác" — một đường cho một
      giá trị, không phải hai. */
  const [customInterval, setCustomInterval] = useState(
    !INTERVAL_CHIPS.includes(Number(initial?.intervalDays ?? 60)),
  );
  const [showLastDone, setShowLastDone] = useState(false);
  const [showNote, setShowNote] = useState(Boolean(initial?.note));

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

        {/*  CHU KỲ: bỏ ô số bày sẵn — 4 chip + "Khác" đã phủ 99% ca. Trước đây
            ô số và 4 chip là HAI ĐƯỜNG CHO CÙNG MỘT giá trị, đúng lỗi mà
            03-design-system đã chỉ mặt ở ca my-places-sheet. Chip nâng lên sàn
            chạm 3.25rem (trước 2.75rem = 44px, dưới sàn). */}
        <Field label="Bao lâu làm một lần?">
          <div className="grid grid-cols-5 gap-2">
            {INTERVAL_CHIPS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setIntervalDays(String(d));
                  setCustomInterval(false);
                }}
                className={`min-h-[3.25rem] rounded-xl text-[1rem] font-bold transition active:scale-[0.97] ${
                  !customInterval && Number(intervalDays) === d
                    ? "bg-navy text-white"
                    : "bg-field text-foreground/70"
                }`}
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCustomInterval((v) => !v)}
              className={`min-h-[3.25rem] rounded-xl text-[1rem] font-bold transition active:scale-[0.97] ${
                customInterval
                  ? "bg-navy text-white"
                  : "bg-field text-foreground/70"
              }`}
            >
              Khác
            </button>
          </div>
          {customInterval && (
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={intervalDays}
              onChange={(e) => setIntervalDays(e.target.value)}
              className={`${inputClass} mt-2`}
              aria-label="Số ngày giữa hai lần làm"
            />
          )}
        </Field>

        {/*  "Làm gần nhất" MÁY ĐÃ ĐIỀN SẴN hôm nay ⇒ dòng đọc-được + ô "Sửa";
            "Ghi chú thêm" là tuỳ chọn ⇒ thu sau ô "Mở" (luật C1). */}
        <div className="mb-3.5 flex items-stretch gap-2">
          <div className="flex min-w-0 flex-1 items-center rounded-2xl bg-background px-3 py-2">
            <p className="text-[1rem] text-foreground/80">
              Làm gần nhất:{" "}
              <span className="font-bold text-navy">
                {formatVnDate(lastDone || todayIso)}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowLastDone((v) => !v)}
            className={`${SQ_BTN} bg-background text-sea`}
          >
            <EditIcon className="h-6 w-6" />
            {showLastDone ? "Thu" : "Sửa"}
          </button>
        </div>
        {showLastDone && (
          <Field label="Làm gần nhất ngày nào?">
            <input
              type="date"
              value={lastDone}
              max={todayIso}
              onChange={(e) => setLastDone(e.target.value)}
              className={inputClass}
            />
          </Field>
        )}

        <div className="mb-3.5 flex items-stretch gap-2">
          <div className="flex min-w-0 flex-1 items-center rounded-2xl bg-background px-3 py-2">
            <p className="truncate text-[1rem] text-foreground/80">
              Ghi chú:{" "}
              <span className="font-bold text-navy">
                {note.trim() || "chưa ghi"}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowNote((v) => !v)}
            className={`${SQ_BTN} bg-background text-sea`}
          >
            <PlusIcon className="h-6 w-6" />
            {showNote ? "Thu" : "Mở"}
          </button>
        </div>
        {showNote && (
          <Field label="Ghi chú thêm">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className={inputClass}
              placeholder="VD: Dùng dầu 15W-40, can 18 lít"
            />
          </Field>
        )}

        {/* Hàng cuối theo khuôn B1 — hai ô nút inline, không dải ngang ăn hàng */}
        <div className="mt-3 flex items-stretch gap-2">
          <div className="flex min-w-0 flex-1 items-center rounded-2xl bg-background px-3 py-2">
            <p className="text-[0.9375rem] text-foreground/70">
              Nhắc lại sau mỗi {Math.max(1, Number(intervalDays) || 60)} ngày.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className={`${SQ_BTN} bg-background text-foreground/70`}
          >
            <CloseIcon className="h-6 w-6" />
            Hủy
          </button>
          <button
            type="submit"
            className={`${SQ_BTN} bg-trim text-white shadow-trim-cta`}
          >
            <CheckIcon className="h-6 w-6" />
            Lưu
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
