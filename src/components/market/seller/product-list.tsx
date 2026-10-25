"use client";

// /ban-hang/san-pham — DANH SÁCH MÓN CỦA SHOP (11 §6.4).
// Lọc theo trạng thái + tìm theo tên; mỗi thẻ có Sửa và nút nhanh "Hết hàng"
// (đặt tồn 0, có "Hoàn lại" 5 s — không ConfirmDialog cho việc bà con làm suốt
// ngày). Món SDVICO gỡ: băng đỏ + lý do + nút gọi, KHÔNG tự bật lại được.
//
// 2026-10-25: danh sách sang "Xem thêm N món" (BH-05, bỏ Trước/Sau); chip + chữ
// tìm lên URL, bản đã gom + chỗ cuộn giữ qua sessionStorage khi mở một món rồi
// quay lại (BH-03, cùng khuôn /ban-hang/don); `?luu=` mở chip Tất cả, ghim món
// vừa lưu lên đầu và cuộn tới (BH-06); ô tìm + nút Tìm cùng khuôn màn đơn (BH-19).
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BoxIcon, EditIcon, PlusIcon } from "@/components/icons";
import { CategoryIcon } from "@/components/market/shared/product-card";
import { PriceText } from "@/components/market/shared/price-text";
import { ChipRow, type ChipOption } from "@/components/ui/chip-row";
import { CallButton, EmptyState, inputClass } from "@/components/ui/primitives";
import { StatusBanner } from "@/components/ui/status-banner";
import { KeoLamMoiChi, useKeoLamMoi } from "@/components/ui/use-keo-lam-moi";
import { SDVICO_HOTLINE } from "@/data/sdvico-showcase";
import { marketSend } from "@/lib/market/client";
import { saveListState, takeListState } from "@/lib/market/list-state";
import type { Product, Shop } from "@/lib/market/types";
import {
  InlineNote, LoadView, marketErrorText, scrollBackTo, useInlineNote, useMarketList, useMyShop, useSaveOnLeave,
  useScrollMemory, writeUrlParams,
} from "./seller-net";
import { MoreButton, NoShop, SELLER_BTN, SELLER_BTN_WIDE } from "./ui";
import { NOTIFY_HIDE_LONG_MS } from "@/lib/notify"; // một luật giờ tự tắt (rà bố cục 2026-10-22)

type Filter = "all" | "dang_ban" | "an" | "het_hang" | "bi_go";
const FILTERS: readonly ChipOption<Filter>[] = [
  { id: "all", label: "Tất cả" },
  { id: "dang_ban", label: "Đang bán" },
  { id: "an", label: "Đã ẩn" },
  { id: "het_hang", label: "Hết hàng" },
  { id: "bi_go", label: "Bị gỡ" },
];
const FILTER_MAC_DINH: Filter = "dang_ban";
const filterOf = (v: string | null): Filter | null => FILTERS.find((f) => f.id === v)?.id ?? null;

/** ngăn sessionStorage của màn này (khoá chung `forfish.mlist.v1`, lib/market/list-state) */
const LIST_ID = "ban-hang/san-pham";

export function SellerProductList() {
  const { state, reload } = useMyShop();
  return (
    <LoadView state={state} what="gian hàng" onRetry={reload}>
      {(d) => (d.shop ? <Inner shop={d.shop} /> : <NoShop />)}
    </LoadView>
  );
}

