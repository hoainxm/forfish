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
      {/* dính top-0; +safe-area-top để khi dính KHÔNG chui dưới notch/status bar
          (edge-to-edge viewportFit cover) — hero cuộn mất thì thanh tab vẫn
          nằm trọn dưới vùng an toàn, không đè chữ với status bar. */}
      <div className="sticky top-0 z-10 bg-background/90 px-4 pb-2.5 pt-[calc(0.625rem+env(safe-area-inset-top))] backdrop-blur-md">
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
                className={`relative min-h-[3.5rem] rounded-full px-3 text-[1rem] font-bold leading-tight transition ${
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

      {/* key=active → đổi tab là remount → cross-fade nhẹ (điềm đạm) */}
      <div role="tabpanel" key={current?.id} className="anim-fade-in pt-3">
        {current?.content}
      </div>
    </div>
  );
}
