"use client";

import { useEffect, useMemo, useState } from "react";
import {
  balanceOf,
  totalOutstanding,
  totalPaid,
  demoDebts,
  CREDITOR_KIND_LABELS,
  type Creditor,
  type CreditorKind,
  type DebtEntry,
} from "@/lib/debts";
import {
  CalendarIcon,
  EditIcon,
  MoneyHandIcon,
  PlusIcon,
  PriceIcon,
  TrashIcon,
} from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { StatusBanner } from "@/components/ui/status-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  CallButton,
  Card,
  Field,
  inputClass,
  MoneyField,
  PrimaryButton,
  RefNote,
} from "@/components/ui/primitives";
import { formatVnd, formatVnDate } from "@/lib/format";

/*
  SỔ CÔNG NỢ ĐA ĐỐI TƯỢNG (A3) — mỗi chủ nợ (đại lý dầu / nậu / ngân hàng)
  một dư nợ + lịch sử vay/trả. Minh bạch hoá để bà con không bị trừ oan, KHÔNG
  thay thế nậu. localStorage forfish.debts.v1; sổ MẪU tự xưng là mẫu, không
  ghi xuống máy (như sổ thuyền viên — 02-architecture §4). Logic ở lib/debts.ts.
*/

const STORAGE_KEY = "forfish.debts.v1";

const KIND_OPTIONS = Object.entries(CREDITOR_KIND_LABELS) as [
  CreditorKind,
  string,
][];

function loadDebts(today: Date): { creditors: Creditor[]; isDemo: boolean } {
  if (typeof window === "undefined")
    return { creditors: [], isDemo: false };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw)
      return { creditors: JSON.parse(raw) as Creditor[], isDemo: false };
  } catch {
    // hỏng storage — rơi xuống seed demo
  }
  return { creditors: demoDebts(today), isDemo: true };
}

