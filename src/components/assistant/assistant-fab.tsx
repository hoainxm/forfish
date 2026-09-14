"use client";

/*
  NÚT NỔI "SEN BIỂN" — một chạm là NGHE (13 §5.1 · P1, 14 §7.1).

  Tên "Sen Biển" (user chốt 2026-09-07): linh vật cá xanh đội nụ sen cam,
  hai vây bên mở như đang lắng nghe và cụm sóng làm chân, nhãn tên ở dưới.
  Ảnh PNG có alpha thật;
  nút không mang nền, viền hay huy hiệu để linh vật nổi trực tiếp như bot của
  app ngân hàng. Hình mic bỏ vì nó nói "ghi âm" chứ không nói "có người giúp".

  Vì sao là nút nổi chứ không phải ô trong dock: dock đã kín 5 khu (Trang chủ ·
  Ra khơi · Tàu cá · Bạn thuyền · Giao dịch) và trợ lý KHÔNG phải trục thứ sáu —
  nó là đường tắt vào cả bốn lời hứa. Nút nổi mặc định góc dưới-phải, ngay trên
  dock; bà con KÉO được tới chỗ khác và ẨN được (khuôn chung `ui/float-btn` —
  giỏ hàng ở Cửa hàng cũng dùng, nên hai nút không còn đè nhau và không bay ra
  ngoài cột app 480px ở màn rộng).

  Ba luật ẩn TỰ ĐỘNG, theo đúng thứ tự rẻ → đắt:
  · route cấm (danh sách tĩnh, không tính toán gì);
  · bàn phím mở (`visualViewport` co > 150px — nút nổi che chỗ gõ là hỏng việc
    đang làm dở, tệ hơn là không có trợ lý);
  · panel khác đang mở (`[role=dialog][aria-modal]` trong body — BottomSheet /
    ConfirmDialog portal ra body). z-20 đã nằm DƯỚI scrim z-30 nên nút không
    bấm được, nhưng scrim đen 50% vẫn để lộ nút cam — 13 đòi ẨN hẳn.

  KHÔNG tải gì lúc mount (CLAUDE.md 🟡 (a)): snapshot chỉ gom khi bà con MỞ
  tấm che. Vì vậy nút không có chấm đỏ báo việc — 13 §5.1 cũng không đòi chấm;
  việc đỏ/vàng vào chip gợi ý bên trong tấm che (13 §5.3). Thứ duy nhất đọc
  từ máy lúc gắn là VỊ TRÍ nút bà con đã kéo (`forfish.fab.v1`, trong FloatBtn).
*/

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FloatBtn } from "@/components/ui/float-btn";

/** Màn KHÔNG có trợ lý (13 §5.1) — web quản trị, màn kỹ thuật, mọi màn đăng nhập. */
const HIDDEN_PREFIXES = [
  "/quan-tri",
  "/dev",
  "/login",
  "/dang-ky",
  "/doi-mat-khau",
  "/quen-mat-khau",
  "/huong-dan.html",
  "/quyen-rieng-tu",
] as const;

/*  THANH ĐÁY DÍNH — nút nổi NHƯỜNG CHỖ (13 §5.1 "Không che").

    Đo thật 390×844 trên `/cho/sp/<id>`: thanh dính cao ~4,75rem ngồi ngay trên
    dock, và NGAY TRÊN thanh là hàng "Số lượng − 1 +". Dời nút nổi lên trên
    thanh (cách 13 gợi ý) thì nó đè đúng nút "+" — tức che một nút bấm, sát
    cạnh CTA "Thêm vào giỏ". Không có góc nào trống ở vùng ngón cái của hai màn
    này, vì cả vùng đó ĐÃ LÀ hành động chính của màn.

    Nên ở đâu có thanh dính thì ẩn nút nổi. Bà con vẫn gọi trợ lý được từ mọi
    màn khác, còn màn này thì việc chính đã nằm sẵn dưới ngón tay.
    // nợ: hiện lại (dời lên trên thanh) khi hàng nút của `market-cart.tsx` và
    // `product-detail.tsx` có `padding-right: 4.5rem` chừa chỗ — cách còn lại
    // mà 13 §5.1 cho phép; hai file đó không thuộc phần việc của UI trợ lý.

    Nhận diện bằng chính DẤU VẾT của thanh: cả hai thanh đều đặt inline
    `bottom: var(--dock-total)` VÀ là `position: fixed`. Bắt theo dấu vết thật
    chứ không theo danh sách route, nên giỏ TRỐNG (không có thanh) vẫn còn nút nổi.

    ⚠️ Lớp bọc của chính nút nổi (và của nút giỏ hàng) cũng neo theo
    `--dock-total`, nhưng là `absolute` trong khung nên phép lọc `fixed` đã loại
    chúng. Vẫn truyền node của nút vào để chắc: bản cũ từng tự thấy mình → tự ẩn
    → DOM đổi → soi lại → hiện lại → vòng lặp vô tận (đo thật 2026-09-06:
    ~10.000 lượt gắn/gỡ mỗi giây, chạm vào không được). */
