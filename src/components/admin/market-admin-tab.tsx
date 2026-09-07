"use client";

/*
  TAB "Chợ vật tư" của /quan-tri — sàn vật tư đa người bán (11 §7, 12 §8.4).
  Admin-only (`requireAdmin` chốt thật ở /api/admin/cho/*; tab này chỉ là vỏ).

  Bốn mục: Tổng quan (KPI sàn) · Gian hàng (duyệt/từ chối/khoá/gán chủ) ·
  Đơn hàng (xử lý THAY SHOP, timeline ghi `admin:<sđt>`) · Sản phẩm (gỡ món vi
  phạm + ẩn/hiện đánh giá ngay trong chi tiết món). Dải KPI nằm trên cùng, luôn
  hiện — mở tab ra là biết có gì đang chờ mình.

  Khu quản trị là web desktop-first, dùng CHUNG token màu với app ngư dân.
*/

import { useCallback, useEffect, useState } from "react";
import { formatVnd } from "@/lib/format";
import { ORDER_STATUS_LABEL, ORDER_STATUSES } from "@/lib/market/order-state";
import type { AdminOverview } from "@/lib/market/types";
import { MarketAdminOrders, type OrderFilter } from "./market-admin-orders";
import { MarketAdminProducts } from "./market-admin-products";
import { MarketAdminReviews } from "./market-admin-reviews";
import { MarketAdminShops } from "./market-admin-shops";
import {
  ErrorBox,
  FilterChip,
  LoadingBox,
  marketAdminGet,
} from "./market-admin-shared";

type Section = "tong-quan" | "gian-hang" | "don-hang" | "san-pham" | "danh-gia";

const SECTIONS: [Section, string][] = [
  ["tong-quan", "Tổng quan"],
  ["gian-hang", "Gian hàng"],
  ["don-hang", "Đơn hàng"],
  ["san-pham", "Sản phẩm"],
  ["danh-gia", "Đánh giá"],
];

type ShopLite = { id: string; name: string };

const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);

/** `me` là người đang đăng nhập /quan-tri (page.tsx truyền xuống) — chỉ cần SĐT
 *  để nói rõ ai đang xử lý thay shop. */
