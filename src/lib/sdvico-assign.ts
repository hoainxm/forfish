"use client";

/*
  Gán hàng SDVICO cho tàu (ba-spec 08 NV4/R6). Đồ SDVICO là dữ liệu ĐỒNG BỘ
  read-only từ API (useSdvicoAssets) → KHÔNG sửa được trên máy. Lớp gán này là
  annotation CỤC BỘ: map id-món → boatId, để nhắc việc biết "của tàu nào".
  Chưa gán = "của chung" (nhắc không nhãn tàu). Store dùng chung (prompt gán +
  dải nhắc cùng đọc) — pattern như boat-store.
*/

import { useSyncExternalStore } from "react";

import { readUserRecord } from "@/lib/user-list-store";
import { saveUserJson } from "@/lib/user-store";

const KEY = "forfish.sdvico-boat.v1";

/** Giá trị gán nghĩa "của chung mọi tàu" — đã chọn nên KHÔNG hỏi lại. */
export const SHARED = "__chung__";

/** id-món SDVICO → boatId (hoặc SHARED). Vắng key = CHƯA chọn (cần hỏi). */
export type AssignMap = Record<string, string>;

/**
 * id-món SDVICO (sản phẩm + dịch vụ) CHƯA được gán → cần hỏi gán tàu nào
 * (ba-spec 08 NV4/AC-6). "Của chung" đã chọn (= SHARED) coi như đã gán.
 */
export function unassignedAssetIds(
  assets: { products: { id: string }[]; services: { id: string }[] },
  map: AssignMap,
): string[] {
  const ids = [
    ...assets.products.map((p) => p.id),
    ...assets.services.map((s) => s.id),
  ];
  return ids.filter((id) => !(id in map));
}

const EMPTY: AssignMap = {};
let snapshot: AssignMap = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/**
 * KHÔNG ĐỌC ĐƯỢC BẢNG GÁN ⇒ KHOÁ CỬA GHI (K4, 2026-08-02).
 *
 * Bảng gán là thứ bà con TỰ CHỌN (món này của tàu nào) — không tải lại được từ
 * đâu cả: API SDVICO chỉ trả danh sách món, phần "của tàu nào" chỉ nằm trong
 * máy. Luật cũ nuốt lỗi rồi trả `{}` ⇒ prompt hỏi lại TỪ ĐẦU mọi món, và cú
 * chọn đầu tiên `save({một món})` ĐÈ lên bảng gốc: bao nhiêu lần gán trước đó
 * mất sạch.
 *
 * Dùng `readUserRecord` chứ không `readUserList`: khoá này giữ ĐỐI TƯỢNG
 * (id-món → boatId), không phải mảng — ép về mảng là bẻ dữ liệu cho vừa hàm.
 */
let readFailed = false;

/** Lần đọc bảng gán gần nhất có hỏng không. */
export function assignReadFailed(): boolean {
  return readFailed;
}

export function loadAssignments(): AssignMap {
  if (typeof window === "undefined") return {};
  const r = readUserRecord<AssignMap>(KEY);
  readFailed = !r.ok;
  return r.value ?? {};
}

/** Trả `false` khi máy KHÔNG giữ được (đọc hỏng → cấm đè; hoặc hết chỗ). */
function save(map: AssignMap): boolean {
  if (readFailed) return false;
  return saveUserJson(KEY, map);
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  snapshot = loadAssignments();
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  hydrate();
  return () => {
    listeners.delete(listener);
  };
}

/** Gán món `id` cho `boatId`; truyền null = nhả về của chung. */
export function setAssignment(id: string, boatId: string | null) {
  const next = { ...snapshot };
  if (boatId) next[id] = boatId;
  else delete next[id];
  snapshot = next;
  save(next);
  emit();
}

export function useAssignments(): AssignMap {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => EMPTY,
  );
}

/** Chỉ dùng trong test. */
export function _resetAssignForTest() {
  snapshot = EMPTY;
  hydrated = false;
  readFailed = false;
  listeners.clear();
}
