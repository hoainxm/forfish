"use client";
// KAIROS — GỬI TÍN HIỆU ĐỌC (xem/mở/dừng đọc) lên /api/kairos/doc cho cỗ máy phân phối.
//
// Hàng đợi trong máy `forfish.kairos.doc.v1` = {phone, items} — NGĂN THEO SĐT: đổi tài khoản thì bỏ hàng đợi
// của người trước (không gán tín hiệu người này cho người kia). Mất sóng / máy chủ hỏng ⇒ giữ, lần sau gửi;
// kho máy bị chặn ⇒ chỉ giữ trong bộ nhớ. KHÔNG BAO GIỜ ném, không chặn việc đọc.

import { gopTinHieu, docHangDoi, LO_TOI_DA, type TinHieu } from "./tin-hieu-doc";
import { kairosSend } from "./write-client";

export const DOC_KEY = "forfish.kairos.doc.v1";

let boNho: { phone: string | null; items: TinHieu[] } = { phone: null, items: [] };
let dangGui = false;

function doc(phone: string | null): TinHieu[] {
  try {
    const raw = window.localStorage.getItem(DOC_KEY);
    const o = raw ? (JSON.parse(raw) as { phone?: unknown; items?: unknown }) : null;
    if (!o || o.phone !== phone) return boNho.phone === phone ? boNho.items : [];
    return docHangDoi(JSON.stringify(o.items ?? []));
  } catch {
    return boNho.phone === phone ? boNho.items : [];
  }
}

function ghi(phone: string | null, items: TinHieu[]): void {
  boNho = { phone, items };
  try {
    if (items.length) window.localStorage.setItem(DOC_KEY, JSON.stringify({ phone, items }));
    else window.localStorage.removeItem(DOC_KEY);
  } catch {
    // kho bị chặn / đầy — giữ trong bộ nhớ, mất khi đóng app (chỉ là tín hiệu xếp bài, không phải dữ liệu bà con)
  }
}

/** Ghi nhận tín hiệu (khách chưa đăng nhập ⇒ bỏ: máy chủ không lưu tín hiệu khách). */
export function ghiNhan(phone: string | null, moi: TinHieu[]): void {
  if (!phone || !moi.length) return;
  ghi(phone, gopTinHieu(doc(phone), moi));
}

/** Gửi một lô. Gọi định kỳ + khi app vào nền. Lỗi tạm ⇒ giữ; 400 (lô hỏng) / 204 (khách) ⇒ bỏ lô đó. */
export async function guiTinHieu(phone: string | null): Promise<void> {
  if (!phone || dangGui) return;
  const hang = doc(phone);
  if (!hang.length) return;
  dangGui = true;
  try {
    const lo = hang.slice(0, LO_TOI_DA);
    const r = await kairosSend<{ n: number }>("POST", "/api/kairos/doc", { items: lo }, 8_000);
    const boLo = r.ok || r.status === 204 || r.status === 400;
    if (!boLo) return;
    // trong lúc gửi có thể đã có tín hiệu mới cho cùng bài ⇒ chỉ bỏ phần đã gửi, giữ phần cộng thêm
    const gui = new Map(lo.map((x) => [x.post_id, x]));
    const con: TinHieu[] = [];
    for (const x of doc(phone)) {
      const g = gui.get(x.post_id);
      if (!g) con.push(x);
      else {
        const du = { post_id: x.post_id, views: x.views - g.views, opened: x.opened && !g.opened, dwell_ms: x.dwell_ms - g.dwell_ms };
        if (du.views > 0 || du.opened || du.dwell_ms > 0) con.push({ ...du, views: Math.max(0, du.views), dwell_ms: Math.max(0, du.dwell_ms) });
      }
    }
    ghi(phone, con);
  } finally {
    dangGui = false;
  }
}
