import { describe, it, expect } from "vitest";
import {
  accountDisplayName,
  boatCountLine,
  cleanPersonName,
  deviceCountLine,
} from "@/lib/account-display";

describe("accountDisplayName", () => {
  it("ưu tiên tên từ bảng customers (CRM) trước user_metadata", () => {
    expect(accountDisplayName("Võ Văn Hận", "Tên Metadata Cũ")).toBe(
      "Võ Văn Hận",
    );
  });

  it("fallback user_metadata khi customers chưa đồng bộ", () => {
    expect(accountDisplayName(undefined, "Nguyễn Văn A")).toBe("Nguyễn Văn A");
    expect(accountDisplayName(null, " Nguyễn Văn A ")).toBe("Nguyễn Văn A");
  });

  it("cả 2 trống → chuỗi rỗng (UI tự lùi về SĐT)", () => {
    expect(accountDisplayName(undefined, undefined)).toBe("");
    expect(accountDisplayName("  ", "\r\n")).toBe("");
  });

  it("làm sạch rác CRM: \\r\\n và khoảng trắng thừa (ca thật TEST CASE NPP\\r\\n)", () => {
    expect(cleanPersonName("TEST CASE NPP\r\n")).toBe("TEST CASE NPP");
    expect(cleanPersonName("  Võ   Văn\tHận ")).toBe("Võ Văn Hận");
  });
});

describe("deviceCountLine", () => {
  it("có thiết bị → câu đếm", () => {
    expect(deviceCountLine(3)).toBe("Đã mua 3 thiết bị SDVICO");
  });
  it("0 / null → rỗng, không bày số 0", () => {
    expect(deviceCountLine(0)).toBe("");
    expect(deviceCountLine(null)).toBe("");
  });
});

describe("boatCountLine", () => {
  it("có tàu → câu đếm", () => {
    expect(boatCountLine(2)).toBe("Đang quản lý 2 tàu");
    expect(boatCountLine(1)).toBe("Đang quản lý 1 tàu");
  });
  it("0 / null / undefined → rỗng", () => {
    expect(boatCountLine(0)).toBe("");
    expect(boatCountLine(null)).toBe("");
    expect(boatCountLine(undefined)).toBe("");
  });
});
