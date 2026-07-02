"use client";

// Hook auth dùng chung — app yêu cầu đăng nhập cho tính năng GIÁ TRỊ CAO
// (dự báo cá, nhu cầu mua cá), phần còn lại public (chốt 2026-06-10).
// Trả { user, phone, ready } — ready=false là đang kiểm tra, đừng vội khóa.

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { clearUserScopedData, syncAuthScope } from "@/lib/auth-scope";

function deriveBoatPhone(u: User | null): string | null {
  return u?.phone || (u?.email ? u.email.split("@")[0] : null) || null;
}

/**
 * Đồng bộ scope + RESET RAM. syncAuthScope chỉ xoá localStorage — state React
 * đang mount (useBoats, useCrew, sổ nợ...) vẫn cầm data của user cũ, user sửa
 * tiếp là effect ghi NGƯỢC data cũ vào máy (báo lỗi: đăng xuất xong vẫn sửa
 * được thông tin tàu của tài khoản cũ). Cách chắc chắn duy nhất reset MỌI
 * state trong RAM là reload trang. Chỉ chạy khi có xoá thật (đổi user/logout)
 * — token refresh, đổi mật khẩu cùng user trả false → không reload, không loop.
 *
 * pagehide xoá LẦN CUỐI: giữa lúc clear và lúc reload thật sự, save-effect
 * của hook đang mount kịp ghi data cũ trở lại (React commit lần 2 sau hydrate
 * — bắt được bằng preview khi vá). Xoá lại ngay trước unload thì trang mới
 * luôn mở với storage sạch.
 */
function syncScopeAndResetRam(phone: string | null) {
  if (syncAuthScope(phone)) {
    window.addEventListener("pagehide", () => clearUserScopedData(), {
      once: true,
    });
    window.location.reload();
  }
}

export function useAuthUser(): {
  user: User | null;
  /** SĐT (suy từ email ảo) — null khi chưa đăng nhập */
  phone: string | null;
  ready: boolean;
} {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setReady(true);
      return;
    }
    let alive = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      const u = data?.user ?? null;
      syncScopeAndResetRam(deriveBoatPhone(u));
      setUser(u);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!alive) return;
      const u = session?.user ?? null;
      syncScopeAndResetRam(deriveBoatPhone(u));
      setUser(u);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const phone = deriveBoatPhone(user);

  return { user, phone, ready };
}
