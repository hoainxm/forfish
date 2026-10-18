"use client";

// /ban-hang — CỔNG + TỔNG QUAN của Kênh người bán (11 §6.2, §6.3).
// Rẽ nhánh theo trạng thái shop: chưa có ⇒ thẻ mời mở gian hàng · cho_duyet ⇒
// màn chờ (VẪN thêm được món trước) · tu_choi ⇒ lý do + sửa · tam_khoa ⇒ băng
// đỏ nhưng VẪN vào Đơn hàng (đơn treo không bỏ rơi người mua) · hoat_dong ⇒
// việc cần làm ngay + số liệu theo kỳ + bán chạy + sắp hết hàng.
// Không cache gì: mất sóng thì nói thật (11 §9).
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BasketIcon, BoxIcon, CartIcon, PlusIcon, SettingsIcon, TrendUpIcon,
} from "@/components/icons";
import { ChipRow, type ChipOption } from "@/components/ui/chip-row";
import { CallButton } from "@/components/ui/primitives";
import { StatusBanner } from "@/components/ui/status-banner";
import { SDVICO_HOTLINE } from "@/data/sdvico-showcase";
import { formatVnd } from "@/lib/format";
import { marketSend } from "@/lib/market/client";
import type { Shop, ShopStats, StatsRange } from "@/lib/market/types";
import { InlineNote, LoadView, marketErrorText, useInlineNote, useMarketData, useMyShop } from "./seller-net";
import { SELLER_BTN } from "./ui";

const RANGE_OPTIONS: readonly ChipOption<StatsRange>[] = [
  { id: "today", label: "Hôm nay" },
  { id: "7d", label: "7 ngày" },
  { id: "30d", label: "30 ngày" },
];

export function SellerHome() {
  const { state, reload, set } = useMyShop();
  return (
    <LoadView state={state} what="Kênh người bán" onRetry={reload}>
      {(d) => (d.shop ? <ShopHome shop={d.shop} onShop={set} /> : <NoShop />)}
    </LoadView>
  );
}

/** Chưa có gian hàng — một lời mời, một nút (11 §6). */
function NoShop() {
  return (
    <div className="px-4 pb-10">
      <div className="surface px-5 py-6">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-t3-bg text-t3" aria-hidden>
          <BasketIcon className="h-7 w-7" />
        </span>
        <p className="display mt-3 text-[1.125rem] font-bold text-navy">Mở gian hàng trên SDFish</p>
        <p className="mt-1 text-[1rem] leading-snug text-foreground/70">
          Bà con có bán máy, ngư cụ, dầu nhớt, đá… thì đăng ký shop để bán thẳng cho tàu cá cả nước.
          SDVICO duyệt trong 1–2 ngày.
        </p>
        <Link
          href="/ban-hang/dang-ky"
          className="display mt-4 flex min-h-[3.75rem] w-full items-center justify-center gap-2.5 rounded-full bg-trim text-[1.125rem] font-bold text-white shadow-trim-cta transition active:scale-[0.98]"
        >
          Đăng ký gian hàng
        </Link>
      </div>
    </div>
  );
}

