"use client";

import { useMemo, useState } from "react";
import { FINES, FINES_SOURCE, Fine } from "@/data/fines";
import { AlertIcon, SearchIcon } from "@/components/icons";
import { StatusBanner } from "@/components/ui/status-banner";

/*
  Tra mức phạt — Trục 4 (tuân thủ, accent tím var(--t4)).
  Designed for fishermen with low tech literacy:
  · one big search box, filter-as-you-type, diacritic-insensitive
  · each fine is ONE card with a severity-coloured left border
  · calm wording, no legal jargon, clear disclaimer at the bottom
*/

// Strip Vietnamese diacritics so "giay phep" matches "giấy phép".
function stripDiacritics(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

function normalize(s: string): string {
  return stripDiacritics(s.toLowerCase().trim());
}

// Một mức phạt không bao giờ là "tốt" — mức nhẹ dùng xám bình tĩnh, không xanh.
const SEVERITY: Record<
  Fine["severity"],
  { level: "danger" | "warn" | "neutral"; amount: string; label: string }
> = {
  high: { level: "danger", amount: "text-danger", label: "Phạt rất nặng" },
  medium: { level: "warn", amount: "text-warn", label: "Phạt nặng" },
  low: { level: "neutral", amount: "text-foreground", label: "Phạt nhẹ hơn" },
};

export function FinesLookup() {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = normalize(query);
    if (!q) return FINES;
    return FINES.filter((f) => normalize(f.behavior).includes(q));
  }, [query]);

  const isFiltering = query.trim().length > 0;

  return (
    <div className="px-4 pt-1">
      <h2 className="display text-[22px] font-bold text-navy">Tra mức phạt</h2>
      <p className="mt-1 text-[16px] text-foreground/60">
        Gõ vài chữ để tìm, ví dụ: giấy phép, vùng biển, nhật ký
      </p>

      {/* search box */}
      <div className="relative mt-3">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-foreground/40" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm lỗi vi phạm..."
          aria-label="Tìm mức phạt"
          className="min-h-[52px] w-full rounded-2xl border-0 bg-field pl-12 pr-4 text-[18px] focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea"
        />
      </div>

      {/* result count when filtering */}
      {isFiltering && (
        <p className="mt-3 text-[16px] font-bold text-foreground/60">
          {results.length > 0
            ? `${results.length} mức phạt`
            : "Không thấy mức phạt nào"}
        </p>
      )}

      {/* no result hint */}
      {isFiltering && results.length === 0 && (
        <div className="mt-3 rounded-[20px] bg-field/70 px-4 py-10 text-center">
          <SearchIcon className="mx-auto h-9 w-9 text-foreground/30" />
          <p className="mt-3 text-[16px] text-foreground/60">
            Thử gõ chữ khác, ngắn hơn.
            <br />
            Ví dụ: giấy phép, vùng biển, nhật ký, kích điện
          </p>
        </div>
      )}

      {/* fine cards */}
      <ul className="mt-3 space-y-3">
        {results.map((fine) => {
          const style = SEVERITY[fine.severity];
          return (
            <li
              key={fine.id}
              className="overflow-hidden surface"
            >
              {/* cùng "ngôn ngữ thẻ" với giấy tờ/bảo dưỡng: băng màu + icon + chữ */}
              <StatusBanner
                level={style.level}
                icon={<AlertIcon className="h-5 w-5" />}
              >
                {style.label}
              </StatusBanner>
              <div className="px-4 py-3.5">
                <p className="text-[18px] font-semibold leading-snug text-foreground">
                  {fine.behavior}
                </p>
                <p className={`mt-1.5 text-[18px] font-bold ${style.amount}`}>
                  {fine.rangeVnd}
                </p>
                <p className="mt-0.5 text-[14px] text-foreground/50">
                  {fine.article ? `${fine.article} — ` : ""}
                  {FINES_SOURCE}
                </p>
                {fine.note && (
                  <p className="mt-2 rounded-xl bg-background px-3 py-2 text-[15px] leading-snug text-foreground/70">
                    {fine.note}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* disclaimer */}
      <div
        className="mb-4 mt-4 flex items-start gap-2.5 rounded-xl px-4 py-3.5"
        style={{ backgroundColor: "var(--t4-bg)", color: "var(--t4)" }}
      >
        <AlertIcon className="mt-0.5 h-5 w-5 shrink-0" />
        <p className="text-[14px] leading-snug">
          Thông tin tham khảo theo {FINES_SOURCE}, không thay cho văn bản gốc
          hay tư vấn pháp lý. Mức phạt với tổ chức thường gấp đôi cá nhân.
        </p>
      </div>
    </div>
  );
}
