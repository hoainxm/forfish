"use client";

// Hook auth dùng chung — app yêu cầu đăng nhập cho tính năng GIÁ TRỊ CAO
// (dự báo cá, nhu cầu mua cá), phần còn lại public (chốt 2026-06-10).
// Trả { user, phone, ready } — ready=false là đang kiểm tra, đừng vội khóa.

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { isNetworkAuthError } from "@/lib/auth-error";
import { offlineIdentityPhone, rememberIdentity } from "@/lib/offline-identity";

/** SĐT thô của user (Supabase lưu SĐT trong email ảo 0901234567@sdvico.local) */
function rawUserPhone(u: User): string | null {
  const raw = u.phone || (u.email ? u.email.split("@")[0] : "");
  return raw || null;
}

export function useAuthUser(): {
  user: User | null;
  /** SĐT (suy từ email ảo) — null khi chưa đăng nhập. Mất sóng làm `user` tụt
   *  về null thì lùi về DANH TÍNH OFFLINE (lib/offline-identity): access token
   *  chỉ sống ~1 giờ, mà chuyến biển thì dài hơn thế rất nhiều — không có đường
   *  lùi này thì hộp thư của bà con biến mất giữa biển (C-1). */
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
  /* SĐT lần đăng nhập gần nhất, đọc từ máy. Đọc trong effect (không đọc thẳng
     lúc render) để bản dựng phía máy chủ và bản vẽ đầu ở máy khớp nhau. */
  const [identityPhone, setIdentityPhone] = useState<string | null>(null);

  useEffect(() => {
    setIdentityPhone(offlineIdentityPhone());
    const supabase = createClient();
    if (!supabase) {
      setReady(true);
      return;
    }
    let alive = true;

    /* GẮN MÁY ↔ SĐT khi thấy user THẬT — chỉ nhánh có user, nhánh null KHÔNG
       đụng tới. Vì sao: `null` ở đây phần lớn là "chưa hỏi được máy chủ" chứ
       không phải "đã đăng xuất"; xoá danh tính theo nó là tự bắn vào chân
       (C-1/C-7/C-8). Đổi SĐT thì rememberIdentity tự lo xoá dấu tier. */
    const remember = (u: User | null) => {
      if (!u) return;
      const p = rememberIdentity(rawUserPhone(u));
      /*  `p === null` = SĐT không chuẩn hoá được (tài khoản email thật, tài
          khoản kỹ thuật). `rememberIdentity` lúc đó XOÁ sổ danh tính + dấu
          quyền trong máy — "không biết là ai thì không giữ quyền của ai" — nên
          state ở đây phải theo, không thì màn hình còn bám SĐT người trước
          trong khi kho đã sạch (sửa 2026-08-02b). */
      if (alive) setIdentityPhone(p);
    };

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
        const u = data?.user ?? null;
        remember(u);
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
      remember(u);
      setUser(u);
    });
    return () => {
      alive = false;
      clearTimeout(timer);
      sub.subscription.unsubscribe();
    };
  }, []);

  const phone =
    (user ? rawUserPhone(user) : null) || identityPhone || null;

  return { user, phone, ready, errored };
}
