"use client";

/*
  KHUNG MÀN BẢN ĐỒ (2026-10-20, anh Long gửi ảnh mẫu app hải đồ: "ô tìm trên
  cùng, tốc độ góc trái dưới, la bàn góc phải dưới, thẻ trạng thái đáy").
  Ba mảnh nổi cố định trên bản đồ, tách khỏi fishing-map-view:
    · `OTimDiem`   — ô "Đi đâu?" đầu màn → mở ô gõ toạ độ (đến điểm).
    · `DongHoTocDo` — tròn góc trái dưới: tốc độ GPS theo đơn vị bà con chọn.
    · `NutViTri`   — tròn góc phải dưới: đưa bản đồ về chỗ tàu đứng. Bản đồ đã
      KHOÁ xoay (bắc luôn lên trên, 2026-08-30) nên nút này không xoay hướng —
      nó là "về tàu", hình la bàn cho quen mắt như app hải đồ.
  Cỡ bằng rem (theo chế độ chữ), màu qua token.
*/
import { NavArrowIcon, SearchIcon } from "@/components/icons";
import { speedReadout, type DistUnit } from "@/lib/map-prefs";

export function OTimDiem({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Đi đâu? Nhập toạ độ để đến điểm"
      className="pointer-events-auto flex h-(--h-ctl) w-full min-w-0 items-center gap-2 rounded-full border border-line bg-card/95 px-3.5 text-left shadow-float active:bg-field"
    >
      <SearchIcon className="h-5 w-5 shrink-0 text-sea" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-[0.9375rem] text-foreground/65">Đi đâu? Nhập toạ độ…</span>
    </button>
  );
}

export function DongHoTocDo({ kmh, unit, stale }: { kmh: number | null; unit: DistUnit; stale: boolean }) {
  const r = speedReadout(kmh, unit);
  return (
    <div
      role="status"
      aria-label={`Tốc độ tàu ${r.value === "—" ? "chưa có số" : `${r.value} ${r.unit}`}${stale ? ", số GPS đã cũ" : ""}`}
      className={`pointer-events-none flex aspect-square w-[4.5rem] flex-col items-center justify-center rounded-full border-4 bg-card shadow-float ${
        stale ? "border-warn" : "border-sea"
      }`}
    >
      <span aria-hidden className="text-[1.375rem] font-bold leading-none tabular-nums text-navy">
        {r.value}
      </span>
      <span aria-hidden className="mt-0.5 text-center text-[0.625rem] font-semibold leading-tight text-foreground/65">
        {r.unit}
      </span>
    </div>
  );
}

export function NutViTri({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Về chỗ tàu đang đứng"
      className="pointer-events-auto flex h-(--h-cta) w-(--h-cta) items-center justify-center rounded-full border border-line bg-card text-navy shadow-float active:scale-95 disabled:opacity-50"
    >
      <NavArrowIcon className="h-6 w-6" />
    </button>
  );
}
