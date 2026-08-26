"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CrewMember,
  CrewRole,
  ROLE_LABELS,
  crewIssue,
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
  CheckIcon,
  EditIcon,
  PlusIcon,
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
import { authedFetch } from "@/lib/device-token-store";
import { formatVnDate } from "@/lib/format";
import { isValidVnPhone } from "@/lib/phone";
import { saveUserJson, storageFullCopy } from "@/lib/user-store";
import { readUserList } from "@/lib/user-list-store";
import { markLocalWrite, USER_SYNC_EVENT } from "@/lib/user-sync";
import { useTodayVN } from "@/lib/use-today";

/** Định danh một bạn thuyền để tra/báo cảnh báo — CCCD hoặc SĐT (1 trong 2). */
type Identity = { cccd?: string; phone?: string };
function hasIdentity(id: Identity): boolean {
  return isValidCccd(id.cccd ?? "") || isValidVnPhone(id.phone ?? "");
}
/** Query string cho lookup — chỉ gắn định danh HỢP LỆ. */
function identityQuery(id: Identity): string {
  const p = new URLSearchParams();
  if (isValidCccd(id.cccd ?? "")) p.set("cccd", id.cccd as string);
  if (isValidVnPhone(id.phone ?? "")) p.set("phone", id.phone as string);
  return p.toString();
}

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
  App đã đưa vào sử dụng (chủ dự án 2026-07-29): KHÔNG seed sổ mẫu nữa. User mới
  mở thấy màn RỖNG "chưa có ai trong sổ — bấm thêm", tự điền người thật. (Trước
  đây có "sổ mẫu tự xưng là mẫu" theo hội đồng UX 2026-06-11 — bỏ khi lên thật.)

  HAI TRẠNG THÁI qua `readUserList` (T1, audit 2026-08-18 — cùng khuôn
  document-vault): JSON hỏng / khoá giữ thứ không phải mảng ⇒ `readFailed`,
  KHÔNG dựng sổ rỗng trông y như thật (thêm người thật là ghi đè chuỗi gốc còn
  cứu được) và KHÔNG mở cửa ghi. Mảng (kể cả rỗng) hoặc chưa có khoá = sổ THẬT.
*/
function loadCrew(): {
  crew: StoredCrew[];
  /** true = khoá đang giữ thứ ĐỌC KHÔNG ĐƯỢC ⇒ CẤM ghi đè, phải báo */
  readFailed: boolean;
} {
  if (typeof window === "undefined") return { crew: [], readFailed: false };
  const r = readUserList<StoredCrew>(STORAGE_KEY);
  if (!r.ok) return { crew: [], readFailed: true };
  return { crew: Array.isArray(r.list) ? r.list : [], readFailed: false };
}

/* Trả `false` khi máy KHÔNG giữ được (hết chỗ / trình duyệt chặn) — trước đây
   nuốt im: sổ vẫn hiện người vừa thêm mà máy chẳng lưu, mở lại app là về SỔ MẪU.
   Dự báo tải sẵn nhường chỗ cho sổ (lib/user-store.ts); không đủ thì BÁO. */
function saveCrew(crew: StoredCrew[]): boolean {
  const ok = saveUserJson(STORAGE_KEY, crew);
  if (ok) markLocalWrite("crew"); // đồng bộ lên server (P2, riêng tư CCCD)
  return ok;
}

