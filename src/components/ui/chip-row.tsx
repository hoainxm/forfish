"use client";

/*
  ChipRow — hàng chip điều hướng TRONG trang, dùng chung (chốt 2026-06-10
  khi cấu trúc mới sinh ra chip lồng chip). PHÂN CẤP RÕ để bà con biết
  mình đang ở tầng nào:

  · Tầng trên cùng của một KHU là Tabs (ui/tabs.tsx — track pill, sticky).
  · level 1 — mục chính trong tab: chọn = pill ĐẶC navy.
  · level 2 — mục con bên trong một mục: chọn = viền + chữ navy (nhẹ hơn tầng 1
    bằng màu, cùng cỡ bậc chip 03 §0).

  `accent` (màu trục) BỎ 2026-10-19 — prop còn nhận để nơi gọi cũ khỏi vỡ.
*/

export interface ChipOption<T extends string> {
  id: T;
  label: string;
}

export function ChipRow<T extends string>({
  options,
  value,
  onChange,
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
  /*  Bậc chip 03 §0 (2026-10-19): cao 2.5rem, rộng CỐ ĐỊNH ≥5.5rem, chữ canh giữa —
      nhãn ≤2 chữ nên không nở theo chữ; tầng 2 chỉ khác màu, không khác cỡ. */
  const base =
    level === 1
      ? "h-(--h-chip) min-w-[5.5rem] px-3 text-[0.875rem]"
      : "h-(--h-chip) min-w-[5.5rem] px-3 text-[0.8125rem]";
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="mb-3 flex gap-2 overflow-x-auto px-4"
    >
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={on}
            /*  CHỌN = NAVY, không còn màu trục (rà design Codex lần 2, 2026-10-19):
                pill đặc xanh lá/tím/vàng theo khu làm mỗi màn một bảng màu riêng
                và tranh điểm nhấn với nút cam. Navy = thương hiệu/điều hướng.
                Tầng 1 đặc navy; tầng 2 chỉ viền + chữ navy — nhẹ hơn bằng màu,
                cùng cỡ. `accent` giữ trong props cho nơi gọi cũ, không còn dùng. */
            className={`${base} inline-flex shrink-0 items-center justify-center rounded-full border font-semibold transition active:scale-[0.97] ${
              on
                ? level === 1
                  ? "border-navy bg-navy text-white"
                  : "border-navy bg-card text-navy"
                : "border-line bg-card text-foreground/75"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
