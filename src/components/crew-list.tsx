"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CrewMember,
  CrewRole,
  ROLE_LABELS,
  crewIssue,
  demoCrew,
  outstandingAdvance,
} from "@/lib/crew";
import {
  AlertIcon,
  CheckIcon,
  ClockIcon,
  EditIcon,
  MoneyHandIcon,
  PlusIcon,
  TrashIcon,
  UsersIcon,
} from "@/components/icons";

/*
  Sổ thuyền viên — theo nghiên cứu 02-lao-dong-tren-tau.md:
  · hồ sơ tái dùng giữa các chuyến (bạn thuyền đổi liên tục)
  · cảnh báo bảo hiểm/chứng chỉ TRƯỚC khi biên phòng kiểm tra
  · sổ ứng tiền từng người — thay trí nhớ + sổ tay
*/

const STORAGE_KEY = "forfish.crew.v1";

function loadCrew(today: Date): CrewMember[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as CrewMember[];
  } catch {
    // hỏng storage — rơi xuống seed demo
  }
  return demoCrew(today);
}

function saveCrew(crew: CrewMember[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(crew));
  } catch {
    // storage đầy — tiếp tục trong bộ nhớ
  }
}

export function useCrew() {
  const today = useMemo(() => new Date(), []);
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setCrew(loadCrew(today));
    setReady(true);
  }, [today]);

  useEffect(() => {
    if (ready) saveCrew(crew);
  }, [crew, ready]);

  return { today, crew, setCrew, ready };
}

const issueStyle = {
  danger: { bg: "var(--danger-bg)", fg: "var(--danger)", Icon: AlertIcon },
  warn: { bg: "var(--warn-bg)", fg: "var(--warn)", Icon: ClockIcon },
  ok: { bg: "var(--ok-bg)", fg: "var(--ok)", Icon: CheckIcon },
} as const;

