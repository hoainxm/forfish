"use client";

/*
  ChipRow — hàng chip điều hướng TRONG trang, dùng chung (chốt 2026-06-10
  khi cấu trúc mới sinh ra chip lồng chip). PHÂN CẤP RÕ để bà con biết
  mình đang ở tầng nào:

  · Tầng trên cùng của một KHU là Tabs (ui/tabs.tsx — track pill, sticky).
  · level 1 — mục chính trong tab: pill ĐẶC màu trục, chữ 16px, cao 48px.
  · level 2 — mục con bên trong một mục: pill TONAL (nền nhạt màu trục),
    chữ 15px, cao 42px — nhỏ và nhẹ hơn hẳn để không tranh với tầng trên.

  `accent` = token màu trục ("t1".."t4") để mỗi khu giữ đúng màu nhận diện.
*/

export interface ChipOption<T extends string> {
  id: T;
  label: string;
}

export function ChipRow<T extends string>({
  options,
  value,
  onChange,
  accent = "t2",
  level = 1,
  ariaLabel,
}: {
  options: readonly ChipOption<T>[];
  value: T;
  onChange: (id: T) => void;
  /** token màu trục: t1 | t2 | t3 | t4 */
  accent?: "t1" | "t2" | "t3" | "t4";
  level?: 1 | 2;
  ariaLabel?: string;
}) {
  const base =
    level === 1
      ? "min-h-[3rem] px-4 text-[1rem]"
      : "min-h-[2.625rem] px-3.5 text-[0.9375rem]";
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="mb-3 flex gap-1.5 overflow-x-auto px-4"
    >
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={on}
            className={`${base} shrink-0 rounded-full font-bold transition active:scale-[0.97] ${
              on
                ? level === 1
                  ? "text-white"
                  : ""
                : "bg-field text-navy/65 active:bg-card"
            }`}
            style={
              on
                ? level === 1
                  ? { backgroundColor: `var(--${accent})` }
                  : {
                      backgroundColor: `var(--${accent}-bg)`,
                      color: `var(--${accent})`,
                    }
                : undefined
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
