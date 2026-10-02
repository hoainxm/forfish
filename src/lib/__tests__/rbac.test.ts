import { describe, expect, it } from "vitest";
import {
  authIdentity,
  checkDemoteAdmin,
  DEMO_TOKEN_TTL_MS,
  isAdminPhone,
  isOwnerIdentity,
  normalizeOwnerLogin,
  OWNER_TOKEN_TTL_MS,
  ownerEmail,
  managerTargetDenial,
  normalizeAccountKind,
  normalizeStaffScope,
  resolveStaffRole,
  STAFF_TOKEN_TTL_MS,
  TEST_TOKEN_TTL_MS,
  tokenTtlMs,
} from "@/lib/admin";
import { phoneFromAuthEmail } from "@/lib/phone";
import { isExpired } from "@/lib/device-token";
import { maskTail } from "@/lib/crew-report";

/*  RBAC 2026-10-02 — tách VAI / LOẠI / HẠNG, một luật cho "ai là admin",
    chặn email giả dạng SĐT, hạn chuỗi theo loại tài khoản. */

describe("phoneFromAuthEmail — chặn email đuôi lạ giả dạng SĐT", () => {
  it("@sdvico.local → SĐT chuẩn hoá", () => {
    expect(phoneFromAuthEmail("0912345678@sdvico.local")).toBe("0912345678");
    expect(phoneFromAuthEmail("0912345678@SDVICO.LOCAL")).toBe("0912345678");
  });
  it("đuôi khác mà phần trước @ là SĐT VN → null (đường chiếm tài khoản cũ)", () => {
    expect(phoneFromAuthEmail("0912345678@gmail.com")).toBeNull();
    expect(phoneFromAuthEmail("84912345678@evil.tld")).toBeNull();
    expect(phoneFromAuthEmail("x0912345678@evil.tld")).toBeNull();
    expect(phoneFromAuthEmail("0912.345.678@evil.tld")).toBeNull();
  });
  it("email thật nhóm SDVICO (không phải SĐT) giữ hành vi cũ", () => {
    expect(phoneFromAuthEmail("duclong292@gmail.com")).toBe("0292");
  });
  it("rỗng / không có @ / chỉ chữ → null", () => {
    expect(phoneFromAuthEmail(null)).toBeNull();
    expect(phoneFromAuthEmail("")).toBeNull();
    expect(phoneFromAuthEmail("0912345678")).toBeNull();
    expect(phoneFromAuthEmail("ketoan@sdvico.vn")).toBeNull();
  });
  it("isAdminPhone nhận email cũng qua cùng cửa", () => {
    const admins = ["0912345678"];
    expect(isAdminPhone("0912345678@sdvico.local", admins)).toBe(true);
    expect(isAdminPhone("0912345678@gmail.com", admins)).toBe(false);
    expect(isAdminPhone("84912345678", admins)).toBe(true);
  });
});

describe("resolveStaffRole — luật DUY NHẤT", () => {
  const base = { envAdmin: false, kind: "real" as const, tableReady: true, staff: null, legacyRole: null };
  it("env = cứu hộ, thắng mọi thứ kể cả loại test", () => {
    expect(resolveStaffRole({ ...base, envAdmin: true, kind: "test" })).toEqual({ role: "admin", source: "env" });
  });
  it("bảng đã có: theo hàng bảng; cột cũ bị bỏ qua", () => {
    expect(resolveStaffRole({ ...base, staff: { role: "manager" }, legacyRole: "admin" })).toEqual({ role: "manager", source: "db" });
    expect(resolveStaffRole({ ...base, staff: null, legacyRole: "admin" })).toEqual({ role: null, source: null });
  });
  it("hàng bị khoá = không vai", () => {
    expect(resolveStaffRole({ ...base, staff: { role: "admin", disabled: true } }).role).toBeNull();
  });
  it("bảng chưa có (0056 chưa apply) → lùi customers.role", () => {
    expect(resolveStaffRole({ ...base, tableReady: false, legacyRole: "admin" })).toEqual({ role: "admin", source: "db" });
    expect(resolveStaffRole({ ...base, tableReady: false, legacyRole: "customer" }).role).toBeNull();
  });
  it("tài khoản test/demo/reviewer KHÔNG BAO GIỜ là staff", () => {
    for (const kind of ["test", "demo", "reviewer"] as const)
      expect(resolveStaffRole({ ...base, kind, staff: { role: "admin" } }).role).toBeNull();
  });
  it("vai lạ → không vai", () => {
    expect(resolveStaffRole({ ...base, staff: { role: "superuser" } }).role).toBeNull();
  });
});

