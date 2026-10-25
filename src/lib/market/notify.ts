import "server-only";
// THÔNG BÁO của Chợ vật tư — adapter mỏng (12 §7.4). Prod: notifyAccount
// (hộp thư + push best-effort). File mode: đẩy vào sổ `notifications` của
// file-store để /dev hiện ra. KHÔNG BAO GIỜ ném — thông báo là phụ, việc chính
// (đơn đã đổi trạng thái) đã xong.
import { notifyAccount } from "@/lib/account-notify";
import { isValidVnPhone, normalizeVnPhone } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDevFileMode } from "./dev-mode";
import { getMarketStore } from "./store";

export { marketNotice } from "./notice";
export type { MarketEvent } from "./notice";

export const MARKET_PUSH_SENT_BY = "system:market";

/** Best-effort. Prod: notifyAccount(createAdminClient(), phone, {...msg, sentBy:"system:market"}). File mode: push vào file-store.notifications (xem ở /dev). Không bao giờ ném. Bỏ qua khi phone không hợp lệ (sentinel). */
export async function notifyMarket(
  phone: string,
  /** sentBy: tiền tố `system:` riêng của mảng gọi (Kairos dùng "system:kairos") — mặc định chợ */
  msg: { title: string; body: string; url?: string; pushOs?: boolean; tag?: string; sentBy?: string },
): Promise<void> {
  try {
    if (!phone || !isValidVnPhone(phone)) return; // sentinel 'sdvico:chua-gan' / rác
    const target = normalizeVnPhone(phone);
    if (isDevFileMode()) {
      const store = await getMarketStore();
      const dev = store as { devPushNotification?: (p: string, m: typeof msg) => Promise<void> };
      if (typeof dev.devPushNotification === "function") await dev.devPushNotification(target, msg);
      return;
    }
    const admin = createAdminClient();
    if (!admin) return;
    await notifyAccount(admin, target, { ...msg, sentBy: msg.sentBy ?? MARKET_PUSH_SENT_BY });
  } catch (e) {
    console.error("[market] notifyMarket hỏng (bỏ qua):", (e as Error)?.message);
  }
}
