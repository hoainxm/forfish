// Sen Biển đọc câu máy nhà bằng GIỌNG MỸ DUYÊN (ADR 0016, 2026-10-19): ký đường /doc, kiểm ranh giới, dựng đoạn đọc.
import { afterEach, describe, expect, it, vi } from "vitest";
import { amThanhHopLe, bindOidc, dauKy, DUONG_DOC, kiemCauDoc, kyHmac } from "@/lib/sen-bien/cong-ai-ky";
import { doanMayNha } from "@/lib/sen-bien/hoi-may-chu";

const KHOA = "k".repeat(43);
const TB = "tb-" + "a".repeat(24);

describe("ký đường /gw/v1/forfish/doc", () => {
  it("chữ ký tính trên đúng đường /doc (không phải /hoi) — sai đường là 401 bên máy nhà", () => {
    const body = '{"text":"Bác vào Tàu tôi."}';
    const h = dauKy({ loai: "hmac", khoa: KHOA }, TB, body, 1760000000000, "0".repeat(32), DUONG_DOC);
    const t = { ts: "1760000000000", nonce: "0".repeat(32), method: "POST", duong: DUONG_DOC, nguoi: TB, khachThue: "forfish-thue-bao", body };
    expect(h["x-forlife-sig"]).toBe(kyHmac(KHOA, t));
    expect(h["x-forlife-sig"]).not.toBe(kyHmac(KHOA, { ...t, duong: "/gw/v1/forfish/hoi" }));
    const o = dauKy({ loai: "oidc", token: "a.b.c" }, TB, body, 1760000000000, "0".repeat(32), DUONG_DOC);
    expect(o["x-forlife-bind"]).toBe(bindOidc("a.b.c", t));
  });
});

describe("ranh giới đọc", () => {
  it("kiemCauDoc: 1–200 ký tự, gộp khoảng trắng; lạ ⇒ null", () => {
    expect(kiemCauDoc({ text: "  Bác  vào Tàu tôi. " })).toBe("Bác vào Tàu tôi.");
    expect(kiemCauDoc({ text: "a".repeat(201) })).toBeNull();
    expect(kiemCauDoc({ text: "" })).toBeNull();
    expect(kiemCauDoc(null)).toBeNull();
  });
  it("amThanhHopLe: chỉ base64 dài vừa phải; rác / quá lớn ⇒ null", () => {
    const b64 = Buffer.from("x".repeat(200)).toString("base64");
    expect(amThanhHopLe(b64)).toBe(b64);
    expect(amThanhHopLe("<script>")).toBeNull();
    expect(amThanhHopLe("QUJD")).toBeNull();
    expect(amThanhHopLe("A".repeat(400_001))).toBeNull();
    expect(amThanhHopLe(123)).toBeNull();
  });
});

describe("doanMayNha — câu đầu dùng mp3 gửi kèm, câu sau xin /doc song song ngay", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("câu đầu có mp3 kèm ⇒ không gọi mạng cho nó; câu 2, 3 gọi /api/sen-bien/doc ngay lúc dựng", async () => {
    const goi: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: RequestInit) => {
      goi.push(JSON.parse(String(init.body)).text);
      return new Response(new Blob([new Uint8Array([1, 2, 3])], { type: "audio/mpeg" }), { headers: { "content-type": "audio/mpeg" } });
    }));
    const b64 = Buffer.from("x".repeat(200)).toString("base64");
    const ds = doanMayNha({ text: "A. B. C.", speak: ["Câu một.", "Câu hai.", "Câu ba."], amThanh: b64 });
    expect(ds.map((d) => d.text)).toEqual(["Câu một.", "Câu hai.", "Câu ba."]);
    expect(goi).toEqual(["Câu hai.", "Câu ba."]); // đã bắt đầu tải TRƯỚC khi phát
    for (const d of ds) expect(await d.mp3).toMatch(/^blob:/);
  });
  it("máy nhà lỗi / không phải mp3 ⇒ null (câu đó đọc giọng máy), không ném", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: false }), { status: 502, headers: { "content-type": "application/json" } })));
    const ds = doanMayNha({ text: "A.", speak: ["Câu một."], amThanh: null });
    expect(await ds[0].mp3).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("mất sóng");
    }));
    expect(await doanMayNha({ text: "A.", speak: ["Câu một."], amThanh: null })[0].mp3).toBeNull();
  });
});
