"use client";

import { useEffect, useRef } from "react";
import {
  ADMIN_TAB_LABEL,
  groupOfTab,
  type AdminNavGroup,
  type AdminTab,
} from "@/lib/admin-nav";

/*
  Điều hướng /quan-tri theo NHÓM (2026-10-02 — 12 tab phẳng cuộn ngang khó tìm).
  · Desktop (md+): cột trái dính khi cuộn, mỗi nhóm một tiêu đề nhỏ + nút tab.
  · Mobile: thanh dính đầu màn — hàng NHÓM (≤4 nút chia đều) + hàng TAB của
    nhóm đang chọn (≤4 tab, ADMIN_NAV_GROUPS khoá trần bằng test).
  Chỉ XẾP chỗ: danh sách nhóm/tab đã lọc theo quyền ở trang cha.
*/
export function AdminNav({
  groups,
  active,
  onSelect,
}: {
  groups: AdminNavGroup[];
  active: AdminTab;
  onSelect: (tab: AdminTab) => void;
}) {
  const activeGroup = groupOfTab(groups, active) ?? groups[0];
  const activeRef = useRef<HTMLButtonElement>(null);

  // đổi tab bằng nhóm/hash → tab đang chọn luôn nằm trong tầm mắt (mobile)
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  const tabBtn = (id: AdminTab, block: boolean) => {
    const on = id === active;
    return (
      <button
        key={id}
        ref={on && !block ? activeRef : undefined}
        type="button"
        role="tab"
        aria-selected={on}
        aria-current={on ? "page" : undefined}
        onClick={() => onSelect(id)}
        className={`min-h-[2.75rem] whitespace-nowrap rounded-xl px-4 text-[0.9375rem] font-bold transition-[background-color,color,box-shadow,transform] duration-200 ease-out active:scale-[0.98] ${
          block ? "w-full text-left" : "shrink-0"
        } ${
          on
            ? "bg-navy text-white shadow-sm"
            : block
              ? "text-foreground/75 hover:bg-field"
              : "bg-field text-foreground/70"
        }`}
      >
        {ADMIN_TAB_LABEL[id]}
      </button>
    );
  };

  return (
    <>
      {/* ── DESKTOP: cột trái ── */}
      <nav
        aria-label="Khu quản trị"
        className="hidden md:sticky md:top-6 md:block md:max-h-[calc(100dvh-3rem)] md:self-start md:overflow-y-auto"
      >
        <div role="tablist" aria-orientation="vertical" className="space-y-5">
          {groups.map((g) => (
            <div key={g.id}>
              <p className="px-4 pb-1.5 text-[0.8125rem] font-bold uppercase tracking-wide text-foreground/50">
                {g.label}
              </p>
              <div className="space-y-1">
                {g.tabs.map((id) => tabBtn(id, true))}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {/* ── MOBILE: thanh dính đầu màn ── */}
      <div className="sticky top-0 z-20 -mx-4 border-b border-line bg-background/95 px-4 pb-2 pt-2 backdrop-blur md:hidden">
        {groups.length > 1 && (
          <div
            className="grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${groups.length}, minmax(0, 1fr))` }}
          >
            {groups.map((g) => {
              const on = g.id === activeGroup?.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onSelect(g.tabs[0])}
                  className={`min-h-[2.75rem] whitespace-nowrap rounded-xl px-1 text-[0.8125rem] font-bold transition-colors duration-200 ${
                    on
                      ? "bg-navy/10 text-navy ring-2 ring-navy/30"
                      : "text-foreground/60"
                  }`}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
        )}
        {activeGroup && activeGroup.tabs.length > 1 && (
          <div
            key={activeGroup.id}
            role="tablist"
            className="anim-fade-in mt-2 flex gap-1.5 overflow-x-auto"
          >
            {activeGroup.tabs.map((id) => tabBtn(id, false))}
          </div>
        )}
      </div>
    </>
  );
}

/**
 * Khung xương lúc ĐANG TẢI — thay dòng chữ "Đang tải…" trơ trọi. Giữ câu chữ
 * (đọc được + trình đọc màn hình) và vẽ vài thanh nhấp nháy đúng dáng danh
 * sách sắp hiện, để màn không nhảy khi dữ liệu về. Tắt chuyển động: block
 * prefers-reduced-motion ở globals.css tự dừng `animate-pulse`.
 */
export function AdminSkeleton({
  label,
  rows = 3,
}: {
  label: string;
  rows?: number;
}) {
  return (
    <div role="status" aria-live="polite" className="anim-fade-in space-y-3">
      <p className="text-[0.9375rem] font-semibold text-foreground/60">{label}</p>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="surface space-y-2.5 px-4 py-4" aria-hidden>
          <div className="h-4 w-2/5 animate-pulse rounded-md bg-field" />
          <div className="h-3 w-4/5 animate-pulse rounded-md bg-field" />
          <div className="h-3 w-3/5 animate-pulse rounded-md bg-field" />
        </div>
      ))}
    </div>
  );
}
