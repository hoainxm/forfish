import { CloseIcon } from "@/components/icons";

/*
  NÚT X ĐÓNG — MỘT KHUÔN DUY NHẤT CHO CẢ APP (chốt 2026-08-29 sau khảo sát
  design system: Apple HIG · Material 3 · Polaris · Carbon · WCAG 2.5.x).

  Vì sao có file này: trước đây mỗi panel tự chế nút X → cỡ lệch nhau (chỗ
  chạm 56px + icon 24px, chỗ 32px + ký tự `✕` thô). Chủ dự án 2026-08-29:
  *"kích thước cái x đóng làm cho đồng bộ"*. Từ nay MỌI nút X-đóng-góc import
  cái này — CẤM tự chế, CẤM ký tự `✕`/`×` thô (không design system nào dùng;
  glyph vẽ nét scale sắc + cân baseline).

  Chuẩn (MỘT cỡ cho mọi control hàng header — ‹ · × · icon · avatar — VO-APP-07,
  QUYET-DINH L 2026-10-25; trước 56px, nay theo 03 §6 mục 5 "X đóng/icon-only =
  control 2.75rem", 44px đủ WCAG AAA và khớp FB):
  · vùng chạm 2.75rem (h-11 w-11) — bằng --h-ctl
  · glyph icon 1.5rem (h-6 w-6) — cỡ X đồng nhất mọi nơi
  · nền TRONG SUỐT lúc nghỉ (không "boxy"), chỉ hiện `bg-field` lúc bấm
  · luôn ở góc trên-phải của panel/sheet (bên gọi tự đặt trong flex)

  Chỉ dùng cho panel ĐỌC-XEM / auto-apply (đóng không mất dữ liệu). Form có
  dữ liệu nhập → KHÔNG dùng X, dùng cặp Huỷ/Lưu ở đáy (xem 03-design-system).

  KIỂU `goc` (2026-10-17, chủ dự án: "nút × là cái nhỏ ở góc trên phải sát góc, bé
  xíu chiếm một ô nhỏ nhất để có thể click được" — chê × nằm ngang hàng nút):
  cho THẺ NỔI nhỏ trên bản đồ. Chấm tròn 28px nền đậm ĐÈ góc trên-phải thẻ (bên
  gọi đặt thẻ `relative`/`absolute`), vùng chạm 44px quanh chấm (WCAG AAA) — chủ
  dự án chốt nhỏ hơn sàn 56px RIÊNG cho nút đóng góc. Không chiếm chỗ trong hàng.
*/
export function CloseButton({
  onClose,
  label = "Đóng",
  className = "",
  variant = "hang",
}: {
  onClose: () => void;
  /** `hang` (mặc định): X trong hàng tiêu đề panel · `goc`: chấm nhỏ đè góc thẻ nổi */
  variant?: "hang" | "goc";
  /** aria-label — mặc định "Đóng"; đặt riêng khi cần tả rõ (vd "Đóng thông tin chặng") */
  label?: string;
  className?: string;
}) {
  if (variant === "goc") {
    return (
      <button
        type="button"
        onClick={onClose}
        aria-label={label}
        className={`group absolute -right-3 -top-3 z-10 flex h-11 w-11 items-center justify-center ${className}`}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-navy text-white shadow-md transition group-active:scale-[0.97]">
          <CloseIcon className="h-4 w-4" />
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label={label}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground/50 transition active:bg-field ${className}`}
    >
      <CloseIcon className="h-6 w-6" />
    </button>
  );
}
