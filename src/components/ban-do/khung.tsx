"use client";

/*
  KHUNG MÀN BẢN ĐỒ (2026-10-20, anh Long gửi ảnh mẫu app hải đồ: "ô tìm trên
  cùng, tốc độ góc trái dưới, la bàn góc phải dưới, thẻ trạng thái đáy").
  Ba mảnh nổi cố định trên bản đồ, tách khỏi fishing-map-view:
    · `OTimDiem`   — ô "Đi đâu?" đầu màn → mở ô gõ toạ độ (đến điểm).
    · `DongHoTocDo` — tròn góc trái dưới: tốc độ GPS theo đơn vị bà con chọn.
    · `NutViTri`   — tròn góc phải dưới: đưa bản đồ về chỗ tàu đứng. Hình VÒNG
      NGẮM định vị (quen như Google Maps), KHÔNG chữ (anh Long: "bỏ chữ về tàu
      đi"; tên đọc ở aria-label). Bản đầu dùng mũi tên chỉ lên — anh hỏi "sao chỉ
      lên trên thế": bản đồ khoá xoay (bắc luôn lên trên), mũi tên gây hiểu lầm.
  Cỡ bằng rem (theo chế độ chữ), màu qua token.
*/
import { CrosshairIcon, SearchIcon, SpeakerIcon, SpeakerOffIcon } from "@/components/icons";
import { speedReadout, type DistUnit } from "@/lib/map-prefs";

export function OTimDiem({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Đi đâu — nhập toạ độ để đến điểm"
      className="pointer-events-auto flex h-(--h-ctl) w-full min-w-0 items-center gap-2 glass rounded-full px-3.5 text-left transition active:scale-[0.98]"
    >
      <SearchIcon className="h-5 w-5 shrink-0 text-sea" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-[0.9375rem] text-foreground/65">Đi đâu?</span>
    </button>
  );
}

/**
 * TỐC ĐỘ TÀU góc trái dưới — KIỂU TRONG SUỐT (anh Long 2026-10-20: "chưa gps thì
 * ẩn cái này đi, có gps tính được tốc độ thì hiện, kiểu trong suốt thôi, ko cần
 * làm 1 ô ra xấu"): không ô tròn nền trắng, chỉ chữ số nổi trên bản đồ có QUẦNG
 * SÁNG như nhãn hải đồ (đọc được trên cả nền biển lẫn đất). Bên gọi chỉ vẽ khi
 * đã có vị trí tàu VÀ tốc độ. GPS cũ ⇒ đơn vị đổi thành "GPS cũ" màu cảnh báo.
 */
export function DongHoTocDo({ kmh, unit, stale }: { kmh: number; unit: DistUnit; stale: boolean }) {
  const r = speedReadout(kmh, unit);
  return (
    <div
      role="status"
      aria-label={`Tốc độ tàu ${r.value} ${r.unit}${stale ? ", số GPS đã cũ" : ""}`}
      className="pointer-events-none flex flex-col items-start leading-none [text-shadow:0_0_2px_var(--card),0_0_4px_var(--card),0_0_8px_var(--card)]"
    >
      <span aria-hidden className="text-[1.75rem] font-bold tabular-nums text-navy">
        {r.value}
      </span>
      <span aria-hidden className={`mt-0.5 text-[0.75rem] font-semibold ${stale ? "text-warn" : "text-navy/75"}`}>
        {stale ? "GPS cũ" : r.unit}
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
      /*  CÙNG CỠ nút ⚠ chip dữ liệu ngay trên (anh Long: "kích thước nó nhỏ bằng
          cái dấu !"): vuông --h-ctl, viền mảnh, bóng nhẹ — hai nút một cột thẳng. */
      className="pointer-events-auto flex h-(--h-ctl) w-(--h-ctl) items-center justify-center glass rounded-full text-sea active:scale-95 disabled:opacity-50"
    >
      <CrosshairIcon className="h-[1.125rem] w-[1.125rem]" aria-hidden />
    </button>
  );
}

/**
 * NÚT LOA — bật/tắt "LUÔN ĐỌC CẢNH BÁO" theo vị trí tàu (chế độ Chạy tàu), đưa ra
 * ngoài bản đồ từ khay "Thêm" (anh Long 2026-10-20: "cho hình cái loa ra ngoài để
 * bật hoặc ẩn để luôn nghe thông báo, cái này theo kiểu luôn đọc cảnh báo chứ ko
 * phải là vô dẫn đường"). Cùng cỡ nút ⚠ / nút về tàu (--h-ctl), một cột góc phải.
 * Bật = nền sea đặc + loa; tắt = nền card + loa gạch. Chỉ icon, tên ở aria-label.
 */
export function NutLoa({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={on ? "Đang đọc cảnh báo theo vị trí tàu — chạm để tắt" : "Bật đọc cảnh báo theo vị trí tàu"}
      className={`pointer-events-auto flex h-(--h-ctl) w-(--h-ctl) items-center justify-center rounded-full border shadow-sm active:scale-95 ${
        on ? "border-sea bg-sea text-white" : "glass border-transparent text-navy"
      }`}
    >
      {on ? <SpeakerIcon className="h-[1.125rem] w-[1.125rem]" aria-hidden /> : <SpeakerOffIcon className="h-[1.125rem] w-[1.125rem]" aria-hidden />}
    </button>
  );
}