export function MarketAdminTab({ me }: { me: { phone: string } }) {
  const [section, setSection] = useState<Section>("tong-quan");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shops, setShops] = useState<ShopLite[]>([]);
  const [shopId, setShopId] = useState("");
  /* Bộ lọc đơn sống ở đây (không ở mục Đơn hàng) để ô KPI bấm được sang đúng
     mục — F-27: mở ra là "Tất cả", không phải "Chờ xác nhận" rồi báo trống. */
  const [orderStatus, setOrderStatus] = useState<OrderFilter>("all");

  const loadOverview = useCallback(() => {
    setOverview(null);
    setError(null);
    marketAdminGet<{ overview: AdminOverview }>("/api/admin/cho/tong-quan")
      .then((j) => setOverview(j.overview))
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(loadOverview, [loadOverview]);

  /* Sau mỗi lần admin GHI (duyệt shop, xử lý đơn, gỡ món), KPI ở trên phải đổi
     theo — nếu không thì ô "chờ duyệt" vẫn báo 3 trong khi danh sách chỉ còn 2,
     và admin không biết tin số nào. Nạp im: giữ số cũ trên màn cho tới khi có
     số mới, hỏng thì cứ để số cũ (dải KPI không phải chỗ báo lỗi). */
  const refreshOverview = useCallback(() => {
    marketAdminGet<{ overview: AdminOverview }>("/api/admin/cho/tong-quan")
      .then((j) => setOverview(j.overview))
      .catch(() => {});
  }, []);

  /*  Danh sách gian hàng cho ô lọc của mục Đơn hàng + Sản phẩm.
      GOM ĐỦ TRANG, không phải một lượt đọc (sửa 2026-09-07): route trả 20 shop
      một trang, nên bản cũ chỉ nạp 20 gian hàng ĐẦU và từ gian thứ 21 trở đi
      admin không lọc được — mà cũng không có dấu hiệu gì. Trần 20 lượt (~1000
      gian hàng) để một sàn lớn bất thường không kéo màn quản trị đứng hình.
      Hỏng thì NÓI: `catch` cũ nuốt lỗi thành danh sách rỗng, mạng chập là admin
      tưởng sàn không có gian hàng nào. */
  const [shopsErr, setShopsErr] = useState<string | null>(null);
  const loadShops = useCallback(async () => {
    setShopsErr(null);
    const all: ShopLite[] = [];
    try {
      for (let p = 1; p <= 20; p++) {
        const j = await marketAdminGet<{ items: ShopLite[]; total: number }>(
          `/api/admin/cho/shops?status=all&page=${p}`,
        );
        all.push(...j.items.map((s) => ({ id: s.id, name: s.name })));
        if (all.length >= j.total || j.items.length === 0) break;
      }
      setShops(all);
    } catch (e) {
      setShops([]);
      setShopsErr((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void loadShops();
  }, [loadShops]);

  return (
    <div className="mt-4 space-y-4">
      <p className="surface px-4 py-3 text-[0.875rem] leading-snug text-foreground/70">
        Chợ vật tư tàu cá — <b>nhiều đại lý bán, SDVICO là một gian hàng như mọi gian hàng</b>.
        Ở đây: duyệt gian hàng mới, gỡ món vi phạm, và <b>xử lý đơn thay shop</b> khi bà con gọi
        tổng đài. Mọi bước đều ghi tên bạn ({me.phone}) vào diễn biến đơn và nhật ký quản trị.
      </p>

      {error && <ErrorBox text={error} onRetry={loadOverview} />}
      {/*  Ô lọc gian hàng hỏng thì nói thẳng — nếu không, hai mục Đơn hàng và
           Sản phẩm chỉ còn "Mọi gian hàng" mà không ai biết vì sao. */}
      {shopsErr && (
        <ErrorBox text={`Chưa tải được danh sách gian hàng cho ô lọc — ${shopsErr}`} onRetry={() => void loadShops()} />
      )}
      {!overview && !error && <LoadingBox what="số liệu chợ" />}
      {overview && (
        <KpiStrip
          overview={overview}
          onShopsPending={() => setSection("gian-hang")}
          onOrdersPending={() => {
            setShopId("");
            setOrderStatus("cho_xac_nhan");
            setSection("don-hang");
          }}
        />
      )}

      <div className="flex flex-wrap gap-1.5">
        {SECTIONS.map(([id, label]) => (
          <FilterChip
            key={id}
            label={label}
            active={section === id}
            onClick={() => setSection(id)}
          />
        ))}
      </div>

      {section === "tong-quan" && overview && <OverviewDetail overview={overview} />}
      {section === "gian-hang" && (
        <MarketAdminShops
          onChanged={refreshOverview}
          onPickShopOrders={(shop) => {
            setShopId(shop.id);
            setOrderStatus("all");
            setSection("don-hang");
          }}
        />
      )}
      {section === "don-hang" && (
        <MarketAdminOrders
          shops={shops}
          shopId={shopId}
          onShopId={setShopId}
          status={orderStatus}
          onStatus={setOrderStatus}
          onChanged={refreshOverview}
        />
      )}
      {section === "danh-gia" && <MarketAdminReviews onChanged={refreshOverview} />}
      {section === "san-pham" && (
        <MarketAdminProducts
          shops={shops}
          shopId={shopId}
          onShopId={setShopId}
          onChanged={refreshOverview}
        />
      )}
    </div>
  );
}

/**
 * 5 ô "nhìn một phát biết sàn đang thế nào" (11 §7 KPI).
 * Hai ô là HÀNG ĐỢI có việc phải làm ⇒ bấm được, nhảy thẳng sang mục đã lọc
 * sẵn — số ở ô và danh sách mở ra là cùng một thứ, admin không phải tự dò.
 * Ba ô còn lại là con số để đọc, không có chỗ nào để đi.
 */
function KpiStrip({
  overview,
  onShopsPending,
  onOrdersPending,
}: {
  overview: AdminOverview;
  onShopsPending: () => void;
  onOrdersPending: () => void;
}) {
  const tiles: [string, string, (() => void) | null][] = [
    ["Gian hàng chờ duyệt", String(overview.shops.cho_duyet), onShopsPending],
    ["Gian hàng đang bán", String(overview.shops.hoat_dong), null],
    ["Đơn hôm nay", String(sum(overview.orders.today)), null],
    ["Chờ xác nhận (30 ngày)", String(overview.orders.d30.cho_xac_nhan), onOrdersPending],
    ["Doanh thu 30 ngày", formatVnd(overview.gmvVnd.d30), null],
  ];
  return (
    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-5">
      {tiles.map(([label, v, go]) =>
        go ? (
          <button
            key={label}
            type="button"
            onClick={go}
            className="surface min-h-[3.5rem] px-3 py-3 text-center transition hover:ring-2 hover:ring-sea focus:outline-none focus:ring-2 focus:ring-sea"
          >
            <p className="display text-[1.125rem] font-bold tabular-nums text-navy">{v}</p>
            <p className="text-[0.8125rem] font-semibold text-foreground/65">{label}</p>
            <p className="mt-0.5 text-[0.75rem] font-semibold text-sea">Xem danh sách →</p>
          </button>
        ) : (
          <div key={label} className="surface px-3 py-3 text-center">
            <p className="display text-[1.125rem] font-bold tabular-nums text-navy">{v}</p>
            <p className="text-[0.8125rem] font-semibold text-foreground/65">{label}</p>
          </div>
        ),
      )}
    </div>
  );
}

const PERIODS: [keyof AdminOverview["orders"], string][] = [
  ["today", "Hôm nay"],
  ["d7", "7 ngày"],
  ["d30", "30 ngày"],
];

function OverviewDetail({ overview }: { overview: AdminOverview }) {
  /*  SÀN CÒN TRỐNG — nhánh này trước đây không có, nên chợ mới dựng thì bảng
      vẫn vẽ đủ hàng toàn số 0 và staff phải tự đoán là "chưa có gì" hay "hỏng
      chỗ nào". Nói thẳng một câu, kèm việc phải làm tiếp. */
  const shopCount = overview.shops.cho_duyet + overview.shops.hoat_dong + overview.shops.tam_khoa + overview.shops.tu_choi;
  const orderCount = sum(overview.orders.d30);
  if (shopCount === 0 && orderCount === 0) {
    return (
      <div className="surface px-4 py-6 text-center">
        <p className="text-[1rem] font-bold text-navy">Chợ chưa có gian hàng nào.</p>
        <p className="mt-1 text-[0.875rem] leading-snug text-foreground/70">
          Số liệu sẽ hiện khi có đại lý đăng ký và bắt đầu bán. Việc đầu tiên là
          duyệt gian hàng ở mục <b>Gian hàng</b>, hoặc gán chủ cho gian hàng SDVICO.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="surface overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-[0.875rem]">
          <thead>
            <tr className="border-b border-line text-foreground/60">
              <th className="px-4 py-2 font-semibold">Kỳ</th>
              {ORDER_STATUSES.map((s) => (
                <th key={s} className="px-2 py-2 font-semibold">
                  {ORDER_STATUS_LABEL[s]}
                </th>
              ))}
              <th className="px-4 py-2 font-semibold">Doanh thu hoàn thành</th>
            </tr>
          </thead>
          <tbody>
            {PERIODS.map(([k, label]) => (
              <tr key={k} className="border-b border-line last:border-0">
                <td className="px-4 py-2 font-bold text-navy">{label}</td>
                {ORDER_STATUSES.map((s) => (
                  <td key={s} className="px-2 py-2 tabular-nums text-foreground/80">
                    {overview.orders[k][s]}
                  </td>
                ))}
                <td className="px-4 py-2 font-bold tabular-nums text-navy">
                  {formatVnd(overview.gmvVnd[k])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {(
          [
            ["Món đang bán", String(overview.productsOnSale)],
            ["Gian hàng tạm khoá", String(overview.shops.tam_khoa)],
            ["Gian hàng bị từ chối", String(overview.shops.tu_choi)],
            ["Tỉ lệ huỷ 30 ngày", `${Math.round(overview.cancelRate30d * 100)}%`],
          ] as [string, string][]
        ).map(([label, v]) => (
          <div key={label} className="surface px-3 py-3 text-center">
            <p className="display text-[1.125rem] font-bold tabular-nums text-navy">{v}</p>
            <p className="text-[0.8125rem] font-semibold text-foreground/65">{label}</p>
          </div>
        ))}
      </div>
      <p className="surface px-4 py-3 text-[0.875rem] leading-snug text-foreground/70">
        Doanh thu tính theo đơn <b>hoàn thành</b> (tiền hàng + phí giao, không trừ gì). Đơn đã giao
        quá 7 ngày tự chuyển hoàn thành lúc đọc — nên số ở đây không phụ thuộc ai mở màn lúc nào.
        Tỉ lệ huỷ = huỷ / (huỷ + hoàn thành) trong 30 ngày.
      </p>
    </div>
  );
}