function saveDebts(creditors: Creditor[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(creditors));
  } catch {
    // storage đầy — tiếp tục trong bộ nhớ
  }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DebtLedger() {
  const today = useMemo(() => new Date(), []);
  const [creditors, setCreditors] = useState<Creditor[]>([]);
  const [isDemo, setIsDemo] = useState(false);
  const [ready, setReady] = useState(false);

  const [editing, setEditing] = useState<Creditor | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [bookForId, setBookForId] = useState<string | null>(null);
  const [addEntryFor, setAddEntryFor] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Creditor | null>(null);

  useEffect(() => {
    const loaded = loadDebts(today);
    setCreditors(loaded.creditors);
    setIsDemo(loaded.isDemo);
    setReady(true);
  }, [today]);

  // Sổ mẫu sống trong bộ nhớ thôi — chỉ sổ THẬT mới ghi xuống máy.
  useEffect(() => {
    if (ready && !isDemo) saveDebts(creditors);
  }, [creditors, ready, isDemo]);

  const total = useMemo(() => totalOutstanding(creditors), [creditors]);
  // derive từ state để sheet luôn thấy khoản mới ghi
  const bookFor = creditors.find((c) => c.id === bookForId) ?? null;

  function startReal(next: Creditor[]) {
    setIsDemo(false);
    setCreditors(next);
  }

  function upsertCreditor(c: Creditor) {
    if (isDemo) {
      startReal([c]);
    } else {
      setCreditors((prev) => {
        const idx = prev.findIndex((x) => x.id === c.id);
        if (idx === -1) return [...prev, c];
        const next = [...prev];
        next[idx] = c;
        return next;
      });
    }
    setShowForm(false);
    setEditing(null);
  }

  function addEntry(creditorId: string, entry: DebtEntry) {
    setCreditors((prev) =>
      prev.map((c) =>
        c.id === creditorId
          ? { ...c, entries: [...c.entries, entry] }
          : c,
      ),
    );
    setAddEntryFor(null);
  }

  function removeCreditor(id: string) {
    setCreditors((prev) => prev.filter((c) => c.id !== id));
    setConfirmDelete(null);
    if (bookForId === id) setBookForId(null);
  }

  return (
    <div>
      {/* Tổng dư nợ */}
      {ready && creditors.length > 0 && (
        <div className="mb-4 px-4">
          <Card className="p-4">
            <p className="text-[0.8125rem] font-bold uppercase tracking-wide text-foreground/65">
              Đang nợ {creditors.length} chủ nợ
            </p>
            <p
              className="display mt-1 text-[1.875rem] font-bold leading-tight tabular-nums"
              style={{ color: total > 0 ? "var(--danger)" : "var(--ok)" }}
            >
              {formatVnd(total)}
            </p>
            <p className="text-[0.875rem] text-foreground/70">
              tổng dư nợ còn lại
            </p>
          </Card>
        </div>
      )}

      {isDemo && ready && (
        <div className="mb-3">
          <StatusBanner level="neutral" icon={null}>
            Đây là sổ mẫu cho dễ hình dung. Ghi chủ nợ thật đầu tiên là sổ
            mẫu tự thay.
          </StatusBanner>
          <div className="px-4 pt-2">
            <button
              onClick={() => startReal([])}
              className="text-[0.9375rem] font-bold text-t2 underline"
            >
              Xóa sổ mẫu, ghi sổ của tôi
            </button>
          </div>
        </div>
      )}

      <div className="px-4">
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="display mb-4 flex min-h-[3.75rem] w-full items-center justify-center gap-2.5 rounded-full bg-trim text-[1.1875rem] font-bold text-white shadow-[0_10px_24px_-8px_rgba(228,87,46,0.55)] transition active:scale-[0.98]"
        >
          <PlusIcon className="h-6 w-6" />
          Thêm chủ nợ
        </button>

        {ready && creditors.length === 0 && (
          <div className="rounded-[1.25rem] bg-field/70 px-4 py-12 text-center">
            <PriceIcon className="mx-auto h-10 w-10 text-foreground/30" />
            <p className="mt-3 text-[1.125rem] text-foreground/70">
              Chưa có chủ nợ nào trong sổ.
              <br />
              Bấm nút cam để ghi đại lý dầu, nậu hay khoản vay.
            </p>
          </div>
        )}

        <ul className="space-y-3">
          {creditors.map((c) => {
            const bal = balanceOf(c);
            return (
              <li key={c.id} className="overflow-hidden surface">
                <div className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="display text-[1.1875rem] font-bold leading-snug text-navy">
                        {c.name}
                      </p>
                      <p className="text-[0.9375rem] font-semibold text-foreground/65">
                        {CREDITOR_KIND_LABELS[c.kind]}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className="display text-[1.375rem] font-bold leading-tight tabular-nums"
                        style={{
                          color: bal > 0 ? "var(--danger)" : "var(--ok)",
                        }}
                      >
                        {formatVnd(bal)}
                      </p>
                      <p className="text-[0.8125rem] text-foreground/65">
                        {bal > 0 ? "còn nợ" : bal < 0 ? "trả dư" : "đã xong"}
                      </p>
                    </div>
                  </div>
                  {c.phone && (
                    <div className="mt-2">
                      <CallButton phone={c.phone} />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 border-t border-line">
                  <button
                    onClick={() => setBookForId(c.id)}
                    className="flex min-h-[3.25rem] items-center justify-center gap-1.5 text-[1.0625rem] font-bold text-t2 active:bg-background"
                  >
                    <MoneyHandIcon className="h-5 w-5" />
                    Sổ nợ
                  </button>
                  <button
                    onClick={() => {
                      setEditing(c);
                      setShowForm(true);
                    }}
                    className="flex min-h-[3.25rem] items-center justify-center gap-2 border-l border-line text-[1.0625rem] font-bold text-sea active:bg-background"
                  >
                    <EditIcon className="h-5 w-5" />
                    Sửa
                  </button>
                  <button
                    onClick={() => setConfirmDelete(c)}
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

        <div className="mt-4">
          <RefNote tone="var(--t2)" bg="var(--t2-bg)">
            Sổ ghi tay trên máy bà con — giúp nhớ nợ ai bao nhiêu, đối chiếu
            khi bán cá để không bị trừ oan. Không thay sổ của đại lý/nậu.
          </RefNote>
        </div>
      </div>

      {showForm && (
        <CreditorForm
          initial={editing}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSave={upsertCreditor}
        />
      )}

      {bookFor && (
        <DebtBook
          creditor={bookFor}
          onClose={() => setBookForId(null)}
          onAddEntry={() => setAddEntryFor(bookFor.id)}
        />
      )}

      {addEntryFor && (
        <EntryForm
          onCancel={() => setAddEntryFor(null)}
          onSave={(entry) => addEntry(addEntryFor, entry)}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          icon={<TrashIcon className="h-9 w-9 text-danger" />}
          title="Xóa chủ nợ này khỏi sổ?"
          message={`${confirmDelete.name} cùng toàn bộ lịch sử vay/trả sẽ bị xóa, không lấy lại được.`}
          cancelLabel="Không xóa"
          confirmLabel="Xóa luôn"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => removeCreditor(confirmDelete.id)}
        />
      )}
    </div>
  );
}

/* ---------- form chủ nợ ---------- */

function CreditorForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: Creditor | null;
  onCancel: () => void;
  onSave: (c: Creditor) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState<CreditorKind>(initial?.kind ?? "dai-ly-dau");
  const [phone, setPhone] = useState(initial?.phone ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      id: initial?.id ?? `cred-${Date.now()}`,
      name: name.trim(),
      kind,
      phone: phone.trim() || undefined,
      entries: initial?.entries ?? [],
    });
  }

  return (
    <BottomSheet
      title={initial ? "Sửa chủ nợ" : "Thêm chủ nợ"}
      onClose={onCancel}
    >
      <form onSubmit={submit}>
        <Field label="Tên chủ nợ">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="VD: Đại lý dầu Tư Mạnh"
          />
        </Field>

        <Field label="Loại">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as CreditorKind)}
            className={inputClass}
          >
            {KIND_OPTIONS.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Số điện thoại (không cần cũng được)">
          <input
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
            placeholder="VD: 0905 111 222"
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

/* ---------- sổ nợ (lịch sử + nút ghi khoản) ---------- */

function DebtBook({
  creditor,
  onClose,
  onAddEntry,
}: {
  creditor: Creditor;
  onClose: () => void;
  onAddEntry: () => void;
}) {
  const bal = balanceOf(creditor);
  const paid = totalPaid(creditor);
  const sorted = [...creditor.entries].sort((a, b) =>
    a.date === b.date ? b.id.localeCompare(a.id) : b.date < a.date ? -1 : 1,
  );

  return (
    <BottomSheet title={`Sổ nợ — ${creditor.name}`} onClose={onClose}>
      <div className="mb-3 rounded-2xl bg-field px-4 py-3">
        <p className="flex items-baseline justify-between">
          <span className="text-[1rem] font-bold text-foreground/70">
            Còn nợ
          </span>
          <span
            className="display text-[1.5rem] font-bold tabular-nums"
            style={{ color: bal > 0 ? "var(--danger)" : "var(--ok)" }}
          >
            {formatVnd(bal)}
          </span>
        </p>
        {paid > 0 && (
          <p className="mt-0.5 text-[0.9375rem] text-foreground/65 tabular-nums">
            Đã trả {formatVnd(paid)}
          </p>
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="py-6 text-center text-[1rem] text-foreground/65">
          Chưa có khoản nào. Bấm nút dưới để ghi khoản vay hoặc trả.
        </p>
      ) : (
        <ul className="mb-3 space-y-2">
          {sorted.map((e) => {
            const isVay = e.type === "vay";
            return (
              <li
                key={e.id}
                className="flex items-center gap-3 rounded-xl bg-field px-3 py-2.5"
              >
                <CalendarIcon className="h-5 w-5 shrink-0 text-foreground/40" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.9375rem] font-semibold text-navy">
                    {isVay ? "Vay / nợ thêm" : "Trả bớt"}
                    {" · "}
                    {formatVnDate(e.date)}
                  </span>
                  {e.note && (
                    <span className="block text-[0.875rem] leading-snug text-foreground/65">
                      {e.note}
                    </span>
                  )}
                </span>
                <span
                  className="display shrink-0 text-[1.0625rem] font-bold tabular-nums"
                  style={{ color: isVay ? "var(--danger)" : "var(--ok)" }}
                >
                  {isVay ? "+" : "−"}
                  {formatVnd(e.amountVnd)}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <PrimaryButton onClick={onAddEntry}>
        <PlusIcon className="h-6 w-6" />
        Ghi khoản mới
      </PrimaryButton>
    </BottomSheet>
  );
}

/* ---------- form ghi khoản vay/trả ---------- */

function EntryForm({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave: (entry: DebtEntry) => void;
}) {
  const [type, setType] = useState<"vay" | "tra">("vay");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount || 0);
    if (amt <= 0) return;
    onSave({
      id: `de-${Date.now()}`,
      date: date || todayIso(),
      type,
      amountVnd: amt,
      note: note.trim() || undefined,
    });
  }

  return (
    <BottomSheet title="Ghi khoản" onClose={onCancel}>
      <form onSubmit={submit}>
        <Field label="Khoản này là">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["vay", "Vay / nợ thêm"],
                ["tra", "Trả bớt"],
              ] as const
            ).map(([id, label]) => {
              const on = type === id;
              const tone = id === "vay" ? "var(--danger)" : "var(--ok)";
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setType(id)}
                  aria-pressed={on}
                  className="min-h-[3.5rem] rounded-2xl text-[1.0625rem] font-bold transition active:scale-[0.98]"
                  style={
                    on
                      ? { backgroundColor: tone, color: "#fff" }
                      : {
                          backgroundColor: "var(--field)",
                          color: "var(--foreground)",
                        }
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
        </Field>

        <MoneyField
          label="Số tiền (đồng)"
          digits={amount}
          onDigits={setAmount}
          placeholder="VD: 20.000.000"
        />

        <Field label="Ngày">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Ghi chú thêm">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={inputClass}
            placeholder="VD: Đổ dầu chuyến trăng"
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
          <PrimaryButton type="submit">Lưu khoản</PrimaryButton>
        </div>
      </form>
    </BottomSheet>
  );
}
