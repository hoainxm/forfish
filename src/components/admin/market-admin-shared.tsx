"use client";

/*
  Mảnh dùng chung của tab "Chợ vật tư" trong /quan-tri (12 §8.4).
  Khu quản trị là WEB DESKTOP-FIRST, độc lập giao diện với app ngư dân nhưng
  DÙNG CHUNG token màu — mọi màu ở đây là class token (bg-field, text-navy,
  bg-ok-bg…), không hex, không rgba.
*/

import { useCallback, useEffect, useRef, useState } from "react";
import { timeoutSignal } from "@/lib/abort";
import { apiUrl } from "@/lib/api-base";
import { tokenHeader } from "@/lib/device-token-store";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { ShopStatus } from "@/lib/market/types";

/** Đồng hồ chờ như phần còn lại của sàn: đọc 12 s · ghi 20 s (11 §9). */
const READ_MS = 12_000;
const WRITE_MS = 20_000;

const CODE_TEXT: Record<string, string> = {
  login_required: "Phiên đăng nhập đã hết — đăng nhập lại.",
  staff_only: "Tài khoản này không có quyền quản trị.",
  admin_only: "Chỉ quản trị viên mới xem được Chợ vật tư.",
  not_configured: "Chưa cấu hình Supabase/service-role — chợ cần kho thật.",
  unavailable: "Chưa tra được kho chợ — thử lại.",
  not_found: "Không tìm thấy — có thể vừa bị xoá.",
  bad_transition: "Bước này đã bị người khác làm trước — tải lại để xem trạng thái mới.",
  forbidden: "Không có quyền làm việc này.",
  internal: "Máy chủ đang lỗi — thử lại.",
};

/** Câu tiếng Việt cho một phản hồi lỗi: `message` của validate đi trước, rồi tới mã. */
export function marketAdminErrorText(code?: string, message?: string): string {
  if (message) return message;
  return (code && CODE_TEXT[code]) || "Chưa làm được — thử lại.";
}

async function call<T>(path: string, init: RequestInit, timeoutMs: number): Promise<T> {
  const r = await fetch(apiUrl(path), {
    ...init,
    headers: { ...(init.headers ?? {}), ...tokenHeader() },
    signal: timeoutSignal(timeoutMs),
  }).catch(() => null);
  if (!r) throw new Error("Không có mạng hoặc máy chủ không trả lời — thử lại.");
  const j = (await r.json().catch(() => null)) as
    | ({ ok?: boolean; code?: string; message?: string } & Record<string, unknown>)
    | null;
  if (!r.ok || !j?.ok) throw new Error(marketAdminErrorText(j?.code, j?.message));
  return j as T;
}

export function marketAdminGet<T>(path: string): Promise<T> {
  return call<T>(path, { method: "GET" }, READ_MS);
}

export function marketAdminPatch<T>(path: string, body: unknown): Promise<T> {
  return call<T>(
    path,
    { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
    WRITE_MS,
  );
}

/* ── Nhãn + chip ───────────────────────────────────────────────────────── */

export const SHOP_STATUS_LABEL: Record<ShopStatus, string> = {
  cho_duyet: "Chờ duyệt",
  hoat_dong: "Đang bán",
  tam_khoa: "Tạm khoá",
  tu_choi: "Bị từ chối",
};

/** Chip trạng thái SHOP — cùng bộ token với chip đơn (03 mục "Đặt hàng"). */
const SHOP_STATUS_CLASS: Record<ShopStatus, string> = {
  cho_duyet: "bg-warn-bg text-warn",
  hoat_dong: "bg-ok-bg text-ok",
  tam_khoa: "bg-danger-bg text-danger",
  tu_choi: "bg-field text-foreground/70",
};

export function ShopStatusChip({ status }: { status: ShopStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[0.75rem] font-bold ${SHOP_STATUS_CLASS[status]}`}
    >
      {SHOP_STATUS_LABEL[status]}
    </span>
  );
}

/** Chip lọc (khuôn các tab sẵn có của /quan-tri). */
export function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-[2.5rem] shrink-0 rounded-full px-4 text-[0.875rem] font-bold transition ${
        active ? "bg-navy text-white" : "bg-field text-foreground/70"
      }`}
    >
      {label}
    </button>
  );
}

/* ── Bốn nhánh trạng thái (trống / đang tải / lỗi / offline) ───────────── */

