import { describe, expect, it } from "vitest";
import {
  checkDemoteAdmin,
  checkSetRole,
  isAdminPhone,
  mergeAdmins,
  parseAdminPhones,
} from "@/lib/admin";

describe("parseAdminPhones", () => {
  it("tách phẩy + chuẩn hoá 84→0 + bỏ khoảng trắng", () => {
    expect(parseAdminPhones("0901234567, 84912345678")).toEqual([
      "0901234567",
      "0912345678",
    ]);
  });
  it("env trống / undefined / toàn rác → []", () => {
    expect(parseAdminPhones(undefined)).toEqual([]);
    expect(parseAdminPhones("")).toEqual([]);
    expect(parseAdminPhones("abc, ,x")).toEqual([]);
  });
});

describe("isAdminPhone", () => {
  const admins = parseAdminPhones("0901234567");
  it("khớp SĐT thường và email ảo", () => {
    expect(isAdminPhone("0901234567", admins)).toBe(true);
    expect(isAdminPhone("0901234567@sdvico.local", admins)).toBe(true);
    expect(isAdminPhone("84901234567", admins)).toBe(true);
  });
  it("không khớp / null / danh sách rỗng → false", () => {
    expect(isAdminPhone("0999999999", admins)).toBe(false);
    expect(isAdminPhone(null, admins)).toBe(false);
    expect(isAdminPhone("0901234567", [])).toBe(false);
  });
});

describe("mergeAdmins — gộp 2 nguồn env + DB", () => {
  it("env đứng trước, DB nối sau, trùng thì env thắng", () => {
    expect(mergeAdmins(["0901234567"], ["0912345678", "0901234567"])).toEqual([
      { phone: "0901234567", source: "env" },
      { phone: "0912345678", source: "db" },
    ]);
  });
  it("chuẩn hoá 84→0 nên KHÔNG đếm trùng thành 2 người", () => {
    expect(mergeAdmins(["84901234567"], ["0901234567"])).toEqual([
      { phone: "0901234567", source: "env" },
    ]);
  });
  it("nguồn rỗng", () => {
    expect(mergeAdmins([], [])).toEqual([]);
    expect(mergeAdmins([], ["0901234567"])).toEqual([
      { phone: "0901234567", source: "db" },
    ]);
  });
});

describe("checkDemoteAdmin — chặn tự khoá cửa", () => {
  const env = ["0901234567"];
  it("hạ admin DB bình thường → cho phép", () => {
    expect(
      checkDemoteAdmin({
        actorPhone: "0901234567",
        targetPhone: "0912345678",
        envPhones: env,
        dbAdminPhones: ["0912345678"],
      }),
    ).toBeNull();
  });
  it("tự hạ mình → self", () => {
    expect(
      checkDemoteAdmin({
        actorPhone: "0912345678",
        targetPhone: "0912345678",
        envPhones: env,
        dbAdminPhones: ["0912345678"],
      }),
    ).toBe("self");
  });
  it("hạ admin từ env → env_admin (phải sửa ADMIN_PHONES)", () => {
    expect(
      checkDemoteAdmin({
        actorPhone: "0912345678",
        targetPhone: "0901234567",
        envPhones: env,
        dbAdminPhones: ["0912345678"],
      }),
    ).toBe("env_admin");
  });
  it("hạ người CUỐI CÙNG (env trống) → last_admin", () => {
    expect(
      checkDemoteAdmin({
        actorPhone: "0912345678",
        targetPhone: "0987654321",
        envPhones: [],
        dbAdminPhones: ["0987654321"],
      }),
    ).toBe("last_admin");
  });
  it("env trống nhưng còn admin DB khác → cho phép", () => {
    expect(
      checkDemoteAdmin({
        actorPhone: "0912345678",
        targetPhone: "0987654321",
        envPhones: [],
        dbAdminPhones: ["0987654321", "0912345678"],
      }),
    ).toBeNull();
  });
});

describe("checkSetRole — nâng thoáng, hạ chặt", () => {
  const env = ["0901234567"];
  it("NÂNG admin cho SĐT đang ở env → CHO PHÉP (đường di cư env → DB)", () => {
    expect(
      checkSetRole({
        actorPhone: "0901234567",
        targetPhone: "0901234567",
        curRole: "customer",
        nextRole: "admin",
        envPhones: env,
        dbAdminPhones: [],
      }),
    ).toBeNull();
  });
  it("nâng khách thường lên admin → cho phép", () => {
    expect(
      checkSetRole({
        actorPhone: "0901234567",
        targetPhone: "0977777777",
        curRole: "customer",
        nextRole: "admin",
        envPhones: env,
        dbAdminPhones: [],
      }),
    ).toBeNull();
  });
  it("đổi vai người KHÔNG phải admin → cho phép (customer ⇄ manager)", () => {
    expect(
      checkSetRole({
        actorPhone: "0901234567",
        targetPhone: "0977777777",
        curRole: "customer",
        nextRole: "manager",
        envPhones: env,
        dbAdminPhones: [],
      }),
    ).toBeNull();
  });
  it("HẠ admin DB → vẫn qua đủ 3 chốt", () => {
    expect(
      checkSetRole({
        actorPhone: "0912345678",
        targetPhone: "0912345678",
        curRole: "admin",
        nextRole: "manager",
        envPhones: env,
        dbAdminPhones: ["0912345678"],
      }),
    ).toBe("self");
    expect(
      checkSetRole({
        actorPhone: "0912345678",
        targetPhone: "0987654321",
        curRole: "admin",
        nextRole: "manager",
        envPhones: [],
        dbAdminPhones: ["0987654321"],
      }),
    ).toBe("last_admin");
  });
  it("HẠ SĐT ở env dù cột role không phải 'admin' → env_admin", () => {
    expect(
      checkSetRole({
        actorPhone: "0912345678",
        targetPhone: "0901234567",
        curRole: "customer",
        nextRole: "manager",
        envPhones: env,
        dbAdminPhones: ["0912345678"],
      }),
    ).toBe("env_admin");
  });
});
