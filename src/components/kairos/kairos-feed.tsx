"use client";

/*
  DÒNG TIN KAIROS (14-ba-spec-kairos §3.2, §10; AC02 · AC03 · AC04 · AC06 · AC19).

  Thứ tự trên màn: ô mời "Bà con muốn chia sẻ gì?" · thanh "Có N bài mới" · dải ghim · dòng tin một
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

  TẢI TIN MANG ĐI (14 §19, CHỈ dòng tin chung — không Bến): lần đầu trang đầu tải được trên màn này, có sóng tốt
  (tai-mang-di.songTot) mà bản lưu LÚC MỞ MÀN cũ hơn 6 giờ hoặc bản lưu dưới 40 bài ⇒ một dòng gợi ý dưới ô mời
  "Sắp ra khơi? Tải 100 bài mới…" + Để sau · Tải. Bấm Tải ⇒ ≤5 trang (fetchFeedPage, đồng hồ, không ném) gộp vào
  bản lưu (cắt bài Kairos cũ khi đầy, không đụng forfish.fc.*). Để sau ⇒ ẩn 24 giờ (`forfish.kairos.taimangdi.v1`).
  Không bấm thì không gửi gì.

  TUỲ CHỌN DÒNG TIN (14 §13, nút bánh răng ở kairos-screen): chủ đề "Thích đọc" + cờ ẩn bài trợ lý AI đi kèm
  MỌI request trang của dòng tin chung (`thich`, `ai=0` — lib/kairos/tuy-chon.ts), không request mới. Đổi ⇒ tải
  lại trang đầu, GIỮ bài đang hiện khi mất sóng. Bến không dùng.

  GIỮ CHỖ ĐANG ĐỌC (rà FB vòng 2, 2026-10-24): rời màn (mở bài, trang cá nhân…) ⇒ cất ảnh chụp bài đang hiện + chỗ
  cuộn vào BỘ NHỚ (lib/kairos/giu-cho, không localStorage, sống 10 phút, theo cảng + SĐT). Quay lại ⇒ dựng lại y
  nguyên, KHÔNG tải lại trang đầu, cuộn về chỗ cũ sau hai nhịp vẽ, rồi chỉ hỏi "Có N bài mới" (fetchNewCount sẵn
  có — không thêm request). Kéo làm mới ⇒ xoá ảnh chụp.

  BẾN (port) giống NHÓM Facebook: thẻ đầu (dải bìa + "Bến X" + tỉnh · số bài đã tải + câu mô tả + Đăng · Cảng nhà).
  "Cảng nhà" chỉ ghi THÓI QUEN TRONG MÁY (setHome — như hộp chọn cảng), không gửi đi, không đếm thành viên.
*/

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon } from "@/components/icons";
import { EmptyState } from "@/components/ui/primitives";
import { CloseButton } from "@/components/ui/close-button";
import { OfflineLine } from "@/components/ui/offline-line";
import { baoToast } from "@/components/ui/toast";
import { FISHING_PORTS } from "@/data/fishing-ports";
import { loadBoats, loadCurrentBoatId } from "@/lib/boats";
import {
  feedQuery,
  fetchFeedPage,
  fetchNewCount,
  filterCached,
  homeFromPort,
  loadFeedCache,
  loadHabit,
  saveFeedCache,
  saveHabit,
  loadTuyChon,
  loadTaiMangDiAn,
  saveTaiMangDiAn,
  type FeedPage,
} from "@/lib/kairos/feed-client";
import { cat as catCho, lay as layCho, xoa as xoaCho } from "@/lib/kairos/giu-cho";
import { KeoLamMoiChi, useKeoLamMoi } from "@/components/ui/use-keo-lam-moi";
import { nenGoiY, soBaiConLuu, songTot, taiNhieuTrang } from "@/lib/kairos/tai-mang-di";
import { pillTaiMangDi, toastTaiMangDi } from "@/lib/kairos/dau-man";
import { emptyHabit, recordRead, setHome, type ChipId, type Habit } from "@/lib/kairos/thoi-quen";
import { giongNhau, themThamSo, tuyChonMacDinh, type TuyChon } from "@/lib/kairos/tuy-chon";
import type { KairosPost } from "@/lib/kairos/types";
import { rankPage } from "@/lib/kairos/xep-bai";
import { ghiNhan, guiTinHieu } from "@/lib/kairos/gui-tin-hieu";
import { DUNG_TOI_DA_MS, XEM_TOI_THIEU_MS } from "@/lib/kairos/tin-hieu-doc";
import { NHAN } from "@/lib/labels";
import { useAuthUser } from "@/lib/use-auth";
import { PostCard, type PostActions } from "./post-card";
import { TheTaiTroCard } from "./the-tai-tro";
import { theSauBai, type TheTaiTro } from "@/lib/kairos/quang-cao";

