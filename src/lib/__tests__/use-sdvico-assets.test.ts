import { describe, expect, it } from "vitest";
import { classifySdvicoResponse } from "@/lib/use-sdvico-assets";

const ASSETS = {
  products: [],
  services: [],
  payments: [],
  requests: [],
};

describe("classifySdvicoResponse — 4 nấc trạng thái đồng bộ SDVICO", () => {
  it("HTTP lỗi → error (mạng yếu KHÔNG phải 'chưa đăng nhập')", () => {
    expect(classifySdvicoResponse(false, null).status).toBe("error");
    expect(classifySdvicoResponse(false, { ok: false }).status).toBe("error");
  });

  it("ok + assets → ok kèm dữ liệu", () => {
    const r = classifySdvicoResponse(true, { ok: true, assets: ASSETS });
    expect(r.status).toBe("ok");
    expect(r.assets).toEqual(ASSETS);
  });

  it("chưa đăng nhập / chưa cấu hình → guest (được mời đăng nhập)", () => {
    expect(
      classifySdvicoResponse(true, { ok: false, code: "not_signed_in" }).status,
    ).toBe("guest");
    expect(
      classifySdvicoResponse(true, { ok: false, code: "not_configured" }).status,
    ).toBe("guest");
  });

  it("đăng nhập rồi nhưng chưa khớp đơn hàng → unlinked (KHÔNG mời đăng nhập)", () => {
    expect(
      classifySdvicoResponse(true, { ok: false, code: "no_link" }).status,
    ).toBe("unlinked");
  });

  it("body lạ / không parse được → error", () => {
    expect(classifySdvicoResponse(true, null).status).toBe("error");
    expect(classifySdvicoResponse(true, { ok: false }).status).toBe("error");
  });
});
