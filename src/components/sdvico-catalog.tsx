"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckIcon, PhoneIcon } from "@/components/icons";
import { SdvicoRequestButton } from "@/components/sdvico-request";
import { ProductInquiryButton } from "@/components/product-inquiry-button";
import { apiUrl } from "@/lib/api-base";
import { type CatalogGroup } from "@/lib/sdvico-catalog";
import {
  fetchProductListings,
  type ProductListing,
} from "@/lib/product-catalog";
import {
  SDVICO_HOTLINE,
  SDVICO_HOTLINE_DISPLAY,
  SDVICO_SHOWCASE,
} from "@/data/sdvico-showcase";

/*
  KHUYẾN NGHỊ — kiểu app shop (user chốt 2026-06-11): CHỈ sản phẩm CHÍNH,
  không đổ phụ kiện/vật tư lẻ cho rối.
  · Khu 1 — MUA THÊM cho dòng ĐANG DÙNG (vật tư thay thế — upsale trúng nhất)
  · Khu 2 — thẻ sản phẩm kiểu shop: ảnh + loại + tên + mô tả + tính năng
    + hành động liên hệ + Gọi ngay hotline
  Dòng khách đang dùng → thẻ gắn nhãn xanh "đang dùng dòng này".
  CRM catalog chỉ còn dùng để NHẬN DIỆN dòng đang dùng (không hiển thị).

  DANH MỤC ADMIN QUẢN LÝ (2026-07-28): danh sách thẻ nay đọc từ bảng Supabase
  `product_listings` (admin ẩn/hiện/xóa/thêm trong /quan-tri, áp dụng NGAY —
  không cần build app) thay cho mảng cứng SDVICO_SHOWCASE. Chưa cấu hình
  Supabase/lỗi mạng → rơi về SDVICO_SHOWCASE (giữ hành vi cũ, demo mode).
  Sản phẩm của ĐƠN VỊ NGOÀI SDWork (vendorKind='external') hiện nhãn tên đơn
  vị + liên hệ trực tiếp (KHÔNG dùng nút Hỏi mua — nút đó gửi vào hộp tư vấn
  CRM của SDVICO, sai kênh cho đơn vị khác).
*/

function fromStaticShowcase(): ProductListing[] {
  return SDVICO_SHOWCASE.map((p, i) => ({
    id: p.id,
    vendorKind: "sdvico" as const,
    title: p.title,
    category: p.category,
    description: p.desc,
    features: p.features,
    imageUrl: p.image,
    line: p.line,
    visible: true,
    sortOrder: i,
    createdAt: "",
  }));
}

