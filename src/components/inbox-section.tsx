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

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDownIcon, ChevronRightIcon } from "@/components/icons";
import { SQ_BTN } from "@/components/ui/sq-btn";
import { useAuthUser } from "@/lib/use-auth";
import { staleWarningVN } from "@/lib/push-message";
import {
  acceptRefresh,
  loadInbox,
  markRead,
  refreshInbox,
  unreportedIds,
  type InboxMessage,
} from "@/lib/inbox";

/** Mấy tin hiện sẵn khi chưa mở rộng */
const PREVIEW_COUNT = 3;

/** Nửa thẻ lọt vào màn hình thì tính là đã tới mắt bà con */
const SEEN_RATIO = 0.5;
/** Gom mấy tin lướt qua trong khoảng này thành MỘT cú báo — tiết kiệm sóng */
const BATCH_MS = 1200;

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
  /* `phone` chỉ để biết ĐANG là tài khoản nào (chọn đúng ngăn bản lưu trong
     máy) — KHÔNG dùng để chặn hiện mục này.

     LẤY TỪ useAuthUser, KHÔNG tự bóc `user.email` nữa (sửa 2026-08-02, C-1):
     mất sóng quá 1 giờ thì `user` tụt về null (token hết hạn, refresh không
     tới máy chủ) ⇒ tự bóc sẽ ra null ⇒ tra ngăn khách ⇒ hộp thư BIẾN MẤT giữa
     biển dù tin bão vẫn nằm nguyên trong máy. `phone` của hook có đường lùi về
     danh tính offline nên vẫn chỉ đúng ngăn. */
  const { phone, ready } = useAuthUser();
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [expanded, setExpanded] = useState(false);
  /*  TIN CHƯA ĐỌC = chưa nằm trong `forfish.inbox.read.v1` (đã báo về được theo
      IO) — chấm + viền đậm (audit 2026-08-18 P4). Tính trong effect (đọc kho),
      tính lại khi hộp thư đổi hoặc khi vừa báo về xong. Không badge dock. */
  const [unread, setUnread] = useState<Set<string>>(new Set());
  const recomputeUnread = useCallback(
    (list: InboxMessage[]) =>
      setUnread(
        new Set(
          unreportedIds(
            phone,
            list.map((m) => m.id),
          ),
        ),
      ),
    [phone],
  );
  /*  "TIN CŨ N NGÀY —" tính từ giờ GỬI tới lúc VẼ (audit P5): tin bão đọc muộn
      2 tuần phải tự khai tuổi, cùng luật với thông báo hệ điều hành (sw.js).
      `now` chốt trong effect mỗi khi hộp thư đổi — đủ cho hộp thư, không cần
      đồng hồ chạy (và không gọi Date.now() lúc vẽ). */
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    recomputeUnread(messages);
  }, [messages, recomputeUnread]);

  /* 1) bản trong máy hiện NGAY (kể cả đang mất sóng).
     KHÔNG chờ `ready` (F3): đọc bản lưu chỉ cần biết chọn ngăn nào, nó không
     cần auth "đã xong". Ở sóng "sống mà chết", `ready` mất tới 8 giây — tám
     giây trắng đúng lúc bà con mở app tìm lại tin bão. */
  useEffect(() => {
    setMessages(loadInbox(phone));
  }, [phone]);

  /* 2) rồi mới làm mới từ máy chủ — hỏng thì giữ nguyên bản đang hiện.
     SO NGĂN TRƯỚC KHI VẼ (sửa 2026-08-02, C-1/R2): máy chủ trả 200 kèm
     `phone:null, messages:[chỉ tin chung]` khi không đọc được phiên (token hết
     hạn giữa biển là chuyện thường), nên `!ok` không bắt được và hai tin nhắm
     riêng BIẾN KHỎI MÀN HÌNH dù vẫn nằm nguyên trong máy — phải tắt hẳn app mới
     thấy lại. `saveInbox` có lá chắn này rồi, `setMessages` thì chưa.
     Deps phải có `phone`: bản cũ `useCallback(…, [])` nên hàm này KHÔNG HỀ THẤY
     `phone`, có muốn so cũng so vào giá trị đầu tiên. */
  const refresh = useCallback(() => {
    void refreshInbox().then((r) => {
      if (!r) return; // mất sóng — giữ nguyên bản đang hiện
      if (!acceptRefresh(phone, r.phone)) return; // câu trả lời của NGĂN KHÁC
      setMessages(r.messages);
    });
  }, [phone]);
  useEffect(() => {
    if (!ready) return;
    refresh();
    const onOnline = () => refresh();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [ready, refresh]);

  /* ── BÁO VỀ "ĐÃ ĐỌC" (0024) ───────────────────────────────────────────────
     Thẻ tin ở đây hiện SẴN cả tiêu đề lẫn nội dung — không có gì để "mở ra".
     Nên mốc đọc đúng là lúc THẺ TỚI TRƯỚC MẮT, không phải lúc bấm (đa số tin
     không có link, bấm cũng chẳng đi đâu). Tin còn nằm sau nút "Xem N tin cũ
     hơn" thì chưa vẽ ra ⇒ tự động không bị tính.

     KHÔNG cản gì cả: quan sát bằng IntersectionObserver, gửi bắn-rồi-quên,
     mất sóng thì lib bỏ qua và lần mở app sau báo lại (xem lib/inbox.ts). */
  const listRef = useRef<HTMLUListElement | null>(null);
  const pendingRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* Đã bắn đi trong PHIÊN này. Bản lưu chỉ được ghi SAU khi máy chủ xác nhận,
     nên trong lúc chờ mà hộp thư làm mới (effect chạy lại) thì `unreportedIds`
     vẫn nói "chưa báo" ⇒ bắn trùng. Sổ này bịt chỗ đó — sóng ngoài biển tính
     bằng tiền. Máy chủ vốn cũng chịu được trùng (ignoreDuplicates), đây là
     lớp thứ hai. */
  const sentRef = useRef<Set<string>>(new Set());
  // Đổi tài khoản trên cùng máy = NGƯỜI ĐỌC khác ⇒ sổ của người trước không
  // được chặn người sau (máy dùng chung trên tàu, cùng luật với bản lưu).
  useEffect(() => {
    sentRef.current = new Set();
  }, [phone]);
  useEffect(() => {
    const root = listRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;

    const flush = () => {
      timerRef.current = null;
      const ids = [...pendingRef.current].filter((id) => !sentRef.current.has(id));
      pendingRef.current.clear();
      if (ids.length === 0) return;
      for (const id of ids) sentRef.current.add(id);
      // báo về xong (máy chủ xác nhận, kho đã ghi) → chấm "chưa đọc" tự tắt
      void markRead(phone, ids).then(() => recomputeUnread(messages));
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const id = (e.target as HTMLElement).dataset.msgId;
          if (id) pendingRef.current.add(id);
          io.unobserve(e.target); // tới mắt một lần là đủ
        }
        if (pendingRef.current.size > 0 && timerRef.current === null) {
          timerRef.current = setTimeout(flush, BATCH_MS);
        }
      },
      { threshold: SEEN_RATIO },
    );
    // chỉ ngó tin CHƯA báo được lần nào — mở app lần thứ mười không gọi lại
    const fresh = new Set(
      unreportedIds(
        phone,
        [...root.querySelectorAll<HTMLElement>("[data-msg-id]")].map(
          (el) => el.dataset.msgId ?? "",
        ),
      ),
    );
    for (const el of root.querySelectorAll<HTMLElement>("[data-msg-id]")) {
      const id = el.dataset.msgId ?? "";
      if (fresh.has(id) && !sentRef.current.has(id)) io.observe(el);
    }
    return () => {
      io.disconnect();
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      flush(); // rời trang giữa chừng vẫn báo nốt phần đã thấy
    };
  }, [messages, expanded, phone, recomputeUnread]);

  /* Chưa có tin nào → ẩn hẳn, không để khối trống. KHÔNG chặn theo đăng nhập:
     máy chưa gắn tài khoản vẫn nhận được tin gửi chung qua push, mà vuốt tắt là
     mất — đúng cái lỗ hộp thư sinh ra để bịt (sửa 2026-08-01n). Tin nhắm riêng
     thì server vốn chỉ trả khi đã đăng nhập. */
  if (messages.length === 0) return null;

  const shown = expanded ? messages : messages.slice(0, PREVIEW_COUNT);
  const rest = messages.length - shown.length;
  /*  CHỈ CHỪA CỘT NÚT KHI DANH SÁCH THẬT SỰ CÓ NÚT (2026-08-29).
      Luật B1 nói mọi hàng chừa đúng một ô w-16 để mép phải thẳng — nhưng đo lại
      thấy đa số tin không mang `url`, nên cả danh sách chừa một cột RỖNG: bề
      ngang chữ tụt 343 → 271px (mất 21%) mà không hàng nào dùng tới cột đó.
      Chừa cột là để các hàng THẲNG NHAU, không phải để thẳng với một danh sách
      khác ở khối khác. Không hàng nào có nút ⇒ không có gì để thẳng ⇒ trả bề
      ngang lại cho chữ. */
  const coChevron = shown.some((m) => m.url);

  return (
    <section aria-label="Thông báo">
      {/*  Nút xoè/thu về INLINE cuối hàng tiêu đề (2026-08-29, luật A2/A3/A5):
          trước là dải 343×44 (dưới sàn 52px) rộng bằng cả thẻ tin bên trên nên
          trông như một thẻ tin nữa. Số tin là DỮ LIỆU ⇒ lên hàng tiêu đề. */}
      <div className="mb-1.5 flex items-stretch gap-2 px-1">
        <div className="flex min-w-0 flex-1 items-center">
          <h2 className="display text-[1.125rem] font-bold text-navy">
            Thông báo
            {rest > 0 && (
              <span className="text-[1rem] font-semibold text-foreground/70">
                {" "}
                · còn {rest} tin cũ hơn
              </span>
            )}
          </h2>
        </div>
        {rest > 0 || expanded ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className={`${SQ_BTN} bg-field text-navy`}
          >
            <ChevronDownIcon
              className={`h-6 w-6 ${expanded ? "rotate-180" : ""}`}
            />
            {expanded ? "Thu gọn" : "Xem hết"}
          </button>
        ) : (
          <span className="w-16 shrink-0" aria-hidden />
        )}
      </div>
      <ul ref={listRef} className="space-y-2">
        {shown.map((m) => {
          const isUnread = unread.has(m.id);
          const sentMs = Date.parse(m.sentAt);
          const stale =
            now > 0 && Number.isFinite(sentMs)
              ? staleWarningVN(sentMs, now)
              : null;
          const cardClass = isUnread
            ? "block rounded-[1.125rem] bg-card px-4 py-3 shadow-sm ring-2 ring-navy/60"
            : "block rounded-[1.125rem] bg-card px-4 py-3 shadow-sm ring-1 ring-line";
          const inner = (
            <>
              <span className="flex items-baseline justify-between gap-2">
                <span className="display flex min-w-0 items-baseline gap-2 text-[1rem] font-bold leading-snug text-navy">
                  {isUnread && (
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 self-center rounded-full bg-trim"
                      aria-label="Chưa đọc"
                    />
                  )}
                  <span className="min-w-0">{m.title}</span>
                </span>
                <span className="shrink-0 text-[0.8125rem] tabular-nums text-foreground/70">
                  {fmt(m.sentAt)}
                </span>
              </span>
              <span className="mt-0.5 block text-[1rem] leading-snug text-foreground/75">
                {stale && (
                  <span className="font-bold text-warn">{stale} </span>
                )}
                {m.body}
              </span>
              {m.mine && (
                <span className="mt-1 inline-block rounded-full bg-t1-bg px-2 py-0.5 text-[0.75rem] font-bold text-t1">
                  Gửi riêng cho bạn
                </span>
              )}
            </>
          );
          /*  Khuôn hàng chung (luật B1): [thân flex-1 min-w-0] + [ô w-16].
              Thẻ không có url vẫn chừa ô đó ĐỂ THẲNG với thẻ có url — nhưng chỉ
              khi trong danh sách có ít nhất một thẻ mang url (xem `coChevron`). */
          return (
            <li key={m.id} data-msg-id={m.id} className="flex items-stretch gap-2">
              {m.url ? (
                <>
                  <Link
                    href={m.url}
                    className={`${cardClass} min-w-0 flex-1 transition active:scale-[0.99]`}
                  >
                    {inner}
                  </Link>
                  <span
                    className="flex w-16 shrink-0 items-center justify-center text-foreground/30"
                    aria-hidden
                  >
                    <ChevronRightIcon className="h-6 w-6" />
                  </span>
                </>
              ) : (
                <>
                  <div className={`${cardClass} min-w-0 flex-1`}>{inner}</div>
                  {coChevron && <span className="w-16 shrink-0" aria-hidden />}
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
