"use client";

/*
  Mục "Sản phẩm" của tab Chợ vật tư (11 §7): tìm theo gian hàng / tên, GỠ món vi
  phạm (bắt buộc lý do) hoặc TRẢ LẠI. Đánh giá KHÔNG có mục riêng — nằm trong
  chi tiết món, kể cả bản đã ẩn, để admin xem rồi ẩn/hiện tại chỗ (LEAD §4 #15:
  điểm của món và của shop tự tính lại từ đánh giá không ẩn).
*/

import { useCallback, useEffect, useState } from "react";
import { formatVnd } from "@/lib/format";
import { clockVN } from "@/lib/day-labels";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { categoryLabel } from "@/lib/market/categories";
import { RatingStars } from "@/components/market/shared/rating-stars";
import type { ProductCard, Review } from "@/lib/market/types";
import {
  EmptyBox,
  ErrorBox,
  ErrorBox as InlineError,
  FilterChip,
  LoadingBox,
  marketAdminGet,
  marketAdminPatch,
  NoticeBar,
  PageHint,
  ReasonDialog,
  useAdminList,
} from "./market-admin-shared";

const INPUT =
  "min-h-[2.75rem] rounded-xl border-0 bg-field px-3 text-[1rem] focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea";
const BTN = "min-h-[2.5rem] shrink-0 rounded-lg px-3 text-[0.8125rem] font-bold disabled:opacity-50";

/** Lọc trạng thái món cho màn quản trị — khớp bảng lọc route 12 §7.2. */
type StatusFilter = "all" | "dang_ban" | "an" | "het_hang" | "bi_go";
const STATUS_FILTERS: [StatusFilter, string][] = [
  ["all", "Tất cả"],
  ["dang_ban", "Đang bán"],
  ["het_hang", "Hết hàng"],
  ["an", "Shop ẩn"],
  ["bi_go", "Đã gỡ"],
];

