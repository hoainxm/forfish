"use client";

// Hook auth dùng chung — app yêu cầu đăng nhập cho tính năng GIÁ TRỊ CAO
// (dự báo cá, nhu cầu mua cá), phần còn lại public (chốt 2026-06-10).
// Trả { user, phone, ready } — ready=false là đang kiểm tra, đừng vội khóa.

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { isNetworkAuthError } from "@/lib/auth-error";

export function useAuthUser(): {
  user: User | null;
  /** SĐT (suy từ email ảo) — null khi chưa đăng nhập */
  phone: string | null;
  ready: boolean;
  /** getUser() KHÔNG tra được (reject/timeout — mất sóng "sống mà chết"), khác
   *  với tra ĐƯỢC mà không có user (đăng xuất thật). Để tier còn cho premium đã
   *  tải sẵn xem tiếp thay vì bắt đăng nhập lại. */
  errored: boolean;
} {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setReady(true);
      return;
    }
    let alive = true;

    // BẮT BUỘC RESOLVE: getUser() cần mạng. Ngoài khơi sóng CHẬP CHỜN (kết nối
    // "sống mà chết" — navigator.onLine vẫn true) thì lời hứa này có thể TREO
    // hoặc reject. Trước đây không có .catch/timeout → `ready` kẹt false mãi →
    // featureAccessDecision trả "checking" mãi → LỚP CÁ QUAY HOÀI KHÔNG RA
    // (2026-07-29). Nay: catch + đồng hồ chặn 8s để `ready` LUÔN bật, rồi tier
    // tự lo nấc offline-premium (đã trả tiền + có bản tải sẵn thì cho xem).
    const settle = () => {
      if (alive) setReady(true);
    };
    // đồng hồ chặn: getUser() treo quá 8s coi như không tra được (errored) →
    // ready vẫn bật, tier lo nấc offline-premium
    const timer = setTimeout(() => {
      if (alive) setErrored(true);
      settle();
    }, 8000);
    supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (!alive) return;
        // LỖI ĐÃ SỬA (2026-08-01): getUser() KHÔNG reject khi mất sóng — auth-js
        // RESOLVE kèm `error` (AuthRetryableFetchError). Bản trước chỉ bóc
        // `data` nên `.catch` không bao giờ nổ, `errored` không bao giờ bật, và
        // lỗi mạng đội lốt ĐĂNG XUẤT THẬT ⇒ use-tier xoá dấu premium giữa biển.
        // Đồng hồ 8s chỉ đỡ được ca TREO, không đỡ ca hỏng NHANH (DNS chết,
        // ENETUNREACH, 502/503/504) — mà ngoài khơi ca đó mới là ca thường.
        if (error && isNetworkAuthError(error)) {
          setErrored(true);
          return; // GIỮ user cũ, đừng hạ xuống null
        }
        setUser(data?.user ?? null);
      })
      .catch(() => {
        /* mất sóng / auth không tra được — đánh dấu errored, KHÔNG kẹt */
        if (alive) setErrored(true);
      })
      .finally(() => {
        clearTimeout(timer);
        settle();
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (alive) setUser(session?.user ?? null);
    });
    return () => {
      alive = false;
      clearTimeout(timer);
      sub.subscription.unsubscribe();
    };
  }, []);

  const phone =
    user?.phone || (user?.email ? user.email.split("@")[0] : null) || null;

  return { user, phone, ready, errored };
}
