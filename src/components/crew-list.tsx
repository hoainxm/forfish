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
  EditIcon,
  MoneyHandIcon,
  PlusIcon,
  TrashIcon,
  UsersIcon,
} from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { StatusBanner } from "@/components/ui/status-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, inputClass, PrimaryButton } from "@/components/ui/primitives";
import { formatVnDate } from "@/lib/format";
import { useBoats } from "@/components/boat-switcher";

// CrewMember lives in @/lib/crew (shared). We attach a boat dimension here
// without editing that file: localStorage is freeform JSON so an extra
// `boatId` field rides along fine.
type StoredCrew = CrewMember & { boatId?: string };

/*
  Sổ thuyền viên — theo nghiên cứu 02-lao-dong-tren-tau.md:
  · hồ sơ tái dùng giữa các chuyến (bạn thuyền đổi liên tục)
  · cảnh báo bảo hiểm/chứng chỉ TRƯỚC khi biên phòng kiểm tra
  · sổ ứng tiền từng người — thay trí nhớ + sổ tay
*/

const STORAGE_KEY = "forfish.crew.v1";

function loadCrew(today: Date): StoredCrew[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as StoredCrew[];
  } catch {
    // hỏng storage — rơi xuống seed demo
  }
  return demoCrew(today);
}

function saveCrew(crew: StoredCrew[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(crew));
  } catch {
    // storage đầy — tiếp tục trong bộ nhớ
  }
}

