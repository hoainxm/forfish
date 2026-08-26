"use client";

import { useEffect } from "react";
import { syncAll } from "@/lib/user-sync";
import { TOKEN_STORE_EVENT } from "@/lib/device-token-store";

/*
  UserSyncInit — kích ĐỒNG BỘ SỔ (lib/user-sync) ở 3 mốc: mở app · có sóng lại ·
  vừa đăng nhập/đổi tài khoản. Mount ở app-shell (nhánh ngư dân), không render gì.

  syncAll() tự nuốt lỗi + chỉ chạy khi đã đăng nhập (chưa đăng nhập → route 401 →
  authedFetch trả về sớm, không hại). KHÔNG chặn render (chạy trong effect, async).
*/
export function UserSyncInit() {
  useEffect(() => {
    const run = () => {
      void syncAll();
    };
    run(); // mở app
    window.addEventListener("online", run);
    window.addEventListener(TOKEN_STORE_EVENT, run); // đăng nhập / đổi tài khoản
    return () => {
      window.removeEventListener("online", run);
      window.removeEventListener(TOKEN_STORE_EVENT, run);
    };
  }, []);

  return null;
}
