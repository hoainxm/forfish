"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CrewMember,
  CrewRole,
  ROLE_LABELS,
  crewIssue,
  demoCrew,
  formatCccd,
  isValidCccd,
  normalizeCccd,
} from "@/lib/crew";
import {
  CrewReportCategory,
  CREW_REPORT_CATEGORIES,
  CREW_REPORT_CATEGORY_LABELS,
  crewReportCategoryLabel,
  type CrewLookupResult,
} from "@/lib/crew-report";
import {
  AlertIcon,
  EditIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
  UsersIcon,
} from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { StatusBanner } from "@/components/ui/status-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, inputClass, PrimaryButton } from "@/components/ui/primitives";
import { PremiumLock } from "@/components/premium-gate";
import { useFeatureAccess } from "@/lib/use-tier";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useBoats } from "@/components/boat-switcher";
import { apiUrl } from "@/lib/api-base";
import { formatVnDate } from "@/lib/format";

// Thuyền viên là hồ sơ ĐỘNG theo CHỦ TÀU (ba-spec 08 R2): dùng chung cho mọi
// tàu của chủ, KHÔNG gắn boatId, KHÔNG mất khi xóa 1 tàu. (boatId cũ giữ trong
// type cho back-compat dữ liệu cũ nhưng không còn đọc/ghi.)
type StoredCrew = CrewMember & { boatId?: string };

/*
  Sổ thuyền viên — theo nghiên cứu 02-lao-dong-tren-tau.md:
  · hồ sơ tái dùng giữa các chuyến (bạn thuyền đổi liên tục)
  · CCCD là ĐỊNH DANH — nền cho CẢNH BÁO CHÉO giữa chủ tàu (premium)
  · cảnh báo bảo hiểm/chứng chỉ TRƯỚC khi biên phòng kiểm tra
  2026-07-27: BỎ phần tiền (ăn chia/ứng) khỏi màn này — chỉ định danh + giấy tờ.
*/

const STORAGE_KEY = "forfish.crew.v1";

