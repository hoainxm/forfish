"use client";

/*  Tách nguyên văn khỏi src/app/quan-tri/page.tsx (2026-10-19, rà Codex đợt 3: trang quản trị 6.718 dòng
    — tách theo tab, KHÔNG đổi hành vi; trang chính nạp tab khi mở). */

import { AdminSkeleton } from "@/components/admin/admin-nav";
import { ADMIN_ACTIONS, actionLabel, isDangerAction } from "@/lib/admin-activity";
import { apiUrl } from "@/lib/api-base";
import { tokenHeader } from "@/lib/device-token-store";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fmtDT, fold } from "@/components/admin/quan-tri-chung";

/* ── NHẬT KÝ HOẠT ĐỘNG (admin-only) ────────────────────────────────────────
   Log append-only mọi thao tác ghi/xóa của staff (admin_activity_log, 0019) →
   soát được ai làm gì, lúc nào; nhất là XÓA/RESET/ĐỔI QUYỀN (tô đỏ). */

export type ActivityEvent = {
  id: string;
  actorPhone: string;
  actorRole: string;
  action: string;
  target: string | null;
  detail: Record<string, unknown> | null;
  createdAt: string;
};

export function ActivityLogTab() {
  const [events, setEvents] = useState<ActivityEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [migrationNeeded, setMigrationNeeded] = useState(false);
  const [readErr, setReadErr] = useState<string | null>(null);
  const [probe, setProbe] = useState<string | null>(null);
  const [probing, setProbing] = useState(false);
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [dangerOnly, setDangerOnly] = useState(false);

  const load = useCallback(() => {
    setError(null);
    setEvents(null);
    fetch(apiUrl("/api/admin/activity"), { headers: tokenHeader() })
      .then(async (r) => {
        const j = (await r.json()) as {
          ok: boolean;
          code?: string;
          events?: ActivityEvent[];
          migrationNeeded?: boolean;
          error?: { code?: string; message?: string; hint?: string };
        };
        if (!j.ok) throw new Error(j.code ?? "load");
        setEvents(j.events ?? []);
        setMigrationNeeded(Boolean(j.migrationNeeded));
        setReadErr(
          j.error ? `${j.error.code ?? ""} ${j.error.message ?? ""}`.trim() : null,
        );
      })
      .catch((e: Error) =>
        setError(
          e.message === "not_configured"
            ? "Chưa kết nối được cơ sở dữ liệu (Supabase). Tính năng này không chạy ở chế độ dùng thử."
            : e.message === "admin_only"
              ? "Tính năng xem nhật ký hoạt động chỉ dành cho Quản trị viên."
              : "Chưa tải được nhật ký hoạt động. Vui lòng thử lại.",
        ),
      );
  }, []);
  useEffect(load, [load]);

  const visible = useMemo(() => {
    if (!events) return null;
    const q = fold(query.trim());
    const qDigits = query.replace(/\D/g, "");
    return events.filter((e) => {
      if (actionFilter !== "all" && e.action !== actionFilter) return false;
      if (dangerOnly && !isDangerAction(e.action)) return false;
      if (!q && !qDigits) return true;
      if (qDigits && e.actorPhone.includes(qDigits)) return true;
      if (q && fold(actionLabel(e.action)).includes(q)) return true;
      return false;
    });
  }, [events, query, actionFilter, dangerOnly]);

  return (
    <div className="mt-4 space-y-4">
      <p className="surface px-4 py-3 text-[0.875rem] leading-snug text-foreground/70">
        Ghi lại mọi thao tác <b>dữ liệu thêm/xóa</b> của quản trị viên & quản lý (tạo/xóa
        tài khoản, cấp premium, đổi ghi chú, gửi thông báo, đổi phân quyền…) —
        soát được <b>ghi nhận thao tác của ai, vào thời gian nào</b>. Thao tác xóa/nhạy cảm tô{" "}
        <span className="font-bold text-danger">quan trọng</span>. Không sửa/xóa được
        nhật ký.
      </p>

      {migrationNeeded && (
        <p className="surface bg-warn-bg px-4 py-3 text-[0.875rem] font-semibold text-warn">
          Đọc bảng nhật ký KHÔNG được — thường là chưa apply migration
          0019_admin_activity_log. Thao tác vẫn chạy nhưng chưa được ghi lại.
          {readErr && (
            <span className="mt-1 block font-mono text-[0.75rem] font-normal">
              Lỗi thật: {readErr}
            </span>
          )}
        </p>
      )}

      {/* TỰ KIỂM TRA: ghi log là fire-and-forget nên nhật ký câm mà không ai
          biết vì sao (prod 2026-07-31: có thao tác thật mà bảng rỗng). Nút này
          ghi thử một dòng ngay và nói kết quả. */}
      <div className="surface flex flex-wrap items-center gap-3 px-4 py-3">
        <button
          type="button"
          disabled={probing}
          onClick={async () => {
            setProbing(true);
            setProbe(null);
            const r = await fetch(apiUrl("/api/admin/activity"), {
              method: "POST",
              headers: tokenHeader(),
            }).catch(() => null);
            const j = (await r?.json().catch(() => null)) as {
              ok?: boolean;
              wrote?: boolean;
              readBack?: number | null;
            } | null;
            setProbing(false);
            if (!r?.ok || !j?.ok) {
              setProbe("Không kết nối được với máy chủ. Vui lòng thử lại.");
              return;
            }
            setProbe(
              j.wrote
                ? `Đã kết nối thành công. Nhật ký hiện có khoảng ${j.readBack ?? "?"} dữ liệu.`
                : "Lỗi hệ thống — không lưu được nhật ký. Vui lòng kiểm tra mã lỗi trên hệ thống máy chủ (tìm \"activity-log\").",
            );
            if (j.wrote) load();
          }}
          className="min-h-[2.5rem] rounded-xl bg-field px-4 text-[0.875rem] font-bold text-navy disabled:opacity-50"
        >
          {probing ? "Đang kiểm tra hệ thống…" : "Kiểm tra trạng thái ghi nhật ký"}
        </button>
        {probe && (
          <span className="text-[0.875rem] font-semibold text-foreground/75">
            {probe}
          </span>
        )}
      </div>

      {/* lọc: tìm theo SĐT/tên hành động + chọn loại + chỉ nhạy cảm */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <input
          type="search"
          inputMode="search"
          placeholder="Tìm theo số điện thoại người thao tác hoặc tên hành động…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Tra cứu nhật ký"
          className="min-h-[2.75rem] w-full rounded-xl border-0 bg-field px-4 text-[0.9375rem] font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea sm:flex-1"
        />
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          aria-label="Phân loại thao tác"
          className="min-h-[2.75rem] rounded-xl border-0 bg-field px-3 text-[0.9375rem] font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea"
        >
          <option value="all">Tất cả các thao tác</option>
          {ADMIN_ACTIONS.map((a) => (
            <option key={a} value={a}>
              {actionLabel(a)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setDangerOnly((v) => !v)}
          aria-pressed={dangerOnly}
          className={`min-h-[2.75rem] shrink-0 rounded-xl px-4 text-[0.875rem] font-bold transition ${
            dangerOnly ? "bg-danger text-white" : "bg-field text-foreground/70"
          }`}
        >
          Chỉ xóa/nhạy cảm
        </button>
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
      {!events && !error && (
        <AdminSkeleton label="Đang tải nhật ký…" />
      )}
      {events && events.length === 0 && !error && (
        <p className="surface px-4 py-8 text-center text-[1rem] text-foreground/65">
          Chưa có hoạt động nào được ghi.
        </p>
      )}

      {visible && events && events.length > 0 && (
        <>
          <p className="px-1 text-[0.8125rem] font-semibold text-foreground/55">
            {visible.length === events.length
              ? `${events.length} hoạt động gần nhất`
              : `Hiển thị ${visible.length}/${events.length} hoạt động phù hợp`}
          </p>
          {visible.length === 0 ? (
            <p className="surface px-4 py-8 text-center text-[1rem] text-foreground/65">
              Không hoạt động nào khớp bộ lọc.
            </p>
          ) : (
            <ul className="surface overflow-hidden">
              {visible.map((e) => {
                const danger = isDangerAction(e.action);
                return (
                  <li
                    key={e.id}
                    className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-line px-4 py-2.5 last:border-b-0"
                  >
                    <span
                      className={`text-[0.9375rem] font-bold ${danger ? "text-danger" : "text-navy"}`}
                    >
                      {actionLabel(e.action)}
                    </span>
                    <span className="text-[0.875rem] tabular-nums text-foreground/70">
                      {e.actorPhone}
                    </span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[0.6875rem] font-bold ${
                        e.actorRole === "admin"
                          ? "bg-navy/10 text-navy"
                          : "bg-t1-bg text-t1"
                      }`}
                    >
                      {e.actorRole === "admin" ? "admin" : "nhân sự quản lý"}
                    </span>
                    {e.target && (
                      <span className="text-[0.8125rem] tabular-nums text-foreground/60">
                        → {e.target}
                      </span>
                    )}
                    {e.detail && Object.keys(e.detail).length > 0 && (
                      <span className="text-[0.75rem] text-foreground/45">
                        {summarizeDetail(e.detail)}
                      </span>
                    )}
                    <span className="ml-auto shrink-0 text-[0.75rem] tabular-nums text-foreground/50">
                      {fmtDT(e.createdAt)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

/** Gói `detail` jsonb thành chuỗi "khóa: giá trị" ngắn cho một dòng nhật ký. */
export function summarizeDetail(detail: Record<string, unknown>): string {
  return Object.entries(detail)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? "…" : String(v)}`)
    .join(" · ");
}
