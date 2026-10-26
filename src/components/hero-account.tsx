"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ChevronRightIcon, LockIcon, PhoneIcon, TrashIcon } from "@/components/icons";
import { SQ_BTN } from "@/components/ui/sq-btn";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { KairosAvatar } from "@/components/kairos/kairos-avatar";
import { authorToi } from "@/lib/kairos/ho-so";
import { loadFeedCache } from "@/lib/kairos/feed-client";
import { nhanDem } from "@/lib/kairos/chuong";
import { cartBucket } from "@/lib/cart";
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
import { clearMarketCart } from "@/lib/market/cart";
import { clearCachedMarketOrders } from "@/lib/market/orders-cache";
import { MARKET_SHOP_FLAG_KEY, clearShopFlag, loadShopFlag, saveShopFlag, type ShopFlag } from "@/lib/market/seller-flag";
import {
  applyIdentityAction,
  offlineIdentityPhone,
} from "@/lib/offline-identity";
import { useAuthUser } from "@/lib/use-auth";
import { useFeatureAccess } from "@/lib/use-tier";
import { tierBadge } from "@/lib/tier";
import { SDVICO_HOTLINE } from "@/data/sdvico-showcase";
import { NHAN } from "@/lib/labels";
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
import { Popover } from "@/components/ui/popover";

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

/*  NHỚ TRONG PHIÊN (TC-10, 2026-10-25): hai câu hỏi mạng này chỉ để nuôi MENU đang
    đóng (dòng "Trang quản trị" + nút Bật thông báo), trước đây bắn mỗi lần mount
    cho mọi ngư dân (99 % nhận 401). Nay chỉ hỏi khi menu MỞ, có đồng hồ, và nhớ
    câu trả lời ở mức module để mở menu lần hai không hỏi lại. Chỉ nhớ câu trả lời
    CHẮC (máy chủ trả lời), không nhớ "mất sóng". */
const MENU_FETCH_MS = 8000;
let staffCache: { phone: string | null; ok: boolean } | null = null;
let vapidCache: string | null | undefined;

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

/*  SEGMENT 3 NẤC trong ngăn Cài đặt (quyết định M, 2026-10-25): Gọn / Nút to / Theo máy.
    Trước đây "Theo máy" ẩn sau "bấm lại cái đang chọn" — một luật không ai đoán ra.
    NHÃN PHẢI NÓI ĐÚNG THỨ CÔNG TẮC LÀM (2026-08-29h): gốc chữ hai chế độ cùng 16px (chống
    iOS tự phóng), thứ thật sự đổi là chiều cao hàng và nút. MẶC ĐỊNH "gon" (2026-07-28). */
const MODES: { id: Mode; label: string; sub: string }[] = [
  { id: "gon", label: "Gọn", sub: "Nút thấp gọn — thấy nhiều hàng hơn" },
  { id: "to", label: "Nút to", sub: "Nút to, hàng cao — dễ bấm tay ướt" },
  { id: "auto", label: "Theo máy", sub: "Theo cỡ chữ máy đang đặt" },
];

/*  SỐ ĐƠN CHỜ của người bán (BH-11): đọc trường `pending` mà khu bán hàng ghi vào cờ
    `forfish.mshop.v1` lúc Tổng quan tải xong — KHÔNG request lúc mở app, badge cũ là gợi ý.
    `loadShopFlag` bỏ trường lạ nên đọc thô ở đây, cùng ngăn SĐT với cờ. */
