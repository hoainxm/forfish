"use client";

// Hook auth dùng chung — app yêu cầu đăng nhập cho tính năng GIÁ TRỊ CAO
// (dự báo cá, nhu cầu mua cá), phần còn lại public (chốt 2026-06-10).
// Trả { user, phone, ready } — ready=false là đang kiểm tra, đừng vội khóa.

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

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
      setUser(data?.user ?? null);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (alive) setUser(session?.user ?? null);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const phone =
    user?.phone || (user?.email ? user.email.split("@")[0] : null) || null;

  return { user, phone, ready };
}
