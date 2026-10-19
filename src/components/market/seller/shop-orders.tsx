"use client";

// /ban-hang/don — ĐƠN CỦA SHOP (11 §6.5). Tab theo 6 trạng thái, badge số lấy
// từ `stats.byStatus` (route thống kê đã settle đơn quá hạn). Danh sách KHÔNG
// cache — đơn đổi liên tục và người bán ở bờ (11 §9).
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { OrderStatusChip } from "@/components/market/shared/order-status-chip";
import { ChipRow, type ChipOption } from "@/components/ui/chip-row";
import { EmptyState, inputClass } from "@/components/ui/primitives";
import { CartIcon, ChevronRightIcon } from "@/components/icons";
import { formatVnd } from "@/lib/format";
import { isPendingTooLong, ORDER_STATUSES, ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/market/order-state";
import type { Order, OrderStatus, ShopStats } from "@/lib/market/types";
import { AutoCancelNote, EtaLine } from "@/components/market/shared/eta";
import { LineThumb } from "@/components/market/shared/line-thumb";
import { LoadView, agoLabel, useMarketData, useMarketList } from "./seller-net";
import { MoreButton, SELLER_BTN, linesSummary } from "./ui";

/*  TRA ĐƠN: bà con gọi và đọc "SD260907ABCD" hoặc đọc số điện thoại. Một ô duy
    nhất, tự đoán là mã hay số — bắt bà con chọn trước "tìm theo gì" là thêm một
    bước cho việc đang vội. Mã đơn luôn bắt đầu bằng SD; còn lại coi là SĐT. */
function searchParamOf(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  const digits = s.replace(/\D/g, "");
  const looksCode = /^sd/i.test(s) || (digits.length < 9 && /[a-z]/i.test(s));
  return looksCode ? `&ma=${encodeURIComponent(s)}` : `&sdt=${encodeURIComponent(digits || s)}`;
}

export function ShopOrders() {
  const [tab, setTab] = useState<OrderStatus>("cho_xac_nhan");
  const [qRaw, setQRaw] = useState("");
  const [q, setQ] = useState("");           // chỉ đổi khi bấm Tìm / Enter — không gõ tới đâu gọi tới đó
  const stats = useMarketData<{ stats: ShopStats }>("/api/ban-hang/thong-ke?range=30d");

  /*  ĐANG TRA thì BỎ lọc trạng thái: bà con cầm mã đơn trong tay, không biết nó
      đang ở tab nào — tra mà vẫn ép tab là lý do chính khiến "tìm không ra". */
  const path = useCallback(
    (page: number) =>
      q
        ? `/api/ban-hang/don?page=${page}${searchParamOf(q)}`
        : `/api/ban-hang/don?status=${tab}&page=${page}`,
    [q, tab],
  );
  const list = useMarketList<Order>(path);

  // deep-link từ Tổng quan: /ban-hang/don?tab=dang_giao (đọc sau mount)
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("tab");
    if (wanted && (ORDER_STATUSES as readonly string[]).includes(wanted)) setTab(wanted as OrderStatus);
  }, []);

  const byStatus = stats.state.kind === "ok" ? stats.state.data.stats.byStatus : null;
  const options: readonly ChipOption<OrderStatus>[] = ORDER_STATUSES.map((s) => ({
    id: s,
    label: byStatus && byStatus[s] > 0 ? `${ORDER_STATUS_LABEL[s]} ${byStatus[s]}` : ORDER_STATUS_LABEL[s],
  }));

  return (
    <div className="pb-10">
      {/*  Ô TRA ĐƠN — đứng trên hàng tab vì nó bỏ qua tab. */}
      <form
        className="mb-3 flex items-center gap-2 px-4"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(qRaw.trim());
        }}
      >
        <input
          className={inputClass}
          value={qRaw}
          onChange={(e) => setQRaw(e.target.value)}
          placeholder="Mã đơn hoặc số điện thoại"
          aria-label="Tra đơn theo mã đơn hoặc số điện thoại người mua"
          inputMode="search"
        />
        <button type="submit" className={`${SELLER_BTN} shrink-0 bg-trim px-5 text-white`}>
          Tìm
        </button>
      </form>

      {q ? (
        /*  Đang tra thì nói rõ ĐANG XEM GÌ và cho đường quay về — nếu không, bà
            con thấy danh sách lạ mà tưởng đơn của mình mất. */
        <div className="mb-3 flex flex-wrap items-center gap-2 px-4">
          <span className="text-[1rem] font-semibold text-navy">Kết quả tra &quot;{q}&quot;</span>
          <button
            type="button"
            onClick={() => {
              setQ("");
              setQRaw("");
            }}
            className={`${SELLER_BTN} bg-field px-4 text-navy`}
          >
            Xoá tra, về danh sách
          </button>
        </div>
      ) : (
        <div className="mb-3">
          <ChipRow options={options} value={tab} onChange={setTab} accent="t3" level={1} ariaLabel="Trạng thái đơn" />
        </div>
      )}

      {/*  Số đếm trên tab lấy từ /thống-kê. Hỏng thì NÓI, đừng để tab trơ số:
          không số bà con hiểu là "không có đơn nào". */}
      {!q && stats.state.kind !== "ok" && stats.state.kind !== "loading" && (
        <p className="mb-2 px-4 text-[1rem] text-foreground/70">
          Chưa đếm được số đơn từng mục — danh sách bên dưới vẫn đúng.
        </p>
      )}

      <LoadView state={list.state} what="đơn hàng của shop" onRetry={list.reload}>
        {() => (
          <>
            <Rows items={list.items} tab={tab} searching={!!q} />
            <div className="px-4">
              <MoreButton more={list.more} busy={list.loadingMore} onMore={list.loadMore} what="đơn" />
            </div>
          </>
        )}
      </LoadView>
    </div>
  );
}

