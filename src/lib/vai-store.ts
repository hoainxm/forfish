"use client";

// VAI Ở MÁY ↔ MÁY CHỦ (spec 17 §3). Máy giữ chính — dock vẽ ngay cả khi mất sóng; máy chủ chỉ để đổi máy không phải
// chọn lại. Luật thuần (parse, có nhận vai máy chủ không) ở lib/vai.ts.
//
// MẠNG: chỉ hai lượt, đều có trần thời gian + nuốt lỗi — (1) chọn vai (một lần) / tự lên Chủ tàu thì PUT ngay, hỏng
// thì giữ cờ `cho` và gửi lại lần mở app sau / khi có sóng lại; (2) máy chưa có bản vai của tài khoản này (mới đăng
// nhập, đổi máy) thì GET; đã có thì GET lại tối đa 12 giờ/lần (vai do nhân viên sửa về tới máy). Vai đã khoá sau lần chọn đầu (lib/vai lyDoKhongDoiVai).

import { authedFetch } from "@/lib/device-token-store";
import { isVai, nenNhanVaiMayChu, parseVaiMay, VAI_EVENT, VAI_KEY, type Vai, type VaiMay } from "@/lib/vai";

const TRAN_MS = 8000;
/** Hỏi lại vai máy chủ tối đa mỗi 12 giờ (một lượt GET khi mở app, có trần + nuốt lỗi). */
export const HOI_LAI_MS = 12 * 60 * 60 * 1000;

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

/**
 * Gửi vai đang chờ lên máy chủ. true = máy chủ đã nhận.
 * 409 (vai đã khoá — lib/vai lyDoKhongDoiVai): `chua_co_tau` ⇒ giữ cờ chờ, sổ tàu đồng bộ xong lần sau gửi lại;
 * còn lại ⇒ máy chủ là nơi QUYẾT vai, nhận vai máy chủ trả về (bỏ lựa chọn ở máy).
 */
async function guiLen(sdt: string, vai: Vai): Promise<boolean> {
  const { res } = await authedFetch(
    "/api/me/vai",
    { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ vai }) },
    TRAN_MS,
  );
  if (res?.status === 409) {
    const body = (await res.json().catch(() => null)) as { code?: string; vai?: unknown } | null;
    if (body?.code === "chua_co_tau") return false;
    if (body && (body.vai === null || isVai(body.vai))) ghi({ sdt, vai: body.vai ?? null, cho: false, luc: Date.now() });
    return false;
  }
  if (!res?.ok) return false;
  const cur = docVaiMay(sdt);
  // người dùng đã đổi tiếp trong lúc chờ ⇒ để lượt gửi của lựa chọn mới lo
  if (cur?.vai === vai) ghi({ ...cur, cho: false });
  return true;
}

/** Người dùng chọn vai (một lần) hoặc app tự lên Chủ tàu. Ghi máy NGAY (dock đổi tức thì), rồi gửi lên — mất sóng
 *  thì giữ cờ chờ; máy chủ từ chối (vai đã khoá) thì nhận lại vai máy chủ. */
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
  // đã có bản vai: chỉ hỏi lại khi quá HOI_LAI_MS (nhân viên có thể đã sửa vai ở /quan-tri — 17 §3.3)
  if (may && Date.now() - may.luc < HOI_LAI_MS) return;
  const { res } = await authedFetch("/api/me/vai", {}, TRAN_MS);
  if (!res?.ok) return;
  const body = (await res.json().catch(() => null)) as { vai?: unknown } | null;
  if (!body || !("vai" in body)) return;
  if (body.vai !== null && !isVai(body.vai)) return; // giá trị lạ ⇒ giữ bản máy (thà cũ còn hơn sai)
  const sau = docVaiMay(sdt);
  if (sau?.cho) return; // vừa chọn trong lúc chờ — để lượt gửi lo
  // khớp hay không cũng ghi lại mốc `luc` ⇒ 12 giờ sau mới hỏi tiếp
  if (nenNhanVaiMayChu(sau, body.vai) || sau) ghi({ sdt, vai: isVai(body.vai) ? body.vai : null, cho: false, luc: Date.now() });
}
