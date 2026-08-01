import { describe, expect, it } from "vitest";
import { isValidDeviceId, DEVICE_ID_KEY } from "@/lib/device-id";

// Mã máy đi THẲNG vào DB (customers.device_id + customer_devices.device_id) và
// quyết định có XOÁ 3 cột mốc hay không — rác lọt qua là xoá nhầm số liệu.
describe("isValidDeviceId", () => {
  it("nhận uuid v4 (crypto.randomUUID) và chuỗi hex 32 ký tự (đường lùi)", () => {
    expect(isValidDeviceId("3f2504e0-4f89-41d3-9a0c-0305e82c3301")).toBe(true);
    expect(isValidDeviceId("a".repeat(32))).toBe(true);
  });

  it("chặn rỗng / quá ngắn / quá dài", () => {
    expect(isValidDeviceId("")).toBe(false);
    expect(isValidDeviceId("abc")).toBe(false);
    expect(isValidDeviceId("a".repeat(65))).toBe(false);
  });

  it("chặn ký tự lạ và sai kiểu — không để rác xuống DB", () => {
    expect(isValidDeviceId("../../etc/passwd")).toBe(false);
    expect(isValidDeviceId("'; drop table customers; --")).toBe(false);
    expect(isValidDeviceId(null)).toBe(false);
    expect(isValidDeviceId(undefined)).toBe(false);
    expect(isValidDeviceId(12345678)).toBe(false);
    expect(isValidDeviceId({ id: "a".repeat(32) })).toBe(false);
  });

  it("khoá theo quy ước forfish.* (state-registry)", () => {
    expect(DEVICE_ID_KEY.startsWith("forfish.")).toBe(true);
  });
});
