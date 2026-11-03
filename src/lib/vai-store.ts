"use client";

// VAI Ở MÁY ↔ MÁY CHỦ (spec 17 §3). Máy giữ chính — dock vẽ ngay cả khi mất sóng; máy chủ chỉ để đổi máy không phải
// chọn lại. Luật thuần (parse, có nhận vai máy chủ không) ở lib/vai.ts.
//
// MẠNG: chỉ hai lượt, đều có trần thời gian + nuốt lỗi — (1) đổi vai thì PUT ngay, hỏng thì giữ cờ `cho` và gửi lại
// lần mở app sau / khi có sóng lại; (2) máy chưa có bản vai của tài khoản này (mới đăng nhập, đổi máy) thì GET một lần.
// KHÔNG chạy theo nhịp: vai chỉ đổi khi chính người dùng đổi.

import { authedFetch } from "@/lib/device-token-store";
import { nenNhanVaiMayChu, parseVaiMay, VAI_EVENT, VAI_KEY, type Vai, type VaiMay } from "@/lib/vai";

const TRAN_MS = 8000;

export function docVaiMay(sdt: string | null): VaiMay | null {
  if (typeof window === "undefined") return null;
  try {
    return parseVaiMay(window.localStorage.getItem(VAI_KEY), sdt);
  } catch {
    return null; // chế độ riêng tư — chưa biết
  }
}

function ghi(v: VaiMay): void {
  try {
    window.localStorage.setItem(VAI_KEY, JSON.stringify(v));
  } catch {
    /* kho đầy / riêng tư — vẫn báo màn hình để phiên này đúng */
  }
  window.dispatchEvent(new CustomEvent(VAI_EVENT, { detail: v }));
}

/** Gửi vai đang chờ lên máy chủ. true = máy chủ đã nhận. */
async function guiLen(sdt: string, vai: Vai): Promise<boolean> {
  const { res } = await authedFetch(
    "/api/me/vai",
    { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ vai }) },
    TRAN_MS,
  );
  if (!res?.ok) return false;
  const cur = docVaiMay(sdt);
  // người dùng đã đổi tiếp trong lúc chờ ⇒ để lượt gửi của lựa chọn mới lo
  if (cur?.vai === vai) ghi({ ...cur, cho: false });
  return true;
}

/** Người dùng chọn / đổi vai. Ghi máy NGAY (dock đổi tức thì), rồi gửi lên — mất sóng thì giữ cờ chờ. */
export async function chonVai(sdt: string, vai: Vai): Promise<void> {
  ghi({ sdt, vai, cho: true, luc: Date.now() });
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  await guiLen(sdt, vai).catch(() => false);
}

/**
 * Lúc mở app: còn vai chờ gửi ⇒ gửi; máy chưa biết vai của tài khoản này ⇒ hỏi máy chủ một lần.
 * Máy chủ 503 / mất sóng ⇒ để nguyên, lần mở sau thử lại.
 */
export async function dongBoVai(sdt: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  const may = docVaiMay(sdt);
  if (may?.cho && may.vai) {
    await guiLen(sdt, may.vai).catch(() => false);
    return;
  }
  if (may) return;
  const { res } = await authedFetch("/api/me/vai", {}, TRAN_MS);
  if (!res?.ok) return;
  const body = (await res.json().catch(() => null)) as { vai?: unknown } | null;
  if (!body || !("vai" in body)) return;
  const sau = docVaiMay(sdt);
  if (nenNhanVaiMayChu(sau, body.vai)) ghi({ sdt, vai: (body.vai as Vai | null) ?? null, cho: false, luc: Date.now() });
}
