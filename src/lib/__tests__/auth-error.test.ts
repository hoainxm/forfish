import { describe, it, expect, vi, afterEach } from "vitest";
import { isNetworkAuthError, withDeadline } from "../auth-error";

/*
  CA THẬT (lỗi 2026-08-01): `supabase.auth.getUser()` KHÔNG reject khi mất sóng —
  auth-js RESOLVE kèm `{ data: { user: null }, error: AuthRetryableFetchError }`.
  Chỗ gọi bỏ `error` thì lỗi mạng ĐỘI LỐT đăng xuất thật ⇒ use-tier xoá dấu
  premium giữa biển, market-listings báo "cần đăng nhập" cho người đang đăng
  nhập. Hàm này là chỗ phân biệt duy nhất, nên khoá bằng test.
*/
const err = (name: string, status?: number) =>
  Object.assign(new Error("x"), { name, status });

describe("isNetworkAuthError", () => {
  it("mất sóng (AuthRetryableFetchError) → KHÔNG kết luận đăng xuất", () => {
    expect(isNetworkAuthError(err("AuthRetryableFetchError", 0))).toBe(true);
  });

  it("lỗi không rõ của auth-js → cũng coi là chưa tra được", () => {
    expect(isNetworkAuthError(err("AuthUnknownError"))).toBe(true);
  });

  it("gateway vệ tinh hỏng (502/504) → chưa tra được", () => {
    expect(isNetworkAuthError(err("AuthApiError", 502))).toBe(true);
    expect(isNetworkAuthError(err("AuthApiError", 504))).toBe(true);
  });

  it("HẾT PHIÊN (AuthSessionMissingError) → đăng xuất THẬT, phải xử như chưa đăng nhập", () => {
    expect(isNetworkAuthError(err("AuthSessionMissingError", 400))).toBe(false);
  });

  it("máy chủ từ chối 401/403 → đăng xuất thật, KHÔNG được giữ quyền cũ", () => {
    expect(isNetworkAuthError(err("AuthApiError", 401))).toBe(false);
    expect(isNetworkAuthError(err("AuthApiError", 403))).toBe(false);
  });

  it("không có lỗi → false (tra được, kết quả là kết quả)", () => {
    expect(isNetworkAuthError(null)).toBe(false);
    expect(isNetworkAuthError(undefined)).toBe(false);
    expect(isNetworkAuthError("hỏng")).toBe(false);
  });
});

/*
  CA THẬT (soát offline 2026-08-02): các cú auth của Supabase KHÔNG nhận
  AbortSignal. Ở sóng "sống mà chết" chúng bắt tay xong rồi TREO — không
  resolve, không reject — nên `await` đứng mãi: nút kẹt "Đang vào…" vĩnh viễn,
  và tệ nhất là cú `signOut` chạy SAU khi mật khẩu ĐÃ đổi xong.
*/
describe("withDeadline", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("việc xong trước hạn → trả đúng kết quả", async () => {
    await expect(withDeadline(Promise.resolve("xong"), 1000)).resolves.toBe(
      "xong",
    );
  });

  it("việc TREO quá hạn → trả null, không đứng mãi", async () => {
    vi.useFakeTimers();
    const treo = new Promise<string>(() => {}); // không bao giờ settle
    const p = withDeadline(treo, 8000);
    await vi.advanceTimersByTimeAsync(8000);
    await expect(p).resolves.toBeNull();
  });

  it("việc hỏng → null, KHÔNG ném ra ngoài (chỗ gọi tự quyết)", async () => {
    await expect(
      withDeadline(Promise.reject(new Error("hỏng")), 1000),
    ).resolves.toBeNull();
  });

  it("về muộn sau khi đã hết giờ → không đổi kết quả nữa", async () => {
    vi.useFakeTimers();
    let done: ((v: string) => void) | null = null;
    const cham = new Promise<string>((r) => {
      done = r;
    });
    const p = withDeadline(cham, 1000);
    await vi.advanceTimersByTimeAsync(1000);
    done!("muộn");
    await expect(p).resolves.toBeNull();
  });
});
