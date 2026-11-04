"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnchorIcon, BriefcaseIcon, CartIcon, FishIcon, HomeIcon, PinIcon, StoreIcon } from "@/components/icons";
import { KairosFishIcon } from "@/components/kairos/kairos-fish-icon";
import { cartBucket } from "@/lib/cart";
import { boHaiDoKhiBam, DOCK_BADGE_EVENT, dockActive, dockBadge, dockTheoVai, donChoTuCo, nhanBadgeDock, type DockId, type NguonBadge } from "@/lib/dock-nav";
import { loadInbox, unreportedIds } from "@/lib/inbox";
import { nhanDem, tinChuongKairos } from "@/lib/kairos/chuong";
import { loadMarketCart, MARKET_CART_EVENT } from "@/lib/market/cart";
import { MARKET_SHOP_FLAG_KEY } from "@/lib/market/seller-flag";
import { useAuthUser } from "@/lib/use-auth";
import { useVai } from "@/lib/use-vai";
import { setHaiDoPrefs } from "@/lib/hai-do/prefs";

/*
  Dock điều hướng (spec user 2026-07-29; KIỂU FACEBOOK 2026-10-19): DockFrame
  fixed + thanh trắng bo tròn NỔI, tách mép, hở trên home-indicator (globals.css
  .bottom-dock). Chỉ icon; mục đang chọn = pill xanh nhạt + icon xanh. Chiều cao
  chừa đáy dùng chung --dock-total (đã cộng hở --dock-gap).
  SÁU MỤC (2026-10-23, thêm Kairos sau Trang chủ — 14-ba-spec-kairos §3.1): Trang
  chủ · Kairos · Bản đồ · Tàu tôi · Chợ cá · Vật tư — mỗi việc một chỗ; mục nào sáng
  ở route nào: lib/dock-nav.ts. Sáu ô ở máy 360px: thanh rộng 360 − 2×0.75rem lề =
  21rem ⇒ mỗi ô 3.5rem; pill sáng thu từ 3.75rem về 3.25rem cho khỏi chạm ô bên.
  KAIROS = ẢNH RIÊNG (2026-10-25, icon Codex vẽ: hai con cá, kairos-fish-icon.tsx) thay icon
  nét tờ báo — ngoại lệ có chủ ý trong bộ icon nét một màu: Kairos là cộng đồng có tên riêng,
  cần nhận ra ngay như logo. Ở DOCK dùng bản KHÔNG chấm cam (`bien="dock"`): chấm vẽ cố định
  là lời "có mới" thường trực nói dối; "có mới" thật nay là badge số đỏ bên dưới. Ảnh nằm
  ngang (~2.3:1) nên cao 1.125rem, rộng tối đa 2.75rem cho lọt pill 3.25rem; mục chưa chọn mờ
  70 % như icon nét mờ màu.
  BADGE SỐ ĐỎ (VO-APP-03, QUYET-DINH A): chỉ Kairos (tin chuông chưa đọc) + Vật tư (đơn chờ của
  người bán, không có thì số dòng giỏ) — luật thuần `dockBadge` ở lib/dock-nav.ts. Đọc kho máy,
  KHÔNG request; vẽ lại khi đổi màn, quay lại app, giỏ đổi, hay màn khác bắn DOCK_BADGE_EVENT.
  Mục đang chọn vẫn vẽ badge — tắt theo DỮ LIỆU (chuông báo đã đọc), không tắt theo vị trí.
  CHẠM LẠI Ô ĐANG SÁNG (VO-APP-15): cuộn về đầu trang, không điều hướng — thói quen FB.
*/
const ICON: Record<Exclude<DockId, "kairos">, typeof HomeIcon> = {
  "trang-chu": HomeIcon,
  "ban-do": PinIcon,
  "tau-toi": AnchorIcon,
  "viec-lam": BriefcaseIcon,
  "cho-ca": FishIcon,
  "vat-tu": CartIcon,
  "ban-hang": StoreIcon,
};

/* Số cột theo số ô (dock theo vai có 4–6 ô — spec 17 §4.1). Chuỗi lớp viết sẵn để Tailwind thấy. */
const COT: Record<number, string> = { 4: "grid-cols-4", 5: "grid-cols-5", 6: "grid-cols-6" };

const KHONG: NguonBadge = { kairosChuaDoc: 0, donChoBan: 0, gioDong: 0 };

/** Nguồn badge đọc từ kho máy — mọi nhánh nuốt lỗi về 0 (badge là phụ, không được làm hỏng dock). */
function docNguonBadge(phone: string | null): NguonBadge {
  if (typeof window === "undefined") return KHONG;
  try {
    const inbox = loadInbox(phone);
    const chuaBao = new Set(unreportedIds(phone, inbox.map((m) => m.id)));
    const kairosChuaDoc = tinChuongKairos(inbox, chuaBao).filter((t) => t.chuaDoc).length;
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(MARKET_SHOP_FLAG_KEY);
    } catch {
      raw = null;
    }
    return {
      kairosChuaDoc,
      donChoBan: donChoTuCo(raw, cartBucket(phone)),
      gioDong: loadMarketCart(phone).length,
    };
  } catch {
    return KHONG;
  }
}

