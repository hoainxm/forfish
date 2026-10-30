"use client";
// KAIROS — GỬI TÍN HIỆU ĐỌC (xem/mở/dừng đọc) lên /api/kairos/doc cho cỗ máy phân phối.
// Kèm lượt XEM / BẤM thẻ Tài trợ (`tt`, 14 §22 — đo nội bộ SDVICO) đi cùng lô, cùng hàng đợi, cùng ngăn SĐT.
//
// Hàng đợi trong máy `forfish.kairos.doc.v1` = {phone, items} — NGĂN THEO SĐT: đổi tài khoản thì bỏ hàng đợi
// của người trước (không gán tín hiệu người này cho người kia). Mất sóng / máy chủ hỏng ⇒ giữ, lần sau gửi;
// kho máy bị chặn ⇒ chỉ giữ trong bộ nhớ. KHÔNG BAO GIỜ ném, không chặn việc đọc.

import { docDemTaiTro, gopDemTaiTro, type DemTaiTro } from "./do-khach";
import { gopTinHieu, docHangDoi, LO_TOI_DA, type TinHieu } from "./tin-hieu-doc";
import { kairosSend } from "./write-client";

export const DOC_KEY = "forfish.kairos.doc.v1";

type Hang = { items: TinHieu[]; tt: DemTaiTro[] };
const RONG: Hang = { items: [], tt: [] };

let boNho: { phone: string | null } & Hang = { phone: null, ...RONG };
let dangGui = false;

function doc(phone: string | null): Hang {
  const nho = (): Hang => (boNho.phone === phone ? { items: boNho.items, tt: boNho.tt } : RONG);
  try {
    const raw = window.localStorage.getItem(DOC_KEY);
    const o = raw ? (JSON.parse(raw) as { phone?: unknown; items?: unknown; tt?: unknown }) : null;
    if (!o || o.phone !== phone) return nho();
    return { items: docHangDoi(JSON.stringify(o.items ?? [])), tt: docDemTaiTro(o.tt) };
  } catch {
    return nho();
  }
}

function ghi(phone: string | null, h: Hang): void {
  boNho = { phone, ...h };
  try {
    if (h.items.length || h.tt.length) window.localStorage.setItem(DOC_KEY, JSON.stringify({ phone, items: h.items, tt: h.tt }));
    else window.localStorage.removeItem(DOC_KEY);
  } catch {
    // kho bị chặn / đầy — giữ trong bộ nhớ, mất khi đóng app (chỉ là tín hiệu xếp bài, không phải dữ liệu bà con)
  }
}

/** Ghi nhận tín hiệu (khách chưa đăng nhập ⇒ bỏ: máy chủ không lưu tín hiệu khách). */
export function ghiNhan(phone: string | null, moi: TinHieu[]): void {
  if (!phone || !moi.length) return;
  const h = doc(phone);
  ghi(phone, { ...h, items: gopTinHieu(h.items, moi) });
}

/** Ghi nhận lượt xem / bấm thẻ Tài trợ (khách chưa đăng nhập ⇒ bỏ, như tín hiệu đọc). */
export function ghiNhanTaiTro(phone: string | null, moi: DemTaiTro[]): void {
  if (!phone || !moi.length) return;
  const h = doc(phone);
  ghi(phone, { ...h, tt: gopDemTaiTro(h.tt, moi) });
}

/** Gửi một lô. Gọi định kỳ + khi app vào nền. Lỗi tạm ⇒ giữ; 400 (lô hỏng) / 204 (khách) ⇒ bỏ lô đó. */
export async function guiTinHieu(phone: string | null): Promise<void> {
  if (!phone || dangGui) return;
  const hang = doc(phone);
  if (!hang.items.length && !hang.tt.length) return;
  dangGui = true;
  try {
    const lo = hang.items.slice(0, LO_TOI_DA);
    const loTt = hang.tt;
    const r = await kairosSend<{ n: number; tt?: boolean }>("POST", "/api/kairos/doc", { items: lo, tt: loTt }, 8_000);
    const boLo = r.ok || r.status === 204 || r.status === 400;
    if (!boLo) return;
    // máy chủ ghi được tín hiệu đọc nhưng chưa ghi được đếm tài trợ (tt:false — vd 0077 chưa áp) ⇒ giữ phần tt
    const boTt = !(r.ok && r.data.tt === false);
    // trong lúc gửi có thể đã có tín hiệu mới cho cùng bài ⇒ chỉ bỏ phần đã gửi, giữ phần cộng thêm
    const gui = new Map(lo.map((x) => [x.post_id, x]));
    const con: TinHieu[] = [];
    const bayGio = doc(phone);
    for (const x of bayGio.items) {
      const g = gui.get(x.post_id);
      if (!g) con.push(x);
      else {
        const du = { post_id: x.post_id, views: x.views - g.views, opened: x.opened && !g.opened, dwell_ms: x.dwell_ms - g.dwell_ms };
        if (du.views > 0 || du.opened || du.dwell_ms > 0) con.push({ ...du, views: Math.max(0, du.views), dwell_ms: Math.max(0, du.dwell_ms) });
      }
    }
    const guiTt = new Map(boTt ? loTt.map((x) => [x.id, x]) : []);
    const conTt = bayGio.tt
      .map((x) => ({ id: x.id, xem: x.xem - (guiTt.get(x.id)?.xem ?? 0), bam: x.bam - (guiTt.get(x.id)?.bam ?? 0) }))
      .filter((x) => x.xem > 0 || x.bam > 0);
    ghi(phone, { items: con, tt: conTt });
  } finally {
    dangGui = false;
  }
}
