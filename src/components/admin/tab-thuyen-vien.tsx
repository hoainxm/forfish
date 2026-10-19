"use client";

/*  Tách nguyên văn khỏi src/app/quan-tri/page.tsx (2026-10-19, rà Codex đợt 3: trang quản trị 6.718 dòng
    — tách theo tab, KHÔNG đổi hành vi; trang chính nạp tab khi mở). */

import { AdminSkeleton } from "@/components/admin/admin-nav";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { apiUrl } from "@/lib/api-base";
import { formatCccd, isValidCccd } from "@/lib/crew";
import { CREW_REPORT_CATEGORIES, CREW_REPORT_CATEGORY_LABELS, crewReportCategoryLabel, type CrewReportCategory } from "@/lib/crew-report";
import { tokenHeader } from "@/lib/device-token-store";
import { isValidVnPhone } from "@/lib/phone";
import { type TabPerms } from "@/lib/staff-permissions";
import { useCallback, useEffect, useState } from "react";
import { fmtDT } from "@/components/admin/quan-tri-chung";

/* ── CẢNH BÁO THUYỀN VIÊN (kiểm duyệt) ───────────────────────────────────── */

export type CrewReportRow = {
  id: string;
  subjectCccd: string | null;
  subjectPhone: string | null;
  subjectName: string | null;
  reporterPhone: string;
  reporterBoat: string | null;
  category: string;
  detail: string | null;
  status: string;
  moderatedBy: string | null;
  moderatedAt: string | null;
  subjectResponse: string | null;
  subjectRespondedAt: string | null;
  createdAt: string;
};

export type ReportStatusFilter = "pending" | "approved" | "rejected" | "all";

export const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: "Chờ duyệt", cls: "bg-warn-bg text-warn" },
  approved: { label: "Đã duyệt", cls: "bg-danger-bg text-danger" },
  rejected: { label: "Từ chối", cls: "bg-field text-foreground/65" },
  withdrawn: { label: "Đã rút xuống", cls: "bg-field text-foreground/65" },
};

