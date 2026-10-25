"use client";

import { useCallback, useEffect, useRef } from "react";

/*
  GIỮ CHỖ CUỘN theo đường dẫn khi qua lại /tau ↔ /nguoi (TAU-14, rà FB 2026-10-25):
  nội dung hai màn dựng SAU hydrate từ localStorage (`ready` gate) nên lúc Next
  khôi phục cuộn trang còn ngắn ⇒ về đầu trang. Lưu `scrollY` vào sessionStorage
  (khoá `tau.cuon:<path>` — chỉ sống trong phiên tab, KHÔNG phải khoá forfish.*),
  khi quay lại thì chờ trang đủ dài rồi mới cuộn tới.
  Khác `lib/kairos/giu-cho.ts` (bộ nhớ module cho ảnh chụp dòng tin): ở đây chỉ
  một con số, cần sống qua tải lại tab ⇒ sessionStorage.
*/

export const TIEN_TO_CUON = "tau.cuon:";

/** Kho tối thiểu để test không cần trình duyệt. */
export type KhoCuon = Pick<Storage, "getItem" | "setItem">;

export function khoaCuon(path: string): string {
  return `${TIEN_TO_CUON}${path}`;
}

/** Cất vị trí cuộn; kho hỏng (private mode, đầy) thì bỏ qua — không ném. */
export function catCuon(kho: KhoCuon, path: string, y: number): void {
  if (!Number.isFinite(y) || y < 0) return;
  try {
    kho.setItem(khoaCuon(path), String(Math.round(y)));
  } catch {
    /* kho hỏng ⇒ mất chỗ cuộn, không phải mất dữ liệu */
  }
}

/** Đọc vị trí đã cất; không có / hỏng ⇒ null. */
export function docCuon(kho: KhoCuon, path: string): number | null {
  try {
    const v = kho.getItem(khoaCuon(path));
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

function khoPhien(): KhoCuon | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Số khung hình tối đa chờ trang dài ra trước khi bỏ cuộc (≈ 0,5 s). */
const KHUNG_CHO_TOI_DA = 30;

/**
 * Gắn ở component có mặt trên cả hai màn (TauToiNav): lưu scrollY khi cuộn,
 * khôi phục khi `path` đổi. Không cần biết `ready` của từng màn — chờ tới khi
 * trang đủ dài để cuộn tới chỗ cũ (hydrate localStorage xong trong 1–2 khung).
 *
 * Trả `sapRoi()` — bên gọi gọi trong onClick của Link sang màn khác: Next cuộn về 0
 * TRƯỚC khi pathname đổi (đo thật 2026-10-25), nếu không chặn thì cú cuộn đó đè
 * chỗ đã cất bằng 0. Back/Forward (popstate) tự chặn trong hook.
 */
export function useGiuCuon(path: string): { sapRoi: () => void } {
  const dangRoiRef = useRef(false);
  const sapRoi = useCallback(() => {
    dangRoiRef.current = true;
    // không đổi màn thật (bấm lại tab đang mở) ⇒ mở lại cửa ghi sau một nhịp
    setTimeout(() => {
      dangRoiRef.current = false;
    }, 1500);
  }, []);

  useEffect(() => {
    const kho = khoPhien();
    if (!kho) return;
    dangRoiRef.current = false;
    // Next cuộn về 0 ngay sau khi đổi màn — sự kiện đó không được đè chỗ đã cất.
    let dangKhoiPhuc = true;
    let raf = 0;
    const onScroll = () => {
      if (dangKhoiPhuc || dangRoiRef.current || raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        catCuon(kho, path, window.scrollY);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("popstate", sapRoi);

    const y = docCuon(kho, path);
    let n = 0;
    let rafKhoiPhuc = 0;
    const thu = () => {
      const toiDa = document.documentElement.scrollHeight - window.innerHeight;
      if (y != null && y > 0 && toiDa < y && n < KHUNG_CHO_TOI_DA) {
        n++;
        rafKhoiPhuc = requestAnimationFrame(thu);
        return;
      }
      if (y != null && y > 0) window.scrollTo(0, Math.min(y, Math.max(0, toiDa)));
      dangKhoiPhuc = false;
    };
    rafKhoiPhuc = requestAnimationFrame(thu);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("popstate", sapRoi);
      if (raf) cancelAnimationFrame(raf);
      if (rafKhoiPhuc) cancelAnimationFrame(rafKhoiPhuc);
    };
  }, [path, sapRoi]);

  return { sapRoi };
}
