// Kênh gửi OTP — ADAPTER trung lập (quy tắc adapter 01-product §5): đổi nhà
// cung cấp (Zalo ZNS / SMS VN / Twilio) KHÔNG đổi route. Chọn qua env
// OTP_PROVIDER. Mặc định "stub" (chưa cắm provider thật — xem
// docs/app-map/ops/external-services.md + native/deploy roadmap).
import "server-only";

export interface OtpProvider {
  /** Gửi mã tới SĐT. Ném lỗi nếu thất bại (route sẽ trả lỗi gửi). */
  send(phone: string, code: string): Promise<void>;
}

// Stub: KHÔNG gửi thật. Dev log mã ra console để test; prod im lặng (chưa cắm
// provider → coi như gửi rỗng, KHÔNG lộ mã). Khi cắm thật, thêm nhánh provider.
const stub: OtpProvider = {
  async send(phone, code) {
    if (process.env.NODE_ENV !== "production") {
      // chỉ DEV — tuyệt đối không log mã ở production
      console.log(`[otp:stub] ${phone} → ${code}`);
    }
  },
};

// Zalo ZNS / SMS VN cắm sau theo cùng interface:
//   const zaloZns: OtpProvider = { async send(phone, code) { /* gọi ZNS API */ } };

export function getOtpProvider(): OtpProvider {
  switch (process.env.OTP_PROVIDER) {
    // case "zalo": return zaloZns;
    // case "sms":  return smsVn;
    default:
      return stub;
  }
}

/** Provider thật đã cắm chưa? (UI/route có thể cảnh báo nếu chưa). */
export function isOtpProviderConfigured(): boolean {
  return Boolean(process.env.OTP_PROVIDER);
}
