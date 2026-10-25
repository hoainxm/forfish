"use client";

// VỤN DÙNG CHUNG cho mọi màn Kênh người bán: một hình dạng trạng thái (đang
// tải / mất sóng / lỗi / có dữ liệu) để KHÔNG màn nào quên một nhánh (11 §6,
// hook 1f-c), một hàm đổi mã lỗi ra câu tiếng Việt, và hook tải dữ liệu có
// "có sóng lại tự tải" (11 §9).
//
// Kênh người bán KHÔNG cache gì (11 §9: seller ở bờ, dữ liệu đổi liên tục) —
// mất sóng thì nói thật, không bày số cũ.
import { useCallback, useEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { EmptyNet } from "@/components/market/shared/empty-net";
import { PrimaryButton } from "@/components/ui/primitives";
import { StatusBanner } from "@/components/ui/status-banner";
import { marketGet, type MarketResult } from "@/lib/market/client";
import { saveShopFlag } from "@/lib/market/seller-flag";
import { useOnlineRefetch } from "@/lib/market/use-online";
import type { Shop } from "@/lib/market/types";
import { useAuthUser } from "@/lib/use-auth";
import { NOTIFY_HIDE_LONG_MS } from "@/lib/notify"; // một luật giờ tự tắt (rà bố cục 2026-10-22)
import { NoShop } from "./ui";

export type LoadState<T> =
  | { kind: "loading" }
  | { kind: "offline" }
  /** `code` = mã lỗi của route — `LoadView` nhìn `no_shop` để vẽ màn mời thay băng đỏ (BH-04) */
  | { kind: "error"; msg: string; code?: string }
  | { kind: "ok"; data: T };

/** Câu cho bà con từ mã lỗi của route (12 §7). `invalid` mang câu của validate. */
export function marketErrorText(r: Extract<MarketResult<unknown>, { ok: false }>): string {
  if (r.offline) return "Máy đang không có sóng.";
  if (r.code === "invalid" && r.message) return r.message;
  switch (r.code) {
    case "no_shop": return "Số này chưa có gian hàng.";
    case "shop_not_active": return "Shop đang bị tạm khoá hoặc chưa được duyệt — chưa làm được việc này.";
    case "forbidden": return "Việc này không thuộc quyền của shop.";
    case "not_found": return "Không tìm thấy — có thể đã bị xoá.";
    case "bad_transition": return "Đơn đã sang bước khác rồi — tải lại giúp.";
    case "slug_taken": return "Tên shop này đã có người dùng — chọn tên khác.";
    case "bad_size": return "Ảnh quá lớn, chụp lại gần hơn.";
    case "bad_type": return "Ảnh phải là JPG, PNG hoặc WebP.";
    case "login_required": return "Cần đăng nhập lại rồi thử tiếp.";
    case "unavailable": return "Chưa tra được máy chủ — thử lại giúp.";
    default: return r.status >= 500
      ? "Chợ đang trục trặc, chưa tải được. Thử lại giúp."
      : "Chưa làm được — thử lại giúp.";
  }
}

/** Tải một đường dẫn GET; nghe `online` để tự tải lại. `path = null` ⇒ đứng yên. */
export function useMarketData<T>(path: string | null): {
  state: LoadState<T>;
  reload: () => void;
  set: (data: T) => void;
} {
  const [state, setState] = useState<LoadState<T>>({ kind: "loading" });

  const load = useCallback(async () => {
    if (!path) return;
    setState({ kind: "loading" });
    const res = await marketGet<T>(path);
    if (res.ok) setState({ kind: "ok", data: res.data });
    else if (res.offline) setState({ kind: "offline" });
    else setState({ kind: "error", msg: marketErrorText(res), code: res.code });
  }, [path]);

  useEffect(() => {
    void load();
  }, [load]);
  useOnlineRefetch(() => void load());

  return {
    state,
    reload: () => void load(),
    set: (data: T) => setState({ kind: "ok", data }),
  };
}

/*  DÒNG BÁO SAU THAO TÁC — dùng hook này, ĐỪNG tự giữ `useState<string>`.

    Lỗi thật đã dính: parent giữ câu báo bằng một chuỗi, `InlineNote` tự tắt sau
    5 giây, rồi thao tác hỏng LẦN HAI với câu Y HỆT ("Máy đang không có sóng.")
    ⇒ React thấy state không đổi nên không dựng lại, dòng báo KHÔNG hiện nữa.
    Bà con bấm mà màn im hoàn toàn, tưởng đã xong.

    Hook đóng mốc thời gian vào state nên lần nào cũng là thay đổi thật, và
    `key` ép dựng lại để đồng hồ 5 giây chạy từ đầu. */
export function useInlineNote(): {
  node: ReactNode;
  show: (text: string, level?: "ok" | "danger") => void;
  clear: () => void;
} {
  const [n, setN] = useState<{ text: string; level: "ok" | "danger"; at: number } | null>(null);
  return {
    node: n ? <InlineNote key={n.at} text={n.text} level={n.level} /> : null,
    show: (text, level = "ok") => setN({ text, level, at: Date.now() }),
    clear: () => setN(null),
  };
}

export interface PagedRes<T> { items: T[]; total: number; page: number; pageSize: number }

/*  DANH SÁCH PHÂN TRANG "Xem thêm N …" cho kênh người bán (2026-09-07).
    Sinh ra vì màn đơn của shop trước đó ghim `page=1` và vứt `total`: shop có
    hơn 20 đơn trong một tab thì đơn thứ 21 KHÔNG có đường nào mở ra, mà cũng
    không có chữ nào báo là đang bị cắt. Luật của dự án là "Xem thêm N …",
    không phải Trước/Sau (07 §Ma trận).

    `path(page)` đổi (đổi tab, đổi ô tìm) ⇒ tự về trang 1 và bỏ hết bản đã gom.
    `runRef` chống phản hồi tới trễ: bấm nhanh hai tab thì bản của tab cũ về sau
    không được phép đè bản tab mới.
    // nợ: đây là bản phân trang THỨ BA trong repo (buyer my-market-orders tự
    // làm, admin có useAdminList) — gom một hook dùng chung khi chạm lần sau. */
export function useMarketList<T>(path: ((page: number) => string) | null): {
  state: LoadState<PagedRes<T>>;
  items: T[];
  total: number;
  /** đã gom tới trang mấy — để ghi bản chụp lúc rời màn */
  page: number;
  /** còn bao nhiêu món/đơn chưa tải — 0 là hết */
  more: number;
  loadingMore: boolean;
  reload: () => void;
  loadMore: () => void;
  /** sửa tại chỗ sau PATCH (vd đặt Hết hàng) — không tải lại cả danh sách */
  setItems: (fn: (cur: T[]) => T[]) => void;
  /** nhận lại bản đã gom từ bản chụp phiên (quay lại từ chi tiết) — lượt tải kế tiếp của bộ lọc đó BỊ BỎ */
  restore: (snap: { items: T[]; total: number; page: number }) => void;
} {
  const [state, setState] = useState<LoadState<PagedRes<T>>>({ kind: "loading" });
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const runRef = useRef(0);
  /*  `path = null` ⇒ đứng yên (màn còn đang đọc URL / bản chụp sau mount, chưa
      biết tab nào) — cùng khuôn `useMarketData(null)`. */
  const first = path ? path(1) : null;
  const skipRef = useRef(false);

  const fetchPage = useCallback(
    async (p: number, append: boolean) => {
      if (!path) return;
      const run = ++runRef.current;
      if (append) setLoadingMore(true);
      else setState({ kind: "loading" });
      const res = await marketGet<PagedRes<T>>(path(p));
      if (run !== runRef.current) return; // bản cũ về sau — bỏ
      if (append) setLoadingMore(false);
      if (!res.ok) {
        // Tải thêm mà hỏng thì GIỮ phần đã có, chỉ báo ở nhánh chung khi là lượt đầu
        if (!append) setState(res.offline ? { kind: "offline" } : { kind: "error", msg: marketErrorText(res), code: res.code });
        return;
      }
      setTotal(res.data.total);
      setPage(res.data.page);
      setItems((cur) => (append ? [...cur, ...res.data.items] : res.data.items));
      setState({ kind: "ok", data: res.data });
    },
    [path],
  );

  useEffect(() => {
    if (first == null) return;
    // vừa nhận bản chụp cho đúng bộ lọc này ⇒ không xin lại trang 1..n (BH-03)
    if (skipRef.current) {
      skipRef.current = false;
      return;
    }
    void fetchPage(1, false);
    // `first` là vân tay của bộ lọc: đổi tab / đổi ô tìm ⇒ gom lại từ đầu
  }, [first, fetchPage]);
  useOnlineRefetch(() => void fetchPage(1, false));

  // ổn định (không phụ thuộc gì) để màn gọi được trong effect mount mà không cần ref
  const restore = useCallback((snap: { items: T[]; total: number; page: number }) => {
    skipRef.current = true;
    setItems(snap.items);
    setTotal(snap.total);
    setPage(snap.page);
    setState({ kind: "ok", data: { items: snap.items, total: snap.total, page: snap.page, pageSize: snap.items.length } });
  }, []);

  return {
    state,
    items,
    total,
    page,
    more: Math.max(0, total - items.length),
    loadingMore,
    reload: () => void fetchPage(1, false),
    loadMore: () => void fetchPage(page + 1, true),
    setItems,
    restore,
  };
}

/*  NHỚ CHỖ CUỘN LIÊN TỤC (BH-03) — chép khuôn `buyer/market-search.tsx`: khi bấm
    vào một đơn, Next đưa cuộn về 0 TRƯỚC khi cleanup chạy, nên đọc scrollY lúc
    rời màn là ghi 0. Ghi qua rAF để không giật; chốt thêm ở pointerdown vì lúc
    bà con chạm vào thẻ thì trang vẫn đang ở đúng chỗ cần nhớ. */
export function useScrollMemory(): MutableRefObject<number> {
  const cuon = useRef(0);
  useEffect(() => {
    let cho = false;
    const theo = () => {
      if (cho) return;
      cho = true;
      requestAnimationFrame(() => {
        cho = false;
        if (window.scrollY > 0) cuon.current = window.scrollY;
      });
    };
    const cham = () => {
      if (window.scrollY > 0) cuon.current = window.scrollY;
    };
    window.addEventListener("scroll", theo, { passive: true });
    window.addEventListener("pointerdown", cham, { capture: true, passive: true });
    return () => {
      window.removeEventListener("scroll", theo);
      window.removeEventListener("pointerdown", cham, { capture: true });
    };
  }, []);
  return cuon;
}

/** Chạy `ghi` đúng hai lúc bà con rời màn: trang bị che (`pagehide`) hoặc component bị gỡ (`unmount`). */
export function useSaveOnLeave(ghi: (luc: "pagehide" | "unmount") => void): void {
  useEffect(() => {
    const che = () => ghi("pagehide");
    window.addEventListener("pagehide", che);
    return () => {
      window.removeEventListener("pagehide", che);
      ghi("unmount");
    };
  }, [ghi]);
}

/** Cuộn về `y` SAU khi danh sách vẽ xong — hai khung hình: React gắn thẻ, trình duyệt tính chiều cao ảnh. */
export function scrollBackTo(y: number): void {
  if (y <= 0) return;
  requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)));
}

