/*
  Cascade khi XÓA TÀU (ba-spec 08 NV2/R3):
  · Hồ sơ CỐ ĐỊNH theo tàu (giấy tờ, bảo dưỡng, chuyến biển) → xóa hẳn.
  · Hàng SDVICO (động theo chủ) → KHÔNG xóa, chỉ NHẢ gán (boatId = undefined)
    để về "của chung".
  Ghi thẳng localStorage (các component mounted đọc lại qua effect boats.length).
*/

import { markLocalWrite } from "@/lib/user-sync";
import type { SyncKind } from "@/lib/user-sync-core";

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

function write(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    /* storage đầy/tắt → bỏ qua */
    return false;
  }
}

/*  Sổ nào đang đồng bộ tài khoản thì xoá xong PHẢI báo `markLocalWrite`
    (2026-10-24). Trước đây ghi thẳng localStorage rồi thôi: server không hay
    biết, giấy tờ của tàu đã xoá vẫn nằm trên server ⇒ đăng nhập máy khác (hay
    máy này nhận lại bản server) là chúng hiện lại ở dải "Việc cần làm". */
const SYNC_OF: Partial<Record<string, SyncKind>> = {
  "forfish.documents.v1": "documents",
  "forfish.maintenance.v1": "maintenance",
};

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
      if (write(key, next)) {
        const kind = SYNC_OF[key];
        if (kind) markLocalWrite(kind);
      }
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
  if (unassigned > 0 && write(PRODUCTS_KEY, nextProducts)) markLocalWrite("materials");

  return { removed, unassigned };
}
