// NỘI DUNG THÔNG BÁO của Chợ vật tư — THUẦN (bảng 11 §8). notify.ts (server-only)
// re-export `marketNotice` từ đây để route gọi một chỗ; tách file để test không
// phải kéo `server-only`.
import { formatVnd } from "@/lib/format";
import { PAYMENT_METHOD_LABEL } from "./order-state";
import type { Order, Product, Shop } from "./types";

export type MarketEvent =
  | "N1" | "N2" | "N3" | "N4" | "N5" | "N6" | "N7" | "N8" | "N9" | "N9b" | "N10" | "N11" | "N12" | "N13";

export interface MarketNoticeCtx {
  order?: Order;
  shop?: Pick<Shop, "id" | "name">;
  product?: Pick<Product, "id" | "title">;
  reason?: string;
  hotline: string;
}

export interface MarketNoticeOut { title: string; body: string; url: string; pushOs: boolean; tag: string }

const buyerUrl = (o?: Order) => `/cho/don/${o?.id ?? ""}`;
const sellerUrl = (o?: Order) => `/ban-hang/don/${o?.id ?? ""}`;
const orderTag = (o?: Order) => `mdon-${o?.id ?? ""}`;
const shopTag = (s?: Pick<Shop, "id">) => `mshop-${s?.id ?? ""}`;
const dot = (s?: string) => {
  const t = (s ?? "").trim();
  return t ? (/[.!?]$/.test(t) ? t : `${t}.`) : "";
};

/** Dựng title/body/url/pushOs/tag cho một sự kiện theo bảng 11 §8 — THUẦN, có test (mọi câu có mã đơn; pushOs đúng bảng). */
export function marketNotice(ev: MarketEvent, ctx: MarketNoticeCtx): MarketNoticeOut {
  const o = ctx.order;
  const code = o?.code ?? "";
  const shopName = ctx.shop?.name ?? o?.shopName ?? "";
  const reason = (ctx.reason ?? o?.cancelReason ?? "").trim();
  switch (ev) {
    case "N1": {
      const k = o?.items.reduce((s, l) => s + l.qty, 0) ?? 0;
      const cach = o ? PAYMENT_METHOD_LABEL[o.paymentMethod] : "";
      return {
        title: `Đơn mới ${code}`,
        body: `${o?.address.name ?? "Khách"} đặt ${k} món · ${formatVnd(o?.totalVnd ?? 0)} · ${cach}`,
        url: sellerUrl(o), pushOs: true, tag: orderTag(o),
      };
    }
    case "N2":
      return {
        title: `Shop ${shopName} đã xác nhận đơn ${code}`,
        body: `Sẽ giao tới ${o?.address.detail ?? ""}.`,
        url: buyerUrl(o), pushOs: false, tag: orderTag(o),
      };
    case "N3": {
      const parts = [o?.carrier?.trim() || "Shop đang giao"];
      if (o?.trackingCode?.trim()) parts.push(`mã vận đơn ${o.trackingCode.trim()}`);
      const phone = o?.shopPhone || ctx.hotline;
      return {
        title: `Đơn ${code} đang giao`,
        body: `${parts.join(" · ")}. Gọi shop: ${phone}`,
        url: buyerUrl(o), pushOs: true, tag: orderTag(o),
      };
    }
    case "N4":
      return {
        title: `Đơn ${code} đã giao`,
        body: "Nhận đủ hàng thì bấm Đã nhận hàng giúp shop.",
        url: buyerUrl(o), pushOs: true, tag: orderTag(o),
      };
    case "N5":
      return {
        title: `Đơn ${code} hoàn thành`,
        body: "Người mua đã nhận hàng.",
        url: sellerUrl(o), pushOs: false, tag: orderTag(o),
      };
    case "N6":
      return {
        title: `Đơn ${code} bị huỷ bởi người mua`,
        body: reason ? dot(reason) : "Người mua không ghi lý do.",
        url: sellerUrl(o), pushOs: false, tag: orderTag(o),
      };
    case "N7":
      return {
        title: `Đơn ${code} đã huỷ`,
        body: `Lý do: ${dot(reason) || "shop không ghi."}${o?.needsRefund ? " Shop sẽ hoàn tiền đã chuyển." : ""}`,
        url: buyerUrl(o), pushOs: true, tag: orderTag(o),
      };
    case "N8":
      return {
        title: `Người mua báo đã chuyển ${formatVnd(o?.totalVnd ?? 0)}`,
        body: `Đơn ${code} · nội dung ${code}. Kiểm tra rồi bấm Đã nhận tiền.`,
        url: sellerUrl(o), pushOs: true, tag: orderTag(o),
      };
    case "N9":
      return {
        title: `Shop đã nhận tiền đơn ${code}`,
        body: `Đơn ${code} đã được shop xác nhận nhận tiền.`,
        url: buyerUrl(o), pushOs: false, tag: orderTag(o),
      };
    case "N9b":
      return {
        title: `Shop chưa thấy tiền đơn ${code}`,
        body: `${dot(reason) || "Shop chưa thấy tiền về."} Kiểm tra lại hoặc gọi shop.`,
        url: buyerUrl(o), pushOs: true, tag: orderTag(o),
      };
    case "N10":
      return {
        title: `Shop ${shopName} đã được duyệt`,
        body: "Món đã soạn nay hiện trên chợ.",
        url: "/ban-hang", pushOs: true, tag: shopTag(ctx.shop),
      };
    case "N11":
      return {
        title: `Shop ${shopName} chưa được duyệt`,
        body: `${dot(reason)} Sửa rồi gửi lại.`.trim(),
        url: "/ban-hang", pushOs: true, tag: shopTag(ctx.shop),
      };
    case "N12":
      return {
        title: `Shop ${shopName} bị tạm khoá`,
        body: `${dot(reason)} Gọi SDVICO ${ctx.hotline}.`.trim(),
        url: "/ban-hang", pushOs: true, tag: shopTag(ctx.shop),
      };
    case "N13":
      return {
        title: `SDVICO đã gỡ món ${ctx.product?.title ?? ""}`,
        body: dot(reason) || "Vi phạm quy định chợ.",
        url: `/ban-hang/san-pham/${ctx.product?.id ?? ""}`, pushOs: false, tag: shopTag(ctx.shop),
      };
  }
}
