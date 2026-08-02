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
import { clearTierMark, offlineIdentityPhone } from "@/lib/offline-identity";
import {
  effectivePremiumMark,
  featureAccessDecision,
  readPremiumMark,
  resolveTier,
  shouldClearPremiumMark,
  shouldRetryTierQuery,
  tierRetryDelayMs,
  TIER_CACHE_KEY,
  TIER_UNTIL_KEY,
  type FeatureAccess,
  type PremiumMark,
} from "@/lib/tier";

/* Khoá dấu hạng nay định nghĩa ở lib/tier.ts (module THUẦN) để
   lib/offline-identity.ts dùng chung mà không kéo theo React/Supabase. Xuất lại
   ở đây để chỗ gọi cũ không phải đổi đường import. */
export { TIER_CACHE_KEY, TIER_UNTIL_KEY };

/** Dấu hạng đã lưu — BA trạng thái; localStorage ném = "unknown" (E5). */
function readCachedMark(): PremiumMark {
  if (typeof window === "undefined") return "unknown";
  try {
    return readPremiumMark(window.localStorage.getItem(TIER_CACHE_KEY));
  } catch {
    /* chế độ riêng tư — CHƯA BIẾT, không được kết luận là hạng thường */
    return "unknown";
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

/* Xoá dấu hạng — thân hàm nay ở lib/offline-identity (module KHÔNG React) để
   nút Đăng xuất gọi được THẲNG, không phải chờ một effect nào chạy đúng thứ tự
   (xem clearTierMark). Giữ tên cũ + xuất ra ngoài cho chỗ gọi ngoài hook. */
export const clearCachedTier = clearTierMark;

function readCachedUntil(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TIER_UNTIL_KEY);
  } catch {
    return null;
  }
}

function writeCachedUntil(until: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (until) window.localStorage.setItem(TIER_UNTIL_KEY, until);
    else window.localStorage.removeItem(TIER_UNTIL_KEY);
  } catch {
    /* hết chỗ / chế độ riêng tư — bỏ qua */
  }
}

function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine !== false;
}

/**
 * Tra hạng chờ tối đa bấy nhiêu rồi chịu thua (2026-07-31).
 *
 * VÌ SAO CÓ: query dưới đây trước không có đồng hồ, không có `.catch`. Ngoài
 * khơi hay gặp sóng "sống mà chết" (bắt tay được, gói tin không về) ⇒ promise
 * KHÔNG BAO GIỜ xong ⇒ `premium` kẹt `null` ⇒ `featureAccessDecision` trả
 * "checking" VĨNH VIỄN ⇒ lớp cá im lặng tuyệt đối, không cả nút thử lại. Khách
 * đã trả tiền mất đúng thứ mình mua, ngay giữa chuyến biển.
 */
const TIER_QUERY_MS = 12000;

