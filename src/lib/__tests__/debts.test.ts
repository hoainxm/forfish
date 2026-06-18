import { describe, expect, it } from "vitest";
import {
  balanceOf,
  totalOutstanding,
  totalPaid,
  type Creditor,
} from "@/lib/debts";

const creditor = (
  id: string,
  entries: Creditor["entries"],
): Creditor => ({ id, name: id, kind: "khac", entries });

const vay = (amountVnd: number) => ({
  id: `v-${amountVnd}`,
  date: "2025-01-01",
  type: "vay" as const,
  amountVnd,
});
const tra = (amountVnd: number) => ({
  id: `t-${amountVnd}`,
  date: "2025-02-01",
  type: "tra" as const,
  amountVnd,
});

describe("balanceOf", () => {
  it("dư nợ = tổng vay − tổng trả", () => {
    expect(balanceOf(creditor("a", [vay(60_000_000), tra(25_000_000)]))).toBe(
      35_000_000,
    );
  });

  it("trả dư → dư nợ âm (họ giữ của mình)", () => {
    expect(balanceOf(creditor("a", [vay(10_000_000), tra(12_000_000)]))).toBe(
      -2_000_000,
    );
  });

  it("chưa ghi khoản nào → 0", () => {
    expect(balanceOf(creditor("a", []))).toBe(0);
  });
});

describe("totalPaid", () => {
  it("chỉ cộng khoản trả", () => {
    expect(
      totalPaid(creditor("a", [vay(60_000_000), tra(25_000_000), tra(5_000_000)])),
    ).toBe(30_000_000);
  });
});

describe("totalOutstanding", () => {
  it("tổng dư nợ ròng trên mọi chủ nợ", () => {
    expect(
      totalOutstanding([
        creditor("a", [vay(60_000_000), tra(25_000_000)]), // 35tr
        creditor("b", [vay(20_000_000)]), // 20tr
      ]),
    ).toBe(55_000_000);
  });

  it("sổ rỗng → 0", () => {
    expect(totalOutstanding([])).toBe(0);
  });
});