export function CrewList() {
  const { today, crew, setCrew, ready } = useCrew();
  const [editing, setEditing] = useState<CrewMember | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [advanceFor, setAdvanceFor] = useState<CrewMember | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CrewMember | null>(null);

  const noInsurance = crew.filter((m) => !m.hasInsurance).length;
  const totalAdvance = crew.reduce((s, m) => s + outstandingAdvance(m), 0);

  function upsert(m: CrewMember) {
    setCrew((prev) => {
      const idx = prev.findIndex((x) => x.id === m.id);
      if (idx === -1) return [...prev, m];
      const next = [...prev];
      next[idx] = m;
      return next;
    });
    setShowForm(false);
    setEditing(null);
  }

  function addAdvance(memberId: string, amountVnd: number, note: string) {
    setCrew((prev) =>
      prev.map((m) =>
        m.id === memberId
          ? {
              ...m,
              advances: [
                ...m.advances,
                {
                  id: `adv-${Date.now()}`,
                  date: new Date().toISOString().slice(0, 10),
                  amountVnd,
                  note: note || undefined,
                  settled: false,
                },
              ],
            }
          : m,
      ),
    );
    setAdvanceFor(null);
  }

  function settleAdvances(memberId: string) {
    setCrew((prev) =>
      prev.map((m) =>
        m.id === memberId
          ? {
              ...m,
              advances: m.advances.map((a) => ({ ...a, settled: true })),
            }
          : m,
      ),
    );
  }

  return (
    <div className="px-4 pt-1">
      {/* tổng quan */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-card py-3 text-center shadow-sm ring-1 ring-line">
          <p className="display text-[24px] font-bold text-navy">
            {crew.length}
          </p>
          <p className="text-[13px] text-foreground/55">Bạn thuyền</p>
        </div>
        <div className="rounded-xl bg-card py-3 text-center shadow-sm ring-1 ring-line">
          <p
            className={`display text-[24px] font-bold ${noInsurance > 0 ? "text-danger" : "text-ok"}`}
          >
            {noInsurance}
          </p>
          <p className="text-[13px] text-foreground/55">Chưa bảo hiểm</p>
        </div>
        <div className="rounded-xl bg-card py-3 text-center shadow-sm ring-1 ring-line">
          <p className="display text-[17px] font-bold leading-[2] text-navy">
            {formatShortVnd(totalAdvance)}
          </p>
          <p className="text-[13px] text-foreground/55">Đang ứng</p>
        </div>
      </div>

      <button
        onClick={() => {
          setEditing(null);
          setShowForm(true);
        }}
        className="display mb-4 flex min-h-[60px] w-full items-center justify-center gap-2.5 rounded-xl bg-trim text-[19px] font-bold text-white shadow-sm transition active:scale-[0.98]"
      >
        <PlusIcon className="h-6 w-6" />
        Thêm bạn thuyền
      </button>

      {ready && crew.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-line bg-card px-4 py-12 text-center">
          <UsersIcon className="mx-auto h-10 w-10 text-foreground/30" />
          <p className="mt-3 text-[17px] text-foreground/60">
            Chưa có ai trong sổ.
            <br />
            Bấm nút cam ở trên để thêm bạn thuyền.
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {crew.map((m) => {
          const issue = crewIssue(m, today);
          const st = issueStyle[issue.level];
          const owing = outstandingAdvance(m);
          return (
            <li
              key={m.id}
              className="overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-line"
            >
              <p
                className="flex items-center gap-2 px-4 py-2.5 text-[16px] font-bold"
                style={{ backgroundColor: st.bg, color: st.fg }}
              >
                <st.Icon className="h-5 w-5 shrink-0" />
                {issue.label}
              </p>

              <div className="px-4 py-3">
                <p className="text-[13px] font-bold uppercase tracking-wide text-foreground/40">
                  {ROLE_LABELS[m.role]}
                  {m.shares !== 1 && ` · ${m.shares} phần`}
                </p>
                <p className="display text-[19px] font-bold leading-snug text-navy">
                  {m.name}
                </p>
                {m.phone && (
                  <a
                    href={`tel:${m.phone}`}
                    className="text-[16px] font-semibold text-sea"
                  >
                    Gọi: {m.phone}
                  </a>
                )}
                {m.certLabel && (
                  <p className="text-[15px] text-foreground/60">
                    {m.certLabel}
                    {m.certExpiry && ` — hạn ${formatVnDate(m.certExpiry)}`}
                  </p>
                )}
                {owing > 0 && (
                  <p className="mt-1.5 flex items-center justify-between rounded-lg bg-background px-3 py-2 text-[15px]">
                    <span>
                      Đang ứng:{" "}
                      <strong className="text-danger">
                        {owing.toLocaleString("vi-VN")} đ
                      </strong>
                    </span>
                    <button
                      onClick={() => settleAdvances(m.id)}
                      className="font-bold text-sea"
                    >
                      Đã trừ xong
                    </button>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-3 border-t border-line">
                <button
                  onClick={() => setAdvanceFor(m)}
                  className="flex min-h-[52px] items-center justify-center gap-1.5 text-[16px] font-bold text-t3 active:bg-background"
                >
                  <MoneyHandIcon className="h-5 w-5" />
                  Ứng tiền
                </button>
                <button
                  onClick={() => {
                    setEditing(m);
                    setShowForm(true);
                  }}
                  className="flex min-h-[52px] items-center justify-center gap-1.5 border-l border-line text-[16px] font-bold text-sea active:bg-background"
                >
                  <EditIcon className="h-5 w-5" />
                  Sửa
                </button>
                <button
                  onClick={() => setConfirmDelete(m)}
                  className="flex min-h-[52px] items-center justify-center gap-1.5 border-l border-line text-[16px] font-bold text-danger active:bg-background"
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
        Sổ thuyền viên lưu ngay trên máy của bà con.
      </p>

      {showForm && (
        <CrewForm
          initial={editing}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSave={upsert}
        />
      )}

      {advanceFor && (
        <AdvanceForm
          member={advanceFor}
          onCancel={() => setAdvanceFor(null)}
          onSave={(amount, note) => addAdvance(advanceFor.id, amount, note)}
        />
      )}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 px-6"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="w-full max-w-[400px] rounded-xl bg-card p-5 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <TrashIcon className="mx-auto h-9 w-9 text-danger" />
            <p className="display mt-3 text-[20px] font-bold text-navy">
              Xóa khỏi sổ thuyền viên?
            </p>
            <p className="mt-1 text-[16px] text-foreground/60">
              “{confirmDelete.name}” và lịch sử ứng tiền sẽ bị xóa.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="min-h-[56px] rounded-lg border-2 border-line text-[17px] font-bold text-foreground/70"
              >
                Không xóa
              </button>
              <button
                onClick={() => {
                  setCrew((prev) =>
                    prev.filter((x) => x.id !== confirmDelete.id),
                  );
                  setConfirmDelete(null);
                }}
                className="min-h-[56px] rounded-lg bg-danger text-[17px] font-bold text-white"
              >
                Xóa luôn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CrewForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: CrewMember | null;
  onCancel: () => void;
  onSave: (m: CrewMember) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [role, setRole] = useState<CrewRole>(initial?.role ?? "thuyen_vien");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [shares, setShares] = useState(String(initial?.shares ?? 1));
  const [hasInsurance, setHasInsurance] = useState(
    initial?.hasInsurance ?? false,
  );
  const [insuranceExpiry, setInsuranceExpiry] = useState(
    initial?.insuranceExpiry ?? "",
  );
  const [certLabel, setCertLabel] = useState(initial?.certLabel ?? "");
  const [certExpiry, setCertExpiry] = useState(initial?.certExpiry ?? "");

  const needsCert = role !== "thuyen_vien";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      id: initial?.id ?? `crew-${Date.now()}`,
      name: name.trim(),
      role,
      phone: phone.trim() || undefined,
      shares: Math.max(0.5, parseFloat(shares) || 1),
      hasInsurance,
      insuranceExpiry: hasInsurance && insuranceExpiry ? insuranceExpiry : undefined,
      certLabel: needsCert && certLabel.trim() ? certLabel.trim() : undefined,
      certExpiry: needsCert && certExpiry ? certExpiry : undefined,
      note: initial?.note,
      advances: initial?.advances ?? [],
    });
  }

  const inputCls =
    "w-full rounded-lg border-2 border-line bg-card px-4 py-3.5 text-[17px] focus:border-sea focus:outline-none";

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/50"
      onClick={onCancel}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="max-h-[92dvh] w-full max-w-[480px] overflow-y-auto rounded-t-2xl bg-background p-5 pb-8"
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line" />
        <h3 className="display mb-4 text-[21px] font-bold text-navy">
          {initial ? "Sửa thông tin bạn thuyền" : "Thêm bạn thuyền"}
        </h3>

        <Field label="Tên (bắt buộc)">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
            placeholder="VD: Nguyễn Văn Hai"
            required
          />
        </Field>

        <Field label="Làm việc gì trên tàu?">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as CrewRole)}
            className={inputCls}
          >
            {(
              Object.entries(ROLE_LABELS) as [CrewRole, string][]
            ).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Số điện thoại">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputCls}
            inputMode="tel"
            placeholder="VD: 0901234567"
          />
        </Field>

        <Field label="Mấy phần khi ăn chia? (bạn thường 1, tài công 1.5–2)">
          <input
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            className={inputCls}
            inputMode="decimal"
          />
        </Field>

        <Field label="Bảo hiểm thuyền viên">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setHasInsurance(true)}
              className={`min-h-[52px] rounded-lg text-[17px] font-bold ${
                hasInsurance
                  ? "bg-ok text-white"
                  : "border-2 border-line text-foreground/60"
              }`}
            >
              Có rồi
            </button>
            <button
              type="button"
              onClick={() => setHasInsurance(false)}
              className={`min-h-[52px] rounded-lg text-[17px] font-bold ${
                !hasInsurance
                  ? "bg-danger text-white"
                  : "border-2 border-line text-foreground/60"
              }`}
            >
              Chưa có
            </button>
          </div>
        </Field>

        {hasInsurance && (
          <Field label="Bảo hiểm hết hạn ngày nào?">
            <input
              type="date"
              value={insuranceExpiry}
              onChange={(e) => setInsuranceExpiry(e.target.value)}
              className={inputCls}
            />
          </Field>
        )}

        {needsCert && (
          <>
            <Field label="Văn bằng / chứng chỉ">
              <input
                value={certLabel}
                onChange={(e) => setCertLabel(e.target.value)}
                className={inputCls}
                placeholder={
                  role === "thuyen_truong"
                    ? "VD: Thuyền trưởng hạng II"
                    : "VD: Máy trưởng hạng II"
                }
              />
            </Field>
            <Field label="Chứng chỉ hết hạn ngày nào?">
              <input
                type="date"
                value={certExpiry}
                onChange={(e) => setCertExpiry(e.target.value)}
                className={inputCls}
              />
            </Field>
          </>
        )}

        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[60px] rounded-lg border-2 border-line text-[18px] font-bold text-foreground/70"
          >
            Hủy
          </button>
          <button
            type="submit"
            className="display min-h-[60px] rounded-lg bg-trim text-[18px] font-bold text-white shadow-sm active:scale-[0.98]"
          >
            Lưu lại
          </button>
        </div>
      </form>
    </div>
  );
}

function AdvanceForm({
  member,
  onCancel,
  onSave,
}: {
  member: CrewMember;
  onCancel: () => void;
  onSave: (amountVnd: number, note: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const parsed = parseInt(amount.replace(/\D/g, ""), 10) || 0;

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/50"
      onClick={onCancel}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (parsed > 0) onSave(parsed, note.trim());
        }}
        className="w-full max-w-[480px] rounded-t-2xl bg-background p-5 pb-8"
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line" />
        <h3 className="display mb-1 text-[21px] font-bold text-navy">
          Ứng tiền cho {member.name}
        </h3>
        <p className="mb-4 text-[15px] text-foreground/60">
          Khoản ứng sẽ tự trừ khi chia tiền chuyến.
        </p>

        <Field label="Số tiền ứng (đồng)">
          <input
            value={parsed ? parsed.toLocaleString("vi-VN") : amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border-2 border-line bg-card px-4 py-3.5 text-[20px] font-bold focus:border-sea focus:outline-none"
            inputMode="numeric"
            placeholder="VD: 10.000.000"
            required
          />
        </Field>
        <div className="mb-3 flex gap-2">
          {[5_000_000, 10_000_000, 15_000_000].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setAmount(String(v))}
              className="min-h-[44px] flex-1 rounded-lg border-2 border-line text-[15px] font-bold text-foreground/70"
            >
              {v / 1_000_000} triệu
            </button>
          ))}
        </div>

        <Field label="Ghi chú">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-lg border-2 border-line bg-card px-4 py-3.5 text-[17px] focus:border-sea focus:outline-none"
            placeholder="VD: Ứng trước chuyến tháng 6"
          />
        </Field>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[60px] rounded-lg border-2 border-line text-[18px] font-bold text-foreground/70"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={parsed <= 0}
            className="display min-h-[60px] rounded-lg bg-trim text-[18px] font-bold text-white shadow-sm active:scale-[0.98] disabled:opacity-40"
          >
            Ghi khoản ứng
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="mb-3.5 block">
      <span className="mb-1.5 block text-[16px] font-bold text-navy">
        {label}
      </span>
      {children}
    </label>
  );
}

function formatVnDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function formatShortVnd(v: number): string {
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    return `${m % 1 === 0 ? m : m.toFixed(1)} tr`;
  }
  return v.toLocaleString("vi-VN");
}