function docDonCho(phone: string | null | undefined): number {
  try {
    const raw = window.localStorage.getItem(MARKET_SHOP_FLAG_KEY);
    if (!raw) return 0;
    const s = JSON.parse(raw) as { phone?: string; pending?: unknown } | null;
    if (!s || s.phone !== cartBucket(phone)) return 0;
    return typeof s.pending === "number" && Number.isFinite(s.pending) && s.pending > 0 ? Math.floor(s.pending) : 0;
  } catch {
    return 0;
  }
}

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
export function KickedNotice() {
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
  /*  ĐẶT NGOÀI HEADER, nguyên bề ngang (rà design Codex lần 2, 2026-10-19): bản
      trước render chung fragment với chip tài khoản nên lọt vào hàng tiêu đề,
      chữ bị ép vỡ 13 dòng cạnh "Chào bà con" + ô SQ_BTN xám to. Nay: chữ chảy tự
      nhiên, nút ở hàng cuối canh phải, cao bậc control; là việc ưu tiên trên màn
      nên nút mang màu cam (chip header giữ trung tính). Mất sóng: KHÔNG nút, KHÔNG
      ô đệm trống — nói đúng việc làm được. Viền + nền tự khai (không ghép
      `.surface` với border utility — hai bên tranh cùng thuộc tính `border`). */
  return (
    <div role="alert" className="rounded-xl border border-danger/40 bg-card px-4 py-3">
      <p className="text-[1rem] font-semibold leading-snug text-danger">
        Tài khoản đang dùng ở máy khác
      </p>
      <p className="mt-1 text-[0.9375rem] leading-snug text-foreground/75">
        Máy này ngừng nhận tin mới. Phần đã tải vẫn xem được.
      </p>
      {online ? (
        <div className="mt-2 flex justify-end">
          <Link
            href="/login"
            className="inline-flex h-(--h-ctl) items-center rounded-full bg-trim px-5 text-[0.9375rem] font-semibold text-white"
          >
            Đăng nhập
          </Link>
        </div>
      ) : (
        <p className="mt-1 text-[0.8125rem] leading-snug text-foreground/65">
          Có mạng để đăng nhập lại.
        </p>
      )}
    </div>
  );
}

