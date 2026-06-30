"use client";

// Hook auth dùng chung — app yêu cầu đăng nhập cho tính năng GIÁ TRỊ CAO
// (dự báo cá, nhu cầu mua cá), phần còn lại public (chốt 2026-06-10).
// Trả { user, phone, ready } — ready=false là đang kiểm tra, đừng vội khóa.

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { syncAuthScope } from "@/lib/auth-scope";

function deriveBoatPhone(u: User | null): string | null {
  return u?.phone || (u?.email ? u.email.split("@")[0] : null) || null;
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
      syncAuthScope(deriveBoatPhone(u));
      setUser(u);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!alive) return;
      const u = session?.user ?? null;
      syncAuthScope(deriveBoatPhone(u));
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
