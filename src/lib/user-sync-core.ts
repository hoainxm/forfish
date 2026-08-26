// ĐỒNG BỘ SỔ per-máy — phần THUẦN dùng chung route (server) + client.
// (không import gì phía trình duyệt/Node để cả hai bên dùng được, có test.)

/** Các "sổ" được đồng bộ. P1 đấu boats/maintenance/materials; crew/documents ở P2/P3.
 *  PHẢI khớp check `kind in (...)` của migration 0050_user_docs.sql. */
export const SYNC_KINDS = [
  "boats",
  "maintenance",
  "materials",
  "crew",
  "documents",
] as const;

export type SyncKind = (typeof SYNC_KINDS)[number];

export function isSyncKind(x: unknown): x is SyncKind {
  return typeof x === "string" && (SYNC_KINDS as readonly string[]).includes(x);
}

/** Một dòng đồng bộ (server ↔ client cùng hình). `data` giữ NGUYÊN shape
 *  forfish.<kind>.v1 (mảng hoặc object), không diễn giải ở tầng sync. */
export interface SyncRow {
  kind: SyncKind;
  data: unknown;
  /** mốc ghi phía client (ms). Lớn hơn = mới hơn (last-write-wins mức kind). */
  clientUpdatedAt: number;
}

/** Bản ghi PUT hợp lệ chưa. Trả lý do lỗi (null = hợp lệ) để route trả code rõ. */
export function invalidPut(body: unknown): string | null {
  if (!body || typeof body !== "object") return "bad_body";
  const b = body as Record<string, unknown>;
  if (!isSyncKind(b.kind)) return "bad_kind";
  if (!("data" in b)) return "no_data";
  if (typeof b.clientUpdatedAt !== "number" || !Number.isFinite(b.clientUpdatedAt)) {
    return "bad_updated_at";
  }
  return null;
}
