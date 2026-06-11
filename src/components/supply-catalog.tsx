"use client";

import { useState } from "react";
import {
  CATEGORY_LABELS,
  SUPPLIES,
  SUPPLY_PRICE_DATE,
  SupplyCategory,
} from "@/data/supplies";
import { formatVnDate } from "@/lib/format";

/*
  Bảng giá vật tư — a price list the user can scan with one thumb:
  · one row of big filter chips (no dropdowns, no search to type)
  · each item is ONE card: name on the left, price on the right
  · prices are reference only — the note box says so up front
*/

const CATEGORIES: SupplyCategory[] = ["dau_nhot", "loc", "phu_tung", "khac"];

type Filter = "all" | SupplyCategory;

export function SupplyCatalog() {
  const [filter, setFilter] = useState<Filter>("all");

  const items =
    filter === "all" ? SUPPLIES : SUPPLIES.filter((s) => s.category === filter);

  const chipBase =
    "min-h-[2.75rem] shrink-0 rounded-xl px-4 text-[1rem] font-bold transition active:scale-[0.97]";

  return (
    <div className="px-4">
      <div
        className="mb-3 rounded-xl px-4 py-3 text-[0.875rem] font-semibold leading-relaxed"
        style={{ backgroundColor: "var(--t3-bg)", color: "var(--t3)" }}
      >
        Giá tham khảo ngày {formatVnDate(SUPPLY_PRICE_DATE)}. Đặt hàng qua đại
        lý sẽ có trong bản tới — bà con dùng tạm danh mục để so giá.
      </div>

      {/* category chips — horizontal scroll, big enough for wet thumbs */}
      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
        <button
          onClick={() => setFilter("all")}
          className={`${chipBase} ${
            filter === "all"
              ? "bg-navy text-white"
              : "bg-field text-foreground/70"
          }`}
        >
          Tất cả
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`${chipBase} ${
              filter === c
                ? "bg-navy text-white"
                : "bg-field text-foreground/70"
            }`}
          >
            {CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      <ul className="space-y-3">
        {items.map((s) => (
          <li
            key={s.id}
            className="flex items-start justify-between gap-3 surface px-4 py-3.5"
          >
            <div className="min-w-0">
              <p className="text-[1.125rem] font-bold leading-snug text-navy">
                {s.name}
              </p>
              {s.spec && (
                <p className="mt-0.5 text-[0.875rem] text-foreground/60">
                  {s.spec}
                </p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[1.125rem] font-bold text-foreground">
                {s.priceVnd.toLocaleString("vi-VN")} đ
              </p>
              <p className="text-[0.875rem] text-foreground/60">{s.unit}</p>
            </div>
          </li>
        ))}
      </ul>

      <p className="py-4 text-center text-[0.875rem] text-foreground/40">
        Giá thật có thể chênh theo vùng — bà con hỏi lại đại lý gần cảng.
      </p>
    </div>
  );
}
