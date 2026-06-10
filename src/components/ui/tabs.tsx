"use client";

import { useState, type ReactNode } from "react";

/*
  Tabs trong trang — segmented control hiện đại, thay kiểu xếp chồng dọc
  (cuộn dài). Một page lớn = vài mục; mỗi lần chỉ hiện 1 mục → màn ngắn,
  gọn, "khoa học". Thanh tab dính (sticky) dưới header khi cuộn.

  · ≤4 tab: chia đều (flex-1) kiểu segmented; nhiều hơn thì cuộn ngang.
  · tap ≥48px, active = navy đặc, có aria-selected/role=tab cho a11y.
  · chỉ render mục đang chọn (nhẹ; component tự hydrate lại từ localStorage).
*/
export interface TabDef {
  id: string;
  label: string;
  content: ReactNode;
}

export function Tabs({
  tabs,
  ariaLabel,
}: {
  tabs: TabDef[];
  ariaLabel?: string;
}) {
  const [active, setActive] = useState(tabs[0]?.id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  const segmented = tabs.length <= 4;

  return (
    <div>
      <div
        className="sticky top-0 z-10 border-b border-line bg-background/95 px-4 py-2.5 backdrop-blur"
      >
        <div
          role="tablist"
          aria-label={ariaLabel}
          className={`flex gap-1.5 rounded-xl bg-card p-1 ring-1 ring-line ${
            segmented ? "" : "overflow-x-auto"
          }`}
        >
          {tabs.map((t) => {
            const on = t.id === current?.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={on}
                onClick={() => setActive(t.id)}
                className={`min-h-[48px] rounded-lg px-3 text-[16px] font-bold leading-tight transition ${
                  segmented ? "flex-1" : "shrink-0"
                } ${
                  on
                    ? "bg-navy text-white shadow-sm"
                    : "text-navy/70 active:bg-background"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel" className="pt-3">
        {current?.content}
      </div>
    </div>
  );
}
