"use client";

// Hook TỈNH THEO VỊ TRÍ MÁY cho tab Chính sách (14 §21c, 2026-11-06). Logic thuần ở lib/tinh-vi-tri.
//
// · Mở tab: đọc tỉnh đã lưu NGAY (không chờ GPS — mất sóng vẫn có), rồi TỰ ĐO (anh Long 06/11: "cái chọn phải tự động
//   chứ đừng bắt người ta phải thao tác nhiều") — cảm biến tại chỗ, KHÔNG request mạng, timeout 10 s, lỗi thì im.
//   Quyền chưa quyết ⇒ máy tự hỏi MỘT lần (hộp của trình duyệt/hệ điều hành); máy ĐÃ từ chối ⇒ không đo, không nhắc
//   (tab lùi về tàu/cảng nhà/số tàu — tinh-vi-tri.chonTinhTuDong). Đo rồi trong TINH_DO_LAI_MS ⇒ không đo lại; mỗi lần
//   mở trang đo tối đa một lần.
// · Hàng "Theo vị trí máy" trong hộp chọn tỉnh chỉ còn là nút đo lại tay.
// · Không bao giờ ném; mọi nhánh hỏng trả về trạng thái để màn nói ra.

import { useCallback, useEffect, useState } from "react";
import { docTinhViTri, ghiTinhViTri, TINH_DO_LAI_MS, tinhTuToaDo } from "@/lib/tinh-vi-tri";

/** đã tự đo trong lần mở trang này chưa — chuyển tab qua lại không đo lại */
let daTuDo = false;

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
    if (!bat || daTuDo) return;
    const cu = docTinhViTri();
    if (cu && Date.now() - cu.at < TINH_DO_LAI_MS) return; // vừa đo, khỏi đo lại
    daTuDo = true;
    let huy = false;
    const chay = () =>
      doViTri().then((r) => {
        if (r.tinh) ghiTinhViTri(r.tinh); // màn đã đóng vẫn cất cho lần sau
        if (!huy && r.tinh) setTinh(r.tinh);
      });
    const perms = typeof navigator !== "undefined" ? navigator.permissions : undefined;
    if (!perms?.query) {
      void chay(); // Safari cũ không tra được quyền ⇒ cứ đo, máy tự hỏi
    } else {
      perms
        .query({ name: "geolocation" as PermissionName })
        .then((st) => (st.state === "denied" ? undefined : chay())) // đã từ chối ⇒ không nhắc nữa
        .catch(() => void chay());
    }
    return () => {
      huy = true;
    };
  }, [bat]);

  /** bà con chạm "Theo vị trí máy" — đo lại tay */
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
