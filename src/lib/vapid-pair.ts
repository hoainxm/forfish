// KIỂM CẶP KHOÁ VAPID (2026-10-07) — khoá công khai có đúng là của khoá bí mật
// không. Dán lệch cặp thì Apple/Google trả 403 cho MỌI máy (tin bão không tới)
// mà không ai thấy lỗi rõ, nên chặn ngay lúc lưu ở /api/admin/app-config.
//
// Dùng node:crypto ⇒ CHỈ import phía server. Không gắn "server-only" để vitest
// test được (gói đó không cài, chỉ Next bundle có). ĐỪNG import từ client
// component — quan-tri/page.tsx chỉ được dùng app-config-keys.ts.

import { createECDH } from "node:crypto";

export type VapidPairCheck = "match" | "mismatch" | "bad_format";

/**
 * So khoá công khai (base64url, điểm P-256 không nén 65 byte — đúng thứ
 * `web-push generate-vapid-keys` sinh) với khoá suy ra từ khoá bí mật
 * (base64url 32 byte). Sai độ dài / ngoài miền đường cong → "bad_format".
 */
export function checkVapidPair(publicKey: string, privateKey: string): VapidPairCheck {
  const pub = Buffer.from(publicKey.trim(), "base64url");
  const priv = Buffer.from(privateKey.trim(), "base64url");
  if (pub.length !== 65 || pub[0] !== 0x04 || priv.length !== 32) return "bad_format";
  try {
    const ecdh = createECDH("prime256v1");
    ecdh.setPrivateKey(priv);
    return ecdh.getPublicKey().equals(pub) ? "match" : "mismatch";
  } catch {
    // khoá bí mật = 0 hoặc ≥ bậc đường cong → OpenSSL ném
    return "bad_format";
  }
}