export function useCrew() {
  const { today } = useTodayVN();
  const [crew, setCrew] = useState<StoredCrew[]>([]);
  const [ready, setReady] = useState(false);
  /** máy không giữ được người vừa thêm → phải nói ra, không im */
  const [saveFailed, setSaveFailed] = useState(false);
  /** sổ trong máy ĐỌC KHÔNG ĐƯỢC → cấm mọi đường ghi đè, báo đỏ */
  const [readFailed, setReadFailed] = useState(false);

  useEffect(() => {
    const loaded = loadCrew();
    setCrew(loaded.crew);
    setReadFailed(loaded.readFailed);
    setReady(true);
  }, []);

  // Máy khác kéo về (lib/user-sync) → đọc lại sổ thuyền viên từ localStorage.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onSync = (e: Event) => {
      if ((e as CustomEvent<{ kind?: string }>).detail?.kind !== "crew") return;
      const loaded = loadCrew();
      setCrew(loaded.crew);
      setReadFailed(loaded.readFailed);
    };
    window.addEventListener(USER_SYNC_EVENT, onSync);
    return () => window.removeEventListener(USER_SYNC_EVENT, onSync);
  }, []);

  /*  GHI KHI BÀ CON THAO TÁC, KHÔNG GHI SAU HYDRATE (N5, audit 2026-08-18):
      effect cũ `if (ready) save(crew)` chạy ngay khi mở màn ⇒ máy đầy thì băng
      đỏ "CHƯA lưu được" bật dù chưa nhập gì. Nay chỉ `commitCrew()` từ
      thêm/sửa/xoá. Đọc hỏng thì KHÔNG ghi. */
  function commitCrew(next: StoredCrew[]) {
    setCrew(next);
    if (readFailed) return;
    setSaveFailed(!saveCrew(next));
  }

  return {
    today,
    crew,
    setCrew,
    commitCrew,
    ready,
    saveFailed,
    readFailed,
  };
}

