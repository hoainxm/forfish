// KAIROS — TÍN HIỆU ĐỌC (xem / mở / dừng đọc) cho cỗ máy phân phối (phan-phoi.ts). THUẦN, dùng chung app + route.
//
// App gom tín hiệu trong máy (hàng đợi `forfish.kairos.doc.v1`, gửi theo lô — mất sóng thì để dành), route
// /api/kairos/doc kiểm lại bằng `docLo` rồi ghi gộp nguyên tử (kairos_record_reads, migration 0066).

import { isUuid } from "./validate";

/** Một tín hiệu cho một bài. */
export interface TinHieu {
  post_id: string;
  /** số lần thẻ bài hiện trên màn ≥ XEM_TOI_THIEU_MS */
  views: number;
  /** đã mở bài (chạm xem chi tiết, Đọc bài gốc, bình luận) */
  opened: boolean;
  /** tổng thời gian thẻ nằm trên màn */
  dwell_ms: number;
}

/** Thẻ bài phải nằm trên màn chừng này mới tính là "đã xem" (lướt nhanh qua không tính). */
export const XEM_TOI_THIEU_MS = 1_000;
/** Một lô gửi tối đa chừng này bài; hàng đợi trong máy tối đa HANG_DOI_TOI_DA bài. */
export const LO_TOI_DA = 100;
export const HANG_DOI_TOI_DA = 300;
/** Một lần dừng trên một thẻ tính tối đa chừng này (để máy quên tắt màn không thành "đọc 2 giờ"). */
export const DUNG_TOI_DA_MS = 120_000;

/** Gộp tín hiệu mới vào hàng đợi: cùng bài thì cộng dồn; vượt trần thì bỏ bài CŨ nhất. */
export function gopTinHieu(hang: readonly TinHieu[], moi: readonly TinHieu[]): TinHieu[] {
  const m = new Map<string, TinHieu>();
  for (const x of [...hang, ...moi]) {
    const cu = m.get(x.post_id);
    if (cu) m.delete(x.post_id); // xoá rồi đặt lại ⇒ bài vừa có tín hiệu nằm cuối (mới nhất)
    m.set(x.post_id, {
      post_id: x.post_id,
      views: (cu?.views ?? 0) + x.views,
      opened: (cu?.opened ?? false) || x.opened,
      dwell_ms: Math.min((cu?.dwell_ms ?? 0) + x.dwell_ms, 3_600_000),
    });
  }
  return [...m.values()].slice(-HANG_DOI_TOI_DA);
}

/** Đọc hàng đợi từ kho máy (JSON hỏng / dạng lạ ⇒ rỗng, không ném). */
export function docHangDoi(raw: string | null): TinHieu[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    const r = docLo(Array.isArray(v) ? { items: v } : null, HANG_DOI_TOI_DA);
    return r.ok ? r.items : [];
  } catch {
    return [];
  }
}

/** Kiểm thân request / hàng đợi: {items: TinHieu[]} — mục hỏng bị bỏ, không làm hỏng cả lô. */
export function docLo(body: unknown, toiDa = LO_TOI_DA): { ok: true; items: TinHieu[] } | { ok: false; code: string } {
  const items = (body as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return { ok: false, code: "bad_body" };
  if (items.length > toiDa) return { ok: false, code: "too_many" };
  const out: TinHieu[] = [];
  for (const x of items) {
    const o = x as Partial<TinHieu> | null;
    if (!o || typeof o.post_id !== "string" || !isUuid(o.post_id)) continue;
    const views = Number.isInteger(o.views) ? Math.max(0, Math.min(o.views as number, 1000)) : 0;
    const dwell = typeof o.dwell_ms === "number" && Number.isFinite(o.dwell_ms) ? Math.max(0, Math.min(Math.round(o.dwell_ms), 3_600_000)) : 0;
    const opened = o.opened === true;
    if (!views && !opened && !dwell) continue;
    out.push({ post_id: o.post_id, views, opened, dwell_ms: dwell });
  }
  return { ok: true, items: out };
}