describe("tokenTtlMs — khách thật KHÔNG hạn (bà con ngoài biển)", () => {
  it("khách thật → null", () => {
    expect(tokenTtlMs({ isStaff: false, kind: "real" })).toBeNull();
  });
  it("staff 7 ngày · test 24 giờ (thắng staff) · demo/reviewer 7 ngày", () => {
    expect(tokenTtlMs({ isStaff: true, kind: "real" })).toBe(STAFF_TOKEN_TTL_MS);
    expect(tokenTtlMs({ isStaff: true, kind: "test" })).toBe(TEST_TOKEN_TTL_MS);
    expect(tokenTtlMs({ isStaff: false, kind: "demo" })).toBe(DEMO_TOKEN_TTL_MS);
    expect(tokenTtlMs({ isStaff: false, kind: "reviewer" })).toBe(DEMO_TOKEN_TTL_MS);
  });
});

describe("normalizeAccountKind / normalizeStaffScope — giá trị lạ về mặc định hẹp", () => {
  it("kind", () => {
    expect(normalizeAccountKind("test")).toBe("test");
    expect(normalizeAccountKind(undefined)).toBe("real");
    expect(normalizeAccountKind("admin")).toBe("real");
  });
  it("scope", () => {
    expect(normalizeStaffScope("all_premium")).toBe("all_premium");
    expect(normalizeStaffScope("all")).toBe("own");
    expect(normalizeStaffScope(null)).toBe("own");
  });
});

describe("managerTargetDenial — quản lý chỉ đụng khách của mình", () => {
  const base = {
    actorPhone: "0911111111",
    targetPhone: "0922222222",
    targetIsStaff: false,
    grantedBy: [] as string[],
    scope: "own" as const,
    targetIsPremium: false,
    allowUnclaimed: false,
  };
  it("tự đụng mình → self (kể cả khác định dạng)", () => {
    expect(managerTargetDenial({ ...base, targetPhone: "84911111111" })).toBe("self");
  });
  it("đụng nhân sự → staff_target", () => {
    expect(managerTargetDenial({ ...base, targetIsStaff: true, grantedBy: ["0911111111"] })).toBe("staff_target");
  });
  it("khách mình cấp → được", () => {
    expect(managerTargetDenial({ ...base, grantedBy: ["0933333333", "0911111111"] })).toBeNull();
  });
  it("khách người khác cấp → not_your_customer (kể cả khi cấp premium)", () => {
    expect(managerTargetDenial({ ...base, grantedBy: ["0933333333"], allowUnclaimed: true })).toBe("not_your_customer");
  });
  it("khách chưa ai cấp: CẤP được (nhận khách mới), XOÁ/NHẮN không", () => {
    expect(managerTargetDenial({ ...base, allowUnclaimed: true })).toBeNull();
    expect(managerTargetDenial({ ...base, allowUnclaimed: false })).toBe("not_your_customer");
  });
  it("đại lý tổng (all_premium) đụng được khách đang premium", () => {
    expect(managerTargetDenial({ ...base, scope: "all_premium", targetIsPremium: true, grantedBy: ["0933333333"] })).toBeNull();
    expect(managerTargetDenial({ ...base, scope: "all_premium", targetIsPremium: false, grantedBy: ["0933333333"] })).toBe("not_your_customer");
  });
});

