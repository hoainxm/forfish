"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  BellIcon,
  ChevronRightIcon,
  CloseIcon,
  LockIcon,
  PlusIcon,
  TrashIcon,
  UsersIcon,
} from "@/components/icons";
import { SQ_BTN } from "@/components/ui/sq-btn";
import { createClient } from "@/lib/supabase/client";
import { clearInbox } from "@/lib/inbox";
import { clearCachedOrders } from "@/lib/catalog-orders";
import { clearUserScopedData } from "@/lib/auth-scope";
import { clearCart } from "@/lib/cart";
import {
  ACTIVE_SYNC_KINDS,
  clearSyncMeta,
  USER_SYNC_EVENT,
} from "@/lib/user-sync";
import {
  applyIdentityAction,
  offlineIdentityPhone,
} from "@/lib/offline-identity";
import { useAuthUser } from "@/lib/use-auth";
import { useFeatureAccess } from "@/lib/use-tier";
import { tierBadge } from "@/lib/tier";
import {
  clearKickedMark,
  readKickedAt,
  readToken,
  signOutLocal,
  tokenHeader,
  TOKEN_KICKED_EVENT,
  TOKEN_STORE_EVENT,
} from "@/lib/device-token-store";
import { useOnline } from "@/lib/use-online";
import { apiUrl } from "@/lib/api-base";
import { timeoutSignal } from "@/lib/abort";
import {
  fetchVapidPublicKey,
  getExistingPushSubscription,
  isPushSupported,
  subscribeToPush,
  syncPushAccount,
  type SyncPushResult,
  unsubscribeFromPush,
  detachPushAccount,
} from "@/lib/push-client";

/*
  Tài khoản trên hero — GỌN (sửa 2026-06-11 theo góp ý "design thô"):
  hero chỉ bày MỘT chip kính mờ; mọi thứ phụ (cỡ giao diện, đăng xuất)
  nằm trong SHEET TÀI KHOẢN — cái gì trực tiếp thì show, còn lại menu phụ.

  Cỡ giao diện: MẶC ĐỊNH "Gọn" (user chốt 2026-07-28 — kể cả chưa đăng nhập);
  bấm lại lựa chọn đang chọn = về "auto" theo cỡ chữ máy (xem globals.css).
*/

const MODE_KEY = "forfish.displaymode.v1";

/** Đăng xuất chờ tối đa bấy nhiêu rồi coi như KHÔNG đăng xuất được (cùng khuôn
 *  đồng hồ với use-auth 8s / use-tier 12s — nút bấm thì phải ngắn hơn). */
const SIGN_OUT_MS = 6000;

/*  DỌN HỒ SƠ CHỦ TÀU KHỎI MÁY — gọi khi bà con TỰ ĐĂNG XUẤT / GỠ TÀI KHOẢN
    (có ý trao máy cho người khác).

    VÌ SAO CÓ (bug rò rỉ 2026-09-18): trước đây đăng xuất chỉ xoá chuỗi + danh
    tính + dấu hạng + hộp thư + đơn hàng. Hồ sơ TÀU (tên tàu, số đăng ký), sổ
    thuyền viên (CCCD), tủ giấy tờ, danh bạ nậu vựa, sổ bảo dưỡng/vật tư NẰM LẠI
    localStorage ⇒ người sau mở app vẫn thấy TÊN + SỐ TÀU của chủ cũ. Trái bất
    biến CÁCH LY TÀI KHOẢN (cùng luật với hộp thư + đơn hàng đã xoá ngay trên).

    `clearUserScopedData` (lib/auth-scope) là hàm ĐÃ CÓ SẴN cho đúng việc này
    ("clear data KH khi user CHANGE hoặc logout") nhưng CHƯA TỪNG được gọi ở đâu
    trong app — cổng cách ly tài khoản dựng xong mà chưa đấu dây. Nay đấu vào.
    Nó xoá boats/currentBoat/boat/sdvico-boat/products/documents/maintenance/
    buyers/debts/trips/crew/tier.premium VÀ nhờ Service Worker xoá kho `/api/*`
    riêng tư đã cache (rò tên/serial/mã đơn của người cũ khi máy mất sóng).

    AN TOÀN CHO CHỦ THẬT: boats/maintenance/materials/crew/documents đồng bộ
    server (lib/user-sync) ⇒ đăng nhập lại là kéo về. NHƯNG phải xoá KÈM sổ mốc
    đồng bộ (`clearSyncMeta`): để lại mốc thì lần đăng nhập lại LWW coi server
    "không mới hơn" ⇒ KHÔNG kéo bản server về ⇒ chủ thật thấy trống. Giỏ hàng
    giữ SĐT + điểm giao của người trước nên đi cùng (`clearCart` tự bắn CART_EVENT).

    BẮN USER_SYNC_EVENT cho từng sổ: `router.refresh()` KHÔNG reset state của
    client component (bài học use-auth), mà boat-store/crew-list/document-vault/
    maintenance/products đọc lại theo sự kiện này ⇒ màn đang mở về TRỐNG NGAY.

    CHỈ nhánh TỰ ĐĂNG XUẤT / GỠ TÀI KHOẢN. KHÔNG gọi ở nhánh BỊ MÁY KHÁC ĐÁ
    (`signOutLocal("kicked")`) — nhánh đó CỐ Ý giữ dữ liệu đã tải để bà con còn
    dùng ngoài biển. */
function wipeOwnerDataFromDevice(): void {
  clearUserScopedData(); // dữ liệu chủ tàu + nhờ SW xoá kho /api riêng tư
  clearSyncMeta(); // để đăng nhập lại KÉO ĐỦ bản server (không thì LWW chặn)
  clearCart(null); // giỏ giữ SĐT + điểm giao người trước (tự bắn CART_EVENT)
  try {
    for (const kind of ACTIVE_SYNC_KINDS) {
      window.dispatchEvent(new CustomEvent(USER_SYNC_EVENT, { detail: { kind } }));
    }
  } catch {
    /* môi trường không có sự kiện (WebView lạ) — màn sẽ đọc lại lúc điều hướng */
  }
}

