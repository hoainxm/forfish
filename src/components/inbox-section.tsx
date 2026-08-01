"use client";

/**
 * Mục THÔNG BÁO ở trang chủ, ngay dưới "Bốn việc chính" (chủ dự án chốt
 * 2026-08-01).
 *
 * Vì sao đặt ở đây: thông báo đẩy vuốt tắt là mất; đây là chỗ DUY NHẤT đọc lại
 * được. Đặt dưới bốn việc chính để không tranh chỗ với việc chính, nhưng vẫn
 * nằm trong tầm mắt lần đầu mở app.
 *
 * Gọn theo luật mật độ (07-design-spec): mặc định chỉ **3 tin gần nhất**, bấm
 * mở ra xem tin cũ hơn. Không có tin thì ẨN HẲN — màn hình chính của bà con
 * không được có khối trống vô nghĩa.
 *
 * OFFLINE: đọc bản lưu trong máy TRƯỚC rồi mới gọi mạng để làm mới; mất sóng
 * thì vẫn hiện đủ tin cũ, không quay vòng chờ (xem lib/inbox.ts).
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuthUser } from "@/lib/use-auth";
import {
  loadInbox,
  refreshInbox,
  type InboxMessage,
} from "@/lib/inbox";

/** Mấy tin hiện sẵn khi chưa mở rộng */
const PREVIEW_COUNT = 3;

/** "14:30 · 01/08" — giờ gửi, thứ bà con cần để biết tin mới hay cũ */
function fmt(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())} · ${p(d.getDate())}/${p(
    d.getMonth() + 1,
  )}`;
}

export function InboxSection() {
  const { user, ready } = useAuthUser();
  const phone = user?.email ? user.email.split("@")[0] : null;
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [expanded, setExpanded] = useState(false);

  // 1) bản trong máy hiện NGAY (kể cả đang mất sóng)
  useEffect(() => {
    if (!ready) return;
    setMessages(loadInbox(phone));
  }, [ready, phone]);

  // 2) rồi mới làm mới từ máy chủ — hỏng thì giữ nguyên bản đang hiện
  const refresh = useCallback(() => {
    void refreshInbox().then((r) => {
      if (r?.messages) setMessages(r.messages);
    });
  }, []);
  useEffect(() => {
    if (!ready || !user) return;
    refresh();
    const onOnline = () => refresh();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [ready, user, refresh]);

  // chưa đăng nhập hoặc chưa có tin nào → ẩn hẳn, không để khối trống
  if (!user || messages.length === 0) return null;

  const shown = expanded ? messages : messages.slice(0, PREVIEW_COUNT);
  const rest = messages.length - shown.length;

  return (
    <section aria-label="Thông báo">
      <h2 className="display mb-1.5 px-1 text-[1.125rem] font-bold text-navy">
        Thông báo
      </h2>
      <ul className="space-y-2">
        {shown.map((m) => {
          const inner = (
            <>
              <span className="flex items-baseline justify-between gap-2">
                <span className="display text-[1.0625rem] font-bold leading-snug text-navy">
                  {m.title}
                </span>
                <span className="shrink-0 text-[0.8125rem] tabular-nums text-foreground/50">
                  {fmt(m.sentAt)}
                </span>
              </span>
              <span className="mt-0.5 block text-[1rem] leading-snug text-foreground/75">
                {m.body}
              </span>
              {m.mine && (
                <span className="mt-1 inline-block rounded-full bg-t1-bg px-2 py-0.5 text-[0.75rem] font-bold text-t1">
                  Gửi riêng cho bạn
                </span>
              )}
            </>
          );
          return (
            <li key={m.id}>
              {m.url ? (
                <Link
                  href={m.url}
                  className="block rounded-[1.125rem] bg-card px-4 py-3 shadow-sm ring-1 ring-line transition active:scale-[0.99]"
                >
                  {inner}
                </Link>
              ) : (
                <div className="rounded-[1.125rem] bg-card px-4 py-3 shadow-sm ring-1 ring-line">
                  {inner}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {(rest > 0 || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-2 min-h-[2.75rem] w-full rounded-full bg-field text-[0.9375rem] font-bold text-navy transition active:scale-[0.99]"
        >
          {expanded ? "Thu gọn" : `Xem ${rest} tin cũ hơn`}
        </button>
      )}
    </section>
  );
}