export function useCrew() {
  const today = useMemo(() => new Date(), []);
  const [crew, setCrew] = useState<StoredCrew[]>([]);
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

export function CrewList() {
  const { today, crew, setCrew, ready } = useCrew();
  const { current, ready: boatReady } = useBoats();
  const [editing, setEditing] = useState<StoredCrew | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [advanceFor, setAdvanceFor] = useState<StoredCrew | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<StoredCrew | null>(null);

  // Only this boat's crew. Legacy members with no boatId belong to the
  // current boat for back-compat.
  const boatCrew = useMemo(
    () => crew.filter((m) => m.boatId === current?.id || m.boatId == null),
    [crew, current],
  );

  // Stats reflect ONLY the current boat's filtered crew.
  const noInsurance = boatCrew.filter((m) => !m.hasInsurance).length;
  const totalAdvance = boatCrew.reduce((s, m) => s + outstandingAdvance(m), 0);

  function upsert(m: StoredCrew) {
    const withBoat: StoredCrew = { ...m, boatId: current?.id };
    setCrew((prev) => {
      const idx = prev.findIndex((x) => x.id === withBoat.id);
      if (idx === -1) return [...prev, withBoat];
      const next = [...prev];
      next[idx] = withBoat;
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
        <div className="surface py-3 text-center">
          <p className="display text-[24px] font-bold text-navy">
            {boatCrew.length}
          </p>
          <p className="text-[13px] text-foreground/55">Bạn thuyền</p>
        </div>
        <div className="surface py-3 text-center">
          <p
            className={`display text-[24px] font-bold ${noInsurance > 0 ? "text-danger" : "text-ok"}`}
          >
            {noInsurance}
          </p>
          <p className="text-[13px] text-foreground/55">Chưa bảo hiểm</p>
        </div>
        <div className="surface py-3 text-center">
          <p className="display text-[18px] font-bold leading-[2] text-navy">
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
        className="display mb-4 flex min-h-[60px] w-full items-center justify-center gap-2.5 rounded-full bg-trim text-[19px] font-bold text-white shadow-[0_10px_24px_-8px_rgba(228,87,46,0.55)] transition active:scale-[0.98]"
      >
        <PlusIcon className="h-6 w-6" />
        Thêm bạn thuyền
      </button>

      {ready && boatReady && boatCrew.length === 0 && (
        <div className="rounded-[20px] bg-field/70 px-4 py-12 text-center">
          <UsersIcon className="mx-auto h-10 w-10 text-foreground/30" />
          <p className="mt-3 text-[18px] text-foreground/60">
            Chưa có ai trong sổ.
            <br />
            Bấm nút cam ở trên để thêm bạn thuyền.
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {boatCrew.map((m) => {
          const issue = crewIssue(m, today);
          const owing = outstandingAdvance(m);
          return (
            <li
              key={m.id}
              className="overflow-hidden surface"
            >
              <StatusBanner level={issue.level}>{issue.label}</StatusBanner>

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
                  <p className="mt-1.5 flex items-center justify-between rounded-xl bg-background px-3 py-2 text-[15px]">
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
        <ConfirmDialog
          icon={<TrashIcon className="h-9 w-9 text-danger" />}
          title="Xóa khỏi sổ thuyền viên?"
          message={`“${confirmDelete.name}” và lịch sử ứng tiền sẽ bị xóa.`}
          cancelLabel="Không xóa"
          confirmLabel="Xóa luôn"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => {
            setCrew((prev) => prev.filter((x) => x.id !== confirmDelete.id));
            setConfirmDelete(null);
          }}
        />
      )}
    </div>
  );
}

function CrewForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: StoredCrew | null;
  onCancel: () => void;
  onSave: (m: StoredCrew) => void;
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

  return (
    <BottomSheet
      title={initial ? "Sửa thông tin bạn thuyền" : "Thêm bạn thuyền"}
      onClose={onCancel}
    >
      <form onSubmit={submit}>
        <Field label="Tên (bắt buộc)">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="VD: Nguyễn Văn Hai"
            required
          />
        </Field>

        <Field label="Làm việc gì trên tàu?">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as CrewRole)}
            className={inputClass}
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
            className={inputClass}
            inputMode="tel"
            placeholder="VD: 0901234567"
          />
        </Field>

        <Field label="Mấy phần khi ăn chia? (bạn thường 1, tài công 1.5–2)">
          <input
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            className={inputClass}
            inputMode="decimal"
          />
        </Field>

        <Field label="Bảo hiểm thuyền viên">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setHasInsurance(true)}
              className={`min-h-[52px] rounded-xl text-[18px] font-bold ${
                hasInsurance
                  ? "bg-ok text-white"
                  : "bg-field text-foreground/60"
              }`}
            >
              Có rồi
            </button>
            <button
              type="button"
              onClick={() => setHasInsurance(false)}
              className={`min-h-[52px] rounded-xl text-[18px] font-bold ${
                !hasInsurance
                  ? "bg-danger text-white"
                  : "bg-field text-foreground/60"
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
              className={inputClass}
            />
          </Field>
        )}

        {needsCert && (
          <>
            <Field label="Văn bằng / chứng chỉ">
              <input
                value={certLabel}
                onChange={(e) => setCertLabel(e.target.value)}
                className={inputClass}
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
                className={inputClass}
              />
            </Field>
          </>
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
    <BottomSheet title={`Ứng tiền cho ${member.name}`} onClose={onCancel}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (parsed > 0) onSave(parsed, note.trim());
        }}
      >
        <p className="mb-4 -mt-2 text-[15px] text-foreground/60">
          Khoản ứng sẽ tự trừ khi chia tiền chuyến.
        </p>

        <Field label="Số tiền ứng (đồng)">
          <input
            value={parsed ? parsed.toLocaleString("vi-VN") : amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-2xl border-0 bg-field px-4 py-3.5 text-[20px] font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea"
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
              className="min-h-[44px] flex-1 rounded-full bg-field text-[15px] font-bold text-foreground/70"
            >
              {v / 1_000_000} triệu
            </button>
          ))}
        </div>

        <Field label="Ghi chú">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={inputClass}
            placeholder="VD: Ứng trước chuyến tháng 6"
          />
        </Field>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[60px] rounded-full bg-field text-[18px] font-bold text-foreground/70"
          >
            Hủy
          </button>
          <PrimaryButton type="submit" disabled={parsed <= 0}>
            Ghi khoản ứng
          </PrimaryButton>
        </div>
      </form>
    </BottomSheet>
  );
}

function formatShortVnd(v: number): string {
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    return `${m % 1 === 0 ? m : m.toFixed(1)} tr`;
  }
  return v.toLocaleString("vi-VN");
}
