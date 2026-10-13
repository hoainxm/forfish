"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { loadBoats } from "@/lib/boats";
import { loadAssignments } from "@/lib/sdvico-assign";
import { useTodayVN } from "@/lib/use-today";
import { useSdvicoAssets } from "@/lib/use-sdvico-assets";
import { readToken } from "@/lib/device-token-store";
import { useOnline } from "@/lib/use-online";
import {
  AlertIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from "@/components/icons";
import { SQ_BTN } from "@/components/ui/sq-btn";

/*
  Việc cần làm ngay — one urgent strip spanning ALL pillars, not just giấy tờ.
  Reads the SAME localStorage the feature screens write, hydrates after mount
  (no read during render → no SSR mismatch), and renders nothing when there is
  nothing urgent so the home screen stays calm.

  2026-08-18 (audit thông báo): ngày theo lịch VN + ngưỡng chung (lib/days.ts),
  "hôm nay" tính lại khi app được đưa ra trước (S1), xếp theo NGÀY THẬT cho mọi
  loại (S3), đồ SDVICO qua hook cache dùng chung (S2), kho đọc hỏng coi như
  rỗng chứ không sập (T1).
*/

import {
  PILLAR_TAG,
  byUrgencyOrder,
  computeUrgent,
  sdvicoUrgent,
  type BoatCtx,
  type UrgentItem,
} from "@/lib/urgent";

// Logic tách sang lib/urgent.ts (2026-10-13) — re-export cho test cũ + chỗ gọi cũ.
export { byUrgencyOrder, sdvicoUrgent };

const MAX_ROWS = 4;

export function UrgentStrip() {
  const { today } = useTodayVN();
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<UrgentItem[]>([]);
  // "Còn N việc nữa" bấm là xòe đủ — không phải dòng chữ chết
  const [expanded, setExpanded] = useState(false);
  // đồ SDVICO qua cache module dùng chung với /tau (S2) — không fetch riêng,
  // và `noteResponse` bên trong hook soi được máy bị đá.
  const { status: sdvStatus, assets } = useSdvicoAssets();
  const [signedIn, setSignedIn] = useState(false);
  const online = useOnline();

  // Bối cảnh tàu để gắn nhãn "việc của tàu nào" (R6) — đọc sau mount.
  function buildBoatCtx(): BoatCtx {
    const boats = loadBoats();
    const names = new Map(boats.map((b) => [b.id, b.name] as const));
    return {
      multi: boats.length > 1,
      nameOf: (id) => (id ? names.get(id) : undefined),
      assign: loadAssignments(),
    };
  }

  // Hydrate from localStorage after mount only (avoids SSR/CSR mismatch).
  // `today` đổi (qua nửa đêm, app đưa ra trước) → tính lại.
  useEffect(() => {
    setItems(computeUrgent(today, buildBoatCtx()));
    setSignedIn(readToken() != null);
    setMounted(true);
  }, [today]);

  const sdvicoItems = useMemo(
    () => (assets ? sdvicoUrgent(assets, today, buildBoatCtx()) : []),
    [assets, today],
  );

  const all = useMemo(
    () => [...items, ...sdvicoItems].sort(byUrgencyOrder),
    [items, sdvicoItems],
  );

  if (!mounted) return null;

  /*  CHƯA CÓ TÀI KHOẢN ⇒ KHÔNG BÀY VIỆC CỦA TÀU (2026-09-01).
      Chủ dự án gửi ảnh dải khẩn đầy "Thay lọc dầu · Quá hạn 93 ngày" và bảo
      *"bỏ các loại dữ liệu seed này đi"*. Đã rà: KHÔNG còn seed nào trong code
      (đợt gỡ 2026-07-29 làm sạch, `boats.ts` cũng ghi rõ "KHÔNG seed tàu mẫu").
      Thứ trong ảnh là dữ liệu THẬT nằm ở máy đó — bản ghi tay còn lại từ lúc
      chạy thử, đọc thẳng từ localStorage.

      Nhưng nó phơi ra một lỗi thật, và là lỗi của chính đợt khoá đăng nhập vừa
      xong: cả app đã đòi tài khoản, mà trang chủ vẫn bày lịch bảo dưỡng + giấy
      tờ + nợ SDVICO đọc từ kho máy — tức việc của MỘT chủ tàu nào đó hiện ra
      cho người chưa đăng nhập. Máy dùng chung ở bến hay máy vừa cài lại là
      thấy việc của người khác.

      `readToken()` chứ không phải phiên Supabase: cùng tín hiệu với cổng
      `require-login`, nên mất sóng ngoài biển vẫn hiện đủ việc.

      KHÔNG áp cùng luật cho hộp thư (`inbox-section`): tin gửi CHUNG tới máy
      chưa gắn tài khoản là ca đã cố ý mở (sửa 2026-08-01n), giấu đi là mở lại
      đúng cái lỗ nó sinh ra để bịt. */
  if (!signedIn) return null;

  /*  Không hỏi được đồ SDVICO (S2): chỉ nói khi ĐÃ đăng nhập và máy đang CÓ
      sóng mà vẫn hỏng — mất sóng thì bà con biết rồi, nhắc là "nhắc như cái
      máy" (chính sách 2026-08-18: mất sóng không phải tin). */
  const sdvicoNote = signedIn && sdvStatus === "error" && online;

  if (all.length === 0) {
    if (!sdvicoNote) return null;
    return (
      <p className="px-2 text-[0.875rem] text-foreground/65">
        Chưa hỏi được nợ/bảo hành bên SDVICO — sóng đang yếu, app sẽ thử lại.
      </p>
    );
  }

  const shown = expanded ? all : all.slice(0, MAX_ROWS);
  const rest = all.length - shown.length;

  return (
    <section aria-label="Việc cần làm ngay">
      {/*  Nút xoè/thu về INLINE cuối hàng tiêu đề (2026-08-29, luật A2/A3/A5).
          Trước: dải 343×48 full-width ăn riêng một hàng ngay dưới 4 hàng việc
          343×81 nên mắt đọc nó như HÀNG VIỆC THỨ 5; cao 48px, dưới sàn 52px; và
          onClick chỉ setExpanded(true) — xoè rồi KHÔNG có đường thu lại (nút tự
          biến mất vì rest===0), trong khi hộp thư ngay dưới cùng màn thì có
          "Thu gọn". Con số "còn N việc" là DỮ LIỆU ⇒ lên hàng tiêu đề. */}
      <div className="mb-1.5 flex items-stretch gap-2 px-1">
        <div className="flex min-w-0 flex-1 items-center">
          <h2 className="display text-[1rem] font-bold text-navy">
            Việc cần làm ngay
            {rest > 0 && (
              <span className="font-semibold text-foreground/70">
                {" "}
                · còn {rest} việc nữa
              </span>
            )}
          </h2>
        </div>
        {all.length > MAX_ROWS ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className={`${SQ_BTN} bg-background text-sea`}
          >
            <ChevronDownIcon
              className={`h-6 w-6 ${expanded ? "rotate-180" : ""}`}
            />
            {expanded ? "Thu gọn" : "Xem hết"}
          </button>
        ) : (
          <span className="w-16 shrink-0" aria-hidden />
        )}
      </div>
      <div className="overflow-hidden surface">
        <ul>
          {shown.map((item, i) => {
            const Icon = item.tone === "danger" ? AlertIcon : ClockIcon;
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 py-3.5 pl-4 transition active:bg-background ${
                    i > 0 ? "border-t border-line" : ""
                  }`}
                >
                  <span
                    className={`flex h-3 w-3 shrink-0 rounded-full ${
                      item.tone === "danger" ? "bg-danger" : "bg-warn"
                    }`}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="block min-w-0 truncate text-[1.125rem] font-semibold">
                        {item.label}
                      </span>
                      <span className="shrink-0 rounded-md bg-background px-1.5 py-0.5 text-[0.75rem] font-bold text-foreground/70">
                        {PILLAR_TAG[item.pillar].tag}
                      </span>
                      {item.boatLabel && (
                        <span className="shrink-0 truncate rounded-md bg-navy/10 px-1.5 py-0.5 text-[0.75rem] font-bold text-navy">
                          {item.boatLabel}
                        </span>
                      )}
                    </span>
                    <span
                      className={`flex items-center gap-1 text-[0.9375rem] font-bold ${
                        item.tone === "danger" ? "text-danger" : "text-warn"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.status}
                    </span>
                  </span>
                  {/*  Chevron nằm trong ĐÚNG cột w-16 như hộp thư (2026-08-29f):
                       trước đây nó ở trong lề px-4 của thẻ nên tâm icon lệch 8px
                       so với chevron hộp thư ngay bên dưới — hai danh sách cùng
                       một màn mà hai cột icon không thẳng. */}
                  <span
                    className="flex w-16 shrink-0 items-center justify-center text-foreground/30"
                    aria-hidden
                  >
                    <ChevronRightIcon className="h-6 w-6" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        {sdvicoNote && (
          <p className="border-t border-line px-4 py-2 text-[0.875rem] text-foreground/65">
            Chưa hỏi được nợ/bảo hành bên SDVICO — sóng đang yếu, app sẽ thử lại.
          </p>
        )}
      </div>
    </section>
  );
}
