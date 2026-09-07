// TRỢ LÝ — KIỂM BODY `POST /api/tro-ly` (thuần, test được; 14 §6.1, §9.1, 13 AC-T51/T53).
//
// Hai mã lỗi, hai nghĩa khác nhau:
//   · `invalid`      — sai hình / quá dài (client cũ, tay nghịch)
//   · `bad_snapshot` — snapshot mang trường NHẠY CẢM (CCCD, SĐT, STK, toạ độ,
//                      tên người…). TỪ CHỐI, không lặng lẽ bỏ: một client tương
//                      lai gửi nhầm phải đỏ ngay ở máy dev, không âm thầm rò rỉ.

import type { AssistantRequest, DeviceSnapshot } from "./types";

export const TEXT_MAX = 300;
export const SNAPSHOT_MAX_BYTES = 8 * 1024;
export const BODY_MAX_BYTES = 12 * 1024;

/** Khoá CẤM ở bất kỳ tầng nào của snapshot (so không phân biệt hoa/thường). */
export const FORBIDDEN_SNAPSHOT_KEYS = [
  "cccd", "cmnd", "phone", "sdt", "shopphone", "docnumber", "sogiay", "number", "bank", "stk",
  "address", "lat", "lon", "lng", "names", "name", "history", "note", "ghichu", "buyerphone",
] as const;

/** Hai khoá được PHÉP TỒN TẠI nhưng phải RỖNG (đã strip): `boat.name` = "" và `boat.names` = []. Kiểm rỗng ở dưới. */
const NAME_ALLOWED_PATHS = new Set(["boat.name", "boat.names"]);
/** Tên cơn bão là tin công bố công khai (NCHMF) — được gửi lên máy chủ; toạ độ bão thì KHÔNG (stripForServer bỏ lat/lon). */
const NAME_PUBLIC_PATHS = new Set(["storm.storms.name"]);

export type ValidateResult =
  | { ok: true; body: AssistantRequest }
  | { ok: false; code: "invalid" | "bad_snapshot"; why: string };

function findForbidden(v: unknown, path: string, out: string[]): void {
  if (Array.isArray(v)) {
    v.forEach((x, i) => findForbidden(x, `${path}[${i}]`, out));
    return;
  }
  if (!v || typeof v !== "object") return;
  for (const k of Object.keys(v as Record<string, unknown>)) {
    const p = path ? `${path}.${k}` : k;
    const lk = k.toLowerCase();
    if ((FORBIDDEN_SNAPSHOT_KEYS as readonly string[]).includes(lk)) {
      const norm = p.replace(/\[\d+\]/g, "");
      if (!((lk === "name" || lk === "names") && (NAME_ALLOWED_PATHS.has(norm) || NAME_PUBLIC_PATHS.has(norm)))) out.push(p);
    }
    findForbidden((v as Record<string, unknown>)[k], p, out);
  }
}

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const isStr = (x: unknown): x is string => typeof x === "string";
const isArr = Array.isArray;

/** Hình tối thiểu của `DeviceSnapshot` — đủ cho answer/mock đọc mà không ném. */
function snapshotShapeOk(s: unknown): s is DeviceSnapshot {
  if (!s || typeof s !== "object" || isArr(s)) return false;
  const o = s as Record<string, unknown>;
  if (!isNum(o.takenAt) || !isStr(o.route) || typeof o.online !== "boolean" || typeof o.premium !== "boolean") return false;
  if (!o.cart || typeof o.cart !== "object" || !isNum((o.cart as { lines?: unknown }).lines)) return false;
  if (!isArr((o.cart as { titles?: unknown }).titles)) return false;
  if (!isNum(o.inboxUnread) || !isArr(o.placeNames)) return false;
  for (const k of ["home", "weather", "storm", "tide", "boat", "orders", "fishPrices", "fuel"]) {
    if (o[k] !== null && (typeof o[k] !== "object" || isArr(o[k]))) return false;
  }
  for (const k of ["docs", "maintenance"]) if (o[k] !== null && !isArr(o[k])) return false;
  if (o.crew !== null && (typeof o.crew !== "object" || isArr(o.crew))) return false;
  if (o.weather && !isArr((o.weather as { days?: unknown }).days)) return false;
  if (o.storm && !isArr((o.storm as { storms?: unknown }).storms)) return false;
  if (o.orders && !isArr((o.orders as { items?: unknown }).items)) return false;
  return true;
}

export function validateAssistantRequest(raw: unknown, rawBytes?: number): ValidateResult {
  if (rawBytes != null && rawBytes > BODY_MAX_BYTES) return { ok: false, code: "invalid", why: "body quá lớn" };
  if (!raw || typeof raw !== "object" || isArr(raw)) return { ok: false, code: "invalid", why: "không phải object" };
  const b = raw as Record<string, unknown>;
  if ("history" in b) return { ok: false, code: "invalid", why: "có history (13 §4.1: mỗi lượt một câu)" };
  if (!isStr(b.text)) return { ok: false, code: "invalid", why: "thiếu text" };
  const text = b.text.trim();
  if (text.length === 0 || b.text.length > TEXT_MAX) return { ok: false, code: "invalid", why: "text rỗng hoặc >300" };
  if (!isStr(b.route) || b.route.length > 200) return { ok: false, code: "invalid", why: "route" };
  // Khoá cấm quét TRƯỚC kiểm hình: `crew` gửi thành mảng kèm CCCD phải ra `bad_snapshot`
  // (mã cụ thể, dev tra ngay được "client vừa gửi thứ không được gửi") chứ không chìm trong `invalid`.
  const bad: string[] = [];
  findForbidden(b.snapshot, "", bad);
  if (bad.length) return { ok: false, code: "bad_snapshot", why: `khoá cấm: ${bad.slice(0, 3).join(", ")}` };
  if (!snapshotShapeOk(b.snapshot)) return { ok: false, code: "invalid", why: "snapshot sai hình" };
  if (JSON.stringify(b.snapshot).length > SNAPSHOT_MAX_BYTES) return { ok: false, code: "invalid", why: "snapshot >8 KB" };
  // tên tàu phải đã strip (rỗng) — route không sửa hộ
  const boat = (b.snapshot as DeviceSnapshot).boat;
  if (boat && (boat.name !== "" || (Array.isArray(boat.names) && boat.names.length > 0))) {
    return { ok: false, code: "bad_snapshot", why: "boat.name/names chưa strip" };
  }
  return { ok: true, body: { text, route: b.route, snapshot: b.snapshot as DeviceSnapshot } };
}
