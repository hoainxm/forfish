"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertIcon,
  CheckIcon,
  ChevronDownIcon,
  EditIcon,
  PlusIcon,
  TrashIcon,
  WrenchIcon,
} from "@/components/icons";
import { TAU_ACTION as SQ_BTN } from "@/components/tau-ui";
import { LoiO, O_LOI, cuonToiOSai } from "@/components/tau-form";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { StatusBanner } from "@/components/ui/status-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, inputClass } from "@/components/ui/primitives";
import { baoToast } from "@/components/ui/toast";
import { formatVnDate } from "@/lib/format";
import { NHAN } from "@/lib/labels";
import { useXoaCho } from "@/lib/xoa-cho";
import { saveUserJson, storageFullCopy } from "@/lib/user-store";
import { readUserList } from "@/lib/user-list-store";
import { markLocalWrite, USER_SYNC_EVENT } from "@/lib/user-sync";
import { showsUnderBoat } from "@/lib/boats";
import {
  SOON_DAYS_SERVICE,
  addDaysIso,
  daysUntil,
  todayIsoVN,
} from "@/lib/days";
import { useTodayVN } from "@/lib/use-today";
import { useBoats } from "@/components/boat-switcher";

/*
  Nhắc bảo dưỡng — cùng khuôn Tủ giấy tờ để bà con học một lần (03 §0b, TAU-05 2026-10-25):
  · mỗi việc MỘT HÀNG trong `ul.surface divide-y`: tên + tình trạng chữ màu; chạm bung chi tiết
    (chu kỳ, ghi chú) + Sửa · Xoá — một hàng bung một lúc
  · "Xong" (vừa làm hôm nay) là việc bấm nhiều nhất ⇒ ở NGOÀI hàng, như "Gọi" của bạn thuyền
  · thêm/sửa trong ngăn `kieu="form"` có chân Huỷ|Lưu do ngăn vẽ
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
  /** việc đang bung chi tiết — một hàng một lúc */
  const [openId, setOpenId] = useState<string | null>(null);
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
  function commit(next: MaintenanceEntry[]): boolean {
    setEntries(next);
    if (readFailed) return false;
    const ok = saveEntries(next);
    setSaveFailed(!ok);
    return ok;
  }

  // Xoá chờ 5 s + Hoàn tác (TAU-12): hàng biến ngay, ghi máy sau — lib/xoa-cho
  const xoaCho = useXoaCho<MaintenanceEntry>({
    list: entries,
    hien: setEntries,
    ghi: commit,
    ten: (e) => e.item,
  });

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
  const boatEntries = useMemo(() => {
    const known = boatReady ? new Set(boats.map((b) => b.id)) : null;
    return entries.filter((e) => showsUnderBoat(e.boatId, current?.id, known));
  }, [entries, current, boats, boatReady]);

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
    // biên nhận (TAU-12): lastDone đã là hôm nay thì màn không đổi gì — không toast là bấm câm
    if (commit(next)) baoToast("Đã ghi: làm hôm nay");
  }

  return (
    <div className="px-4 pt-1">
      {/* ĐỌC KHÔNG ĐƯỢC — nói thẳng và KHOÁ cửa ghi (T1): thêm việc lúc này là
          ghi đè lên chuỗi gốc còn cứu được, mất cả lịch. */}
      {/*  MỘT HÀNG CHUẨN thay nút cam full-width (2026-08-29, luật A2/A3/B1).
          Chuỗi class cam full-width này từng có 4 bản chép tay (document-vault,
          maintenance-reminders, boat-products, sdvico-request) — sửa một chỗ là
          lệch, nay gom về SQ_BTN dùng chung (nguyên tắc 3). */}
      <div className="tau-section-heading">
        <div className="flex min-w-0 flex-1 items-center rounded-2xl bg-background px-4 py-3">
          <p className="text-[1rem] font-semibold text-navy">
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
            className={`${SQ_BTN} bg-field text-navy`}
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
        <div className="rounded-xl border border-dashed border-line px-4 py-6 text-center">
          <WrenchIcon className="mx-auto h-10 w-10 text-foreground/30" />
          <p className="mt-3 text-[1rem] text-foreground/70">
            Chưa mở được lịch bảo dưỡng trong máy.
            <br />
            Việc cũ chưa mất — xem dải đỏ ở trên.
          </p>
        </div>
      )}

      {/*  MỖI VIỆC MỘT HÀNG (TAU-05, 2026-10-25) — cùng khuôn Tủ giấy tờ: trước mỗi việc là một
          thẻ băng màu đặc + 3 hộp nền + Sửa/Xóa/Xong bày thường trực (230px cho một việc). Nay
          hàng = tên + tình trạng chữ màu (màu luôn kèm chữ) + ▾; "Xong" ngoài hàng; bung ⇒ chu
          kỳ, ghi chú, Sửa · Xoá. Không đổi shape localStorage. */}
      {sorted.length > 0 && (
        <ul className="surface divide-y divide-line overflow-hidden">
          {sorted.map((entry) => {
            const status = getDueStatus(entry, today);
            const tone =
              status.level === "overdue"
                ? "text-danger"
                : status.level === "soon"
                  ? "text-warn"
                  : "text-ok";
            const open = openId === entry.id;
            return (
              <li key={entry.id}>
                <div className="flex min-h-(--h-row) items-center gap-2 px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : entry.id)}
                    aria-expanded={open}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-[1rem] font-semibold leading-snug text-navy">
                        {entry.item}
                      </span>
                      <span className={`mt-0.5 block text-[0.8125rem] leading-snug ${tone}`}>
                        {status.label}
                      </span>
                    </span>
                    <ChevronDownIcon
                      className={`h-4 w-4 shrink-0 text-foreground/40 transition ${open ? "rotate-180" : ""}`}
                    />
                  </button>
                  {/* việc bấm nhiều nhất ⇒ ngoài hàng (03 §0b cho phép, như "Gọi" của bạn thuyền) */}
                  <button
                    type="button"
                    onClick={() => markDoneToday(entry.id)}
                    className={`${SQ_BTN} bg-field text-ok`}
                  >
                    <CheckIcon className="h-4 w-4" />
                    {NHAN.xong}
                  </button>
                </div>

                {open && (
                  <div className="space-y-1.5 bg-background/60 px-4 pb-3 pt-1">
                    <p className="text-[0.875rem] text-foreground/75">
                      Chu kỳ: mỗi {entry.intervalDays} ngày · làm gần nhất{" "}
                      <strong>{formatVnDate(entry.lastDone)}</strong>
                    </p>
                    {entry.note && (
                      <p className="text-[0.875rem] text-foreground/75">{entry.note}</p>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        onClick={() => {
                          setEditing(entry);
                          setShowForm(true);
                        }}
                        className={`${SQ_BTN} bg-field text-navy`}
                      >
                        <EditIcon className="h-4 w-4" />
                        {NHAN.sua}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(entry)}
                        className={`${SQ_BTN} bg-field text-danger`}
                      >
                        <TrashIcon className="h-4 w-4" />
                        {NHAN.xoa}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

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
          title="Xoá nhắc nhở này?"
          message={`“${confirmDelete.item}” sẽ bị xoá khỏi danh sách. Có 5 giây để hoàn tác.`}
          cancelLabel={NHAN.khongXoa}
          confirmLabel={NHAN.xoa}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => {
            xoaCho(confirmDelete.id);
            setConfirmDelete(null);
          }}
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
  /** chu kỳ "Khác" gõ sai (0, âm, chữ) — lỗi đỏ ngay dưới ô, không bong bóng trình duyệt (TAU-03) */
  const [loiChuKy, setLoiChuKy] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  /** Gọi từ Enter trong form (có event) lẫn nút Lưu ở chân ngăn (không event). */
  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const item =
      picked === OTHER ? customItem.trim() || "Việc bảo dưỡng" : picked;
    const interval = Math.round(Number(intervalDays));
    if (!Number.isInteger(interval) || interval < 1) {
      setLoiChuKy("Số ngày phải từ 1 trở lên (VD 45).");
      setCustomInterval(true);
      cuonToiOSai(formRef.current);
      return;
    }
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
      kieu="form"
      title={initial ? "Sửa nhắc nhở bảo dưỡng" : "Thêm nhắc nhở bảo dưỡng"}
      onClose={onCancel}
      /* chân Huỷ|Lưu do ngăn vẽ (TAU-07/TAU-10): Huỷ sau khi gõ hỏi "Bỏ phần đang ghi?" */
      chan={{ luu: NHAN.luu, onLuu: () => submit() }}
    >
      <form ref={formRef} onSubmit={submit} noValidate>
        <Field label="Bà con cần bảo dưỡng gì?">
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
            <option value={OTHER}>Công việc khác</option>
          </select>
        </Field>

        {picked === OTHER && (
          <Field label="Ghi tên công việc">
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
        <Field label="Bao lâu cần làm một lần?">
          <div className="grid grid-cols-5 gap-2">
            {INTERVAL_CHIPS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setIntervalDays(String(d));
                  setCustomInterval(false);
                  setLoiChuKy(null);
                }}
                className={`min-h-[3.25rem] rounded-xl text-[1rem] font-semibold transition active:scale-[0.97] ${
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
              className={`min-h-[3.25rem] rounded-xl text-[1rem] font-semibold transition active:scale-[0.97] ${
                customInterval
                  ? "bg-navy text-white"
                  : "bg-field text-foreground/70"
              }`}
            >
              Khác
            </button>
          </div>
          {customInterval && (
            <>
              <input
                inputMode="numeric"
                value={intervalDays}
                onChange={(e) => {
                  setIntervalDays(e.target.value);
                  setLoiChuKy(null);
                }}
                className={`${inputClass} mt-2 ${loiChuKy ? O_LOI : ""}`}
                aria-label="Số ngày giữa hai lần làm"
                aria-invalid={loiChuKy ? true : undefined}
              />
              {loiChuKy && <LoiO>{loiChuKy}</LoiO>}
            </>
          )}
        </Field>

        {/*  "Làm gần nhất" MÁY ĐÃ ĐIỀN SẴN hôm nay ⇒ dòng đọc-được + ô "Sửa";
            "Ghi chú thêm" là tuỳ chọn ⇒ thu sau ô "Mở" (luật C1). */}
        <div className="mb-3.5 flex items-stretch gap-2">
          <div className="o-chu flex min-w-0 flex-1 items-center rounded-2xl bg-background px-3 py-2">
            <p className="text-[1rem] text-foreground/80">
              Làm gần nhất:{" "}
              <span className="font-semibold text-navy">
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
          <Field label="Lần làm gần nhất là ngày nào?">
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
          <div className="o-chu flex min-w-0 flex-1 items-center rounded-2xl bg-background px-3 py-2">
            <p className="truncate text-[1rem] text-foreground/80">
              Ghi chú:{" "}
              <span className="font-semibold text-navy">
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

        {/* câu nhắc đứng riêng, KHÔNG chen vào hàng nút (TAU-10) */}
        <p className="mt-3 text-[0.875rem] leading-snug text-foreground/70">
          Nhắc lại sau mỗi {Math.max(1, Number(intervalDays) || 60)} ngày.
        </p>
      </form>
    </BottomSheet>
  );
}