/** Bài Tài trợ của lượt tải trang đầu gần nhất — giữ qua lần quay lại màn (dựng lại từ ảnh chụp không có `ads`). */
let adsNho: TheTaiTro[] = [];
import { KairosFishIcon } from "./kairos-fish-icon";
import { PostSkeleton } from "./post-skeleton";

type Load = "loading" | "ready" | "error" | "offline";
/** Pill "Tải tin mang đi" (14 §19, E K3-03): xong/đầy báo bằng toast rồi về `an` — chữ ở `lib/kairos/dau-man`. */
type GoiY = { k: "an" | "hien" | "dang" | "loi" };
/** Ảnh chụp dòng tin cất khi rời màn (giu-cho) — quay lại thì dựng lại, không tải lại. */
type AnhChup = {
  /** khoá (cảng, tab, tỉnh) của danh sách LÚC CHỤP — chỉ cất/dựng khi khớp khoá đích (anh Long 2026-10-26: tab Chính sách
   *  hiện tin Lao Động/Dân Việt — ảnh chụp Dòng tin bị cất nhầm dưới khoá Chính sách lúc đổi tab/tỉnh) */
  khoa: string;
  phone: string | null;
  posts: KairosPost[];
  pinned: KairosPost[];
  next: string | null;
  savedAt: number | null;
  since: string | null;
  load: "ready" | "offline";
  scrollY: number;
  at: number;
};
const khoaCho = (port: string | undefined, chip: ChipId = "moi", tinh: string | null = null) => `feed:${port ?? ""}:${chip}:${tinh ?? ""}`;

/** Cảng nhà từ sổ tàu (tàu đang chọn, không thì tàu đầu) — KHÔNG từ vị trí máy. */
function homeFromBoats(): Habit["home"] {
  const boats = loadBoats();
  const cur = loadCurrentBoatId();
  const b = boats.find((x) => x.id === cur) ?? boats[0];
  return homeFromPort(b?.homePortId);
}

/*  Dòng tin mặc định (không Bến) do MÁY CHỦ xếp theo người đọc (lib/kairos/phan-phoi.ts) ⇒ gửi kèm MÃ cảng/tỉnh
    nhà (không gửi hồ sơ đọc) và KHÔNG xếp lại đè lên. Bến: máy chủ trả theo giờ ⇒ app xếp trong trang như cũ. */