export function SdvicoCatalog({
  ownedProductNames = [],
}: {
  /** Tên sản phẩm khách đã mua (từ đồng bộ) — để biết dòng nào đang dùng */
  ownedProductNames?: string[];
}) {
  const [groups, setGroups] = useState<CatalogGroup[] | null>(null);
  const [listings, setListings] = useState<ProductListing[]>(
    fromStaticShowcase(),
  );

  useEffect(() => {
    let alive = true;
    fetchProductListings().then((rows) => {
      if (alive && rows !== null) setListings(rows);
      // rows === null (chưa cấu hình/lỗi mạng) → giữ SDVICO_SHOWCASE tĩnh
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (ownedProductNames.length === 0) return; // khách chưa có đồ → khỏi tải
    let alive = true;
    fetch(apiUrl("/api/sdvico/catalog"), { signal: AbortSignal.timeout(20000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j?.ok && Array.isArray(j.groups)) setGroups(j.groups);
      })
      .catch(() => {
        // không nhận diện được dòng đang dùng — vẫn hiện showcase bình thường
      });
    return () => {
      alive = false;
    };
  }, [ownedProductNames.length]);

  // dòng nào có sản phẩm trùng tên đồ đã mua → "đang dùng"
  const ownedLines = useMemo(() => {
    if (!groups || ownedProductNames.length === 0) return new Set<string>();
    const ownedLower = new Set(ownedProductNames.map((n) => n.toLowerCase()));
    const set = new Set<string>();
    for (const g of groups) {
      if (g.products.some((p) => ownedLower.has(p.name.toLowerCase()))) {
        set.add(g.id);
      }
    }
    return set;
  }, [groups, ownedProductNames]);

  // dòng đang dùng xếp LÊN ĐẦU (mua thêm vật tư dễ hơn mua máy mới)
  const showcase = useMemo(() => {
    if (ownedLines.size === 0) return listings;
    return [...listings].sort(
      (a, b) =>
        (a.line && ownedLines.has(a.line) ? 0 : 1) -
        (b.line && ownedLines.has(b.line) ? 0 : 1),
    );
  }, [ownedLines, listings]);

  return (
    <div>
      <h3 className="display mb-1 px-1 text-[1.125rem] font-bold text-navy">
        SDVICO khuyến nghị cho tàu
      </h3>
      <p className="mb-3 px-1 text-[0.875rem] text-foreground/70">
        Hàng chính hãng đang bán — hỏi mua là nhân viên gọi lại tư vấn.
      </p>

      {showcase.length === 0 && (
        <p className="surface px-4 py-8 text-center text-[1rem] text-foreground/65">
          Chưa có sản phẩm nào — gọi hotline bên dưới để được tư vấn trực tiếp.
        </p>
      )}

      <ul className="space-y-4">
        {showcase.map((p) => {
          const owned = Boolean(p.line && ownedLines.has(p.line));
          const external = p.vendorKind === "external";
          return (
            <li key={p.id} className="overflow-hidden surface">
              {/* ảnh sản phẩm — như thẻ shop (bỏ qua nếu admin chưa gắn ảnh) */}
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-field">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imageUrl}
                    alt={p.title}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[0.9375rem] font-semibold text-foreground/40">
                    {p.category || "Sản phẩm"}
                  </div>
                )}
                {p.category && (
                  <span className="absolute left-3 top-3 rounded-full bg-navy/85 px-3 py-1 text-[0.75rem] font-bold text-white backdrop-blur-sm">
                    {p.category}
                  </span>
                )}
                {owned && (
                  <span
                    className="absolute right-3 top-3 flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.75rem] font-bold"
                    style={{ backgroundColor: "var(--ok-bg)", color: "var(--ok)" }}
                  >
                    <CheckIcon className="h-3.5 w-3.5" />
                    Đang dùng
                  </span>
                )}
              </div>

              <div className="p-4">
                {external && (
                  <p className="mb-1 text-[0.8125rem] font-bold uppercase tracking-wide text-t3">
                    Đơn vị: {p.vendorName}
                  </p>
                )}
                <p className="display text-[1.1875rem] font-bold leading-snug text-navy">
                  {p.title}
                </p>
                {p.description && (
                  <p className="mt-1 text-[0.9375rem] leading-snug text-foreground/70">
                    {p.description}
                  </p>
                )}
                {p.features.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {p.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-start gap-2 text-[0.875rem] text-foreground/75"
                      >
                        <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-ok" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* neo kỳ vọng giá — hỏi không mất gì, không bị ép mua */}
                <p className="mt-2 text-[0.8125rem] font-semibold text-foreground/70">
                  {p.priceText
                    ? `Giá tham khảo: ${p.priceText}`
                    : external
                      ? "Liên hệ đơn vị để biết giá."
                      : "Giá báo theo tàu — hỏi là nhân viên gọi lại, không mất phí."}
                </p>

                {/* MỘT hành động chính mỗi thẻ. SDVICO → hộp tư vấn CRM (kênh
                    bán hàng thật); đơn vị NGOÀI → liên hệ trực tiếp + "Để lại
                    yêu cầu" ghi vào product_inquiries (admin xem ở /quan-tri
                    tab Yêu cầu) — KHÔNG đi qua hộp tư vấn CRM của SDVICO (sai
                    kênh, không phải hàng của họ). */}
                <div className="mt-2.5">
                  {external ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {p.contactPhone && (
                        <a
                          href={`tel:${p.contactPhone}`}
                          className="flex min-h-[3rem] shrink-0 items-center gap-1.5 rounded-full bg-t3 px-4 text-[0.9375rem] font-bold text-white transition active:scale-[0.97]"
                        >
                          <PhoneIcon className="h-4 w-4" />
                          Gọi {p.contactPhone}
                        </a>
                      )}
                      <ProductInquiryButton
                        listingId={p.id}
                        listingTitle={p.title}
                        vendorKind="external"
                      />
                      {p.contactNote && (
                        <p className="w-full text-[0.8125rem] text-foreground/65">
                          {p.contactNote}
                        </p>
                      )}
                    </div>
                  ) : (
                    <SdvicoRequestButton
                      variant="chip"
                      topic="mua"
                      productName={p.title}
                      label={owned ? "Mua thêm / vật tư thay" : "Hỏi mua / tư vấn"}
                    />
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* hotline = khối bấm được tử tế, không phải dòng chữ mờ cuối trang */}
      <a
        href={`tel:${SDVICO_HOTLINE}`}
        className="mt-4 flex min-h-[3.75rem] w-full items-center justify-center gap-2.5 rounded-full bg-navy text-[1.0625rem] font-bold text-white transition active:scale-[0.98]"
      >
        <PhoneIcon className="h-5 w-5" />
        Gọi SDVICO {SDVICO_HOTLINE_DISPLAY}
      </a>
      <p className="py-3 text-center text-[0.875rem] text-foreground/65">
        Giá và model hợp tàu — nhân viên tư vấn trực tiếp.
      </p>
    </div>
  );
}
