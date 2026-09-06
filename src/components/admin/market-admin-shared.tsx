"use client";

/*
  Mảnh dùng chung của tab "Chợ vật tư" trong /quan-tri (12 §8.4).
  Khu quản trị là WEB DESKTOP-FIRST, độc lập giao diện với app ngư dân nhưng
  DÙNG CHUNG token màu — mọi màu ở đây là class token (bg-field, text-navy,
  bg-ok-bg…), không hex, không rgba.
*/

import { useState } from "react";
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

/* ── Nói thật khi danh sách bị cắt ─────────────────────────────────────── */

/**
 * Route trả 20 dòng/trang. Bảng ở đây CHỈ hiện trang đầu — nên phải NÓI RA,
 * không để admin tưởng mình đang nhìn hết sàn rồi kết luận sai ("không có
 * shop nào chờ duyệt" trong khi có 25).
 * // nợ: chỉ trang đầu 20 dòng + lọc/tìm để thu hẹp, khi sàn quá ~50 gian hàng
 * //      hoặc admin phải cuộn tìm đơn cũ thì thêm nút "Xem thêm" (route đã có `?page=`)
 */
export function PageHint({ shown, total, what }: { shown: number; total: number; what: string }) {
  if (total <= shown) return null;
  return (
    <p className="surface px-4 py-2 text-[0.875rem] text-foreground/70">
      Đang xem <b className="tabular-nums text-navy">{shown}</b> {what} mới nhất trong tổng{" "}
      <b className="tabular-nums text-navy">{total}</b> — dùng ô lọc/tìm ở trên để thu hẹp.
    </p>
  );
}
