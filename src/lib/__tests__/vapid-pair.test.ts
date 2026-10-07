import { createECDH } from "node:crypto";
import { describe, expect, it } from "vitest";
import { checkVapidPair } from "@/lib/vapid-pair";

/** Sinh cặp khoá VAPID giống `web-push generate-vapid-keys` (P-256, base64url). */
function makePair() {
  const e = createECDH("prime256v1");
  e.generateKeys();
  return {
    publicKey: e.getPublicKey().toString("base64url"),
    privateKey: e.getPrivateKey().toString("base64url"),
  };
}

describe("checkVapidPair", () => {
  it("khớp cặp → match (kể cả dính khoảng trắng khi dán)", () => {
    const k = makePair();
    expect(checkVapidPair(k.publicKey, k.privateKey)).toBe("match");
    expect(checkVapidPair(` ${k.publicKey}\n`, ` ${k.privateKey} `)).toBe("match");
  });

  it("khoá công khai của cặp này + khoá bí mật cặp khác → mismatch", () => {
    const a = makePair();
    const b = makePair();
    expect(checkVapidPair(a.publicKey, b.privateKey)).toBe("mismatch");
  });

  it("sai định dạng → bad_format, không ném", () => {
    const k = makePair();
    expect(checkVapidPair("0938635689", k.privateKey)).toBe("bad_format"); // SĐT tự điền
    expect(checkVapidPair(k.publicKey, "matkhau")).toBe("bad_format");
    expect(checkVapidPair(k.privateKey, k.publicKey)).toBe("bad_format"); // dán ngược ô
    // điểm nén (tiền tố 0x02), không phải dạng web-push sinh
    expect(checkVapidPair(Buffer.alloc(65, 2).toString("base64url"), k.privateKey)).toBe("bad_format");
    // khoá bí mật = 0 → ngoài miền đường cong
    expect(checkVapidPair(k.publicKey, Buffer.alloc(32, 0).toString("base64url"))).toBe("bad_format");
  });
});
