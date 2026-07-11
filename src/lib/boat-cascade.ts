/*
  Cascade khi XÓA TÀU (ba-spec 08 NV2/R3):
  · Hồ sơ CỐ ĐỊNH theo tàu (giấy tờ, bảo dưỡng, chuyến biển) → xóa hẳn.
  · Hàng SDVICO (động theo chủ) → KHÔNG xóa, chỉ NHẢ gán (boatId = undefined)
    để về "của chung".
  Ghi thẳng localStorage (các component mounted đọc lại qua effect boats.length).
*/

// Mirror STORAGE_KEY của từng component (giữ đồng bộ thủ công như urgent-strip).
const FIXED_KEYS = [
  "forfish.documents.v1",
  "forfish.maintenance.v1",
  "forfish.trips.v1",
] as const;
const PRODUCTS_KEY = "forfish.products.v1";

interface WithBoat {
  boatId?: string;
}

function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T[];
  } catch {
    /* hỏng storage → coi như rỗng */
  }
  return [];
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage đầy/tắt → bỏ qua */
  }
}

/** Xóa hồ sơ cố định của tàu + nhả gán hàng SDVICO. Trả số bản ghi đã đụng. */
export function purgeBoatData(boatId: string): {
  removed: number;
  unassigned: number;
} {
  let removed = 0;
  for (const key of FIXED_KEYS) {
    const items = read<WithBoat>(key);
    const next = items.filter((x) => x.boatId !== boatId);
    if (next.length !== items.length) {
      removed += items.length - next.length;
      write(key, next);
    }
  }

  let unassigned = 0;
  const products = read<WithBoat>(PRODUCTS_KEY);
  const nextProducts = products.map((p) => {
    if (p.boatId === boatId) {
      unassigned += 1;
      return { ...p, boatId: undefined };
    }
    return p;
  });
  if (unassigned > 0) write(PRODUCTS_KEY, nextProducts);

  return { removed, unassigned };
}
