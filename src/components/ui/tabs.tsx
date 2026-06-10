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
      <div className="sticky top-0 z-10 bg-background/90 px-4 py-2.5 backdrop-blur-md">
        <div
          role="tablist"
          aria-label={ariaLabel}
          className={`flex gap-1 rounded-full bg-field p-1 ${
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
                className={`min-h-[48px] rounded-full px-3 text-[16px] font-bold leading-tight transition ${
                  segmented ? "flex-1" : "shrink-0"
                } ${
                  on
                    ? "bg-navy text-white shadow-[0_4px_12px_-4px_rgba(13,35,54,0.4)]"
                    : "text-navy/70 active:bg-card"
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