type Mode = "auto" | "to" | "gon";

// "Theo máy" (auto) không bày thành lựa chọn (góp ý user 2026-06-11) — chỉ
// 2 tùy chọn; bấm lại cái đang chọn = về auto. MẶC ĐỊNH là "gon" (2026-07-28).
const MODES: { id: Exclude<Mode, "auto">; label: string; sub: string }[] = [
  /*  NHÃN PHẢI NÓI ĐÚNG THỨ CÔNG TẮC LÀM (sửa 2026-08-29h). Từ khi gốc chữ
      của cả hai chế độ cùng là 16px (chống iOS tự phóng to), "Chữ to" KHÔNG
      còn đổi cỡ chữ một điểm nào — nhãn hứa một việc nó không làm. Thứ thật
      sự đổi là chiều cao hàng và nút: 56px (to) so với 37px (gọn). */
  { id: "to", label: "Nút to", sub: "Nút to, hàng cao — dễ bấm tay ướt" },
  { id: "gon", label: "Gọn", sub: "Nút thấp gọn — thấy được nhiều hàng hơn" },
];

function prettyPhone(p: string): string {
  let local = p.replace(/\D/g, "");
  if (local.startsWith("84")) local = "0" + local.slice(2);
  else if (!local.startsWith("0")) local = "0" + local;
  return local.replace(/(\d{4})(\d{3})(\d{0,3})/, "$1 $2 $3").trim();
}

type PushUiState =
  | "checking"
  | "off"
  | "on"
  | "busy"
  | "unsupported"
  | "unconfigured";

/**
 * BỊ MÁY KHÁC ĐĂNG NHẬP CÙNG SỐ — nói thật, inline, không hộp thoại (audit
 * 2026-08-18 G1: trước đây cả app im, premium biến mất không một lời).
 *
 * Nghe `TOKEN_KICKED_EVENT` (bị đá lúc đang mở Trang chủ) VÀ đọc mốc
 * `forfish.kicked.v1` lúc mount (bị đá lúc ở màn khác / app ở nền). Tắt khi máy
 * cất chuỗi mới (`TOKEN_STORE_EVENT` → `readKickedAt()` null). Nút Đăng nhập
 * ẨN khi mất sóng — đăng nhập cần sóng, mời vào ngõ cụt là vô ích (tầng 5).
 * Dữ liệu đã tải VẪN dùng được (luật `signOutLocal("kicked")` chỉ xoá chuỗi).
 */
function KickedNotice() {
  const [kickedAt, setKickedAt] = useState<string | null>(null);
  const online = useOnline();
  useEffect(() => {
    const sync = () => setKickedAt(readKickedAt());
    sync();
    window.addEventListener(TOKEN_KICKED_EVENT, sync);
    window.addEventListener(TOKEN_STORE_EVENT, sync);
    return () => {
      window.removeEventListener(TOKEN_KICKED_EVENT, sync);
      window.removeEventListener(TOKEN_STORE_EVENT, sync);
    };
  }, []);
  if (!kickedAt) return null;
  return (
    <div
      role="alert"
      className="mt-3 surface border-l-4 border-danger px-4 py-3 text-left"
    >
      {/*  Rút về ĐÚNG MỘT DÒNG cấp dữ liệu (D1) + nút inline (A2/A3): đo trước
          3 dòng chữ + 1 nút full-width 56px = 233px = 29% màn đầu, đẩy bốn việc
          chính xuống dưới vạch gấp. Câu "Dự báo và sổ sách đã tải vẫn dùng bình
          thường" là trấn an chứ không phải dữ liệu; câu "Muốn dùng lại: đăng
          nhập" nhắc lại đúng nhãn nút ngay dưới. Nhánh MẤT SÓNG giữ nguyên —
          đổi đuôi câu để nói đúng việc làm được. */}
      <div className="flex items-stretch gap-2">
        <div className="min-w-0 flex-1">
          <p className="display text-[1rem] font-bold leading-snug text-danger">
            Số này vừa được đăng nhập ở máy khác
          </p>
          <p className="mt-1 text-[1rem] leading-snug text-foreground/80">
            Máy này thôi nhận tin mới — phần đã tải vẫn xem được
            {online ? "." : " — cần mạng để đăng nhập lại."}
          </p>
        </div>
        {online ? (
          <Link href="/login" className={`${SQ_BTN} bg-field text-navy`}>
            <LockIcon className="h-6 w-6" />
            Đăng nhập
          </Link>
        ) : (
          <span className="w-16 shrink-0" aria-hidden />
        )}
      </div>
    </div>
  );
}

