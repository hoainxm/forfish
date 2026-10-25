"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/*
  Tabs trong trang — segmented control hiện đại, thay kiểu xếp chồng dọc
  (cuộn dài). Một page lớn = vài mục; mỗi lần chỉ hiện 1 mục → màn ngắn,
  gọn, "khoa học". Thanh tab dính (sticky) dưới header khi cuộn.

  · ≤4 tab VÀ chữ vừa một hàng: chia đều (flex-1) kiểu segmented; không vừa (nhãn dài,
    chữ phóng to, nhiều tab) thì rơi về cuộn ngang — nhãn KHÔNG bao giờ gãy hai dòng trong
    pill (rà FB 2026-10-25, K3-12: "Giới thiệu" gãy ở trang cá nhân Kairos). Đo thật
    `scrollWidth > clientWidth` của thanh, đo lại khi đổi cỡ.
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
  /*  Chữ nowrap nên khi không vừa, pill tràn khỏi thanh ⇒ scrollWidth > clientWidth ⇒ đổi sang cuộn ngang;
      ở chế độ cuộn mà nội dung lại vừa (xoay máy) ⇒ về segmented. Đo trong layout effect để không nháy. */
  const thanhRef = useRef<HTMLDivElement>(null);
  const [tran, setTran] = useState(false);
  const nhan = tabs.map((t) => t.label).join("\u0000");
  useLayoutEffect(() => {
    const el = thanhRef.current;
    if (!el) return;
    const do_ = () => setTran(el.scrollWidth > el.clientWidth + 1);
    do_();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(do_) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [nhan]);
  const segmented = tabs.length <= 4 && !tran;

  return (
    <div>
      {/* Dính DƯỚI vùng an toàn (`top: safe-area-top`) thay vì top-0-rồi-đệm:
          pills vẫn nằm trọn dưới notch/status bar khi hero cuộn mất, NHƯNG lúc
          NGHỈ (ngay dưới hero) không còn cộng ~47px safe-area vào `pt` → hết
          khoảng trắng thừa giữa hero và tab (user 2026-08-30: "nhiều khoảng
          trắng quá"). Desktop safe-area=0 nên y như cũ. */}
      <div className="sticky top-[env(safe-area-inset-top)] z-10 bg-background px-4 pb-2.5 pt-2.5">
        <div
          ref={thanhRef}
          role="tablist"
          aria-label={ariaLabel}
          className={`flex gap-1 rounded-full bg-field p-1 ${
            segmented ? "" : "overflow-x-auto cuon-an"
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
                className={`relative h-(--h-chip) whitespace-nowrap rounded-full px-3 text-[0.875rem] font-semibold leading-tight transition ${
                  segmented ? "flex-1" : "shrink-0"
                } ${
                  on
                    ? "bg-navy text-white shadow-navy-tab"
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
