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
// GHI Ở ĐÂU: `src/lib/use-auth.ts` — CHỈ khi có user THẬT (getUser trả user,
//   hoặc onAuthStateChange bắn ra session có user). Nhánh `null` KHÔNG đụng vào.
// XOÁ Ở ĐÂU: `src/components/hero-account.tsx` (bà con tự bấm Đăng xuất VÀ máy
//   chủ đã xác nhận xong; hoặc bấm "Xoá dữ liệu tài khoản khỏi máy này" khi
//   phiên đã hết mà không có sóng để đăng xuất tử tế) và `/quan-tri` (staff
//   SDVICO đăng xuất ở bờ). Không có đường tự động nào khác.
//
// VÌ SAO KHÔNG LEO THANG QUYỀN: sổ này chỉ trả lời "AI", KHÔNG trả lời
// "HẠNG GÌ". Dấu premium (`forfish.tier.premium.v1`) vẫn CHỈ được bật bởi một
// truy vấn `customers` thành công lúc còn sóng; ở đây chỉ có quyền XOÁ dấu đó
// (khi đổi người), không bao giờ có quyền bật. Máy dùng chung trên tàu: SĐT mới
// khác SĐT đang lưu ⇒ ghi đè danh tính VÀ xoá dấu tier trong cùng một hành động,
// để người sau không thừa hưởng quyền đã trả tiền của người trước. Chốt thật vẫn
// ở middleware/RLS khi có mạng.

import { normalizeVnPhone } from "@/lib/phone";
import { TIER_CACHE_KEY, TIER_UNTIL_KEY } from "@/lib/tier";

/** Quy ước key forfish.* (xem ops/state-registry.md) */
export const IDENTITY_KEY = "forfish.identity.v1";

interface StoredIdentity {
  /** SĐT đã chuẩn hoá bằng ĐÚNG hàm máy chủ dùng (normalizeVnPhone) */
  phone: string;
  /** mốc gắn danh tính — để soát khi cần, không dùng để hết hạn */
  boundAt: number;
}

/** SĐT thô → dạng máy chủ ghi. Rỗng/không ra số → null (đừng lưu rác "0"). */
function normalize(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const n = normalizeVnPhone(raw);
  return n && n !== "0" ? n : null;
}

function readStored(): StoredIdentity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(IDENTITY_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as StoredIdentity;
    return typeof s?.phone === "string" && s.phone ? s : null;
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
  const cur = readStored();
  if (cur?.phone === phone) return phone; // cùng người — khỏi ghi lại
  try {
    if (cur && cur.phone !== phone) {
      // người khác lên máy: dấu premium của người trước không được ở lại
      window.localStorage.removeItem(TIER_CACHE_KEY);
      window.localStorage.removeItem(TIER_UNTIL_KEY);
    }
    window.localStorage.setItem(
      IDENTITY_KEY,
      JSON.stringify({ phone, boundAt: Date.now() } satisfies StoredIdentity),
    );
  } catch {
    /* không lưu được — app vẫn chạy, chỉ mất đường lùi offline */
  }
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
  clearTierMark();
}