function Inner({ shop }: { shop: Shop }) {
  const [filter, setFilter] = useState<Filter>(FILTER_MAC_DINH);
  const [term, setTerm] = useState("");
  const [q, setQ] = useState(""); // chỉ đổi khi bấm Tìm / Enter — cùng khuôn màn đơn (BH-19)
  const [ready, setReady] = useState(false);
  /*  Màn form vừa lưu/xoá xong chuyển về đây kèm `?luu=&id=&tt=` / `?xoa=` — đọc
      SAU mount (window.location, không useSearchParams) để trang vẫn prerender
      tĩnh, đúng khuôn `Tabs` paramKey. */
  const [savedNote, setSavedNote] = useState("");
  /** món vừa lưu — ghim lên đầu danh sách một lượt và cuộn tới (BH-06) */
  const [pinId, setPinId] = useState<string | null>(null);
  const canEdit = shop.status === "cho_duyet" || shop.status === "hoat_dong";
  const cuon = useScrollMemory();
  const sangChiTiet = useRef(false);

  /*  `status=all` ⇒ KHÔNG gửi tham số: route hiểu bỏ trống là tất cả. Đang tìm
      chữ mà vẫn kẹp trạng thái là lý do chính khiến "tìm không ra". */
  const path = useCallback(
    (page: number) =>
      `/api/ban-hang/san-pham?page=${page}` +
      (filter === "all" ? "" : `&status=${filter}`) +
      (q ? `&q=${encodeURIComponent(q)}` : ""),
    [filter, q],
  );
  const list = useMarketList<Product>(ready ? path : null);
  const restore = list.restore; // ổn định — effect mount dưới chỉ chạy một lần

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const luu = sp.get("luu");
    const xoa = sp.get("xoa");
    const tt = sp.get("tt");
    let filter0 = filterOf(tt) ?? FILTER_MAC_DINH; // `?tt=het_hang` từ băng Sắp hết hàng ở Tổng quan (BH-09)
    const q0 = sp.get("q") ?? "";
    if (luu) {
      /*  Vừa lưu một món thì PHẢI THẤY nó (BH-06): chip mặc định "Đang bán" sẽ
          giấu món Ẩn / Hết hàng ⇒ mở "Tất cả". Hết hàng thì nói luôn (BH-02) —
          shop biết mà thêm tồn, không chờ bà con gọi hỏi. */
      setSavedNote(tt === "het_hang" ? `Đã lưu ${luu} — đang Hết hàng, thêm tồn để bà con đặt được.` : `Đã lưu ${luu}`);
      setPinId(sp.get("id"));
      filter0 = "all";
      writeUrlParams({ luu: null, id: null, tt: null }); // dòng báo chỉ một lần — tải lại trang không lặp
    } else if (xoa) {
      setSavedNote(`Đã xoá ${xoa}`);
      writeUrlParams({ xoa: null });
    }
    setFilter(filter0);
    setQ(q0);
    setTerm(q0);
    const cu = takeListState<Product>(LIST_ID);
    if (!luu && !xoa && cu && cu.q === q0 && cu.filters.filter === filter0) {
      restore(cu);
      scrollBackTo(cu.scrollY);
    }
    setReady(true);
  }, [restore]);

  useEffect(() => {
    if (!ready) return;
    writeUrlParams({ tt: filter === FILTER_MAC_DINH ? null : filter, q: q || null });
  }, [ready, filter, q]);

  const ghi = useCallback(
    (luc: "pagehide" | "unmount") => {
      if (!ready || list.items.length === 0) return;
      if (luc === "unmount" && !sangChiTiet.current) return;
      saveListState<Product>(LIST_ID, {
        q,
        filters: { filter },
        items: list.items,
        total: list.total,
        page: list.page,
        scrollY: cuon.current,
      });
    },
    [ready, q, filter, list.items, list.total, list.page, cuon],
  );
  useSaveOnLeave(ghi);

  // cuộn tới món vừa lưu sau khi danh sách vẽ xong (BH-06)
  useEffect(() => {
    if (!pinId || list.items.length === 0) return;
    const el = document.getElementById(`mon-${pinId}`);
    if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, [pinId, list.items.length]);

  const noShop = list.state.kind === "error" && list.state.code === "no_shop";
  // kéo xuống ở đầu trang ⇒ tải lại danh sách (BH-14)
  const lamMoi = useKeoLamMoi(() => list.reload(), { disabled: !ready || noShop });

  return (
    <div className="pb-10">
      {!canEdit && (
        <div className="mb-3 overflow-hidden">
          <StatusBanner level="danger">
            {shop.status === "tam_khoa"
              ? "Shop đang bị tạm khoá — chưa thêm hay sửa món được."
              : "SDVICO chưa duyệt shop — sửa lại đăng ký rồi gửi lần nữa."}
          </StatusBanner>
        </div>
      )}

      {!noShop && (
        <>
          {/* ô tìm + nút Tìm — một khuôn với màn đơn (BH-19); "+" tròn thêm món */}
          <form
            className="mb-3 flex items-center gap-2 px-4"
            onSubmit={(e) => {
              e.preventDefault();
              setQ(term.trim());
            }}
          >
            <input
              className={inputClass}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Tên món trong shop"
              aria-label="Tìm món trong shop"
              inputMode="search"
            />
            <button type="submit" className={`${SELLER_BTN} shrink-0 bg-trim px-5 text-white`}>
              Tìm
            </button>
            {canEdit && (
              <Link
                href="/ban-hang/san-pham/moi"
                aria-label="Thêm món"
                onClick={() => { sangChiTiet.current = true; }}
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-field text-navy transition active:scale-95"
              >
                <PlusIcon className="h-6 w-6" />
              </Link>
            )}
          </form>

          {q && (
            <div className="mb-3 flex flex-wrap items-center gap-2 px-4">
              <span className="text-[1rem] font-semibold text-navy">Kết quả tìm &quot;{q}&quot;</span>
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  setTerm("");
                }}
                className={`${SELLER_BTN} bg-field px-4 text-navy`}
              >
                Xoá tìm
              </button>
            </div>
          )}

          <div className="mb-3">
            <ChipRow options={FILTERS} value={filter} onChange={setFilter} accent="t3" level={1} ariaLabel="Lọc món theo trạng thái" />
          </div>

          {savedNote && <InlineNote text={savedNote} />}
        </>
      )}

      <KeoLamMoiChi {...lamMoi.chi} />
      <LoadView state={list.state} what="danh sách món" onRetry={list.reload}>
        {() => (
          <>
            <Rows
              items={list.items}
              setItems={list.setItems}
              pinId={pinId}
              canEdit={canEdit}
              filter={filter}
              q={q}
              onOpen={() => { sangChiTiet.current = true; }}
            />
            <div className="px-4">
              <MoreButton more={list.more} busy={list.loadingMore} onMore={list.loadMore} what="món" />
            </div>
          </>
        )}
      </LoadView>
    </div>
  );
}

