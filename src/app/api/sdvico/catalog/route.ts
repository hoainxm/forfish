// Danh mục SDVICO theo nhóm — dữ liệu CHUNG (không cá nhân), cache 1 giờ
// trong process để không đập CRM mỗi lượt xem tab Sản phẩm.

import { NextResponse } from "next/server";
import { fetchCatalogProducts } from "@/lib/sdwork-assets";
import { groupCatalog, type CatalogGroup } from "@/lib/sdvico-catalog";

let cached: { at: number; groups: CatalogGroup[] } | null = null;
const TTL_MS = 60 * 60 * 1000;

export async function GET() {
  if (cached && Date.now() - cached.at < TTL_MS) {
    return NextResponse.json({ ok: true, groups: cached.groups });
  }
  const products = await fetchCatalogProducts();
  if (!products) {
    return NextResponse.json({ ok: false, code: "not_configured" });
  }
  const groups = groupCatalog(products);
  cached = { at: Date.now(), groups };
  return NextResponse.json(
    { ok: true, groups },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
