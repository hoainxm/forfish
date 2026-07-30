"use client";

/**
 * NHẮC CÀI VỀ MÁY — để offline chạy đáng tin trên WEB.
 *
 * Vì sao: mở app trong TAB trình duyệt thì cache có thể bị dọn khi máy đầy, và
 * iOS Safari xoá SẠCH storage sau ~7 ngày không dùng NẾU chưa "Thêm vào màn hình
 * chính" — chuyến biển 5–16 ngày sẽ mất dữ liệu giữa chuyến. Cài về máy = thoát
 * cả hai. Đây là cách DUY NHẤT vượt giới hạn 7 ngày của iOS (không có API).
 *
 * Ẩn khi: đã cài (standalone) · đã tắt nhắc · trình duyệt không cho cài
 * (desktop không có beforeinstallprompt, không phải iOS). Không nài — tắt là nhớ.
 */

import { useEffect, useRef, useState } from "react";

import { isStandalone, isIOS } from "@/lib/storage-persist";
import { AnchorIcon, CloseIcon } from "@/components/icons";

const DISMISS_KEY = "forfish.installNudge.dismissed.v1";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallBanner() {
  const [mode, setMode] = useState<"android" | "ios" | null>(null);
  const deferred = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone()) return; // đã cài rồi → thôi
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return; // đã tắt nhắc
    } catch {
      // không đọc được localStorage — cứ để nhắc
    }

    // iOS Safari: KHÔNG có beforeinstallprompt → hướng dẫn tay
    if (isIOS()) {
      setMode("ios");
      return;
    }

    // Android/Chrome: chờ trình duyệt cho phép cài
    const onBIP = (e: Event) => {
      e.preventDefault(); // giữ sự kiện để tự bung khi bà con bấm
      deferred.current = e as BeforeInstallPromptEvent;
      setMode("android");
    };
    const onInstalled = () => setMode(null);
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!mode) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // storage đầy/chặn — vẫn ẩn phiên này
    }
    setMode(null);
  };

  const install = async () => {
    const d = deferred.current;
    if (!d) return;
    try {
      await d.prompt();
      await d.userChoice;
    } catch {
      // bà con huỷ / lỗi — không sao
    }
    deferred.current = null;
    setMode(null); // cài hay không, phiên này không nhắc lại
  };

  return (
    <div className="surface flex gap-3 p-4">
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-t1-bg text-t1"
        aria-hidden
      >
        <AnchorIcon className="h-6 w-6" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="display text-[1.0625rem] font-bold leading-tight text-navy">
          Cài SDFish về máy
        </p>
        <p className="mt-1 text-[0.9375rem] leading-snug text-foreground/70">
          Cài về màn hình chính thì ra khơi mất sóng vẫn mở được, và máy giữ dự
          báo lâu hơn — không tự xoá sau ít ngày.
        </p>

        {mode === "ios" ? (
          <p className="mt-2 rounded-xl bg-background p-3 text-[0.9375rem] font-semibold leading-snug text-navy">
            Trên iPhone: bấm nút <span className="font-bold">Chia sẻ</span> ở thanh
            dưới trình duyệt, rồi chọn{" "}
            <span className="font-bold">“Thêm vào Màn hình chính”</span>.
          </p>
        ) : (
          <button
            type="button"
            onClick={install}
            className="mt-2 flex min-h-[3.25rem] w-full items-center justify-center rounded-xl bg-t1 text-[1.0625rem] font-bold text-white transition active:scale-[0.99]"
          >
            Cài về máy
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Ẩn nhắc cài về máy"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground/50 transition active:bg-background"
      >
        <CloseIcon className="h-5 w-5" />
      </button>
    </div>
  );
}
