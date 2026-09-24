import { describe, expect, it } from "vitest";
import {
  buildRequestMessage,
  REQUEST_SOURCE_TAG,
  PRODUCT_MAX,
  DETAIL_MAX,
} from "@/lib/sdwork-request";

describe("buildRequestMessage — nội dung gửi CRM SDWork", () => {
  it("đủ vế: [ForFish] <chủ đề> · <sản phẩm> — <ghi chú>", () => {
    const m = buildRequestMessage({
      topic: "mua",
      productName: "Máy lọc dầu diesel SF50",
      detail: "Cho tàu vỏ gỗ 400CV",
    });
    expect(m).toBe(
      "[ForFish] Hỏi mua sản phẩm · Máy lọc dầu diesel SF50 — Cho tàu vỏ gỗ 400CV",
    );
  });

  it("LUÔN có tiền tố nhận diện để phía CRM lọc đúng nguồn", () => {
    expect(buildRequestMessage({})).toContain(REQUEST_SOURCE_TAG);
    expect(buildRequestMessage({ topic: "mua" }).startsWith(REQUEST_SOURCE_TAG)).toBe(
      true,
    );
  });

  it("thiếu sản phẩm/ghi chú thì bỏ vế đó", () => {
    expect(buildRequestMessage({ topic: "mua" })).toBe("[ForFish] Hỏi mua sản phẩm");
    expect(buildRequestMessage({ topic: "mua", productName: "Ắc quy" })).toBe(
      "[ForFish] Hỏi mua sản phẩm · Ắc quy",
    );
  });

  it("chủ đề lạ/thiếu → 'Việc khác'", () => {
    expect(buildRequestMessage({})).toBe("[ForFish] Việc khác");
    expect(buildRequestMessage({ topic: "xyz" })).toBe("[ForFish] Việc khác");
  });

  it("cắt độ dài sản phẩm/ghi chú (chống spam sang CRM)", () => {
    const m = buildRequestMessage({
      topic: "mua",
      productName: "x".repeat(300),
      detail: "y".repeat(1000),
    });
    expect(m).toContain("x".repeat(PRODUCT_MAX));
    expect(m).not.toContain("x".repeat(PRODUCT_MAX + 1));
    expect(m).toContain("y".repeat(DETAIL_MAX));
    expect(m).not.toContain("y".repeat(DETAIL_MAX + 1));
  });
});