function ShopHome({ shop, onShop }: { shop: Shop; onShop: (s: Shop) => void }) {
  const note = useInlineNote();
  const [busy, setBusy] = useState(false);
  /*  BIÊN NHẬN sau khi gửi đăng ký (?dk=xong) — đọc SAU mount qua
      window.location để trang vẫn dựng tĩnh, cùng khuôn ?luu= của màn món. */
  const [dangKyXong, setDangKyXong] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("dk") === "xong") setDangKyXong(true);
  }, []);

  async function resume() {
    if (busy) return;
    setBusy(true);
    const res = await marketSend<{ shop: Shop }>("PATCH", "/api/ban-hang/shop", { paused: false });
    setBusy(false);
    if (res.ok) {
      onShop(res.data.shop);
      note.show("Shop đã mở bán lại.");
    } else {
      note.show(marketErrorText(res), "danger");
    }
  }

  return (
    <div className="pb-10">
      {shop.status === "cho_duyet" && (
        <div className="mb-4 overflow-hidden">
          <StatusBanner level="neutral">
            Shop {shop.name} đang chờ SDVICO duyệt (1–2 ngày). Bà con vẫn thêm sản phẩm trước được — món chỉ hiện
            lên cửa hàng sau khi duyệt.
          </StatusBanner>
        </div>
      )}
      {shop.status === "tu_choi" && (
        <div className="mb-4 overflow-hidden">
          <StatusBanner level="danger">
            SDVICO chưa duyệt shop: {shop.statusNote ?? "không ghi lý do"}. Sửa lại rồi gửi lần nữa.
          </StatusBanner>
        </div>
      )}
      {shop.status === "tam_khoa" && (
        <div className="mb-4 overflow-hidden">
          <StatusBanner level="danger">
            Shop đang bị tạm khoá: {shop.statusNote ?? "không ghi lý do"}. Gọi SDVICO để mở lại. Đơn đang treo bà con
            vẫn xử lý được.
          </StatusBanner>
        </div>
      )}
      {shop.paused && shop.status === "hoat_dong" && (
        <div className="mb-4 overflow-hidden">
          <StatusBanner level="warn">Shop đang tạm nghỉ — bà con không đặt được hàng.</StatusBanner>
        </div>
      )}

      {dangKyXong && (
        <div className="mb-3">
          <InlineNote text="Đã gửi đăng ký gian hàng. SDVICO duyệt xong sẽ báo lại — trong lúc chờ bà con soạn món trước được." />
        </div>
      )}
      {note.node}

      <div className="mb-4 flex flex-wrap items-center gap-2 px-4">
        {shop.paused && shop.status === "hoat_dong" && (
          <button type="button" onClick={() => void resume()} disabled={busy} className={`${SELLER_BTN} bg-field text-navy`}>
            <CartIcon className="h-6 w-6" />
            Mở bán lại
          </button>
        )}
        {shop.status !== "tam_khoa" && (
          <Link href="/ban-hang/san-pham/moi" className={`${SELLER_BTN} bg-trim text-white`}>
            <PlusIcon className="h-6 w-6" />
            Thêm món
          </Link>
        )}
        {(shop.status === "cho_duyet" || shop.status === "tu_choi") && (
          <Link href="/ban-hang/dang-ky" className={`${SELLER_BTN} bg-field text-navy`}>
            <SettingsIcon className="h-6 w-6" />
            Sửa đăng ký
          </Link>
        )}
        {(shop.status === "tam_khoa" || shop.status === "tu_choi" || shop.status === "cho_duyet") && (
          <CallButton phone={SDVICO_HOTLINE} label="Gọi SDVICO" />
        )}
      </div>

      <Stats shopStatus={shop.status} />

      <nav aria-label="Quản lý gian hàng" className="mt-3 space-y-3 px-4">
        <HomeLink href="/ban-hang/san-pham" icon={<BoxIcon className="h-6 w-6" />} label="Sản phẩm" sub="Thêm, sửa giá, sửa tồn kho" />
        <HomeLink href="/ban-hang/don" icon={<CartIcon className="h-6 w-6" />} label="Đơn hàng" sub="Xác nhận, giao hàng, xem tiền" />
        <HomeLink href="/ban-hang/cai-dat" icon={<SettingsIcon className="h-6 w-6" />} label="Cài đặt shop" sub="Hồ sơ, số tài khoản, tạm nghỉ bán" />
        {shop.status === "hoat_dong" && (
          <HomeLink
            href={`/cho/shop/${shop.slug}`}
            icon={<BasketIcon className="h-6 w-6" />}
            label="Xem shop trên cửa hàng"
            sub="Đúng thứ bà con nhìn thấy"
          />
        )}
      </nav>
    </div>
  );
}

function HomeLink({ href, icon, label, sub }: { href: string; icon: React.ReactNode; label: string; sub: string }) {
  return (
    <Link href={href} className="flex min-h-[3.5rem] items-center gap-3 px-4 py-2 surface">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-field text-navy">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[1.125rem] font-bold text-navy">{label}</span>
        <span className="block text-[0.9375rem] leading-snug text-foreground/70">{sub}</span>
      </span>
    </Link>
  );
}

