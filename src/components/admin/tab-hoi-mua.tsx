"use client";

/*  Tách nguyên văn khỏi src/app/quan-tri/page.tsx (2026-10-19, rà Codex đợt 3: trang quản trị 6.718 dòng
    — tách theo tab, KHÔNG đổi hành vi; trang chính nạp tab khi mở). */

import { AdminSkeleton } from "@/components/admin/admin-nav";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { apiUrl } from "@/lib/api-base";
import { tokenHeader } from "@/lib/device-token-store";
import { useCallback, useEffect, useState } from "react";
import { fmtDT } from "@/components/admin/quan-tri-chung";

/* ── YÊU CẦU (hỏi mua/tư vấn từ danh mục sản phẩm) ────────────────────────
   Chủ yếu từ sản phẩm ĐƠN VỊ NGOÀI SDWork (nút "Để lại yêu cầu" —
   product-inquiry-button.tsx). Sản phẩm SDVICO vẫn đi CRM consultation_requests
   như cũ (không đụng), không hiện ở đây. */

export type InquiryStatus = "moi" | "da_lien_he" | "xong";

export const INQUIRY_STATUS_BADGE: Record<InquiryStatus, { label: string; cls: string }> = {
  moi: { label: "Yêu cầu mới", cls: "bg-warn-bg text-warn" },
  da_lien_he: { label: "Đã liên hệ", cls: "bg-sea/15 text-sea" },
  xong: { label: "Xong", cls: "bg-ok-bg text-ok" },
};

export type InquiryRow = {
  id: string;
  listingId: string | null;
  listingTitle: string | null;
  vendorKind: string | null;
  customerPhone: string;
  customerName: string | null;
  message: string | null;
  status: InquiryStatus;
  createdAt: string;
  handledBy: string | null;
  handledAt: string | null;
  note: string | null;
};

export type InquiryStatusFilter = InquiryStatus | "all";

