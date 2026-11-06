"use client";

// Hook TỈNH THEO VỊ TRÍ MÁY cho tab Chính sách (14 §21c, 2026-11-06). Logic thuần ở lib/tinh-vi-tri.
//
// · Mở tab: đọc tỉnh đã lưu NGAY (không chờ GPS — mất sóng vẫn có). Quyền vị trí ĐÃ cho ⇒ đo lại lặng lẽ (cảm biến
//   tại chỗ, KHÔNG request mạng, có timeout, lỗi thì thôi). Quyền CHƯA quyết ⇒ KHÔNG tự bung hộp xin quyền (web cấm
//   khi không có thao tác; bản native đã xin lúc mở app — NativeGpsPrime) — bà con chạm "Theo vị trí máy" mới xin.
// · Không bao giờ ném; mọi nhánh hỏng trả về trạng thái để màn nói ra.

import { useCallback, useEffect, useState } from "react";
import { docTinhViTri, ghiTinhViTri, tinhTuToaDo } from "@/lib/tinh-vi-tri";

export type KetQuaDo = "ok" | "tu-choi" | "xa-bo" | "loi";

const TUY_CHON: PositionOptions = { enableHighAccuracy: false, timeout: 10_000, maximumAge: 10 * 60_000 };

function doViTri(): Promise<{ kq: KetQuaDo; tinh: string | null }> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return resolve({ kq: "loi", tinh: null });
    try {
      navigator.geolocation.getCurrentPosition(
        (p) => {
          const tinh = tinhTuToaDo(p.coords.latitude, p.coords.longitude);
          resolve({ kq: tinh ? "ok" : "xa-bo", tinh });
        },
        (e) => resolve({ kq: e.code === 1 ? "tu-choi" : "loi", tinh: null }),
        TUY_CHON,
      );
    } catch {
      resolve({ kq: "loi", tinh: null });
    }
  });
}

/** @param bat chỉ đo khi đang xem tab Chính sách */
export function useTinhViTri(bat: boolean) {
  const [tinh, setTinh] = useState<string | null>(null);
  const [dangDo, setDangDo] = useState(false);

  const nhan = useCallback((r: { kq: KetQuaDo; tinh: string | null }) => {
    if (r.tinh) {
      setTinh(r.tinh);
      ghiTinhViTri(r.tinh); // không ghi được vẫn dùng trong phiên
    }
    return r.kq;
  }, []);

  useEffect(() => {
    setTinh(docTinhViTri()?.province ?? null);
  }, []);

  useEffect(() => {
    if (!bat) return;
    let huy = false;
    const perms = typeof navigator !== "undefined" ? navigator.permissions : undefined;
    if (!perms?.query) return;
    perms
      .query({ name: "geolocation" as PermissionName })
      .then((st) => {
        if (huy || st.state !== "granted") return;
        return doViTri().then((r) => {
          if (!huy) nhan(r);
        });
      })
      .catch(() => {});
    return () => {
      huy = true;
    };
  }, [bat, nhan]);

  /** bà con chạm "Theo vị trí máy" — có thao tác nên được bung hộp xin quyền */
  const xin = useCallback(async (): Promise<KetQuaDo> => {
    setDangDo(true);
    try {
      return nhan(await doViTri());
    } finally {
      setDangDo(false);
    }
  }, [nhan]);

  return { tinh, dangDo, xin };
}
