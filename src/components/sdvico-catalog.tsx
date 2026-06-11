"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckIcon, ChevronRightIcon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { RefNote } from "@/components/ui/primitives";
import { SdvicoRequestButton } from "@/components/sdvico-request";
import {
  representativeProducts,
  type CatalogGroup,
} from "@/lib/sdvico-catalog";

/*
  "Của SDVICO" — cửa hàng gọn, focus GIỚI THIỆU + UPSALE (user chốt 2026-06-11):
  · Khu 1 — MUA THÊM cho đồ ĐANG DÙNG (chỗ bán chạy nhất: máy đang chạy
    cần vật tư thay đúng kỳ — màng lọc, lõi, nhớt…) → hàng ngang nổi bật.
  · Khu 2 — các dòng còn lại: LƯỚI 2 CỘT gọn (hết cảnh kéo 9 thẻ dài).
  · Chạm dòng nào → sheet chi tiết: vì sao cần + vài món tiêu biểu +
    nút Hỏi mua — model cụ thể nhân viên tư vấn khi gọi lại.
*/

export function SdvicoCatalog({
  ownedProductNames = [],
}: {
  /** Tên sản phẩm khách đã mua (từ đồng bộ) — để biết dòng nào đang dùng */
  ownedProductNames?: string[];
}) {
  const [groups, setGroups] = useState<CatalogGroup[] | null>(null);
  const [detail, setDetail] = useState<CatalogGroup | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/sdvico/catalog", { signal: AbortSignal.timeout(20000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j?.ok && Array.isArray(j.groups)) setGroups(j.groups);
      })
      .catch(() => {
        // chưa cấu hình / mạng lỗi → không hiện cửa hàng
      });
    return () => {
      alive = false;
    };
  }, []);

  // dòng nào có sản phẩm trùng tên đồ đã mua → "đang dùng"
  const ownedIds = useMemo(() => {
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

  if (!groups || groups.length === 0) return null;

  const ownedGroups = groups.filter((g) => ownedIds.has(g.id));
  const otherGroups = groups.filter((g) => !ownedIds.has(g.id));

  return (
    <div>
      {/* ── KHU 1: mua thêm cho đồ đang dùng — upsale trúng nhất ─────── */}
      {ownedGroups.length > 0 && (
        <section aria-label="Mua thêm cho đồ đang dùng" className="mb-5">
          <h3 className="display mb-1 px-1 text-[18px] font-bold text-navy">
            Mua thêm cho đồ đang dùng
          </h3>
          <p className="mb-2 px-1 text-[14px] text-foreground/55">
            Máy đang chạy cần vật tư thay đúng kỳ — màng lọc, lõi, nhớt…
          </p>
          <ul className="space-y-2">
            {ownedGroups.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => setDetail(g)}
                  className="flex min-h-[60px] w-full items-center gap-3 surface px-4 text-left transition active:scale-[0.99]"
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: "var(--ok-bg)", color: "var(--ok)" }}
                    aria-hidden
                  >
                    <CheckIcon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="display block truncate text-[17px] font-bold text-navy">
                      {g.label}
                    </span>
                    <span className="block text-[13px] text-foreground/55">
                      Đang dùng · {g.products.length} món trong dòng
                    </span>
                  </span>
                  <ChevronRightIcon className="h-5 w-5 shrink-0 text-foreground/30" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── KHU 2: các dòng SDVICO — lưới 2 cột gọn ──────────────────── */}
      {otherGroups.length > 0 && (
        <section aria-label="Sản phẩm SDVICO" className="mb-2">
          <h3 className="display mb-1 px-1 text-[18px] font-bold text-navy">
            {ownedGroups.length > 0 ? "Tàu mình có thể cần thêm" : "SDVICO có gì cho tàu mình"}
          </h3>
          <p className="mb-2 px-1 text-[14px] text-foreground/55">
            Hàng đang bán thật — chạm vào xem, hỏi mua là nhân viên gọi lại.
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {otherGroups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setDetail(g)}
                className="flex min-h-[96px] flex-col justify-between rounded-[20px] p-3.5 text-left transition active:scale-[0.98]"
                style={{ backgroundColor: "var(--t3-bg)" }}
              >
                <span className="display block text-[16px] font-bold leading-snug text-navy">
                  {g.label}
                </span>
                <span className="mt-1.5 block text-[13px] font-semibold text-foreground/55">
                  {g.products.length} món · xem thêm
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── sheet chi tiết dòng — giới thiệu + nút hỏi mua ───────────── */}
      {detail && (
        <BottomSheet title={detail.label} onClose={() => setDetail(null)}>
          <p className="mb-3 text-[17px] leading-snug text-foreground/80">
            {detail.blurb}
          </p>

          {ownedIds.has(detail.id) && (
            <p
              className="mb-3 flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-[15px] font-bold"
              style={{ backgroundColor: "var(--ok-bg)", color: "var(--ok)" }}
            >
              <CheckIcon className="h-5 w-5 shrink-0" />
              Bà con đang dùng dòng này — hỏi vật tư thay là nhanh nhất.
            </p>
          )}

          <p className="mb-1 text-[13px] font-bold uppercase tracking-wide text-foreground/45">
            Trong dòng này có
          </p>
          <ul className="mb-3 space-y-1">
            {representativeProducts(detail.products).slice(0, 6).map((p) => (
              <li key={p.id} className="flex gap-2 text-[15px] text-foreground/75">
                <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-t3" aria-hidden />
                <span className="min-w-0 truncate">{p.name}</span>
              </li>
            ))}
            {detail.products.length > 6 && (
              <li className="pl-3.5 text-[14px] font-semibold text-foreground/50">
                … và {detail.products.length - 6} món khác
              </li>
            )}
          </ul>

          <div className="mb-4">
            <RefNote tone="var(--t3)" bg="var(--t3-bg)">
              Loại nào hợp tàu, giá bao nhiêu — nhân viên tư vấn khi gọi lại,
              bà con không phải tự chọn model.
            </RefNote>
          </div>

          <SdvicoRequestButton
            topic="mua"
            productName={detail.label}
            label={
              ownedIds.has(detail.id)
                ? "Hỏi mua thêm / vật tư thay"
                : "Hỏi mua / tư vấn dòng này"
            }
          />
        </BottomSheet>
      )}
    </div>
  );
}
