// DANH TÍNH OFFLINE — "ai đang dùng máy này khi KHÔNG hỏi được máy chủ".
//
// VÌ SAO CÓ (biên bản ops/audit-offline-2026-08-02, khuôn lỗi K6):
// Access token Supabase sống ~1 giờ. Mất sóng quá 1 giờ thì `getUser()` và cả
// `onAuthStateChange` đều trả `null` — auth-js còn TỰ XOÁ PHIÊN khi refresh gặp
// lỗi "không phải mạng" (400/401/500/408/429/thân HTML của gateway vệ tinh hay
// captive portal ở cảng). App nghe theo cái `null` đó rồi coi bà con như đã
// đăng xuất ⇒ hộp thư biến mất (C-1) và dấu premium bị xoá (C-7, C-8). Dữ liệu
// vẫn nằm nguyên trong máy, chỉ là KHÔNG CÒN ĐƯỜNG NÀO ĐỌC TỚI NÓ giữa biển.
//
// Sổ này ghi lại SĐT của lần đăng nhập gần nhất, để lúc mất sóng app còn biết
// chọn đúng ngăn dữ liệu và biết "chưa hẳn là đã đăng xuất".
//
// GHI/XOÁ ĐI QUA ĐÂU: `applyIdentityAction` ở cuối file — CỔNG DUY NHẤT (K7).
//   · `src/lib/use-auth.ts` truyền thẳng tên sự kiện auth-js vào đó; nhánh
//     `null` (kể cả `SIGNED_OUT` do auth-js TỰ xoá phiên) ra "keep".
//   · `src/components/hero-account.tsx` truyền `"user-signed-out"` (bà con tự
//     bấm Đăng xuất VÀ máy chủ đã xác nhận xong) hoặc `"device-forget"` (nút Gỡ
//     tài khoản khỏi máy này, dùng khi phiên đã hết mà không có sóng).
//   · `src/lib/use-tier.ts` truyền `"session-gone-no-identity"` — lưới đỡ, xem
//     `identityAction`.
//   Không có đường tự động nào khác.
//
// VÌ SAO KHÔNG LEO THANG QUYỀN: sổ này chỉ trả lời "AI", KHÔNG trả lời
// "HẠNG GÌ". Dấu premium (`forfish.tier.premium.v1`) vẫn CHỈ được bật bởi một
// truy vấn `customers` thành công lúc còn sóng; ở đây chỉ có quyền XOÁ dấu đó
// (khi đổi người), không bao giờ có quyền bật. Máy dùng chung trên tàu: SĐT mới
// khác SĐT đang lưu ⇒ ghi đè danh tính VÀ xoá dấu tier trong cùng một hành động,
// để người sau không thừa hưởng quyền đã trả tiền của người trước. Chốt thật vẫn
// ở middleware/RLS khi có mạng.

import { isValidVnPhone, normalizeVnPhone } from "@/lib/phone";
import { TIER_CACHE_KEY, TIER_UNTIL_KEY } from "@/lib/tier";

/** Quy ước key forfish.* (xem ops/state-registry.md) */
export const IDENTITY_KEY = "forfish.identity.v1";

/** Sự kiện báo "sổ danh tính / dấu hạng trong máy vừa đổi" — hook nào đang giữ
 *  bản sao trong state thì đọc lại. Có nó vì việc XOÁ QUYỀN không được phụ
 *  thuộc thứ tự lập lịch của React (xem clearTierMark). */
export const IDENTITY_EVENT = "forfish:identity";

function announce(): void {
  if (typeof window === "undefined") return;
  try {
    const w = window as unknown as { dispatchEvent?: (e: Event) => boolean };
    if (typeof w.dispatchEvent === "function" && typeof Event === "function") {
      w.dispatchEvent(new Event(IDENTITY_EVENT));
    }
  } catch {
    /* môi trường không có sự kiện (test / WebView lạ) — bỏ qua, không ném */
  }
}

