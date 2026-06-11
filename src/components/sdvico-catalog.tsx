"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckIcon, PhoneIcon } from "@/components/icons";
import { SdvicoRequestButton } from "@/components/sdvico-request";
import { type CatalogGroup } from "@/lib/sdvico-catalog";
import {
  SDVICO_HOTLINE,
  SDVICO_HOTLINE_DISPLAY,
  SDVICO_SHOWCASE,
} from "@/data/sdvico-showcase";

/*
  KHUYẾN NGHỊ — kiểu app shop (user chốt 2026-06-11): CHỈ sản phẩm CHÍNH,
  ảnh + thông tin lấy từ sdvico.vn, không đổ phụ kiện/vật tư lẻ cho rối.
  · Khu 1 — MUA THÊM cho dòng ĐANG DÙNG (vật tư thay thế — upsale trúng nhất)
  · Khu 2 — thẻ sản phẩm kiểu shop: ảnh + loại + tên + mô tả + tính năng
    + nút Hỏi mua (1 chạm vì đã đăng nhập) + Gọi ngay hotline
  Dòng khách đang dùng → thẻ gắn nhãn xanh "đang dùng dòng này".
  CRM catalog chỉ còn dùng để NHẬN DIỆN dòng đang dùng (không hiển thị).
*/

export function SdvicoCatalog({
  ownedProductNames = [],
}: {
  /** Tên sản phẩm khách đã mua (từ đồng bộ) — để biết dòng nào đang dùng */
  ownedProductNames?: string[];
}) {
  const [groups, setGroups] = useState<CatalogGroup[] | null>(null);

  useEffect(() => {
    if (ownedProductNames.length === 0) return; // khách chưa có đồ → khỏi tải
    let alive = true;
    fetch("/api/sdvico/catalog", { signal: AbortSignal.timeout(20000) })
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
    if (ownedLines.size === 0) return SDVICO_SHOWCASE;
    return [...SDVICO_SHOWCASE].sort(
      (a, b) =>
        (ownedLines.has(a.line) ? 0 : 1) - (ownedLines.has(b.line) ? 0 : 1),
    );
  }, [ownedLines]);

  return (
    <div>
      <h3 className="display mb-1 px-1 text-[18px] font-bold text-navy">
        SDVICO khuyến nghị cho tàu
      </h3>
      <p className="mb-3 px-1 text-[14px] text-foreground/55">
        Hàng chính hãng đang bán — hỏi mua là nhân viên gọi lại tư vấn.
      </p>

      <ul className="space-y-4">
        {showcase.map((p) => {
          const owned = ownedLines.has(p.line);
          return (
            <li key={p.id} className="overflow-hidden surface">
              {/* ảnh sản phẩm — như thẻ shop */}
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-field">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.image}
                  alt={p.title}
                  width={p.imgW}
                  height={p.imgH}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                <span className="absolute left-3 top-3 rounded-full bg-navy/85 px-3 py-1 text-[12px] font-bold text-white backdrop-blur-sm">
                  {p.category}
                </span>
                {owned && (
                  <span
                    className="absolute right-3 top-3 flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold"
                    style={{ backgroundColor: "var(--ok-bg)", color: "var(--ok)" }}
                  >
                    <CheckIcon className="h-3.5 w-3.5" />
                    Đang dùng
                  </span>
                )}
              </div>

              <div className="p-4">
                <p className="display text-[19px] font-bold leading-snug text-navy">
                  {p.title}
                </p>
                <p className="mt-1 text-[15px] leading-snug text-foreground/70">
                  {p.desc}
                </p>
                <ul className="mt-2 space-y-1">
                  {p.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-[14px] text-foreground/75"
                    >
                      <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-ok" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <SdvicoRequestButton
                      variant="chip"
                      topic="mua"
                      productName={p.title}
                      label={owned ? "Mua thêm / vật tư thay" : "Hỏi mua / tư vấn"}
                    />
                  </div>
                  <a
                    href={`tel:${SDVICO_HOTLINE}`}
                    className="flex min-h-[48px] shrink-0 items-center gap-1.5 rounded-full bg-field px-4 text-[15px] font-bold text-navy transition active:scale-[0.97]"
                    aria-label={`Gọi hotline SDVICO ${SDVICO_HOTLINE_DISPLAY}`}
                  >
                    <PhoneIcon className="h-4 w-4" />
                    Gọi ngay
                  </a>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="py-4 text-center text-[14px] text-foreground/45">
        Hotline SDVICO: <strong>{SDVICO_HOTLINE_DISPLAY}</strong> — giá và
        model hợp tàu, nhân viên tư vấn trực tiếp.
      </p>
    </div>
  );
}