function useNguonBadge(phone: string | null, pathname: string): NguonBadge {
  const [s, setS] = useState<NguonBadge>(KHONG);
  useEffect(() => {
    const doc = () => setS(docNguonBadge(phone));
    doc();
    const khiThay = () => {
      if (document.visibilityState === "visible") doc();
    };
    window.addEventListener(MARKET_CART_EVENT, doc);
    window.addEventListener(DOCK_BADGE_EVENT, doc);
    window.addEventListener("storage", doc);
    document.addEventListener("visibilitychange", khiThay);
    return () => {
      window.removeEventListener(MARKET_CART_EVENT, doc);
      window.removeEventListener(DOCK_BADGE_EVENT, doc);
      window.removeEventListener("storage", doc);
      document.removeEventListener("visibilitychange", khiThay);
    };
  }, [phone, pathname]);
  return s;
}

export function BottomNav() {
  const pathname = usePathname() ?? "/";
  const { phone } = useAuthUser();
  /*  DOCK THEO VAI (spec 17 §4.1): vai + gói quyết định có những ô nào. Vai đọc từ kho máy (useVai) — mất sóng
      vẫn đúng; khách / chủ tàu / chưa chọn vai = dock 6 ô như trước. */
  const { vai, banDo } = useVai();
  const dock = dockTheoVai(vai, banDo);
  const on = dockActive(pathname, dock);
  const goc = useNguonBadge(phone, pathname);
  // có ô Bán hàng thì đơn chờ đếm ở đó — Vật tư chỉ còn đếm giỏ, không đếm hai lần
  const coBanHang = dock.some((m) => m.id === "ban-hang");
  const nguon = coBanHang ? { ...goc, donChoBan: 0 } : goc;
  const nguonBanHang = goc;
  return (
    <div className="dock-frame">
      <nav aria-label="Điều hướng chính" className="bottom-dock">
        <ul className={`grid h-full ${COT[dock.length] ?? "grid-cols-6"} items-stretch`}>
          {dock.map(({ id, href, label }) => {
            const active = on === id;
            const Icon = id === "kairos" ? null : ICON[id];
            const nguonO = id === "ban-hang" ? nguonBanHang : nguon;
            const so = dockBadge(id, nguonO);
            return (
              <li key={id}>
                {/*  KIỂU FACEBOOK (anh Long 2026-10-19): chỉ icon, mục đang chọn
                    là pill xanh nhạt sau icon + icon xanh; tên mục vẫn đọc được
                    qua aria-label/title (trình đọc màn hình, nhấn giữ). */}
                <Link
                  href={href}
                  // Bản đồ là route nặng nhất (dữ liệu + bộ nghe Sen Biển) — không tải trước từ dock,
                  // kẻo trên 3G nó giành mạng với chính màn đang mở (rà tốc độ 2026-10-29: chạm dock im 4,8 s)
                  prefetch={id === "ban-do" ? false : undefined}
                  aria-current={active ? "page" : undefined}
                  aria-label={`${label}${nhanBadgeDock(id, nguonO)}`}
                  title={label}
                  onClick={(e) => {
                    // đang ở Hải đồ mà bấm Bản đồ ⇒ về bản đồ thường (tắt cờ trước khi Link chạy)
                    if (boHaiDoKhiBam(id, pathname)) {
                      setHaiDoPrefs({ moHaiDo: false });
                      return;
                    }
                    // Đang ở ĐÚNG trang gốc của mục ⇒ cuộn lên đầu. Đang ở trang con (/cho/don/x,
                    // /ban-hang…) ⇒ để Link đưa về trang gốc — trước đây chỉ cuộn, bấm không đi đâu
                    // (rà hành trình 2026-10-29).
                    if (!active || pathname !== href) return;
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="flex h-full items-center justify-center transition-transform duration-200 ease-out active:scale-95"
                >
                  <span
                    className={`relative flex h-10 w-[3.25rem] items-center justify-center rounded-full transition-colors ${
                      active ? "bg-sea/12 text-sea" : "text-foreground/70"
                    }`}
                  >
                    {Icon ? (
                      <Icon className="h-6 w-6 shrink-0" />
                    ) : (
                      <KairosFishIcon bien="dock" className={`h-[1.125rem] w-11 shrink-0 transition-opacity ${active ? "" : "opacity-70"}`} />
                    )}
                    {so > 0 && (
                      <span
                        aria-hidden
                        data-dock-badge={id}
                        className="absolute -right-0.5 -top-0.5 h-4 min-w-4 rounded-full bg-danger px-1 text-center text-[0.625rem] font-semibold leading-4 text-white"
                      >
                        {nhanDem(so)}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