/**
 * ĐĂNG KÝ NGHE "sổ danh tính / dấu hạng vừa đổi" — MỘT CỬA cho mọi hook.
 *
 * VÌ SAO KHÔNG ĐỂ MỖI HOOK TỰ `addEventListener` (sửa 2026-08-02c, hồi quy):
 * `use-tier` có nghe `IDENTITY_EVENT`, `use-auth` thì KHÔNG — nên sau khi bấm
 * Đăng xuất, `identityPhone` trong `use-auth` còn nguyên SĐT chủ tàu (state của
 * client component không bị `router.refresh()` reset). Hộp thư lấy `phone` từ
 * hook đó ⇒ `acceptRefresh("090…", null) === false` ⇒ câu trả lời "chỉ tin
 * chung" của máy chủ bị bỏ qua ⇒ MÀN HÌNH GIỮ NGUYÊN DANH SÁCH CŨ và bạn thuyền
 * đọc được tin nhắm riêng của chủ tàu (trái bất biến CÁCH LY TÀI KHOẢN ở đầu
 * lib/inbox.ts). Gom vào một hàm để hook nào cũng nghe ĐỦ, không ai nghe thiếu.
 *
 * NGHE THÊM `storage` (K-tab): `dispatchEvent` chỉ vang TRONG MỘT TAB. Đăng
 * xuất ở tab A thì tab B vẫn tưởng còn người — điện thoại một tab nên hiếm,
 * nhưng `/quan-tri` chạy desktop nhiều tab là ca thật. `e.key === null` = tab
 * kia gọi `localStorage.clear()`, cũng phải đọc lại.
 *
 * KHÔNG BAO GIỜ ném (SSR, WebView lạ, `window` giả trong test env node).
 */
export function subscribeIdentity(onChange: () => void): () => void {
  const noop = () => {};
  if (typeof window === "undefined") return noop;
  const w = window as unknown as {
    addEventListener?: (t: string, f: (e: Event) => void) => void;
    removeEventListener?: (t: string, f: (e: Event) => void) => void;
  };
  if (
    typeof w.addEventListener !== "function" ||
    typeof w.removeEventListener !== "function"
  ) {
    return noop;
  }
  const same = () => onChange();
  const onStorage = (e: Event) => {
    const key = (e as StorageEvent).key;
    if (
      key != null &&
      key !== IDENTITY_KEY &&
      key !== TIER_CACHE_KEY &&
      key !== TIER_UNTIL_KEY
    ) {
      return;
    }
    onChange();
  };
  try {
    w.addEventListener(IDENTITY_EVENT, same);
    w.addEventListener("storage", onStorage);
  } catch {
    return noop;
  }
  return () => {
    try {
      w.removeEventListener?.(IDENTITY_EVENT, same);
      w.removeEventListener?.("storage", onStorage);
    } catch {
      /* bỏ qua */
    }
  };
}

interface StoredIdentity {
  /** SĐT đã chuẩn hoá bằng ĐÚNG hàm máy chủ dùng (normalizeVnPhone) — dùng để
   *  chọn NGĂN hộp thư, phải khớp từng ký tự với máy chủ. */
  phone: string;
  /** ĐỊNH DANH THẬT của người dùng (localpart email, thường hoá). Xem
   *  `identityKey`. Bản ghi đời cũ (trước 2026-08-02) KHÔNG có trường này. */
  key?: string;
  /** mốc gắn danh tính — để soát khi cần, không dùng để hết hạn */
  boundAt: number;
}

/** SĐT thô → dạng máy chủ ghi. Rỗng/không ra số → null (đừng lưu rác "0"). */
function normalize(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const n = normalizeVnPhone(raw);
  return n && n !== "0" ? n : null;
}