export function InquiriesTab() {
  const [status, setStatus] = useState<InquiryStatusFilter>("moi");
  const [rows, setRows] = useState<InquiryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<InquiryRow | null>(null);

  const load = useCallback(() => {
    setError(null);
    setRows(null);
    fetch(apiUrl(`/api/admin/product-inquiries?status=${status}`), {
      headers: tokenHeader(),
    })
      .then(async (r) => {
        const j = (await r.json()) as {
          ok: boolean;
          code?: string;
          inquiries?: InquiryRow[];
        };
        if (!j.ok) throw new Error(j.code ?? "load");
        setRows(j.inquiries ?? []);
      })
      .catch((e: Error) =>
        setError(
          e.message === "not_configured"
            ? "Chưa kết nối được cơ sở dữ liệu (Supabase). Tính năng này không chạy ở chế độ dùng thử."
            : "Chưa tải được danh sách yêu cầu. Vui lòng thử lại.",
        ),
      );
  }, [status]);
  useEffect(load, [load]);

  async function setInquiryStatus(row: InquiryRow, next: InquiryStatus) {
    setBusyId(row.id);
    const r = await fetch(apiUrl("/api/admin/product-inquiries"), {
      method: "PATCH",
      headers: { "content-type": "application/json", ...tokenHeader() },
      body: JSON.stringify({ id: row.id, status: next }),
    }).catch(() => null);
    setBusyId(null);
    if (!r?.ok) {
      setError("Cập nhật trạng thái không thành công. Vui lòng thử lại.");
      return;
    }
    load();
  }

  async function remove(row: InquiryRow) {
    setBusyId(row.id);
    const r = await fetch(
      apiUrl(`/api/admin/product-inquiries?id=${encodeURIComponent(row.id)}`),
      { method: "DELETE", headers: tokenHeader() },
    ).catch(() => null);
    setBusyId(null);
    if (!r?.ok) {
      setError("Xóa không thành công. Vui lòng thử lại.");
      return;
    }
    load();
  }

  const chip = (id: InquiryStatusFilter, label: string) => (
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
      <PhieuSdvicoSection />
      <p className="surface px-4 py-3 text-[0.875rem] leading-snug text-foreground/70">
        Yêu cầu &ldquo;Để lại yêu cầu&rdquo; bà con gửi từ danh mục sản phẩm — chủ yếu sản
        phẩm của <b>đơn vị đối tác ngoài SDWork</b> (hàng SDVICO vẫn đi qua hộp tư vấn
        CRM như cũ, không hiện ở đây).
      </p>

      <div className="flex flex-wrap gap-1.5">
        {chip("moi", "Yêu cầu mới")}
        {chip("da_lien_he", "Đã liên hệ xử lý")}
        {chip("xong", "Xong")}
        {chip("all", "Tất cả yêu cầu")}
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
          Không có yêu cầu nào ở mục này.
        </p>
      )}

      {rows && rows.length > 0 && (
        <ul className="space-y-3">
          {rows.map((row) => {
            const badge = INQUIRY_STATUS_BADGE[row.status] ?? INQUIRY_STATUS_BADGE.moi;
            return (
              <li key={row.id} className="surface overflow-hidden">
                <div className="flex items-start justify-between gap-3 px-4 pt-3">
                  <div className="min-w-0">
                    <p className="text-[1rem] font-bold text-navy">
                      {row.listingTitle ?? "Sản phẩm không xác định"}
                    </p>
                    <p className="mt-0.5 text-[0.8125rem] tabular-nums text-foreground/70">
                      SĐT {row.customerPhone}
                      {row.customerName ? ` · ${row.customerName}` : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[0.75rem] font-bold ${badge.cls}`}
                  >
                    {badge.label}
                  </span>
                </div>
                {row.message && (
                  <p className="px-4 pt-2 text-[0.9375rem] leading-snug text-foreground/80">
                    {row.message}
                  </p>
                )}
                <p className="px-4 pt-2 text-[0.8125rem] text-foreground/55">
                  gửi {fmtDT(row.createdAt)}
                  {row.handledBy &&
                    ` · người xử lý: ${row.handledBy} lúc ${fmtDT(row.handledAt)}`}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5 border-t border-line px-4 py-2.5">
                  {row.status !== "da_lien_he" && (
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => setInquiryStatus(row, "da_lien_he")}
                      className="min-h-[2.5rem] flex-1 rounded-lg bg-sea/15 px-3 text-[0.8125rem] font-bold text-sea disabled:opacity-50"
                    >
                      Đã liên hệ
                    </button>
                  )}
                  {row.status !== "xong" && (
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => setInquiryStatus(row, "xong")}
                      className="min-h-[2.5rem] flex-1 rounded-lg bg-navy px-3 text-[0.8125rem] font-bold text-white disabled:opacity-50"
                    >
                      Đánh dấu xong
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => setToDelete(row)}
                    className="min-h-[2.5rem] shrink-0 rounded-lg bg-danger-bg px-3 text-[0.8125rem] font-bold text-danger disabled:opacity-50"
                  >
                    Xóa
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {toDelete && (
        <ConfirmDialog
          title="Xác nhận xóa yêu cầu này?"
          message="Yêu cầu sẽ bị xóa vĩnh viễn khỏi danh sách. Thao tác này không thể khôi phục."
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

/* ── PHIẾU KHÁCH HỎI / ĐĂNG KÝ KHUYẾN MÃI SDVICO (0072; 2026-10-26) ─────────────────────
   Chỉ xem, để anh Long đối chiếu với tin Zalo AI Assistant đã nhắn Quân ("Vss Quân Bình Định").
   `moi` = chưa nhắn Zalo (AI Assistant chưa lấy), `da_bao` = đã nhắn. Không sửa ở đây. */
type PhieuSdvico = {
  id: string;
  created_at: string;
  nguon: "kairos" | "san-pham" | "sen-bien";
  san_pham: string | null;
  ten: string;
  phone: string;
  so_tau: string;
  cang: string;
  loi_nhan: string | null;
  trang_thai: "moi" | "da_bao";
  bao_luc: string | null;
  khuyenMai: string | null;
};

function PhieuSdvicoSection() {
  const [rows, setRows] = useState<PhieuSdvico[] | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const [mo, setMo] = useState(true);
  useEffect(() => {
    let alive = true;
    fetch(apiUrl("/api/admin/sdvico-khach-hoi?status=all"), { headers: tokenHeader() })
      .then(async (r) => {
        const j = (await r.json()) as { ok: boolean; code?: string; phieu?: PhieuSdvico[] };
        if (!j.ok) throw new Error(j.code ?? "load");
        if (alive) setRows(j.phieu ?? []);
      })
      .catch((e: Error) => {
        if (alive) setLoi(e.message === "not_configured" ? "Chưa kết nối cơ sở dữ liệu." : "Chưa tải được phiếu SDVICO.");
      });
    return () => {
      alive = false;
    };
  }, []);
  const choNhan = rows?.filter((r) => r.trang_thai === "moi").length ?? 0;
  return (
    <section className="surface px-4 py-3">
      <button type="button" onClick={() => setMo((v) => !v)} className="flex w-full items-center justify-between text-left" aria-expanded={mo}>
        <span className="text-[1rem] font-semibold text-navy">Khách hỏi / đăng ký khuyến mãi SDVICO</span>
        <span className="text-[0.875rem] text-foreground/60">
          {rows ? `${rows.length} phiếu · ${choNhan} chưa nhắn Zalo` : loi ?? "Đang tải…"}
        </span>
      </button>
      {mo && rows && rows.length > 0 && (
        <ul className="mt-3 divide-y divide-line">
          {rows.slice(0, 60).map((r) => (
            <li key={r.id} className="py-2.5 text-[0.875rem] leading-snug">
              <p className="font-semibold text-navy">
                {r.khuyenMai ? `ĐĂNG KÝ KM · ${r.khuyenMai}` : `Hỏi · ${r.san_pham ?? "sản phẩm SDVICO"}`}
                <span className={`ml-2 rounded-full px-2 py-0.5 text-[0.75rem] ${r.trang_thai === "moi" ? "bg-warn-bg text-warn" : "bg-ok-bg text-ok"}`}>
                  {r.trang_thai === "moi" ? "Chưa nhắn Zalo" : `Đã nhắn ${r.bao_luc ? fmtDT(r.bao_luc) : ""}`}
                </span>
              </p>
              <p className="text-foreground/75">
                {r.ten} · {r.phone} · tàu {r.so_tau} · {r.cang}
                {r.loi_nhan ? ` · ${r.loi_nhan}` : ""}
              </p>
              <p className="text-[0.75rem] text-foreground/50">
                {fmtDT(r.created_at)} · nguồn {r.nguon}
              </p>
            </li>
          ))}
        </ul>
      )}
      {mo && rows && rows.length === 0 && <p className="mt-2 text-[0.875rem] text-foreground/60">Chưa có phiếu nào.</p>}
    </section>
  );
}
