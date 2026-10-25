/*
  BIỂU TƯỢNG KAIROS — hai con cá lướt về phía trước + chấm cam (Codex vẽ 2026-10-25, bàn giao
  `kairos-motion/`). Ảnh PNG nền trong suốt trong máy (`/icons/kairos-fish.png`, 384×156, 14 KB —
  đã cắt lề + thu từ bản gốc 1774×887; KHÔNG dùng CDN). Một nguồn ảnh cho cả dock lẫn đầu màn
  /kairos và hàng "Đang tải tin" — đổi ảnh thì đổi MỘT chỗ.

  BẢN DOCK (2026-10-25, QUYET-DINH A / K3-08): `/icons/kairos-fish-dock.png` (356×156, ~10 KB) = cùng bản gốc
  nhưng XOÁ chấm cam (scripts: sharp xoá pixel cam vùng góc trên-phải rồi trim) — ở dock "có mới" là badge số
  thật, chấm vẽ cố định là nói dối thường trực. Đầu màn /kairos + hàng "Đang tải tin" giữ ảnh đủ (logo).

  Chuyển động (03 §Chuyển động, 14 §3.2): `vao` = cá lướt vào 340 ms lúc mở màn (`.anim-ca-vao`);
  `boi` = trôi nhẹ theo nhịp sóng 1,5 s CHỈ khi thật sự chờ dữ liệu (`.anim-ca-boi`); mất sóng /
  lỗi / đã có bài ⇒ không có hàng chờ nên cá đứng yên. Giảm chuyển động: globals.css tắt `boi`,
  `vao` thành mờ dần ngắn. Icon là trang trí (alt rỗng) — tên mục/màn đã ở chữ hoặc aria-label.
*/
export function KairosFishIcon({
  className = "",
  anim,
  bien,
}: {
  className?: string;
  /** dock = ảnh không chấm cam (badge số lo phần "có mới") */
  bien?: "dock";
  /** vao = lướt vào một lần (mở màn) · boi = trôi theo nhịp (đang chờ dữ liệu) */
  anim?: "vao" | "boi";
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- ảnh tĩnh trong máy, cỡ cố định theo rem
    <img
      src={bien === "dock" ? "/icons/kairos-fish-dock.png" : "/icons/kairos-fish.png"}
      alt=""
      draggable={false}
      aria-hidden
      className={`select-none object-contain ${anim === "vao" ? "anim-ca-vao" : anim === "boi" ? "anim-ca-boi" : ""} ${className}`}
    />
  );
}