function Rows({ items, tab, searching }: { items: Order[]; tab: OrderStatus; searching: boolean }) {
  if (items.length === 0) {
    return (
      <div className="px-4">
        <EmptyState icon={<CartIcon className="h-8 w-8" />}>
          {searching
            ? "Không có đơn nào khớp. Coi lại mã đơn hoặc số điện thoại giúp."
            : `Không có đơn ${ORDER_STATUS_LABEL[tab].toLowerCase()}.`}
        </EmptyState>
      </div>
    );
  }
  const nowIso = new Date().toISOString();
  return (
    <ul className="space-y-1 px-4">
      {items.map((o) => {
        const late = isPendingTooLong(o, nowIso);
        // ĐẾM SỐ DÒNG, không cộng số lượng: 1 bao gạo + 25 kg dây là "2 món",
        // không phải "26 món" (B-06/F-18).
        const soMon = o.items.length;
        return (
          <li key={o.id}>
            <Link href={`/ban-hang/don/${o.id}`} className="flex min-h-(--row-h) items-start gap-3 px-4 py-3 surface">
              <LineThumb image={o.items[0]?.image} size={3.5} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <b className="text-[1rem] text-navy">{o.code}</b>
                  <OrderStatusChip status={o.status} />
                  {o.paymentStatus === "bao_da_chuyen" && (
                    <span className="rounded-full px-2 py-0.5 text-[1rem] font-semibold"
                      style={{ backgroundColor: "var(--warn-bg)", color: "var(--warn)" }}>
                      Báo đã CK
                    </span>
                  )}
                  {o.needsRefund && (
                    <span className="rounded-full px-2 py-0.5 text-[1rem] font-semibold"
                      style={{ backgroundColor: "var(--danger-bg)", color: "var(--danger)" }}>
                      Cần hoàn tiền
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block truncate text-[1rem] text-foreground/85">
                  {o.address.name} · {o.address.province}
                </span>
                {/* Soạn hàng gì — đọc ngay trên thẻ, không phải mở từng đơn (F-15) */}
                <span className="mt-0.5 line-clamp-2 block text-[1rem] font-semibold leading-snug text-navy">
                  {linesSummary(o.items)}
                </span>
                <span className="mt-0.5 block truncate text-[0.875rem] text-foreground/65">
                  {soMon} món · {PAYMENT_METHOD_LABEL[o.paymentMethod]} · {agoLabel(o.createdAt)}
                </span>
                <b className="mt-0.5 block text-[1rem] text-navy">{formatVnd(o.totalVnd)}</b>
                {/* đếm ngược tự huỷ 72 giờ (thay câu "chờ quá 2 ngày") + hẹn giao / TRỄ HẸN — 2026-10-18 */}
                {o.status === "cho_xac_nhan" && late && <span className="mt-1 block"><AutoCancelNote order={o} who="shop" /></span>}
                <span className="mt-1 block"><EtaLine order={o} /></span>
              </span>
              <ChevronRightIcon className="h-5 w-5 shrink-0 text-foreground/40" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
