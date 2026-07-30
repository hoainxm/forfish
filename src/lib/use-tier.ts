"use client";

// Hook truy cập tính năng PREMIUM (dự báo cá, thời tiết quá 3 ngày).
// Đọc hạng của CHÍNH MÌNH từ customers (RLS own-phone, 0002) — cột tier +
// premium_until (0003). Bảng/cột chưa có (migration chưa apply) hay lỗi mạng
// → coi là 'basic' (fail-closed, khớp resolveTier).
//
// MẤT SÓNG NGOÀI KHƠI: getUser() + tra hạng đều cần mạng → offline coi bà con
// như đăng xuất, premium đã trả tiền mất bản đồ cá đã tải sẵn ở bờ. Nay ghi
// "dấu premium" vào máy mỗi lần tra ĐƯỢC lúc còn sóng; mất sóng thì lùi về dấu
// đó (quyết định thuần ở featureAccessDecision). KHÔNG phải bypass — chốt thật
// vẫn ở middleware/RLS khi có mạng.

import { useEffect, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/use-auth";
import { featureAccessDecision, resolveTier, type FeatureAccess } from "@/lib/tier";

/** Dấu "phiên gần nhất là premium" — quy ước key forfish.* */
export const TIER_CACHE_KEY = "forfish.tier.premium.v1";

function readCachedPremium(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(TIER_CACHE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCachedPremium(premium: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TIER_CACHE_KEY, premium ? "1" : "0");
  } catch {
    /* hết chỗ / chế độ riêng tư — bỏ qua */
  }
}

function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine !== false;
}

export function useFeatureAccess(): { access: FeatureAccess; ready: boolean } {
  const { user, ready: authReady, errored: authErrored } = useAuthUser();
  // null = chưa tra xong hạng (chỉ có nghĩa khi đã đăng nhập + có sóng)
  const [premium, setPremium] = useState<boolean | null>(null);
  const [cachedPremium, setCachedPremium] = useState(false);
  const [online, setOnline] = useState(true);

  // đọc dấu premium đã lưu (client-only)
  useEffect(() => {
    setCachedPremium(readCachedPremium());
  }, []);

  // theo dõi sóng để đổi nhánh offline↔online ngay khi mất/được sóng
  useEffect(() => {
    setOnline(isOnline());
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // tra hạng khi đã đăng nhập
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
        if (error) {
          // lỗi/mất sóng → fail-closed cho PHIÊN NÀY nhưng KHÔNG ghi đè dấu tốt
          // đã lưu (kẻo mất sóng lại xoá mất quyền offline của premium)
          setPremium(false);
          return;
        }
        const p =
          resolveTier(data?.tier, data?.premium_until, Date.now()) === "premium";
        setPremium(p);
        writeCachedPremium(p);
        setCachedPremium(p);
      });
    return () => {
      alive = false;
    };
  }, [authReady, user]);

  // ĐĂNG XUẤT THẬT (đang có sóng, kiểm xong mà không có user) → xoá dấu premium,
  // khỏi rò quyền offline sang tài khoản sau trên cùng máy. Offline user=null là
  // do getUser() không xác thực được → KHÔNG xoá. authErrored (getUser hỏng dù
  // onLine=true) cũng KHÔNG xoá — không chắc là đăng xuất thật.
  useEffect(() => {
    if (isOnline() && authReady && !authErrored && !user) {
      writeCachedPremium(false);
      setCachedPremium(false);
    }
  }, [authReady, authErrored, user]);

  const access = featureAccessDecision({
    configured: isSupabaseConfigured(),
    authReady,
    hasUser: !!user,
    premium,
    online,
    cachedPremium,
    authErrored,
  });
  return { access, ready: access !== "checking" };
}