export function CrewReportsTab({ perms }: { perms: TabPerms }) {
  const [status, setStatus] = useState<ReportStatusFilter>("pending");
  const [rows, setRows] = useState<CrewReportRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // xác nhận đổi trạng thái (duyệt/từ chối/rút) qua dialog trong trang
  const [confirm, setConfirm] = useState<{
    row: CrewReportRow;
    action: "approve" | "reject" | "withdraw";
  } | null>(null);
  const [toDelete, setToDelete] = useState<CrewReportRow | null>(null);

  const load = useCallback(() => {
    setError(null);
    setRows(null);
    fetch(apiUrl(`/api/admin/crew-reports?status=${status}`), {
      headers: tokenHeader(),
    })
      .then(async (r) => {
        const j = (await r.json()) as {
          ok: boolean;
          code?: string;
          reports?: CrewReportRow[];
        };
        if (!j.ok) throw new Error(j.code ?? "load");
        setRows(j.reports ?? []);
      })
      .catch((e: Error) =>
        setError(
          e.message === "not_configured"
            ? "Chưa kết nối được cơ sở dữ liệu (Supabase). Tính năng này không chạy ở chế độ dùng thử."
            : "Chưa tải được danh sách. Vui lòng thử lại.",
        ),
      );
  }, [status]);
  useEffect(load, [load]);

  async function act(
    row: CrewReportRow,
    action: "approve" | "reject" | "withdraw" | "respond",
    subjectResponse?: string,
  ) {
    setBusyId(row.id);
    const r = await fetch(apiUrl("/api/admin/crew-reports"), {
      method: "PATCH",
      headers: { "content-type": "application/json", ...tokenHeader() },
      body: JSON.stringify({ id: row.id, action, subjectResponse }),
    }).catch(() => null);
    setBusyId(null);
    if (!r?.ok) {
      setError("Thao tác không thành công. Vui lòng thử lại.");
      return;
    }
    load();
  }

  async function remove(row: CrewReportRow) {
    setBusyId(row.id);
    const r = await fetch(
      apiUrl(`/api/admin/crew-reports?id=${encodeURIComponent(row.id)}`),
      { method: "DELETE", headers: tokenHeader() },
    ).catch(() => null);
    setBusyId(null);
    if (!r?.ok) {
      setError("Xóa không thành công. Vui lòng thử lại.");
      return;
    }
    load();
  }

  const chip = (id: ReportStatusFilter, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setStatus(id)}
      aria-pressed={status === id}
      className={`min-h-[2.5rem] shrink-0 rounded-full px-4 text-[0.875rem] font-bold transition ${
        status === id ? "bg-navy text-white" : "bg-field text-foreground/70"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mt-4 space-y-4">
      <p className="surface px-4 py-3 text-[0.875rem] leading-snug text-foreground/70">
        Chủ tàu premium báo cáo vấn đề thuyền viên (theo CCCD). Chỉ báo cáo{" "}
        <b>đã duyệt</b> mới hiện cho chủ tàu khác. Kiểm tra kỹ trước khi duyệt —
        người bị ghi có quyền phản hồi (ghi vào ô bên dưới mỗi báo cáo).
      </p>

      {/* STAFF tự thêm thuyền viên có vấn đề → duyệt luôn (hiện ngay) — cần create */}
      {perms.create && <AddCrewReportForm onAdded={load} />}

      <div className="flex gap-1.5">
        {chip("pending", "Chờ duyệt")}
        {chip("approved", "Đã duyệt")}
        {chip("rejected", "Đã từ chối")}
        {chip("all", "Tất cả")}
      </div>

      {error && (
        <div className="surface px-4 py-6 text-center">
          <p className="text-[1rem] text-danger">{error}</p>
          <button
            type="button"
            onClick={load}
            className="mt-3 min-h-[2.75rem] rounded-xl bg-navy px-6 text-[0.9375rem] font-bold text-white"
          >
            Thử lại
          </button>
        </div>
      )}
      {!rows && !error && (
        <AdminSkeleton label="Đang tải…" />
      )}
      {rows && rows.length === 0 && (
        <p className="surface px-4 py-8 text-center text-[1rem] text-foreground/65">
          Không có báo cáo nào ở mục này.
        </p>
      )}

      {rows && rows.length > 0 && (
        <ul className="space-y-3">
          {rows.map((row) => (
            <ReportCard
              key={row.id}
              row={row}
              busy={busyId === row.id}
              perms={perms}
              onStatus={(action) => setConfirm({ row, action })}
              onRespond={(text) => act(row, "respond", text)}
              onDelete={() => setToDelete(row)}
            />
          ))}
        </ul>
      )}

      {confirm && (
        <ConfirmDialog
          title={
            confirm.action === "approve"
              ? "Xác nhận duyệt báo cáo này?"
              : confirm.action === "reject"
                ? "Từ chối báo cáo này?"
                : "Rút báo cáo đã duyệt khỏi hệ thống?"
          }
          message={
            confirm.action === "approve"
              ? "Sau khi duyệt, các chủ tàu khác tra cứu CCCD này sẽ thấy cảnh báo. Hãy đảm bảo thông tin đã được kiểm chứng."
              : confirm.action === "reject"
                ? "Báo cáo sẽ bị ẩn khỏi mọi người. Chỉ sử dụng khi nội dung không chính xác hoặc thiếu căn cứ."
                : "Cảnh báo sẽ ngừng hiển thị đối với các chủ tàu khác."
          }
          confirmLabel={
            confirm.action === "approve"
              ? "Duyệt và cho hiển thị"
              : confirm.action === "reject"
                ? "Từ chối báo cáo"
                : "Rút báo cáo"
          }
          cancelLabel="Hủy thao tác"
          danger={confirm.action !== "approve"}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const { row, action } = confirm;
            setConfirm(null);
            act(row, action);
          }}
        />
      )}

      {toDelete && (
        <ConfirmDialog
          title="Xóa cảnh báo khỏi danh sách?"
          message="Xóa vĩnh viễn báo cáo này (sẽ không thể khôi phục). Chỉ dùng thao tác này khi báo cáo bị sai hoặc trùng lặp."
          confirmLabel="Xác nhận xóa"
          cancelLabel="Hủy thao tác"
          danger
          onCancel={() => setToDelete(null)}
          onConfirm={() => {
            const row = toDelete;
            setToDelete(null);
            remove(row);
          }}
        />
      )}
    </div>
  );
}

export function ReportCard({
  row,
  busy,
  perms,
  onStatus,
  onRespond,
  onDelete,
}: {
  row: CrewReportRow;
  busy: boolean;
  perms: TabPerms;
  onStatus: (action: "approve" | "reject" | "withdraw") => void;
  onRespond: (text: string) => void;
  onDelete: () => void;
}) {
  const [resp, setResp] = useState(row.subjectResponse ?? "");
  const badge = STATUS_BADGE[row.status] ?? STATUS_BADGE.pending;

  return (
    <li className="surface overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-4 pt-3">
        <div className="min-w-0">
          <p className="text-[1rem] font-bold text-navy">
            {crewReportCategoryLabel(row.category)}
          </p>
          <p className="mt-0.5 text-[0.8125rem] tabular-nums text-foreground/70">
            {row.subjectCccd ? `CCCD ${formatCccd(row.subjectCccd)}` : ""}
            {row.subjectCccd && row.subjectPhone ? " · " : ""}
            {row.subjectPhone ? `SĐT liên hệ ${row.subjectPhone}` : ""}
            {row.subjectName ? ` · ${row.subjectName}` : ""}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[0.75rem] font-bold ${badge.cls}`}
        >
          {badge.label}
        </span>
      </div>

      {row.detail && (
        <p className="px-4 pt-2 text-[0.9375rem] leading-snug text-foreground/80">
          {row.detail}
        </p>
      )}

      <p className="px-4 pt-2 text-[0.8125rem] text-foreground/55">
        Người báo: <span className="tabular-nums">{row.reporterPhone}</span>
        {row.reporterBoat ? ` (${row.reporterBoat})` : ""} · gửi{" "}
        {fmtDT(row.createdAt)}
        {row.moderatedBy &&
          ` · người duyệt: ${row.moderatedBy} lúc ${fmtDT(row.moderatedAt)}`}
      </p>

      {/* phản hồi người bị ghi (admin thay mặt ghi, v1) — ghi = edit */}
      {perms.edit && (
      <div className="mt-2 border-t border-line bg-background px-4 py-3">
        <label className="mb-1 block text-[0.8125rem] font-bold text-navy">
          Phản hồi của người bị ghi
        </label>
        <textarea
          value={resp}
          onChange={(e) => setResp(e.target.value)}
          maxLength={500}
          placeholder="Ghi chú lại phản hồi hoặc đính chính từ người bị báo cáo nếu họ liên hệ SDVICO…"
          className="min-h-[3.5rem] w-full rounded-xl border-0 bg-field px-3 py-2 text-[0.875rem] focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea"
        />
        <button
          type="button"
          disabled={busy || resp.trim() === (row.subjectResponse ?? "")}
          onClick={() => onRespond(resp.trim())}
          className="mt-1.5 min-h-[2.5rem] rounded-lg bg-field px-4 text-[0.8125rem] font-bold text-navy disabled:opacity-40"
        >
          Lưu phản hồi
        </button>
      </div>
      )}

      {(perms.edit || perms.delete) && (
      <div className="flex gap-1.5 border-t border-line px-4 py-2.5">
        {perms.edit && row.status === "pending" && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => onStatus("approve")}
              className="min-h-[2.5rem] flex-1 rounded-lg bg-navy px-3 text-[0.8125rem] font-bold text-white disabled:opacity-50"
            >
              Duyệt
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onStatus("reject")}
              className="min-h-[2.5rem] flex-1 rounded-lg bg-field px-3 text-[0.8125rem] font-bold text-foreground/70 disabled:opacity-50"
            >
              Từ chối
            </button>
          </>
        )}
        {perms.edit && row.status === "approved" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onStatus("withdraw")}
            className="min-h-[2.5rem] flex-1 rounded-lg bg-danger-bg px-3 text-[0.8125rem] font-bold text-danger disabled:opacity-50"
          >
            Rút cảnh báo xuống
          </button>
        )}
        {perms.edit &&
          (row.status === "rejected" || row.status === "withdrawn") && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onStatus("approve")}
              className="min-h-[2.5rem] flex-1 rounded-lg bg-navy px-3 text-[0.8125rem] font-bold text-white disabled:opacity-50"
            >
              Duyệt lại (cho hiện)
            </button>
          )}
        {perms.delete && (
          <button
            type="button"
            disabled={busy}
            onClick={onDelete}
            title="Xóa vĩnh viễn khỏi danh sách"
            className="min-h-[2.5rem] shrink-0 rounded-lg bg-danger-bg px-3 text-[0.8125rem] font-bold text-danger disabled:opacity-50"
          >
            Xóa
          </button>
        )}
      </div>
      )}
    </li>
  );
}