describe("isExpired — hạn chuỗi", () => {
  const now = Date.parse("2026-10-02T00:00:00Z");
  it("null / rác = không hạn (không văng oan)", () => {
    expect(isExpired(null, now)).toBe(false);
    expect(isExpired(undefined, now)).toBe(false);
    expect(isExpired("không phải ngày", now)).toBe(false);
  });
  it("quá hạn / chưa", () => {
    expect(isExpired("2026-10-01T23:59:59Z", now)).toBe(true);
    expect(isExpired("2026-10-02T00:00:00Z", now)).toBe(true);
    expect(isExpired("2026-10-02T00:00:01Z", now)).toBe(false);
  });
});

describe("maskTail — che định danh cho quản lý", () => {
  it("giữ đuôi", () => {
    expect(maskTail("012345678901")).toBe("••••••••8901");
    expect(maskTail("0912345678", 3)).toBe("•••••••678");
  });
  it("ngắn / rỗng", () => {
    expect(maskTail("123")).toBe("•••");
    expect(maskTail(null)).toBeNull();
    expect(maskTail("")).toBe("");
  });
});

/*  ADMIN TỔNG (chủ dự án chốt 2026-10-02): một tài khoản đăng nhập bằng TÊN,
    chỉ người này nâng/hạ quản trị viên; thay env ADMIN_PHONES làm cửa cứu hộ. */
describe("admin tổng — tên đăng nhập + định danh", () => {
  it("normalizeOwnerLogin: chữ thường 3–32, bắt đầu bằng chữ, KHÔNG là SĐT", () => {
    expect(normalizeOwnerLogin(" Admin ")).toBe("admin");
    expect(normalizeOwnerLogin("ad")).toBeNull();
    expect(normalizeOwnerLogin("1admin")).toBeNull();
    expect(normalizeOwnerLogin("admin tổng")).toBeNull();
    expect(normalizeOwnerLogin("0912345678")).toBeNull();
    expect(normalizeOwnerLogin(undefined)).toBeNull();
  });
  it("authIdentity: đúng <owner>@sdvico.local → tên; mọi thứ khác như phoneFromAuthEmail", () => {
    expect(authIdentity("admin@sdvico.local", "admin")).toBe("admin");
    expect(authIdentity("ADMIN@SDVICO.LOCAL", "admin")).toBe("admin");
    // đuôi khác không được giả làm admin tổng
    expect(authIdentity("admin@gmail.com", "admin")).toBe(phoneFromAuthEmail("admin@gmail.com"));
    // tên khác vẫn bị từ chối (không mở cửa cho tên bất kỳ)
    expect(authIdentity("root@sdvico.local", "admin")).toBeNull();
    // chưa khai OWNER_LOGIN → "admin" không là gì cả
    expect(authIdentity("admin@sdvico.local", null)).toBeNull();
    // SĐT vẫn như cũ
    expect(authIdentity("0912345678@sdvico.local", "admin")).toBe("0912345678");
  });
  it("isOwnerIdentity so đúng tên", () => {
    expect(isOwnerIdentity("admin", "admin")).toBe(true);
    expect(isOwnerIdentity("Admin", "admin")).toBe(true);
    expect(isOwnerIdentity("0912345678", "admin")).toBe(false);
    expect(isOwnerIdentity("admin", null)).toBe(false);
  });
  it("ownerEmail", () => {
    expect(ownerEmail("admin")).toBe("admin@sdvico.local");
  });
  it("chuỗi admin tổng: 12 giờ, thắng mọi luật khác", () => {
    expect(tokenTtlMs({ isStaff: true, kind: "real", isOwner: true })).toBe(OWNER_TOKEN_TTL_MS);
    expect(OWNER_TOKEN_TTL_MS).toBeLessThan(STAFF_TOKEN_TTL_MS);
  });
  it("có admin tổng ⇒ hạ quản trị viên DB cuối cùng không còn là last_admin", () => {
    const args = { actorPhone: "0911111111", targetPhone: "0922222222", envPhones: [], dbAdminPhones: ["0922222222"] };
    expect(checkDemoteAdmin(args)).toBe("last_admin");
    expect(checkDemoteAdmin({ ...args, ownerConfigured: true })).toBeNull();
    // tự hạ mình vẫn chặn dù có admin tổng
    expect(checkDemoteAdmin({ ...args, targetPhone: "0911111111", ownerConfigured: true })).toBe("self");
  });
});
