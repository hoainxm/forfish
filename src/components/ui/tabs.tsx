"use client";

import { useEffect, useState, type ReactNode } from "react";

/*
  Tabs trong trang — segmented control hiện đại, thay kiểu xếp chồng dọc
  (cuộn dài). Một page lớn = vài mục; mỗi lần chỉ hiện 1 mục → màn ngắn,
  gọn, "khoa học". Thanh tab dính (sticky) dưới header khi cuộn.

  · ≤4 tab: chia đều (flex-1) kiểu segmented; nhiều hơn thì cuộn ngang.
  · tap ≥48px, active = navy đặc, có aria-selected/role=tab cho a11y.
  · chỉ render mục đang chọn (nhẹ; component tự hydrate lại từ localStorage).
  · DEEP-LINK (hội đồng UX 2026-06-11): truyền paramKey="tab" là Tabs đọc
    ?tab=<id> từ URL lúc mount — nhắc việc ngoài trang chủ rơi ĐÚNG tab
    (vd /tau?tab=dich-vu). Đọc window.location trong effect, không cần
    Suspense/useSearchParams, trang vẫn prerender tĩnh được.
  · badge: chấm đỏ cạnh nhãn (vd tab Dịch vụ khi có nợ quá hạn).
  · value/onChange: dùng dạng controlled khi cha cần tự đổi tab (banner nợ).
*/
export interface TabDef {
  id: string;
  label: string;
  content: ReactNode;
  /** chấm đỏ cạnh nhãn — có việc cần ngó trong tab này */
  badge?: boolean;
}

export function Tabs({
  tabs,
  ariaLabel,
  paramKey,
  value,
  onChange,
}: {
  tabs: TabDef[];
  ariaLabel?: string;
  /** tên query param để nhận deep-link (vd "tab" → /tau?tab=dich-vu) */
  paramKey?: string;
  /** controlled: id tab đang chọn (cặp với onChange) */
  value?: string;
  onChange?: (id: string) => void;
}) {
  const [inner, setInner] = useState(tabs[0]?.id);
  const active = value ?? inner;
  const setActive = (id: string) => {
    setInner(id);
    onChange?.(id);
  };

  // deep-link: ?tab=<id> mở đúng tab — đọc sau mount (trang prerender tĩnh)
  useEffect(() => {
    if (!paramKey) return;
    const wanted = new URLSearchParams(window.location.search).get(paramKey);
    if (wanted && tabs.some((t) => t.id === wanted)) {
      setInner(wanted);
      onChange?.(wanted);
    }
    // chỉ đọc một lần lúc mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramKey]);

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
                className={`relative min-h-[3rem] rounded-full px-3 text-[1rem] font-bold leading-tight transition ${
                  segmented ? "flex-1" : "shrink-0"
                } ${
                  on
                    ? "bg-navy text-white shadow-[0_4px_12px_-4px_rgba(13,35,54,0.4)]"
                    : "text-navy/70 active:bg-card"
                }`}
              >
                {t.label}
                {t.badge && (
                  <span
                    className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-card"
                    aria-label="Có việc cần xem"
                  />
                )}
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
