"use client";

// Ô GÕ TOẠ ĐỘ TỰ NHẢY (anh Long 2026-11-02): hệ độ-phút-giây (mặc định) = ba ô số
// [độ°][phút′][giây″] + chip hướng; gõ đủ số là con trỏ sang ô kế, gõ dấu ngăn cũng
// sang, xoá ở ô trống thì lùi ô trước, dán cả chuỗi vào ô nào cũng tự chia. Hệ độ thập
// phân = một ô như cũ. Ra ngoài vẫn là MỘT chuỗi cho `parseOneCoord` — chỗ dùng không
// đổi luật đọc. Luật thuần + test: lib/o-toa-do.ts.

import { useEffect, useRef, useState } from "react";
import { useMapPrefs } from "@/lib/map-prefs";
import type { CoordAxis } from "@/lib/parse-coord";
import { ghepToaDo, laDauNgan, nhapO, tachToaDo, type OSo, type PhanToaDo } from "@/lib/o-toa-do";

const O: OSo[] = ["d", "m", "s"];
const DAU: Record<OSo, string> = { d: "°", m: "′", s: "″" };
const TEN_O: Record<OSo, string> = { d: "độ", m: "phút", s: "giây" };

export function OToaDo({
  axis,
  value,
  onChange,
  label,
  placeholder,
  onEnter,
  nen = "bg-field",
}: {
  axis: CoordAxis;
  value: string;
  onChange: (v: string) => void;
  /** tên đọc màn hình: "Vĩ độ" / "Kinh độ của điểm muốn thêm"… */
  label: string;
  /** chỉ hệ độ thập phân (một ô) */
  placeholder?: string;
  onEnter?: () => void;
  /** nền ô — theo nền thẻ chứa nó */
  nen?: string;
}) {
  const prefs = useMapPrefs();
  const refs = useRef<Record<OSo, HTMLInputElement | null>>({ d: null, m: null, s: null });
  const [phan, setPhan] = useState<PhanToaDo>(() => tachToaDo(value, axis) ?? { d: "", m: "", s: "", am: false });
  const daGhep = useRef(value);
  // chỗ dùng điền sẵn / xoá (vd "lấy chỗ đang trỏ", gõ xong bấm Thêm) ⇒ chia lại ba ô
  useEffect(() => {
    if (value === daGhep.current) return;
    const t = tachToaDo(value, axis);
    if (t) setPhan(t);
    daGhep.current = value;
  }, [value, axis]);

  const oCls = `min-h-[3.25rem] w-full rounded-xl ${nen} px-2 text-center text-[1rem] font-semibold tabular-nums text-navy outline-none focus:ring-2 focus:ring-t1`;

  if (prefs.coordFormat === "dd") {
    return (
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onEnter?.();
        }}
        placeholder={placeholder}
        aria-label={label}
        className={`${oCls} text-left`}
      />
    );
  }

  const day = (p: PhanToaDo) => {
    setPhan(p);
    const s = ghepToaDo(p, axis);
    daGhep.current = s;
    onChange(s);
  };
  const sang = (o: OSo) => {
    const i = O.indexOf(o);
    if (i < 2) refs.current[O[i + 1]]?.focus();
  };

  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      {O.map((o) => (
        <label key={o} className="flex min-w-0 flex-1 items-center gap-0.5">
          <input
            ref={(el) => {
              refs.current[o] = el;
            }}
            type="text"
            data-o-toa-do
            inputMode={o === "s" ? "decimal" : "numeric"}
            value={phan[o]}
            // không maxLength ở ô độ/phút: chữ số tràn phải TỚI được onChange để dồn sang ô kế
            maxLength={o === "s" ? 5 : undefined}
            aria-label={`${label} — ${TEN_O[o]}`}
            /*  CHẠM Ô ĐÃ CÓ SỐ ⇒ BÔI ĐEN (thử iOS Simulator 2026-11-02: sửa "15" bằng xoá + gõ ra
                31° 50′ vì con trỏ đứng giữa số). Gõ là thay cả ô — đúng kiểu ô OTP. iOS cần một
                nhịp sau focus mới chọn được. */
            onFocus={(e) => {
              const el = e.currentTarget;
              requestAnimationFrame(() => el.select());
            }}
            onPaste={(e) => {
              // dán cả chuỗi "15°07'12"N" vào ô nào cũng chia đủ ba ô
              const t = tachToaDo(e.clipboardData.getData("text"), axis);
              if (!t) return;
              e.preventDefault();
              day(t);
              refs.current.s?.focus();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onEnter?.();
                return;
              }
              if (e.key === "Backspace" && !phan[o] && o !== "d") {
                e.preventDefault();
                refs.current[O[O.indexOf(o) - 1]]?.focus();
                return;
              }
              if (e.key.length === 1 && laDauNgan(e.key) && !(o === "s" && /[.,]/.test(e.key))) {
                e.preventDefault();
                sang(o);
              }
            }}
            onChange={(e) => {
              const raw = e.target.value;
              // gõ dấu ngăn trên bàn phím ảo (không bắn keydown đúng phím) ⇒ cũng sang ô kế
              const ngan = o !== "s" && /[\s.,°'′\-]$/.test(raw);
              const r = nhapO(phan, o, raw, axis);
              day(r.p);
              if (r.focus) refs.current[r.focus]?.focus();
              else if (ngan) sang(o);
              // GIÂY ĐỦ 2 SỐ ⇒ sang ô ĐỘ của trục kế (vĩ → kinh) — gõ một mạch cả cặp toạ độ
              else if (o === "s" && /^\d{2}$/.test(r.p.s)) {
                const tat = Array.from(document.querySelectorAll<HTMLInputElement>("input[data-o-toa-do]"));
                tat[tat.indexOf(e.currentTarget) + 1]?.focus();
              }
            }}
            className={oCls}
          />
          <span className="shrink-0 text-[1rem] font-semibold text-navy/60" aria-hidden>
            {DAU[o]}
          </span>
        </label>
      ))}
      {/*  HƯỚNG: biển mình Bắc/Đông nên mặc định; chạm để đổi (chữ, không chỉ ký hiệu) */}
      <button
        type="button"
        onClick={() => day({ ...phan, am: !phan.am })}
        aria-label={`${label} — hướng ${axis === "lat" ? (phan.am ? "Nam" : "Bắc") : phan.am ? "Tây" : "Đông"}, chạm để đổi`}
        className={`flex min-h-[3.25rem] w-12 shrink-0 items-center justify-center rounded-xl ${nen} text-[0.875rem] font-semibold text-t1 active:scale-95`}
      >
        {/* chữ đầy đủ: "N" một mình là Nam (Việt) hay North (máy định vị) — không để đoán */}
        {axis === "lat" ? (phan.am ? "Nam" : "Bắc") : phan.am ? "Tây" : "Đông"}
      </button>
    </div>
  );
}