/** STAFF tự thêm một thuyền viên có vấn đề (CCCD HOẶC SĐT) → vào thẳng
 *  'approved', hiện ngay cho chủ tàu khác khi tra. */
export function AddCrewReportForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [cccd, setCccd] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<CrewReportCategory | "">("");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const cccdOk = isValidCccd(cccd);
  const phoneOk = isValidVnPhone(phone);
  const canSubmit = (cccdOk || phoneOk) && !!category;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!cccdOk && !phoneOk) {
      setMsg("Vui lòng nhập CCCD (12 số) hoặc Số điện thoại.");
      return;
    }
    if (cccd.trim() && !cccdOk) {
      setMsg("Số CCCD cần đủ 12 số (hoặc để trống nếu không nhớ).");
      return;
    }
    if (phone.trim() && !phoneOk) {
      setMsg("Số điện thoại không đúng định dạng.");
      return;
    }
    if (!category) {
      setMsg("Vui lòng chọn loại vấn đề.");
      return;
    }
    setBusy(true);
    const r = await fetch(apiUrl("/api/admin/crew-reports"), {
      method: "POST",
      headers: { "content-type": "application/json", ...tokenHeader() },
      body: JSON.stringify({
        cccd: cccdOk ? cccd : undefined,
        phone: phoneOk ? phone : undefined,
        subjectName: name.trim() || undefined,
        category,
        detail: detail.trim() || undefined,
      }),
    }).catch(() => null);
    setBusy(false);
    const j = (await r?.json().catch(() => null)) as {
      ok?: boolean;
      code?: string;
    } | null;
    if (!r?.ok || !j?.ok) {
      setMsg(
        j?.code === "cccd_pepper_missing"
          ? "Máy chủ chưa được cấu hình CREW_CCCD_PEPPER."
          : "Thêm không thành công. Vui lòng thử lại.",
      );
      return;
    }
    setMsg("Đã thêm thành công — cảnh báo sẽ hiển thị ngay cho các chủ tàu khác khi tra cứu.");
    setCccd("");
    setPhone("");
    setName("");
    setCategory("");
    setDetail("");
    onAdded();
  }

  const field =
    "min-h-[2.75rem] w-full rounded-xl border-0 bg-field px-3 text-[0.9375rem] font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea";

  return (
    <div className="surface px-4 py-3.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-[2.75rem] w-full items-center justify-between gap-3 text-left text-[1rem] font-bold text-navy"
        aria-expanded={open}
      >
        Thêm thuyền viên có vấn đề (duyệt luôn)
        <span aria-hidden>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <form onSubmit={submit} className="anim-fade-in mt-3 space-y-2.5">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <input
              inputMode="numeric"
              placeholder="CCCD (12 số) — hoặc sử dụng Số điện thoại"
              value={cccd}
              onChange={(e) => setCccd(e.target.value)}
              className={field}
            />
            <input
              inputMode="tel"
              placeholder="Số điện thoại (nếu không có CCCD)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={field}
            />
          </div>
          <input
            placeholder="Tên thuyền viên (tuỳ chọn)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={field}
          />
          <div
            className="grid gap-1.5 sm:grid-cols-2"
            role="group"
            aria-label="Phân loại vấn đề"
          >
            {CREW_REPORT_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                aria-pressed={category === c}
                className={`min-h-[2.75rem] rounded-xl px-3 text-left text-[0.8125rem] font-bold transition ${
                  category === c
                    ? "bg-navy text-white"
                    : "bg-field text-foreground/70"
                }`}
              >
                {CREW_REPORT_CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
          <textarea
            placeholder="Mô tả chi tiết (tuỳ chọn)"
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            maxLength={500}
            className="min-h-[3.5rem] w-full rounded-xl border-0 bg-field px-3 py-2 text-[0.875rem] focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea"
          />
          <button
            type="submit"
            disabled={busy || !canSubmit}
            className="min-h-[2.75rem] w-full rounded-xl bg-trim text-[0.9375rem] font-bold text-white disabled:opacity-50"
          >
            {busy ? "Đang xử lý thêm…" : "Thêm & duyệt cảnh báo"}
          </button>
          {msg && (
            <p className="text-[0.875rem] font-semibold text-foreground/75">
              {msg}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
