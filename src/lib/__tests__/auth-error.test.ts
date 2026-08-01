import { describe, it, expect } from "vitest";
import { isNetworkAuthError } from "../auth-error";

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
