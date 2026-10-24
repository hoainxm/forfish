"use client";

/*
  DÒNG TIN KAIROS (14-ba-spec-kairos §3.2, §10; AC02 · AC03 · AC04 · AC06 · AC19).

  Thứ tự trên màn: ô mời "Bà con có chuyện gì?" · thanh "Có N bài mới" · dải ghim · dòng tin một
  cột cuộn vô tận (cursor 20 bài). KHÔNG hàng chip lọc (anh Long 2026-10-24: "dòng tin thì cứ cho
  đọc thôi, tổ chức lọc làm gì? facebook có lọc đâu?") — một dòng tin "Mới" duy nhất; Bến theo
  cảng vẫn ở /kairos/ben/[port] (vào từ bài gắn cảng).

  OFFLINE (ADR 0004, CLAUDE.md "ẢNH HƯỞNG OFFLINE"):
   · ĐỌC BẢN LƯU TRƯỚC (`forfish.kairos.v1`, ngăn theo SĐT), có sóng mới làm mới — mất sóng
     vẫn thấy bài cũ kèm "Lưu lúc HH:mm dd/MM"; chưa có bản lưu ⇒ "Có sóng sẽ tải".
   · Mọi fetch qua lib/kairos/feed-client: đồng hồ + không bao giờ ném. Không gọi gì lúc mở
     APP — chỉ khi bà con mở MÀN này. Không tự gửi gì.
   · Lỗi máy chủ / mất sóng giữa chừng GIỮ danh sách đang hiện (không xoá trắng).
   · "Có N bài mới": hỏi khi quay lại màn (visibilitychange) hoặc có sóng lại (online) —
     không realtime, không tự chèn bài. Có sóng lại mà đang ở trạng thái mất sóng/lỗi ⇒ tự
     tải lại trang đầu.

  THÓI QUEN (AC04) chỉ sống trong máy: chủ đề hay đọc + cảng nhà xếp bài TRONG TỪNG TRANG
  (lib/kairos/xep-bai) — bà con không phải bấm gì, như Facebook tự xếp.
*/

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmptyState } from "@/components/ui/primitives";
import { StatusBanner } from "@/components/ui/status-banner";
import { loadBoats, loadCurrentBoatId } from "@/lib/boats";
import {
  feedQuery,
  fetchFeedPage,
  fetchNewCount,
  filterCached,
  homeFromPort,
  loadFeedCache,
  loadHabit,
  savedAtLabel,
  saveFeedCache,
  saveHabit,
  type FeedPage,
} from "@/lib/kairos/feed-client";
import { emptyHabit, recordRead, setHome, type ChipId, type Habit } from "@/lib/kairos/thoi-quen";
import type { KairosPost } from "@/lib/kairos/types";
import { rankPage } from "@/lib/kairos/xep-bai";
import { ghiNhan, guiTinHieu } from "@/lib/kairos/gui-tin-hieu";
import { DUNG_TOI_DA_MS, XEM_TOI_THIEU_MS } from "@/lib/kairos/tin-hieu-doc";
import { NHAN } from "@/lib/labels";
import { useAuthUser } from "@/lib/use-auth";
import { PostCard, type PostActions } from "./post-card";
import { PostSkeleton } from "./post-skeleton";

type Load = "loading" | "ready" | "error" | "offline";

/** Cảng nhà từ sổ tàu (tàu đang chọn, không thì tàu đầu) — KHÔNG từ vị trí máy. */
function homeFromBoats(): Habit["home"] {
  const boats = loadBoats();
  const cur = loadCurrentBoatId();
  const b = boats.find((x) => x.id === cur) ?? boats[0];
  return homeFromPort(b?.homePortId);
}

/*  Dòng tin mặc định (không Bến) do MÁY CHỦ xếp theo người đọc (lib/kairos/phan-phoi.ts) ⇒ gửi kèm MÃ cảng/tỉnh
    nhà (không gửi hồ sơ đọc) và KHÔNG xếp lại đè lên. Bến: máy chủ trả theo giờ ⇒ app xếp trong trang như cũ. */
