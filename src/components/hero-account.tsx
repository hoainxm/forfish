"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  BellIcon,
  ChevronRightIcon,
  LockIcon,
  UsersIcon,
} from "@/components/icons";
import { createClient } from "@/lib/supabase/client";
import { clearInbox } from "@/lib/inbox";
import {
  applyIdentityAction,
  offlineIdentityPhone,
} from "@/lib/offline-identity";
import { useAuthUser } from "@/lib/use-auth";
import { useFeatureAccess } from "@/lib/use-tier";
import { tierBadge } from "@/lib/tier";
import { readToken, signOutLocal, tokenHeader } from "@/lib/device-token-store";
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

type Mode = "auto" | "to" | "gon";

// "Theo máy" (auto) không bày thành lựa chọn (góp ý user 2026-06-11) — chỉ
// 2 tùy chọn; bấm lại cái đang chọn = về auto. MẶC ĐỊNH là "gon" (2026-07-28).
const MODES: { id: Exclude<Mode, "auto">; label: string; sub: string }[] = [
  { id: "to", label: "Chữ to", sub: "Luôn to rõ, dễ đọc ngoài nắng" },
  { id: "gon", label: "Gọn", sub: "Mật độ như các app thường dùng" },
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

export function HeroAccount() {
  const router = useRouter();
  const { user, phone, ready } = useAuthUser();
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
  // Khoá VAPID lấy RUNTIME (DB-trước rồi env) — undefined = đang lấy.
  const [vapidKey, setVapidKey] = useState<string | null | undefined>(undefined);

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
    if (pushState !== "on" || !user) return;
    void syncPushAccount().then(setAttach);
  }, [pushState, user]);

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
        ? "Trình duyệt đang chặn quyền thông báo — vào cài đặt trình duyệt để bật lại."
        : "Chưa bật được — kiểm tra mạng rồi thử lại.",
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
  }, [user]);

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
                .then((r) => r.ok)
                .catch(() => false)
            : Promise.resolve(false),
          supabase.auth
            .signOut()
            .then((r) => !r?.error)
            .catch(() => false),
        ]).then(([revoked, signedOut]) => revoked || signedOut),
        // đồng hồ: mất sóng thì signOut() có thể không bao giờ settle
        new Promise<boolean>((res) => setTimeout(() => res(false), SIGN_OUT_MS)),
      ]);
    }
    setSigningOut(false);
    if (!done) {
      setSignOutError("Chưa đăng xuất được — chưa có sóng. Thử lại lúc có sóng nhé.");
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
    /* GỠ TÀI KHOẢN KHỎI ĐĂNG KÝ THÔNG BÁO — thiếu chỗ này (bản trước quên,
       R7) thì endpoint push VĨNH VIỄN còn trỏ về chủ tàu: `syncPushAccount`
       chỉ chạy khi đã đăng nhập lại, nên không có đường bù nào. Tin nhắm riêng
       của chủ tàu vẫn nhảy lên màn khoá máy đang trong tay bạn thuyền.
       Mất sóng thì lời hứa này hụt — sheet xác nhận NÓI THẲNG chuyện đó. */
    void detachPushAccount();
    // cổng duy nhất (K7) — đã kèm xoá dấu hạng, đừng gọi thêm đường thứ hai
    applyIdentityAction("device-forget", false);
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
        className="mt-3 flex min-h-[2.75rem] max-w-full items-center gap-2 rounded-full bg-white/15 pl-2 pr-3.5 text-white backdrop-blur-sm transition active:scale-[0.97]"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20">
          <UsersIcon className="h-4.5 w-4.5" />
        </span>
        <span className="min-w-0 truncate text-[0.9375rem] font-bold">
          {/* khách lạ thấy thẳng "Đăng nhập" — "Tài khoản" trung tính không
              mời ai làm gì (roadmap hội đồng UX 2026-06-11) */}
          {user && phone ? name || prettyPhone(phone) : "Đăng nhập"}
        </span>
        <ChevronRightIcon className="h-4 w-4 shrink-0 rotate-90 text-white/60" />
      </button>

      {open && (
        <BottomSheet title="Tài khoản" onClose={() => setOpen(false)}>
          {/* danh tính / đăng nhập */}
          {user && phone ? (
            <div className="mb-4 surface px-4 py-3">
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
                    Máy chưa hỏi lại được tài khoản. Bạn vẫn xem được phần đã
                    tải sẵn; đăng nhập lại khi có sóng để cập nhật.
                  </p>
                </div>
              )}
              <Link
                href="/login"
                className="display mb-4 flex min-h-[3.5rem] w-full items-center justify-center rounded-full bg-trim text-[1.125rem] font-bold text-white shadow-[0_10px_24px_-8px_rgba(228,87,46,0.55)] transition active:scale-[0.98]"
              >
                Đăng nhập / Đăng ký
              </Link>
            </>
          )}

          {/* cỡ giao diện — auto theo máy là NỀN; chỉ bày 2 tùy chọn ghi đè */}
          <p className="mb-1.5 px-1 text-[0.8125rem] font-bold uppercase tracking-wide text-foreground/65">
            Cỡ giao diện
          </p>
          <p className="mb-2 px-1 text-[0.875rem] leading-snug text-foreground/70">
            {mode === "auto"
              ? "Đang tự theo cỡ chữ cài trong điện thoại. Muốn khác thì chọn:"
              : "Bấm lại lựa chọn để quay về tự theo máy."}
          </p>
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
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Bật thông báo (Web Push, 2026-07-28) — ẩn hẳn nếu máy không hỗ
              trợ hoặc server chưa cấu hình VAPID (không hiện nút vô dụng) */}
          {pushState !== "unsupported" && pushState !== "unconfigured" && (
            <button
              type="button"
              onClick={togglePush}
              disabled={pushState === "checking" || pushState === "busy"}
              className="mb-4 flex min-h-[3.5rem] w-full items-center gap-3 rounded-2xl bg-field px-4 text-left disabled:opacity-60"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white">
                <BellIcon className="h-5 w-5 text-navy" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[1rem] font-bold text-navy">
                  {pushState === "on" ? "Đã bật thông báo" : "Bật thông báo"}
                </span>
                <span className="block text-[0.8125rem] leading-snug text-foreground/70">
                  {pushState === "on"
                    ? attach === "attached"
                      ? "Đã gắn với tài khoản này · nhấn để tắt"
                      : attach === "no-session"
                        ? "CHƯA gắn tài khoản — đăng nhập rồi mở lại app"
                        : attach === "failed"
                          ? "Chưa gắn được (mất sóng) — mở lại lúc có sóng"
                          : "Nhấn để tắt trên máy này"
                    : "Nhận tin nhắn từ SDVICO ngay trên điện thoại"}
                </span>
              </span>
            </button>
          )}
          {pushError && (
            <p className="-mt-2.5 mb-4 px-1 text-[0.8125rem] font-semibold text-danger">
              {pushError}
            </p>
          )}

          {/* Đổi mật khẩu tự nguyện (2026-07-29) — trang /doi-mat-khau hỏi
              mật khẩu hiện tại rồi mới cho đổi */}
          {user && (
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
                  Đặt mật khẩu mới cho tài khoản của bạn
                </span>
              </span>
              <ChevronRightIcon className="h-4 w-4 shrink-0 text-foreground/40" />
            </Link>
          )}

          {user && (
            <>
              <button
                type="button"
                disabled={signingOut}
                onClick={() => void doSignOut()}
                /* min-h 3.5rem = 56px, ĐÚNG SÀN tap target của dự án
                   (03-design-system). Muốn nút bớt nổi thì hạ bằng MÀU/NỀN,
                   không hạ bằng chiều cao — tay ngư dân không nhỏ đi theo. */
                className="flex min-h-[3.5rem] w-full items-center justify-center rounded-full bg-field text-[1.0625rem] font-bold text-trim transition active:scale-[0.98] disabled:opacity-60"
              >
                {signingOut ? "Đang đăng xuất…" : "Đăng xuất"}
              </button>
              {signOutError && (
                <p className="mt-2 px-1 text-center text-[0.875rem] font-semibold text-danger">
                  {signOutError}
                </p>
              )}
            </>
          )}

          {/* CHƯA đăng nhập được (phiên hết hạn / mất sóng) mà máy VẪN còn dấu
              tài khoản người trước → phải có đường gỡ, và đường đó không được
              cần sóng. Không có nó thì tàu dùng chung máy sẽ mang theo hộp thư
              và quyền premium của chủ tàu ra khơi. */}
          {!user && deviceBound && (
            <>
              <button
                type="button"
                onClick={() => setConfirmForget(true)}
                className="flex min-h-[3.5rem] w-full items-center justify-center rounded-full bg-field px-4 text-center text-[1.0625rem] font-bold text-navy transition active:scale-[0.98]"
              >
                Gỡ tài khoản khỏi máy này
              </button>
              {/* dòng này mang TIN CHÍNH (nút xoá cái gì) — không được 14px */}
              <p className="mt-2 px-1 text-center text-[0.9375rem] leading-snug text-foreground/70">
                Xoá thư cũ và số điện thoại đã lưu trong máy. Không cần sóng.
                Dữ liệu trên máy chủ vẫn còn. Đăng nhập lại được khi có sóng.
              </p>
            </>
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
            Máy sẽ quên: thư cũ · số điện thoại đã lưu · quyền premium đã lưu.
          </p>
          <p className="mt-2 text-[1.0625rem] leading-snug text-foreground/75">
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
            Thông báo nhắm riêng có thể còn tới máy này cho tới khi có người
            đăng nhập trên máy.
          </p>
          {/* CẶP NÚT XÁC NHẬN — MỘT KHUÔN CHO CẢ APP: `Thôi` / `<động từ>`.
              Cùng số chữ, cùng min-h 3.5rem (56px, sàn tap target); phân vai
              bằng NỀN (giữ nguyên có nền, hành động có nền trong suốt + màu
              trim), không bằng chiều cao. */}
          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setConfirmForget(false)}
              className="display flex min-h-[3.5rem] w-full items-center justify-center rounded-full bg-field text-[1.125rem] font-bold text-navy transition active:scale-[0.98]"
            >
              Thôi
            </button>
            <button
              type="button"
              onClick={forgetThisDevice}
              className="flex min-h-[3.5rem] w-full items-center justify-center rounded-full text-[1.0625rem] font-bold text-trim transition active:scale-[0.98]"
            >
              Xoá
            </button>
          </div>
        </BottomSheet>
      )}
    </>
  );
}
