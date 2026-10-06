"use client";

import { useEffect, useState } from "react";
import {
  fetchVapidPublicKey,
  getExistingPushSubscription,
  isPushSupported,
  subscribeToPush,
  syncPushAccount,
} from "@/lib/push-client";
import { useOnline } from "@/lib/use-online";
import { BellIcon } from "@/components/icons";
import { SQ_BTN } from "@/components/ui/sq-btn";

/*
  MỜI BẬT CHUÔNG NHẮC HẠN — ngay ở tab Giấy tờ (2026-10-06).

  Cron /api/cron/notify-docs mỗi sáng đẩy thông báo khi giấy tới mốc 30/15/7/3/1/0
  ngày, nhưng điện thoại CHỈ reo nếu máy đã bật thông báo. Đo prod cùng ngày: 6
  chủ tàu có giấy tới mốc, 0 người bật thông báo — nút bật cũ nằm sâu trong sheet
  Tài khoản, không ai tìm tới. Đặt lời mời ở đúng chỗ bà con vừa nhập ngày hết hạn.

  Tầng 5 "mời gọi" (07 §12): một hàng, CHỈ hiện khi chưa bật + có giấy có hạn,
  ẨN khi mất sóng (bật cần mạng), ẩn khi máy không hỗ trợ (iPhone chưa cài app ra
  màn hình chính, app bọc native) hoặc máy chủ chưa có khoá VAPID. Bật xong nói
  một câu inline rồi thôi. KHÔNG request nào khi mất sóng; có sóng thì một lần đọc
  khoá VAPID (có hết giờ 8s trong fetchVapidPublicKey).
*/
type State = "checking" | "off" | "busy" | "done" | "hidden";

export function DocReminderBell({ hasExpiring }: { hasExpiring: boolean }) {
  const online = useOnline();
  const [state, setState] = useState<State>("checking");
  const [key, setKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasExpiring || !online || !isPushSupported()) return;
    let alive = true;
    void (async () => {
      const sub = await getExistingPushSubscription();
      if (!alive) return;
      if (sub) return setState("hidden");
      const k = await fetchVapidPublicKey();
      if (!alive) return;
      setKey(k);
      setState(k ? "off" : "hidden");
    })();
    return () => {
      alive = false;
    };
  }, [hasExpiring, online]);

  if (!hasExpiring || !online) return null;
  if (state === "checking" || state === "hidden") return null;

  if (state === "done") {
    return (
      <p role="status" className="mb-4 rounded-2xl bg-ok-bg px-4 py-3 text-[1rem] font-bold leading-snug text-ok">
        Đã bật chuông — điện thoại sẽ báo khi giấy còn 30, 15, 7, 3, 1 ngày và đúng
        hôm hết hạn.
      </p>
    );
  }

  async function enable() {
    if (!key) return;
    setError(null);
    setState("busy");
    const r = await subscribeToPush(key);
    if (r.ok) {
      // gắn máy vào tài khoản NGAY — cron nhắm theo SĐT, máy ẩn danh không nhận
      void syncPushAccount();
      setState("done");
      return;
    }
    setState("off");
    setError(
      r.error === "denied"
        ? "Máy đang chặn thông báo — bà con vào cài đặt của máy, cho phép SDFish báo tin rồi bấm lại nhé."
        : "Chưa bật được — bà con kiểm tra sóng rồi bấm lại nhé.",
    );
  }

  return (
    <>
      <div className="mb-4 flex items-stretch gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-background px-4 py-3">
          <BellIcon className="h-6 w-6 shrink-0 text-navy" />
          <p className="text-[1rem] leading-snug text-foreground/80">
            <span className="font-bold text-navy">Bật chuông nhắc hạn</span> để điện
            thoại reo trước khi giấy hết hạn.
          </p>
        </div>
        <button
          type="button"
          onClick={enable}
          disabled={state === "busy"}
          className={`${SQ_BTN} bg-trim text-white shadow-trim-cta disabled:opacity-60`}
        >
          <BellIcon className="h-6 w-6" />
          {state === "busy" ? "Đang bật" : "Bật"}
        </button>
      </div>
      {error && (
        <p role="alert" className="-mt-2.5 mb-4 px-1 text-[1rem] font-semibold leading-snug text-danger">
          {error}
        </p>
      )}
    </>
  );
}
