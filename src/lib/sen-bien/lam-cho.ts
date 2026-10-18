"use client";

// SEN BIỂN — LÀM LỆNH CHỢ VẬT TƯ (2026-10-18, "toàn bộ thao tác sàn phải đảm bảo sen biển thực
// hiện"). Nhận lệnh đã hiểu (lenh-cho.ts) → gọi ĐÚNG route mà nút bấm trên màn gọi (cùng luật
// server, không đường tắt) → trả câu nói + (tuỳ) màn cần mở + (tuỳ) NÚT XÁC NHẬN.
//   · đọc (đơn, giỏ, báo giá, đơn mới của shop, yêu cầu mới) ⇒ nói luôn
//   · ghi vô hại, lùi được (thêm giỏ) ⇒ làm luôn, nói cách bỏ
//   · ghi có hậu quả (huỷ, xác nhận, giao, nhận tiền, đồng ý giá, báo giá…) ⇒ hỏi MỘT CHẠM xác
//     nhận rồi mới gửi (13 §4.3) — câu xác nhận nói rõ mã đơn + việc + hẹn/tiền
//   · đặt hàng / gửi yêu cầu ⇒ mở màn điền sẵn, nút Đặt/Gửi trên màn chính là cú chạm xác nhận
// Mất sóng: đọc bản lưu (đơn, yêu cầu, giỏ); việc ghi nói thẳng "cần có sóng", không giả vờ.
import { addDaysIso } from "@/lib/days";
import { formatVnd } from "@/lib/format";
import { loadMarketCart, saveMarketCart, addMarketLine } from "@/lib/market/cart";
import { marketGet, marketPost, marketSend, type MarketResult } from "@/lib/market/client";
import { etaLabel, vnToday } from "@/lib/market/eta";
import { ORDER_STATUS_LABEL } from "@/lib/market/order-state";
import { loadCachedMarketOrders, saveCachedMarketOrders } from "@/lib/market/orders-cache";
import { quoteTotal, REQUEST_STATUS_LABEL } from "@/lib/market/request-state";
import { loadCachedRequests, saveCachedRequests } from "@/lib/market/requests-cache";
import type { MarketRequest, Order, ProductCard } from "@/lib/market/types";
import type { Hen, LenhCho } from "./lenh-cho";

export interface ChoKetQua {
  noi: string;
  /** màn cần mở (router.push) */
  den?: string;
  /** việc ghi có hậu quả — hiện nút; bấm mới chạy, trả câu kết quả */
  xacNhan?: { nhan: string; lam: () => Promise<ChoKetQua> };
}

const CAN_SONG = "Việc này cần có sóng — có sóng lại bà con nói lại giúp.";
const online = () => typeof navigator === "undefined" || navigator.onLine !== false;
const today = () => vnToday();
const henRa = (h: Hen) => ({ etaFrom: addDaysIso(today(), h.tu), etaTo: addDaysIso(today(), h.den) });
const henChu = (h: Hen) => { const e = henRa(h); return etaLabel(e.etaFrom, e.etaTo, today()); };
/** đọc mã cho dễ nghe: "SD261018UY3Y" → "đuôi U Y 3 Y" */
const duoi = (code: string) => code.slice(-4).split("").join(" ");
const loi = (r: Extract<MarketResult<unknown>, { ok: false }>, viec: string): ChoKetQua => ({
  noi: r.offline ? CAN_SONG : r.code === "bad_transition" ? `Đơn đã sang bước khác rồi — ${viec} không làm được nữa.` : r.message || `Chưa ${viec} được — thử lại giúp.`,
});

/** Chọn MỘT đơn: theo mã (đủ hoặc 4 ký tự cuối) → hoặc đơn duy nhất hợp việc. */
function chonDon(list: Order[], ma: string | undefined, hop: (o: Order) => boolean, viec: string): Order | ChoKetQua {
  if (ma) {
    const o = list.find((x) => x.code === ma || x.code.endsWith(ma));
    if (!o) return { noi: `Không thấy đơn đuôi ${duoi(ma)} trong các đơn gần đây.` };
    if (!hop(o)) return { noi: `Đơn ${duoi(o.code)} đang ${ORDER_STATUS_LABEL[o.status].toLowerCase()} — không ${viec} được.` };
    return o;
  }
  const ok = list.filter(hop);
  if (ok.length === 1) return ok[0];
  if (ok.length === 0) return { noi: `Không có đơn nào để ${viec}.` };
  const ds = ok.slice(0, 3).map((o) => `đuôi ${duoi(o.code)}${o.shopName ? ` của ${o.shopName}` : ""}`).join("; ");
  return { noi: `Có ${ok.length} đơn ${viec} được: ${ds}. Bà con nói kèm 4 chữ cuối mã đơn.` };
}

