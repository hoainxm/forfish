"use client";

import { useMemo, useState } from "react";
import { PORT_PRICES, PRICE_DATE, PortPrice } from "@/data/port-prices";
import {
  MinusIcon,
  SearchIcon,
  TrendDownIcon,
  TrendUpIcon,
} from "@/components/icons";
import { formatVnDate } from "@/lib/format";

/*
  Bảng giá tham khảo — one card per species, price range BIG,
  trend always icon + plain words (never icon alone).
*/

// "cá hố" -> "ca ho": diacritic-insensitive matching for careless typing.
function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d");
}

function formatRange(p: PortPrice): string {
  return `${p.minVnd.toLocaleString("vi-VN")} – ${p.maxVnd.toLocaleString("vi-VN")} ${p.unit}`;
}

const TREND = {
  up: { Icon: TrendUpIcon, word: "đang lên", color: "var(--ok)" },
  down: { Icon: TrendDownIcon, word: "đang xuống", color: "var(--danger)" },
  flat: { Icon: MinusIcon, word: "đứng giá", color: "var(--foreground)" },
} as const;

export function PriceBoard() {
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return PORT_PRICES;
    return PORT_PRICES.filter((p) => fold(p.species).includes(q));
  }, [query]);

  return (
    <div>
      <p className="mb-3 rounded-lg bg-warn-bg px-3 py-2 text-[14px] font-semibold text-warn">
        Giá tham khảo, tổng hợp ngày {formatVnDate(PRICE_DATE)}. Giá thật tại
        cảng có thể khác.
      </p>

      <label className="relative mb-3 block">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-foreground/40" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm loại cá..."
          className="min-h-[52px] w-full rounded-xl border-2 border-line bg-card pl-12 pr-4 text-[18px] focus:border-sea focus:outline-none"
        />
      </label>

      {shown.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-line bg-card px-4 py-10 text-center">
          <p className="text-[18px] text-foreground/60">
            Không thấy loại cá này trong bảng.
            <br />
            Bà con thử gõ tên ngắn hơn, ví dụ “nục”.
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {shown.map((p) => {
          const t = TREND[p.trend];
          return (
            <li
              key={p.id}
              className="rounded-xl bg-card px-4 py-3.5 shadow-sm ring-1 ring-line"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="display text-[18px] font-bold leading-snug text-navy">
                  {p.species}
                </p>
                <p
                  className="flex shrink-0 items-center gap-1.5 pt-0.5 text-[15px] font-bold"
                  style={{
                    color: p.trend === "flat" ? "rgba(28,43,54,0.55)" : t.color,
                  }}
                >
                  <t.Icon className="h-5 w-5" />
                  {t.word}
                </p>
              </div>
              <p className="mt-0.5 text-[18px] font-bold text-foreground">
                {formatRange(p)}
              </p>
              {(p.region || p.note) && (
                <p className="mt-1 text-[14px] leading-snug text-foreground/55">
                  {[p.region, p.note].filter(Boolean).join(" · ")}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
