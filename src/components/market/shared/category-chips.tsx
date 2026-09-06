"use client";

import { ChipRow, type ChipOption } from "@/components/ui/chip-row";
import { CATEGORY_LABEL, PRODUCT_CATEGORIES } from "@/lib/market/categories";
import type { ProductCategory } from "@/lib/market/types";

export type CategoryChipValue = ProductCategory | "tat_ca";

const OPTIONS: readonly ChipOption<CategoryChipValue>[] = [
  { id: "tat_ca", label: "Tất cả" },
  ...PRODUCT_CATEGORIES.map((c) => ({ id: c, label: CATEGORY_LABEL[c] })),
];

/** Hàng chip nhóm hàng — `ChipRow` level 2 accent t3, "Tất cả" + 9 danh mục đúng thứ tự `PRODUCT_CATEGORIES`. */
export function CategoryChips({
  value,
  onChange,
}: {
  value: CategoryChipValue;
  onChange: (v: CategoryChipValue) => void;
}) {
  return <ChipRow options={OPTIONS} value={value} onChange={onChange} accent="t3" level={2} ariaLabel="Nhóm hàng" />;
}
