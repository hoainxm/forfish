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

import { NHAN } from "@/lib/labels";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDownIcon, ChevronRightIcon } from "@/components/icons";
import { Popover } from "@/components/ui/popover";
import { baoToast } from "@/components/ui/toast";
import { useAuthUser } from "@/lib/use-auth";
import { staleWarningVN } from "@/lib/push-message";
import {
  BAO_HIEU_LUC_MS,
  acceptRefresh,
  anTin,
  boAnTin,
  chuaDocIds,
  gomTinTrung,
  khoaBaoTuUrl,
  linkConHieuLuc,
  loadHidden,
  loadInbox,
  loadSeen,
  locTinAn,
  markRead,
  markSeen,
  refreshInbox,
  unreportedIds,
  type InboxMessage,
} from "@/lib/inbox";

/** Mấy tin hiện sẵn khi chưa mở rộng */
const PREVIEW_COUNT = 3;
/** Mỗi lần "Xem thêm" xoè thêm bấy nhiêu hàng (TC-12: 25 hàng một lượt là trang dài 3 800px) */
const PAGE_COUNT = 10;
/** Nhớ số hàng đang xoè trong PHIÊN — sang màn khác quay lại không gập mất chỗ đang đọc */
const SHOWN_SS_KEY = "forfish.inbox.shown.v1";
/** Tin bão quá ngần này ngày thì "Tin cũ" không còn là cảnh báo — chỉ còn là mốc thời gian (cùng mốc hết link) */
const BAO_CANH_BAO_MS = BAO_HIEU_LUC_MS;

/** Nửa thẻ lọt vào màn hình thì tính là đã tới mắt bà con */
const SEEN_RATIO = 0.5;
/** Gom mấy tin lướt qua trong khoảng này thành MỘT cú báo — tiết kiệm sóng */
const BATCH_MS = 1200;

