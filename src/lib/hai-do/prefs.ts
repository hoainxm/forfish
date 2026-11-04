"use client";

/*
  CHẾ ĐỘ HẢI ĐỒ — TUỲ CHỌN (2026-11-04, đợt 1). Lưu `forfish.haiDo.v1` trên MÁY
  (không theo tài khoản — đây là cách nhìn của người cầm máy, như mapPrefs).
  Pattern: module store + useSyncExternalStore (giống lib/map-prefs.ts).

    bang      — bảng màu Ngày / Chiều / Đêm
    anToanM   — đường an toàn bà con TỰ CHỌN; null = suy từ mớn (lib/hai-do/an-toan)
    vecPhut   — độ dài vạch hướng đi (phút)
    moHaiDo   — lần sau bấm "Bản đồ" thì mở thẳng chế độ Hải đồ (bà con đã quen kiểu này)
    huong     — hướng bản đồ: Bắc lên / Hướng đi lên / Tuyến lên (đợt 2)
    vong      — vòng cự ly 1-2-5 hải lý quanh tàu (đợt 2)
    nutZoom   — hiện nút phóng to/thu nhỏ trên cột (mặc định ẩn — véo hai ngón; iSailor "Zoom Buttons")
*/
import { useSyncExternalStore } from "react";
import type { BangMau } from "@/lib/hai-do/bang-mau";
import { MUC_AN_TOAN_M, VEC_PHUT, type MucAnToan, type VecPhut } from "@/lib/hai-do/an-toan";
import { HUONG_BAN_DO, type HuongBanDo } from "@/lib/hai-do/may";

export const HAI_DO_KEY = "forfish.haiDo.v1";

export interface HaiDoPrefs {
  bang: BangMau;
  anToanM: MucAnToan | null;
  vecPhut: VecPhut;
  moHaiDo: boolean;
  huong: HuongBanDo;
  vong: boolean;
  nutZoom: boolean;
}

export const HAI_DO_MAC_DINH: HaiDoPrefs = {
  bang: "ngay",
  anToanM: null,
  vecPhut: 6,
  moHaiDo: false,
  huong: "bac",
  vong: false,
  nutZoom: false,
};

/** Đọc bản lưu — mọi trường lạ/hỏng về mặc định (thuần, có test). */
export function docHaiDoPrefs(raw: string | null): HaiDoPrefs {
  if (!raw) return HAI_DO_MAC_DINH;
  try {
    const p = JSON.parse(raw) as Partial<HaiDoPrefs>;
    return {
      bang: p.bang === "chieu" || p.bang === "dem" ? p.bang : "ngay",
      anToanM: (MUC_AN_TOAN_M as readonly unknown[]).includes(p.anToanM) ? (p.anToanM as MucAnToan) : null,
      vecPhut: (VEC_PHUT as readonly unknown[]).includes(p.vecPhut) ? (p.vecPhut as VecPhut) : 6,
      moHaiDo: p.moHaiDo === true,
      huong: (HUONG_BAN_DO as readonly unknown[]).includes(p.huong) ? (p.huong as HuongBanDo) : "bac",
      vong: p.vong === true,
      nutZoom: p.nutZoom === true,
    };
  } catch {
    return HAI_DO_MAC_DINH;
  }
}

let state: HaiDoPrefs = HAI_DO_MAC_DINH;
let loaded = false;
const listeners = new Set<() => void>();

function ensure() {
  if (loaded || typeof window === "undefined") return;
  try {
    state = docHaiDoPrefs(localStorage.getItem(HAI_DO_KEY));
  } catch {
    state = HAI_DO_MAC_DINH;
  }
  loaded = true;
}

export function setHaiDoPrefs(patch: Partial<HaiDoPrefs>) {
  ensure();
  state = { ...state, ...patch };
  try {
    localStorage.setItem(HAI_DO_KEY, JSON.stringify(state));
  } catch {
    /* localStorage chặn (private mode) — vẫn chạy trong bộ nhớ */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): HaiDoPrefs {
  ensure();
  return state;
}

export function useHaiDoPrefs(): HaiDoPrefs {
  return useSyncExternalStore(subscribe, getSnapshot, () => HAI_DO_MAC_DINH);
}

/** Bảng màu kế tiếp khi chạm nút Màu: Ngày → Chiều → Đêm → Ngày. */
export function bangKeTiep(b: BangMau): BangMau {
  return b === "ngay" ? "chieu" : b === "chieu" ? "dem" : "ngay";
}
