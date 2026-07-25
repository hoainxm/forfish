"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { CoachTour } from "@/components/ui/coach-tour";
import { HelpIcon } from "@/components/icons";
import {
  loadSeen,
  loadTourEnabled,
  markSeen,
  runnableSteps,
  setTourEnabled,
  tourForPath,
  TOUR_ENABLED_EVENT,
  type TourStep,
} from "@/lib/tour";

/*
  Nút "Hướng dẫn" + tự chạy lần đầu.

  Mount MỘT LẦN trong layout → mọi màn đều có, không phải sửa từng page.
  · Lần đầu mở một màn: tự bật hướng dẫn của màn đó (bà con ít khi tự bấm
    dấu hỏi — không tự chạy thì gần như không ai xem).
  · Xem xong hoặc bỏ qua: ghi "đã xem" vào localStorage, lần sau im lặng.
  · Nút nổi góc trái dưới (mép phải màn Ra khơi đã có rail 6 nút) — luôn
    gọi lại được bất cứ lúc nào. Màn không có gì để chỉ (cổng đăng nhập che
    hết) thì ẩn luôn nút, không bày nút bấm vào chẳng ra gì.

  Đo NHIỀU LẦN (không phải một lần ở 900ms): trang cần hydrate + component tự
  nạp localStorage + bản đồ/ảnh nạp chậm trên máy yếu. Đo một lần mà DOM chưa
  có nút thì `available` kẹt false MÃI (effect không chạy lại) → nút "Hướng
  dẫn" biến mất hẳn trên điện thoại thật (đúng lỗi bà con báo "nhiều nơi không
  thấy"). Thử lại tăng dần tới ~4.5s, thấy nút thì dừng.
*/
const PROBE_DELAYS_MS = [300, 900, 1800, 3000, 4500];

export function TourLauncher() {
  const pathname = usePathname();
  const tour = tourForPath(pathname);
  const [steps, setSteps] = useState<TourStep[] | null>(null);
  const [available, setAvailable] = useState(false);
  // Công tắc tổng (sheet Tài khoản). Mặc định bật; đọc thật + lắng nghe đổi
  // ngay trong tab để tắt/bật là nút biến mất/hiện lại tức thì.
  const [enabled, setEnabled] = useState(true);
  useEffect(() => {
    const sync = () => setEnabled(loadTourEnabled());
    sync();
    window.addEventListener(TOUR_ENABLED_EVENT, sync);
    return () => window.removeEventListener(TOUR_ENABLED_EVENT, sync);
  }, []);

  const pick = useCallback(
    () =>
      tour
        ? runnableSteps(tour, (t) => !!document.querySelector(`[data-tour="${t}"]`))
        : [],
    [tour],
  );

  const open = useCallback(() => {
    const s = pick();
    if (s.length) setSteps(s);
  }, [pick]);

  const close = useCallback(() => {
    if (tour) markSeen(tour.id);
    setSteps(null);
  }, [tour]);

  // đổi màn / bật-tắt → đóng hướng dẫn cũ, đo lại xem có gì để chỉ, cân nhắc tự chạy
  useEffect(() => {
    setSteps(null);
    setAvailable(false);
    if (!tour || !enabled) return; // tắt công tắc = không nút, không tự chạy
    const daXem = loadSeen().includes(tour.id);
    let found = false;
    const timers: number[] = [];
    const check = () => {
      if (found) return;
      const s = runnableSteps(tour, (x) => !!document.querySelector(`[data-tour="${x}"]`));
      if (!s.length) return; // DOM chưa sẵn sàng → để lần đo sau thử lại
      found = true;
      timers.forEach((t) => window.clearTimeout(t)); // thấy rồi thì thôi đo tiếp
      setAvailable(true);
      if (!daXem) setSteps(s); // tự chạy MỘT lần, chỉ ở lần đo thành công đầu
    };
    PROBE_DELAYS_MS.forEach((d) => timers.push(window.setTimeout(check, d)));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [tour, enabled]);

  if (!tour || !available || !enabled) return null;

  // Màn Ra khơi là bản đồ toàn màn: đáy đã có sheet gió sóng (nút nổi ở đáy
  // che mất dòng "Sóng … · Gió cấp …"), mép phải đã có rail 6 nút → nút
  // hướng dẫn lên mép TRÁI TRÊN, ngang hàng rail, dưới dải tin bão.
  const onMap = pathname.startsWith("/ngu-truong");

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="fixed z-30 flex min-h-[3rem] items-center gap-1.5 rounded-full bg-card px-3.5 text-[1rem] font-bold text-navy shadow-[0_8px_20px_-6px_rgba(10,30,50,0.5)] active:scale-[0.97]"
        style={{
          // Bám mép TRÁI cột app 480px, không dính mép viewport: mobile ≤480
          // vẫn = 12px như cũ; màn rộng/tablet thì nút theo cột (trước: nút
          // trôi ra lề xám, tách khỏi app — nhìn như hỏng).
          left: "max(0.75rem, calc(50% - 240px + 0.75rem))",
          ...(onMap
            ? { top: "calc(env(safe-area-inset-top) + 5.5rem)" }
            : { bottom: "calc(env(safe-area-inset-bottom) + 5.75rem)" }),
        }}
      >
        <HelpIcon className="h-5 w-5" />
        Hướng dẫn
      </button>

      {steps && (
        <CoachTour
          steps={steps}
          screen={tour.label}
          onClose={close}
          onDisable={() => setTourEnabled(false)}
        />
      )}
    </>
  );
}