/*
  Sổ MẪU tự xưng là mẫu (hội đồng UX 2026-06-11): lần đầu mở vẫn thấy ví dụ
  cho dễ hình dung, nhưng (1) app biết rõ đây là demo, (2) KHÔNG ghi demo
  xuống localStorage, (3) thêm người thật đầu tiên là sổ mẫu tự biến mất.
*/
function loadCrew(today: Date): { crew: StoredCrew[]; isDemo: boolean } {
  if (typeof window === "undefined") return { crew: [], isDemo: false };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return { crew: JSON.parse(raw) as StoredCrew[], isDemo: false };
  } catch {
    // hỏng storage — rơi xuống seed demo
  }
  return { crew: demoCrew(today), isDemo: true };
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
    const loaded = loadCrew(today);
    setCrew(loaded.crew);
    setIsDemo(loaded.isDemo);
    setReady(true);
  }, [today]);

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
  const [confirmDelete, setConfirmDelete] = useState<StoredCrew | null>(null);
  // sheet tra/báo cảnh báo — mở kèm CCCD+tên của một người, hoặc rỗng (tra tự do)
  const [warningFor, setWarningFor] = useState<{
    cccd: string;
    name: string;
  } | null>(null);

  const { access } = useFeatureAccess();
  const configured = isSupabaseConfigured();

  // Thuyền viên theo CHỦ (ba-spec 08 R2): hiện toàn bộ, không lọc theo tàu.
  const boatCrew = crew;

  const issueCount = boatCrew.filter(
    (m) => crewIssue(m, today).level === "danger",
  ).length;
  const missingCccd = boatCrew.filter((m) => !isValidCccd(m.cccd)).length;

  // người có chuyện xếp lên đầu: đỏ → vàng → ổn
  const sortedCrew = useMemo(() => {
    const rank = { danger: 0, warn: 1, ok: 2 } as const;
    return [...boatCrew].sort(
      (a, b) => rank[crewIssue(a, today).level] - rank[crewIssue(b, today).level],
    );
  }, [boatCrew, today]);

  function upsert(m: StoredCrew) {
    const withBoat: StoredCrew = { ...m }; // không gắn boatId — theo chủ (R2)
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

  // CCCD đã có trong sổ (trừ chính người đang sửa) — chống trùng
  const takenCccds = useMemo(
    () =>
      new Set(
        boatCrew
          .filter((m) => isValidCccd(m.cccd))
          .map((m) => normalizeCccd(m.cccd)),
      ),
    [boatCrew],
  );

  return (
    <div className="px-4 pt-1">
      {/* tổng quan — 2 ô (bỏ ô tiền "Đang ứng") */}
      <div className="mb-4 grid grid-cols-2 gap-2">
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
      </div>

      <button
        onClick={() => {
          setEditing(null);
          setShowForm(true);
        }}
        className="display mb-3 flex min-h-[3.75rem] w-full items-center justify-center gap-2.5 rounded-full bg-trim text-[1.1875rem] font-bold text-white shadow-[0_10px_24px_-8px_rgba(228,87,46,0.55)] transition active:scale-[0.98]"
      >
        <PlusIcon className="h-6 w-6" />
        Thêm bạn thuyền
      </button>

      {/* Tra cảnh báo theo CCCD bất kỳ (trước khi thuê) — premium */}
      <button
        onClick={() => setWarningFor({ cccd: "", name: "" })}
        className="mb-4 flex min-h-[3.5rem] w-full items-center justify-center gap-2.5 rounded-full bg-navy text-[1.0625rem] font-bold text-white transition active:scale-[0.98]"
      >
        <SearchIcon className="h-5 w-5" />
        Tra cảnh báo theo CCCD
      </button>

      {ready && missingCccd > 0 && !isDemo && (
        <div className="mb-4 overflow-hidden surface">
          <StatusBanner level="warn" icon={<AlertIcon className="h-5 w-5" />}>
            {missingCccd} người chưa có CCCD — bổ sung để tra được cảnh báo.
          </StatusBanner>
        </div>
      )}

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
          const hasCccd = isValidCccd(m.cccd);
          return (
            <li key={m.id} className="overflow-hidden surface">
              <StatusBanner level={issue.level}>{issue.label}</StatusBanner>

              <div className="px-4 py-3">
                <p className="text-[0.8125rem] font-bold uppercase tracking-wide text-foreground/65">
                  {ROLE_LABELS[m.role]}
                </p>
                <p className="display text-[1.1875rem] font-bold leading-snug text-navy">
                  {m.name}
                </p>
                {hasCccd ? (
                  <p className="text-[0.9375rem] tabular-nums text-foreground/70">
                    CCCD: {formatCccd(m.cccd)}
                  </p>
                ) : (
                  <p className="text-[0.9375rem] font-semibold text-warn">
                    Chưa có CCCD — bấm Sửa để bổ sung
                  </p>
                )}
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
              </div>

              <div className="grid grid-cols-3 border-t border-line">
                <button
                  onClick={() =>
                    hasCccd
                      ? setWarningFor({ cccd: m.cccd, name: m.name })
                      : (setEditing(m), setShowForm(true))
                  }
                  className="flex min-h-[3.25rem] items-center justify-center gap-1.5 text-[1rem] font-bold text-t4 active:bg-background"
                >
                  <AlertIcon className="h-5 w-5" />
                  Cảnh báo
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
        Hồ sơ thuyền viên lưu trên máy bà con. Cảnh báo chéo do SDVICO kiểm
        duyệt trước khi hiện.
      </p>

      {showForm && (
        <CrewForm
          initial={editing}
          takenCccds={takenCccds}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSave={upsert}
        />
      )}

      {warningFor && (
        <WarningSheet
          initialCccd={warningFor.cccd}
          initialName={warningFor.name}
          access={access}
          configured={configured}
          onClose={() => setWarningFor(null)}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          icon={<TrashIcon className="h-9 w-9 text-danger" />}
          title="Xóa khỏi sổ thuyền viên?"
          message={`“${confirmDelete.name}” sẽ bị xóa khỏi sổ trên máy này (không ảnh hưởng cảnh báo đã gửi).`}
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
  takenCccds,
  onCancel,
  onSave,
}: {
  initial: StoredCrew | null;
  takenCccds: Set<string>;
  onCancel: () => void;
  onSave: (m: StoredCrew) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [cccd, setCccd] = useState(initial?.cccd ?? "");
  const [role, setRole] = useState<CrewRole>(initial?.role ?? "thuyen_vien");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [hasInsurance, setHasInsurance] = useState(
    initial?.hasInsurance ?? false,
  );
  const [insuranceExpiry, setInsuranceExpiry] = useState(
    initial?.insuranceExpiry ?? "",
  );
  const [certLabel, setCertLabel] = useState(initial?.certLabel ?? "");
  const [certExpiry, setCertExpiry] = useState(initial?.certExpiry ?? "");
  const [err, setErr] = useState<string | null>(null);

  const needsCert = role !== "thuyen_vien";
  const initialCccdNorm = initial ? normalizeCccd(initial.cccd) : "";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!name.trim()) {
      setErr("Chưa nhập tên.");
      return;
    }
    if (!isValidCccd(cccd)) {
      setErr("CCCD phải đủ 12 số.");
      return;
    }
    const cccdNorm = normalizeCccd(cccd);
    // trùng CCCD với người khác trong sổ (cho phép giữ nguyên của chính mình)
    if (cccdNorm !== initialCccdNorm && takenCccds.has(cccdNorm)) {
      setErr("CCCD này đã có trong sổ — mỗi người một CCCD.");
      return;
    }
    onSave({
      id: initial?.id ?? `crew-${Date.now()}`,
      name: name.trim(),
      cccd: cccdNorm,
      role,
      phone: phone.trim() || undefined,
      hasInsurance,
      insuranceExpiry:
        hasInsurance && insuranceExpiry ? insuranceExpiry : undefined,
      certLabel: needsCert && certLabel.trim() ? certLabel.trim() : undefined,
      certExpiry: needsCert && certExpiry ? certExpiry : undefined,
      note: initial?.note,
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

        <Field label="Số CCCD (bắt buộc — 12 số)">
          <input
            value={cccd}
            onChange={(e) => setCccd(e.target.value)}
            className={inputClass}
            inputMode="numeric"
            maxLength={16}
            placeholder="VD: 079090001234"
          />
        </Field>

        <Field label="Làm việc gì trên tàu?">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as CrewRole)}
            className={inputClass}
          >
            {(Object.entries(ROLE_LABELS) as [CrewRole, string][]).map(
              ([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ),
            )}
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

        <Field label="Bảo hiểm thuyền viên">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setHasInsurance(true)}
              className={`min-h-[3.25rem] rounded-xl text-[1.125rem] font-bold ${
                hasInsurance ? "bg-ok text-white" : "bg-field text-foreground/70"
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

        {err && (
          <p className="mb-2 text-[0.9375rem] font-semibold text-danger">
            {err}
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

/* ── CẢNH BÁO CHÉO — tra + báo cáo (PREMIUM) ─────────────────────────────── */

type LookupState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; result: CrewLookupResult }
  | { kind: "error"; message: string };

function codeMessage(code: string | undefined): string {
  switch (code) {
    case "not_configured":
      return "Tính năng cảnh báo cần máy chủ thật — bản demo chưa dùng được.";
    case "cccd_pepper_missing":
      return "Máy chủ chưa cấu hình khoá bảo mật CCCD — báo SDVICO.";
    case "premium_required":
      return "Cảnh báo thuyền viên là tính năng nâng cao — gọi SDVICO để mở.";
    case "login_required":
      return "Cần đăng nhập để dùng cảnh báo thuyền viên.";
    case "bad_cccd":
      return "CCCD phải đủ 12 số.";
    default:
      return "Không tra được — kiểm tra mạng rồi thử lại.";
  }
}

function WarningSheet({
  initialCccd,
  initialName,
  access,
  configured,
  onClose,
}: {
  initialCccd: string;
  initialName: string;
  access: ReturnType<typeof useFeatureAccess>["access"];
  configured: boolean;
  onClose: () => void;
}) {
  const [cccd, setCccd] = useState(initialCccd);
  const [state, setState] = useState<LookupState>({ kind: "idle" });
  const [reporting, setReporting] = useState(false);
  const valid = isValidCccd(cccd);
  // access "open" = premium (hoặc demo mode). Chưa cấu hình Supabase thì kho
  // cảnh báo không tồn tại → chặn ngay với lời nhắn demo.
  const locked = access === "login" || access === "upgrade";

  async function lookup() {
    if (!valid) return;
    setState({ kind: "loading" });
    setReporting(false);
    try {
      const r = await fetch(
        apiUrl(`/api/crew-reports/lookup?cccd=${encodeURIComponent(normalizeCccd(cccd))}`),
      );
      const j = (await r.json().catch(() => null)) as
        | { ok: true; checked: boolean; count: number; reports: CrewLookupResult["reports"] }
        | { ok: false; code?: string }
        | null;
      if (!j || j.ok !== true) {
        setState({ kind: "error", message: codeMessage(j?.code) });
        return;
      }
      setState({
        kind: "done",
        result: { checked: true, count: j.count, reports: j.reports },
      });
    } catch {
      setState({ kind: "error", message: codeMessage(undefined) });
    }
  }

  // tra tự động khi mở kèm CCCD sẵn của một người trong sổ
  useEffect(() => {
    if (initialCccd && isValidCccd(initialCccd) && !locked && configured) {
      void lookup();
    }
    // chỉ chạy lần mở
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <BottomSheet title="Cảnh báo thuyền viên" onClose={onClose}>
      {locked ? (
        <PremiumLock
          access={access}
          feature="cảnh báo thuyền viên"
          blurb="Tra CCCD để biết bạn thuyền từng bị chủ tàu khác báo vấn đề gì — tính năng của tài khoản nâng cao."
          accent="t4"
        />
      ) : !configured ? (
        <p className="rounded-2xl bg-field/70 px-4 py-8 text-center text-[1rem] text-foreground/70">
          Tính năng cảnh báo cần máy chủ thật — bản demo trên máy chưa dùng được.
        </p>
      ) : (
        <>
          {initialName && (
            <p className="mb-2 -mt-1 text-[0.9375rem] text-foreground/70">
              Đang tra: <strong className="text-navy">{initialName}</strong>
            </p>
          )}
          <Field label="Số CCCD cần tra (12 số)">
            <input
              value={cccd}
              onChange={(e) => {
                setCccd(e.target.value);
                setState({ kind: "idle" });
              }}
              className={inputClass}
              inputMode="numeric"
              maxLength={16}
              placeholder="VD: 079090001234"
            />
          </Field>
          <button
            type="button"
            onClick={lookup}
            disabled={!valid || state.kind === "loading"}
            className="mb-3 flex min-h-[3.5rem] w-full items-center justify-center gap-2 rounded-full bg-navy text-[1.0625rem] font-bold text-white disabled:opacity-50"
          >
            <SearchIcon className="h-5 w-5" />
            {state.kind === "loading" ? "Đang tra…" : "Tra cảnh báo"}
          </button>

          {state.kind === "error" && (
            <p className="rounded-2xl bg-danger-bg px-4 py-4 text-center text-[1rem] font-semibold text-danger">
              {state.message}
            </p>
          )}

          {state.kind === "done" && !reporting && (
            <LookupResult
              result={state.result}
              onReport={() => setReporting(true)}
            />
          )}

          {reporting && (
            <ReportForm
              cccd={normalizeCccd(cccd)}
              subjectName={initialName}
              onCancel={() => setReporting(false)}
              onDone={() => setReporting(false)}
            />
          )}
        </>
      )}
    </BottomSheet>
  );
}

function LookupResult({
  result,
  onReport,
}: {
  result: CrewLookupResult;
  onReport: () => void;
}) {
  return (
    <div>
      {result.count === 0 ? (
        <div className="rounded-2xl bg-ok-bg px-4 py-6 text-center">
          <p className="text-[1.0625rem] font-bold text-ok">
            Chưa có cảnh báo nào cho CCCD này.
          </p>
          <p className="mt-1 text-[0.875rem] text-foreground/70">
            Chỉ tính các báo cáo đã được SDVICO kiểm duyệt.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-danger/40">
          <div className="bg-danger-bg px-4 py-2.5 text-[1.0625rem] font-bold text-danger">
            {result.count} cảnh báo đã kiểm duyệt
          </div>
          <ul>
            {result.reports.map((rp) => (
              <li key={rp.id} className="border-t border-line px-4 py-3">
                <p className="text-[1rem] font-bold text-navy">
                  {crewReportCategoryLabel(rp.category)}
                </p>
                {rp.detail && (
                  <p className="mt-0.5 text-[0.9375rem] leading-snug text-foreground/75">
                    {rp.detail}
                  </p>
                )}
                <p className="mt-1 text-[0.8125rem] text-foreground/55">
                  {rp.reporterBoat ? `${rp.reporterBoat} · ` : ""}
                  {formatVnDate(rp.createdAt.slice(0, 10))}
                </p>
                {rp.subjectResponse && (
                  <p className="mt-1.5 rounded-lg bg-field px-3 py-2 text-[0.875rem] text-foreground/75">
                    <span className="font-bold text-navy">Người bị ghi phản hồi: </span>
                    {rp.subjectResponse}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={onReport}
        className="mt-3 flex min-h-[3.5rem] w-full items-center justify-center gap-2 rounded-full bg-field text-[1.0625rem] font-bold text-navy active:bg-line"
      >
        <AlertIcon className="h-5 w-5" />
        Báo cáo vấn đề với bạn này
      </button>
    </div>
  );
}

function ReportForm({
  cccd,
  subjectName,
  onCancel,
  onDone,
}: {
  cccd: string;
  subjectName: string;
  onCancel: () => void;
  onDone: () => void;
}) {
  const { current } = useBoats();
  const [name, setName] = useState(subjectName);
  const [category, setCategory] = useState<CrewReportCategory | "">("");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!category) {
      setMsg("Chọn loại vấn đề.");
      return;
    }
    setBusy(true);
    setMsg(null);
    const r = await fetch(apiUrl("/api/crew-reports"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        cccd,
        subjectName: name.trim() || undefined,
        category,
        detail: detail.trim() || undefined,
        reporterBoat: current?.name || undefined,
      }),
    }).catch(() => null);
    setBusy(false);
    const j = (await r?.json().catch(() => null)) as
      | { ok: true }
      | { ok: false; code?: string }
      | null;
    if (!j || j.ok !== true) {
      setMsg(codeMessage(j && "code" in j ? j.code : undefined));
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="rounded-2xl bg-ok-bg px-4 py-8 text-center">
        <p className="text-[1.0625rem] font-bold text-ok">Đã gửi báo cáo.</p>
        <p className="mt-1 text-[0.9375rem] text-foreground/70">
          SDVICO sẽ kiểm duyệt trước khi cảnh báo hiện cho chủ tàu khác.
        </p>
        <button
          type="button"
          onClick={onDone}
          className="mt-4 min-h-[3.25rem] rounded-full bg-navy px-6 text-[1rem] font-bold text-white"
        >
          Xong
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-1">
      <p className="mb-3 text-[0.9375rem] leading-snug text-foreground/70">
        Báo cáo được SDVICO kiểm duyệt trước khi hiện. Người bị ghi có quyền
        phản hồi — vui lòng ghi đúng sự thật.
      </p>

      <Field label="Tên bạn thuyền (tuỳ chọn)">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
          placeholder="VD: Nguyễn Văn A"
        />
      </Field>

      <span className="mb-1.5 block text-[1rem] font-bold text-navy">
        Vấn đề gì?
      </span>
      <div className="mb-3 grid gap-2">
        {CREW_REPORT_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`min-h-[3.25rem] rounded-xl px-3 text-left text-[1rem] font-bold ${
              category === c ? "bg-navy text-white" : "bg-field text-foreground/70"
            }`}
          >
            {CREW_REPORT_CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      <Field label="Kể rõ hơn (tuỳ chọn)">
        <textarea
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          className={`${inputClass} min-h-[5rem]`}
          maxLength={500}
          placeholder="VD: Bỏ tàu ở đảo giữa chuyến, không báo trước."
        />
      </Field>

      {msg && (
        <p className="mb-2 text-[0.9375rem] font-semibold text-danger">{msg}</p>
      )}

      <div className="mt-2 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[3.75rem] rounded-full bg-field text-[1.125rem] font-bold text-foreground/70"
        >
          Quay lại
        </button>
        <PrimaryButton type="submit" disabled={busy || !category}>
          {busy ? "Đang gửi…" : "Gửi báo cáo"}
        </PrimaryButton>
      </div>
    </form>
  );
}
