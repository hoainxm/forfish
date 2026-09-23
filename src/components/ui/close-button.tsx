import { CloseIcon } from "@/components/icons";

/*
  NÚT X ĐÓNG — MỘT KHUÔN DUY NHẤT CHO CẢ APP (chốt 2026-08-29 sau khảo sát
  design system: Apple HIG · Material 3 · Polaris · Carbon · WCAG 2.5.x).

  Vì sao có file này: trước đây mỗi panel tự chế nút X → cỡ lệch nhau (chỗ
  chạm 56px + icon 24px, chỗ 32px + ký tự `✕` thô). Chủ dự án 2026-08-29:
  *"kích thước cái x đóng làm cho đồng bộ"*. Từ nay MỌI nút X-đóng-góc import
  cái này — CẤM tự chế, CẤM ký tự `✕`/`×` thô (không design system nào dùng;
  glyph vẽ nét scale sắc + cân baseline).

  Chuẩn (khớp sàn tap dự án + Material 48dp, WCAG AAA 44px — ForFish nhỉnh hơn
  vì tay ướt/găng, tàu lắc, nắng chói):
  · vùng chạm 56×56px (h-14 w-14) — sàn tuyệt đối của app
  · glyph icon 24px (h-6 w-6) — cỡ X đồng nhất mọi nơi
  · nền TRONG SUỐT lúc nghỉ (không "boxy"), chỉ hiện `bg-field` lúc bấm
  · `-m-1` để vùng chạm 56px KHÔNG phình layout của header nhỏ gọn
  · luôn ở góc trên-phải của panel/sheet (bên gọi tự đặt trong flex)

  Chỉ dùng cho panel ĐỌC-XEM / auto-apply (đóng không mất dữ liệu). Form có
  dữ liệu nhập → KHÔNG dùng X, dùng cặp Huỷ/Lưu ở đáy (xem 03-design-system).
*/
export function CloseButton({
  onClose,
  label = "Đóng",
  className = "",
}: {
  onClose: () => void;
  /** aria-label — mặc định "Đóng"; đặt riêng khi cần tả rõ (vd "Đóng thông tin chặng") */
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label={label}
      className={`-m-1 flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-foreground/50 transition active:bg-field ${className}`}
    >
      <CloseIcon className="h-6 w-6" />
    </button>
  );
}
