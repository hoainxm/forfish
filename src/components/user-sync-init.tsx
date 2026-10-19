"use client";

import { useEffect } from "react";
import { syncAll } from "@/lib/user-sync";
import { readToken, TOKEN_STORE_EVENT } from "@/lib/device-token-store";

/*
  UserSyncInit — kích ĐỒNG BỘ SỔ (lib/user-sync) ở 3 mốc: mở app · có sóng lại ·
  vừa đăng nhập/đổi tài khoản. Mount ở app-shell (nhánh ngư dân), không render gì.

  syncAll() tự nuốt lỗi. KHÔNG chặn render (chạy trong effect, async).
  CHƯA CÓ CHUỖI THIẾT BỊ THÌ KHÔNG GỌI (kiểm ảnh 2026-10-19): máy khách lạ cứ
  mỗi lần mở app / có sóng lại là một cú GET /api/me/sync ăn 401 — request vô
  ích ngoài biển, lại in lỗi đỏ ở console. Đăng nhập xong `TOKEN_STORE_EVENT`
  bắn ⇒ `run` chạy với chuỗi thật.
*/
export function UserSyncInit() {
  useEffect(() => {
    const run = () => {
      if (readToken() === null) return;
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
