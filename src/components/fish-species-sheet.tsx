"use client";

/*
  Chọn loài cá. Dùng ở 2 chỗ:
  · FishSpeciesContent — phần thân, nhúng vào PANEL RAIL "Ngư trường" (Phương
    án A: chọn loài là điều khiển lớp → ở rail, KHÔNG mở bottom-sheet riêng).
  · FishSpeciesSheet — wrapper bottom-sheet (giữ cho tương thích, nay không
    dùng trên map nữa).
  Loài gom theo NHÓM, mỗi loài 1 chấm màu; loài đang vụ ở vùng đang xem có
  viền cam + xếp đầu nhóm.
*/
import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  CATEGORY_LABEL,
  SPECIES_META,
  type SpeciesCategory,
} from "@/lib/species-meta";
import { useState } from "react";
import { CheckIcon, ChevronRightIcon } from "@/components/icons";
import { NHAN } from "@/lib/labels";
import type { Nghe } from "@/lib/lo-trinh/types";
import {
  MAX_FISH_PICKS,
  goiYTheoNghe,
  ngheCuaBo,
  togglePick,
} from "@/lib/fish-picks";

const CATEGORY_ORDER: SpeciesCategory[] = [
  "pelagic-large",
  "pelagic-small",
  "cephalopod",
  "demersal",
  "reef",
  "crustacean",
];