async function donCuaToi(phone: string | null): Promise<{ items: Order[]; luu: boolean } | null> {
  if (online()) {
    const r = await marketGet<{ items: Order[] }>("/api/cho/don?page=1");
    if (r.ok) { saveCachedMarketOrders(phone, r.data.items); return { items: r.data.items, luu: false }; }
  }
  const c = loadCachedMarketOrders(phone);
  return c ? { items: c.orders, luu: true } : null;
}
async function donShop(status?: string): Promise<Order[] | ChoKetQua> {
  if (!online()) return { noi: CAN_SONG };
  const r = await marketGet<{ items: Order[] }>(`/api/ban-hang/don?page=1${status ? `&status=${status}` : ""}`);
  if (!r.ok) return r.status === 403 || r.status === 404 ? { noi: "Máy này chưa đăng nhập tài khoản chủ shop." } : loi(r, "đọc đơn shop");
  return r.data.items;
}
async function yeuCauCuaToi(phone: string | null): Promise<MarketRequest[] | null> {
  if (online()) {
    const r = await marketGet<{ items: MarketRequest[] }>("/api/cho/yeu-cau");
    if (r.ok) { saveCachedRequests(phone, r.data.items); return r.data.items; }
  }
  return loadCachedRequests(phone)?.items ?? null;
}
function chonYc(list: MarketRequest[], ma: string | undefined, hop: (r: MarketRequest) => boolean, viec: string): MarketRequest | ChoKetQua {
  if (ma) {
    const r = list.find((x) => x.code === ma || x.code.endsWith(ma));
    if (!r) return { noi: `Không thấy yêu cầu đuôi ${duoi(ma)}.` };
    return hop(r) ? r : { noi: `Yêu cầu "${r.title}" đang ${REQUEST_STATUS_LABEL[r.status].toLowerCase()} — không ${viec} được.` };
  }
  const ok = list.filter(hop);
  if (ok.length === 1) return ok[0];
  if (ok.length === 0) return { noi: `Không có yêu cầu nào để ${viec}.` };
  return { noi: `Có ${ok.length} yêu cầu: ${ok.slice(0, 3).map((r) => `${r.title} đuôi ${duoi(r.code)}`).join("; ")}. Nói kèm 4 chữ cuối mã.` };
}
const laKetQua = (x: unknown): x is ChoKetQua => !!x && typeof x === "object" && "noi" in x;

/** PATCH đơn của shop — xác nhận / giao / đã giao / dời hẹn / nhận tiền / huỷ. */
function vaDonShop(o: Order, body: Record<string, unknown>, xong: string, viec: string) {
  return async (): Promise<ChoKetQua> => {
    if (!online()) return { noi: CAN_SONG };
    const r = await marketSend<{ order: Order }>("PATCH", `/api/ban-hang/don/${o.id}`, body);
    return r.ok ? { noi: xong, den: `/ban-hang/don/${o.id}` } : loi(r, viec);
  };
}