/** @param light đầu màn NỀN SÁNG (Trang chủ từ 2026-10-19) — chip navy trên nền field, không trắng-trên-trong-suốt */
export function HeroAccount({ light = false }: { light?: boolean } = {}) {
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
  /* Ngăn đáy "Cài đặt" (TC-07): mở từ hàng "Cài đặt ›" trong menu, menu đóng trước */
  const [caiDat, setCaiDat] = useState(false);
  // HẠNG CỦA TÔI (2026-08-01): premium gán ngoài đời ở /quan-tri, trong app
  // trước nay không có chỗ nào xác nhận ⇒ khách trả tiền phải vào Ra khơi thử
  // bật lớp Cá mới biết. `null` = chưa chắc, không bày gì (luật ở lib/tier.ts).
  const { access, premiumUntil, savedAccess } = useFeatureAccess();
  const [open, setOpen] = useState(false);
  /** chip mở menu — menu NEO vào nó (Popover) */
  const [chipEl, setChipEl] = useState<HTMLButtonElement | null>(null);
  /* sheet xác nhận cho nút Gỡ tài khoản khỏi máy này (xem forgetThisDevice) */
  const [confirmForget, setConfirmForget] = useState(false);
  /* hộp xác nhận cho Đăng xuất (TC-03): một chạm từng xoá hồ sơ tàu/danh bạ/điểm ghim khỏi máy */
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [mode, setMode] = useState<Mode>("gon");
  const [pushState, setPushState] = useState<PushUiState>("checking");
  const [pushError, setPushError] = useState<string | null>(null);
  // lối vào trang quản trị — CHỈ hiện cho STAFF (admin/manager). Dò quyền thật
  // qua /api/admin/health (200 = staff) thay vì đoán ở client. /quan-tri vẫn
  // tự bảo vệ ở API — nút này chỉ là lối tắt cho người có quyền.
  const [isStaff, setIsStaff] = useState(false);
  // Khoá VAPID lấy RUNTIME (DB-trước rồi env) — undefined = đang lấy.
  const [vapidKey, setVapidKey] = useState<string | null | undefined>(undefined);
  /* mình trong bản lưu Kairos (chỉ localStorage) — chữ cái + màu avatar, KHÔNG gọi /me */
  const [toi, setToi] = useState<{ profileId: string; handle: string } | null>(null);
  useEffect(() => {
    setToi(authorToi(loadFeedCache(phone ?? null)?.posts ?? []));
  }, [phone]);
  /* số đơn chờ (BH-11) — đọc cờ máy lúc menu mở */
  const [donCho, setDonCho] = useState(0);

  useEffect(() => {
    /*  ⚠️ `signedIn`, KHÔNG `user` (sửa sau sync base 2026-08-04): app bỏ phiên
        Supabase (chuỗi cứng device-token), `user` null VĨNH VIỄN trên máy ngư
        dân ⇒ gate theo `user` thì nút "Trang quản trị" KHÔNG BAO GIỜ hiện cho
        admin đã đăng nhập (hoặc chỉ hiện chớp nhoáng lúc phiên tạm chưa bỏ).
        Và /api/admin/health xác thực bằng CHUỖI CỨNG nên PHẢI gửi tokenHeader()
        — fetch trần không kèm chuỗi thì luôn 401 ⇒ isStaff false.
        CHỈ HỎI KHI NGĂN CÀI ĐẶT MỞ (TC-10/TC-07) — dòng "Trang quản trị" nằm ở đó. */
    if (!signedIn) {
      setIsStaff(false);
      return;
    }
    if (!caiDat) return;
    if (staffCache && staffCache.phone === (phone ?? null)) {
      setIsStaff(staffCache.ok);
      return;
    }
    if (!online) return; // mất sóng: không hiện dòng quản trị, không đụng mạng
    let alive = true;
    fetch(apiUrl("/api/admin/health"), {
      headers: tokenHeader(),
      signal: timeoutSignal(MENU_FETCH_MS),
    })
      .then((r) => {
        // 200 = staff; 401/403 = không phải — đều là câu trả lời chắc, nhớ lại
        if (r.ok || r.status === 401 || r.status === 403) {
          staffCache = { phone: phone ?? null, ok: r.ok };
        }
        if (alive) setIsStaff(r.ok);
      })
      .catch(() => {
        if (alive) setIsStaff(false);
      });
    return () => {
      alive = false;
    };
  }, [caiDat, signedIn, online, phone]);

  /*  KÊNH NGƯỜI BÁN — hai dạng dòng (LEAD §4 #16 / 12 §9). Cờ `forfish.mshop.v1`
      trả lời "máy này có shop không" mà KHÔNG gọi mạng lúc mở app; chỉ khi SHEET
      MỞ và có sóng mới tra lại `GET /api/ban-hang/shop` (12 s, có `.catch`) rồi
      ghi cờ. Chưa có cờ + mất sóng ⇒ ẩn cả hai dòng — không mời bà con vào ngõ
      cụt giữa biển (tầng 5). */
  const [shopFlag, setShopFlag] = useState<ShopFlag | null>(null);
  useEffect(() => {
    if (!open || !signedIn) return;
    setShopFlag(loadShopFlag(phone));
    setDonCho(docDonCho(phone));
    if (!online) return; // mất sóng: dùng cờ đã có, không đụng mạng
    let alive = true;
    fetch(apiUrl("/api/ban-hang/shop"), {
      headers: tokenHeader(),
      signal: timeoutSignal(12000),
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { ok?: boolean; shop?: { status?: ShopFlag["status"] } | null } | null) => {
        if (!alive || !j?.ok) return;
        const flag: ShopFlag = {
          hasShop: !!j.shop,
          ...(j.shop?.status ? { status: j.shop.status } : {}),
          at: Date.now(),
        };
        saveShopFlag(phone, flag);
        setShopFlag(flag);
      })
      .catch(() => {
        /* mất sóng / hết giờ — giữ cờ cũ, không nói gì */
      });
    return () => {
      alive = false;
    };
  }, [open, signedIn, online, phone]);

  useEffect(() => {
    if (!isPushSupported()) {
      setPushState("unsupported");
      return;
    }
    /*  Khoá VAPID + trạng thái đăng ký CHỈ tra khi ngăn Cài đặt mở (TC-10): công tắc nằm
        trong đó, chưa ai mở thì chưa cần. Trong lúc tra, công tắc xám "checking" một nhịp.
        Khoá nhớ ở mức module; `getExistingPushSubscription` đọc máy, không tốn sóng. */
    if (!caiDat) return;
    let alive = true;
    const key$ = vapidCache !== undefined ? Promise.resolve(vapidCache) : fetchVapidPublicKey();
    key$.then((key) => {
      if (!alive) return;
      if (key) vapidCache = key; // null có thể là mất sóng — không nhớ
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
  }, [caiDat]);

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
    // Giỏ chợ vật tư + bản lưu đơn + cờ "có shop" cũng là dữ liệu CỦA NGƯỜI
    // TRƯỚC (12 §4.13) — đi cùng hộp thư, máy trên tàu là máy dùng chung.
    clearMarketCart(phone);
    clearCachedMarketOrders();
    clearShopFlag();
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
    clearMarketCart(phone);
    clearCachedMarketOrders();
    clearShopFlag();
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
    setCaiDat(false);
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

  if (!ready) return <div className={`${light ? "" : "mt-3 "}h-[2.75rem]`} aria-hidden />;

  const name = (user?.user_metadata?.full_name as string | undefined)?.trim();
  const badge = tierBadge({ access, premiumUntil });

  const chuCai = toi?.handle ?? name ?? "Bà con"; // không tên ⇒ "B" (Bà con), KHÔNG lấy số đầu SĐT ("0" vô nghĩa)

  return (
    <>
      {/*  AVATAR TRÒN 2.75rem (quyết định L, 2026-10-25) — như FB/Zalo: góc phải header là ảnh đại
          diện của chính mình, không SĐT, không ▾. Dùng chung khuôn `KairosAvatar nav` với "Trang
          tôi" của Kairos (một khuôn, không rẽ đôi); premium = vòng viền trim, không chữ. SĐT đầy
          đủ + hạng nằm trong menu. Chưa đăng nhập ⇒ nút chữ "Đăng nhập" (SQ_BTN navy) — VẪN mở
          menu (ở đó có Đăng ký/Đăng nhập, Cài đặt, và đường "Gỡ máy này" không cần sóng). */}
      <button
        type="button"
        ref={setChipEl}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={
          signedIn && phone
            ? `Tài khoản ${name || prettyPhone(phone)}${badge ? `, ${badge.label}` : ""}`
            : NHAN.dangNhap
        }
        className={
          signedIn && phone
            ? "flex shrink-0 rounded-full transition active:scale-[0.95]"
            : `${SQ_BTN} bg-navy text-white`
        }
      >
        {signedIn && phone ? (
          <KairosAvatar
            id={toi?.profileId ?? phone}
            name={chuCai}
            url={null}
            nav
            className={badge?.tone === "premium" ? "border-2 border-trim" : ""}
          />
        ) : (
          NHAN.dangNhap
        )}
      </button>

      {/* bị đá tài khoản: thẻ đỏ KHÔNG còn ở đây — trang đặt `<KickedNotice />`
          trong thân màn (xem page.tsx), ngoài hàng tiêu đề. */}

      {open && (
        /*  MENU TÀI KHOẢN NEO NGAY DƯỚI AVATAR (03 §6 mục 9, anh Long 2026-10-23: bấm nút thì phần
            hiện ra nằm cạnh nút — tay đang ở góc trên phải, không bắt kéo xuống đáy màn). Còn 4
            dòng (TC-07): danh tính · hạng · kênh bán · Cài đặt › — và Đăng xuất ở cuối. Chạm ra
            ngoài / Escape đóng, focus về avatar. */
        <Popover
          anchor={chipEl}
          label="Tài khoản"
          onClose={() => setOpen(false)}
          className="w-[20rem] max-w-[calc(100vw-1rem)] p-4"
        >
          <h3 className="display mb-3 text-[1.125rem] font-semibold text-navy">Tài khoản</h3>
          {/* danh tính / đăng nhập */}
          {signedIn && phone ? (
            /*  Hàng danh tính CHỈ CÒN CHỮ (TC-03, 2026-10-25): nút "Đăng xuất" dời xuống
                CUỐI menu và có hộp xác nhận — trước đứng sát số điện thoại, một chạm là
                xoá hồ sơ tàu/danh bạ/điểm ghim khỏi máy. */
            <div className="mb-4 flex items-stretch gap-2">
              {/* KHÔNG khung viền (rà bố cục 2026-10-22): thẻ viền 1px trông y hệt ô nhập liệu ⇒
                  bà con tưởng gõ được số. Danh tính là CHỮ, sát mép tiêu đề ngăn. */}
              <div className="min-w-0 flex-1 py-1">
              {name && (
                <p className="display text-[1.125rem] font-semibold text-navy">
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
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-[0.875rem] font-semibold ${
                        badge.tone === "premium"
                          ? "bg-ok-bg text-ok"
                          : "bg-field text-foreground/75"
                      }`}
                    >
                      {badge.label}
                    </span>
                    {/* TC-08: "Gọi SDVICO để mở…" là lời mời thì phải có nút. Ẩn khi mất
                        sóng (tầng 5 — gọi cần sóng, mời vào ngõ cụt là vô ích). */}
                    {badge.tone === "basic" && online && (
                      <a
                        href={`tel:${SDVICO_HOTLINE}`}
                        className={`${SQ_BTN} bg-field text-navy`}
                        aria-label="Gọi SDVICO"
                      >
                        <PhoneIcon className="h-4 w-4" />
                        {NHAN.goi}
                      </a>
                    )}
                  </div>
                  <p className="mt-1.5 text-[0.875rem] leading-snug text-foreground/70">
                    {badge.detail}
                  </p>
                </div>
              )}
              </div>
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
                <div className="mb-4 rounded-2xl border border-ok/30 bg-ok-bg px-4 py-3">
                  <p className="display text-[1.125rem] font-semibold leading-snug text-navy">
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
                /*  KHỐI MỜI GỌN (anh Long 2026-10-20: "2 nút đăng nhập đăng ký này ko
                    đẹp"): trước là câu bị ép 2 dòng + hai ô vuông lệch cỡ (cam có
                    bóng, xám không) chen chung một hàng. Nay: một thẻ — câu một
                    dòng ở trên, HAI NÚT NGANG BẰNG NHAU bên dưới (cùng cao --h-cta,
                    bo 0.75rem, chữ 1rem). Đăng ký = hành động chính (cam đặc) cho
                    người mới; Đăng nhập = viền mảnh cho người đã có tài khoản. */
                <div className="mb-4 rounded-2xl border border-line bg-card p-4">
                  <p className="text-[1rem] font-semibold leading-snug text-navy">
                    Máy này chưa có tài khoản
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Link
                      href="/dang-ky"
                      className="flex h-(--h-cta) items-center justify-center rounded-xl bg-trim text-[1rem] font-semibold text-white transition active:scale-[0.98]"
                    >
                      Đăng ký
                    </Link>
                    <Link
                      href="/login"
                      className="flex h-(--h-cta) items-center justify-center rounded-xl border border-line bg-card text-[1rem] font-semibold text-navy transition active:scale-[0.98]"
                    >
                      Đăng nhập
                    </Link>
                  </div>
                </div>
              ) : (
                <p className="mb-4 rounded-2xl bg-field px-4 py-3 text-[1rem] leading-snug text-foreground/75">
                  Đăng ký và đăng nhập đều cần sóng — máy đang không có sóng. Có
                  sóng lại bà con mở lại chỗ này.
                </p>
              )}
            </>
          )}

          {/*  LỐI VÀO KÊNH NGƯỜI BÁN (12 §9) — hai dạng dòng:
               (a) đã có shop ⇒ dòng thường "Kênh người bán" + badge đỏ số đơn chờ (BH-11, đọc cờ máy);
               (b) chưa có shop ⇒ dòng MỜ, không icon nổi, chỉ mời một câu;
               (c) chưa biết (chưa có cờ, mất sóng) ⇒ không dòng nào.
               ĐẶT NGAY DƯỚI KHỐI DANH TÍNH, TRÊN hàng Cài đặt (2026-09-06): đây là lối vào một
               TRỤC việc, không phải một tuỳ chọn cài đặt. */}
          {signedIn && shopFlag?.hasShop && (
            <Link
              href="/ban-hang"
              onClick={() => setOpen(false)}
              className="mb-4 flex min-h-[3.5rem] w-full items-center gap-3 px-4 text-left surface"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[1rem] font-semibold text-navy">
                  Kênh người bán
                  {shopFlag.status === "cho_duyet" && " · đang chờ duyệt"}
                </span>
                <span className="block text-[0.8125rem] leading-snug text-foreground/70">
                  Đăng sản phẩm, xử lý đơn, thống kê
                </span>
              </span>
              {donCho > 0 && (
                <span
                  className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-danger px-1.5 text-[0.75rem] font-bold text-white"
                  aria-label={`${donCho} đơn chờ`}
                >
                  {nhanDem(donCho)}
                </span>
              )}
              <ChevronRightIcon className="h-5 w-5 shrink-0 text-foreground/40" />
            </Link>
          )}
          {signedIn && shopFlag && !shopFlag.hasShop && (
            <Link
              href="/ban-hang/dang-ky"
              onClick={() => setOpen(false)}
              className="mb-4 flex min-h-[3.5rem] w-full items-center gap-3 text-left text-[1rem] text-foreground/65"
            >
              <span className="min-w-0 flex-1">Bà con có bán vật tư? Đăng ký shop</span>
              <ChevronRightIcon className="h-5 w-5 shrink-0 text-foreground/40" />
            </Link>
          )}

          {/*  HÀNG "Cài đặt ›" (TC-07, 2026-10-25): trước là nhóm thu/mở xoè ngay trong Popover —
              708px cuộn trong một lớp nổi lệch phải không có ×, chính `ui/popover.tsx` cấm nội
              dung dài. Nay ĐÓNG menu rồi mở ngăn đáy (có tiêu đề, ×, back đóng). */}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setCaiDat(true);
            }}
            className="mb-4 flex min-h-[3.5rem] w-full items-center gap-3 px-4 text-left surface"
          >
            <span className="min-w-0 flex-1 text-[1rem] font-semibold text-navy">{NHAN.caiDat}</span>
            <ChevronRightIcon className="h-5 w-5 shrink-0 text-foreground/40" />
          </button>

          {/*  ĐĂNG XUẤT Ở CUỐI MENU + XÁC NHẬN (TC-03, 2026-10-25). Việc phá huỷ (máy quên
              hồ sơ tàu, danh bạ, điểm ghim — thứ KHÔNG đồng bộ) không đứng cạnh số điện
              thoại cho chạm nhầm; hàng này nằm cuối, cùng khuôn với "Gỡ máy này". */}
          {signedIn && (
            <div className="flex items-stretch gap-2">
              <p className="min-w-0 flex-1 self-center text-[0.9375rem] leading-snug text-foreground/70">
                Thoát tài khoản khỏi máy này. Cần sóng.
              </p>
              <button
                type="button"
                disabled={signingOut}
                onClick={() => setConfirmSignOut(true)}
                className={`${SQ_BTN} bg-field text-trim disabled:opacity-60`}
              >
                <LockIcon className="h-6 w-6" />
                {signingOut ? "Đang thoát" : NHAN.dangXuat}
              </button>
            </div>
          )}
          {signedIn && signOutError && (
            <p className="mt-2 px-1 text-center text-[1rem] font-semibold leading-snug text-danger">
              {signOutError}
            </p>
          )}
        </Popover>
      )}

      {caiDat && (
        /*  NGĂN "CÀI ĐẶT" (quyết định M): danh sách kẻ mảnh — Cỡ chữ · Thông báo · Đổi mật khẩu ·
            Trang quản trị (staff) · Quyền riêng tư · Gỡ máy này (đỏ, cuối). Đóng ⇒ focus về avatar
            (Popover đã đóng trước nên ngăn không tự biết nút mở). */
        <BottomSheet
          title={NHAN.caiDat}
          kieu="xem"
          onClose={() => {
            setCaiDat(false);
            chipEl?.focus({ preventScroll: true });
          }}
        >
          <ul className="divide-y divide-line">
            {/* Cỡ chữ — segment 3 nấc, nhãn ≤2 chữ; dòng phụ nói đúng thứ nấc đang chọn làm */}
            <li className="py-3">
              <p className="text-[1rem] font-semibold text-navy">Cỡ chữ</p>
              <p className="mt-0.5 text-[0.8125rem] leading-snug text-foreground/70">
                {MODES.find((m) => m.id === mode)?.sub}
              </p>
              <div className="mt-2 flex rounded-xl bg-field p-0.5" role="group" aria-label="Cỡ chữ">
                {MODES.map((m) => {
                  const on = mode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => applyMode(m.id)}
                      className={`h-(--h-ctl) flex-1 rounded-[0.625rem] text-[0.9375rem] font-semibold transition ${
                        on ? "bg-card text-navy shadow-sm" : "text-foreground/70"
                      }`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </li>

            {/* Thông báo (Web Push) — công tắc + trạng thái một dòng; ẩn hẳn nếu máy không hỗ trợ
                hoặc server chưa cấu hình VAPID (không hiện công tắc vô dụng) */}
            {pushState !== "unsupported" && pushState !== "unconfigured" && (
              <li>
                <button
                  type="button"
                  role="switch"
                  aria-checked={pushState === "on"}
                  onClick={togglePush}
                  disabled={pushState === "checking" || pushState === "busy"}
                  className="flex min-h-(--h-row) w-full items-center gap-3 py-2 text-left disabled:opacity-60"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[1rem] font-semibold text-navy">Thông báo</span>
                    <span className="block text-[0.8125rem] leading-snug text-foreground/70">
                      {pushState === "checking" || pushState === "busy"
                        ? "Đang kiểm tra…"
                        : pushState === "on"
                          ? attach === "attached"
                            ? "Đang bật · đã gắn tài khoản này"
                            : attach === "no-session"
                              ? "Đang bật · chưa gắn tài khoản — đăng nhập rồi mở lại app"
                              : attach === "failed"
                                ? "Đang bật · chưa liên kết được — mở lại app khi sóng tốt"
                                : "Đang bật trên máy này"
                          : "Đang tắt · tin bão và tin SDVICO không hiện lên máy"}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className={`flex h-7 w-12 shrink-0 items-center rounded-full px-0.5 transition ${
                      pushState === "on" ? "justify-end bg-ok" : "justify-start bg-line"
                    }`}
                  >
                    <span className="h-6 w-6 rounded-full bg-white shadow" />
                  </span>
                </button>
                {pushError && (
                  <p className="pb-3 text-[1rem] font-semibold leading-snug text-danger">{pushError}</p>
                )}
              </li>
            )}

            {/* Đổi mật khẩu tự nguyện (2026-07-29) — /doi-mat-khau hỏi mật khẩu hiện tại rồi mới cho đổi */}
            {signedIn && (
              <li>
                <Link
                  href="/doi-mat-khau"
                  onClick={() => setCaiDat(false)}
                  className="flex min-h-(--h-row) w-full items-center gap-3 py-2 text-left active:bg-field"
                >
                  <span className="min-w-0 flex-1 text-[1rem] font-semibold text-navy">Đổi mật khẩu</span>
                  <ChevronRightIcon className="h-5 w-5 shrink-0 text-foreground/40" />
                </Link>
              </li>
            )}

            {/* Lối vào TRANG QUẢN TRỊ — chỉ STAFF thấy (isStaff dò từ /api/admin/health); quyền thật vẫn ở API */}
            {isStaff && (
              <li>
                <Link
                  href="/quan-tri"
                  onClick={() => setCaiDat(false)}
                  className="flex min-h-(--h-row) w-full items-center gap-3 py-2 text-left active:bg-field"
                >
                  <span className="min-w-0 flex-1 text-[1rem] font-semibold text-navy">Trang quản trị</span>
                  <ChevronRightIcon className="h-5 w-5 shrink-0 text-foreground/40" />
                </Link>
              </li>
            )}

            {/* Chính sách quyền riêng tư — công khai, luôn tới được (App Store 5.1.2 bắt buộc link trong app) */}
            <li>
              <Link
                href="/quyen-rieng-tu"
                onClick={() => setCaiDat(false)}
                className="flex min-h-(--h-row) w-full items-center gap-3 py-2 text-left active:bg-field"
              >
                <span className="min-w-0 flex-1 text-[1rem] font-semibold text-navy">Quyền riêng tư</span>
                <ChevronRightIcon className="h-5 w-5 shrink-0 text-foreground/40" />
              </Link>
            </li>

            {/* CHƯA đăng nhập được (phiên hết hạn / mất sóng) mà máy VẪN còn dấu tài khoản người
                trước → phải có đường gỡ, và đường đó không được cần sóng. Không có nó thì tàu dùng
                chung máy sẽ mang theo hộp thư và quyền premium của chủ tàu ra khơi. */}
            {!signedIn && deviceBound && (
              <li>
                <button
                  type="button"
                  onClick={() => setConfirmForget(true)}
                  className="flex min-h-(--h-row) w-full items-center gap-3 py-2 text-left active:bg-field"
                >
                  <TrashIcon className="h-5 w-5 shrink-0 text-danger" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[1rem] font-semibold text-danger">Gỡ máy này</span>
                    <span className="block text-[0.8125rem] leading-snug text-foreground/70">
                      Xoá thư cũ, số điện thoại, hồ sơ tàu, giấy tờ, danh bạ khỏi máy. Không cần sóng.
                    </span>
                  </span>
                </button>
              </li>
            )}
          </ul>
        </BottomSheet>
      )}

      {/* XÁC NHẬN TRƯỚC KHI GỠ (sửa 2026-08-02). Nút trên nằm đúng chỗ bác Tư
          thấy giữa biển: phiên đã hết, quyền đang chạy bằng dấu lưu trong máy.
          Một chạm mà xoá luôn dấu đó thì bác mất dự báo cá cả chuyến — và
          "đăng nhập lại" là việc cần sóng, tức là không làm được ngay. */}
      {/* XÁC NHẬN ĐĂNG XUẤT (TC-03): cùng câu liệt kê với "Gỡ máy này" — máy quên gì
          thì nói đúng thứ đó; phần đã đồng bộ đăng nhập lại là lấy lại. */}
      {confirmSignOut && (
        <ConfirmDialog
          title="Đăng xuất khỏi máy này?"
          cancelLabel="Thôi"
          confirmLabel={NHAN.dangXuat}
          onCancel={() => setConfirmSignOut(false)}
          onConfirm={() => {
            setConfirmSignOut(false);
            void doSignOut();
          }}
        >
          <p className="mt-1 text-[1rem] leading-snug text-navy">
            Máy sẽ quên: thư cũ · số điện thoại · hồ sơ tàu · sổ thuyền viên · giấy tờ · danh
            bạ · quyền premium đã lưu.
          </p>
          <p className="mt-2 text-[1rem] leading-snug text-foreground/75">
            Đăng nhập lại là lấy lại phần đã đồng bộ. Đăng xuất{" "}
            <span className="font-semibold text-navy">cần sóng</span>.
          </p>
        </ConfirmDialog>
      )}

      {confirmForget && (
        /*  HỘP XÁC NHẬN DÙNG CHUNG (rà bố cục 2026-10-22): trước dựng bằng BottomSheet thứ hai
            với hai ô vuông lệch phải — khác mọi xác nhận phá huỷ khác của app. Nay qua
            ConfirmDialog: cặp "Thôi | Xoá" nằm ngang, Thôi trái, focus vào Thôi trước. */
        <ConfirmDialog
          title="Xoá tài khoản khỏi máy này?"
          cancelLabel="Thôi"
          confirmLabel="Xoá"
          onCancel={() => setConfirmForget(false)}
          onConfirm={forgetThisDevice}
        >
          <p className="mt-1 text-[1rem] leading-snug text-navy">
            Máy sẽ quên: thư cũ · số điện thoại · hồ sơ tàu · sổ thuyền viên · giấy tờ · danh
            bạ · quyền premium đã lưu.
          </p>
          <p className="mt-2 text-[1rem] leading-snug text-foreground/75">
            Muốn dùng lại thì phải{" "}
            <span className="font-semibold text-navy">đăng nhập lại — việc đó cần sóng</span>.
          </p>
          {/* NÓI ĐÚNG CÁI MÌNH LÀM ĐƯỢC (sửa 2026-08-02c): `detachPushAccount()` là bắn-rồi-quên,
              mất sóng là hụt — "cho tới lần có sóng sau" là lời hứa sai. */}
          <p className="mt-2 text-[0.9375rem] leading-snug text-foreground/70">
            Tin nhắn riêng cho chủ tàu có thể vẫn hiện trên máy này cho tới khi có người đăng nhập.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}
