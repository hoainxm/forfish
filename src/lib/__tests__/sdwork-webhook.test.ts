import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import {
  verifyWebhookSignature,
  passwordSyncIntent,
  toCustomerRow,
  toDeviceRow,
  toSupplyRow,
  type WebhookEvent,
} from "@/lib/sdwork-webhook";

const sign = (body: string, secret: string) =>
  createHmac("sha256", secret).update(body).digest("hex");

describe("verifyWebhookSignature", () => {
  const body = JSON.stringify({ entity: "customer", ref: "c1" });
  it("chữ ký đúng → true", () => {
    expect(verifyWebhookSignature(body, sign(body, "s3cr3t"), "s3cr3t")).toBe(true);
  });
  it("sai secret / sai sig / rỗng → false", () => {
    expect(verifyWebhookSignature(body, sign(body, "x"), "s3cr3t")).toBe(false);
    expect(verifyWebhookSignature(body, "deadbeef", "s3cr3t")).toBe(false);
    expect(verifyWebhookSignature(body, "", "s3cr3t")).toBe(false);
    expect(verifyWebhookSignature(body, sign(body, "s3cr3t"), "")).toBe(false);
  });
});

describe("map payload → row (chuẩn hoá SĐT, idempotent theo ref)", () => {
  it("customer: chuẩn hoá 84→0", () => {
    const e: WebhookEvent = {
      entity: "customer",
      action: "upsert",
      ref: "c1",
      data: { phone: "84901234567", name: "Anh Ba" },
    };
    expect(toCustomerRow(e)).toEqual({
      phone: "0901234567",
      name: "Anh Ba",
      sdwork_ref: "c1",
    });
  });
  it("customer thiếu phone → null", () => {
    expect(
      toCustomerRow({ entity: "customer", action: "upsert", ref: "c", data: {} }),
    ).toBeNull();
  });
  it("device: đủ field + warranty", () => {
    const e: WebhookEvent = {
      entity: "device",
      action: "upsert",
      ref: "d1",
      data: {
        customerPhone: "0901234567",
        name: "Anten vệ tinh SF50",
        serial: "SF50-001",
        warrantyUntil: "2027-06-01",
        orderCode: "DH-123",
      },
    };
    const r = toDeviceRow(e)!;
    expect(r.customer_phone).toBe("0901234567");
    expect(r.serial).toBe("SF50-001");
    expect(r.warranty_until).toBe("2027-06-01");
    expect(r.sdwork_ref).toBe("d1");
  });
  it("device thiếu name → null", () => {
    expect(
      toDeviceRow({
        entity: "device",
        action: "upsert",
        ref: "d",
        data: { customerPhone: "0901234567" },
      }),
    ).toBeNull();
  });
  it("supply: qty số hợp lệ, rác → null qty", () => {
    const ok = toSupplyRow({
      entity: "supply",
      action: "upsert",
      ref: "s1",
      data: { phone: "0901234567", name: "Lọc nước", qty: 3 },
    })!;
    expect(ok.qty).toBe(3);
    const bad = toSupplyRow({
      entity: "supply",
      action: "upsert",
      ref: "s2",
      data: { phone: "0901234567", name: "Nhớt", qty: "nhiều" },
    })!;
    expect(bad.qty).toBeNull();
  });
  it("supply: qty thập phân + unit giữ nguyên; unit thiếu → null", () => {
    const ok = toSupplyRow({
      entity: "supply",
      action: "upsert",
      ref: "s3",
      data: { customerPhone: "0901234567", name: "Cáp RG-58", qty: 1.5, unit: "m" },
    })!;
    expect(ok.qty).toBe(1.5);
    expect(ok.unit).toBe("m");
    const noUnit = toSupplyRow({
      entity: "supply",
      action: "upsert",
      ref: "s4",
      data: { phone: "0901234567", name: "Lọc nước", qty: 2 },
    })!;
    expect(noUnit.unit).toBeNull();
  });
});

describe("passwordSyncIntent (đồng bộ mật khẩu 2 app)", () => {
  const ev = (data: Record<string, unknown>): WebhookEvent => ({
    entity: "customer",
    action: "upsert",
    ref: "c1",
    data,
  });
  it("có password, không reset → tạo lần đầu", () => {
    expect(passwordSyncIntent(ev({ phone: "0901234567", password: "abc123" }))).toEqual({
      password: "abc123",
      reset: false,
    });
  });
  it("resetPassword=true → reset mật khẩu hiện hữu", () => {
    expect(
      passwordSyncIntent(ev({ phone: "0901234567", password: "new456", resetPassword: true })),
    ).toEqual({ password: "new456", reset: true });
  });
  it("không có password → bỏ qua (null, không reset)", () => {
    expect(passwordSyncIntent(ev({ phone: "0901234567" }))).toEqual({
      password: null,
      reset: false,
    });
  });
  it("entity khác customer → luôn null", () => {
    const e: WebhookEvent = {
      entity: "device",
      action: "upsert",
      ref: "d1",
      data: { password: "x", resetPassword: true },
    };
    expect(passwordSyncIntent(e)).toEqual({ password: null, reset: false });
  });
});