/**
 * ĐỊNH DANH THẬT — so NGƯỜI bằng cái này, KHÔNG bằng `phone`.
 *
 * VÌ SAO TÁCH (sửa 2026-08-02, R5): `normalizeVnPhone` bóc hết chữ, chỉ giữ
 * chữ số, rồi thêm "0" vào đầu. Nên `duclong292` và `abc292` cùng ra `"0292"`,
 * `ketoan2` ra `"02"`. Chốt cũ `cur?.phone === phone` vì thế coi HAI NGƯỜI KHÁC
 * NHAU là một ⇒ `return` sớm trước khối xoá dấu hạng ⇒ NGƯỜI SAU THỪA HƯỞNG
 * PREMIUM CỦA NGƯỜI TRƯỚC — đúng thứ chú thích đầu file tuyên bố đang chặn.
 *
 * KHÔNG chuyển sang "chỉ nhận SĐT VN hợp lệ" (isValidVnPhone): tài khoản email
 * thật của nhóm SDVICO sẽ mất danh tính ⇒ dựng lại C-1 (hộp thư biến mất) cho
 * đúng nhóm đó. Giữ `phone` để chọn ngăn, thêm `key` để so người.
 *
 * SĐT VN HỢP LỆ thì khoá là DẠNG CHUẨN HOÁ, không phải chuỗi thô: "0912345678",
 * "84912345678", "+84 912 345 678" là MỘT người, xoá dấu premium của họ chỉ vì
 * đăng nhập viết khác kiểu là xoá oan. Chuỗi không phải SĐT (localpart email)
 * thì mới lấy nguyên văn, thường hoá — vì đó là thứ duy nhất còn phân biệt
 * được `duclong292` với `abc292`.
 */
function identityKey(raw: string): string {
  const s = raw.trim();
  return isValidVnPhone(s) ? normalizeVnPhone(s) : s.toLowerCase();
}

function readStored(): StoredIdentity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(IDENTITY_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as StoredIdentity;
    if (typeof s?.phone !== "string" || !s.phone) return null;
    /* bản ghi đời cũ không có `key` — KHÔNG vá đại ở đây (xem rememberIdentity:
       vá đại = coi người cũ thành người lạ = xoá oan dấu premium lúc nâng cấp) */
    return typeof s.key === "string" && s.key ? s : { ...s, key: undefined };
  } catch {
    /* SSR / chế độ riêng tư / JSON hỏng — coi như chưa có ai */
    return null;
  }
}

/** SĐT của người đang dùng máy này (đã chuẩn hoá), null nếu chưa gắn ai. */
export function offlineIdentityPhone(): string | null {
  return readStored()?.phone ?? null;
}

/**
 * XOÁ DẤU HẠNG khỏi máy này — hàm thẳng, KHÔNG qua effect React.
 *
 * VÌ SAO ĐỨNG RIÊNG (sửa 2026-08-02, hồi quy): trước đây dấu tier chỉ được xoá
 * bởi một `useEffect` trong use-tier canh `shouldClearPremiumMark`. Lúc bấm
 * Đăng xuất, auth-js bắn `SIGNED_OUT` NGAY TRONG `await signOut()` ⇒ `hasUser`
 * đổi true→false khi `forgetIdentity()` CHƯA chạy ⇒ effect chạy lúc danh tính
 * vẫn còn ⇒ không xoá; rồi `forgetIdentity()` chạy sau lại không đổi dep nào ⇒
 * effect không chạy lại ⇒ DẤU PREMIUM Ở LẠI MÁY. Chủ tàu đăng xuất ở cảng, đưa
 * máy cho bạn thuyền, ra khơi mất sóng là bạn thuyền dùng premium của chủ tàu.
 * Việc xoá quyền không được phụ thuộc thứ tự lập lịch của React.
 *
 * KHÔNG BAO GIỜ ném (chế độ riêng tư iOS / storage đầy).
 */
export function clearTierMark(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TIER_CACHE_KEY);
    window.localStorage.removeItem(TIER_UNTIL_KEY);
  } catch {
    /* bỏ qua */
  }
  announce();
}

