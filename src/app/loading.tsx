/*
  PHẢN HỒI NGAY KHI CHẠM DOCK (rà tốc độ 2026-10-29). Không route nào có `loading.tsx` nên
  trên 3G chạm một ô dock là màn hình đứng im tới 4,8 s rồi mới nhảy — bà con tưởng chưa
  bấm trúng, bấm lại. Next tự bọc mọi trang trong Suspense với fallback này: chuyển route là
  hiện ngay câu "Đang mở…" (cùng câu với RequireLogin, để hai bước chờ trông như một).

  Server component, không JS, không request — mất sóng vẫn hiện. `role="status"` cho trình
  đọc màn hình đọc lên.
*/
export default function Loading() {
  return (
    <p
      role="status"
      className="mt-10 text-center text-[1.125rem] font-semibold text-foreground/70"
    >
      Đang mở…
    </p>
  );
}
