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
      {/* Mọi loài — gộp tất cả, màu xanh lá */}
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
