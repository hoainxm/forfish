"use client";

import { useEffect, useState } from "react";

/*
  Nút chuyển chế độ hiển thị (kiến trúc 2 chế độ — xem globals.css):
  · "Chữ to"  — mặc định cho ngư dân 40–60, mọi thứ to rõ như thiết kế gốc
  · "Gọn đẹp" — mật độ chuẩn app hiện đại, tỷ lệ giữ nguyên nên luôn cân đối
  Chỉ đổi data-mode trên <html> + lưu lựa chọn; toàn app viết bằng rem nên
  ăn theo ngay, không reload.
*/

const KEY = "forfish.displaymode.v1";

type Mode = "to-ro" | "gon";

export function DisplayModeToggle() {
  const [mode, setMode] = useState<Mode>("to-ro");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(KEY) === "gon") setMode("gon");
    } catch {
      // storage bị chặn — dùng mặc định
    }
    setReady(true);
  }, []);

  function apply(next: Mode) {
    setMode(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // không lưu được thì vẫn đổi cho phiên này
    }
    if (next === "gon") {
      document.documentElement.dataset.mode = "gon";
    } else {
      delete document.documentElement.dataset.mode;
    }
  }

  if (!ready) return null;

  return (
    <div
      role="group"
      aria-label="Cỡ giao diện"
      className="mt-3 inline-flex rounded-full bg-white/15 p-1 backdrop-blur-sm"
    >
      {(
        [
          { id: "to-ro", label: "Chữ to" },
          { id: "gon", label: "Gọn đẹp" },
        ] as const
      ).map((o) => {
        const on = mode === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => apply(o.id)}
            aria-pressed={on}
            className={`min-h-[2.5rem] rounded-full px-4 text-[0.9375rem] font-bold transition ${
              on ? "bg-white text-navy" : "text-white/80"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
