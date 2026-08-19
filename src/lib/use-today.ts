"use client";

import { useEffect, useMemo, useState } from "react";
import { todayIsoVN } from "@/lib/days";

/*
  useTodayVN — "hôm nay" KHÔNG đóng băng (audit 2026-08-18, S1).

  Các màn có hạn (dải khẩn Trang chủ, tủ giấy tờ, sổ thuyền viên, lịch bảo
  dưỡng, đồ SDVICO) từng cầm `useMemo(() => new Date(), [])` — PWA để nguyên
  Trang chủ qua nửa đêm thì "Còn 1 ngày" vẫn treo tới lúc điều hướng. Hook này
  cầm NGÀY LỊCH VN làm state và tính lại khi app được đưa ra trước
  (`visibilitychange` visible / `focus`): đổi ngày mới re-render, không đổi thì im.

  `today` là Date đứng ở 12:00 giờ VN của ngày đó — mọi hàm trạng thái
  (`daysUntil`, `todayIsoVN`) đọc ra đúng `todayIso`, không lệch múi giờ.
*/
export function useTodayVN(): { today: Date; todayIso: string } {
  const [todayIso, setTodayIso] = useState(() => todayIsoVN());

  useEffect(() => {
    const refresh = () => {
      const next = todayIsoVN();
      setTodayIso((prev) => (prev === next ? prev : next));
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    refresh(); // sau hydrate — server và máy có thể lệch ngày quanh nửa đêm
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const today = useMemo(
    () => new Date(`${todayIso}T12:00:00+07:00`),
    [todayIso],
  );
  return { today, todayIso };
}
