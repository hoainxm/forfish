// @vitest-environment jsdom
//
// CỔNG CHẠY THẬT CHO SỔ DANH TÍNH (thêm 2026-08-02c).
//
// VÌ SAO PHẢI CÓ FILE NÀY: cổng cũ (`identity-gate.test.ts`) chỉ SO CHUỖI trong
// `use-auth.ts`. Một dòng duy nhất giữ nguyên cả ba chuỗi nó kiểm:
//
//   const p = applyIdentityAction(u ? event : "user-signed-out", !!u, …);
//
// ⇒ `session === null` (refresh token hỏng giữa biển) thành "user-signed-out"
// ⇒ QUÊN ⇒ C-1 (hộp thư biến mất) + C-7 (mất quyền premium) + C-8 (dấu hạng bị
// xoá) sống lại CÙNG LÚC, mà `npm test` vẫn xanh 100%. Bảng chân trị của
// `identityAction` cũng không cứu được: lỗi nằm ở ĐỐI SỐ TRUYỀN VÀO, không ở
// hàm.
//
// Nên ở đây hook được RENDER THẬT, và sự kiện được BẮN đúng như auth-js bắn
// ngoài đời. Chỉ file này chạy môi trường jsdom (docblock trên) — 1511 test còn
// lại vẫn chạy env node như cũ, không chậm đi.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

/* Bộ giả auth-js. `vi.hoisted` vì `vi.mock` bị nâng lên đầu file — biến thường
   sẽ còn trong vùng chết lúc module được nạp. */
const bus = vi.hoisted(() => ({
  cb: null as null | ((event: string, session: unknown) => void),
  /** user mà `getUser()` trả về lúc mở app (null = "chưa hỏi được / chưa ai") */
  user: null as unknown,
  error: null as unknown,
}));

vi.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: () => true,
  createClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: bus.user }, error: bus.error }),
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        bus.cb = cb;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
  }),
}));

import { useAuthUser } from "@/lib/use-auth";
import {
  IDENTITY_KEY,
  forgetIdentity,
  rememberIdentity,
} from "@/lib/offline-identity";
import { TIER_CACHE_KEY, TIER_UNTIL_KEY } from "@/lib/tier";

/** user Supabase như repo này thật sự có: SĐT nằm trong email ảo, `phone` rỗng */
function fakeUser(phone: string) {
  return { id: `id-${phone}`, phone: "", email: `${phone}@sdvico.local` };
}

/** BÀ CON ĐANG ĐĂNG NHẬP, ĐÃ TRẢ TIỀN — trạng thái máy trước khi ra khơi */
function seedSignedInPremium(phone = "0912345678") {
  rememberIdentity(phone);
  window.localStorage.setItem(TIER_CACHE_KEY, "1");
  window.localStorage.setItem(TIER_UNTIL_KEY, "2027-08-01T00:00:00Z");
}

/** để mount effect + promise của getUser() chạy xong */
async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

/** bắn sự kiện auth-js y như thư viện bắn */
async function emit(event: string, session: unknown) {
  await act(async () => {
    bus.cb?.(event, session);
    await Promise.resolve();
  });
}

beforeEach(() => {
  window.localStorage.clear();
  bus.cb = null;
  bus.user = null;
  bus.error = null;
});

afterEach(() => {
  cleanup();
});

