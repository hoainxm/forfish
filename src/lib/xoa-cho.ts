/*
  XOÁ CHỜ — hàng biến khỏi màn NGAY, máy ghi SAU 5 s (TAU-12, rà FB 2026-10-25). Trong 5 s có toast
  "Đã xoá «tên»" + nút Hoàn tác: bấm là hàng về, chưa mất gì vì chưa ghi. Hết giờ (hoặc rời màn /
  xoá tiếp bản khác) mới `ghi` qua commit của màn (saveUserJson). Dùng cho 4 sổ: giấy tờ, bảo dưỡng,
  bạn thuyền, đồ tự ghi.

  Luật an toàn (nguyên tắc 4 — không mất sổ của bà con):
   · Lúc chốt đọc danh sách HIỆN TẠI (`hienTai()`), không dùng bản chụp lúc xoá — bà con sửa một
     hàng khác trong 5 s thì bản sửa không bị đè.
   · Một bản chờ một lúc (toast cũng một câu một lúc): xoá tiếp ⇒ bản trước chốt ngay.
   · `khiChot` (vd dọn ảnh trên Storage) chỉ chạy khi đã chốt — Hoàn tác không mất ảnh.
   · Hoàn tác GHI LẠI cả danh sách: trong lúc chờ có thể đã có lượt ghi khác (sửa hàng kia) không
     mang hàng này — chỉ trả state là chưa đủ.
*/
import { useCallback, useEffect, useRef } from "react";
import { NHAN } from "@/lib/labels";
import { baoToast, TOAST_MS } from "@/lib/toast";

export const XOA_CHO_MS = TOAST_MS;

export type XoaChoCb<T> = {
  /** danh sách đang hiện (đọc LÚC GỌI, không chụp sẵn) */
  hienTai: () => T[];
  /** đổi màn ngay — chưa ghi máy */
  hien: (next: T[]) => void;
  /** ghi thật (commit của màn: setState + saveUserJson, tự gác readFailed) */
  ghi: (next: T[]) => void;
  ten: (item: T) => string;
  /** việc dọn kèm khi ĐÃ chốt (vd xoá ảnh giấy tờ trên Storage) */
  khiChot?: (item: T) => void;
  /** báo toast — mặc định `baoToast` + nút Hoàn tác; test truyền bản giả */
  bao?: (text: string, hoanTac: () => void) => void;
  ms?: number;
};

export type XoaCho<T> = {
  xoa: (id: string) => void;
  /** ghi ngay bản đang chờ (rời màn / xoá tiếp) — không có gì chờ thì thôi */
  chot: () => void;
  hoanTac: () => void;
  dangCho: () => T | null;
};

function baoMacDinh(text: string, hoanTac: () => void) {
  baoToast(text, { hanhDong: { nhan: NHAN.hoanTac, onClick: hoanTac } });
}

export function taoXoaCho<T extends { id: string }>(cb: XoaChoCb<T>): XoaCho<T> {
  let cho: { item: T; timer: ReturnType<typeof setTimeout> } | null = null;

  function chot() {
    if (!cho) return;
    const { item, timer } = cho;
    clearTimeout(timer);
    cho = null;
    cb.ghi(cb.hienTai().filter((x) => x.id !== item.id));
    cb.khiChot?.(item);
  }

  function hoanTac() {
    if (!cho) return;
    const { item, timer } = cho;
    clearTimeout(timer);
    cho = null;
    const list = cb.hienTai();
    cb.ghi(list.some((x) => x.id === item.id) ? list : [...list, item]);
  }

  function xoa(id: string) {
    chot(); // bản trước (nếu còn) chốt ngay — một bản chờ một lúc
    const list = cb.hienTai();
    const item = list.find((x) => x.id === id);
    if (!item) return;
    cb.hien(list.filter((x) => x.id !== id));
    cho = { item, timer: setTimeout(chot, cb.ms ?? XOA_CHO_MS) };
    (cb.bao ?? baoMacDinh)(`Đã xoá «${cb.ten(item)}»`, hoanTac);
  }

  return { xoa, chot, hoanTac, dangCho: () => cho?.item ?? null };
}

/**
 * Bản hook cho màn React: truyền danh sách + setState + commit của màn; trả `xoa(id)`.
 * Rời màn khi còn bản chờ ⇒ chốt luôn (không để bản xoá "hồi sinh" lúc mở lại).
 */
export function useXoaCho<T extends { id: string }>(opts: {
  list: T[];
  hien: (next: T[]) => void;
  ghi: (next: T[]) => void;
  ten: (item: T) => string;
  khiChot?: (item: T) => void;
}): (id: string) => void {
  // đọc bản MỚI NHẤT qua ref — timer 5 s không được ôm closure cũ
  const moiNhat = useRef(opts);
  useEffect(() => {
    moiNhat.current = opts;
  });
  // bộ xoá chờ dựng trong effect (không đụng ref lúc render — luật react-hooks/refs); gỡ màn ⇒ chốt luôn
  const core = useRef<XoaCho<T> | null>(null);
  useEffect(() => {
    const c = taoXoaCho<T>({
      hienTai: () => moiNhat.current.list,
      hien: (n) => moiNhat.current.hien(n),
      ghi: (n) => moiNhat.current.ghi(n),
      ten: (x) => moiNhat.current.ten(x),
      khiChot: (x) => moiNhat.current.khiChot?.(x),
    });
    core.current = c;
    return () => {
      c.chot();
      core.current = null;
    };
  }, []);
  return useCallback((id: string) => core.current?.xoa(id), []);
}
