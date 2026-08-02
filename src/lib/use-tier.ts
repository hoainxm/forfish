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
import { readToken, TOKEN_KICKED_EVENT } from "@/lib/device-token-store";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/use-auth";
import {
  applyIdentityAction,
  offlineIdentityPhone,
  subscribeIdentity,
} from "@/lib/offline-identity";
import {
  effectivePremiumMark,
  featureAccessDecision,
  readPremiumMark,
  resolveTier,
  shouldClearPremiumMark,
  TIER_CACHE_KEY,
  TIER_EVENT,
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

/* Bí danh `clearCachedTier` (= clearTierMark) ĐÃ GỠ 2026-08-02c: không chỗ nào
   trong repo còn gọi, mà nó lại là một CỬA SAU của cổng quét chữ trong
   identity-gate.test.ts — cổng cấm gọi `clearTierMark(` ngoài module danh tính,
   đổi tên một cái là lách qua. Xoá dấu hạng nay chỉ có một đường:
   `applyIdentityAction` (xem lưới đỡ ở cuối file). */

function readCachedUntil(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TIER_UNTIL_KEY);
  } catch {
    return null;
  }
}

function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine !== false;
}

export function useFeatureAccess(): {
  access: FeatureAccess;
  ready: boolean;
  /** hạn premium (ISO) để bày "dùng tới ngày nào"; null = không hạn/chưa biết */
  premiumUntil: string | null;
  /** ĐANG MỞ BẰNG QUYỀN ĐÃ LƯU TRÊN MÁY, không phải bằng phiên đăng nhập còn
   *  sống (ca C-7). Màn hình PHẢI nói thẳng chuyện này — chủ dự án chốt: không
   *  được giả vờ là đã đăng nhập, mà cũng không được bắt bà con "Đăng nhập"
   *  giữa biển như thể quyền đã mất. */
  savedAccess: boolean;
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
  /* MÁY CÒN NHỚ AI TỪNG ĐĂNG NHẬP Ở ĐÂY KHÔNG (C-7). Đọc trong effect, không
     đọc lúc render, để bản dựng máy chủ và bản vẽ đầu ở máy khớp nhau. */
  const [deviceBound, setDeviceBound] = useState(false);
  /*  MÁY CÓ CHUỖI CỨNG KHÔNG (2026-08-02f) — điều kiện MỚI để được tra hạng,
      thay cho `userId` vốn chỉ còn đúng với /quan-tri và mấy máy phiên cũ.
      Đọc trong effect, không đọc lúc render, để bản dựng máy chủ và bản vẽ đầu
      ở máy khớp nhau. */
  const [tokenPresent, setTokenPresent] = useState(false);

  /* đọc dấu premium đã lưu (client-only). Dấu ĐÃ XÉT HẠN ngay lúc đọc: dấu thô
     lưu theo cột `tier`, hạn lưu riêng, và hết hạn quá biên thì dấu không còn
     giá trị nữa (E4 — nếu không thì premium offline không bao giờ hết hạn).

     ĐỌC LẠI KHI KHO ĐỔI (2026-08-02): nút Đăng xuất / Gỡ khỏi máy gọi thẳng
     `forgetIdentity()` — không đổi dep nào của hook này, nên nếu chỉ đọc lúc
     mount thì `cachedMark` và `deviceBound` trong state sẽ CÒN NGUYÊN sau khi
     localStorage đã sạch, và nhánh "quyền đã lưu" mới thêm sẽ mở cửa cho bạn
     thuyền bằng dấu của chủ tàu. Sổ danh tính nay bắn `IDENTITY_EVENT` mỗi lần
     đổi (và `subscribeIdentity` nghe cả `storage` của tab khác); đây là chỗ
     nghe.

     TÍNH LẠI THEO THỜI GIAN, KHÔNG CHỈ LÚC MOUNT (sửa 2026-08-02c): `Date.now()`
     ở đây chỉ được đọc khi effect chạy. Giữa chuyến biển `user` là null nên
     effect tra hạng (dep `userId`) không chạy, `fallback()` cũng không — tức
     `cachedMark` ĐÔNG CỨNG ở giá trị lúc mở app, và dấu premium hết hạn thật
     cũng không tự đóng. Mở lại app / bật lại màn hình / sóng vừa về là ba mốc
     rẻ tiền để tính lại. */
  useEffect(() => {
    const sync = () => {
      const until = readCachedUntil();
      setCachedMark(effectivePremiumMark(readCachedMark(), until, Date.now()));
      setPremiumUntil(until);
      setDeviceBound(offlineIdentityPhone() !== null);
      setTokenPresent(readToken() !== null);
    };
    sync();
    const off = subscribeIdentity(sync);
    const onVisible = () => {
      if (typeof document === "undefined") return;
      if (document.visibilityState === "visible") sync();
    };
    window.addEventListener("online", sync);
    /*  BỊ ĐÁ thì `tokenPresent` phải về false NGAY, không đợi lần mở app sau —
        nếu không, effect tra hạng vẫn chạy với một chuỗi đã chết và bám vô ích. */
    window.addEventListener(TOKEN_KICKED_EVENT, sync);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      off();
      window.removeEventListener("online", sync);
      window.removeEventListener(TOKEN_KICKED_EVENT, sync);
      document.removeEventListener("visibilitychange", onVisible);
    };
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
  /*  ═══ HẠNG ĐI NHỜ NHỊP "ĐÃ MỞ APP" ═══ (2026-08-02g, chủ dự án chốt)

      NHỊP TRA HẠNG RIÊNG ĐÃ XOÁ HẲN — cùng với route `/api/me/tier`. Chủ dự án
      hỏi đúng hai câu và cả hai đều không có câu trả lời tử tế:
        · "offline thì gọi hạng làm gì?" — không làm gì cả. Nhịp cũ vẫn bắn ~6
          lượt/giờ suốt chuyến biển mất sóng, mỗi lượt một đồng hồ chặn.
        · "token lúc đăng nhập đã biết hạng rồi, check riêng làm gì?" — thứ duy
          nhất còn cần máy chủ là hạng ĐỔI SAU khi đăng nhập (nhân viên gán
          premium ở /quan-tri lúc bà con đã đăng nhập từ tuần trước). Mà nhịp
          "đã mở app" vốn đã nói chuyện với máy chủ về ĐÚNG tài khoản đó, 30
          phút/lần, và **im lặng tuyệt đối khi mất sóng**.

      Nay `/api/me/heartbeat` trả kèm `tier` + `premiumUntil` (đọc từ chính hàng
      vừa update — KHÔNG tốn thêm truy vấn nào), `lib/heartbeat.ts` ghi dấu rồi
      bắn `TIER_EVENT`, và đây là chỗ nghe. Kết quả: offline = 0 lượt gọi.

      CÒN "BỊ ĐÁ" thì không cần ai đi hỏi riêng nữa: mọi cửa server đã trả
      `401 token_revoked`, nên request nào tới trước thì bắt trước — nhanh hơn
      một nhịp hẹn giờ. Chỗ HIỂU vẫn chỉ có một (`authedFetch`).

      ⚠️ GIỮ NGUYÊN LUẬT E4: dấu ghi theo cột `tier` THÔ, hạn lưu riêng, xét hạn
      lúc ĐỌC với biên rộng. Máy hết pin sạch rồi nhảy ngày là chuyện thường
      ngoài biển; so hạn bằng đồng hồ máy lúc GHI là xoá quyền đã trả tiền. */
  useEffect(() => {
    const onTier = (e: Event) => {
      const d = (e as CustomEvent<{ marked: boolean; until: string | null }>)
        .detail;
      if (!d) return;
      const now = Date.now();
      const live =
        resolveTier(d.marked ? "premium" : "basic", d.until, now) === "premium";
      setPremium(live);
      // hạ hạng CHỈ VÌ hạn? nói ra để featureAccessDecision còn cân với dấu
      // trong máy thay vì tin đồng hồ máy một cách mù quáng
      setExpiredOnly(d.marked && !live);
      setPremiumUntil(d.until);
      setCachedMark(
        effectivePremiumMark(d.marked ? "premium" : "basic", d.until, now),
      );
    };
    window.addEventListener(TIER_EVENT, onTier);
    return () => window.removeEventListener(TIER_EVENT, onTier);
  }, []);

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
  /*  "ĐANG CÓ TÀI KHOẢN TRÊN MÁY" = phiên Supabase HOẶC chuỗi cứng (2026-08-02g).
      Đây là cây cầu duy nhất cần bắc sau khi app bỏ phiên: mọi luật bên dưới
      (`shouldClearPremiumMark`, `featureAccessDecision`) đều hỏi câu "máy này có
      ai đăng nhập không", và với chuỗi cứng thì câu trả lời là CÓ — dù
      `supabase.auth.getUser()` trả null vĩnh viễn.
      Thiếu vế `tokenPresent`: máy đang đăng nhập bằng chuỗi bị đọc thành "phiên
      đã rụng" ⇒ rơi xuống nhánh mời "Đăng nhập", và tệ hơn là `shouldClearPremiumMark`
      có cửa xoá dấu hạng của người đã trả tiền. */
  const hasUser = !!user || tokenPresent;
  useEffect(() => {
    const bound = offlineIdentityPhone() !== null;
    setDeviceBound(bound);
    if (
      shouldClearPremiumMark({
        authReady,
        authErrored,
        hasUser,
        hasOfflineIdentity: bound,
      })
    ) {
      /* QUA CỔNG DUY NHẤT (K7): tới đây thì `hasOfflineIdentity` đã là false —
         không còn danh tính nào để mất, việc duy nhất còn lại là bỏ dấu hạng.
         Đi qua cổng để repo không có đường ghi thứ hai (identity-gate canh). */
      applyIdentityAction("session-gone-no-identity", false);
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
    /* DỮ LIỆU ĐÃ NẰM SẴN TRONG HOOK, CHỈ CHƯA ĐƯỢC CHUYỂN SANG CỬA QUYẾT ĐỊNH
       (sửa 2026-08-02, C-7): thiếu vế này thì tàu có wifi nội bộ + auth-js tự
       xoá phiên = người trả tiền tới 2027 rơi xuống "Đăng nhập" giữa biển. */
    hasOfflineIdentity: deviceBound,
    /* …và nhánh đó đòi HẠN THẬT: dấu không hạn thì không bao giờ hết, mà ở ca
       này `hasUser=false` cũng chặn luôn đường tra lại (2026-08-02c). */
    premiumMarkUntil: premiumUntil,
  });
  const savedAccess =
    isSupabaseConfigured() &&
    access === "open" &&
    !hasUser &&
    deviceBound &&
    cachedMark === "premium";
  return { access, ready: access !== "checking", premiumUntil, savedAccess };
}