export function LoadingBox({ what }: { what: string }) {
  return (
    <p className="surface px-4 py-8 text-center text-[1rem] text-foreground/65">
      Đang tải {what}…
    </p>
  );
}

export function EmptyBox({ text }: { text: string }) {
  return <p className="surface px-4 py-8 text-center text-[1rem] text-foreground/65">{text}</p>;
}

export function ErrorBox({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div className="surface px-4 py-6 text-center">
      <p className="text-[1rem] text-danger">{text}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 min-h-[2.75rem] rounded-xl bg-navy px-6 text-[0.9375rem] font-bold text-white"
      >
        Thử lại
      </button>
    </div>
  );
}

/* ── Hộp xác nhận CÓ LÝ DO (từ chối / khoá / gỡ / huỷ đơn) ─────────────── */

/**
 * ConfirmDialog + ô lý do bắt buộc. Không có hành động ghi nào 1 chạm ở khu
 * này (11 §7). `minLen`/`maxLen` chặn ở client; server vẫn chặn lại
 * (validateStatusNote / validateCancelReason) — hai lớp, không tin lớp nào một mình.
 */
export function ReasonDialog({
  title,
  message,
  confirmLabel,
  placeholder,
  minLen = 5,
  maxLen = 300,
  suggestions = [],
  onCancel,
  onConfirm,
}: {
  title: string;
  message?: string;
  confirmLabel: string;
  placeholder: string;
  minLen?: number;
  maxLen?: number;
  suggestions?: string[];
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  /* ConfirmDialog dùng chung KHÔNG có cờ "vô hiệu nút xác nhận" (và nó không
     phải file của khu này để thêm). Bấm Xác nhận khi lý do chưa đủ ⇒ dựng lại
     hộp (đổi `key`) + tô đỏ dòng nhắc, KHÔNG gọi API và KHÔNG đóng im lặng.
     `reason` sống ở đây nên chữ đã gõ không mất khi hộp dựng lại. */
  const [attempt, setAttempt] = useState(0);
  const trimmed = reason.trim();
  const tooShort = trimmed.length < minLen;
  return (
    <ConfirmDialog
      key={attempt}
      title={title}
      message={message}
      confirmLabel={confirmLabel}
      cancelLabel="Không"
      danger
      onCancel={onCancel}
      onConfirm={() => {
        if (tooShort) {
          setAttempt((a) => a + 1);
          return;
        }
        onConfirm(trimmed);
      }}
    >
      <div className="mt-1 text-left">
        {suggestions.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setReason(s)}
                className="min-h-[2.5rem] rounded-full bg-field px-3 text-[0.8125rem] font-bold text-navy"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, maxLen))}
          placeholder={placeholder}
          rows={3}
          className="min-h-[3.5rem] w-full rounded-xl border-0 bg-field px-3 py-2 text-[1rem] focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea"
        />
        <p
          className={`mt-1 text-[0.8125rem] ${
            tooShort && (attempt > 0 || trimmed.length > 0) ? "text-danger" : "text-foreground/55"
          }`}
        >
          {tooShort
            ? `Ghi ít nhất ${minLen} chữ — người bán cần biết vì sao.`
            : `${trimmed.length}/${maxLen} chữ`}
        </p>
      </div>
    </ConfirmDialog>
  );
}

/* ── Báo kết quả một HÀNH ĐỘNG (khác lỗi tải danh sách) ────────────────── */

/**
 * Sau khi ghi (duyệt shop, xác nhận đơn, gỡ món…) danh sách được nạp lại ⇒ thẻ
 * vừa bấm bị dựng lại và mọi state trong nó biến mất. Nên câu trả lời "xong
 * chưa / hỏng vì sao" phải nằm ở CẤP DANH SÁCH, không nằm trong thẻ.
 * Khác `ErrorBox`: chỗ này KHÔNG có nút "Thử lại" — tải lại danh sách không
 * phải là làm lại việc vừa hỏng, mời lại sẽ dẫn admin đi sai đường.
 */
export function NoticeBar({
  ok,
  text,
  onClose,
}: {
  ok: boolean;
  text: string;
  onClose: () => void;
}) {
  return (
    <div
      role="status"
      className={`flex items-start justify-between gap-3 rounded-xl px-4 py-3 ${
        ok ? "bg-ok-bg text-ok" : "bg-danger-bg text-danger"
      }`}
    >
      <p className="text-[0.9375rem] font-semibold leading-snug">{text}</p>
      <button
        type="button"
        onClick={onClose}
        className="min-h-[2rem] shrink-0 rounded-lg px-2 text-[0.8125rem] font-bold underline"
      >
        Đóng
      </button>
    </div>
  );
}