function stickyBarOpen(self: HTMLElement | null): boolean {
  if (typeof document === "undefined") return false;
  for (const el of document.querySelectorAll<HTMLElement>('[style*="--dock-total"]')) {
    if (el === self || (self && el.contains(self))) continue;
    const cs = getComputedStyle(el);
    if (cs.position === "fixed" && el.getBoundingClientRect().height > 0) return true;
  }
  return false;
}

export function assistantHiddenOn(pathname: string): boolean {
  return HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Bàn phím ảo đang mở? `visualViewport` co lại > 150px so với chiều cao cửa sổ. */
function keyboardOpen(): boolean {
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  if (!vv) return false;
  return window.innerHeight - vv.height > 150;
}

/** Có panel dùng chung nào đang mở không (BottomSheet, ConfirmDialog — đều portal ra body). */
function modalOpen(): boolean {
  if (typeof document === "undefined") return false;
  return !!document.querySelector('[role="dialog"][aria-modal="true"]');
}

/*  SHEET RA KHƠI ĐANG NỞ (`SnapSheet` nấc `half`) → ẩn nút nổi (13 §5.1 dòng
    "Ẩn khi … sheet Ra khơi ở half").

    `SnapSheet` không phải dialog (cố ý: bản đồ phía trên vẫn chạm được) nên
    `modalOpen()` không thấy nó, và file đó không thuộc phần việc của UI trợ lý
    để thêm một `data-*`. Nhận bằng DẤU VẾT thật: chỉ nấc `half` mới đặt chiều
    cao theo PHẦN TRĂM khung map (`height: 55%`); `peek`/`hidden` là `auto`.
    Lối này giống hệt cách `stickyBarOpen` bắt thanh đáy qua `--dock-total`.
    // nợ: đổi sang `data-size` của SnapSheet khi Trục 1 export trạng thái sheet
    // (14 §7.1) — lúc đó bỏ hẳn hàm này. */
function mapSheetOpen(): boolean {
  if (typeof document === "undefined") return false;
  for (const el of document.querySelectorAll<HTMLElement>('section[role="region"]')) {
    if (el.style.height.trim().endsWith("%")) return true;
  }
  return false;
}

/*  DẢI CHIP NGÀY của Ra khơi ("Th 4 9/9") — nút nổi đè đúng chip cuối, mà đổi
    ngày là việc màn đó tồn tại để làm (P1-13). Dải này nổi trên mép sheet nên
    vị trí thay đổi theo nấc sheet ⇒ ĐO THẬT rồi nâng nút lên vừa đủ, không
    đoán bằng hằng số.

    Nhận bằng nhãn a11y (`role=group aria-label="Chọn ngày xem dự báo"`) — thứ
    có sẵn, ổn định hơn class.

    `lifted` = số px đang nâng: đo lại phải trừ nó ra để lấy vị trí GỐC của nút,
    không thì nâng xong hết giao nhau → hạ xuống → lại giao → nhấp nháy. */
const DAY_STRIP = '[role="group"][aria-label="Chọn ngày xem dự báo"]';
const STRIP_GAP = 8; // px, cách dải một khoảng thấy được

function liftOverDayStrip(self: HTMLElement | null, lifted: number): number {
  if (!self || typeof document === "undefined") return 0;
  const strip = document.querySelector<HTMLElement>(DAY_STRIP);
  if (!strip) return 0;
  const s = strip.getBoundingClientRect();
  if (s.height <= 0) return 0;
  const b = self.getBoundingClientRect();
  const bottomKhiChuaNang = b.bottom + lifted;
  return Math.max(0, Math.round(bottomKhiChuaNang - s.top + STRIP_GAP));
}

export function AssistantFab({ open, onOpen }: { open: boolean; onOpen: () => void }) {
  const pathname = usePathname();
  const btnRef = useRef<HTMLButtonElement>(null);
  const [blocked, setBlocked] = useState(false);
  const [lift, setLift] = useState(0);
  const liftRef = useRef(0);
  /*  Đang KÉO thì không đo: nút đi theo ngón tay, đo giữa chừng là nâng/hạ
      giật cục. Thả xong lớp bọc đổi `style` → observer bên dưới đo lại. */
  const draggingRef = useRef(false);

  /*  NHỊP THỞ MỘT LƯỢT KHI MỞ APP (03 §Trợ lý trong app, luật 11): bà con phải
      biết là CÓ trợ lý ở đó. Đúng 3 nhịp rồi thôi — WCAG 2.2.2 cấm chuyển động
      tự chạy quá 5 giây không dừng được, và ngư dân đang lái tàu thì một cái
      nhấp nháy vô hạn ở góc màn là thứ gây phiền, không phải thứ mời gọi.
      Gỡ class sau 4,4 s để lần vẽ lại sau không chạy lại hiệu ứng. */
  const [tho, setTho] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setTho(false), 4400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const recheck = () => {
      if (draggingRef.current) return;
      setBlocked(keyboardOpen() || modalOpen() || stickyBarOpen(btnRef.current) || mapSheetOpen());
      const next = liftOverDayStrip(btnRef.current, liftRef.current);
      liftRef.current = next;
      setLift(next);
    };
    recheck();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", recheck);
    /*  Panel dùng chung mở/đóng = thêm/bớt node con của body (createPortal);
        thanh đáy dính hiện/mất khi giỏ có món hay trống, nằm sâu trong cây.

        `recheck` đọc `getComputedStyle` ⇒ ép trình duyệt tính lại bố cục. Trên
        `/ngu-truong` bản đồ thêm/bớt node liên tục, chạy mỗi lần là ép layout
        mỗi khung hình. Nên LỌC TRƯỚC bằng chuỗi (không đụng layout): chỉ tính
        lại khi node vừa thêm/bớt thật sự là panel hay thanh đáy dính. */
    const SEL = `[style*="--dock-total"], [role="dialog"], ${DAY_STRIP}`;
    const touches = (n: Node) => {
      const el = n as Element;
      return typeof el.matches === "function" && (el.matches(SEL) || !!el.querySelector?.(SEL));
    };
    /*  Sheet nở/thu KHÔNG thêm bớt node — nó đổi `style.height` của chính
        section, và dải ngày đi theo. Nên nghe thêm đổi thuộc tính, rồi đo LẠI
        sau 220 ms vì chiều cao có hoạt ảnh 200 ms (đo giữa chừng là nâng hụt). */
    let after: ReturnType<typeof setTimeout> | undefined;
    const recheckSau = () => {
      recheck();
      clearTimeout(after);
      after = setTimeout(recheck, 220);
    };
    const mo = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === "attributes") return recheckSau();
        for (const list of [r.addedNodes, r.removedNodes]) {
          for (const n of list) if (touches(n)) return recheckSau();
        }
      }
    });
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style"],
    });
    return () => {
      vv?.removeEventListener("resize", recheck);
      clearTimeout(after);
      mo.disconnect();
    };
  }, [pathname]);

  // nợ: chưa ẩn khi HUD dẫn đường live đang chạy — Trục 1 chưa export trạng
  // thái đó; nâng khi `nav-mode` có export (14 §7.1). Sheet Ra khơi nấc `half`
  // đã ẩn được qua `mapSheetOpen()`.
  if (open || blocked || assistantHiddenOn(pathname)) return null;

  return (
    <FloatBtn
      id="sen-bien"
      label="Sen Biển — bấm để nói"
      onPress={onOpen}
      baseBottom="0.75rem"
      size="4rem"
      className={`fab-tro-ly bg-transparent text-navy ${tho ? "anim-fab-tho" : ""}`}
      lift={lift}
      btnRef={btnRef}
      onDragChange={(d) => {
        draggingRef.current = d;
      }}
    >
      <Image
        src="/icons/sen-bien.png"
        width={48}
        height={48}
        alt=""
        draggable={false}
        className="fab-mascot h-11 w-11 object-contain"
      />
      <span className="fab-nhan mt-0.5 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[0.6875rem] font-bold leading-none text-navy">Sen Biển</span>
    </FloatBtn>
  );
}