/**
 * Gắn máy này với một SĐT. Trả về SĐT đã chuẩn hoá (null nếu không dùng được).
 *
 * ĐỔI NGƯỜI = ĐỔI QUYỀN: SĐT mới khác SĐT đang lưu thì xoá dấu premium NGAY
 * trong cùng hành động này. Nếu tách làm hai bước thì có một khe thời gian máy
 * mang danh tính người mới mà vẫn còn dấu premium của người cũ — đúng thứ luật
 * cách ly tài khoản cấm (cùng luật với hộp thư và service worker).
 *
 * KHÔNG BAO GIỜ ném: localStorage có thể bị chặn (chế độ riêng tư iOS) hoặc đầy.
 */
export function rememberIdentity(rawPhone: string | null | undefined): string | null {
  const phone = normalize(rawPhone);
  if (typeof window === "undefined") return phone;
  if (!phone) {
    /* KHÔNG CHUẨN HOÁ ĐƯỢC thì cũng phải quên người cũ (sửa 2026-08-02).
       Trước đây chỗ này `return` sớm. Chỗ gọi (use-auth) chỉ gọi khi thấy user
       THẬT, nên "không ra số" nghĩa là vừa có NGƯỜI KHÁC đăng nhập bằng tài
       khoản email thật / tài khoản kỹ thuật — mà danh tính và dấu premium của
       người TRƯỚC thì vẫn nằm nguyên trên máy ⇒ người mới thừa hưởng quyền đã
       trả tiền của người cũ ngay khi ra khơi mất sóng. Không biết là ai thì
       không được giữ quyền của ai. */
    forgetIdentity(); // quên danh tính = xoá luôn dấu hạng (xem hàm bên dưới)
    return null;
  }
  const key = identityKey(String(rawPhone ?? ""));
  const cur = readStored();
  /* SO NGƯỜI BẰNG `key`, KHÔNG BẰNG `phone` (xem identityKey).
     BẢN GHI ĐỜI CŨ (chưa có `key`) thì không có gì để so ⇒ lùi về chốt cũ (so
     `phone`) rồi NÂNG CẤP TẠI CHỖ. Bắt buộc phải vậy: nếu coi bản cũ là "người
     lạ" thì lần mở app đầu tiên sau khi cập nhật app sẽ XOÁ OAN dấu premium của
     chính chủ — mà lúc đó có khi bà con đang giữa biển, không đăng nhập lại
     được để lấy dấu về. */
  const legacy = cur !== null && !cur.key;
  const samePerson = cur !== null && (legacy ? cur.phone === phone : cur.key === key);
  if (samePerson) {
    if (!legacy) return phone; // cùng người, bản ghi đã đủ — khỏi ghi lại
    try {
      // nâng cấp bản ghi cũ: thêm `key`, KHÔNG đụng dấu hạng
      window.localStorage.setItem(
        IDENTITY_KEY,
        JSON.stringify({
          phone,
          key,
          boundAt: cur.boundAt ?? Date.now(),
        } satisfies StoredIdentity),
      );
    } catch {
      /* không lưu được — lần sau nâng cấp lại, không mất gì */
    }
    return phone;
  }
  try {
    if (cur) {
      // người khác lên máy: dấu premium của người trước không được ở lại
      window.localStorage.removeItem(TIER_CACHE_KEY);
      window.localStorage.removeItem(TIER_UNTIL_KEY);
    }
    window.localStorage.setItem(
      IDENTITY_KEY,
      JSON.stringify({ phone, key, boundAt: Date.now() } satisfies StoredIdentity),
    );
  } catch {
    /* không lưu được — app vẫn chạy, chỉ mất đường lùi offline */
  }
  announce();
  return phone;
}

/**
 * Gọi lúc ĐĂNG XUẤT THẬT (đã xác nhận với máy chủ), hoặc khi máy không còn biết
 * người đang dùng là ai. Không ném.
 *
 * QUÊN NGƯỜI = BỎ QUYỀN, MỘT HÀNH ĐỘNG KHÔNG TÁCH RỜI (2026-08-02): xoá danh
 * tính mà để dấu hạng ở lại thì máy thành "không biết ai, nhưng vẫn premium" —
 * đúng thứ máy dùng chung trên tàu KHÔNG được phép có. Gộp vào đây để mọi chỗ
 * gọi đều đúng luật, khỏi phải nhớ gọi kèm.
 */
