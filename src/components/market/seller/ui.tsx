"use client";

// VỤN NHÌN THẤY ĐƯỢC của Kênh người bán — khuôn nút, ô lỗi, tóm tắt dòng hàng.
// Tách khỏi `seller-net.tsx` (vụn MẠNG) để không kéo hook mạng + `useAuthUser`
// vào những chỗ chỉ cần một chuỗi class. Thanh đầu màn và ảnh dòng hàng dùng
// bản CHUNG của chợ: `shared/market-header.tsx`, `shared/line-thumb.tsx`.

import type { OrderLine } from "@/lib/market/types";

/*  NÚT CHỮ CỦA MÀN CHỢ (fix UX 2026-09-06, lead §6 F-07).
    `.sq-btn` ở chế độ mặc định "gọn" co còn 37px cao / chữ 11px — được cho
    icon phụ ít bấm trên bản đồ, KHÔNG được cho việc bà con làm suốt ngày ở
    chợ (Sửa · Hết hàng · Thêm món · Lưu · Huỷ đơn · Xoá món). Khuôn này giữ
    đúng sàn chạm 3.5rem và chữ 1rem ở MỌI chế độ; nền/màu chữ do nơi gọi
    thêm (`bg-field text-navy`, `bg-trim text-white`…). */
export const SELLER_BTN =
  "flex min-h-(--row-h) items-center justify-center gap-2 rounded-2xl px-4 py-2 text-[1rem] font-semibold transition active:scale-[0.98] disabled:opacity-40";

/** Nút chữ chiếm trọn bề ngang ô chứa (hàng nút dưới thẻ món). */
export const SELLER_BTN_WIDE = `${SELLER_BTN} w-full`;

/*  "XEM THÊM N …" — đáy mọi danh sách dài của kênh người bán (2026-09-07).
    Luật của dự án là Xem thêm, KHÔNG phải Trước/Sau (07 §Ma trận). Nút NÓI RÕ
    còn bao nhiêu: danh sách cụt mà im lặng là bà con tưởng mình chỉ có bấy
    nhiêu đơn. Hết thì component tự biến mất, không để nút chết. */
export function MoreButton({
  more,
  busy,
  onMore,
  what,
}: {
  more: number;
  busy: boolean;
  onMore: () => void;
  what: string;
}) {
  if (more <= 0) return null;
  return (
    <button
      type="button"
      onClick={onMore}
      disabled={busy}
      className={`${SELLER_BTN_WIDE} mt-2 bg-field text-navy`}
    >
      {busy ? "Đang tải…" : `Xem thêm ${more} ${what}`}
    </button>
  );
}

/*  Ô ĐANG SAI — viền đỏ + `aria-invalid` để bà con thấy NGAY ô nào phải sửa
    (F-25). Màu qua token, cỡ theo rem; `outline` (không phải `border`) để ô
    không nhảy chỗ khi lỗi hiện ra. */
export function invalidProps(on: boolean) {
  return on
    ? {
        "aria-invalid": true as const,
        style: { outline: "0.125rem solid var(--danger)", outlineOffset: "-0.125rem" },
      }
    : {};
}

/** Cuộn tới ô lỗi ĐẦU TIÊN rồi đặt con trỏ vào đó — bà con sửa được ngay (F-25). */
export function focusField(domId: string): void {
  const box = document.getElementById(domId);
  if (!box) return;
  box.scrollIntoView({ behavior: "smooth", block: "center" });
  box.querySelector<HTMLElement>("input, select, textarea")?.focus({ preventScroll: true });
}

/** "Gạo ST25 ×1, Dây thừng ×20" — shop biết phải soạn gì mà chưa cần mở đơn (F-15). */
export function linesSummary(lines: readonly OrderLine[], max = 3): string {
  const head = lines.slice(0, max).map((l) => `${l.title} ×${l.qty}`).join(", ");
  return lines.length > max ? `${head} và ${lines.length - max} món nữa` : head;
}
