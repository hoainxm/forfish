"use client";

/*
  ĐỒNG Ý ĐIỀU KHOẢN LẦN ĐẦU (2026-11-05, anh Long: "ko cần show hết đâu, chỉ cần có 1 cái là click là đồng ý …
  xem các app hay web khác đang làm sao thì follow").

  Khuôn các app lớn ở VN (Zalo, MoMo, Shopee) sau Luật BVDLCN 2025: KHÔNG bắt đọc cả văn bản; một tờ ngắn nêu điều
  quan trọng nhất + hai đường dẫn tới bản đầy đủ + MỘT nút "Đồng ý". Đăng ký mới thì tick ô ngay trong form (/dang-ky).

  Hiện khi: máy CÓ chuỗi đăng nhập + SĐT chưa đồng ý bản hiện hành (lib/dieu-khoan). Khách lạ không thấy.
  Không có nút đóng / vuốt / back để bỏ qua — im lặng không phải đồng ý (Luật 91/2025). Đọc bản đầy đủ thì bấm link
  (tờ tự ẩn ở /dieu-khoan, /quyen-rieng-tu, màn đăng nhập), quay lại thì tờ hiện tiếp.

  OFFLINE: bấm Đồng ý ghi vào máy ngay, gửi máy chủ thì nuốt lỗi; có sóng / mở app lại thì gửi bù.
*/
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NHAN } from "@/lib/labels";
import { diTrang, useLichSuDong } from "@/lib/dialog-focus";
import {
  authedFetch,
  readToken,
  TOKEN_STORE_EVENT,
} from "@/lib/device-token-store";
import {
  offlineIdentityPhone,
  subscribeIdentity,
} from "@/lib/offline-identity";
import { devicePlatform } from "@/lib/storage-persist";
import {
  canHoiMay,
  conTreoMay,
  DIEU_KHOAN_BAN,
  ghiDongYMay,
  khoaSo,
} from "@/lib/dieu-khoan";

/** Màn không hiện tờ: luồng đăng nhập + chính hai văn bản pháp lý (đang đọc thì đừng che). */
const KHONG_HIEN = [
  "/login",
  "/dang-ky",
  "/doi-mat-khau",
  "/quen-mat-khau",
  "/dieu-khoan",
  "/quyen-rieng-tu",
  "/nguon-du-lieu", // trang ghi công (2026-11-08) — đang đọc thì đừng che
];

export type NguonDongY = "dang-ky" | "dang-nhap" | "mo-app";

/** Gửi các lượt đồng ý còn treo của SĐT đang đăng nhập. Nuốt lỗi — không bao giờ ném. */
export async function guiDongYConTreo(
  nguon: NguonDongY,
  sdt?: string,
): Promise<void> {
  try {
    if (readToken() === null) return;
    // vừa đăng ký/đăng nhập xong thì sổ danh tính có thể chưa kịp ghi ⇒ bên gọi đưa SĐT
    const phone = khoaSo(sdt ?? offlineIdentityPhone());
    if (!phone) return;
    const treo = conTreoMay().find(
      (t) => t.phone === phone && t.ghi.ban === DIEU_KHOAN_BAN,
    );
    if (!treo) return;
    const { res } = await authedFetch("/api/me/dong-y", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ban: treo.ghi.ban,
        luc: treo.ghi.luc,
        nguon,
        platform: devicePlatform(),
      }),
    });
    if (res?.ok) ghiDongYMay(phone, true, treo.ghi.luc);
  } catch {
    /* mất sóng / máy chặn kho — để lần sau */
  }
}

export function DongYDieuKhoan() {
  const pathname = usePathname();
  const router = useRouter();
  const [phone, setPhone] = useState<string | null>(null);
  const [hoi, setHoi] = useState(false);

  const xet = useCallback(() => {
    const p = readToken() === null ? null : offlineIdentityPhone();
    setPhone(p);
    setHoi(canHoiMay(p));
    void guiDongYConTreo("mo-app");
  }, []);

  useEffect(() => {
    xet();
    const bo = subscribeIdentity(xet);
    window.addEventListener(TOKEN_STORE_EVENT, xet);
    window.addEventListener("online", xet);
    return () => {
      bo();
      window.removeEventListener(TOKEN_STORE_EVENT, xet);
      window.removeEventListener("online", xet);
    };
  }, [xet]);

  const an =
    !hoi ||
    !phone ||
    KHONG_HIEN.some((p) => pathname === p || pathname.startsWith(p + "/"));
  /*  BACK CỦA MÁY KHÔNG BỎ QUA ĐƯỢC tờ này (im lặng ≠ đồng ý): lớp chiếm một mục lịch sử, Back chỉ gỡ mục đó và tờ vẫn
      nằm nguyên — không có nút nào "đóng" ngoài Đồng ý. Đồng ý xong thì `dongTay` trả mục lịch sử. */
  const { dongTay } = useLichSuDong(() => {}, !an);

  if (an || !phone) return null;

  const dongY = () => {
    ghiDongYMay(phone);
    setHoi(false);
    dongTay();
    void guiDongYConTreo("mo-app");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dk-dong-y"
      className="fixed inset-0 z-[80] mx-auto flex max-w-(--w-app) items-end bg-navy/40 p-3"
    >
      <div className="w-full rounded-2xl bg-card p-4 shadow-float">
        <h2 id="dk-dong-y" className="text-[1.0625rem] font-semibold text-navy">
          Điều khoản sử dụng
        </h2>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-foreground">
          App lưu số điện thoại, sổ tàu, giấy tờ và thuyền viên của bà con (có
          ảnh, số CCCD — dữ liệu nhạy cảm) trên máy chủ để đổi máy vẫn còn.
          SDVICO không bán dữ liệu cho ai.
        </p>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">
          Xem đủ:{" "}
          <Link
            href="/dieu-khoan"
            onClick={(e) => {
              e.preventDefault();
              diTrang(router, "/dieu-khoan");
            }}
            className="py-3 font-semibold text-sea underline"
          >
            {NHAN.dieuKhoan}
          </Link>{" "}
          ·{" "}
          <Link
            href="/quyen-rieng-tu"
            onClick={(e) => {
              e.preventDefault();
              diTrang(router, "/quyen-rieng-tu");
            }}
            className="py-3 font-semibold text-sea underline"
          >
            {NHAN.riengTu}
          </Link>
        </p>
        <button
          type="button"
          onClick={dongY}
          className="mt-4 h-(--h-cta) w-full rounded-full bg-trim text-[1rem] font-semibold text-card"
        >
          {NHAN.dongY}
        </button>
      </div>
    </div>
  );
}
