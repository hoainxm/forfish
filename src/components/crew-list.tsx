"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CrewMember,
  CrewRole,
  ROLE_LABELS,
  crewIssue,
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
import {
  CallButton,
  Field,
  inputClass,
  MoneyField,
  PrimaryButton,
} from "@/components/ui/primitives";
import { formatVnd, formatVnDate } from "@/lib/format";
import { isValidVnPhone, sanitizePhoneInput } from "@/lib/phone";

// Thuyền viên là hồ sơ ĐỘNG theo CHỦ TÀU (ba-spec 08 R2): dùng chung cho mọi
// tàu của chủ, KHÔNG gắn boatId, KHÔNG mất khi xóa 1 tàu. (boatId cũ giữ trong
// type cho back-compat dữ liệu cũ nhưng không còn đọc/ghi.)
type StoredCrew = CrewMember & { boatId?: string };

/*
  Sổ thuyền viên — theo nghiên cứu 02-lao-dong-tren-tau.md:
  · hồ sơ tái dùng giữa các chuyến (bạn thuyền đổi liên tục)
  · cảnh báo bảo hiểm/chứng chỉ TRƯỚC khi biên phòng kiểm tra
  · sổ ứng tiền từng người — thay trí nhớ + sổ tay
*/

const STORAGE_KEY = "forfish.crew.v1";

/*
  Sổ thuyền viên THẬT của user — KHÔNG seed demo nữa (data mẫu dùng chung gây
  hiểu nhầm là dữ liệu thật; chức năng này nay khóa sau đăng nhập). Rỗng →
  màn hình "chưa có, bấm thêm".
*/
function loadCrew(): { crew: StoredCrew[]; isDemo: boolean } {
  if (typeof window === "undefined") return { crew: [], isDemo: false };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return { crew: JSON.parse(raw) as StoredCrew[], isDemo: false };
  } catch {
    // hỏng storage — coi như rỗng
  }
  return { crew: [], isDemo: false };
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
  const [isDemo, setIsDemo] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const loaded = loadCrew();
    setCrew(loaded.crew);
    setIsDemo(loaded.isDemo);
    setReady(true);
  }, []);

  // Sổ mẫu sống trong bộ nhớ thôi — chỉ sổ THẬT mới được ghi xuống máy.
  useEffect(() => {
    if (ready && !isDemo) saveCrew(crew);
  }, [crew, ready, isDemo]);

  /** Bỏ sổ mẫu, bắt đầu sổ thật (rỗng hoặc với người đầu tiên). */
  function startRealCrew(next: StoredCrew[]) {
    setIsDemo(false);
    setCrew(next);
  }

  return { today, crew, setCrew, ready, isDemo, startRealCrew };
}

