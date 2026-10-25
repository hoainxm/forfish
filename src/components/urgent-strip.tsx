"use client";

import { NHAN } from "@/lib/labels";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { loadBoats } from "@/lib/boats";
import { loadAssignments } from "@/lib/sdvico-assign";
import { useTodayVN } from "@/lib/use-today";
import { useSdvicoAssets } from "@/lib/use-sdvico-assets";
import { readToken } from "@/lib/device-token-store";
import { useOnline } from "@/lib/use-online";
import { USER_SYNC_EVENT } from "@/lib/user-sync";
import {
  AlertIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from "@/components/icons";

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

  /*  ĐỒNG BỘ NHẬN BẢN MỚI ⇒ ĐỌC LẠI (2026-10-24, anh Long: giấy tờ / bạn thuyền
      đã xoá vẫn hiện ở đây). Dải đọc kho máy NGAY khi mở app, trước khi
      `syncAll` kịp kéo bản server về — xoá ở máy khác thì máy này vẫn bày mục
      cũ suốt phiên vì không ai bảo dải đọc lại. Nay nghe `USER_SYNC_EVENT`
      (bắn khi nhận bản server) như tủ giấy tờ / sổ thuyền viên. */
  useEffect(() => {
    const onSync = () => setItems(computeUrgent(today, buildBoatCtx()));
    window.addEventListener(USER_SYNC_EVENT, onSync);
    return () => window.removeEventListener(USER_SYNC_EVENT, onSync);
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
      <p className="px-1 text-[1rem] leading-snug text-foreground/70">
        Chưa hỏi được nợ/bảo hành bên SDVICO — sóng đang yếu, app sẽ thử lại.
      </p>
    );
  }

  const shown = expanded ? all : all.slice(0, MAX_ROWS);
  const rest = all.length - shown.length;

  /*  CÙNG KHUÔN VỚI "THÔNG BÁO" ngay dưới (làm lại 2026-10-19, rà design Codex):
      một khối danh sách kẻ mảnh, chữ ≥1.125rem; nhãn trục + tên tàu (trước là hai
      tag 12px) gộp thành MỘT dòng phụ cùng cỡ; mũi tên nhỏ trong hàng thay cột
      w-16 rỗng; "Xem hết" là HÀNG CUỐI danh sách (trước là nút 11px trên tiêu đề). */
  return (
    <section aria-label="Việc cần làm ngay">
      {/* không px-1 — thẳng mép với tiêu đề "Thông báo" ngay dưới (TC-17) */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="display text-[1rem] font-semibold text-navy">Việc cần làm</h2>
        <span className="text-[0.8125rem] font-medium text-foreground/65">{all.length} việc</span>
      </div>
      <ul className="divide-y divide-line overflow-hidden surface overflow-hidden">
        {shown.map((item) => {
          const Icon = item.tone === "danger" ? AlertIcon : ClockIcon;
          const phu = [PILLAR_TAG[item.pillar].tag, item.boatLabel].filter(Boolean).join(" · ");
          return (
            <li key={item.id}>
              <Link href={item.href} className="flex min-h-(--h-row) items-start gap-3 px-4 py-3 active:bg-field">
                <span
                  className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${item.tone === "danger" ? "bg-danger" : "bg-warn"}`}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[1rem] font-semibold leading-snug text-navy">{item.label}</span>
                  <span
                    className={`mt-0.5 flex items-center gap-1 text-[1rem] font-semibold leading-snug ${
                      item.tone === "danger" ? "text-danger" : "text-warn"
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {item.status}
                  </span>
                  {phu && <span className="mt-0.5 block text-[0.8125rem] leading-snug text-foreground/65">{phu}</span>}
                </span>
                <ChevronRightIcon className="mt-0.5 h-5 w-5 shrink-0 text-foreground/50" />
              </Link>
            </li>
          );
        })}
        {(rest > 0 || expanded) && (
          <li>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="flex min-h-(--h-row) w-full items-center justify-center gap-2 px-4 text-[1rem] font-semibold text-navy active:bg-field"
            >
              <ChevronDownIcon className={`h-5 w-5 ${expanded ? "rotate-180" : ""}`} />
              {expanded ? NHAN.thuGon : NHAN.xemThem}
              {!expanded && rest > 0 && (
                <span className="rounded-full bg-field px-2 py-0.5 text-[0.75rem] font-semibold text-foreground/70">{rest}</span>
              )}
            </button>
          </li>
        )}
        {sdvicoNote && (
          <li className="px-4 py-3 text-[1rem] leading-snug text-foreground/70">
            Chưa hỏi được nợ/bảo hành bên SDVICO — sóng đang yếu, app sẽ thử lại.
          </li>
        )}
      </ul>
    </section>
  );
}
