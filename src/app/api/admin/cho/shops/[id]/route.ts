// GET/PATCH /api/admin/cho/shops/[id] — chi tiết + DUYỆT / TỪ CHỐI / KHOÁ / MỞ
// LẠI / GÁN CHỦ SHOP (12 §7.3, 11 §7). tu_choi + tam_khoa BẮT BUỘC lý do
// (validateStatusNote 5..300) — shop phải biết vì sao. Gán chủ dùng cho shop
// SDVICO seed sentinel 'sdvico:chua-gan' (LEAD §5 A2).
import { NextResponse } from "next/server";
import { SDVICO_HOTLINE_DISPLAY } from "@/data/sdvico-showcase";
import { isValidVnPhone, normalizeVnPhone } from "@/lib/phone";
import { MarketError } from "@/lib/market/errors";
import { marketNotice, notifyMarket } from "@/lib/market/notify";
import { marketErrorResponse } from "@/lib/market/route-utils";
import { getMarketStore } from "@/lib/market/store";
import { validateStatusNote } from "@/lib/market/validate";
import type { Shop, ShopStatus } from "@/lib/market/types";
import { isShopStatus, logMarketAdmin, requireMarketAdmin } from "../../_guard";

type Ctx = { params: Promise<{ id: string }> };

/** Tin báo cho chủ shop khi admin đổi trạng thái (bảng 11 §8 N10/N11/N12). */
async function notifyShopStatus(shop: Shop, status: ShopStatus) {
  const ev = status === "hoat_dong" ? "N10" : status === "tu_choi" ? "N11" : status === "tam_khoa" ? "N12" : null;
  if (!ev) return; // về cho_duyet (gửi lại) — không có tin nào để báo
  await notifyMarket(
    shop.ownerPhone,
    marketNotice(ev, {
      shop: { id: shop.id, name: shop.name },
      reason: shop.statusNote,
      hotline: SDVICO_HOTLINE_DISPLAY,
    }),
  );
}

export async function GET(_req: Request, { params }: Ctx) {
  const who = await requireMarketAdmin("view");
  if (!who.ok) return who.res;
  try {
    const { id } = await params;
    const store = await getMarketStore();
    const shop = await store.getShop(id);
    if (!shop) throw new MarketError("not_found");
    const p = await store.listShopProducts(shop.id, { page: 1, pageSize: 1 });
    return NextResponse.json({ ok: true, shop, productCount: p.total });
  } catch (e) {
    return marketErrorResponse(e);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  const who = await requireMarketAdmin("edit");
  if (!who.ok) return who.res;
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => null)) as {
      status?: unknown;
      statusNote?: unknown;
      ownerPhone?: unknown;
    } | null;
    if (!body) return NextResponse.json({ ok: false, code: "bad_body" }, { status: 400 });

    const wantStatus = body.status;
    const wantOwner = body.ownerPhone;
    if (wantStatus === undefined && wantOwner === undefined)
      throw new MarketError("invalid", "Chưa chọn việc gì để đổi.");

    const store = await getMarketStore();
    const before = await store.getShop(id);
    if (!before) throw new MarketError("not_found");
    let shop = before;

    // ── Gán chủ shop (SĐT đã chuẩn hoá; đã là chủ shop khác ⇒ adapter ném invalid)
    if (wantOwner !== undefined) {
      if (typeof wantOwner !== "string" || !isValidVnPhone(wantOwner))
        throw new MarketError("invalid", "Số điện thoại chưa đúng (10 số, đầu 0).");
      const phone = normalizeVnPhone(wantOwner);
      shop = await store.setShopOwner(id, phone);
      await logMarketAdmin(who, "market.shop-owner", id, {
        ownerPhone: phone,
        before: before.ownerPhone,
      });
    }

    // ── Đổi trạng thái (từ chối / khoá bắt buộc lý do)
    if (wantStatus !== undefined) {
      if (!isShopStatus(wantStatus)) throw new MarketError("invalid", "Trạng thái không hợp lệ.");
      const note = typeof body.statusNote === "string" ? body.statusNote.trim() : undefined;
      if (wantStatus === "tu_choi" || wantStatus === "tam_khoa") {
        const bad = validateStatusNote(note);
        if (bad) throw new MarketError("invalid", bad);
      }
      shop = await store.setShopStatus(id, wantStatus, note ?? null);
      await logMarketAdmin(who, "market.shop-status", id, {
        status: wantStatus,
        before: before.status,
        ...(note ? { note } : {}),
      });
      if (wantStatus !== before.status) await notifyShopStatus(shop, wantStatus);
    }

    return NextResponse.json({ ok: true, shop });
  } catch (e) {
    return marketErrorResponse(e);
  }
}