describe("useAuthUser render THẬT — `null` không bao giờ là ĐĂNG XUẤT", () => {
  it("dây nối còn sống: hook có đăng ký onAuthStateChange", async () => {
    // ca đối chứng — thiếu nó thì mọi `emit` bên dưới thành không làm gì cả và
    // cả file này xanh vĩnh viễn mà không kiểm được gì
    renderHook(() => useAuthUser());
    await settle();
    expect(bus.cb).toBeTypeOf("function");
  });

  it("⚠️ SIGNED_OUT + null (auth-js TỰ xoá phiên) → GIỮ NGUYÊN sổ + dấu hạng", async () => {
    seedSignedInPremium();
    const { result } = renderHook(() => useAuthUser());
    await settle();

    await emit("SIGNED_OUT", null);

    expect(window.localStorage.getItem(IDENTITY_KEY)).not.toBeNull();
    expect(window.localStorage.getItem(TIER_CACHE_KEY)).toBe("1");
    expect(window.localStorage.getItem(TIER_UNTIL_KEY)).toBe(
      "2027-08-01T00:00:00Z",
    );
    // và hook vẫn chỉ đúng NGĂN hộp thư của bà con (C-1)
    expect(result.current.phone).toBe("0912345678");
  });

  it("TOKEN_REFRESHED + null (làm mới token hỏng giữa biển) → GIỮ NGUYÊN", async () => {
    seedSignedInPremium();
    const { result } = renderHook(() => useAuthUser());
    await settle();

    await emit("TOKEN_REFRESHED", null);

    expect(window.localStorage.getItem(IDENTITY_KEY)).not.toBeNull();
    expect(window.localStorage.getItem(TIER_CACHE_KEY)).toBe("1");
    expect(result.current.phone).toBe("0912345678");
  });

  it("INITIAL_SESSION + null lúc mở app ngoài khơi → GIỮ NGUYÊN", async () => {
    seedSignedInPremium();
    renderHook(() => useAuthUser());
    await settle();

    await emit("INITIAL_SESSION", null);

    expect(window.localStorage.getItem(IDENTITY_KEY)).not.toBeNull();
    expect(window.localStorage.getItem(TIER_CACHE_KEY)).toBe("1");
  });

  it("getUser() trả null lúc mount cũng KHÔNG được quên", async () => {
    seedSignedInPremium();
    bus.user = null;
    renderHook(() => useAuthUser());
    await settle();

    expect(window.localStorage.getItem(IDENTITY_KEY)).not.toBeNull();
    expect(window.localStorage.getItem(TIER_CACHE_KEY)).toBe("1");
  });

  it("SIGNED_IN + user → NHỚ (cổng vẫn phải ghi được, không chỉ biết giữ)", async () => {
    const { result } = renderHook(() => useAuthUser());
    await settle();

    await emit("SIGNED_IN", { user: fakeUser("0987654321") });

    expect(window.localStorage.getItem(IDENTITY_KEY)).toContain("0987654321");
    expect(result.current.phone).toBe("0987654321");
  });

  it("ĐỔI NGƯỜI trên máy dùng chung → dấu hạng người trước không ở lại", async () => {
    seedSignedInPremium("0912345678");
    renderHook(() => useAuthUser());
    await settle();

    await emit("SIGNED_IN", { user: fakeUser("0987654321") });

    expect(window.localStorage.getItem(TIER_CACHE_KEY)).toBeNull();
    expect(window.localStorage.getItem(TIER_UNTIL_KEY)).toBeNull();
  });
});

/* ── HỒI QUY 2026-08-02c: RÒ TIN RIÊNG QUA RANH GIỚI ĐỔI NGƯỜI ──────────────
   `use-tier` nghe `IDENTITY_EVENT`, `use-auth` thì KHÔNG — `identityPhone` chỉ
   đọc một lần lúc mount. Bấm Đăng xuất ⇒ `forgetIdentity()` xoá khoá, nhưng
   state trong hook CÒN NGUYÊN (`router.refresh()` không reset state của client
   component). Hộp thư lấy `phone` từ đây ⇒ `acceptRefresh("090…", null)` = false
   ⇒ câu trả lời "chỉ tin chung" của máy chủ BỊ BỎ QUA ⇒ danh sách tin nhắm
   riêng của chủ tàu ở lại màn hình cho bạn thuyền đọc. */
describe("kho danh tính đổi → hook phải đọc lại NGAY (rò tin riêng)", () => {
  it("forgetIdentity() (nút Đăng xuất) → hook trả phone = null trong cùng nhịp", async () => {
    seedSignedInPremium();
    const { result } = renderHook(() => useAuthUser());
    await settle();
    expect(result.current.phone).toBe("0912345678");

    await act(async () => {
      forgetIdentity();
      await Promise.resolve();
    });

    expect(result.current.phone).toBeNull();
  });

  it("rememberIdentity() người khác (không qua auth-js) → hook theo kịp", async () => {
    seedSignedInPremium("0912345678");
    const { result } = renderHook(() => useAuthUser());
    await settle();

    await act(async () => {
      rememberIdentity("0987654321");
      await Promise.resolve();
    });

    expect(result.current.phone).toBe("0987654321");
  });

  /* TAB KHÁC (mục 4): `dispatchEvent` chỉ vang trong MỘT tab. Điện thoại một
     tab nên hiếm, `/quan-tri` chạy desktop nhiều tab thì có thật. */
  it("đăng xuất ở TAB KHÁC (sự kiện `storage`) → hook cũng phải quên", async () => {
    seedSignedInPremium();
    const { result } = renderHook(() => useAuthUser());
    await settle();
    expect(result.current.phone).toBe("0912345678");

    await act(async () => {
      window.localStorage.removeItem(IDENTITY_KEY);
      window.dispatchEvent(
        new StorageEvent("storage", { key: IDENTITY_KEY, newValue: null }),
      );
      await Promise.resolve();
    });

    expect(result.current.phone).toBeNull();
  });

  it("`storage` của khoá KHÔNG liên quan → không đọc lại bừa", async () => {
    seedSignedInPremium();
    const { result } = renderHook(() => useAuthUser());
    await settle();

    await act(async () => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: "forfish.displaymode.v1" }),
      );
      await Promise.resolve();
    });

    expect(result.current.phone).toBe("0912345678");
  });
});
