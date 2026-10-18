// /api/ban-hang/shop — hồ sơ gian hàng của CHỦ SHOP đang đăng nhập (12 §7.2).
//  GET   : shop của SĐT này (null = chưa đăng ký) — client ghi cờ `forfish.mshop.v1`
//  POST  : đăng ký shop (status cho_duyet). Shop cũ `tu_choi` ⇒ gửi lại CÙNG id (11 §6.1)
//  PATCH : sửa hồ sơ + công tắc "Tạm nghỉ bán" (paused — LEAD §4 #8), mọi trạng thái shop
// SĐT chủ shop LUÔN lấy từ chuỗi xác thực, không bao giờ từ body (11 R18).
import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { marketErrorResponse } from "@/lib/market/route-utils";
import { requireShopOwner } from "@/lib/market/shop-auth";
import { getMarketStore } from "@/lib/market/store";
import { toSlug } from "@/lib/market/text";
import type { Shop, ShopDraft, ShopPatch } from "@/lib/market/types";
import { validateShopDraft } from "@/lib/market/validate";
import { invalid, num, readJsonBody, str } from "../_helpers";

const DA_CO_SHOP = "Số này đã có shop rồi. Vào Kênh người bán để xem.";

function draftFromBody(b: Record<string, unknown>): ShopDraft {
  return {
    name: str(b.name) ?? "",
    description: str(b.description),
    logoUrl: str(b.logoUrl),
    phone: str(b.phone),
    province: str(b.province) ?? "",
    address: str(b.address),
    bankName: str(b.bankName),
    bankAccount: str(b.bankAccount),
    bankHolder: str(b.bankHolder),
    shippingFlatVnd: num(b.shippingFlatVnd) ?? 0,
    freeShipFromVnd: num(b.freeShipFromVnd),
  };
}

/** Bản vá chỉ mang ĐÚNG những trường client gửi — có khoá mà rỗng = XOÁ (vd bỏ STK). */
function patchFromBody(b: Record<string, unknown>): ShopPatch {
  const p: ShopPatch = {};
  if ("name" in b) p.name = str(b.name) ?? "";
  if ("description" in b) p.description = str(b.description) ?? "";
  if ("logoUrl" in b) p.logoUrl = str(b.logoUrl) ?? "";
  if ("phone" in b) p.phone = str(b.phone) ?? "";
  if ("province" in b) p.province = str(b.province) ?? "";
  if ("address" in b) p.address = str(b.address) ?? "";
  if ("bankName" in b) p.bankName = str(b.bankName) ?? "";
  if ("bankAccount" in b) p.bankAccount = str(b.bankAccount) ?? "";
  if ("bankHolder" in b) p.bankHolder = str(b.bankHolder) ?? "";
  if ("shippingFlatVnd" in b) p.shippingFlatVnd = num(b.shippingFlatVnd) ?? 0;
  if ("freeShipFromVnd" in b) p.freeShipFromVnd = num(b.freeShipFromVnd);
  if (typeof b.paused === "boolean") p.paused = b.paused;
  return p;
}

/** Hồ sơ SAU khi vá — validate trên bản đầy đủ để không cho vá thành hồ sơ sai. */
function merged(shop: Shop, p: ShopPatch): ShopDraft {
  return {
    name: "name" in p ? p.name ?? "" : shop.name,
    description: "description" in p ? p.description : shop.description,
    logoUrl: "logoUrl" in p ? p.logoUrl : shop.logoUrl,
    phone: "phone" in p ? p.phone : shop.phone,
    province: "province" in p ? p.province ?? "" : shop.province ?? "",
    address: "address" in p ? p.address : shop.address,
    bankName: "bankName" in p ? p.bankName : shop.bankName,
    bankAccount: "bankAccount" in p ? p.bankAccount : shop.bankAccount,
    bankHolder: "bankHolder" in p ? p.bankHolder : shop.bankHolder,
    shippingFlatVnd: "shippingFlatVnd" in p ? p.shippingFlatVnd ?? 0 : shop.shippingFlatVnd,
    freeShipFromVnd: "freeShipFromVnd" in p ? p.freeShipFromVnd : shop.freeShipFromVnd,
  };
}

export async function GET(req: Request) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  try {
    const store = await getMarketStore();
    const shop = await store.getShopByOwner(who.phone);
    return NextResponse.json({ ok: true, shop: shop ?? null });
  } catch (e) {
    return marketErrorResponse(e);
  }
}

export async function POST(req: Request) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  const body = await readJsonBody(req);
  if (!body.ok) return body.res;
  const draft = draftFromBody(body.body);
  const err = validateShopDraft(draft);
  if (err) return invalid(err);
  try {
    const store = await getMarketStore();
    const slug = toSlug(draft.name);
    const mine = await store.getShopByOwner(who.phone);
    if (mine) {
      /*  Bị từ chối thì GỬI LẠI trên chính hồ sơ cũ (11 §6.1) — không đẻ shop
          thứ hai cho một SĐT (R1). Trạng thái khác ⇒ nói thẳng đã có shop. */
      if (mine.status !== "tu_choi") return invalid(DA_CO_SHOP, 409);
      await store.updateShop(mine.id, { ...draft }, slug);
      const shop = await store.setShopStatus(mine.id, "cho_duyet", null);
      return NextResponse.json({ ok: true, shop }, { status: 201 });
    }
    const shop = await store.createShop(who.phone, draft, slug);
    return NextResponse.json({ ok: true, shop }, { status: 201 });
  } catch (e) {
    return marketErrorResponse(e);
  }
}

export async function PATCH(req: Request) {
  const gate = await requireShopOwner(req);
  if (!gate.ok) return gate.res;
  const body = await readJsonBody(req);
  if (!body.ok) return body.res;
  const patch = patchFromBody(body.body);
  const err = validateShopDraft(merged(gate.shop, patch));
  if (err) return invalid(err);
  try {
    const store = await getMarketStore();
    const slug = patch.name && patch.name !== gate.shop.name ? toSlug(patch.name) : undefined;
    const shop = await store.updateShop(gate.shop.id, patch, slug);
    return NextResponse.json({ ok: true, shop });
  } catch (e) {
    return marketErrorResponse(e);
  }
}