function voiNha(params: URLSearchParams, h: Habit, port: string | undefined): URLSearchParams {
  if (port) return params;
  const q = new URLSearchParams(params);
  if (h.home.port) q.set("nha", h.home.port);
  if (h.home.province) q.set("tinh", h.home.province);
  return q;
}
const xepApp = (list: KairosPost[], h: Habit, t: number, port: string | undefined) => (port ? rankPage(list, h, t) : list);

const dedupe = (a: KairosPost[], b: KairosPost[]) => {
  const seen = new Set(a.map((p) => p.id));
  return [...a, ...b.filter((p) => !seen.has(p.id))];
};

export function KairosFeed({
  port,
  actions,
  onCompose,
  view,
  added = [],
}: {
  /** Bến (/kairos/ben/[port]): dòng tin chỉ bài gắn cảng này, không hàng chip */
  port?: string;
  /** hành vi Hay / Chia sẻ / ba chấm — màn khác nối vào (thẻ vẫn hiện khi thiếu) */
  actions?: PostActions;
  /** mở khung soạn (AC07) */
  onCompose?: () => void;
  /** áp thay đổi cục bộ (Hay lạc quan, sửa, xoá, chặn — use-post-actions) lên bài đang hiện */
  view?: (list: readonly KairosPost[]) => KairosPost[];
  /** bài mình vừa đăng ở màn này — hiện đầu dòng tin tới lần tải sau */
  added?: KairosPost[];
}) {
  const { phone, ready: authReady } = useAuthUser();
  const [habit, setHabitState] = useState<Habit>(emptyHabit);
  /** một dòng tin duy nhất — bỏ hàng chip lọc 2026-10-24 */
  const chip: ChipId = "moi";
  const [posts, setPosts] = useState<KairosPost[]>([]);
  const [pinned, setPinned] = useState<KairosPost[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [load, setLoad] = useState<Load>("loading");
  const [errStatus, setErrStatus] = useState(0);
  /** đang hiện BẢN LƯU (mất sóng): giờ lưu; null = bài đang hiện là bài vừa tải */
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [more, setMore] = useState<"idle" | "loading" | "error">("idle");
  const [newCount, setNewCount] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  // Ref cho các nghe sự kiện (visibilitychange/online/IntersectionObserver) — khỏi gắn lại.
  const st = useRef({ chip, habit, load, next, more, since: null as string | null, phone, gen: 0, hasPosts: false, pinnedIds: new Set<string>() });
  const hasPosts = posts.length + pinned.length > 0;
  useEffect(() => {
    st.current = { ...st.current, chip, habit, load, next, more, phone, hasPosts, pinnedIds: new Set(pinned.map((p) => p.id)) };
  }, [chip, habit, load, next, more, phone, hasPosts, pinned]);

  const updateHabit = useCallback((h: Habit) => {
    setHabitState(h);
    saveHabit(h);
  }, []);

  /** Tải trang đầu. `keep` = giữ bài đang hiện khi mất sóng/lỗi (Thử lại, có sóng lại, pill). */
  const loadFirst = useCallback(
    async (chipWanted: ChipId, h: Habit, keep: boolean) => {
      const gen = ++st.current.gen;
      let c = chipWanted;
      let q = feedQuery(c, h.home, { port });
      if (!q.ok) {
        // lưới an toàn: dòng tin cần cảng nhà mà không có ⇒ về "Mới", KHÔNG để skeleton quay mãi
        c = "moi";
        q = feedQuery(c, h.home, { port });
      }
      setNewCount(0);
      setMore("idle");
      const cache = loadFeedCache(st.current.phone);
      const t0 = Date.now();
      const cached = cache ? rankPage(filterCached(cache.posts, c, h.home, port), h, t0) : [];
      if (!keep) {
        // đọc bản lưu TRƯỚC: có bài cũ thì hiện ngay trong lúc chờ mạng (không quay vòng trắng)
        setPosts(cached);
        setPinned([]);
        setNext(null);
        setSavedAt(null);
      }
      if (!q.ok) {
        setErrStatus(0);
        setLoad("error");
        return;
      }
      setLoad("loading");
      if (c === "theo-doi" && !st.current.phone) {
        setPosts([]);
        setLoad("error");
        setErrStatus(401);
        return;
      }
      const res = await fetchFeedPage(voiNha(q.params, h, port), null);
      if (gen !== st.current.gen) return; // bà con đã đổi chip — bỏ phản hồi cũ
      const t = Date.now();
      setNow(t);
      if (res.kind === "ok") {
        const page: FeedPage = res.value;
        setPosts(xepApp(page.posts, h, t, port));
        setPinned(page.pinned);
        setNext(page.next);
        setSavedAt(null);
        setLoad("ready");
        st.current.since = page.at;
        const w = saveFeedCache(st.current.phone, [...page.pinned, ...page.posts], t);
        // nợ: ghi bản lưu hỏng chỉ báo console, trần = lần sau mất sóng thấy bản cũ hơn; nâng khi có chỗ báo "máy đầy" chung
        if (!w.ok) console.warn("[kairos] không ghi được bản lưu dòng tin:", w.reason);
        return;
      }
      if (res.kind === "offline") {
        setLoad("offline");
        if (!keep || !st.current.hasPosts) {
          setPosts(cached);
          setSavedAt(cache && cached.length ? cache.savedAt : null);
        }
        return;
      }
      setErrStatus(res.status);
      setLoad("error");
    },
    [port],
  );

  // Mở màn: thói quen + cảng nhà (sổ tàu) rồi tải. Chờ auth để biết NGĂN bản lưu nào.
  const started = useRef(false);
  useEffect(() => {
    if (!authReady || started.current) return;
    started.current = true;
    let h = loadHabit();
    if (!h.home.port) {
      const home = homeFromBoats();
      if (home.port) {
        h = setHome(h, home);
        saveHabit(h);
      }
    }
    setHabitState(h);
    void loadFirst("moi", h, false);
  }, [authReady, loadFirst]);

  // Đổi tài khoản giữa chừng ⇒ tải lại theo ngăn mới (bản lưu cách ly theo SĐT).
  const lastPhone = useRef(phone);
  useEffect(() => {
    if (!started.current || lastPhone.current === phone) return;
    lastPhone.current = phone;
    void loadFirst(st.current.chip, st.current.habit, false);
  }, [phone, loadFirst]);

  // Quay lại màn / có sóng lại (AC06).
  useEffect(() => {
    const checkNew = () => {
      const s = st.current;
      if (s.load !== "ready" || !s.since) return;
      const q = feedQuery(s.chip, s.habit.home, { port });
      if (!q.ok) return;
      const gen = s.gen;
      void fetchNewCount(q.params, s.since).then((n) => {
        if (gen === st.current.gen) setNewCount(n);
      });
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        setNow(Date.now());
        checkNew();
      }
    };
    const onOnline = () => {
      const s = st.current;
      if (s.load === "offline" || s.load === "error") void loadFirst(s.chip, s.habit, true);
      else checkNew();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [loadFirst, port]);

  const loadMore = useCallback(async () => {
    const s = st.current;
    if (!s.next || s.more === "loading" || s.load !== "ready") return;
    const q = feedQuery(s.chip, s.habit.home, { port });
    if (!q.ok) return;
    const gen = s.gen;
    setMore("loading");
    st.current.more = "loading";
    const res = await fetchFeedPage(voiNha(q.params, s.habit, port), s.next);
    if (gen !== st.current.gen) return;
    if (res.kind !== "ok") {
      setMore("error");
      return;
    }
    const t = Date.now();
    // trang sau có thể lọt bài đang ghim (máy chủ chỉ bỏ ghim khỏi TRANG ĐẦU) ⇒ so cả dải ghim
    setPosts((cur) => dedupe(cur, xepApp(res.value.posts.filter((p) => !st.current.pinnedIds.has(p.id)), st.current.habit, t, port)));
    setNext(res.value.next);
    setMore("idle");
    const w = saveFeedCache(st.current.phone, res.value.posts, t);
    if (!w.ok) console.warn("[kairos] không ghi được bản lưu dòng tin:", w.reason);
  }, [port]);

  // Cuộn vô tận: mốc cuối danh sách lọt vào (sớm ~37.5rem ≈ 3 thẻ) thì tải trang sau.
  // rootMargin chỉ nhận px/% ⇒ đổi rem theo cỡ chữ gốc của máy (chế độ "Nút to" vẫn đúng).
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && void loadMore(), {
      rootMargin: `0% 0% ${Math.round(37.5 * rem)}px 0%`,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, next]);

  const onRead = useCallback(
    (p: KairosPost) => {
      updateHabit(recordRead(st.current.habit, p.topic));
      ghiNhan(st.current.phone, [{ post_id: p.id, views: 0, opened: true, dwell_ms: 0 }]);
    },
    [updateHabit],
  );

  /*  TÍN HIỆU ĐỌC cho cỗ máy phân phối (gui-tin-hieu.ts): thẻ nằm ≥ 50 % trên màn ≥ 1 s = một lần XEM, cộng thời
      gian dừng (trần 2 phút/lần). Gửi lô mỗi 20 s và khi app vào nền; mất sóng thì hàng đợi trong máy giữ lại.
      Khách chưa đăng nhập: không ghi gì. Không đổi gì trên màn. */
  const khungRef = useRef<HTMLDivElement>(null);
  const dangThay = useRef(new Map<string, number>());
  const ioRef = useRef<IntersectionObserver | null>(null);
  // MỘT bộ quan sát cho cả đời màn (tạo lại mỗi lần vẽ là đếm "xem" sai)
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const thay = dangThay.current;
    const ket = (id: string, t: number) => {
      const t0 = thay.get(id);
      thay.delete(id);
      if (t0 == null) return;
      const ms = Math.min(t - t0, DUNG_TOI_DA_MS);
      if (ms >= XEM_TOI_THIEU_MS) ghiNhan(st.current.phone, [{ post_id: id, views: 1, opened: false, dwell_ms: ms }]);
    };
    const io = new IntersectionObserver(
      (es) => {
        const t = Date.now();
        for (const e of es) {
          const id = (e.target as HTMLElement).dataset.kairosId;
          if (!id) continue;
          if (e.isIntersecting) {
            if (!thay.has(id)) thay.set(id, t);
          } else ket(id, t);
        }
      },
      { threshold: 0.5 },
    );
    ioRef.current = io;
    return () => {
      io.disconnect();
      ioRef.current = null;
      const t = Date.now();
      for (const id of [...thay.keys()]) ket(id, t);
    };
  }, []);
  useEffect(() => {
    const gui = () => void guiTinHieu(st.current.phone);
    const nen = () => {
      if (document.visibilityState !== "hidden") return;
      const t = Date.now();
      for (const [id, t0] of [...dangThay.current]) {
        dangThay.current.set(id, t);
        const ms = Math.min(t - t0, DUNG_TOI_DA_MS);
        if (ms >= XEM_TOI_THIEU_MS) ghiNhan(st.current.phone, [{ post_id: id, views: 1, opened: false, dwell_ms: ms }]);
      }
      gui();
    };
    const iv = setInterval(gui, 20_000);
    document.addEventListener("visibilitychange", nen);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", nen);
      gui();
    };
  }, []);

  const showNew = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    void loadFirst(chip, habit, true);
  };

  const shownPinned = view ? view(pinned) : pinned;
  const shownPosts = useMemo(() => {
    // một bài chỉ hiện MỘT lần: đang ghim thì chỉ ở dải ghim
    const pinIds = new Set(shownPinned.map((x) => x.id));
    const list = (view ? view(posts) : posts).filter((p) => !pinIds.has(p.id));
    if (!added.length) return list;
    const fresh = added.filter((p) => !list.some((x) => x.id === p.id) && !shownPinned.some((x) => x.id === p.id));
    return [...fresh, ...list];
  }, [view, posts, added, shownPinned]);
  const empty = shownPosts.length === 0 && shownPinned.length === 0;
  useEffect(() => {
    const io = ioRef.current;
    if (!io) return;
    khungRef.current?.querySelectorAll<HTMLElement>("[data-kairos-id]").forEach((el) => io.observe(el));
  }, [shownPosts, shownPinned]);
  const retry = () => void loadFirst(chip, habit, true);

  return (
    <div className="pb-4">
      <div className="px-4 pb-3">
        <button
          type="button"
          onClick={onCompose}
          className="surface flex h-14 w-full items-center px-4 text-left text-[1rem] text-foreground/65 transition active:scale-[0.99]"
        >
          Bà con có chuyện gì?
        </button>
      </div>

      {load === "offline" && !empty && (
        <StatusBanner level="warn">{savedAt ? `Mất sóng — bài lưu lúc ${savedAtLabel(savedAt)}` : "Mất sóng — đang xem bài đã tải"}</StatusBanner>
      )}

      {newCount > 0 && (
        <div className="sticky top-2 z-10 flex justify-center px-4 pb-2">
          <button type="button" onClick={showNew} className="h-10 rounded-full bg-sea px-4 text-[0.875rem] font-semibold text-white shadow-md">
            Có {newCount >= 99 ? "99+" : newCount} bài mới
          </button>
        </div>
      )}

      <div ref={khungRef} className="space-y-3 px-4">
        {load === "error" && !empty && (
          <div className="surface flex items-center gap-3 p-3">
            <p className="flex-1 text-[1rem]">Chưa tải được bài mới.</p>
            <button type="button" onClick={retry} className="h-10 rounded-xl border border-line px-3 font-semibold text-sea">
              {NHAN.thuLai}
            </button>
          </div>
        )}

        {empty && load === "loading" && <PostSkeleton />}
        {empty && load === "offline" && (
          <EmptyState>Mất sóng. Có sóng sẽ tải.</EmptyState>
        )}
        {empty && load === "error" &&
          (errStatus === 401 ? (
            <EmptyState>
              Đăng nhập để xem bài người bạn theo dõi.{" "}
              <Link href="/login" className="font-semibold text-sea">
                {NHAN.dangNhap}
              </Link>
            </EmptyState>
          ) : (
            <div className="surface p-4 text-center">
              <p className="mb-3">Chưa tải được dòng tin.</p>
              <button type="button" onClick={retry} className="h-11 rounded-xl border border-line px-4 font-semibold text-sea">
                {NHAN.thuLai}
              </button>
            </div>
          ))}
        {empty && load === "ready" && (
          <EmptyState>
            {port ? "Bến này chưa có bài nào." : "Chưa có bài nào. Bà con đăng bài đầu tiên nhé."}
          </EmptyState>
        )}

        {shownPinned.map((p) => (
          <div key={`pin-${p.id}`} data-kairos-id={p.id}>
            <PostCard post={p} now={now} actions={actions} onRead={onRead} benPort={port} />
          </div>
        ))}
        {shownPosts.map((p) => (
          <div key={p.id} data-kairos-id={p.id}>
            <PostCard post={p} now={now} actions={actions} onRead={onRead} benPort={port} />
          </div>
        ))}

        {more === "loading" && <PostSkeleton count={1} />}
        {more === "error" && (
          <div className="flex items-center justify-center gap-3 py-2">
            <span className="text-[0.875rem] text-foreground/65">Chưa tải thêm được.</span>
            <button type="button" onClick={() => void loadMore()} className="h-10 rounded-xl border border-line px-3 font-semibold text-sea">
              {NHAN.thuLai}
            </button>
          </div>
        )}
        {!empty && load === "ready" && !next && more === "idle" && (
          <p className="py-3 text-center text-[0.875rem] text-foreground/65">Hết bài</p>
        )}
        <div ref={sentinel} aria-hidden className="h-[0.0625rem]" />
      </div>

    </div>
  );
}