/* ── Nói thật khi danh sách bị cắt + xem tiếp ──────────────────────────── */

/** Trang của mọi route `/api/admin/cho/*` (12 §7.3). Đổi ở đây thì đổi cả nhãn nút. */
const PAGE_SIZE = 20;

/**
 * Route trả 20 dòng/trang. Câu này LUÔN hiện (kể cả khi đã đủ) vì con số duy
 * nhất admin tin được là "bao nhiêu dòng KHỚP BỘ LỌC" — các ô KPI ở trên đếm
 * theo kỳ (hôm nay / 7 / 30 ngày) nên lệch với danh sách là chuyện bình
 * thường, không phải sai. Còn thiếu thì có nút xem tiếp, không bắt admin đoán.
 */
export function PageHint({
  shown,
  total,
  what,
  note,
  onMore,
  loadingMore,
}: {
  shown: number;
  total: number;
  what: string;
  /** Câu nói rõ PHẠM VI của danh sách này khi nó khác phạm vi của ô KPI. */
  note?: React.ReactNode;
  onMore?: () => void;
  loadingMore?: boolean;
}) {
  const rest = Math.max(0, total - shown);
  return (
    <div className="surface flex flex-wrap items-center justify-between gap-2 px-4 py-2">
      <p className="text-[0.875rem] leading-snug text-foreground/70">
        Đang xem <b className="tabular-nums text-navy">{shown}</b> trong tổng{" "}
        <b className="tabular-nums text-navy">{total}</b> {what} khớp bộ lọc, mới nhất trước.
        {note ? <> {note}</> : null}
      </p>
      {rest > 0 && onMore && (
        <button
          type="button"
          onClick={onMore}
          disabled={loadingMore}
          className="min-h-[2.75rem] rounded-xl bg-navy px-5 text-[0.9375rem] font-bold text-white disabled:opacity-50"
        >
          {loadingMore ? "Đang tải…" : `Xem thêm ${Math.min(rest, PAGE_SIZE)} ${what}`}
        </button>
      )}
    </div>
  );
}

/* ── Nạp một danh sách có phân trang (3 mục dùng chung) ────────────────── */

/**
 * Một danh sách admin = đường dẫn + phân trang + bốn nhánh trạng thái.
 * Ba mục (gian hàng · đơn · sản phẩm) làm giống hệt nhau nên gom về một chỗ:
 * - `path` đổi (lọc/tìm) ⇒ nạp lại từ trang 1;
 * - `loadMore()` nối trang sau vào cuối, KHÔNG xoá cái đang xem;
 * - `refresh()` (sau khi ghi) nạp lại trang 1 nhưng GIỮ danh sách cũ trên màn
 *   để không chớp trắng giữa lúc admin đang đọc;
 * - phản hồi tới trễ của lần nạp cũ bị bỏ (`runRef`) — lọc nhanh tay không
 *   làm danh sách nhảy về kết quả cũ.
 */
export function useAdminList<T>(path: string) {
  const [rows, setRows] = useState<T[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageRef = useRef(1);
  const runRef = useRef(0);

  const fetchPage = useCallback(
    (page: number, mode: "reset" | "append" | "refresh") => {
      const run = ++runRef.current;
      if (mode === "reset") {
        setRows(null);
        setError(null);
      }
      if (mode === "append") setLoadingMore(true);
      const sep = path.includes("?") ? "&" : "?";
      marketAdminGet<{ items: T[]; total: number }>(`${path}${sep}page=${page}`)
        .then((j) => {
          if (run !== runRef.current) return;
          pageRef.current = page;
          setTotal(j.total);
          setError(null);
          setRows((prev) => (mode === "append" && prev ? [...prev, ...j.items] : j.items));
        })
        .catch((e: Error) => {
          if (run === runRef.current) setError(e.message);
        })
        .finally(() => {
          if (run === runRef.current) setLoadingMore(false);
        });
    },
    [path],
  );

  const reload = useCallback(() => fetchPage(1, "reset"), [fetchPage]);
  const refresh = useCallback(() => fetchPage(1, "refresh"), [fetchPage]);
  const loadMore = useCallback(() => fetchPage(pageRef.current + 1, "append"), [fetchPage]);
  useEffect(reload, [reload]);

  return { rows, total, error, loadingMore, reload, refresh, loadMore };
}