export function CrewList() {
  const { today, crew, setCrew, commitCrew, ready, saveFailed, readFailed } =
    useCrew();
  const [editing, setEditing] = useState<StoredCrew | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<StoredCrew | null>(null);
  // sheet BÁO CÁO một người (mở từ nút Cảnh báo của thẻ) — kèm định danh (CCCD
  // và/hoặc SĐT) + tên
  const [warningFor, setWarningFor] = useState<{
    cccd: string;
    phone: string;
    name: string;
  } | null>(null);

  const { access } = useFeatureAccess();
  const configured = isSupabaseConfigured();

  // Thuyền viên theo CHỦ (ba-spec 08 R2): hiện toàn bộ, không lọc theo tàu.
  const boatCrew = crew;

  const issueCount = boatCrew.filter(
    (m) => crewIssue(m, today).level === "danger",
  ).length;

  // người có chuyện xếp lên đầu: đỏ → vàng → chưa ghi hạn → ổn
  const sortedCrew = useMemo(() => {
    const rank = { danger: 0, warn: 1, neutral: 2, ok: 3 } as const;
    return [...boatCrew].sort(
      (a, b) => rank[crewIssue(a, today).level] - rank[crewIssue(b, today).level],
    );
  }, [boatCrew, today]);

  function upsert(m: StoredCrew) {
    const withBoat: StoredCrew = { ...m }; // không gắn boatId — theo chủ (R2)
    const idx = crew.findIndex((x) => x.id === withBoat.id);
    const next = [...crew];
    if (idx === -1) next.push(withBoat);
    else next[idx] = withBoat;
    commitCrew(next);
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

      {/* ĐỌC KHÔNG ĐƯỢC — nói thẳng và KHOÁ cửa ghi (T1): thêm người lúc này
          là ghi đè lên chuỗi gốc còn cứu được, mất cả sổ. */}
      {readFailed ? (
        <div className="mb-4 overflow-hidden surface">
          <StatusBanner level="danger" icon={<AlertIcon className="h-5 w-5" />}>
            Sổ thuyền viên trong máy đang ĐỌC KHÔNG ĐƯỢC — sổ cũ vẫn nằm trong
            máy nhưng app chưa mở ra được. Bà con ĐỪNG thêm người mới ở đây (thêm
            là đè mất bản cũ); thử tắt hẳn app mở lại, hoặc phục hồi từ tệp sao lưu.
          </StatusBanner>
        </div>
      ) : (
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="display mb-3 flex min-h-[3.75rem] w-full items-center justify-center gap-2.5 rounded-full bg-trim text-[1.1875rem] font-bold text-white shadow-trim-cta transition active:scale-[0.98]"
        >
          <PlusIcon className="h-6 w-6" />
          Thêm bạn thuyền
        </button>
      )}

      {/* MÁY KHÔNG GIỮ ĐƯỢC — nói ngay, đừng để mở lại app mới thấy sổ trống */}
      {saveFailed && (
        <div className="mb-4 overflow-hidden surface">
          <StatusBanner level="danger" icon={<AlertIcon className="h-5 w-5" />}>
            {storageFullCopy("người vừa thêm")}
          </StatusBanner>
        </div>
      )}

      {/* "Chưa có CCCD/SĐT": chỉ nói MỘT lần, ngay trên thẻ người đó (T8,
          2026-08-18) — banner đếm số người ở đầu trang đã bỏ, cùng ý cùng màn. */}

      {ready && boatCrew.length === 0 && (
        <div className="rounded-[1.25rem] bg-field/70 px-4 py-12 text-center">
          <UsersIcon className="mx-auto h-10 w-10 text-foreground/30" />
          <p className="mt-3 text-[1.125rem] text-foreground/70">
            {readFailed ? (
              <>
                Chưa mở được sổ thuyền viên trong máy.
                <br />
                Sổ cũ chưa mất — xem dải đỏ ở trên.
              </>
            ) : (
              <>
                Chưa có ai trong sổ.
                <br />
                Bấm nút cam ở trên để thêm bạn thuyền.
              </>
            )}
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {sortedCrew.map((m) => {
          const issue = crewIssue(m, today);
          const hasCccd = isValidCccd(m.cccd);
          const canWarn = hasIdentity({ cccd: m.cccd, phone: m.phone });
          return (
            <li key={m.id} className="overflow-hidden surface">
              <StatusBanner
                level={issue.level}
                icon={
                  issue.level === "neutral" ? (
                    <UsersIcon className="h-5 w-5" />
                  ) : undefined
                }
              >
                {issue.label}
              </StatusBanner>

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
                ) : !canWarn ? (
                  <p className="text-[0.9375rem] font-semibold text-warn">
                    Chưa có CCCD/SĐT — bấm Sửa để bổ sung
                  </p>
                ) : null}
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
                    canWarn
                      ? setWarningFor({
                          cccd: m.cccd,
                          phone: m.phone ?? "",
                          name: m.name,
                        })
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
        Hồ sơ thuyền viên lưu trên máy bà con. Cảnh báo giữa các chủ tàu được
        SDVICO xem trước rồi mới hiện.
      </p>

      {showForm && (
        <CrewForm
          initial={editing}
          takenCccds={takenCccds}
          access={access}
          configured={configured}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSave={upsert}
        />
      )}

      {warningFor && (
        <ReportSheet
          cccd={warningFor.cccd}
          phone={warningFor.phone}
          name={warningFor.name}
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
            const next = crew.filter((x) => x.id !== confirmDelete.id);
            commitCrew(next);
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
  access,
  configured,
  onCancel,
  onSave,
}: {
  initial: StoredCrew | null;
  takenCccds: Set<string>;
  access: ReturnType<typeof useFeatureAccess>["access"];
  configured: boolean;
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
    const cccdEntered = cccd.trim() !== "";
    const phoneEntered = phone.trim() !== "";
    // Định danh = CCCD HOẶC SĐT (1 trong 2). Cái nào có nhập thì phải đúng.
    if (cccdEntered && !isValidCccd(cccd)) {
      setErr("CCCD phải đủ 12 số (hoặc để trống, dùng SĐT).");
      return;
    }
    if (phoneEntered && !isValidVnPhone(phone)) {
      setErr("Số điện thoại chưa hợp lệ.");
      return;
    }
    if (!isValidCccd(cccd) && !isValidVnPhone(phone)) {
      setErr("Cần CCCD (12 số) hoặc số điện thoại để nhận ra đúng người.");
      return;
    }
    const cccdNorm = isValidCccd(cccd) ? normalizeCccd(cccd) : "";
    // trùng CCCD với người khác trong sổ (cho phép giữ nguyên của chính mình)
    if (cccdNorm && cccdNorm !== initialCccdNorm && takenCccds.has(cccdNorm)) {
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

        <Field label="Số CCCD (12 số — hoặc dùng SĐT bên dưới)">
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

        <Field label="Số điện thoại (dùng thay CCCD nếu chưa có)">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
            inputMode="tel"
            placeholder="VD: 0901234567"
          />
          {/* Tra cảnh báo NGAY khi có đủ định danh (CCCD 12 số HOẶC SĐT) — ✓
              xanh nếu sạch, hiện cảnh báo nếu có (không cần nút tra riêng) */}
          <IdentityCheck
            cccd={cccd}
            phone={phone}
            access={access}
            configured={configured}
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

/** Bản trên máy chưa nối với SDVICO (chưa có Supabase) — một câu, dùng 3 chỗ. */
const NOT_CONNECTED_COPY =
  "Bản trên máy này chưa nối với SDVICO nên chưa tra được cảnh báo.";

// Copy đời thường (T10, 2026-08-18): không "máy chủ / cấu hình / khoá bảo mật /
// định danh / kiểm duyệt"; một tên duy nhất "Premium".
function codeMessage(code: string | undefined): string {
  switch (code) {
    case "not_configured":
      return NOT_CONNECTED_COPY;
    case "cccd_pepper_missing":
      return "Bên SDVICO chưa bật được phần tra cảnh báo — báo SDVICO giúp.";
    case "premium_required":
      return "Cảnh báo thuyền viên là tính năng Premium — gọi SDVICO để mở.";
    case "login_required":
      return "Cần đăng nhập để dùng cảnh báo thuyền viên.";
    case "bad_cccd":
      return "CCCD phải đủ 12 số.";
    default:
      return "Không tra được — kiểm tra mạng rồi thử lại.";
  }
}

/** Gọi API tra cảnh báo theo CCCD/SĐT — trả kết quả hoặc mã lỗi (dùng chung
 *  cho ô tra-khi-gõ và sheet báo cáo). */
async function fetchLookup(
  id: Identity,
): Promise<
  { ok: true; result: CrewLookupResult } | { ok: false; code?: string }
> {
  try {
    /*  QUA `authedFetch` (2026-08-16, thẩm định P0 — danh tính tách não). Bản
        cũ `fetch` trần, KHÔNG gắn chuỗi cứng của máy, trong khi route đã bỏ
        phiên Supabase từ 0026 ⇒ mọi lượt tra đều 401 và ô tra nói "Cần đăng
        nhập" với đúng người đang đăng nhập. `authedFetch` gắn header chuỗi, tự
        có đồng hồ 12 giây (giữ nguyên ý D-PH5: sóng "sống mà chết" không được
        làm ô tra kẹt "đang tra…" vĩnh viễn) và tự soi phản hồi xem máy có vừa
        bị đá không (`noteResponse`). */
    const { res: r } = await authedFetch(
      `/api/crew-reports/lookup?${identityQuery(id)}`,
      {},
      12000,
    );
    if (!r) return { ok: false };
    const j = (await r.json().catch(() => null)) as
      | { ok: true; count: number; reports: CrewLookupResult["reports"] }
      | { ok: false; code?: string }
      | null;
    if (!j || j.ok !== true) return { ok: false, code: j?.code };
    return {
      ok: true,
      result: { checked: true, count: j.count, reports: j.reports },
    };
  } catch {
    return { ok: false };
  }
}

/** Danh sách cảnh báo đã duyệt (không kèm nút) — dùng cho cả tra-khi-gõ lẫn
 *  bối cảnh lúc báo cáo. */
function WarningsList({ result }: { result: CrewLookupResult }) {
  if (result.count === 0) return null;
  return (
    <div className="overflow-hidden rounded-2xl border border-danger/40">
      <div className="bg-danger-bg px-4 py-2.5 text-[1rem] font-bold text-danger">
        {result.count} cảnh báo SDVICO đã xem
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
                <span className="font-bold text-navy">Người này trả lời: </span>
                {rp.subjectResponse}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Tra cảnh báo NGAY khi gõ đủ định danh (CCCD 12 số HOẶC SĐT) trong form
 *  thêm/sửa — ✓ xanh nếu sạch, hiện cảnh báo nếu có (không cần nút tra riêng).
 *  Chỉ tra khi premium + có máy chủ; chưa premium thì mời nâng cấp gọn. */
function IdentityCheck({
  cccd,
  phone,
  access,
  configured,
}: {
  cccd: string;
  phone: string;
  access: ReturnType<typeof useFeatureAccess>["access"];
  configured: boolean;
}) {
  const [state, setState] = useState<LookupState>({ kind: "idle" });
  const valid = hasIdentity({ cccd, phone });
  // khoá debounce theo định danh hợp lệ (đổi CCCD/SĐT thì tra lại)
  const key = identityQuery({ cccd, phone });
  const canCheck = configured && access === "open";

  useEffect(() => {
    if (!valid || !canCheck) {
      setState({ kind: "idle" });
      return;
    }
    let alive = true;
    setState({ kind: "loading" });
    // chờ gõ xong (debounce) rồi mới hỏi máy chủ
    const t = setTimeout(async () => {
      const r = await fetchLookup({ cccd, phone });
      if (!alive) return;
      setState(
        r.ok
          ? { kind: "done", result: r.result }
          : { kind: "error", message: codeMessage(r.code) },
      );
    }, 500);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, valid, canCheck]);

  if (!valid) return null;
  // Tầng mời gọi (T9, chính sách 2026-08-18): 1 khối gọn tại điểm bị khoá, có
  // nút đăng nhập / gọi SDVICO (PremiumLock compact — tự ẨN khi mất sóng:
  // `tel:`/đăng nhập ngoài khơi là ngõ cụt).
  if (access === "login" || access === "upgrade") {
    return (
      <PremiumLock
        compact
        access={access}
        feature="tra cảnh báo bạn thuyền"
        blurb={
          access === "login"
            ? "Đăng nhập là app tự tra cảnh báo về người này ngay khi gõ xong CCCD/SĐT."
            : "Gọi SDVICO mở Premium là app tự tra cảnh báo về người này khi thêm."
        }
        accent="t4"
      />
    );
  }
  // Bản trên máy chưa nối SDVICO — nói ra thay vì im (T9)
  if (!configured)
    return (
      <p className="mt-1.5 text-[0.875rem] text-foreground/60">
        {NOT_CONNECTED_COPY}
      </p>
    );

  if (state.kind === "loading")
    return (
      <p className="mt-1.5 text-[0.875rem] text-foreground/60">
        Đang tra cảnh báo…
      </p>
    );
  if (state.kind === "error")
    return (
      <p className="mt-1.5 text-[0.875rem] font-semibold text-danger">
        {state.message}
      </p>
    );
  if (state.kind === "done") {
    if (state.result.count === 0)
      return (
        <p className="mt-1.5 flex items-center gap-1.5 text-[0.9375rem] font-bold text-ok">
          <CheckIcon className="h-5 w-5" />
          Không có cảnh báo — bạn thuyền ổn.
        </p>
      );
    return (
      <div className="mt-2">
        <p className="mb-1.5 flex items-center gap-1.5 text-[0.9375rem] font-bold text-danger">
          <AlertIcon className="h-5 w-5" />
          Có cảnh báo về người này:
        </p>
        <WarningsList result={state.result} />
      </div>
    );
  }
  return null;
}

/* Sheet BÁO CÁO một bạn thuyền (mở từ nút Cảnh báo của thẻ) — gõ lý do rồi
   gửi; SDVICO kiểm duyệt ở /quan-tri trước khi hiện cho chủ tàu khác. Cảnh
   báo cũ (nếu có) hiện ở trên làm bối cảnh, tránh báo trùng. */
function ReportSheet({
  cccd,
  phone,
  name,
  access,
  configured,
  onClose,
}: {
  cccd: string;
  phone: string;
  name: string;
  access: ReturnType<typeof useFeatureAccess>["access"];
  configured: boolean;
  onClose: () => void;
}) {
  const [ctx, setCtx] = useState<LookupState>({ kind: "idle" });
  const locked = access === "login" || access === "upgrade";
  const idValidCccd = isValidCccd(cccd);
  const idValidPhone = isValidVnPhone(phone);

  // nạp cảnh báo đã có làm bối cảnh (1 lần khi mở)
  useEffect(() => {
    if (locked || !configured || !hasIdentity({ cccd, phone })) return;
    let alive = true;
    setCtx({ kind: "loading" });
    fetchLookup({ cccd, phone }).then((r) => {
      if (!alive) return;
      setCtx(
        r.ok
          ? { kind: "done", result: r.result }
          : { kind: "error", message: codeMessage(r.code) },
      );
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <BottomSheet title="Báo cáo bạn thuyền" onClose={onClose}>
      {locked ? (
        <PremiumLock
          access={access}
          feature="cảnh báo thuyền viên"
          blurb="Báo cáo & tra cảnh báo bạn thuyền là tính năng Premium."
          accent="t4"
        />
      ) : !configured ? (
        <p className="rounded-2xl bg-field/70 px-4 py-8 text-center text-[1rem] text-foreground/70">
          {NOT_CONNECTED_COPY}
        </p>
      ) : (
        <>
          <p className="mb-3 -mt-1 text-[0.9375rem] tabular-nums text-foreground/70">
            {name ? <strong className="text-navy">{name} · </strong> : null}
            {idValidCccd ? `CCCD ${formatCccd(cccd)}` : ""}
            {idValidCccd && idValidPhone ? " · " : ""}
            {idValidPhone ? `SĐT ${phone}` : ""}
          </p>

          {ctx.kind === "done" && ctx.result.count > 0 && (
            <div className="mb-3">
              <p className="mb-1.5 text-[0.9375rem] font-bold text-danger">
                Người này đã bị báo cáo trước đó:
              </p>
              <WarningsList result={ctx.result} />
            </div>
          )}

          <ReportForm
            cccd={idValidCccd ? normalizeCccd(cccd) : ""}
            phone={idValidPhone ? phone : ""}
            subjectName={name}
            onCancel={onClose}
            onDone={onClose}
          />
        </>
      )}
    </BottomSheet>
  );
}

function ReportForm({
  cccd,
  phone,
  subjectName,
  onCancel,
  onDone,
}: {
  cccd: string;
  phone: string;
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
    // QUA `authedFetch` — xem ghi chú ở `fetchLookup`. Đồng hồ 20 giây (D-PH6)
    // giữ nguyên, nay do `authedFetch` cắm; hết giờ → `res: null` → UI báo thật.
    const { res: r } = await authedFetch(
      "/api/crew-reports",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cccd: cccd || undefined,
          phone: phone || undefined,
          subjectName: name.trim() || undefined,
          category,
          detail: detail.trim() || undefined,
          reporterBoat: current?.name || undefined,
        }),
      },
      20000,
    );
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
          SDVICO xem trước rồi cảnh báo mới hiện cho chủ tàu khác.
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
        SDVICO xem trước rồi mới hiện báo cáo. Người bị ghi có quyền
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
