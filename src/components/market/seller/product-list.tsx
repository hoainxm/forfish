"use client";

// /ban-hang/san-pham — DANH SÁCH MÓN CỦA SHOP (11 §6.4).
// Lọc theo trạng thái + tìm theo tên; mỗi thẻ có Sửa và nút nhanh "Hết hàng"
// (đặt tồn 0, có "Hoàn lại" 5 s — không ConfirmDialog cho việc bà con làm suốt
// ngày). Món SDVICO gỡ: băng đỏ + lý do + nút gọi, KHÔNG tự bật lại được.
import { useEffect, useState } from "react";
import Link from "next/link";
import { BoxIcon, ChevronLeftIcon, ChevronRightIcon, EditIcon, PlusIcon, SearchIcon } from "@/components/icons";
import { CategoryIcon } from "@/components/market/shared/product-card";
import { PriceText } from "@/components/market/shared/price-text";
import { ChipRow, type ChipOption } from "@/components/ui/chip-row";
import { CallButton, EmptyState, inputClass } from "@/components/ui/primitives";
import { StatusBanner } from "@/components/ui/status-banner";
import { SDVICO_HOTLINE } from "@/data/sdvico-showcase";
import { marketSend } from "@/lib/market/client";
import type { Product, Shop } from "@/lib/market/types";
import { InlineNote, LoadView, marketErrorText, useInlineNote, useMarketData, useMyShop } from "./seller-net";
import { SELLER_BTN, SELLER_BTN_WIDE } from "./ui";
import { NOTIFY_HIDE_LONG_MS } from "@/lib/notify"; // một luật giờ tự tắt (rà bố cục 2026-10-22)

type Filter = "all" | "dang_ban" | "an" | "het_hang" | "bi_go";
const FILTERS: readonly ChipOption<Filter>[] = [
  { id: "all", label: "Tất cả" },
  { id: "dang_ban", label: "Đang bán" },
  { id: "an", label: "Đã ẩn" },
  { id: "het_hang", label: "Hết hàng" },
  { id: "bi_go", label: "Bị gỡ" },
];

interface ListRes { items: Product[]; total: number; page: number; pageSize: number }

export function SellerProductList() {
  const { state, reload } = useMyShop();
  return (
    <LoadView state={state} what="gian hàng" onRetry={reload}>
      {(d) => (d.shop ? <Inner shop={d.shop} /> : <NoShopYet />)}
    </LoadView>
  );
}

function NoShopYet() {
  return (
    <div className="px-4">
      <EmptyState icon={<BoxIcon className="h-8 w-8" />}>
        Chưa có gian hàng. Đăng ký shop trước rồi mới thêm được món.
      </EmptyState>
      <Link href="/ban-hang/dang-ky" className="mt-4 flex min-h-(--row-h) items-center justify-center rounded-full bg-trim text-[1rem] font-semibold text-white">
        Đăng ký gian hàng
      </Link>
    </div>
  );
}

function Inner({ shop }: { shop: Shop }) {
  const [filter, setFilter] = useState<Filter>("dang_ban");
  /*  Màn form vừa lưu/xoá xong chuyển về đây kèm `?luu=` / `?xoa=` — đọc SAU
      mount (window.location, không useSearchParams) để trang vẫn prerender
      tĩnh, đúng khuôn `Tabs` paramKey. */
  const [savedNote, setSavedNote] = useState("");
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const luu = p.get("luu");
    const xoa = p.get("xoa");
    if (luu) setSavedNote(`Đã lưu ${luu}`);
    else if (xoa) setSavedNote(`Đã xoá ${xoa}`);
  }, []);
  const [term, setTerm] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const canEdit = shop.status === "cho_duyet" || shop.status === "hoat_dong";

  // gõ xong 400 ms mới gọi mạng — không bắn một request mỗi chữ
  useEffect(() => {
    const t = setTimeout(() => { setQ(term.trim()); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [term]);

  /*  `status=all` ⇒ KHÔNG gửi tham số: route hiểu bỏ trống là tất cả. Đang tìm
      chữ mà vẫn kẹp trạng thái là lý do chính khiến "tìm không ra". */
  const path =
    `/api/ban-hang/san-pham?page=${page}` +
    (filter === "all" ? "" : `&status=${filter}`) +
    (q ? `&q=${encodeURIComponent(q)}` : "");
  const { state, reload } = useMarketData<ListRes>(path);

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

      <div className="mb-3 flex items-center gap-2 px-4">
        <span className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-foreground/50" />
          <input
            className={`${inputClass} pl-11`}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Tìm món trong shop"
            aria-label="Tìm món trong shop"
          />
        </span>
        {canEdit && (
          <Link href="/ban-hang/san-pham/moi" className={`${SELLER_BTN} shrink-0 bg-trim text-white`}>
            <PlusIcon className="h-6 w-6" />
            Thêm
          </Link>
        )}
      </div>

      <div className="mb-3">
        <ChipRow
          options={FILTERS}
          value={filter}
          onChange={(f) => { setFilter(f); setPage(1); }}
          accent="t3"
          level={1}
          ariaLabel="Lọc món theo trạng thái"
        />
      </div>

      {savedNote && <InlineNote text={savedNote} />}

      <LoadView state={state} what="danh sách món" onRetry={reload}>
        {(d) => (
          <Rows
            data={d}
            canEdit={canEdit}
            onPage={setPage}
            filter={filter}
            q={q}
          />
        )}
      </LoadView>
    </div>
  );
}

function Rows({
  data, canEdit, onPage, filter, q,
}: {
  data: ListRes;
  canEdit: boolean;
  onPage: (p: number) => void;
  filter: Filter;
  /** chữ đang tìm — để câu "không có món nào" nói đúng vì sao trống */
  q: string;
}) {
  const [rows, setRows] = useState<Product[]>(data.items);
  const note = useInlineNote();
  const [undo, setUndo] = useState<{ id: string; stock: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { setRows(data.items); setUndo(null); }, [data]);
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
    setRows((cur) => cur.map((x) => (x.id === next.id ? next : x)));
    setUndo(undoable ? { id: p.id, stock: p.stock } : null);
    note.show(msg);
  }

  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

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
          <Link href="/ban-hang/san-pham/moi" className="mt-4 flex min-h-(--row-h) items-center justify-center gap-2 rounded-full bg-trim text-[1rem] font-semibold text-white">
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
          <li key={p.id} className="surface overflow-hidden">
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
                <Link href={`/ban-hang/san-pham/${p.id}`} className={`${SELLER_BTN_WIDE} bg-field text-navy`} aria-label={`Sửa ${p.title}`}>
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

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 px-4">
          <button
            type="button"
            disabled={data.page <= 1}
            onClick={() => onPage(data.page - 1)}
            className={`${SELLER_BTN} bg-field text-navy`}
          >
            <ChevronLeftIcon className="h-6 w-6" />
            Trước
          </button>
          <span className="text-[1rem] font-semibold text-navy">Trang {data.page}/{pages}</span>
          <button
            type="button"
            disabled={data.page >= pages}
            onClick={() => onPage(data.page + 1)}
            className={`${SELLER_BTN} bg-field text-navy`}
          >
            <ChevronRightIcon className="h-6 w-6" />
            Sau
          </button>
        </div>
      )}
    </div>
  );
}
