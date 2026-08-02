"use client";

/*
  Boats store — MỘT nguồn sự thật dùng chung cho mọi màn (ba-spec 08 NV3/R5).
  Trước đây useBoats() là hook per-component: đổi tàu ở switcher KHÔNG cập nhật
  list giấy tờ/bảo dưỡng/chuyến đang mở (bug triage 2026-06-15). Giờ dùng
  module-level store + useSyncExternalStore — đổi tàu là MỌI subscriber re-render
  ngay, không cần reload. Cùng pattern cache module-level như useSdvicoAssets.
*/

import { useSyncExternalStore } from "react";
import {
  type Boat,
  loadBoats,
  saveBoats,
  loadCurrentBoatId,
  saveCurrentBoatId,
} from "./boats";

interface BoatsSnapshot {
  boats: Boat[];
  currentId: string;
  ready: boolean;
}

// Snapshot hằng cho SSR + trước hydrate (khớp server → không lệch hydration).
const EMPTY: BoatsSnapshot = { boats: [], currentId: "", ready: false };

let snapshot: BoatsSnapshot = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  const boats = loadBoats();
  const saved = loadCurrentBoatId();
  const cur = boats.find((b) => b.id === saved) ?? boats[0];
  snapshot = { boats, currentId: cur?.id ?? "", ready: true };
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  hydrate(); // lazy hydrate khi có subscriber đầu tiên (sau mount)
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => snapshot;
const getServerSnapshot = () => EMPTY;

/** Chỉ dùng trong test — reset singleton về trạng thái sạch. */
export function _resetBoatsForTest() {
  snapshot = EMPTY;
  hydrated = false;
  listeners.clear();
}

// ── actions (persist + emit) ─────────────────────────────────────

export function setCurrentBoat(id: string) {
  if (id === snapshot.currentId) return;
  saveCurrentBoatId(id);
  snapshot = { ...snapshot, currentId: id };
  emit();
}

/*  ⚠️ TRẢ KẾT QUẢ GHI RA NGOÀI (sửa 2026-08-02h — vòng soát chéo bắt).
    Bản cũ vứt giá trị `saveBoats` rồi vẫn `emit()`: thêm/sửa/xoá tàu HIỆN ĐÚNG
    trên màn hình, mở lại app là quay về cũ. Ca này nay phổ biến hơn hẳn vì
    đường ghi không còn xoá dự báo để lấy chỗ (luật "hết chỗ thì từ chối ghi"). */
export function addBoat(b: Boat): boolean {
  const boats = [...snapshot.boats, b];
  const ok = saveBoats(boats);
  saveCurrentBoatId(b.id);
  snapshot = { ...snapshot, boats, currentId: b.id };
  emit();
  return ok;
}

export function updateBoat(b: Boat): boolean {
  const boats = snapshot.boats.map((x) => (x.id === b.id ? b : x));
  const ok = saveBoats(boats);
  snapshot = { ...snapshot, boats };
  emit();
  return ok;
}

/**
 * Xóa tàu (ba-spec 08 NV2/R3/R7). Trả false nếu là tàu cuối (luôn giữ ≥1 tàu).
 * Cascade hồ sơ cố định + nhả gán SDVICO được làm ở `purgeBoatData` (boat-cascade).
 */
export function removeBoat(
  id: string,
  cascade?: (boatId: string) => void,
): boolean {
  if (snapshot.boats.length <= 1) return false; // R7: luôn còn ≥1 tàu
  cascade?.(id); // xóa hồ sơ cố định của tàu này (gọi trước khi list co lại)
  const boats = snapshot.boats.filter((b) => b.id !== id);
  saveBoats(boats);
  let currentId = snapshot.currentId;
  if (currentId === id) {
    currentId = boats[0]?.id ?? "";
    saveCurrentBoatId(currentId);
  }
  snapshot = { ...snapshot, boats, currentId };
  emit();
  return true;
}

// ── hook ─────────────────────────────────────────────────────────

export function useBoats() {
  const s = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const current = s.boats.find((b) => b.id === s.currentId) ?? s.boats[0] ?? null;
  return {
    boats: s.boats,
    current,
    currentId: s.currentId,
    ready: s.ready,
    setCurrent: setCurrentBoat,
    addBoat,
    updateBoat,
    removeBoat,
  };
}