export function CrewList() {
  const { today, crew, setCrew, ready, isDemo, startRealCrew } = useCrew();
  const [editing, setEditing] = useState<StoredCrew | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [advanceFor, setAdvanceFor] = useState<StoredCrew | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<StoredCrew | null>(null);
  // sổ ứng từng người (lịch sử khoản) + xác nhận gạch nợ — roadmap hội đồng
  // UX 2026-06-11: "Đã trừ xong" một chạm settle TẤT CẢ không hoàn tác là
  // tai nạn sổ giấy không bao giờ gặp. Giữ ID, derive từ crew để sheet luôn
  // thấy dữ liệu mới sau khi ghi thêm khoản.
  const [bookForId, setBookForId] = useState<string | null>(null);
  const [confirmSettleId, setConfirmSettleId] = useState<string | null>(null);
  // xem chi tiết hồ sơ một người (BT-003) — giữ ID, derive để luôn thấy bản mới
  const [detailForId, setDetailForId] = useState<string | null>(null);
  const bookFor = crew.find((m) => m.id === bookForId) ?? null;
  const confirmSettle = crew.find((m) => m.id === confirmSettleId) ?? null;
  const detailFor = crew.find((m) => m.id === detailForId) ?? null;

  // Thuyền viên theo CHỦ (ba-spec 08 R2): hiện toàn bộ, không lọc theo tàu.
  const boatCrew = crew;

  // Stats reflect ONLY the current boat's filtered crew. Đếm bằng crewIssue()
  // — bắt cả giấy tờ/bảo hiểm QUÁ HẠN chứ không riêng "chưa có bảo hiểm".
  const issueCount = boatCrew.filter(
    (m) => crewIssue(m, today).level === "danger",
  ).length;
  const totalAdvance = boatCrew.reduce((s, m) => s + outstandingAdvance(m), 0);

  // người có chuyện xếp lên đầu: đỏ → vàng → ổn
  const sortedCrew = useMemo(() => {
    const rank = { danger: 0, warn: 1, ok: 2 } as const;
    return [...boatCrew].sort(
      (a, b) => rank[crewIssue(a, today).level] - rank[crewIssue(b, today).level],
    );
  }, [boatCrew, today]);

  function upsert(m: StoredCrew) {
    const withBoat: StoredCrew = { ...m }; // không gắn boatId — theo chủ (R2)
    // Thêm người THẬT đầu tiên = sổ mẫu nhường chỗ luôn, không lẫn lộn.
    if (isDemo) {
      startRealCrew([withBoat]);
      setShowForm(false);
      setEditing(null);
      return;
    }
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
          <p className="display text-[1.5rem] font-bold text-navy tabular-nums">
            {boatCrew.length}
          </p>
          <p className="text-[0.8125rem] text-foreground/70">Bạn thuyền</p>
        </div>
        <div className="surface py-3 text-center">
          <p
            className={`display text-[1.5rem] font-bold tabular-nums ${issueCount > 0 ? "text-danger" : "text-ok"}`}
          >
            {issueCount}
          </p>
          <p className="text-[0.8125rem] text-foreground/70">Kẹt giấy tờ</p>
        </div>
        <div className="surface py-3 text-center">
          <p className="display text-[1.125rem] font-bold leading-[2] text-navy tabular-nums">
            {formatShortVnd(totalAdvance)}
          </p>
          <p className="text-[0.8125rem] text-foreground/70">Đang ứng</p>
        </div>
      </div>

      <button
        data-tour="them-thuyen-vien"
        onClick={() => {
          setEditing(null);
          setShowForm(true);
        }}
        className="display mb-4 flex min-h-[3.75rem] w-full items-center justify-center gap-2.5 rounded-full bg-trim text-[1.1875rem] font-bold text-white shadow-[0_10px_24px_-8px_rgba(228,87,46,0.55)] transition active:scale-[0.98]"
      >
        <PlusIcon className="h-6 w-6" />
        Thêm bạn thuyền
      </button>

      {ready && isDemo && (
        <div className="mb-4 overflow-hidden surface">
          <StatusBanner level="neutral" icon={<UsersIcon className="h-5 w-5" />}>
            Đây là sổ mẫu cho bà con xem thử — chưa lưu vào máy.
          </StatusBanner>
          <button
            onClick={() => startRealCrew([])}
            className="flex min-h-[3.25rem] w-full items-center justify-center border-t border-line text-[1.0625rem] font-bold text-sea active:bg-background"
          >
            Xóa sổ mẫu, ghi sổ của tôi
          </button>
        </div>
      )}

      {ready && boatCrew.length === 0 && (
        <div className="rounded-[1.25rem] bg-field/70 px-4 py-12 text-center">
          <UsersIcon className="mx-auto h-10 w-10 text-foreground/30" />
          <p className="mt-3 text-[1.125rem] text-foreground/70">
            Chưa có ai trong sổ.
            <br />
            Bấm nút cam ở trên để thêm bạn thuyền.
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {sortedCrew.map((m) => {
          const issue = crewIssue(m, today);
          const owing = outstandingAdvance(m);
          return (
            <li
              key={m.id}
              className="overflow-hidden surface"
            >
              <StatusBanner level={issue.level}>{issue.label}</StatusBanner>

              <div className="px-4 py-3">
                <p className="text-[0.8125rem] font-bold uppercase tracking-wide text-foreground/65">
                  {ROLE_LABELS[m.role]}
                  {m.shares !== 1 && ` · ${m.shares} phần`}
                </p>
                <button
                  type="button"
                  onClick={() => setDetailForId(m.id)}
                  className="flex w-full items-center justify-between gap-2 text-left active:opacity-70"
                >
                  <span className="display text-[1.1875rem] font-bold leading-snug text-navy">
                    {m.name}
                  </span>
                  <span className="shrink-0 text-[0.875rem] font-bold text-sea">
                    Xem chi tiết ›
                  </span>
                </button>
                {m.phone && (
                  <a
                    href={`tel:${m.phone}`}
                    className="inline-flex min-h-[3rem] items-center text-[1rem] font-bold text-sea"
                  >
                    Gọi: {m.phone}
                  </a>
                )}
                {m.certLabel && (
                  <p className="text-[0.9375rem] text-foreground/70">
                    {m.certLabel}
                    {m.certExpiry && ` — hạn ${formatVnDate(m.certExpiry)}`}
                  </p>
                )}
                {owing > 0 && (
                  <div className="mt-1.5 flex items-stretch overflow-hidden rounded-xl bg-background text-[0.9375rem]">
                    {/* chạm là mở SỔ — xem từng khoản, không chỉ con số tổng */}
                    <button
                      onClick={() => setBookForId(m.id)}
                      className="flex min-h-[3.25rem] min-w-0 flex-1 items-center gap-1.5 px-3 text-left active:bg-field"
                    >
                      <span className="min-w-0 truncate">
                        Đang ứng:{" "}
                        <strong className="text-danger">
                          {owing.toLocaleString("vi-VN")} đ
                        </strong>
                      </span>
                      <span className="shrink-0 text-[0.8125rem] font-bold text-sea">
                        Xem sổ
                      </span>
                    </button>
                    <button
                      onClick={() => setConfirmSettleId(m.id)}
                      className="min-h-[3.25rem] shrink-0 border-l border-line px-3 font-bold text-sea active:bg-field"
                    >
                      Đã trừ xong
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 border-t border-line">
                <button
                  onClick={() => setAdvanceFor(m)}
                  className="flex min-h-[3.25rem] items-center justify-center gap-1.5 text-[1rem] font-bold text-t3 active:bg-background"
                >
                  <MoneyHandIcon className="h-5 w-5" />
                  Ứng tiền
                </button>
                <button
                  onClick={() => {
                    setEditing(m);
                    setShowForm(true);
                  }}
                  className="flex min-h-[3.25rem] items-center justify-center gap-1.5 border-l border-line text-[1rem] font-bold text-sea active:bg-background"
                >
                  <EditIcon className="h-5 w-5" />
                  Sửa
                </button>
                <button
                  onClick={() => setConfirmDelete(m)}
                  className="flex min-h-[3.25rem] items-center justify-center gap-1.5 border-l border-line text-[1rem] font-bold text-danger active:bg-background"
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

      {/* sổ ứng từng người — lịch sử khoản, không chỉ một con số */}
      {bookFor && (
        <AdvanceBookSheet
          member={bookFor}
          onAddAdvance={() => {
            setAdvanceFor(bookFor);
          }}
          onSettle={() => setConfirmSettleId(bookFor.id)}
          onClose={() => setBookForId(null)}
        />
      )}

      {/* chi tiết hồ sơ một người (BT-003) — xem đầy đủ, sửa/ứng ngay tại đây */}
      {detailFor && (
        <CrewDetailSheet
          member={detailFor}
          today={today}
          onClose={() => setDetailForId(null)}
          onEdit={() => {
            setEditing(detailFor);
            setShowForm(true);
            setDetailForId(null);
          }}
          onAdvance={() => {
            setAdvanceFor(detailFor);
            setDetailForId(null);
          }}
        />
      )}

      {/* gạch nợ phải XÁC NHẬN, nói rõ số tiền — không một chạm mất sổ */}
      {confirmSettle && (
        <ConfirmDialog
          icon={<MoneyHandIcon className="h-9 w-9 text-sea" />}
          title="Gạch hết nợ ứng?"
          message={`${confirmSettle.name} đang ứng ${formatVnd(outstandingAdvance(confirmSettle))}. Bấm xác nhận nghĩa là khoản này ĐÃ TRỪ vào tiền chia chuyến — không hoàn tác được.`}
          cancelLabel="Thôi, để đó"
          confirmLabel="Đã trừ xong"
          onCancel={() => setConfirmSettleId(null)}
          onConfirm={() => {
            settleAdvances(confirmSettle.id);
            setConfirmSettleId(null);
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          icon={<TrashIcon className="h-9 w-9 text-danger" />}
          title="Xóa khỏi sổ thuyền viên?"
          message={
            outstandingAdvance(confirmDelete) > 0
              ? `“${confirmDelete.name}” ĐANG ỨNG ${formatVnd(outstandingAdvance(confirmDelete))} chưa trừ — xóa là mất luôn ghi nhận khoản này.`
              : `“${confirmDelete.name}” và lịch sử ứng tiền sẽ bị xóa.`
          }
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
  const [cccd, setCccd] = useState(initial?.cccd ?? "");
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

  // SĐT không bắt buộc, nhưng nếu có thì phải đủ số (BT-002 báo cáo test).
  const phoneInvalid = phone.length > 0 && !isValidVnPhone(phone);
  // CCCD không bắt buộc, có thì phải đủ 12 số (BT-003 báo cáo test).
  const cccdInvalid = cccd.length > 0 && cccd.length !== 12;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (phoneInvalid || cccdInvalid) return;
    onSave({
      id: initial?.id ?? `crew-${Date.now()}`,
      name: name.trim(),
      role,
      phone: phone.trim() || undefined,
      cccd: cccd.trim() || undefined,
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
            onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))}
            className={inputClass}
            inputMode="tel"
            placeholder="VD: 0901234567"
          />
          {phoneInvalid && (
            <span className="mt-1.5 block text-[1rem] font-bold text-danger">
              Số điện thoại cần đủ 10 số (VD: 0901234567).
            </span>
          )}
        </Field>

        <Field label="Số căn cước (không cần cũng được)">
          <input
            value={cccd}
            onChange={(e) =>
              setCccd(e.target.value.replace(/\D/g, "").slice(0, 12))
            }
            className={inputClass}
            inputMode="numeric"
            placeholder="12 số sau căn cước công dân"
          />
          {cccdInvalid && (
            <span className="mt-1.5 block text-[1rem] font-bold text-danger">
              Căn cước cần đủ 12 số.
            </span>
          )}
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
              className={`min-h-[3.25rem] rounded-xl text-[1.125rem] font-bold ${
                hasInsurance
                  ? "bg-ok text-white"
                  : "bg-field text-foreground/70"
              }`}
            >
              Có rồi
            </button>
            <button
              type="button"
              onClick={() => setHasInsurance(false)}
              className={`min-h-[3.25rem] rounded-xl text-[1.125rem] font-bold ${
                !hasInsurance
                  ? "bg-danger text-white"
                  : "bg-field text-foreground/70"
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

/** Một dòng nhãn — giá trị trong hồ sơ chi tiết. Giá trị rỗng thì ẩn hẳn. */
function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-line py-2.5">
      <span className="text-[1rem] font-bold text-foreground/65">{label}</span>
      <span className="text-right text-[1.0625rem] font-bold text-navy">
        {value}
      </span>
    </div>
  );
}

/** Hồ sơ CHI TIẾT của một thuyền viên (BT-003) — xem đầy đủ một chỗ, không
 *  phải mở form Sửa mới thấy. Sửa / ứng tiền ngay tại đây. */
function CrewDetailSheet({
  member,
  today,
  onClose,
  onEdit,
  onAdvance,
}: {
  member: CrewMember;
  today: Date;
  onClose: () => void;
  onEdit: () => void;
  onAdvance: () => void;
}) {
  const issue = crewIssue(member, today);
  const owing = outstandingAdvance(member);
  return (
    <BottomSheet title={member.name} onClose={onClose}>
      <div className="overflow-hidden rounded-2xl">
        <StatusBanner level={issue.level}>{issue.label}</StatusBanner>
      </div>

      <div className="mt-2">
        <DetailRow label="Vai trò" value={ROLE_LABELS[member.role]} />
        <DetailRow label="Phần ăn chia" value={`${member.shares} phần`} />
        <DetailRow label="Số điện thoại" value={member.phone} />
        <DetailRow label="Số căn cước" value={member.cccd} />
        <DetailRow
          label="Bảo hiểm"
          value={
            member.hasInsurance
              ? member.insuranceExpiry
                ? `Có — hạn ${formatVnDate(member.insuranceExpiry)}`
                : "Có"
              : "Chưa có"
          }
        />
        <DetailRow label="Văn bằng / chứng chỉ" value={member.certLabel} />
        <DetailRow
          label="Chứng chỉ hết hạn"
          value={member.certExpiry ? formatVnDate(member.certExpiry) : null}
        />
        <DetailRow
          label="Đang ứng"
          value={owing > 0 ? formatVnd(owing) : "Không có"}
        />
        <DetailRow label="Ghi chú" value={member.note} />
      </div>

      {member.phone && (
        <div className="mt-4">
          <CallButton phone={member.phone} label={`Gọi ${member.name}`} />
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onAdvance}
          className="flex min-h-[3.75rem] items-center justify-center gap-2 rounded-full bg-field text-[1.125rem] font-bold text-t3"
        >
          <MoneyHandIcon className="h-5 w-5" />
          Ứng tiền
        </button>
        <PrimaryButton type="button" onClick={onEdit}>
          Sửa hồ sơ
        </PrimaryButton>
      </div>
    </BottomSheet>
  );
}

/** Sổ ứng của một người — LỊCH SỬ từng khoản, không chỉ con số tổng. */
function AdvanceBookSheet({
  member,
  onAddAdvance,
  onSettle,
  onClose,
}: {
  member: CrewMember;
  onAddAdvance: () => void;
  onSettle: () => void;
  onClose: () => void;
}) {
  const owing = outstandingAdvance(member);
  // mới nhất lên đầu — khoản đã trừ mờ đi nhưng vẫn còn đó (sổ là sổ)
  const sorted = [...member.advances].sort((a, b) =>
    a.date === b.date ? b.id.localeCompare(a.id) : b.date < a.date ? -1 : 1,
  );
  return (
    <BottomSheet title={`Sổ ứng của ${member.name}`} onClose={onClose}>
      <div className="mb-3 flex items-baseline justify-between rounded-2xl bg-field px-4 py-3">
        <span className="text-[1rem] font-bold text-navy">Đang ứng</span>
        <span
          className="display text-[1.375rem] font-bold tabular-nums"
          style={{ color: owing > 0 ? "var(--danger)" : "var(--ok)" }}
        >
          {formatVnd(owing)}
        </span>
      </div>

      {sorted.length === 0 ? (
        <p className="rounded-[1.25rem] bg-field/70 px-4 py-8 text-center text-[1rem] text-foreground/70">
          Chưa có khoản ứng nào trong sổ.
        </p>
      ) : (
        <ul className="overflow-hidden surface">
          {sorted.map((a, i) => (
            <li
              key={a.id}
              className={`flex items-center justify-between gap-3 px-4 py-3 ${
                i > 0 ? "border-t border-line" : ""
              } ${a.settled ? "opacity-50" : ""}`}
            >
              <span className="min-w-0">
                <span className="block text-[0.9375rem] font-bold text-foreground/70">
                  Ứng ngày {formatVnDate(a.date)}
                  {a.settled && " — đã trừ"}
                </span>
                {a.note && (
                  <span className="block truncate text-[0.9375rem] text-foreground/70">
                    {a.note}
                  </span>
                )}
              </span>
              <span
                className={`display shrink-0 text-[1.125rem] font-bold tabular-nums ${
                  a.settled ? "text-foreground/65 line-through" : "text-danger"
                }`}
              >
                {a.amountVnd.toLocaleString("vi-VN")} đ
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onAddAdvance}
          className="flex min-h-[3.75rem] items-center justify-center gap-2 rounded-full bg-field text-[1.0625rem] font-bold text-navy"
        >
          <MoneyHandIcon className="h-5 w-5" />
          Ứng thêm
        </button>
        <PrimaryButton onClick={onSettle} disabled={owing <= 0}>
          Đã trừ xong
        </PrimaryButton>
      </div>
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
  const parsed = Number(amount || 0);

  return (
    <BottomSheet title={`Ứng tiền cho ${member.name}`} onClose={onCancel}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (parsed > 0) onSave(parsed, note.trim());
        }}
      >
        <p className="mb-4 -mt-2 text-[0.9375rem] text-foreground/70">
          Khoản ứng sẽ tự trừ khi chia tiền chuyến.
        </p>

        <MoneyField
          label="Số tiền ứng (đồng)"
          digits={amount}
          onDigits={setAmount}
          placeholder="VD: 10.000.000"
        />
        <div className="mb-3 flex gap-2">
          {[5_000_000, 10_000_000, 15_000_000].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setAmount(String(v))}
              className="min-h-[3.25rem] flex-1 rounded-full bg-field text-[1rem] font-bold text-foreground/70 active:bg-line"
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
            className="min-h-[3.75rem] rounded-full bg-field text-[1.125rem] font-bold text-foreground/70"
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