export function forgetIdentity(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(IDENTITY_KEY);
  } catch {
    /* bỏ qua */
  }
  clearTierMark(); // đã kèm announce()
}

/* ── CỔNG DUY NHẤT ĐỔI DANH TÍNH ───────────────────────────────────────────
   VÌ SAO CÓ (2026-08-02, K7): `use-auth.ts` cố ý BẤT ĐỐI XỨNG — thấy user thì
   nhớ, thấy `null` thì KHÔNG đụng gì. Đó là lá chắn của cả C-1 (hộp thư biến
   mất), C-7 (mất quyền premium) và C-8 (dấu hạng bị xoá): access token sống ~1
   giờ, mà `null` ở đó phần lớn nghĩa là "chưa hỏi được máy chủ", không phải "đã
   đăng xuất". Nhưng nhìn vào mã thì nó trông y hệt một chỗ viết thiếu — người
   sau rất dễ "dọn dẹp" thành `u ? remember : forget`, và BA lỗi CHẶN sống lại
   cùng lúc mà `npm test` vẫn xanh 100% (mọi ca test cũ gọi thẳng
   `rememberIdentity`, không ca nào đi qua hook).

   Nay luật viết thành HÀM THUẦN có test, và mọi chỗ ghi/xoá đều đi qua đây. */

export type IdentityAction = "remember" | "forget" | "keep";

/**
 * `event` = tên sự kiện auth-js (`INITIAL_SESSION` · `SIGNED_IN` ·
 * `TOKEN_REFRESHED` · `SIGNED_OUT` · …), hoặc `"user-signed-out"` khi BÀ CON TỰ
 * BẤM Đăng xuất và máy chủ đã xác nhận, hoặc `"device-forget"` từ nút Gỡ tài
 * khoản khỏi máy này, hoặc `"session-gone-no-identity"` — LƯỚI ĐỠ của use-tier:
 * đã kiểm xong phiên, kiểm KHÔNG lỗi, không có ai đăng nhập, VÀ máy cũng không
 * còn nhớ ai (`shouldClearPremiumMark`). Lúc đó không còn danh tính nào để mất,
 * việc duy nhất còn lại là bỏ dấu hạng — đi qua cổng cho khỏi có đường ghi thứ
 * hai. KHÔNG có đường quên nào khác.
 *
 * ⚠️ `SIGNED_OUT` CỦA AUTH-JS KHÔNG PHẢI LÀ QUÊN. Đó chính là tín hiệu của ca
 * C-7: `_removeSession()` (làm mới token gặp lỗi không phải mạng) kết thúc bằng
 * `_notifyAllSubscribers('SIGNED_OUT', null)`. Nghe theo nó là tự tay khoá lại
 * đúng con bug vừa vá — nên nó nằm ở nhánh `keep`, y như mọi `null` khác.
 */
export function identityAction(
  event: string,
  hasSessionUser: boolean,
): IdentityAction {
  if (
    event === "user-signed-out" ||
    event === "device-forget" ||
    event === "session-gone-no-identity"
  ) {
    return "forget";
  }
  return hasSessionUser ? "remember" : "keep";
}

/**
 * Thi hành `identityAction` — NGƯỜI GHI DUY NHẤT của sổ danh tính.
 *
 * Trả SĐT mới của máy sau hành động, hoặc `undefined` khi KHÔNG đụng gì
 * (`keep`) để chỗ gọi biết mà giữ nguyên state đang có.
 */
export function applyIdentityAction(
  event: string,
  hasSessionUser: boolean,
  rawPhone?: string | null,
): string | null | undefined {
  const action = identityAction(event, hasSessionUser);
  if (action === "keep") return undefined;
  if (action === "forget") {
    forgetIdentity();
    return null;
  }
  return rememberIdentity(rawPhone);
}