export function HeroAccount() {
  const online = useOnline();
  const router = useRouter();
  /*  ⚠️ `signedIn`, KHÔNG PHẢI `user` (sửa 2026-08-02h — lỗi CHẶN).
      `user` là phiên Supabase, mà `/login` cấp chuỗi cứng xong là `signOut()`
      ngay ⇒ `user` null VĨNH VIỄN trên mọi máy ngư dân. Rẽ nhánh theo nó thì
      người ĐANG đăng nhập thấy chip "Đăng nhập", sheet không có nút Đăng xuất,
      không có Đổi mật khẩu — tức **xoá mất đường ra hợp lệ duy nhất của bà con**
      (`signOutLocal("user")` chỉ gọi được từ trong nhánh đó). Tệ hơn: nút "Gỡ
      tài khoản khỏi máy này" (điều kiện `!user && deviceBound`) lại HIỆN, mà nó
      KHÔNG xoá chuỗi — máy thành "quên người, vẫn còn chuỗi".
      `user` chỉ giữ cho `full_name` (metadata của phiên, có thì hiện). */
  const { user, phone, ready, signedIn } = useAuthUser();
  /* Nhóm "Cài đặt khác" thu lại mặc định — xem ghi chú ở chỗ dựng hàng */
  const [showSettings, setShowSettings] = useState(false);
  // HẠNG CỦA TÔI (2026-08-01): premium gán ngoài đời ở /quan-tri, trong app
  // trước nay không có chỗ nào xác nhận ⇒ khách trả tiền phải vào Ra khơi thử
  // bật lớp Cá mới biết. `null` = chưa chắc, không bày gì (luật ở lib/tier.ts).
  const { access, premiumUntil, savedAccess } = useFeatureAccess();
  const [open, setOpen] = useState(false);
  /* sheet xác nhận cho nút Gỡ tài khoản khỏi máy này (xem forgetThisDevice) */
  const [confirmForget, setConfirmForget] = useState(false);
  const [mode, setMode] = useState<Mode>("gon");
  const [pushState, setPushState] = useState<PushUiState>("checking");
  const [pushError, setPushError] = useState<string | null>(null);
  // lối vào trang quản trị — CHỈ hiện cho STAFF (admin/manager). Dò quyền thật
  // qua /api/admin/health (200 = staff) thay vì đoán ở client. /quan-tri vẫn
  // tự bảo vệ ở API — nút này chỉ là lối tắt cho người có quyền.
  const [isStaff, setIsStaff] = useState(false);
  // Khoá VAPID lấy RUNTIME (DB-trước rồi env) — undefined = đang lấy.
  const [vapidKey, setVapidKey] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    /*  ⚠️ `signedIn`, KHÔNG `user` (sửa sau sync base 2026-08-04): app bỏ phiên
        Supabase (chuỗi cứng device-token), `user` null VĨNH VIỄN trên máy ngư
        dân ⇒ gate theo `user` thì nút "Trang quản trị" KHÔNG BAO GIỜ hiện cho
        admin đã đăng nhập (hoặc chỉ hiện chớp nhoáng lúc phiên tạm chưa bỏ).
        Và /api/admin/health xác thực bằng CHUỖI CỨNG nên PHẢI gửi tokenHeader()
        — fetch trần không kèm chuỗi thì luôn 401 ⇒ isStaff false. */
    if (!signedIn) {
      setIsStaff(false);
      return;
    }
    let alive = true;
    fetch(apiUrl("/api/admin/health"), { headers: tokenHeader() })
      .then((r) => {
        if (alive) setIsStaff(r.ok);
      })
      .catch(() => {
        if (alive) setIsStaff(false);
      });
    return () => {
      alive = false;
    };
  }, [signedIn]);

  useEffect(() => {
    if (!isPushSupported()) {
      setPushState("unsupported");
      return;
    }
    let alive = true;
    fetchVapidPublicKey().then((key) => {
      if (!alive) return;
      setVapidKey(key);
      if (!key) {
        setPushState("unconfigured");
        return;
      }
      getExistingPushSubscription().then(
        (sub) => alive && setPushState(sub ? "on" : "off"),
      );
    });
    return () => {
      alive = false;
    };
  }, []);

  /* GẮN MÁY ↔ TÀI KHOẢN có nói ra kết quả (2026-08-01p). Trước đây việc gắn
     chạy ngầm và im lặng, nên khi /quan-tri báo "chưa gán account nào" thì
     không ai biết hỏng ở khâu nào: chưa bật thông báo? máy chủ không đọc được
     phiên? hay mất sóng? Nay sheet Tài khoản nói thẳng. */
  const [attach, setAttach] = useState<SyncPushResult | null>(null);
  useEffect(() => {
    if (pushState !== "on" || !signedIn) return;
    void syncPushAccount().then(setAttach);
  }, [pushState, signedIn]);

  async function togglePush() {
    setPushError(null);
    if (pushState === "on") {
      setPushState("busy");
      await unsubscribeFromPush();
      setPushState("off");
      return;
    }
    if (!vapidKey) return; // chưa cấu hình khoá — nút đã ẩn/không bật
    setPushState("busy");
    const r = await subscribeToPush(vapidKey, phone);
    if (r.ok) {
      setPushState("on");
      // gắn ngay vào tài khoản đang đăng nhập, đừng đợi lần mở app sau
      void syncPushAccount().then(setAttach);
      return;
    }
    setPushState("off");
    setPushError(
      r.error === "denied"
        ? "Máy đang chặn thông báo — bà con vào phần cài đặt của máy để bật lại nhé."
        : "Chưa bật được — bà con kiểm tra mạng rồi thử lại nhé.",
    );
  }

  /* ĐĂNG XUẤT — có đồng hồ và có KIỂM KẾT QUẢ (sửa 2026-08-02, Extra-2).
     Bản cũ xoá hộp thư + gỡ push TRƯỚC rồi mới `await signOut()` không đồng hồ.
     Mất sóng thì signOut treo tới lúc trình duyệt bỏ cuộc: bà con VẪN đang đăng
     nhập, mà thư trong máy thì đã mất VĨNH VIỄN, nút thì kẹt. Nay: đăng xuất
     trước, chỉ khi máy chủ (hoặc auth-js) xác nhận xong mới dọn dữ liệu; hỏng
     thì nói thật một câu và trả nút về cho bà con bấm lại lúc có sóng. */
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  /* CÒN DẤU TÀI KHOẢN TRÊN MÁY NÀY KHÔNG — đọc trong effect (không đọc lúc
     render) để bản dựng máy chủ và bản vẽ đầu ở máy khớp nhau. */
  const [deviceBound, setDeviceBound] = useState(false);
  useEffect(() => {
    setDeviceBound(offlineIdentityPhone() !== null);
  }, [signedIn]);

  async function doSignOut() {
    if (signingOut) return;
    setSignOutError(null);
    setSigningOut(true);
    const supabase = createClient();
    let done = false;
    if (!supabase) {
      done = true; // demo mode (chưa cấu hình Supabase) — không có phiên để gỡ
    } else {
      /*  THU HỒI CHUỖI CỨNG Ở MÁY CHỦ (2026-08-02) — đây mới là việc chính sau
          khi app bỏ phiên Supabase. Không gọi thì hàng `device_tokens` nằm lại
          "đang hiệu lực" mãi: chuỗi trong máy đã xoá nên không ai dùng được, mà
          /quan-tri vẫn thấy máy đó như đang đăng nhập.
          `supabase.auth.signOut()` vẫn gọi kèm cho 15 máy còn mang phiên cũ
          trong nhịp phát hành này; máy đã đổi sang chuỗi thì nó là lệnh rỗng. */
      /*  ⚠️ CHỈ TÍNH LƯỢT THU HỒI KHI MÁY THẬT SỰ CÓ CHUỖI. Máy chưa có chuỗi
          (15 máy còn mang phiên cũ) gọi DELETE sẽ nhận `{ok:true, revoked:0}` —
          route cố ý trả 200 vì phía nó không có gì để làm. Đếm cái đó là thành
          công thì một cú `signOut()` HỎNG vì mất sóng bị che lại, và câu "Chưa
          đăng xuất được — chưa có sóng" (lá chắn Extra-2) thôi chạy đúng lúc nó
          cần nhất. */
      /*  ⚠️ CÓ CHUỖI THÌ **KẾT QUẢ THU HỒI LÀ CÂU TRẢ LỜI DUY NHẤT** (sửa
          2026-08-02h — phản biện bắt: bản vá trước KHÔNG thật sự vá).

          `supabase.auth.signOut()` chỉ gọi mạng khi CÒN phiên
          (`GoTrueClient._signOut` kiểm `data.session?.access_token`). Máy ngư
          dân sau 0026 không còn phiên nào — `/login` bỏ ngay sau khi cấp chuỗi —
          nên nó trả `{error: null}` **tức thì, offline, không một gói tin nào**.
          Với `revoked || signedOut` thì `signedOut` LUÔN true ⇒ `done` LUÔN true
          ⇒ câu "Chưa đăng xuất được — chưa có sóng" là MÃ CHẾT, và cú 503 mà
          route vừa được dạy trả về bị nuốt sạch.
          Hậu quả offline: chạm nhầm nút Đăng xuất giữa biển là xoá chuỗi + danh
          tính + dấu premium, không có sóng để đăng nhập lại ⇒ mất tài khoản trọn
          chuyến, mà hàng `device_tokens` thì ở lại `revoked_at = null` vĩnh viễn.

          Nay: máy CÓ chuỗi ⇒ chỉ tin `revoked`. Máy KHÔNG có chuỗi (15 máy phiên
          cũ) ⇒ mới tin `signedOut`. */
      const hadToken = readToken() !== null;
      done = await Promise.race([
        Promise.all([
          /*  `fetch` TRẦN + `tokenHeader()`, KHÔNG dùng `authedFetch`: hàm kia
              có quyền kết luận "máy bị đá" và bắn sự kiện `TOKEN_KICKED_EVENT`.
              Quyền đó phải nằm ở ĐÚNG MỘT chỗ trong app (`use-tier`) — và ở đây
              nó vừa thừa vừa sai nghĩa: bà con đang TỰ đăng xuất, không ai đá
              họ cả. Đường này cũng đang tự xoá chuỗi ngay sau đó rồi. */
          hadToken
            ? fetch(apiUrl("/api/auth/token"), {
                method: "DELETE",
                headers: tokenHeader(),
                signal: timeoutSignal(SIGN_OUT_MS),
              })
                /*  ⚠️ ĐỌC THÂN, KHÔNG CHỈ ĐỌC `r.ok` (sửa 2026-08-02i — vòng
                    đánh giá cuối bắt). Cổng wifi captive ở cảng trả **200 kèm
                    HTML đăng nhập** ⇒ `r.ok` true ⇒ app tưởng đã thu hồi ⇒ xoá
                    chuỗi + danh tính + dấu hạng, trong khi hàng `device_tokens`
                    ở lại `revoked_at = null` mãi mãi. Đúng ca mà route vừa được
                    dạy trả 503 để đỡ. */
                .then(async (r) => {
                  if (!r.ok) return false;
                  const j = (await r.json().catch(() => null)) as {
                    ok?: boolean;
                  } | null;
                  return j?.ok === true;
                })
                .catch(() => false)
            : Promise.resolve(false),
          supabase.auth
            .signOut()
            .then((r) => !r?.error)
            .catch(() => false),
        ]).then(([revoked, signedOut]) => (hadToken ? revoked : signedOut)),
        // đồng hồ: mất sóng thì signOut() có thể không bao giờ settle
        new Promise<boolean>((res) => setTimeout(() => res(false), SIGN_OUT_MS)),
      ]);
    }
    setSigningOut(false);
    if (!done) {
      setSignOutError("Chưa đăng xuất được — máy đang không có mạng. Thử lại lúc có sóng nhé.");
      return;
    }
    // ĐÃ đăng xuất thật mới dọn máy. Gỡ tài khoản khỏi máy này để tin nhắm
    // riêng của chủ tàu không chạy tới máy đang trong tay bạn thuyền (nhận
    // diện bằng endpoint nên không cần phiên); xoá hộp thư vì tàu dùng chung
    // điện thoại; quên danh tính VÀ xoá dấu hạng.
    //
    // XOÁ DẤU HẠNG GỌI THẲNG, KHÔNG QUA EFFECT (sửa 2026-08-02): auth-js bắn
    // `SIGNED_OUT` NGAY TRONG `await signOut()` ở trên, nên `hasUser` đã đổi
    // true→false lúc danh tính offline VẪN CÒN ⇒ effect canh
    // `shouldClearPremiumMark` trong use-tier chạy đúng lúc điều kiện chưa
    // thoả, rồi `forgetIdentity()` chạy sau lại không đổi dep nào ⇒ effect
    // không chạy lại ⇒ dấu premium NẰM LẠI MÁY. Chủ tàu đăng xuất ở cảng, đưa
    // máy cho bạn thuyền, ra khơi mất sóng là bạn thuyền dùng premium của chủ
    // tàu. Việc xoá quyền không được phụ thuộc thứ tự lập lịch của React.
    void detachPushAccount();
    clearInbox();
    // Đơn hàng đã lưu cũng là dữ liệu CỦA NGƯỜI TRƯỚC (SĐT nhận hàng, điểm
    // giao) — máy dùng chung trên tàu thì phải đi cùng hộp thư (2026-08-18).
    clearCachedOrders();
    // qua CỔNG DUY NHẤT (K7): "user-signed-out" = bà con TỰ BẤM và máy chủ đã
    // xác nhận — khác hẳn `SIGNED_OUT` auth-js tự bắn khi nó tự xoá phiên (C-7)
    // (cổng đã xoá luôn dấu hạng — `forgetIdentity` gọi `clearTierMark`, quan
    // hệ đó có test khoá trong offline-identity.test.ts. KHÔNG gọi lại ở đây:
    // một đường ghi thứ hai là một đường để người sau đi lệch.)
    /*  XOÁ CHUỖI TRONG MÁY. `signOutLocal("user")` gọi luôn cổng danh tính
        `applyIdentityAction("user-signed-out", false)` — bà con TỰ BẤM nghĩa là
        có ý trao máy cho người khác, nên xoá SẠCH: chuỗi + danh tính + dấu hạng.
        Khác hẳn nhánh BỊ MÁY KHÁC ĐÁ (`signOutLocal("kicked")`), nhánh đó chỉ
        xoá chuỗi và giữ nguyên dữ liệu đã tải. */
    signOutLocal("user");
    // HỒ SƠ CHỦ TÀU (tên/số tàu, thuyền viên, giấy tờ, nậu vựa…) cũng phải đi —
    // trước đây thiếu, người sau mở app còn thấy tên + số tàu của chủ cũ.
    wipeOwnerDataFromDevice();
    setDeviceBound(false);
    setOpen(false);
    router.refresh();
  }

  /* GỠ MÁY KHỎI TÀI KHOẢN KHI KHÔNG CÓ SÓNG (thêm 2026-08-02).
     Phiên Supabase sống ~1 giờ. Hết phiên là sheet này hiện "Đăng nhập" và
     GIẤU luôn nút Đăng xuất (`{user && …}`) — lúc đó máy vẫn còn danh tính,
     hộp thư và dấu hạng của người trước mà KHÔNG còn đường nào gỡ ra, vì gỡ
     kiểu tử tế thì cần sóng. Nút này dọn sạch phần nằm trong máy.

     CHỈ GỌI TỪ SHEET XÁC NHẬN (sửa 2026-08-02, hồi quy do chính bản vá trước
     đẻ ra): điều kiện hiện nút là `!user && deviceBound` — ĐÚNG trạng thái bác
     Tư rơi vào giữa biển sau C-7. Nút to hơn cả nút Đăng xuất, một chạm, không
     hoàn tác, mà thứ nó xoá lại chính là dấu premium vừa được mở lại. */
  function forgetThisDevice() {
    clearInbox();
    clearCachedOrders(); // xem ghi chú ở doSignOut
    /* GỠ TÀI KHOẢN KHỎI ĐĂNG KÝ THÔNG BÁO — thiếu chỗ này (bản trước quên,
       R7) thì endpoint push VĨNH VIỄN còn trỏ về chủ tàu: `syncPushAccount`
       chỉ chạy khi đã đăng nhập lại, nên không có đường bù nào. Tin nhắm riêng
       của chủ tàu vẫn nhảy lên màn khoá máy đang trong tay bạn thuyền.
       Mất sóng thì lời hứa này hụt — sheet xác nhận NÓI THẲNG chuyện đó. */
    void detachPushAccount();
    // cổng duy nhất (K7) — đã kèm xoá dấu hạng, đừng gọi thêm đường thứ hai
    applyIdentityAction("device-forget", false);
    clearKickedMark(); // máy đã quên tài khoản — thẻ "bị đá" hết lý do
    // Gỡ tài khoản = trao máy đi: hồ sơ chủ tàu (tên/số tàu, thuyền viên, giấy
    // tờ…) phải theo hộp thư + danh tính, không được ở lại cho người sau.
    wipeOwnerDataFromDevice();
    setDeviceBound(false);
    setConfirmForget(false);
    setOpen(false);
    router.refresh();
  }

  useEffect(() => {
    try {
      const m = window.localStorage.getItem(MODE_KEY);
      if (m === "to" || m === "gon" || m === "auto") setMode(m);
    } catch {
      // storage bị chặn — dùng mặc định "gon"
    }
  }, []);

  function applyMode(next: Mode) {
    setMode(next);
    try {
      window.localStorage.setItem(MODE_KEY, next);
    } catch {
      // không lưu được thì vẫn đổi cho phiên này
    }
    // Cố ý mutate DOM toàn cục: data-mode trên <html> điều khiển cỡ giao diện
    // qua CSS (globals.css), nằm ngoài cây React nên không thể làm bất biến.
    // eslint-disable-next-line react-hooks/immutability
    if (next === "auto") delete document.documentElement.dataset.mode;
    // eslint-disable-next-line react-hooks/immutability
    else document.documentElement.dataset.mode = next;
  }

  if (!ready) return <div className="mt-3 h-[2.75rem]" aria-hidden />;

  const name = (user?.user_metadata?.full_name as string | undefined)?.trim();
  const badge = tierBadge({ access, premiumUntil });

  return (
    <>
      {/* MỘT chip duy nhất trên hero — bấm mở menu phụ */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        /*  Sàn chạm 3.5rem = 56px (luật A5 + sàn dự án): đo thật 164×44px, mà
            đây là CỬA DUY NHẤT vào sheet Tài khoản, lại nằm trên nền gradient
            tối nên viền không rõ ngoài nắng. */
        className="mt-3 flex min-h-[3.5rem] max-w-full items-center gap-2 rounded-full bg-white/15 pl-2 pr-3.5 text-white backdrop-blur-sm transition active:scale-[0.97]"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20">
          <UsersIcon className="h-4.5 w-4.5" />
        </span>
        <span className="min-w-0 truncate text-[0.9375rem] font-bold">
          {/* khách lạ thấy thẳng "Đăng nhập" — "Tài khoản" trung tính không
              mời ai làm gì (roadmap hội đồng UX 2026-06-11) */}
          {signedIn && phone ? name || prettyPhone(phone) : "Đăng nhập"}
        </span>
        <ChevronRightIcon className="h-4 w-4 shrink-0 rotate-90 text-white/60" />
      </button>

      {/* bị đá tài khoản — thẻ đỏ inline ngay dưới chip (tầng 2, luôn nói) */}
      <KickedNotice />

      {open && (
        <BottomSheet title="Tài khoản" onClose={() => setOpen(false)}>
          {/* danh tính / đăng nhập */}
          {signedIn && phone ? (
            /*  Nút "Đăng xuất" về INLINE cuối hàng danh tính (luật A2/A3) —
                trước là dải full-width ăn riêng một hàng. */
            <div className="mb-4 flex items-stretch gap-2">
              <div className="min-w-0 flex-1 surface px-4 py-3">
              {name && (
                <p className="display text-[1.125rem] font-bold text-navy">
                  Bác {name}
                </p>
              )}
              <p className="text-[1rem] font-semibold text-foreground/70">
                {prettyPhone(phone)}
              </p>
              {/* HẠNG — chỉ hiện khi đã CHẮC (tierBadge trả null lúc đang tra),
                  khỏi nháy "thường" rồi mới đổi thành "Premium" */}
              {badge && (
                <div className="mt-3 border-t border-line pt-3">
                  <span
                    className={`inline-block rounded-full px-3 py-1 text-[0.875rem] font-bold ${
                      badge.tone === "premium"
                        ? "bg-ok-bg text-ok"
                        : "bg-field text-foreground/75"
                    }`}
                  >
                    {badge.label}
                  </span>
                  <p className="mt-1.5 text-[0.875rem] leading-snug text-foreground/70">
                    {badge.detail}
                  </p>
                </div>
              )}
              </div>
              <button
                type="button"
                disabled={signingOut}
                onClick={() => void doSignOut()}
                className={`${SQ_BTN} self-start bg-field text-trim disabled:opacity-60`}
              >
                <LockIcon className="h-6 w-6" />
                {signingOut ? "Đang thoát" : "Đăng xuất"}
              </button>
            </div>
          ) : (
            <>
              {/* ĐANG DÙNG QUYỀN ĐÃ LƯU (C-7, chủ dự án chốt 2026-08-02).
                  Máy đã tự quên phiên (auth-js `_removeSession()` khi làm mới
                  token gặp lỗi không phải mạng) nhưng quyền premium đã lưu vẫn
                  còn hạn. KHÔNG được giả vờ là đã đăng nhập, mà cũng không
                  được chỉ ném ra chữ "Đăng nhập" như thể quyền đã mất — giữa
                  biển thì đăng nhập lại là việc KHÔNG LÀM ĐƯỢC. Nói thẳng,
                  giọng bình thường, không doạ. */}
              {savedAccess && (
                <div className="mb-4 surface border-l-4 border-ok px-4 py-3">
                  <p className="display text-[1.125rem] font-bold leading-snug text-navy">
                    Đang dùng quyền đã lưu trên máy
                  </p>
                  <p className="mt-1 text-[1rem] leading-snug text-foreground/75">
                    Máy chưa hỏi lại được tài khoản. Bà con vẫn xem được phần đã
                    tải sẵn; đăng nhập lại khi có sóng để cập nhật.
                  </p>
                </div>
              )}
              {/* Lời mời đăng nhập ẨN khi máy khẳng định mất sóng (tầng 5,
                  2026-08-18): /login cần sóng, mời vào là ngõ cụt. Thay bằng
                  một dòng nói thật, không nút. */}
              {online ? (
                /*  Ô nút inline cuối hàng danh tính (luật A2/A3/A4). MỞ LẠI TỰ
                    ĐĂNG KÝ (2026-09-24): người mới TẠO tài khoản thẳng ở đây —
                    "Máy này chưa có tài khoản" giờ có đúng đường kế tiếp. Hai ô
                    vuông cùng hàng = CÙNG 56px, KHÔNG tốn thêm chiều dọc. Đăng
                    ký là CTA chính (cam) cho người chưa có; Đăng nhập cạnh bên
                    cho người đã có tài khoản (vd đang dùng máy khác). */
                <div className="mb-4 flex items-stretch gap-2">
                  <div className="flex min-w-0 flex-1 items-center rounded-2xl bg-background px-4 py-3">
                    <p className="text-[1rem] font-bold text-navy">
                      Máy này chưa có tài khoản
                    </p>
                  </div>
                  <Link
                    href="/dang-ky"
                    className={`${SQ_BTN} bg-trim text-white shadow-trim-cta`}
                  >
                    <PlusIcon className="h-6 w-6" />
                    Đăng ký
                  </Link>
                  <Link href="/login" className={`${SQ_BTN} bg-field text-navy`}>
                    <LockIcon className="h-6 w-6" />
                    Đăng nhập
                  </Link>
                </div>
              ) : (
                <p className="mb-4 rounded-2xl bg-field px-4 py-3 text-[1rem] leading-snug text-foreground/75">
                  Đăng ký và đăng nhập đều cần sóng — máy đang không có sóng. Có
                  sóng lại bà con mở lại chỗ này.
                </p>
              )}
            </>
          )}

          {/*  MỘT HÀNG "Cài đặt khác" gom năm nhóm việc không liên quan nhau
              (2026-08-29, luật C1/C2). Đo trước: sheet 527px/812px = 65% màn Ở
              TRẠNG THÁI NHẸ NHẤT (chưa đăng nhập, 11 dòng chữ); đã đăng nhập còn
              thêm thẻ danh tính + huy hiệu + nút Đăng xuất. Trần C2 là ~40%.
              Bà con mở chip này để ĐĂNG NHẬP / XEM HẠNG, không phải để đổi cỡ
              chữ hay đọc chính sách — nên KEY là danh tính + huy hiệu + một hàng
              hành động; phần còn lại thu lại. CHỈ đổi CHỖ ĐẶT, KHÔNG đụng cơ chế
              "gọn"/"to" (ngoài phạm vi đợt này). */}
          <div className="mb-4 flex items-stretch gap-2">
            <div className="flex min-w-0 flex-1 items-center rounded-2xl bg-background px-4 py-3">
              <p className="text-[1rem] font-bold text-navy">Cài đặt khác</p>
            </div>
            <button
              type="button"
              onClick={() => setShowSettings((v) => !v)}
              aria-expanded={showSettings}
              className={`${SQ_BTN} bg-background text-sea`}
            >
              <ChevronRightIcon
                className={`h-6 w-6 ${showSettings ? "-rotate-90" : "rotate-90"}`}
              />
              {showSettings ? "Thu" : "Mở"}
            </button>
          </div>

          {showSettings && (
            <>
          {/* cỡ giao diện — auto theo máy là NỀN; chỉ bày 2 tùy chọn ghi đè */}
          <p className="mb-1.5 px-1 text-[0.8125rem] font-bold uppercase tracking-wide text-foreground/65">
            Cỡ chữ và nút
          </p>
          {/*  Bỏ hai dòng hướng dẫn (D1): hai hàng chọn ngay dưới đã tự nói
              ("Chữ to — Luôn to rõ, dễ đọc ngoài nắng"). Đường về "auto" nay nói
              bằng TRẠNG THÁI trên chính hàng đang chọn, không bằng chữ dạy. */}
          <div className="mb-4 overflow-hidden surface">
            {MODES.map((m, i) => {
              const on = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => applyMode(on ? "auto" : m.id)}
                  aria-pressed={on}
                  className={`flex min-h-[3.5rem] w-full items-center gap-3 px-4 text-left ${
                    i > 0 ? "border-t border-line" : ""
                  }`}
                >
                  <span
                    className={`h-5 w-5 shrink-0 rounded-full border-2 ${
                      on ? "border-sea bg-sea" : "border-line"
                    }`}
                    aria-hidden
                  >
                    {on && (
                      <span className="m-auto mt-1 block h-1.5 w-1.5 rounded-full bg-white" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[1rem] font-bold text-navy">
                      {m.label}
                    </span>
                    <span className="block text-[0.8125rem] leading-snug text-foreground/70">
                      {m.sub}
                      {on ? " · bấm lại để theo dõi máy" : ""}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Bật thông báo (Web Push, 2026-07-28) — ẩn hẳn nếu máy không hỗ
              trợ hoặc server chưa cấu hình VAPID (không hiện nút vô dụng) */}
          {pushState !== "unsupported" && pushState !== "unconfigured" && (
            /* Hàng B1: [thân "Thông báo" + trạng thái flex-1] + [ô w-16] */
            <div className="mb-4 flex items-stretch gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-field px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white">
                  <BellIcon className="h-5 w-5 text-navy" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[1rem] font-bold text-navy">
                    Thông báo
                  </span>
                  <span className="block text-[0.8125rem] leading-snug text-foreground/70">
                    {pushState === "on"
                      ? attach === "attached"
                        ? "Đang bật · đã gắn tài khoản này"
                        : attach === "no-session"
                          ? "Đang bật · Chưa gắn tài khoản — bà con đăng nhập rồi mở lại app nhé"
                          : attach === "failed"
                            ? "Đang bật · chưa liên kết được (do mất sóng)"
                            : "Đang bật trên máy này"
                      : "Đang tắt · tin nhắn từ SDVICO sẽ không hiện lên máy"}
                  </span>
                </span>
              </div>
              <button
                type="button"
                onClick={togglePush}
                disabled={pushState === "checking" || pushState === "busy"}
                className={`${SQ_BTN} bg-field text-navy disabled:opacity-60`}
              >
                <BellIcon className="h-6 w-6" />
                {pushState === "on" ? "Tắt" : "Bật"}
              </button>
            </div>
          )}
          {pushError && (
            <p className="-mt-2.5 mb-4 px-1 text-[1rem] font-semibold leading-snug text-danger">
              {pushError}
            </p>
          )}

          {/* Lối vào TRANG QUẢN TRỊ — chỉ STAFF thấy (isStaff dò từ
              /api/admin/health). Ngư dân thường không thấy; quyền thật vẫn ở API. */}
          {isStaff && (
            <Link
              href="/quan-tri"
              onClick={() => setOpen(false)}
              className="mb-4 flex min-h-[3.5rem] w-full items-center gap-3 px-4 text-left surface"
            >
              <span className="min-w-0 flex-1 text-[1rem] font-bold text-navy">
                Trang quản trị
              </span>
              <ChevronRightIcon className="h-5 w-5 shrink-0 text-foreground/40" />
            </Link>
          )}

          {/* Đổi mật khẩu tự nguyện (2026-07-29) — trang /doi-mat-khau hỏi
              mật khẩu hiện tại rồi mới cho đổi */}
          {signedIn && (
            <Link
              href="/doi-mat-khau"
              onClick={() => setOpen(false)}
              className="mb-4 flex min-h-[3.5rem] w-full items-center gap-3 rounded-2xl bg-field px-4 text-left"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white">
                <LockIcon className="h-5 w-5 text-navy" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[1rem] font-bold text-navy">
                  Đổi mật khẩu
                </span>
                <span className="block text-[0.8125rem] leading-snug text-foreground/70">
                  Đặt mật khẩu mới cho tài khoản của bà con
                </span>
              </span>
              <ChevronRightIcon className="h-4 w-4 shrink-0 text-foreground/40" />
            </Link>
          )}

          {/* Chính sách quyền riêng tư — công khai, luôn tới được (App Store
              5.1.2 bắt buộc app có link trong ứng dụng, không chỉ trong hồ sơ). */}
          <Link
            href="/quyen-rieng-tu"
            onClick={() => setOpen(false)}
            className="mb-4 flex min-h-[3.5rem] w-full items-center gap-3 px-4 text-left surface"
          >
            <span className="min-w-0 flex-1 text-[1rem] font-bold text-navy">
              Chính sách quyền riêng tư
            </span>
            <ChevronRightIcon className="h-5 w-5 shrink-0 text-foreground/40" />
          </Link>
            </>
          )}

          {/* Nút "Đăng xuất" đã dời lên INLINE cuối hàng danh tính ở đầu sheet
              (luật A3) — chỉ còn câu báo lỗi ở lại. */}
          {signedIn && signOutError && (
            <p className="mt-2 px-1 text-center text-[1rem] font-semibold leading-snug text-danger">
              {signOutError}
            </p>
          )}

          {/* CHƯA đăng nhập được (phiên hết hạn / mất sóng) mà máy VẪN còn dấu
              tài khoản người trước → phải có đường gỡ, và đường đó không được
              cần sóng. Không có nó thì tàu dùng chung máy sẽ mang theo hộp thư
              và quyền premium của chủ tàu ra khơi. */}
          {!signedIn && deviceBound && (
            <div className="flex items-stretch gap-2">
              {/* dòng này mang TIN CHÍNH (nút xoá cái gì) — không được 14px */}
              <p className="min-w-0 flex-1 px-1 text-[0.9375rem] leading-snug text-foreground/70">
                Xoá khỏi máy: thư cũ, số điện thoại, hồ sơ tàu, sổ thuyền viên,
                giấy tờ, danh bạ đã lưu. Không cần sóng. Đăng nhập lại (có sóng)
                để lấy lại phần đã lưu trên mạng.
              </p>
              <button
                type="button"
                onClick={() => setConfirmForget(true)}
                className={`${SQ_BTN} bg-field text-navy`}
              >
                <TrashIcon className="h-6 w-6" />
                Gỡ máy này
              </button>
            </div>
          )}
        </BottomSheet>
      )}

      {/* XÁC NHẬN TRƯỚC KHI GỠ (sửa 2026-08-02). Nút trên nằm đúng chỗ bác Tư
          thấy giữa biển: phiên đã hết, quyền đang chạy bằng dấu lưu trong máy.
          Một chạm mà xoá luôn dấu đó thì bác mất dự báo cá cả chuyến — và
          "đăng nhập lại" là việc cần sóng, tức là không làm được ngay. */}
      {confirmForget && (
        <BottomSheet
          title="Xoá tài khoản khỏi máy này?"
          onClose={() => setConfirmForget(false)}
        >
          <p className="text-[1.125rem] leading-snug text-navy">
            Máy sẽ quên: thư cũ · số điện thoại · hồ sơ tàu · sổ thuyền viên ·
            giấy tờ · danh bạ · quyền premium đã lưu.
          </p>
          <p className="mt-2 text-[1rem] leading-snug text-foreground/75">
            Muốn dùng lại thì phải{" "}
            <span className="font-bold text-navy">
              đăng nhập lại — việc đó cần sóng
            </span>
            .
          </p>
          {/* NÓI ĐÚNG CÁI MÌNH LÀM ĐƯỢC (sửa 2026-08-02c): `detachPushAccount()`
              là bắn-rồi-quên, mất sóng là hụt và KHÔNG có hàng đợi thử lại;
              đường bù duy nhất là `syncPushAccount`, mà nó chỉ chạy lúc ĐĂNG
              NHẬP. Nên "cho tới lần có sóng sau" là một lời hứa sai — có sóng
              mà không ai đăng nhập thì endpoint vẫn trỏ về chủ tàu. */}
          <p className="mt-2 text-[0.9375rem] leading-snug text-foreground/70">
            Tin nhắn riêng cho chủ tàu có thể vẫn hiện trên máy này cho tới khi
            có người đăng nhập.
          </p>
          {/* CẶP NÚT XÁC NHẬN — MỘT KHUÔN CHO CẢ APP: `Thôi` / `<động từ>`.
              Cùng số chữ, cùng min-h 3.5rem (56px, sàn tap target); phân vai
              bằng NỀN (giữ nguyên có nền, hành động có nền trong suốt + màu
              trim), không bằng chiều cao. */}
          {/*  MỘT hàng ngang hai ô w-16 (luật A2/A3) — GIỮ NGUYÊN đường lùi:
              "Không" vẫn là ô đầu tiên, vẫn đóng sheet mà không xoá gì. */}
          <div className="mt-5 flex items-stretch justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmForget(false)}
              className={`${SQ_BTN} min-h-[3.5rem] bg-field text-navy`}
            >
              <CloseIcon className="h-6 w-6" />
              Thôi
            </button>
            <button
              type="button"
              onClick={forgetThisDevice}
              className={`${SQ_BTN} min-h-[3.5rem] bg-field text-trim`}
            >
              <TrashIcon className="h-6 w-6" />
              Xoá
            </button>
          </div>
        </BottomSheet>
      )}
    </>
  );
}
