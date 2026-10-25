"use client";

// VỤN NHÌN THẤY ĐƯỢC của Kênh người bán — khuôn nút, ô lỗi, tóm tắt dòng hàng.
// Tách khỏi `seller-net.tsx` (vụn MẠNG) để không kéo hook mạng + `useAuthUser`
// vào những chỗ chỉ cần một chuỗi class. Thanh đầu màn và ảnh dòng hàng dùng
// bản CHUNG của chợ: `shared/market-header.tsx`, `shared/line-thumb.tsx`.

import Link from "next/link";
import { BasketIcon } from "@/components/icons";
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

/*  CÔNG TẮC BẬT/TẮT (BH-13, 2026-10-25) — chép khuôn `role="switch"` của
    kairos/tuy-chon-sheet.tsx (không import chéo khu). Thay 4 ô `<input
    type="checkbox">` thô của kênh người bán: ô vuông tick không nói "đang
    bật/tắt" rõ dưới nắng và lệch với phần còn lại của app. Cả hàng là nút ⇒
    chạm đâu cũng gạt; `sub` là một câu nói hậu quả, không phải câu nhắc. */
export function Switch({
  label,
  sub,
  on,
  onToggle,
  disabled,
  warn,
}: {
  label: string;
  sub?: string;
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
  /** đang bật là trạng thái ĐÁNG ĐỂ Ý (vd Tạm nghỉ bán) ⇒ nền vàng khi bật */
  warn?: boolean;
}) {
  const hot = warn && on;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onToggle}
      className="flex min-h-(--row-h) w-full items-center justify-between gap-3 rounded-2xl px-4 py-2 text-left transition active:scale-[0.99] disabled:opacity-40"
      style={{ backgroundColor: hot ? "var(--warn-bg)" : "var(--field)" }}
    >
      <span className="min-w-0">
        <span className="block text-[1rem] font-semibold" style={{ color: hot ? "var(--warn)" : "var(--navy)" }}>
          {label}
        </span>
        {sub && <span className="block text-[0.875rem] leading-snug text-foreground/70">{sub}</span>}
      </span>
      <span
        aria-hidden
        className={`flex h-7 w-12 shrink-0 items-center rounded-full px-0.5 transition ${on ? "justify-end bg-ok" : "justify-start bg-line"}`}
      >
        <span className="h-6 w-6 rounded-full bg-white shadow" />
      </span>
    </button>
  );
}

/*  CHƯA CÓ GIAN HÀNG — MỘT màn cho cả 6 lối vào (BH-04, 2026-10-25). Trước đây
    4 route vẽ 4 kiểu (thẻ mời · empty+nút · băng đỏ "Thử lại" ngõ cụt · một
    dòng chữ trơ); FB chỉ có một màn "Tạo Trang". `LoadView` tự vẽ cái này khi
    route trả `no_shop`, các màn còn lại gọi thẳng khi `shop == null`. */
export function NoShop() {
  return (
    <div className="px-4 pb-10">
      <div className="surface px-5 py-6">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-t3-bg text-t3" aria-hidden>
          <BasketIcon className="h-7 w-7" />
        </span>
        <p className="display mt-3 text-[1rem] font-semibold text-navy">Mở gian hàng trên SDFish</p>
        <p className="mt-1 text-[1rem] leading-snug text-foreground/70">
          Bà con có bán máy, ngư cụ, dầu nhớt, đá… thì đăng ký shop để bán thẳng cho tàu cá cả nước.
          SDVICO duyệt trong 1–2 ngày.
        </p>
        <Link
          href="/ban-hang/dang-ky"
          className="display mt-4 flex min-h-[3.75rem] w-full items-center justify-center gap-2.5 rounded-full bg-trim text-[1rem] font-semibold text-white transition active:scale-[0.98]"
        >
          Đăng ký gian hàng
        </Link>
      </div>
    </div>
  );
}
