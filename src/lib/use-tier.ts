"use client";

// Hook truy cập tính năng PREMIUM (dự báo cá, thời tiết quá 3 ngày).
// Đọc hạng của CHÍNH MÌNH từ customers (RLS own-phone, 0002) — cột tier +
// premium_until (0003). Bảng/cột chưa có (migration chưa apply) hay lỗi mạng
// → coi là 'basic' (fail-closed, khớp resolveTier).

import { useEffect, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/use-auth";
import { resolveTier, type FeatureAccess } from "@/lib/tier";

export function useFeatureAccess(): { access: FeatureAccess; ready: boolean } {
  const { user, ready: authReady } = useAuthUser();
  // null = chưa tra xong hạng (chỉ có nghĩa khi đã đăng nhập)
  const [premium, setPremium] = useState<boolean | null>(null);

  useEffect(() => {
    if (!authReady || !user) return;
    const supabase = createClient();
    if (!supabase) return;
    let alive = true;
    setPremium(null);
    supabase
      .from("customers")
      .select("tier, premium_until")
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        setPremium(
          !error &&
            resolveTier(data?.tier, data?.premium_until, Date.now()) ===
              "premium",
        );
      });
    return () => {
      alive = false;
    };
  }, [authReady, user]);

  // Demo mode (chưa cấu hình Supabase): mở hết — cùng nếp fishLocked cũ.
  if (!isSupabaseConfigured()) return { access: "open", ready: true };
  if (!authReady) return { access: "checking", ready: false };
  if (!user) return { access: "login", ready: true };
  if (premium == null) return { access: "checking", ready: false };
  return { access: premium ? "open" : "upgrade", ready: true };
}
