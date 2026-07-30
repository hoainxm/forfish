"use client";

// Hook auth dùng chung — app yêu cầu đăng nhập cho tính năng GIÁ TRỊ CAO
// (dự báo cá, nhu cầu mua cá), phần còn lại public (chốt 2026-06-10).
// Trả { user, phone, ready } — ready=false là đang kiểm tra, đừng vội khóa.

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  clearUserScopedData,
  shouldReloadForScope,
  syncAuthScope,
} from "@/lib/auth-scope";

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
  if (!syncAuthScope(phone)) return;
  // syncAuthScope đã xoá data KH (chống rò rỉ). Reset RAM = reload, nhưng qua
  // circuit-breaker: nếu auth state đang đảo qua lại (user ↔ null) thì KHÔNG
  // reload lại trong tích tắc → chặn vòng lặp nhấp nháy tải trang vô hạn.
  if (!shouldReloadForScope(Date.now())) return;
  window.addEventListener("pagehide", () => clearUserScopedData(), {
    once: true,
  });
  window.location.reload();
}

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
      .then(({ data }) => {
        if (!alive) return;
        const u = data?.user ?? null;
        // GIỮ chống-rò chéo user (origin): reset scope + RAM khi đổi user/logout
        syncScopeAndResetRam(deriveBoatPhone(u));
        setUser(u);
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
      if (!alive) return;
      const u = session?.user ?? null;
      syncScopeAndResetRam(deriveBoatPhone(u));
      setUser(u);
    });
    return () => {
      alive = false;
      clearTimeout(timer);
      sub.subscription.unsubscribe();
    };
  }, []);

  const phone = deriveBoatPhone(user);

  return { user, phone, ready, errored };
}
