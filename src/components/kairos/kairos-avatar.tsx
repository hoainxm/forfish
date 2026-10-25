/*
  ẢNH ĐẠI DIỆN KAIROS (14 §3.7, AC12): ảnh tự chọn nếu có, không thì CHỮ CÁI ĐẦU trắng trên nền
  `--kairos-av-1..6` chọn theo băm id (ổn định — cùng người luôn cùng màu). Bản lưu mất sóng
  bỏ ảnh (cache.ts) ⇒ tự về chữ cái, không ô vỡ.
*/
import { avatarLetter, avatarTone } from "@/lib/kairos/feed-client";

export function KairosAvatar({
  id,
  name,
  url,
  small = false,
  nav = false,
  large = false,
  xl = false,
  className = "",
}: {
  id: string;
  name: string;
  url: string | null;
  small?: boolean;
  /** nút "Trang tôi" góc phải đầu màn (2.75rem = cỡ control, K3-09) */
  nav?: boolean;
  /** sheet Tên trên Kairos */
  large?: boolean;
  /** đầu trang người dùng — tròn đè mép dưới ảnh bìa (kiểu Facebook) */
  xl?: boolean;
  /** thêm lớp (viền tách nền ảnh bìa) */
  className?: string;
}) {
  const size = xl
    ? "h-24 w-24 text-[2.5rem]"
    : large
      ? "h-20 w-20 text-[2rem]"
      : nav
        ? "h-11 w-11 text-[1.125rem]"
        : small
          ? "h-8 w-8 text-[0.875rem]"
          : "h-10 w-10 text-[1rem]";
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- ảnh kho kairos-media đã nén
    return <img src={url} alt="" loading="lazy" className={`${size} shrink-0 rounded-full bg-field object-cover ${className}`} />;
  }
  return (
    <span
      aria-hidden
      className={`${size} flex shrink-0 items-center justify-center rounded-full font-bold text-white ${className}`}
      style={{ backgroundColor: `var(--kairos-av-${avatarTone(id)})` }}
    >
      {avatarLetter(name)}
    </span>
  );
}