function Rows({
  items, setItems, pinId, canEdit, filter, q, onOpen,
}: {
  items: Product[];
  setItems: (fn: (cur: Product[]) => Product[]) => void;
  pinId: string | null;
  canEdit: boolean;
  filter: Filter;
  /** chữ đang tìm — để câu "không có món nào" nói đúng vì sao trống */
  q: string;
  onOpen: () => void;
}) {
  const note = useInlineNote();
  const [undo, setUndo] = useState<{ id: string; stock: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // "Hoàn lại" chỉ sống 5 s như dòng báo cạnh nó — quá đó coi như bà con đã đồng ý
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), NOTIFY_HIDE_LONG_MS);
    return () => clearTimeout(t);
  }, [undo]);

  async function setStock(p: Product, stock: number, msg: string, undoable: boolean) {
    if (busy) return;
    setBusy(p.id);
    const res = await marketSend<{ product: Product }>("PATCH", `/api/ban-hang/san-pham/${p.id}`, { stock });
    setBusy(null);
    if (!res.ok) return note.show(marketErrorText(res), "danger");
    const next = res.data.product;
    setItems((cur) => cur.map((x) => (x.id === next.id ? next : x)));
    setUndo(undoable ? { id: p.id, stock: p.stock } : null);
    note.show(msg);
  }

  // món vừa lưu lên đầu một lượt (BH-06) — thứ tự máy chủ giữ nguyên cho các món còn lại
  const pinned = pinId ? items.find((x) => x.id === pinId) : undefined;
  const rows = pinned ? [pinned, ...items.filter((x) => x.id !== pinId)] : items;

  if (rows.length === 0) {
    return (
      <div className="px-4">
        <EmptyState icon={<BoxIcon className="h-8 w-8" />}>
          {/*  Nói rõ PHẠM VI đang thu hẹp, và chỉ đường mở rộng — "Chưa có món
               nào ở mục này" khi đang tìm chữ dễ bị đọc thành "shop chưa có món". */}
          {q
            ? `Không có món nào tên giống "${q}"${filter === "all" ? "" : " trong mục này — thử chip Tất cả"}.`
            : filter === "bi_go"
              ? "Không có món nào bị SDVICO gỡ."
              : filter === "all"
                ? "Shop chưa có món nào."
                : "Chưa có món nào ở mục này."}
        </EmptyState>
        {canEdit && (
          <Link href="/ban-hang/san-pham/moi" onClick={onOpen} className="mt-4 flex min-h-(--row-h) items-center justify-center gap-2 rounded-full bg-trim text-[1rem] font-semibold text-white">
            <PlusIcon className="h-6 w-6" /> Thêm sản phẩm
          </Link>
        )}
      </div>
    );
  }

  return (
    <div>
      {note.node}
      {undo && (
        <div className="mb-3 flex items-center justify-between gap-3 px-4">
          <span className="text-[1rem] text-foreground/70">Đặt nhầm?</span>
          <button
            type="button"
            onClick={() => {
              const p = rows.find((x) => x.id === undo.id);
              if (p) void setStock(p, undo.stock, "Đã hoàn lại tồn kho.", false);
            }}
            className="min-h-(--row-h) rounded-full bg-field px-4 text-[1rem] font-semibold text-navy"
          >
            Hoàn lại tồn {undo.stock}
          </button>
        </div>
      )}

      <ul className="space-y-1 px-4">
        {rows.map((p) => (
          <li key={p.id} id={`mon-${p.id}`} className="surface overflow-hidden">
            {/*  Tên món ĐỌC ĐƯỢC là việc chính của màn này (fix F-12): tên 2
                dòng 18px, giá không gãy dòng, hai nút xuống HÀNG RIÊNG chia
                đôi bề ngang — chen bên phải thì tên chỉ còn ~120px. */}
            <div className="flex items-start gap-3 p-3">
              <span className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-field">
                {p.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- ảnh sàn (bucket public / dev), không qua optimizer
                  <img src={p.images[0]} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-foreground/40">
                    <CategoryIcon category={p.category} className="h-8 w-8" />
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 block text-[1rem] font-semibold leading-snug text-navy">{p.title}</span>
                <span className="mt-0.5 block whitespace-nowrap">
                  <PriceText priceVnd={p.priceVnd} compareAtVnd={p.compareAtVnd} />
                </span>
                <span className="mt-0.5 block text-[0.875rem] text-foreground/65">
                  Tồn {p.stock} {p.unit} · Đã bán {p.soldCount}
                  {p.status === "an" && " · Đang ẩn"}
                  {p.status === "het_hang" && " · Hết hàng"}
                </span>
              </span>
            </div>
            {canEdit && (
              <div className="flex gap-2 px-3 pb-3">
                <Link href={`/ban-hang/san-pham/${p.id}`} onClick={onOpen} className={`${SELLER_BTN_WIDE} bg-field text-navy`} aria-label={`Sửa ${p.title}`}>
                  <EditIcon className="h-6 w-6" />
                  Sửa
                </Link>
                {p.stock > 0 && !p.adminHidden && (
                  <button
                    type="button"
                    disabled={busy === p.id}
                    onClick={() => void setStock(p, 0, `Đã đặt "${p.title}" thành hết hàng.`, true)}
                    className={`${SELLER_BTN_WIDE} bg-field text-navy`}
                  >
                    <BoxIcon className="h-6 w-6" />
                    Hết hàng
                  </button>
                )}
              </div>
            )}
            {p.adminHidden && (
              <div className="border-t border-line px-3 py-2">
                <p className="text-[1rem] font-semibold" style={{ color: "var(--danger)" }}>
                  SDVICO đã gỡ món này: {p.adminHiddenReason ?? "không ghi lý do"}
                </p>
                <div className="mt-2">
                  <CallButton phone={SDVICO_HOTLINE} label="Gọi SDVICO" />
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
