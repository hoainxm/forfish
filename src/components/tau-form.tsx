"use client";

/*
  LỖI NHẬP LIỆU MỘT KHUÔN cho các form khu Tàu tôi (BoatForm, DocumentForm,
  MaintenanceForm, CrewForm) — rà FB 2026-10-25 (TAU-03): trước đây ba kiểu lỗi
  (bong bóng tiếng Anh của trình duyệt qua `required`/`min`, câu đỏ ở chân sheet
  cách ô sai 300px, và câu dưới ô). Nay chỉ còn kiểu thứ ba — theo đúng khuôn
  `NumField` của BoatForm đã làm đúng: viền đỏ + câu đỏ NGAY DƯỚI ô, cuộn tới ô
  đầu sai, gõ lại là lỗi tự xoá. `<form noValidate>` để trình duyệt im.
  Làm tại chỗ, KHÔNG sửa `ui/primitives.tsx` (khu khác đang sửa).
*/

/** Thêm vào className của ô đang sai (viền đỏ). */
export const O_LOI = "ring-2 ring-danger";

/** Câu lỗi đỏ ngay dưới ô — đặt NGAY SAU input trong `Field`. */
export function LoiO({ children }: { children: string }) {
  return (
    <span role="alert" className="mt-1 block text-[0.875rem] font-semibold leading-snug text-danger">
      {children}
    </span>
  );
}

/**
 * Cuộn tới + đặt con trỏ vào Ô ĐẦU TIÊN đang sai (`aria-invalid="true"`). Gọi
 * ngay sau `setErrors(...)` — chờ một khung hình để React vẽ xong thuộc tính.
 */
export function cuonToiOSai(form: HTMLFormElement | null) {
  if (!form || typeof requestAnimationFrame === "undefined") return;
  requestAnimationFrame(() => {
    const el = form.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (!el) return;
    el.scrollIntoView?.({ block: "center", behavior: "smooth" });
    el.focus({ preventScroll: true });
  });
}
