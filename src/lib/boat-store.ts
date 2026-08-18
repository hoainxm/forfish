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

/*  Cùng một hàm `subscribe` mà `useSyncExternalStore` dùng — xuất ra để cổng
    test đăng ký được ngoài React (nạp sổ tàu từ kho rồi mới thao tác). Không
    có bản sao thứ hai của đường hydrate: test phải đi đúng đường app đi. */
export const subscribeBoats = subscribe;

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
/*  ⚠️ GHI HỎNG THÌ KHÔNG ĐỔI MÀN HÌNH (thêm 2026-08-16, thẩm định P1).
    Bản trước trả `ok` ra ngoài nhưng VẪN đổi `snapshot` + `emit()`: tàu mới
    hiện trong danh sách, bà con gắn giấy tờ/thuyền viên/bảo dưỡng vào `boatId`
    đó, mở lại app thì tàu biến mất — còn lại một đống hồ sơ trỏ vào tàu không
    tồn tại. Nay màn hình luôn khớp với thứ máy GIỮ ĐƯỢC; chỗ gọi đọc `false`
    để hiện câu báo (`saveUserJson` là nơi duy nhất biết vì sao hỏng). */
export function addBoat(b: Boat): boolean {
  const boats = [...snapshot.boats, b];
  if (!saveBoats(boats)) return false;
  saveCurrentBoatId(b.id);
  snapshot = { ...snapshot, boats, currentId: b.id };
  emit();
  return true;
}

export function updateBoat(b: Boat): boolean {
  const boats = snapshot.boats.map((x) => (x.id === b.id ? b : x));
  if (!saveBoats(boats)) return false;
  snapshot = { ...snapshot, boats };
  emit();
  return true;
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
  /*  XOÁ CHA TRƯỚC, RỒI MỚI XOÁ CON (đảo thứ tự 2026-08-16, thẩm định P1).
      LỖI ĐÃ SỬA: `cascade` chạy TRƯỚC và kết quả `saveBoats` bị vứt. Máy không
      giữ được danh sách tàu (kho hỏng/đầy — chính ca `saveBoats` trả false) thì
      giấy tờ, sổ bảo dưỡng, gán SDVICO của tàu đó ĐÃ BỊ XOÁ THẬT, trong khi
      tàu vẫn còn nguyên sau khi mở lại app. Bà con thấy tàu đủ, mở ra thì tủ
      giấy tờ trống — mất dữ liệu mà không một dấu hiệu nào.
      Nay: ghi được danh sách mới thì mới đụng tới hồ sơ con. Ghi hỏng ⇒ trả
      false, không xoá gì cả, màn hình giữ nguyên. */
  const boats = snapshot.boats.filter((b) => b.id !== id);
  if (!saveBoats(boats)) return false;
  cascade?.(id); // xóa hồ sơ cố định của tàu này
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
