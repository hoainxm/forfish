// KAIROS — LỖI CÓ MÃ của kho + route (khuôn market/errors.ts). THUẦN.
// Kho ném KairosError; route đổi sang `{ ok:false, code }` + HTTP status qua `kairosErrorStatus`.

export type KairosStoreCode =
  | "not_found"
  | "forbidden"
  | "handle_taken"
  | "unavailable"
  | "insert_failed"
  | "storage_failed"
  /** cột trang cá nhân (0067) chưa có trên DB — deploy đi trước migration */
  | "fields_missing";

export class KairosError extends Error {
  constructor(public code: KairosStoreCode, message?: string) {
    super(message ?? code);
    this.name = "KairosError";
  }
}

export function isKairosError(e: unknown): e is KairosError {
  return e instanceof KairosError || (!!e && typeof e === "object" && (e as { name?: string }).name === "KairosError");
}

export function kairosErrorStatus(code: KairosStoreCode): number {
  switch (code) {
    case "not_found":
      return 404;
    case "forbidden":
      return 403;
    case "handle_taken":
      return 409;
    case "unavailable":
    case "fields_missing":
      return 503;
    default:
      return 500;
  }
}