export function FishSpeciesContent({
  species,
  current,
  regionShorts,
  onPick,
  cols = 2,
}: {
  species: string[];
  current: string | null;
  regionShorts: Set<string>;
  /** chọn loài (null = Mọi loài) — caller tự đóng/quay lại sau khi chọn */
  onPick: (sp: string | null) => void;
  /** số cột lưới loài: 2 cho sheet rộng, 1 cho panel rail hẹp */
  cols?: 1 | 2;
}) {
  const groups = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: species
      .filter((s) => SPECIES_META[s]?.category === cat)
      .sort(
        (a, b) =>
          (regionShorts.has(a) ? 0 : 1) - (regionShorts.has(b) ? 0 : 1),
      ),
  })).filter((g) => g.items.length > 0);

  return (
    <>
      {/* Mọi loài — gộp tất cả, màu xanh lá. Nhãn "Mọi loài" (≤2 chữ — rà Codex lần 8, cùng chữ với nút chọn loài ở ra-khoi-controls); tiêu đề sheet đã nói là chọn loài */}
      <button
        type="button"
        aria-pressed={current == null}
        onClick={() => onPick(null)}
        className={`mb-1 flex min-h-[3.5rem] w-full items-center gap-3 rounded-xl px-4 transition active:scale-[0.99] ${
          current == null ? "bg-navy text-white" : "bg-field text-navy"
        }`}
      >
        <span
          className="h-3.5 w-3.5 shrink-0 rounded-full"
          style={{ background: "linear-gradient(135deg,var(--fish-all-from),var(--fish-all-to))" }}
          aria-hidden
        />
        <span className="flex-1 text-left text-[1rem] font-semibold">Mọi loài</span>
        {current == null && <CheckIcon className="h-5 w-5 shrink-0" />}
      </button>
      <p className="mb-3 px-1 text-[0.8125rem] leading-snug text-foreground/70">
        Loài đang vụ ở vùng bạn xem có{" "}
        <span className="font-semibold text-trim">viền cam</span>. Chọn loài để
        bản đồ tô đúng màu loài đó.
      </p>

      {groups.map((g) => (
        <div key={g.cat} className="mb-3">
          <h4 className="display mb-2 text-[0.9375rem] font-semibold text-muted">
            {CATEGORY_LABEL[g.cat]}
          </h4>
          <div
            className={`grid gap-2 ${cols === 1 ? "grid-cols-1" : "grid-cols-2"}`}
          >
            {g.items.map((sp) => {
              const meta = SPECIES_META[sp];
              const inRegion = regionShorts.has(sp);
              const active = current === sp;
              return (
                <button
                  key={sp}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onPick(sp)}
                  className={`flex min-h-[3.25rem] items-center gap-2 rounded-xl px-3 py-2 text-left text-[0.9375rem] font-semibold leading-tight transition active:scale-[0.98] ${
                    active
                      ? "bg-navy text-white"
                      : inRegion
                        ? "bg-field text-navy ring-1 ring-trim/60"
                        : "bg-field text-navy"
                  }`}
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: meta?.color ?? "var(--fish-unknown)" }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">{meta?.full ?? sp}</span>
                  {active && <CheckIcon className="h-4 w-4 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

/** Wrapper bottom-sheet (legacy — map nay dùng panel rail). */
export function FishSpeciesSheet({
  species,
  current,
  regionShorts,
  onPick,
  onClose,
}: {
  species: string[];
  current: string | null;
  regionShorts: Set<string>;
  onPick: (sp: string | null) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet title="Chọn loài cá" onClose={onClose}>
      <FishSpeciesContent
        species={species}
        current={current}
        regionShorts={regionShorts}
        onPick={(sp) => {
          onPick(sp);
          onClose();
        }}
      />
      {/* nút "Xong" ĐÃ BỎ — chọn loài là áp ngay + đóng; ngăn có × góc (rà bố cục 2026-10-22) */}
    </BottomSheet>
  );
}

/*
  BỘ CHỌN LOÀI BÀ CON ĐÁNH (2026-11-04) — thay "Mọi loài" mặc định. Mở lớp Dự báo cá lần
  đầu ⇒ hiện bộ này ngay trong panel. Ba tầng, trên dễ nhất:
    1. NGHỀ: một chạm điền sẵn 3 loài của nghề (loài đang vụ ở vùng xem lên trước);
    2. ĐANG VỤ QUANH ĐÂY: loài đang vụ ở vùng đang xem — chạm bật/tắt;
    3. LOÀI KHÁC: đủ danh sách theo nhóm, gập sẵn.
  Đủ 3 loài ⇒ chip chưa chọn mờ đi (bỏ bớt một loài mới chọn thêm được).
*/
export function FishPicker({
  species,
  picks,
  regionShorts,
  onChange,
  onDone,
}: {
  species: string[];
  picks: string[];
  regionShorts: Set<string>;
  onChange: (picks: string[]) => void;
  onDone: () => void;
}) {
  const [moRong, setMoRong] = useState(false);
  const nghe = ngheCuaBo(picks, species, regionShorts);
  // gợi ý ngắn: tối đa 6 loài đang vụ (đã chọn thì luôn hiện để bỏ được); còn lại vào "Loài khác"
  const vuDs = species.filter((s) => regionShorts.has(s));
  const dangVu = [
    ...vuDs.filter((s) => picks.includes(s)),
    ...vuDs.filter((s) => !picks.includes(s)),
  ].slice(0, Math.max(GOI_Y_TOI_DA, picks.filter((s) => regionShorts.has(s)).length));
  const conLai = new Set(dangVu);
  const day = picks.length >= MAX_FISH_PICKS;
  const khac = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: species.filter(
      (s) => SPECIES_META[s]?.category === cat && !conLai.has(s),
    ),
  })).filter((g) => g.items.length > 0);

  const chip = (sp: string) => {
    const meta = SPECIES_META[sp];
    const on = picks.includes(sp);
    const mo = day && !on;
    return (
      <button
        key={sp}
        type="button"
        aria-pressed={on}
        aria-disabled={mo}
        onClick={() => !mo && onChange(togglePick(picks, sp))}
        className={`flex min-h-[2.25rem] items-center gap-1.5 rounded-full px-3 py-1.5 text-left text-[0.8125rem] font-semibold leading-tight transition active:scale-[0.97] ${
          on ? "bg-navy text-white" : "bg-field text-navy"
        } ${mo ? "opacity-40" : ""}`}
      >
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: meta?.color ?? "var(--fish-unknown)" }}
          aria-hidden
        />
        <span className="min-w-0">{meta?.short ? cap(meta.short) : sp}</span>
        {on && <CheckIcon className="h-3.5 w-3.5 shrink-0" />}
      </button>
    );
  };

  return (
    <div className="mt-2">
      <p className="px-1 text-[0.9375rem] font-semibold text-navy">
        Bà con đánh loài nào?
      </p>
      <p className="mb-2 px-1 text-[0.75rem] text-muted">
        Chọn tới {MAX_FISH_PICKS} loài, bản đồ chỉ tô chỗ có loài đó.
      </p>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {NGHE_CHON.map((n) => (
          <button
            key={n.id}
            type="button"
            aria-pressed={nghe === n.id}
            onClick={() => onChange(goiYTheoNghe(n.id, species, regionShorts))}
            className={`rounded-full px-3 py-1.5 text-[0.8125rem] font-semibold transition active:scale-[0.97] ${
              nghe === n.id ? "bg-navy text-white" : "bg-field text-navy"
            }`}
          >
            {n.label}
          </button>
        ))}
      </div>

      {dangVu.length > 0 && (
        <>
          <h4 className="mb-1.5 px-1 text-[0.75rem] font-semibold text-muted">
            Đang vụ quanh đây
          </h4>
          <div className="mb-3 flex flex-wrap gap-1.5">{dangVu.map(chip)}</div>
        </>
      )}

      <button
        type="button"
        aria-expanded={moRong}
        onClick={() => setMoRong((v) => !v)}
        className="mb-2 flex w-full items-center gap-2 px-1 py-1 text-left text-[0.8125rem] font-semibold text-navy"
      >
        <span className="flex-1">{NHAN.loaiKhac}</span>
        <ChevronRightIcon
          className={`h-4 w-4 shrink-0 text-navy/55 transition-transform ${moRong ? "rotate-90" : ""}`}
        />
      </button>
      {moRong &&
        khac.map((g) => (
          <div key={g.cat} className="mb-2">
            <h4 className="mb-1.5 px-1 text-[0.75rem] font-semibold text-muted">
              {CATEGORY_LABEL[g.cat]}
            </h4>
            <div className="flex flex-wrap gap-1.5">{g.items.map(chip)}</div>
          </div>
        ))}

      <div className="mt-2 flex items-center gap-2">
        <span className="flex-1 px-1 text-[0.75rem] text-muted">
          Đã chọn {picks.length}/{MAX_FISH_PICKS}
        </span>
        <button
          type="button"
          disabled={picks.length === 0}
          onClick={onDone}
          className="rounded-xl bg-navy px-4 py-2 text-[0.875rem] font-semibold text-white transition active:scale-[0.98] disabled:opacity-40"
        >
          {NHAN.xong}
        </button>
      </div>
    </div>
  );
}

const GOI_Y_TOI_DA = 6;
/** tên ngắn viết hoa chữ đầu cho chip ("ngừ vằn" → "Ngừ vằn") — chip hẹp, tên đầy đủ quá dài */
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

const NGHE_CHON: { id: Nghe; label: string }[] = [
  { id: "cau-ngu", label: NHAN.cauNgu },
  { id: "luoi-vay", label: NHAN.luoiVay },
  { id: "luoi-re", label: NHAN.luoiRe },
  { id: "chup-muc", label: NHAN.chupMuc },
];