/** Ghi `tab`/`q`… vào URL hiện tại không đẩy lịch sử — back từ chi tiết về đúng tab (BH-03). */
export function writeUrlParams(params: Record<string, string | null>): void {
  const url = new URL(window.location.href);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
    else url.searchParams.delete(k);
  }
  const next = url.pathname + url.search;
  if (next !== window.location.pathname + window.location.search) window.history.replaceState(window.history.state, "", next);
}

/** Shop của người đang đăng nhập + ghi cờ `forfish.mshop.v1` (LEAD §4 #16). */
export function useMyShop(): {
  state: LoadState<{ shop: Shop | null }>;
  reload: () => void;
  set: (shop: Shop) => void;
} {
  const { phone } = useAuthUser();
  const { state, reload, set } = useMarketData<{ shop: Shop | null }>("/api/ban-hang/shop");
  useEffect(() => {
    if (state.kind !== "ok") return;
    const shop = state.data.shop;
    saveShopFlag(phone, {
      hasShop: !!shop,
      ...(shop ? { status: shop.status } : {}),
      at: Date.now(),
    });
  }, [state, phone]);
  return { state, reload, set: (shop: Shop) => set({ shop }) };
}

/** "3 giờ trước" — tuổi của đơn, cho thẻ đơn và màn chi tiết. */
export function agoLabel(iso: string, now: number = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const mins = Math.max(0, Math.round((now - t) / 60000));
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.round(hours / 24)} ngày trước`;
}

/** Dòng "đang tải" — KHÔNG bao giờ vẽ null (án lệ màn trắng câm, 11 §5). */
export function Loading({ what }: { what: string }) {
  return (
    <p role="status" className="px-4 py-8 text-center text-[1rem] font-semibold text-foreground/65">
      Đang tải {what}…
    </p>
  );
}

/** Lỗi máy chủ / hết giờ — nói thật + nút Thử lại. */
export function ErrorBox({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className="px-4 py-6">
      <div className="overflow-hidden rounded-2xl">
        <StatusBanner level="danger">{msg}</StatusBanner>
      </div>
      <PrimaryButton className="mt-4" onClick={onRetry}>Thử lại</PrimaryButton>
    </div>
  );
}

/** Bốn nhánh trong MỘT chỗ: đang tải · mất sóng · lỗi · có dữ liệu. */
export function LoadView<T>({
  state,
  what,
  onRetry,
  children,
}: {
  state: LoadState<T>;
  /** vế sau "Đang tải …" và "… cần mạng" */
  what: string;
  onRetry: () => void;
  children: (data: T) => ReactNode;
}) {
  if (state.kind === "loading") return <Loading what={what} />;
  if (state.kind === "offline") {
    return (
      <div className="px-4 py-4">
        <EmptyNet what={what} onRetry={onRetry} />
      </div>
    );
  }
  // chưa có gian hàng KHÔNG phải lỗi: "Thử lại" là ngõ cụt — đưa về màn mời (BH-04)
  if (state.kind === "error") return state.code === "no_shop" ? <NoShop /> : <ErrorBox msg={state.msg} onRetry={onRetry} />;
  return <>{children(state.data)}</>;
}

/** Dòng xác nhận sau hành động — tự tắt sau 5 s (07 §12: không toast). */
export function InlineNote({ text, level = "ok" }: { text: string; level?: "ok" | "danger" }) {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    setShown(true);
    const t = setTimeout(() => setShown(false), NOTIFY_HIDE_LONG_MS);
    return () => clearTimeout(t);
  }, [text]);
  if (!shown || !text) return null;
  return (
    <p
      role="status"
      className="mx-4 mb-3 rounded-2xl px-3.5 py-2.5 text-[1rem] font-semibold"
      style={
        level === "ok"
          ? { backgroundColor: "var(--ok-bg)", color: "var(--ok)" }
          : { backgroundColor: "var(--danger-bg)", color: "var(--danger)" }
      }
    >
      {text}
    </p>
  );
}
