import { describe, expect, it } from "vitest";
import { senBienBat } from "@/lib/sen-bien/bat-tat";

describe("senBienBat — Sen Biển demo không lên prod", () => {
  it("cờ khai rõ thắng NODE_ENV", () => {
    expect(senBienBat("1", "production")).toBe(true);
    expect(senBienBat("0", "development")).toBe(false);
  });
  it("không khai cờ ⇒ chỉ bật lúc dev; build prod/test mặc định TẮT", () => {
    expect(senBienBat(undefined, "development")).toBe(true);
    expect(senBienBat(undefined, "production")).toBe(false);
    expect(senBienBat(undefined, "test")).toBe(false);
    expect(senBienBat("", "production")).toBe(false);
  });
  it("giá trị lạ không bật được prod", () => {
    expect(senBienBat("true", "production")).toBe(false);
    expect(senBienBat("yes", "production")).toBe(false);
  });
});
