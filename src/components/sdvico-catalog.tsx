"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckIcon } from "@/components/icons";
import { SdvicoRequestButton } from "@/components/sdvico-request";
import { groupIdOfSku, type CatalogGroup } from "@/lib/sdvico-catalog";

/*
  "SDVICO có gì cho tàu mình" — danh mục theo NHÓM, lấy thẳng từ kho hàng
  đang bán (ForFish = kênh CSKH của SDVICO):
  · nhóm bà con ĐÃ MUA → gắn nhãn "đang dùng" (đồ cụ thể nằm ở danh sách trên)
  · nhóm CHƯA MUA → giới thiệu một câu + món tiêu biểu + nút hỏi mua
*/

export function SdvicoCatalog({
  ownedProductNames = [],
}: {
  /** Tên sản phẩm khách đã mua (từ đồng bộ) — để đánh dấu nhóm đang dùng */
  ownedProductNames?: string[];
}) {
  const [groups, setGroups] = useState<CatalogGroup[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/sdvico/catalog", { signal: AbortSignal.timeout(20000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j?.ok && Array.isArray(j.groups)) setGroups(j.groups);
      })
      .catch(() => {
        // chưa cấu hình / mạng lỗi → không hiện khu gợi ý
      });
    return () => {
      alive = false;
    };
  }, []);

  // nhóm nào có sản phẩm trùng tên với đồ đã mua → "đang dùng"
  const ownedGroups = useMemo(() => {
    if (!groups || ownedProductNames.length === 0) return new Set<string>();
    const ownedLower = ownedProductNames.map((n) => n.toLowerCase());
    const set = new Set<string>();
    for (const g of groups) {
      for (const p of g.products) {
        const pl = p.name.toLowerCase();
        if (ownedLower.some((o) => o === pl)) {
          set.add(g.id);
          break;
        }
        // fallback theo SKU nhóm khi tên lệch nhau chút ít
        if (groupIdOfSku(p.sku) === g.id && ownedLower.includes(pl)) {
          set.add(g.id);
          break;
        }
      }
    }
    return set;
  }, [groups, ownedProductNames]);

  if (!groups || groups.length === 0) return null;

  return (
    <section aria-label="Đồ SDVICO có cho tàu" className="mt-6">
      <h3 className="display mb-1 px-1 text-[18px] font-bold text-navy">
        SDVICO có gì cho tàu mình
      </h3>
      <p className="mb-3 px-1 text-[14px] text-foreground/55">
        Hàng đang bán thật — bấm hỏi mua là nhân viên gọi lại.
      </p>
      <ul className="space-y-3">
        {groups.map((g) => {
          const owned = ownedGroups.has(g.id);
          return (
            <li key={g.id} className="surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="display text-[18px] font-bold leading-snug text-navy">
                    {g.label}
                  </p>
                  <p className="mt-0.5 text-[15px] leading-snug text-foreground/70">
                    {g.blurb}
                  </p>
                </div>
                {owned && (
                  <span
                    className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-bold"
                    style={{ backgroundColor: "var(--ok-bg)", color: "var(--ok)" }}
                  >
                    <CheckIcon className="h-4 w-4" />
                    Đang dùng
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-[14px] text-foreground/55">
                {g.products.length} món trong dòng này — loại nào hợp tàu thì
                nhân viên tư vấn khi bà con hỏi.
              </p>
              <div className="mt-3 flex justify-end">
                <SdvicoRequestButton
                  variant="chip"
                  topic="mua"
                  productName={g.label}
                  label={owned ? "Mua thêm / hỏi giá" : "Hỏi mua / tư vấn"}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
