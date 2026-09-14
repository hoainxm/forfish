// VỊ TRÍ NÚT NỔI KÉO ĐƯỢC — Sen Biển + giỏ hàng (khoá `forfish.fab.v1`).
//
// Vì sao có (2026-09-07): hai nút nổi cùng neo góc dưới-phải, cùng một toạ độ
// ⇒ đè lên nhau ở tab Sản phẩm; và neo theo mép TRÌNH DUYỆT chứ không theo
// cột app 480px ⇒ màn rộng là nút bay ra ngoài khung. Bà con phải KÉO được
// nút tới chỗ không vướng, và ẨN được khi nó che thứ đang xem.
//
// File này chỉ có logic thuần + đọc/ghi localStorage — không DOM, để test.
// Vị trí nút KHÔNG phải sổ của bà con: ghi hỏng thì nút về góc mặc định, không
// mất gì đáng giữ ⇒ không báo đỏ (khác `saveUserJson`). Không sao lưu theo
// tệp (của riêng máy này — `forfish.fab.` ∈ NEVER_BACKUP_PREFIXES).

export const FLOAT_POS_KEY = "forfish.fab.v1";

export type FloatSide = "left" | "right";

export type FloatPos = {
  /** mép trái hay phải của cột app */
  side: FloatSide;
  /** số px nâng lên so với chỗ mặc định (≥0) */
  dy: number;
  /** đang ẨN (nép vào mép, chỉ ló một mẩu để kéo/chạm ra) */
  tucked: boolean;
};

export const DEFAULT_FLOAT_POS: FloatPos = { side: "right", dy: 0, tucked: false };

/** Trần dy khi chưa đo được khung (chỉ dùng để loại số rác trong sổ). */
const DY_SANITY_MAX = 4000;

/** Ép một giá trị bất kỳ (sổ cũ, rác) về FloatPos hợp lệ — sai là về mặc định. */
export function normalizeFloatPos(raw: unknown): FloatPos {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_FLOAT_POS };
  const r = raw as Record<string, unknown>;
  const side: FloatSide = r.side === "left" ? "left" : "right";
  const dyRaw = typeof r.dy === "number" && Number.isFinite(r.dy) ? Math.round(r.dy) : 0;
  const dy = Math.min(DY_SANITY_MAX, Math.max(0, dyRaw));
  return { side, dy, tucked: r.tucked === true };
}

type Store = Record<string, unknown>;

function readStore(storage: Storage | undefined): Store {
  if (!storage) return {};
  try {
    const raw = storage.getItem(FLOAT_POS_KEY);
    if (!raw) return {};
    const v: unknown = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Store) : {};
  } catch {
    return {};
  }
}

function defaultStorage(): Storage | undefined {
  try {
    return typeof window !== "undefined" ? window.localStorage : undefined;
  } catch {
    return undefined; // Safari chế độ riêng tư có thể ném ngay khi chạm localStorage
  }
}

/** Vị trí đã lưu của nút `id`; chưa có / hỏng → mặc định. */
export function loadFloatPos(id: string, storage = defaultStorage()): FloatPos {
  return normalizeFloatPos(readStore(storage)[id]);
}

/** Ghi vị trí; trả `false` khi máy không giữ được (không cần báo — xem đầu file). */
export function saveFloatPos(id: string, pos: FloatPos, storage = defaultStorage()): boolean {
  if (!storage) return false;
  const next = { ...readStore(storage), [id]: normalizeFloatPos(pos) };
  try {
    storage.setItem(FLOAT_POS_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

/** Tâm nút lọt vào dải này sát mép (tính theo bề rộng nút) = bà con đang đẩy nút ra ngoài → ẨN. */
export const TUCK_ZONE = 0.4;

export type DropArgs = {
  /** tâm nút lúc thả, tính từ mép TRÁI cột app (px) */
  centerX: number;
  /** bề rộng cột app (px) */
  frameWidth: number;
  /** bề rộng nút (px) */
  btnWidth: number;
  /** dy trước khi kéo */
  dyBefore: number;
  /** ngón tay dời theo trục dọc, DƯƠNG là xuống (px) */
  deltaY: number;
  /** dy lớn nhất còn nằm trong khung (px) */
  maxDy: number;
};

/**
 * Thả nút xong thì nó NÉP về mép gần nhất (không để lơ lửng giữa màn — che chữ),
 * giữ độ cao vừa kéo (kẹp trong khung), và ẨN nếu bị đẩy sát ra ngoài mép.
 */
export function settleDrop(a: DropArgs): FloatPos {
  const side: FloatSide = a.centerX < a.frameWidth / 2 ? "left" : "right";
  const zone = a.btnWidth * TUCK_ZONE;
  const tucked = side === "left" ? a.centerX < zone : a.centerX > a.frameWidth - zone;
  const maxDy = Math.max(0, Math.round(a.maxDy));
  const dy = Math.min(maxDy, Math.max(0, Math.round(a.dyBefore - a.deltaY)));
  return { side, dy, tucked };
}