export function useFeatureAccess(): {
  access: FeatureAccess;
  ready: boolean;
  /** hạn premium (ISO) để bày "dùng tới ngày nào"; null = không hạn/chưa biết */
  premiumUntil: string | null;
} {
  const { user, ready: authReady, errored: authErrored } = useAuthUser();
  // null = chưa tra xong hạng (chỉ có nghĩa khi đã đăng nhập + có sóng)
  const [premium, setPremium] = useState<boolean | null>(null);
  const [cachedMark, setCachedMark] = useState<PremiumMark>("unknown");
  const [premiumUntil, setPremiumUntil] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  /* `premium === false` CHỈ VÌ HẠN (máy chủ vẫn ghi tier='premium'). Tách ra
     vì đồng hồ máy lệch là chuyện thường ngoài biển — xem featureAccessDecision. */
  const [expiredOnly, setExpiredOnly] = useState(false);

  /* đọc dấu premium đã lưu (client-only). Dấu ĐÃ XÉT HẠN ngay lúc đọc: dấu thô
     lưu theo cột `tier`, hạn lưu riêng, và hết hạn quá biên thì dấu không còn
     giá trị nữa (E4 — nếu không thì premium offline không bao giờ hết hạn). */
  useEffect(() => {
    const until = readCachedUntil();
    setCachedMark(effectivePremiumMark(readCachedMark(), until, Date.now()));
    setPremiumUntil(until);
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

  /* tra hạng khi đã đăng nhập.
     DEPS LÀ `user?.id`, KHÔNG PHẢI `user` (sửa 2026-08-02): auth-js bắn
     TOKEN_REFRESHED định kỳ và mỗi lần lại là một OBJECT user MỚI (cùng người)
     ⇒ effect chạy lại ⇒ `setPremium(null)` ⇒ lớp cá nháy về "đang kiểm tra"
     kèm một truy vấn 12 giây, lặp đi lặp lại suốt chuyến. Đổi người thì `id`
     mới đổi, đúng lúc cần tra lại. */
  const userId = user?.id;
  useEffect(() => {
    if (!authReady || !userId) return;
    const supabase = createClient();
    if (!supabase) return;
    let alive = true;
    /* đếm số lần đã chịu thua — để giãn dần các lần hỏi lại */
    let tries = 0;
    /* đang có một lượt hỏi chạy dở (đừng bắn chồng lượt khi sóng chớp tắt) */
    let inFlight = false;
    /* ĐÃ có câu trả lời TƯƠI từ máy chủ — hết việc, thôi hỏi lại */
    let answered = false;
    let queryTimer: ReturnType<typeof setTimeout> | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    setPremium(null);
    setExpiredOnly(false);

    /* HỎI LẠI — ĐƯỜNG THOÁT BẮT BUỘC (sửa 2026-08-02, hồi quy của bản vá cùng
       ngày). Deps của effect là `userId` (chống nháy, xem chú thích trên), mà
       trước đó đường tự thử lại DUY NHẤT lại chính là `user` đổi object mỗi lần
       TOKEN_REFRESHED — đổi deps là cắt mất nó. Không có chỗ này thì một cú tra
       hỏng lúc mở app ở cảng sóng "sống mà chết" khoá bà con ở "đang kiểm tra"
       tới lúc tắt hẳn app: lớp cá im lặng, không khoá, không mời nâng cấp,
       không nút thử lại, sóng về cũng không tra lại. */
    function scheduleRetry() {
      // effect này chỉ chạy khi authReady && userId nên hai vế đó luôn đúng —
      // vế thật sự quyết định là "đã có câu trả lời tươi chưa"
      if (!alive) return;
      if (!shouldRetryTierQuery({ authReady: true, hasUser: true, answered })) {
        return;
      }
      clearTimeout(retryTimer);
      retryTimer = setTimeout(runQuery, tierRetryDelayMs(tries++));
    }

    // TRA HỎNG (lỗi · treo · hết giờ) → lùi về DẤU ĐÃ LƯU, không kẹt "checking"
    // và cũng không hạ oan khách premium xuống màn mời-nâng-cấp chỉ vì sóng
    // chập chờn. Dấu chỉ bật khi đã tra ĐƯỢC lúc còn sóng, và chốt thật vẫn ở
    // middleware/RLS khi có mạng — đây KHÔNG phải cửa sau.
    // "unknown" (chưa bao giờ tra được) giữ `premium = null` để
    // featureAccessDecision im lặng thay vì khẳng định hạng thường (E5).
    function fallback() {
      if (!alive) return;
      const until = readCachedUntil();
      // dấu đã XÉT HẠN: hết hạn quá biên thì không còn là premium nữa (E4)
      const mark = effectivePremiumMark(readCachedMark(), until, Date.now());
      setCachedMark(mark);
      setPremiumUntil(until);
      setExpiredOnly(false);
      setPremium(mark === "premium" ? true : mark === "basic" ? false : null);
      // chưa hỏi được máy chủ ⇒ CÒN PHẢI HỎI LẠI, kể cả khi dấu cũ đủ để trả
      // lời tạm: bà con vừa được gán premium ở cảng cũng cần lần hỏi sau mới
      // thấy quyền của mình.
      scheduleRetry();
    }

    function runQuery() {
      if (!alive || answered || inFlight) return;
      inFlight = true;
      let settled = false;
      const finish = (apply: () => void) => {
        if (!alive || settled) return;
        settled = true;
        inFlight = false;
        clearTimeout(queryTimer);
        apply();
      };
      // đồng hồ riêng: abortSignal lo phần mạng, timer lo cả ca promise không
      // bao giờ settle vì lý do khác
      queryTimer = setTimeout(() => finish(fallback), TIER_QUERY_MS);
      void (async () => {
        // kiểm lại cho TypeScript: `runQuery` là function declaration nên bị
        // hoist lên TRƯỚC chỗ chặn `if (!supabase) return` ở đầu effect, TS
        // không mang được kết luận "khác null" vào đây. Thực tế không bao giờ
        // chạy tới nhánh return này.
        if (!supabase) return;
        try {
          const { data, error } = await supabase
            .from("customers")
            .select("tier, premium_until")
            .abortSignal(AbortSignal.timeout(TIER_QUERY_MS))
            .maybeSingle();
          if (error) {
            // KHÔNG ghi đè dấu tốt đã lưu (kẻo mất sóng lại xoá quyền offline)
            finish(fallback);
            return;
          }
          finish(() => {
            answered = true;
            clearTimeout(retryTimer);
            /* ĐƯỜNG GHI DẤU chỉ dựa cột `tier` THÔ của DB (sửa 2026-08-02, E4).
               Trước đây ghi theo `resolveTier(..., Date.now())` — tức so hạn
               bằng ĐỒNG HỒ MÁY. Máy hết pin sạch rồi mất đồng bộ giờ, ngày nhảy
               tới tương lai ⇒ hạn coi như hết ⇒ `writeCachedPremium(false)` XOÁ
               quyền đã trả tiền bằng chính đường ghi bình thường, không cần đăng
               xuất, không cần mất sóng. HẠN được lưu RIÊNG (TIER_UNTIL_KEY) và
               chỉ đem ra xét lúc ĐỌC, có biên rộng — nhờ vậy hết hạn thật thì
               dấu cũng hết, mà đồng hồ lệch vài ngày thì không mất quyền. */
            const marked = data?.tier === "premium";
            const until = marked
              ? ((data?.premium_until as string | null) ?? null)
              : null;
            writeCachedPremium(marked);
            writeCachedUntil(until);
            setPremiumUntil(until);
            setCachedMark(
              effectivePremiumMark(
                marked ? "premium" : "basic",
                until,
                Date.now(),
              ),
            );
            // HIỂN THỊ: hạng hiệu lực (có xét hạn) — vẫn là nguồn cho access
            const live =
              resolveTier(data?.tier, data?.premium_until, Date.now()) ===
              "premium";
            // hạ hạng CHỈ VÌ hạn? nói ra để featureAccessDecision còn cân với
            // dấu trong máy thay vì tin đồng hồ máy một cách mù quáng
            setExpiredOnly(marked && !live);
            setPremium(live);
          });
        } catch {
          // abort do hết giờ, hoặc mạng ném lỗi
          finish(fallback);
        }
      })();
    }

    runQuery();
    /* sóng vừa về là cơ hội tốt nhất — hỏi lại NGAY, đừng bắt bà con đợi hết
       nhịp hẹn giờ (nhịp giãn dần có thể lên tới 10 phút) */
    const onBackOnline = () => {
      clearTimeout(retryTimer);
      runQuery();
    };
    window.addEventListener("online", onBackOnline);
    return () => {
      alive = false;
      clearTimeout(queryTimer);
      clearTimeout(retryTimer);
      window.removeEventListener("online", onBackOnline);
    };
  }, [authReady, userId]);

  /* ĐĂNG XUẤT THẬT → xoá dấu premium, khỏi rò quyền sang tài khoản sau trên
     cùng máy. Điều kiện nay là hàm THUẦN `shouldClearPremiumMark` và KHÔNG còn
     nhìn `navigator.onLine` (C-8): onLine nói dối cả chuyến biển khi tàu có
     router wifi nội bộ. Lá chắn thật là DANH TÍNH OFFLINE — máy còn nhớ ai từng
     đăng nhập ở đây thì user=null chỉ là "chưa hỏi được máy chủ", không phải
     "đã đăng xuất". Sổ danh tính chỉ bị xoá khi bà con tự bấm Đăng xuất và máy
     chủ đã xác nhận (hero-account.tsx).

     ĐÂY LÀ LƯỚI ĐỠ, KHÔNG PHẢI CỬA CHÍNH (2026-08-02): nút Đăng xuất nay tự gọi
     thẳng `forgetIdentity()` (đã kèm xoá dấu hạng) chứ không trông vào effect
     này — effect chỉ chạy khi có dep đổi, mà lúc đăng xuất thì `hasUser` đổi
     TRƯỚC khi danh tính bị quên, nên trông vào nó là trông vào thứ tự lập lịch
     của React. */
  const hasUser = !!user;
  useEffect(() => {
    if (
      shouldClearPremiumMark({
        authReady,
        authErrored,
        hasUser,
        hasOfflineIdentity: offlineIdentityPhone() !== null,
      })
    ) {
      clearCachedTier();
      // xoá khoá = "chưa biết gì về người kế tiếp", đúng như đọc lại từ máy
      setCachedMark("unknown");
      setPremiumUntil(null);
      setExpiredOnly(false);
    }
  }, [authReady, authErrored, hasUser]);

  const access = featureAccessDecision({
    configured: isSupabaseConfigured(),
    authReady,
    hasUser,
    premium,
    online,
    cachedMark,
    authErrored,
    premiumExpiredOnly: expiredOnly,
  });
  return { access, ready: access !== "checking", premiumUntil };
}