/** Số liệu Tổng quan — mọi con số từ `GET /thong-ke` (đã settle đơn quá hạn). */
function Stats({ shopStatus }: { shopStatus: Shop["status"] }) {
  const [range, setRange] = useState<StatsRange>("7d");
  const { state, reload } = useMarketData<{ stats: ShopStats }>(`/api/ban-hang/thong-ke?range=${range}`);

  return (
    <section>
      <div className="-mx-0 mb-3">
        <ChipRow options={RANGE_OPTIONS} value={range} onChange={setRange} accent="t3" level={1} ariaLabel="Khoảng thời gian" />
      </div>
      <LoadView state={state} what="số liệu shop" onRetry={reload}>
        {(d) => <StatsBody stats={d.stats} shopStatus={shopStatus} />}
      </LoadView>
    </section>
  );
}

function StatsBody({ stats, shopStatus }: { stats: ShopStats; shopStatus: Shop["status"] }) {
  const empty =
    stats.orders === 0 && stats.pendingOrders === 0 && stats.shippingOrders === 0 && stats.awaitingPaymentConfirm === 0;
  return (
    <div className="px-4">
      <div className="grid grid-cols-2 gap-2">
        <Tile n={stats.pendingOrders} label="Chờ xác nhận" href="/ban-hang/don?tab=cho_xac_nhan" strong />
        {/* đã xác nhận, chưa đi giao — việc kế tiếp của shop (2026-10-18) */}
        <Tile n={stats.byStatus.da_xac_nhan} label="Cần đi giao" href="/ban-hang/don?tab=da_xac_nhan" />
        <Tile n={stats.shippingOrders} label="Đang giao" href="/ban-hang/don?tab=dang_giao" />
        <Tile n={stats.awaitingPaymentConfirm} label="Báo đã CK" href="/ban-hang/don?tab=cho_xac_nhan" />
      </div>

      <div className="mt-3 surface px-4 py-3">
        <p className="text-[1rem] text-foreground/70">
          Đơn: <b className="text-navy">{stats.orders}</b> · Hoàn thành: <b className="text-navy">{stats.completed}</b>
        </p>
        <p className="mt-1 text-[1.125rem] font-bold text-navy">Doanh thu {formatVnd(stats.revenueVnd)}</p>
        <p className="mt-0.5 text-[0.875rem] text-foreground/65">Tính theo đơn đã hoàn thành (tiền hàng + phí giao).</p>
      </div>

      {stats.lowStock.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-2xl">
          <StatusBanner level="warn">
            {stats.lowStock.length} món sắp hết hoặc đã hết hàng — vào Sản phẩm thêm tồn giúp bà con đặt được.
          </StatusBanner>
        </div>
      )}

      {stats.topProducts.length > 0 && (
        <div className="mt-3 surface px-4 py-3">
          <p className="mb-2 flex items-center gap-2 text-[1rem] font-bold text-navy">
            <TrendUpIcon className="h-5 w-5" /> Bán chạy
          </p>
          <ol className="space-y-1">
            {stats.topProducts.map((p) => (
              <li key={p.productId} className="flex min-h-[2.5rem] items-center justify-between gap-3 text-[1rem]">
                <span className="min-w-0 flex-1 truncate text-foreground/85">{p.title}</span>
                <span className="shrink-0 font-bold text-navy">{p.qty}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {empty && stats.topProducts.length === 0 && (
        <p className="mt-3 rounded-2xl bg-field/70 px-4 py-6 text-center text-[1.125rem] text-foreground/70">
          {shopStatus === "hoat_dong"
            ? "Chưa có đơn nào. Thêm sản phẩm để bà con thấy shop."
            : "Chưa có đơn nào — món sẽ lên cửa hàng sau khi SDVICO duyệt shop."}
        </p>
      )}
    </div>
  );
}

function Tile({ n, label, href, strong }: { n: number; label: string; href: string; strong?: boolean }) {
  return (
    <Link
      href={href}
      className="flex min-h-[5rem] flex-col items-center justify-center rounded-2xl px-2 py-3 text-center"
      style={strong && n > 0
        ? { backgroundColor: "var(--warn-bg)", color: "var(--warn)" }
        : { backgroundColor: "var(--card)", color: "var(--navy)" }}
    >
      <span className="display text-[1.5rem] font-bold leading-none">{n}</span>
      <span className="mt-1 text-[0.875rem] font-bold leading-snug">{label}</span>
    </Link>
  );
}