export async function lamLenhCho(l: LenhCho, phone: string | null): Promise<ChoKetQua> {
  try {
    switch (l.k) {
      // ── chủ tàu: tìm / giỏ / đặt ────────────────────────────────────────
      case "tim":
        return { noi: `Mở chợ tìm ${l.q}.`, den: `/cho/tim?q=${encodeURIComponent(l.q)}` };
      case "them_gio": {
        if (!online()) return { noi: CAN_SONG };
        const r = await marketGet<{ items: ProductCard[] }>(`/api/cho/san-pham?q=${encodeURIComponent(l.q)}&pageSize=3`);
        if (!r.ok) return loi(r, "tìm món");
        const ban = r.data.items.filter((p) => p.status === "dang_ban" && p.priceVnd != null && !p.shopPaused && p.variants.length === 0);
        if (ban.length === 0)
          return r.data.items.length > 0
            ? { noi: `Món ${l.q} cần chọn loại hoặc hỏi giá — tôi mở chợ để bà con chọn.`, den: `/cho/tim?q=${encodeURIComponent(l.q)}` }
            : { noi: `Chợ chưa có ${l.q}. Nói "nhờ chủ sàn tìm ${l.q}" để chủ sàn tìm giúp.` };
        const p = ban[0];
        const add = addMarketLine(loadMarketCart(phone), p.id, undefined, l.qty);
        if (add.reason === "gio_day") return { noi: "Giỏ đã đầy 50 món — đặt bớt rồi thêm tiếp." };
        if (!saveMarketCart(phone, add.items)) return { noi: "Máy hết chỗ, chưa lưu được giỏ." };
        return { noi: `Đã thêm ${l.qty} ${p.unit} ${p.title} của ${p.shopName}, ${formatVnd(p.priceVnd! * l.qty)}. Không đúng thì mở giỏ bỏ ra.`, den: "/cho/gio" };
      }
      case "xem_gio": {
        const g = loadMarketCart(phone);
        return g.length === 0 ? { noi: "Giỏ chưa có gì." } : { noi: `Giỏ có ${g.length} món. Mở giỏ cho bà con coi.`, den: "/cho/gio" };
      }
      case "dat_hang": {
        const g = loadMarketCart(phone);
        if (g.length === 0) return { noi: "Giỏ chưa có gì để đặt. Nói tên món cần mua, tôi tìm giúp." };
        return { noi: "Mở trang đặt hàng — bà con coi lại địa chỉ rồi bấm Đặt hàng để chốt.", den: "/cho/thanh-toan" };
      }

      // ── chủ tàu: đơn ────────────────────────────────────────────────────
      case "don_xem": {
        const d = await donCuaToi(phone);
        if (!d) return { noi: online() ? "Chưa đọc được đơn — thử lại giúp." : "Mất sóng và máy chưa lưu đơn nào." };
        const mo = d.items.filter((o) => o.status !== "hoan_thanh" && o.status !== "da_huy");
        const pick = l.ma ? d.items.find((o) => o.code.endsWith(l.ma!)) : undefined;
        const ds = pick ? [pick] : mo.slice(0, 3);
        if (ds.length === 0) return { noi: "Không có đơn nào đang chờ giao.", den: "/cho/don" };
        const choGiao = (o: Order) => o.status === "da_xac_nhan" || o.status === "dang_giao";
        const cau = ds.map((o) => `đơn ${o.shopName ?? ""} đuôi ${duoi(o.code)}: ${ORDER_STATUS_LABEL[o.status].toLowerCase()}${o.etaFrom && choGiao(o) ? `, hẹn giao ${etaLabel(o.etaFrom, o.etaTo, today())}` : ""}`).join("; ");
        return { noi: `${cau.charAt(0).toUpperCase()}${cau.slice(1)}.${d.luu ? " Đây là bản lưu trong máy." : ""}`, den: ds.length === 1 ? `/cho/don/${ds[0].id}` : "/cho/don" };
      }
      case "goi_shop": {
        const d = await donCuaToi(phone);
        const o = d?.items.find((x) => (l.ma ? x.code.endsWith(l.ma) : x.status !== "da_huy"));
        if (!o) return { noi: "Chưa có đơn nào để gọi shop.", den: "/cho/don" };
        return { noi: o.shopPhone ? `Số ${o.shopName ?? "shop"}: ${o.shopPhone}. Mở đơn để bấm gọi.` : `Mở đơn để gọi ${o.shopName ?? "shop"}.`, den: `/cho/don/${o.id}` };
      }
      case "don_huy": {
        if (!online()) return { noi: CAN_SONG };
        if (l.shop) {
          const list = await donShop();
          if (laKetQua(list)) return list;
          const o = chonDon(list, l.ma, (x) => x.status === "cho_xac_nhan" || x.status === "da_xac_nhan", "huỷ");
          if (laKetQua(o)) return o;
          if (!l.lyDo) return { noi: `Huỷ đơn đuôi ${duoi(o.code)} cần lý do. Nói "huỷ đơn của khách vì …".` };
          return { noi: `Huỷ đơn đuôi ${duoi(o.code)} của ${o.address.name}, lý do: ${l.lyDo}?`, xacNhan: { nhan: "Huỷ đơn", lam: vaDonShop(o, { status: "da_huy", note: l.lyDo }, `Đã huỷ đơn đuôi ${duoi(o.code)}, khách nhận tin ngay.`, "huỷ đơn") } };
        }
        const d = await donCuaToi(phone);
        if (!d) return { noi: "Chưa đọc được đơn — thử lại giúp." };
        const o = chonDon(d.items, l.ma, (x) => x.status === "cho_xac_nhan", "huỷ");
        if (laKetQua(o)) return o;
        return {
          noi: `Huỷ đơn đuôi ${duoi(o.code)} của ${o.shopName ?? "shop"}, ${formatVnd(o.totalVnd)}?`,
          xacNhan: { nhan: "Huỷ đơn", lam: async () => {
            const r = await marketPost<{ order: Order }>(`/api/cho/don/${o.id}/huy`, l.lyDo ? { reason: l.lyDo } : {});
            return r.ok ? { noi: `Đã huỷ đơn đuôi ${duoi(o.code)}.`, den: `/cho/don/${o.id}` } : loi(r, "huỷ đơn");
          } },
        };
      }
      case "da_nhan":
      case "bao_chuyen": {
        if (!online()) return { noi: CAN_SONG };
        const d = await donCuaToi(phone);
        if (!d) return { noi: "Chưa đọc được đơn — thử lại giúp." };
        const nhan = l.k === "da_nhan";
        const o = chonDon(d.items, l.ma,
          nhan ? (x) => x.status === "da_giao" : (x) => x.paymentMethod === "chuyen_khoan" && x.paymentStatus === "chua_thanh_toan" && x.status !== "da_huy" && x.status !== "hoan_thanh",
          nhan ? "báo đã nhận" : "báo chuyển khoản");
        if (laKetQua(o)) return o;
        return {
          noi: nhan ? `Báo đã nhận đủ hàng đơn đuôi ${duoi(o.code)}?` : `Báo đã chuyển ${formatVnd(o.totalVnd)} cho ${o.shopName ?? "shop"}, đơn đuôi ${duoi(o.code)}?`,
          xacNhan: { nhan: nhan ? "Đã nhận hàng" : "Đã chuyển khoản", lam: async () => {
            const r = await marketPost<{ order: Order }>(`/api/cho/don/${o.id}/${nhan ? "da-nhan" : "bao-chuyen"}`, {});
            return r.ok ? { noi: nhan ? "Cảm ơn bà con — đơn đã hoàn thành." : "Đã báo shop — shop kiểm tra rồi xác nhận.", den: `/cho/don/${o.id}` } : loi(r, nhan ? "báo nhận hàng" : "báo chuyển khoản");
          } },
        };
      }

      // ── chủ tàu: yêu cầu đặt hàng ───────────────────────────────────────
      case "yc_moi": {
        const qs = new URLSearchParams();
        if (l.q) qs.set("ten", l.q);
        if (l.qty > 1) qs.set("sl", String(l.qty));
        if (l.unit) qs.set("dv", l.unit);
        return { noi: l.q ? `Mở phiếu nhờ chủ sàn tìm ${l.qty} ${l.q}. Coi lại rồi bấm Gửi cho chủ sàn.` : "Mở phiếu đặt món chợ chưa có — bà con ghi món cần.", den: `/cho/yeu-cau/moi${qs.size ? `?${qs}` : ""}` };
      }
      case "yc_xem": {
        const list = await yeuCauCuaToi(phone);
        if (!list) return { noi: online() ? "Chưa đọc được yêu cầu — thử lại giúp." : "Mất sóng và máy chưa lưu yêu cầu nào." };
        const mo = list.filter((r) => r.status === "moi" || r.status === "da_bao_gia");
        if (mo.length === 0) return { noi: "Không có yêu cầu nào đang chờ.", den: "/cho/yeu-cau" };
        const cau = mo.slice(0, 3).map((r) => r.status === "da_bao_gia" && r.quote
          ? `${r.title}: đã có giá ${formatVnd(quoteTotal(r.quote))}, giao ${etaLabel(r.quote.etaFrom, r.quote.etaTo, today())}`
          : `${r.title}: chủ sàn đang tìm`).join("; ");
        return { noi: `${cau}.${mo.some((r) => r.status === "da_bao_gia") ? ' Đồng ý thì nói "đồng ý báo giá".' : ""}`, den: mo.length === 1 ? `/cho/yeu-cau/${mo[0].id}` : "/cho/yeu-cau" };
      }
      case "yc_dong_y":
      case "yc_huy": {
        if (!online()) return { noi: CAN_SONG };
        const list = await yeuCauCuaToi(phone);
        if (!list) return { noi: "Chưa đọc được yêu cầu — thử lại giúp." };
        const dongY = l.k === "yc_dong_y";
        const r = chonYc(list, l.ma, dongY ? (x) => x.status === "da_bao_gia" : (x) => x.status === "moi" || x.status === "da_bao_gia", dongY ? "đồng ý" : "huỷ");
        if (laKetQua(r)) return r;
        return {
          noi: dongY && r.quote ? `Đặt ${r.title} giá ${formatVnd(quoteTotal(r.quote))}, giao ${etaLabel(r.quote.etaFrom, r.quote.etaTo, today())}?` : `Huỷ yêu cầu ${r.title}?`,
          xacNhan: { nhan: dongY ? "Đặt hàng" : "Huỷ yêu cầu", lam: async () => {
            const x = await marketSend<{ request: MarketRequest; order?: Order }>("PATCH", `/api/cho/yeu-cau/${r.id}`, { action: dongY ? "dong_y" : "huy" });
            if (!x.ok) return loi(x, dongY ? "đặt hàng" : "huỷ yêu cầu");
            return dongY && x.data.order ? { noi: `Đã đặt — đơn đuôi ${duoi(x.data.order.code)}.`, den: `/cho/don/${x.data.order.id}` } : { noi: "Đã huỷ yêu cầu.", den: `/cho/yeu-cau/${r.id}` };
          } },
        };
      }

      // ── chủ shop ───────────────────────────────────────────────────────
      case "shop_don_moi": {
        const list = await donShop("cho_xac_nhan");
        if (laKetQua(list)) return list;
        if (list.length === 0) return { noi: "Shop không có đơn nào chờ xác nhận.", den: "/ban-hang/don" };
        const o = list[0];
        return { noi: `Có ${list.length} đơn chờ xác nhận. Mới nhất: ${o.address.name}, ${o.items.length} món, ${formatVnd(o.totalVnd)}, đuôi ${duoi(o.code)}. Nói "xác nhận đơn, giao ngày mai" để nhận.`, den: "/ban-hang/don?tab=cho_xac_nhan" };
      }
      case "shop_xac_nhan":
      case "shop_doi_hen": {
        const xn = l.k === "shop_xac_nhan";
        const list = await donShop(xn ? "cho_xac_nhan" : undefined);
        if (laKetQua(list)) return list;
        const o = chonDon(list, l.ma, xn ? (x) => x.status === "cho_xac_nhan" : (x) => x.status === "da_xac_nhan" || x.status === "dang_giao", xn ? "xác nhận" : "dời hẹn");
        if (laKetQua(o)) return o;
        if (!l.hen) return { noi: `${xn ? "Xác nhận" : "Dời hẹn"} đơn đuôi ${duoi(o.code)} — hẹn giao khi nào? Nói "hôm nay", "ngày mai" hay "hai ba ngày".` };
        const e = henRa(l.hen);
        return {
          noi: `${xn ? "Xác nhận" : "Dời hẹn"} đơn đuôi ${duoi(o.code)} của ${o.address.name}, hẹn giao ${henChu(l.hen)}?`,
          xacNhan: { nhan: xn ? "Xác nhận đơn" : "Dời hẹn", lam: vaDonShop(o, xn ? { status: "da_xac_nhan", ...e } : { ...e }, xn ? `Đã xác nhận, hẹn giao ${henChu(l.hen)}.` : `Đã dời hẹn giao sang ${henChu(l.hen)}.`, xn ? "xác nhận đơn" : "dời hẹn") },
        };
      }
      case "shop_giao": {
        const list = await donShop("da_xac_nhan");
        if (laKetQua(list)) return list;
        const o = chonDon(list, l.ma, (x) => x.status === "da_xac_nhan", "đi giao");
        if (laKetQua(o)) return o;
        return {
          noi: `Chuyển đơn đuôi ${duoi(o.code)} sang đang giao${l.nhaXe ? `, ${l.nhaXe.charAt(0).toLowerCase()}${l.nhaXe.slice(1)}` : ""}?`,
          xacNhan: { nhan: "Đang giao", lam: vaDonShop(o, { status: "dang_giao", ...(l.nhaXe ? { carrier: l.nhaXe } : {}) }, "Đã chuyển sang đang giao, khách nhận tin ngay.", "chuyển đang giao") },
        };
      }
      case "shop_da_giao": {
        const list = await donShop("dang_giao");
        if (laKetQua(list)) return list;
        const o = chonDon(list, l.ma, (x) => x.status === "dang_giao", "báo giao xong");
        if (laKetQua(o)) return o;
        return { noi: `Báo đã giao xong đơn đuôi ${duoi(o.code)} cho ${o.address.name}?`, xacNhan: { nhan: "Đã giao xong", lam: vaDonShop(o, { status: "da_giao" }, "Đã báo giao xong — khách được nhắc bấm Đã nhận hàng.", "báo giao xong") } };
      }
      case "shop_nhan_tien": {
        const list = await donShop();
        if (laKetQua(list)) return list;
        const o = chonDon(list, l.ma, (x) => x.paymentStatus === "bao_da_chuyen" && x.status !== "da_huy", "xác nhận nhận tiền");
        if (laKetQua(o)) return o;
        return { noi: `Đã nhận đủ ${formatVnd(o.totalVnd)} đơn đuôi ${duoi(o.code)}?`, xacNhan: { nhan: "Đã nhận tiền", lam: vaDonShop(o, { paymentStatus: "da_thanh_toan" }, "Đã ghi nhận tiền về.", "xác nhận nhận tiền") } };
      }

      // ── chủ sàn ────────────────────────────────────────────────────────
      case "san_yc_moi": {
        if (!online()) return { noi: CAN_SONG };
        const r = await marketGet<{ items: MarketRequest[]; counts: { moi: number } }>("/api/admin/cho/yeu-cau?status=moi");
        if (!r.ok) return r.status === 401 || r.status === 403 ? { noi: "Việc này của chủ sàn — máy này chưa đăng nhập quản trị." } : loi(r, "đọc yêu cầu");
        if (r.data.counts.moi === 0) return { noi: "Không có yêu cầu nào chờ báo giá." };
        const x = r.data.items[0];
        return { noi: `Có ${r.data.counts.moi} yêu cầu chờ báo giá. Mới nhất: ${x.qty} ${x.unit} ${x.title}, đuôi ${duoi(x.code)}. Nói "báo giá … phí giao … giao …" để trả lời.`, den: "/quan-tri?tab=cho-vat-tu" };
      }
      case "san_bao_gia":
      case "san_khong_tim_duoc": {
        if (!online()) return { noi: CAN_SONG };
        const r = await marketGet<{ items: MarketRequest[] }>("/api/admin/cho/yeu-cau");
        if (!r.ok) return r.status === 401 || r.status === 403 ? { noi: "Việc này của chủ sàn — máy này chưa đăng nhập quản trị." } : loi(r, "đọc yêu cầu");
        const y = chonYc(r.data.items, l.ma, (x) => x.status === "moi" || x.status === "da_bao_gia", l.k === "san_bao_gia" ? "báo giá" : "trả lời");
        if (laKetQua(y)) return y;
        if (l.k === "san_khong_tim_duoc") {
          if (!l.lyDo) return { noi: `Báo không tìm được ${y.title} cần lý do. Nói "… vì …".` };
          return { noi: `Báo bà con chưa tìm được ${y.title}, lý do: ${l.lyDo}?`, xacNhan: { nhan: "Báo bà con", lam: async () => {
            const x = await marketSend("PATCH", `/api/admin/cho/yeu-cau/${y.id}`, { action: "khong_tim_duoc", reason: l.lyDo });
            return x.ok ? { noi: "Đã báo bà con." } : loi(x, "trả lời");
          } } };
        }
        if (!l.tienHang) return { noi: `Báo giá ${y.title} bao nhiêu? Nói ví dụ "ba triệu sáu, phí giao năm mươi nghìn, giao hai ba ngày".` };
        if (!l.hen) return { noi: `Giá ${formatVnd(l.tienHang)} — hẹn giao khi nào?` };
        const shops = await marketGet<{ items: { id: string; name: string; status: string }[] }>("/api/admin/cho/shops?status=hoat_dong");
        const shop = shops.ok ? (shops.data.items.find((s) => /sdvico/i.test(s.name)) ?? shops.data.items[0]) : undefined;
        if (!shop) return { noi: "Chưa có gian hàng nào đang hoạt động để lo hàng." };
        const phi = l.phiGiao ?? 0;
        const e = henRa(l.hen);
        return {
          noi: `Báo giá ${y.title}: hàng ${formatVnd(l.tienHang)}, phí giao ${formatVnd(phi)}, giao ${henChu(l.hen)}, ${shop.name} lo hàng?`,
          xacNhan: { nhan: "Gửi báo giá", lam: async () => {
            const x = await marketSend("PATCH", `/api/admin/cho/yeu-cau/${y.id}`, { action: "bao_gia", shopId: shop.id, goodsVnd: l.tienHang, shippingVnd: phi, ...e });
            return x.ok ? { noi: "Đã gửi báo giá — bà con nhận tin ngay." } : loi(x, "báo giá");
          } },
        };
      }
    }
  } catch {
    return { noi: "Chưa làm được — thử lại giúp." };
  }
}
