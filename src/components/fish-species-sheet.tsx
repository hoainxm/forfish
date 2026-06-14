"use client";

/*
  Bảng chọn loài cá — modal, mở từ nút "Cá" gọn trên bản đồ (thay hàng chip
  ngang chắn map cũ). Loài gom theo NHÓM, mỗi loài 1 chấm màu; loài đang vụ ở
  vùng đang xem có viền cam + xếp đầu nhóm. Chọn xong đóng luôn để thấy bản đồ.
*/
import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  CATEGORY_LABEL,
  SPECIES_META,
  type SpeciesCategory,
} from "@/lib/fish-predict";
import { CheckIcon } from "@/components/icons";

const CATEGORY_ORDER: SpeciesCategory[] = [
  "pelagic-large",
  "pelagic-small",
  "cephalopod",
  "demersal",
  "reef",
  "crustacean",
];

export function FishSpeciesSheet({
  species,
  current,
  regionShorts,
  onPick,
  onClose,
}: {
  /** danh sách loài đang vụ (tên ngắn) */
  species: string[];
  /** loài đang chọn (null = Mọi loài) */
  current: string | null;
  /** tên ngắn các loài đang vụ ở vùng đang xem */
  regionShorts: Set<string>;
  onPick: (sp: string | null) => void;
  onClose: () => void;
}) {
  const groups = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: species
      .filter((s) => SPECIES_META[s]?.category === cat)
      .sort((a, b) => (regionShorts.has(a) ? 0 : 1) - (regionShorts.has(b) ? 0 : 1)),
  })).filter((g) => g.items.length > 0);

  const pick = (sp: string | null) => {
    onPick(sp);
    onClose();
  };

  return (
    <BottomSheet title="Chọn loài cá" onClose={onClose}>
      {/* Mọi loài — gộp tất cả, màu xanh lá */}
      <button
        type="button"
        aria-pressed={current == null}
        onClick={() => pick(null)}
        className={`mb-1 flex min-h-[3.5rem] w-full items-center gap-3 rounded-xl px-4 transition active:scale-[0.99] ${
          current == null ? "bg-navy text-white" : "bg-field text-navy"
        }`}
      >
        <span
          className="h-3.5 w-3.5 shrink-0 rounded-full"
          style={{ background: "linear-gradient(135deg,#95d5b2,#1b4b2c)" }}
          aria-hidden
        />
        <span className="flex-1 text-left text-[1rem] font-bold">Mọi loài</span>
        {current == null && <CheckIcon className="h-5 w-5 shrink-0" />}
      </button>
      <p className="mb-3 px-1 text-[0.8125rem] leading-snug text-foreground/70">
        Loài đang vụ ở vùng bạn xem có{" "}
        <span className="font-semibold text-trim">viền cam</span>. Chọn loài để
        bản đồ tô đúng màu loài đó.
      </p>

      {groups.map((g) => (
        <div key={g.cat} className="mb-3">
          <h4 className="display mb-2 text-[0.9375rem] font-bold uppercase tracking-wide text-foreground/65">
            {CATEGORY_LABEL[g.cat]}
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {g.items.map((sp) => {
              const meta = SPECIES_META[sp];
              const inRegion = regionShorts.has(sp);
              const active = current === sp;
              return (
                <button
                  key={sp}
                  type="button"
                  aria-pressed={active}
                  onClick={() => pick(sp)}
                  className={`flex min-h-[3.25rem] items-center gap-2 rounded-xl px-3 py-2 text-left text-[0.9375rem] font-bold leading-tight transition active:scale-[0.98] ${
                    active
                      ? "bg-navy text-white"
                      : inRegion
                        ? "bg-field text-navy ring-1 ring-trim/60"
                        : "bg-field text-navy"
                  }`}
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: meta?.color ?? "#888" }}
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

      <button
        type="button"
        onClick={onClose}
        className="mt-1 min-h-[3.5rem] w-full rounded-xl bg-navy text-[1.125rem] font-bold text-white transition active:scale-[0.99]"
      >
        Xong
      </button>
    </BottomSheet>
  );
}
