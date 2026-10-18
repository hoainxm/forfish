import "server-only";
// HELPER DÙNG CHUNG cho mọi route của Chợ vật tư (buyer / seller / admin) —
// 12 §7. Route chỉ gọi; luật nằm ở order-state.ts / pricing.ts.
import { NextResponse } from "next/server";
import { isMarketError, MarketError, marketErrorStatus } from "./errors";
import { settleOverdue, AUTO_COMPLETE_MS } from "./order-state";
import { acceptsBankTransfer } from "./pricing";
import type { MarketStore } from "./store";
import type { Order, Shop, ShopPublic } from "./types";

/** {ok:false, code, message?, productIds?} + HTTP status. Lỗi lạ ⇒ 500 internal (log). */
export function marketErrorResponse(e: unknown): NextResponse {
  if (isMarketError(e)) {
    const body: { ok: false; code: string; message?: string; productIds?: string[] } = { ok: false, code: e.code };
    if (e.code === "invalid" && e.message && e.message !== e.code) body.message = e.message;
    if (Array.isArray(e.productIds) && e.productIds.length > 0) body.productIds = e.productIds;
    return NextResponse.json(body, { status: marketErrorStatus(e) });
  }
  console.error("[market] lỗi không có mã:", (e as Error)?.message ?? e);
  return NextResponse.json({ ok: false, code: "internal" }, { status: 500 });
}

/** Bỏ ownerPhone / bankName / bankAccount / bankHolder / statusNote + acceptsBankTransfer — thứ người mua được thấy. */
export function toShopPublic(s: Shop): ShopPublic {
  const {
    ownerPhone: _o, bankName: _bn, bankAccount: _ba, bankHolder: _bh, statusNote: _sn, ...rest
  } = s;
  void _o; void _bn; void _ba; void _bh; void _sn;
  return { ...rest, acceptsBankTransfer: acceptsBankTransfer(s) };
}

/** LEAD §4 #3: áp settleOverdue cho danh sách vừa đọc — có patch thì store.transitionOrder(id,"da_giao",patch);
 *  bad_transition (ai đó vừa bấm) ⇒ đọc lại đơn; lỗi khác ⇒ log + trả đơn như DB đang có (không nói dối). */
export async function settleOverdueOrders(store: MarketStore, orders: Order[], nowIso: string): Promise<Order[]> {
  const out: Order[] = [];
  for (const o of orders) {
    const patch = settleOverdue(o, nowIso);
    if (!patch) { out.push(o); continue; }
    try {
      out.push(await store.transitionOrder(o.id, "da_giao", patch));
    } catch (e) {
      if (isMarketError(e) && e.code === "bad_transition") {
        const fresh = await store.getOrder(o.id).catch(() => null);
        out.push(fresh ?? o);
      } else {
        console.error("[market] settleOverdue hỏng:", o.id, (e as Error)?.message);
        out.push(o);
      }
    }
  }
  return out;
}

/** Quét toàn shop/sàn trước khi tính thống kê (stats/overview/tổng quan): listOverdueDelivered(now − 7d) → settleOverdueOrders. */
export async function settleOverdueForStats(store: MarketStore, nowIso: string, shopId?: string): Promise<void> {
  const now = Date.parse(nowIso);
  if (!Number.isFinite(now)) return;
  const before = new Date(now - AUTO_COMPLETE_MS).toISOString();
  const due = await store.listOverdueDelivered(before, shopId);
  if (due.length > 0) await settleOverdueOrders(store, due, nowIso);
}

export const UPLOAD_MAX_BYTES = 500 * 1024;
export type UploadMime = "image/jpeg" | "image/png" | "image/webp";

/** Nhận diện ảnh bằng MAGIC BYTES — không tin `type` client khai (thuần, có test). */
export function sniffImageMime(bytes: Uint8Array): UploadMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  return null;
}

/** Đọc multipart `file`, kiểm mime ∈ jpeg/png/webp VÀ magic bytes (FF D8 FF · 89 50 4E 47 · RIFF…WEBP), ≤ 500 KB ⇒ {bytes, mime}; sai ⇒ MarketError bad_type/bad_size. */
export async function readImageUpload(req: Request): Promise<{ bytes: Uint8Array; mime: UploadMime }> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new MarketError("bad_type", "Chọn một ảnh JPG/PNG/WebP.");
  }
  const file = form.get("file");
  if (!file || typeof file === "string") throw new MarketError("bad_type", "Chọn một ảnh JPG/PNG/WebP.");
  const declared = (file as Blob).type;
  if (declared && declared !== "image/jpeg" && declared !== "image/png" && declared !== "image/webp") {
    throw new MarketError("bad_type", "Ảnh phải là JPG, PNG hoặc WebP.");
  }
  if ((file as Blob).size > UPLOAD_MAX_BYTES) throw new MarketError("bad_size", "Ảnh quá lớn (tối đa 500 KB).");
  const bytes = new Uint8Array(await (file as Blob).arrayBuffer());
  if (bytes.length > UPLOAD_MAX_BYTES) throw new MarketError("bad_size", "Ảnh quá lớn (tối đa 500 KB).");
  const mime = sniffImageMime(bytes);
  if (!mime) throw new MarketError("bad_type", "Ảnh phải là JPG, PNG hoặc WebP.");
  if (declared && declared !== mime) throw new MarketError("bad_type", "Ảnh không đúng định dạng khai báo.");
  return { bytes, mime };
}