export function MarketAdminProducts({
  shops,
  shopId,
  onShopId,
  onChanged,
}: {
  shops: { id: string; name: string }[];
  shopId: string;
  onShopId: (id: string) => void;
  onChanged: () => void;
}) {
  const [qDraft, setQDraft] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  /*  Băng kết quả thao tác TẮT khi đổi bộ lọc (2026-09-07): câu "Đã duyệt gian
      hàng X" đứng nguyên trong lúc staff đã sang danh sách khác là nói về một
      thứ không còn trên màn. Lỗi tải thì khác — nó thuộc về lần tải, do ErrorBox
      lo. */
  useEffect(() => setNotice(null), [shopId, q, status]);


  const sp = new URLSearchParams();
  if (shopId) sp.set("shopId", shopId);
  if (q) sp.set("q", q);
  if (status !== "all") sp.set("status", status);
  const { rows, total, error, loadingMore, reload, refresh, loadMore } = useAdminList<ProductCard>(
    `/api/admin/cho/san-pham?${sp.toString()}`,
  );

  return (
    <div className="space-y-4">
      {/*  LỌC TRẠNG THÁI — danh sách này gồm cả món đã ẩn / hết hàng / BỊ GỠ,
           nên không có hàng chip này thì không rà lại được việc mình đã làm. */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map(([id, label]) => (
          <FilterChip key={id} label={label} active={status === id} onClick={() => setStatus(id)} />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={shopId}
          onChange={(e) => onShopId(e.target.value)}
          className={`${INPUT} max-w-full`}
          aria-label="Lọc theo gian hàng"
        >
          <option value="">Mọi gian hàng</option>
          {shops.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          value={qDraft}
          onChange={(e) => setQDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") setQ(qDraft.trim());
          }}
          placeholder="Tìm theo tên món"
          className={`${INPUT} w-[16rem]`}
          aria-label="Tìm theo tên món"
        />
        <button
          type="button"
          onClick={() => setQ(qDraft.trim())}
          className="min-h-[2.75rem] rounded-xl bg-navy px-5 text-[0.9375rem] font-bold text-white"
        >
          Tìm
        </button>
      </div>

      {notice && (
        <NoticeBar ok={notice.ok} text={notice.text} onClose={() => setNotice(null)} />
      )}

      {error && <ErrorBox text={error} onRetry={reload} />}
      {!rows && !error && <LoadingBox what="sản phẩm" />}
      {rows && rows.length === 0 && (
        <EmptyBox
          text={
            q || shopId || status !== "all"
              ? "Không có món nào khớp — bỏ bớt ô lọc, chọn lại trạng thái, hoặc gõ tên khác."
              : "Chợ chưa có món nào."
          }
        />
      )}

      {rows && rows.length > 0 && (
        <PageHint
          shown={rows.length}
          total={total}
          what="món"
          note={
            /*  Ô KPI ở đầu tab đếm "Món đang bán"; danh sách này đếm CẢ món ẩn,
                hết hàng và đã bị gỡ. Hai số lệch nhau là bình thường — nhưng
                phải NÓI, không thì staff không biết tin số nào (cùng ca F-27 đã
                chữa cho mục Đơn hàng). */
            status === "all" ? (
              <>Gồm cả món <b>đã ẩn, hết hàng và bị gỡ</b> — nên số này lớn hơn ô &quot;Món đang bán&quot; ở trên.</>
            ) : (
              <>Chỉ đếm món <b>{STATUS_FILTERS.find(([id]) => id === status)?.[1]}</b>.</>
            )
          }
          onMore={loadMore}
          loadingMore={loadingMore}
        />
      )}
      {rows && rows.length > 0 && (
        <ul className="space-y-3">
          {rows.map((p) => (
            <ProductRow
              key={p.id}
              product={p}
              open={openId === p.id}
              onToggle={() => setOpenId(openId === p.id ? null : p.id)}
              onDone={(say) => {
                setNotice({ ok: true, text: say });
                refresh();
                onChanged();
              }}
              onError={(msg) => setNotice({ ok: false, text: msg })}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ProductRow({
  product,
  open,
  onToggle,
  onDone,
  onError,
}: {
  product: ProductCard;
  open: boolean;
  onToggle: () => void;
  onDone: (say: string) => void;
  onError: (msg: string) => void;
}) {
  const [ask, setAsk] = useState<"go" | "tra-lai" | null>(null);
  const [busy, setBusy] = useState(false);

  async function patch(body: Record<string, unknown>, say: string) {
    setBusy(true);
    try {
      await marketAdminPatch(`/api/admin/cho/san-pham/${encodeURIComponent(product.id)}`, body);
      onDone(`${product.title}: ${say}`);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="surface overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-4 pt-3">
        <div className="min-w-0">
          <p className="text-[1rem] font-bold text-navy">{product.title}</p>
          <p className="mt-0.5 text-[0.8125rem] text-foreground/70">
            {product.shopName} · {categoryLabel(product.category)} ·{" "}
            {/* null = liên hệ báo giá — `formatVnd(null)` sẽ ra "0 đ", nói sai với staff */}
            {product.priceVnd == null ? "Liên hệ báo giá" : `${formatVnd(product.priceVnd)}/${product.unit}`}
          </p>
          <p className="text-[0.8125rem] tabular-nums text-foreground/55">
            tồn {product.stock} · đã bán {product.soldCount}
            {product.ratingCount > 0 ? ` · ${product.ratingAvg}/5 (${product.ratingCount})` : ""}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[0.75rem] font-bold ${
            product.adminHidden
              ? "bg-danger-bg text-danger"
              : product.status === "dang_ban"
                ? "bg-ok-bg text-ok"
                : "bg-field text-foreground/70"
          }`}
        >
          {product.adminHidden
            ? "Đã gỡ"
            : product.status === "dang_ban"
              ? "Đang bán"
              : product.status === "het_hang"
                ? "Hết hàng"
                : "Shop ẩn"}
        </span>
      </div>

      {product.adminHidden && product.adminHiddenReason && (
        <p className="mt-2 bg-danger-bg px-4 py-2 text-[0.875rem] font-semibold text-danger">
          Lý do gỡ: {product.adminHiddenReason}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5 border-t border-line px-4 py-2.5">
        <button type="button" onClick={onToggle} className={`${BTN} bg-field text-navy`}>
          {open ? "Thu gọn" : "Xem + đánh giá"}
        </button>
        {product.adminHidden ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => setAsk("tra-lai")}
            className={`${BTN} bg-navy text-white`}
          >
            Trả lại cửa hàng
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => setAsk("go")}
            className={`${BTN} bg-danger-bg text-danger`}
          >
            Gỡ khỏi cửa hàng
          </button>
        )}
      </div>

      {open && (
        <div className="border-t border-line px-4 py-3">
          {product.description && (
            <p className="text-[0.875rem] leading-relaxed text-foreground/80">{product.description}</p>
          )}
          <ProductReviews productId={product.id} onError={onError} />
        </div>
      )}

      {ask === "go" && (
        <ReasonDialog
          title={`Gỡ món ${product.title}?`}
          message="Món biến khỏi cửa hàng và khỏi giỏ của người mua. Đơn đang treo có món này KHÔNG bị huỷ."
          confirmLabel="Gỡ món"
          placeholder="Vì sao gỡ? (5–300 chữ) — shop sẽ đọc câu này"
          suggestions={["Hàng cấm / không đúng quy định", "Mô tả sai sự thật", "Ảnh không phải hàng bán"]}
          onCancel={() => setAsk(null)}
          onConfirm={(reason) => {
            setAsk(null);
            patch({ adminHidden: true, reason }, "Đã gỡ món khỏi cửa hàng.");
          }}
        />
      )}
      {ask === "tra-lai" && (
        <ConfirmDialog
          title={`Trả món ${product.title} về cửa hàng?`}
          message="Món hiện lại như cũ nếu gian hàng đang hoạt động."
          confirmLabel="Trả lại"
          cancelLabel="Không"
          danger={false}
          onCancel={() => setAsk(null)}
          onConfirm={() => {
            setAsk(null);
            patch({ adminHidden: false }, "Đã trả món về cửa hàng.");
          }}
        />
      )}
    </li>
  );
}

/** Đánh giá của một món — kể cả bản đã ẩn (chỉ admin thấy), ẩn/hiện tại chỗ. */
function ProductReviews({ productId, onError }: { productId: string; onError: (m: string) => void }) {
  const [rows, setRows] = useState<Review[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setRows(null);
    setError(null);
    marketAdminGet<{ items: Review[] }>(
      `/api/admin/cho/danh-gia?productId=${encodeURIComponent(productId)}`,
    )
      .then((j) => setRows(j.items))
      .catch((e: Error) => setError(e.message));
  }, [productId]);
  useEffect(load, [load]);

  async function toggle(r: Review) {
    setBusyId(r.id);
    try {
      await marketAdminPatch(`/api/admin/cho/danh-gia/${encodeURIComponent(r.id)}`, {
        hidden: !r.hidden,
      });
      load();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      <p className="text-[0.875rem] font-semibold text-foreground/60">Đánh giá của bà con</p>
      {error && <InlineError text={error} onRetry={load} />}
      {!rows && !error && (
        <p className="py-2 text-[0.875rem] text-foreground/65">Đang tải đánh giá…</p>
      )}
      {rows && rows.length === 0 && (
        <p className="py-2 text-[0.875rem] text-foreground/65">Món này chưa có đánh giá nào.</p>
      )}
      {rows && rows.length > 0 && (
        <ul className="mt-1 space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 border-b border-line pb-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <RatingStars value={r.rating} />
                  <span className="text-[0.8125rem] tabular-nums text-foreground/55">
                    {r.buyerPhoneMasked} · {clockVN(Date.parse(r.createdAt))}
                  </span>
                  {r.hidden && (
                    <span className="rounded-full bg-danger-bg px-2 py-0.5 text-[0.75rem] font-bold text-danger">
                      Đang ẩn
                    </span>
                  )}
                </div>
                {r.comment && (
                  <p className="mt-0.5 text-[0.875rem] leading-snug text-foreground/80">{r.comment}</p>
                )}
              </div>
              <button
                type="button"
                disabled={busyId === r.id}
                onClick={() => toggle(r)}
                className={`${BTN} ${r.hidden ? "bg-field text-navy" : "bg-danger-bg text-danger"}`}
              >
                {r.hidden ? "Hiện lại" : "Ẩn"}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1 text-[0.8125rem] text-foreground/55">
        Ẩn một đánh giá thì điểm của món và của gian hàng tự tính lại ngay. Bà con chỉ đánh giá
        được sau khi đơn đã hoàn thành.
      </p>
    </div>
  );
}