/** id của một dòng — `data-msg-id` có thể chứa nhiều id cách nhau dấu cách (tin trùng gom lại) */
function idsOf(el: HTMLElement): string[] {
  return (el.dataset.msgId ?? "").split(" ").filter(Boolean);
}

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
  /* SỐ HÀNG ĐANG XOÈ (TC-12): mặc định 3, mỗi "Xem thêm" +10, "Thu gọn" về 3 và cuộn
     về tiêu đề mục (nút nằm ở đáy — bấm xong nội dung co lại, màn nhảy). Đọc lại từ
     sessionStorage trong effect (không đọc lúc vẽ — bản máy chủ và bản vẽ đầu phải khớp). */
  const [shownCount, setShownCount] = useState(PREVIEW_COUNT);
  const headRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    try {
      const n = Number(window.sessionStorage.getItem(SHOWN_SS_KEY));
      if (Number.isFinite(n) && n > PREVIEW_COUNT) setShownCount(n);
    } catch {
      /* sessionStorage bị chặn — dùng mặc định */
    }
  }, []);
  const datShown = useCallback((n: number) => {
    setShownCount(n);
    try {
      if (n > PREVIEW_COUNT) window.sessionStorage.setItem(SHOWN_SS_KEY, String(n));
      else window.sessionStorage.removeItem(SHOWN_SS_KEY);
    } catch {
      /* không ghi được thì vẫn đổi cho lần vẽ này */
    }
  }, []);
  /*  TIN CHƯA ĐỌC (TC-05, 2026-10-25) = chưa có trong sổ ĐÃ THẤY `forfish.inbox.seen.v1`
      VÀ gửi trong 7 ngày. Trước đây lấy theo `read.v1` (đã báo về MÁY CHỦ) — mất sóng
      cả chuyến thì chấm không bao giờ tắt, tin chưa xoè ra thì "mới" mãi; số nói dối
      thì bà con bỏ qua luôn cả số thật. Sổ seen ghi máy ngay khi hàng tới mắt, không
      cần sóng; "đã báo về" vẫn chạy riêng bên dưới (thống kê). Không badge dock. */
  const [unread, setUnread] = useState<Set<string>>(new Set());
  const recomputeUnread = useCallback(
    (list: InboxMessage[]) => setUnread(chuaDocIds(list, loadSeen(phone), Date.now())),
    [phone],
  );
  /*  TIN ĐÃ ẨN (TC-18): bà con bấm ⋯ › Ẩn tin — chỉ bỏ khỏi màn, kho tin giữ nguyên.
      Đọc trong effect (kho máy), theo ngăn SĐT. */
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  useEffect(() => {
    setHidden(loadHidden(phone));
  }, [phone]);
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
      void markRead(phone, ids); // biên nhận thống kê — không còn quyết định chấm "chưa đọc"
    };
    // chỉ ngó tin CHƯA báo được lần nào — mở app lần thứ mười không gọi lại
    const fresh = new Set(
      unreportedIds(
        phone,
        [...root.querySelectorAll<HTMLElement>("[data-msg-id]")].flatMap(idsOf),
      ),
    );
    const seen = loadSeen(phone);
    const io = new IntersectionObserver(
      (entries) => {
        const vuaThay: string[] = [];
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          // một dòng có thể gom nhiều tin trùng (gomTinTrung) — tới mắt là đọc cả nhóm
          for (const id of idsOf(e.target as HTMLElement)) {
            if (!seen.has(id)) vuaThay.push(id);
            if (fresh.has(id)) pendingRef.current.add(id);
          }
          io.unobserve(e.target); // tới mắt một lần là đủ
        }
        /*  ĐÃ THẤY ghi máy NGAY (TC-05): không chờ gom, không chờ sóng — chấm tắt
            đúng lúc mắt vừa lướt qua, như FB. Máy không ghi được ⇒ chấm hiện lại lần
            sau, không mất gì nên không báo đỏ. */
        if (vuaThay.length > 0) {
          markSeen(phone, vuaThay);
          for (const id of vuaThay) seen.add(id);
          setUnread((u) => {
            const n = new Set(u);
            for (const id of vuaThay) n.delete(id);
            return n;
          });
        }
        if (pendingRef.current.size > 0 && timerRef.current === null) {
          timerRef.current = setTimeout(flush, BATCH_MS);
        }
      },
      { threshold: SEEN_RATIO },
    );
    for (const el of root.querySelectorAll<HTMLElement>("[data-msg-id]")) {
      const ids = idsOf(el);
      if (ids.some((id) => !seen.has(id) || (fresh.has(id) && !sentRef.current.has(id)))) io.observe(el);
    }
    return () => {
      io.disconnect();
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      flush(); // rời trang giữa chừng vẫn báo nốt phần đã thấy
    };
  }, [messages, shownCount, phone]);

  /*  ⋯ TRÊN HÀNG (TC-18): Popover neo nút, một dòng "Ẩn tin". Ẩn ghi kho máy, hàng biến
      mất, toast "Đã ẩn · Hoàn tác" (khuôn `baoToast` dùng chung). Máy không ghi được ⇒ nói
      thật, không ẩn giả. */
  const [menu, setMenu] = useState<{ anchor: HTMLElement; ids: string[] } | null>(null);
  const an = useCallback(
    (ids: string[]) => {
      setMenu(null);
      if (!anTin(phone, ids)) {
        baoToast("Máy không ghi được. Thử lại.", { loai: "xau" });
        return;
      }
      setHidden(loadHidden(phone));
      baoToast("Đã ẩn.", {
        hanhDong: {
          nhan: NHAN.hoanTac,
          onClick: () => {
            boAnTin(phone, ids);
            setHidden(loadHidden(phone));
          },
        },
      });
    },
    [phone],
  );

  /* Chưa có tin nào → ẩn hẳn, không để khối trống. KHÔNG chặn theo đăng nhập:
     máy chưa gắn tài khoản vẫn nhận được tin gửi chung qua push, mà vuốt tắt là
     mất — đúng cái lỗ hộp thư sinh ra để bịt (sửa 2026-08-01n). Tin nhắm riêng
     thì server vốn chỉ trả khi đã đăng nhập. */
  const conLai = locTinAn(messages, hidden);
  if (conLai.length === 0) return null;

  /*  MỘT DÒNG MỘT CƠN / MỘT NỘI DUNG (rà Taste 2026-10-22 · TC-01 2026-10-25): tin bão gom
      theo khoá cơn trong url (`bao=`), tin khác gom khi trùng chữ. Gom lúc vẽ, đuôi "N bản tin". */
  const groups = gomTinTrung(conLai);
  const shown = groups.slice(0, shownCount);
  const rest = groups.length - shown.length;
  const thuGonDuoc = shownCount > PREVIEW_COUNT;
  const soMoi = groups.filter((g) => g.ids.some((id) => unread.has(id))).length;

  /*  DỄ ĐỌC (làm lại 2026-10-19, chủ dự án: "làm sao đọc thông báo"): trước đây
      giờ tin 13px, nút "Xem hết" 11px, nhãn IN HOA "TIN CŨ…", mỗi tin một thẻ có
      viền + một cột mũi tên rỗng. Nay MỘT khối danh sách kẻ mảnh (như design
      Codex): tin mới chấm cam + tiêu đề đậm; nội dung đủ chữ 1.125rem; giờ gửi
      (và tuổi tin) một dòng riêng cùng cỡ; tin có đường dẫn thì cả hàng chạm được,
      mũi tên nằm TRONG hàng. Số tin mới lên hàng tiêu đề. Xem thêm = hàng cuối. */
  return (
    <section aria-label="Thông báo" ref={headRef}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="display text-[1rem] font-semibold text-navy">Thông báo</h2>
        {/* "N chưa đọc" (TC-05): số = dòng có tin chưa tới mắt trong 7 ngày — khác hẳn số hàng ẩn ở "Xem thêm" */}
        {soMoi > 0 && (
          <span className="rounded-full bg-trim px-2.5 py-0.5 text-[0.75rem] font-semibold text-white">{soMoi} chưa đọc</span>
        )}
      </div>
      <ul ref={listRef} className="divide-y divide-line overflow-hidden surface overflow-hidden">
        {shown.map(({ msg: m, ids }) => {
          const isUnread = ids.some((id) => unread.has(id));
          const sentMs = Date.parse(m.sentAt);
          const staleRaw =
            now > 0 && Number.isFinite(sentMs)
              ? staleWarningVN(sentMs, now)
              : null;
          // nhãn tuổi tin dùng chung với thông báo hệ điều hành (sw.js — IN HOA cho nổi
          // trên khay); trong app viết thường để không mất dấu, không gào
          const stale = staleRaw ? staleRaw.charAt(0) + staleRaw.slice(1).toLowerCase().replace(/\s*—\s*$/, "") : null;
          /*  TC-06: chữ "Tin cũ …" màu cảnh báo CHỈ cho tin bão còn trong 14 ngày — đó là tin
              mà đọc muộn mới nguy. Tin khác (nhắc tên trên Kairos, quảng bá) và bão đã qua
              lâu: một mốc tương đối "4 giờ trước · 25/10" màu phụ, không nói giờ hai lần.
              Luật §12 (tin tự khai tuổi) giữ nguyên — chỉ đổi cách tô. */
          const laBao = khoaBaoTuUrl(m.url) !== null;
          const canhBao = stale !== null && laBao && now - sentMs <= BAO_CANH_BAO_MS;
          const mocCu = stale ? stale.replace(/^tin cũ\s*/i, "") : null;
          const [gio, ngay] = fmt(m.sentAt).split(" · ");
          /*  Tin bão quá 14 ngày KHÔNG còn link (khu bản đồ 2026-10-25): bản đồ đã nói thật
              "đã tan", hàng không chevron để khỏi hứa một chỗ bay tới. */
          const coLink = now > 0 && linkConHieuLuc(m, now);
          const inner = (
            <>
              <span className="flex items-start gap-2">
                {isUnread && (
                  <span className="mt-2 inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-trim" aria-label="Chưa đọc" />
                )}
                <span className={`min-w-0 flex-1 text-[1rem] leading-snug text-navy ${isUnread ? "font-semibold" : "font-semibold"}`}>
                  {m.title}
                </span>
                {coLink && <ChevronRightIcon className="mt-0.5 h-5 w-5 shrink-0 text-foreground/50" />}
              </span>
              {/* TC-13: tin tay có body y hệt title ⇒ không in hai lần liền nhau */}
              {m.body !== m.title && (
                <span className="mt-1 block text-[1rem] leading-snug text-foreground/85">{m.body}</span>
              )}
              <span className="mt-1 block text-[0.8125rem] leading-snug text-foreground/65">
                {canhBao || !mocCu ? gio : mocCu}
                {ngay && ` · ${ngay}`}
                {canhBao && <span className="font-semibold text-warn"> · {stale}</span>}
                {ids.length > 1 && ` · ${ids.length} bản tin`}
                {/* TC-16: tin nhắc tên trên Kairos đương nhiên là riêng — không thêm đuôi */}
                {m.mine && !(m.url ?? "").startsWith("/kairos/") && " · Gửi riêng cho bà con"}
              </span>
            </>
          );
          return (
            <li key={m.id} data-msg-id={ids.join(" ")} className="flex items-start">
              {coLink && m.url ? (
                <Link href={m.url} className="block min-h-(--h-row) min-w-0 flex-1 py-3 pl-4 pr-1 active:bg-field">
                  {inner}
                </Link>
              ) : (
                <div className="min-w-0 flex-1 py-3 pl-4 pr-1">{inner}</div>
              )}
              {/* ⋯ sát phải như Kairos (post-card NutThem) — vùng chạm 2.75rem, không chữ */}
              <button
                type="button"
                aria-label="Thêm"
                aria-haspopup="menu"
                onClick={(e) => setMenu({ anchor: e.currentTarget, ids })}
                className="mr-1 mt-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[1.25rem] font-bold text-foreground/65 transition active:scale-[0.95]"
              >
                ⋯
              </button>
            </li>
          );
        })}
        {(rest > 0 || thuGonDuoc) && (
          /* TC-12: "Xem thêm" mỗi lần +10 hàng; "Thu gọn" về 3 hàng và cuộn về tiêu đề mục */
          <li className="flex divide-x divide-line">
            {rest > 0 && (
              <button
                type="button"
                onClick={() => datShown(shownCount + PAGE_COUNT)}
                className="flex min-h-(--h-row) flex-1 items-center justify-center gap-2 px-4 text-[1rem] font-semibold text-navy active:bg-field"
              >
                <ChevronDownIcon className="h-5 w-5" />
                {NHAN.xemThem}
                <span className="rounded-full bg-field px-2 py-0.5 text-[0.75rem] font-semibold text-foreground/70">{rest}</span>
              </button>
            )}
            {thuGonDuoc && (
              <button
                type="button"
                onClick={() => {
                  datShown(PREVIEW_COUNT);
                  headRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
                }}
                className="flex min-h-(--h-row) flex-1 items-center justify-center gap-2 px-4 text-[1rem] font-semibold text-navy active:bg-field"
              >
                <ChevronDownIcon className="h-5 w-5 rotate-180" />
                {NHAN.thuGon}
              </button>
            )}
          </li>
        )}
      </ul>
      {menu && (
        <Popover anchor={menu.anchor} label="Tuỳ chọn thông báo" role="menu" onClose={() => setMenu(null)} className="w-[12rem] p-1">
          <button
            type="button"
            role="menuitem"
            onClick={() => an(menu.ids)}
            className="flex min-h-(--h-row) w-full items-center rounded-xl px-3 text-left text-[1rem] font-semibold text-navy active:bg-field"
          >
            {NHAN.anTin}
          </button>
        </Popover>
      )}
    </section>
  );
}