function voiNha(params: URLSearchParams, h: Habit, port: string | undefined, tc: TuyChon): URLSearchParams {
  if (port) return params;
  const q = themThamSo(params, tc);
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
  tuyChon,
  onTrong,
  chip = "moi",
  tinh = null,
}: {
  /** Bến (/kairos/ben/[port]): dòng tin chỉ bài gắn cảng này, không hàng chip */
  port?: string;
  /** "moi" = dòng tin chung (mặc định); "chinh-sach" = tab Chính sách (14 §21): chỉ thông báo nhà nước, không ô mời
   *  đăng, không bài Tài trợ, không pill Tải tin. Màn cha đổi tab ⇒ tải lại trang đầu (giữ bài khi mất sóng). */
  chip?: ChipId;
  /** tab Chính sách: mã tỉnh đang xem (tỉnh cảng nhà / chọn tạm; null = cả nước) — 14 §21c */
  tinh?: string | null;
  /** hành vi Hay / Chia sẻ / ba chấm — màn khác nối vào (thẻ vẫn hiện khi thiếu) */
  actions?: PostActions;
  /** mở khung soạn (AC07) */
  onCompose?: () => void;
  /** áp thay đổi cục bộ (Hay lạc quan, sửa, xoá, chặn — use-post-actions) lên bài đang hiện */
  view?: (list: readonly KairosPost[]) => KairosPost[];
  /** bài mình vừa đăng ở màn này — hiện đầu dòng tin tới lần tải sau */
  added?: KairosPost[];
  /** Tuỳ chọn dòng tin vừa đổi ở ngăn bánh răng (không có = đọc trong máy lúc mở màn). Bến bỏ qua. */
  tuyChon?: TuyChon;
  /** dòng tin TRỐNG (không bài trên màn, không bản lưu) — màn cha quyết hiện câu phụ dưới tiêu đề (E K3-03) */
  onTrong?: (trong: boolean) => void;
}) {
  const { phone, ready: authReady } = useAuthUser();
  const [habit, setHabitState] = useState<Habit>(emptyHabit);
  /** bỏ hàng chip lọc 2026-10-24 — chỉ còn hai dòng tin: chung ("moi") và Chính sách ("chinh-sach", 14 §21) */
  const chinhSach = chip === "chinh-sach";
  const [posts, setPosts] = useState<KairosPost[]>([]);
  const [pinned, setPinned] = useState<KairosPost[]>([]);
  /** bài Tài trợ (14 §20) — 1 thẻ / 20 bài, chỉ dòng tin chung, chỉ khi có sóng (load "ready") */
  const [ads, setAds] = useState<TheTaiTro[]>(() => adsNho);
  const [next, setNext] = useState<string | null>(null);
  const [load, setLoad] = useState<Load>("loading");
  const [errStatus, setErrStatus] = useState(0);
  /** đang hiện BẢN LƯU (mất sóng): giờ lưu; null = bài đang hiện là bài vừa tải */
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [more, setMore] = useState<"idle" | "loading" | "error">("idle");
  const [newCount, setNewCount] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [goiY, setGoiY] = useState<GoiY>({ k: "an" });
  /** giờ bản lưu LÚC MỞ MÀN (trước khi trang đầu ghi đè) + đã xét gợi ý chưa — xét MỘT lần mỗi lần mở màn */
  const goiYRef = useRef<{ savedAt0: number | null; xet: boolean }>({ savedAt0: null, xet: false });

  // Ref cho các nghe sự kiện (visibilitychange/online/IntersectionObserver) — khỏi gắn lại.
  const st = useRef({ chip, tinh, habit, load, next, more, since: null as string | null, phone, gen: 0, hasPosts: false, pinnedIds: new Set<string>(), tuyChon: tuyChonMacDinh() });
  const hasPosts = posts.length + pinned.length > 0;
  useEffect(() => {
    st.current = { ...st.current, chip, tinh, habit, load, next, more, phone, hasPosts, pinnedIds: new Set(pinned.map((p) => p.id)) };
  }, [chip, tinh, habit, load, next, more, phone, hasPosts, pinned]);

  const updateHabit = useCallback((h: Habit) => {
    setHabitState(h);
    saveHabit(h);
  }, []);

  /** Tải trang đầu. `keep` = giữ bài đang hiện khi mất sóng/lỗi (Thử lại, có sóng lại, pill). */
  const loadFirst = useCallback(
    async (chipWanted: ChipId, h: Habit, keep: boolean) => {
      const gen = ++st.current.gen;
      let c = chipWanted;
      let q = feedQuery(c, h.home, { port, tinh: st.current.tinh });
      if (!q.ok) {
        // lưới an toàn: dòng tin cần cảng nhà mà không có ⇒ về "Mới", KHÔNG để skeleton quay mãi
        c = "moi";
        q = feedQuery(c, h.home, { port });
      }
      setNewCount(0);
      setMore("idle");
      const cache = loadFeedCache(st.current.phone);
      const t0 = Date.now();
      const cached = cache ? rankPage(filterCached(cache.posts, c, h.home, port, st.current.tinh), h, t0) : [];
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
      // HẠT XÁO MỚI mỗi lần tải trang đầu (vuốt làm mới, "Có N bài mới", có sóng lại…) ⇒ máy chủ xếp lại thứ tự,
      // bài cùng tầm điểm đổi chỗ (phan-phoi.NHIEU_XAO) — anh Long: "mỗi lần vuốt xuống refresh thì thứ tự tin random".
      // Bến (port) xếp theo giờ ⇒ không gửi.
      const dau = voiNha(q.params, h, port, st.current.tuyChon);
      if (!port) dau.set("hat", String(Math.floor(Math.random() * 2147483647)));
      const res = await fetchFeedPage(dau, null);
      if (gen !== st.current.gen) return; // bà con đã đổi chip — bỏ phản hồi cũ
      const t = Date.now();
      setNow(t);
      if (res.kind === "ok") {
        const page: FeedPage = res.value;
        setPosts(xepApp(page.posts, h, t, port));
        setPinned(page.pinned);
        if (page.ads) {
          adsNho = page.ads;
          setAds(page.ads);
        }
        setNext(page.next);
        setSavedAt(null);
        setLoad("ready");
        st.current.since = page.at;
        const w = saveFeedCache(st.current.phone, [...page.pinned, ...page.posts], t);
        // nợ: ghi bản lưu hỏng chỉ báo console, trần = lần sau mất sóng thấy bản cũ hơn; nâng khi có chỗ báo "máy đầy" chung
        if (!w.ok) console.warn("[kairos] không ghi được bản lưu dòng tin:", w.reason);
        if (!port && !goiYRef.current.xet) {
          goiYRef.current.xet = true;
          const hien = nenGoiY({
            songTot: songTot(typeof navigator === "undefined" ? null : navigator),
            savedAt: goiYRef.current.savedAt0,
            soBai: loadFeedCache(st.current.phone)?.posts.length ?? 0,
            anDen: loadTaiMangDiAn(),
            now: t,
          });
          if (hien) setGoiY({ k: "hien" });
        }
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
  /** chỗ cuộn mới nhất + ảnh chụp đang có (giu-cho) */
  const yRef = useRef(0);
  const chupRef = useRef<{ snap: Omit<AnhChup, "scrollY" | "at"> | null; huy: (() => void) | null }>({ snap: null, huy: null });
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
    goiYRef.current.savedAt0 = loadFeedCache(phone)?.savedAt ?? null;
    if (!port) st.current.tuyChon = loadTuyChon();
    const snap = layCho<AnhChup>(khoaCho(port, chip, tinh), Date.now());
    // ảnh chụp lúc MẤT SÓNG mà giờ đã có sóng ⇒ đi đường tải mới (sự kiện online đã qua, không bắn lại)
    const songLai = snap?.load === "offline" && typeof navigator !== "undefined" && navigator.onLine !== false;
    if (snap && snap.khoa === khoaCho(port, chip, tinh) && snap.phone === phone && !songLai) {
      // Quay lại từ bài/trang cá nhân: dựng y nguyên, KHÔNG tải lại (giữ chỗ đang đọc như Facebook)
      goiYRef.current.xet = true;
      st.current.since = snap.since;
      st.current.load = snap.load;
      st.current.habit = h;
      setPosts(snap.posts);
      setPinned(snap.pinned);
      setNext(snap.next);
      setSavedAt(snap.savedAt);
      setLoad(snap.load);
      setNow(Date.now());
      yRef.current = snap.scrollY;
      let r2 = 0;
      const r1 = requestAnimationFrame(() => {
        r2 = requestAnimationFrame(() => {
          window.scrollTo(0, snap.scrollY);
          if (snap.load !== "ready" || !snap.since) return;
          const q = feedQuery("moi", h.home, { port });
          if (!q.ok) return;
          const gen = st.current.gen;
          void fetchNewCount(q.params, snap.since).then((n) => {
            if (gen === st.current.gen) setNewCount(n);
          });
        });
      });
      chupRef.current.huy = () => {
        cancelAnimationFrame(r1);
        cancelAnimationFrame(r2);
      };
      return;
    }
    void loadFirst(chip, h, false);
  }, [authReady, loadFirst, port, phone, chip]);

  /*  Cất ảnh chụp khi rời màn. Chỗ cuộn ghi theo sự kiện cuộn CHỈ khi khung dòng tin còn trên trang — lúc Next
      chuyển màn, trang mới cuộn về đầu sau khi khung cũ đã gỡ ⇒ không ghi đè chỗ đang đọc bằng 0. */
  useEffect(() => {
    const ghi = () => {
      if (khungRef.current?.isConnected) yRef.current = window.scrollY;
    };
    window.addEventListener("scroll", ghi, { passive: true });
    const chup = chupRef.current;
    return () => {
      window.removeEventListener("scroll", ghi);
      chup.huy?.();
      // tab lúc rời màn lấy từ ref (đổi tab không gỡ component — effect đổi tab tự cất ảnh chụp của tab cũ)
      const k = khoaCho(port, st.current.chip, st.current.tinh);
      if (chup.snap && chup.snap.khoa === k) catCho(k, { ...chup.snap, scrollY: yRef.current, at: Date.now() });
    };
  }, [port]);

  // Đổi Tuỳ chọn dòng tin ⇒ tải lại trang đầu (giữ bài đang hiện nếu mất sóng/lỗi). Giống hệt ⇒ không tải.
  useEffect(() => {
    if (!started.current || !tuyChon || port || giongNhau(tuyChon, st.current.tuyChon)) return;
    st.current.tuyChon = tuyChon;
    window.scrollTo({ top: 0 });
    void loadFirst(st.current.chip, st.current.habit, true);
  }, [tuyChon, port, loadFirst]);

  // Đổi tab Dòng tin ⇄ Chính sách (14 §21): có ảnh chụp của tab đó ⇒ dựng lại, không thì tải trang đầu (bản lưu lọc
  // theo chủ đề hiện trước). Lần mount đầu do effect mở màn lo.
  const lastChip = useRef<{ chip: ChipId; tinh: string | null }>({ chip, tinh });
  useEffect(() => {
    if (!started.current || (lastChip.current.chip === chip && lastChip.current.tinh === tinh)) return;
    // cất ảnh chụp của tab/tỉnh đang rời (quay lại dựng y nguyên, như rời màn)
    const kCu = khoaCho(port, lastChip.current.chip, lastChip.current.tinh);
    if (chupRef.current.snap?.khoa === kCu) catCho(kCu, { ...chupRef.current.snap, scrollY: yRef.current, at: Date.now() });
    lastChip.current = { chip, tinh };
    window.scrollTo({ top: 0 });
    const snap = layCho<AnhChup>(khoaCho(port, chip, tinh), Date.now());
    if (snap && snap.khoa === khoaCho(port, chip, tinh) && snap.phone === phone && !(snap.load === "offline" && typeof navigator !== "undefined" && navigator.onLine !== false)) {
      st.current.since = snap.since;
      setPosts(snap.posts);
      setPinned(snap.pinned);
      setNext(snap.next);
      setSavedAt(snap.savedAt);
      setLoad(snap.load);
      setNewCount(0);
      return;
    }
    void loadFirst(chip, st.current.habit, false);
  }, [chip, tinh, port, phone, loadFirst]);

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
      const q = feedQuery(s.chip, s.habit.home, { port, tinh: s.tinh });
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
    const q = feedQuery(s.chip, s.habit.home, { port, tinh: s.tinh });
    if (!q.ok) return;
    const gen = s.gen;
    setMore("loading");
    st.current.more = "loading";
    const res = await fetchFeedPage(voiNha(q.params, s.habit, port, s.tuyChon), s.next);
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

  /*  VUỐT XUỐNG LÀM MỚI (như Facebook) — hook chung `useKeoLamMoi` (tách 2026-10-25): thả ra là tải lại trang
      đầu với hạt xáo mới (thứ tự đổi, đỡ nhàm). Bến cũng kéo được (máy chủ trả theo giờ ⇒ làm mới = lấy bài mới nhất).
      Mất sóng: vẫn cho kéo — loadFirst giữ bài đang hiện + báo mất sóng như nút Thử lại. */
  const lamMoi = useKeoLamMoi(async () => {
    xoaCho(khoaCho(port, chip, tinh));
    await loadFirst(st.current.chip, st.current.habit, true);
  });

  const shownPinned = chinhSach ? [] : view ? view(pinned) : pinned;
  const shownPosts = useMemo(() => {
    // một bài chỉ hiện MỘT lần: đang ghim thì chỉ ở dải ghim
    const pinIds = new Set(shownPinned.map((x) => x.id));
    // tab Chính sách CHẶN CỨNG: chỉ bài nhà nước (topic chinh-sach) — dù danh sách tới từ đâu (bản lưu, ảnh chụp, bài vừa đăng)
    const list = (view ? view(posts) : posts).filter((p) => !pinIds.has(p.id) && (!chinhSach || p.topic === "chinh-sach"));
    if (chinhSach) return list;
    if (!added.length) return list;
    const fresh = added.filter((p) => !list.some((x) => x.id === p.id) && !shownPinned.some((x) => x.id === p.id));
    return [...fresh, ...list];
  }, [view, posts, added, shownPinned, chinhSach]);
  const empty = shownPosts.length === 0 && shownPinned.length === 0;
  /*  Ảnh chụp giữ chỗ cất danh sách ĐÃ áp lớp lạc quan của usePostActions (Hay, sửa, xoá, chặn, bài vừa đăng) —
      lớp đó nằm ở state màn, mất khi rời màn; cất bản gốc thì quay lại thấy thẻ như chưa Hay, bài vừa đăng biến mất
      (giám khảo rà FB vòng 2). */
  useEffect(() => {
    chupRef.current.snap =
      (load === "ready" || load === "offline") && shownPosts.length + shownPinned.length > 0
        ? { khoa: khoaCho(port, chip, tinh), phone, posts: shownPosts, pinned: shownPinned, next, savedAt, since: st.current.since, load }
        : null;
  }, [phone, shownPosts, shownPinned, next, savedAt, load, port, chip, tinh]);
  useEffect(() => {
    const io = ioRef.current;
    if (!io) return;
    khungRef.current?.querySelectorAll<HTMLElement>("[data-kairos-id]").forEach((el) => io.observe(el));
  }, [shownPosts, shownPinned]);
  const retry = () => void loadFirst(chip, habit, true);

  // Thẻ đầu Bến: số bài đếm từ bài ĐÃ TẢI/bản lưu đang hiện — không gọi thêm API
  const ben = useMemo(() => (port ? FISHING_PORTS.find((p) => p.id === port) ?? null : null), [port]);
  const soBaiBen = shownPosts.length + shownPinned.length;
  const laCangNha = !!port && habit.home.port === port;
  const datCangNha = () => {
    if (!port || laCangNha) return;
    updateHabit(setHome(habit, homeFromPort(port)));
  };

  /** Bấm Tải: ≤5 trang dòng tin chung gộp vào bản lưu. KHÔNG đổi bài đang hiện. */
  const taiMangDi = async () => {
    const s = st.current;
    const q = feedQuery("moi", s.habit.home, { port });
    if (!q.ok || goiY.k === "dang") return;
    setGoiY({ k: "dang" });
    const base = voiNha(q.params, s.habit, port, s.tuyChon);
    base.set("hat", String(Math.floor(Math.random() * 2147483647)));
    const r = await taiNhieuTrang((c) => fetchFeedPage(base, c));
    if (r.kind !== "ok") {
      setGoiY({ k: "loi" });
      return;
    }
    const w = saveFeedCache(st.current.phone, r.posts, Date.now());
    // xong / máy đầy ⇒ biên nhận nổi (toast chung), pill thu lại — không chiếm chỗ trước bài đầu
    const t = toastTaiMangDi(w.ok ? { kind: "xong", n: soBaiConLuu(r.posts, loadFeedCache(st.current.phone)?.posts ?? []) } : { kind: "day" });
    baoToast(t.text, { loai: t.loai });
    setGoiY({ k: "an" });
  };
  const deSau = () => {
    saveTaiMangDiAn(Date.now());
    setGoiY({ k: "an" });
  };
  /*  SEN BIỂN "tải bài đọc trên biển" (cơ cấu mới 2026-10-25): mở `/kairos?sen=tai` ⇒ bấm Tải hộ MỘT lần rồi dọn tham số
      (replaceState — lùi lại không tải lần hai). Không tự tải khi không có lệnh; mất sóng thì `taiMangDi` tự báo lỗi
      bằng pill như bấm tay. Dòng tin chung thôi — Bến (`port`) không có pill. */
  const taiRef = useRef(taiMangDi);
  useEffect(() => {
    taiRef.current = taiMangDi;
  });
  useEffect(() => {
    if (port) return;
    try {
      const u = new URL(window.location.href);
      if (u.searchParams.get("sen") !== "tai") return;
      u.searchParams.delete("sen");
      window.history.replaceState(window.history.state, "", u.pathname + (u.search || "") + u.hash);
      void taiRef.current();
    } catch {
      // URL lạ — bỏ qua, bà con bấm Tải tay
    }
  }, [port]);
  /*  Báo màn cha dòng tin có TRỐNG không (câu phụ E K3-03). Lúc còn đang tải mà chưa có bài trên màn thì nhìn bản lưu:
      có bản lưu ⇒ bài sắp hiện (không trống); không ⇒ trống thật. Không bắn khi còn chưa đọc máy ⇒ header không chớp. */
  useEffect(() => {
    if (!onTrong || port) return;
    if (!empty) {
      onTrong(false);
      return;
    }
    if (load === "loading" && (loadFeedCache(phone)?.posts.length ?? 0) > 0) return;
    onTrong(true);
  }, [onTrong, port, empty, load, phone]);
  const pill = port || chinhSach ? null : pillTaiMangDi(goiY.k);

  return (
    <div className="pb-4">
      <KeoLamMoiChi {...lamMoi.chi} />
      {ben && (
        <div className="px-4 pb-3">
          <section className="surface overflow-hidden" aria-label={`Bến ${ben.name}`}>
            {/* dải bìa TRƠN h-16 (K3-11): tên cảng đã ở thanh ‹ và h2, không lặp lần ba */}
            <div className="h-16 bg-sea/15" />
            <div className="p-4">
              <h2 className="display text-[1.25rem] font-bold leading-snug text-navy">Bến {ben.name}</h2>
              {(ben.province || soBaiBen > 0) && (
                <p className="mt-0.5 text-[0.875rem] text-foreground/65">
                  {[ben.province || null, soBaiBen > 0 ? `${soBaiBen} bài gần đây` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              <p className="mt-2 text-[1rem]">Chỗ bà con cảng {ben.name} kể chuyện, hỏi giá, báo tin</p>
              {/* một lối đăng duy nhất = ô mời "Đăng vào Bến…" bên dưới (K3-11 bỏ nút Đăng trùng) */}
              <button
                type="button"
                onClick={datCangNha}
                disabled={laCangNha}
                aria-pressed={laCangNha}
                className="mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-line px-4 font-semibold text-sea transition active:scale-[0.98] disabled:opacity-75"
              >
                {laCangNha && <CheckIcon className="h-5 w-5" />}
                {NHAN.cangNha}
              </button>
            </div>
          </section>
        </div>
      )}
      {/* tab Chính sách không có ô mời đăng: chỉ thông báo nhà nước (14 §21) */}
      {!chinhSach && (
        <div className="px-4 pb-3">
          <button
            type="button"
            onClick={onCompose}
            className="surface flex h-14 w-full items-center px-4 text-left text-[1rem] text-foreground/65 transition active:scale-[0.99]"
          >
            {ben ? `Đăng vào Bến ${ben.name}…` : "Bà con muốn chia sẻ gì?"}
          </button>
        </div>
      )}

      {pill && (
        <div className="px-4 pb-3">
          {/* MỘT hàng pill cùng khuôn "Có N bài mới" (E K3-03): chữ ngắn · nút chữ · × góc = Để sau 24 h. Không tự tải. */}
          <div className="relative flex h-(--h-chip) items-center gap-2 rounded-full bg-sea/8 pl-4 pr-8">
            <p role="status" className="min-w-0 flex-1 truncate text-[0.875rem]">
              {pill.chu}
            </p>
            {pill.dangTai && <span aria-hidden className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-sea" />}
            {pill.nut && (
              <button type="button" onClick={() => void taiMangDi()} className="h-9 shrink-0 rounded-full px-3 text-[0.875rem] font-semibold text-navy active:bg-sea/15">
                {pill.nut}
              </button>
            )}
            {pill.x && <CloseButton variant="goc" label={NHAN.deSau} onClose={deSau} />}
          </div>
        </div>
      )}

      {load === "offline" && !empty && (
        <OfflineLine savedAt={savedAt} />
      )}

      {newCount > 0 && (
        <div className="sticky top-2 z-10 flex justify-center px-4 pb-2">
          <button type="button" onClick={showNew} className="h-10 rounded-full bg-sea px-4 text-[0.875rem] font-semibold text-white shadow-md">
            Có {newCount >= 99 ? "99+" : newCount} bài mới
          </button>
        </div>
      )}

      {/* dòng tin trượt lên 220 ms lúc mở màn (Codex 2026-10-25) — có bản lưu thì hiện ngay, không chờ mạng */}
      <div ref={khungRef} className="anim-tin-hien space-y-3 px-4">
        {load === "error" && !empty && (
          <div className="surface flex items-center gap-3 p-3">
            <p className="flex-1 text-[1rem]">Chưa tải được bài mới.</p>
            <button type="button" onClick={retry} className="h-10 rounded-xl border border-line px-3 font-semibold text-sea">
              {NHAN.thuLai}
            </button>
          </div>
        )}

        {empty && load === "loading" && (
          <>
            {/*  Cá trôi theo nhịp CHỈ lúc thật sự chờ (chưa có bài nào, kể cả bản lưu) — Codex 2026-10-25.
                 Mất sóng/lỗi/có bài: nhánh này không vẽ nên không có gì quay mãi. */}
            <div role="status" className="flex items-center gap-3 px-1 pt-1 pb-2">
              <KairosFishIcon anim="boi" className="h-6 w-auto shrink-0" />
              <span className="text-[0.875rem] text-sea">Đang tải tin…</span>
            </div>
            <PostSkeleton />
          </>
        )}
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
            {port ? "Bến này chưa có bài nào." : chinhSach ? "Chưa có thông báo nào. Có tin mới sẽ hiện ở đây." : "Chưa có bài nào. Bà con đăng bài đầu tiên nhé."}
          </EmptyState>
        )}

        {shownPinned.map((p) => (
          <div key={`pin-${p.id}`} data-kairos-id={p.id}>
            <PostCard post={p} now={now} actions={actions} onRead={onRead} benPort={port} />
          </div>
        ))}
        {shownPosts.map((p, i) => {
          const qc = !port && !chinhSach && load === "ready" ? theSauBai(i, ads.length) : null;
          return (
            <Fragment key={p.id}>
              <div data-kairos-id={p.id}>
                <PostCard post={p} now={now} actions={actions} onRead={onRead} benPort={port} />
              </div>
              {qc != null && <TheTaiTroCard ad={ads[qc]} />}
            </Fragment>
          );
        })}

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
