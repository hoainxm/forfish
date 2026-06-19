// SDFish → SDWork: đẩy mật khẩu mới khi KH đổi trong SDFish (đồng bộ 2 chiều —
// 1 credential dùng cho cả 2 app). HMAC SHA-256 trên RAW JSON body, đối xứng với
// chiều inbound (cùng secret SDWORK_WEBHOOK_SECRET). Logic THUẦN (test được).
import { createHmac } from "node:crypto";

export interface PasswordSyncPayload {
  /** SĐT chuẩn hoá 0xxxxxxxxx — định danh KH chung 2 hệ */
  phone: string;
  /** mật khẩu mới (plaintext; kênh tin cậy HMAC+TLS như chiều inbound) */
  password: string;
}

/** Hex digest HMAC-SHA256 của raw body (SDWork verify bằng cùng secret). */
export function signOutbound(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}
