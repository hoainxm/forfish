"use client";

/**
 * NHẮC CÀI VỀ MÁY — để offline chạy đáng tin trên WEB.
 *
 * Vì sao: mở app trong TAB trình duyệt thì cache có thể bị dọn khi máy đầy, và
 * iOS Safari xoá SẠCH storage sau ~7 ngày không dùng NẾU chưa "Thêm vào màn hình
 * chính" — chuyến biển 5–16 ngày sẽ mất dữ liệu giữa chuyến. Cài về máy = thoát
 * cả hai. Đây là cách DUY NHẤT vượt giới hạn 7 ngày của iOS (không có API).
 *
 * CHẠY SONG SONG VỚI BẢN CH PLAY (chủ dự án chốt 2026-08-26: *"cho chạy song
 * song đi, tức là cài chrome hay pwa trên web đều được"*): thẻ KHÔNG còn phụ
 * thuộc vào `beforeinstallprompt`. Máy đã có bản TWA từ CH Play thì Chrome coi
 * origin này "đã cài" và KHÔNG BAO GIỜ bắn sự kiện đó nữa — code web không ép
 * được. Nên Android nay có hai nhánh: có sự kiện → nút bung hộp cài; chờ
 * BIP_WAIT_MS không thấy → hướng dẫn tay qua menu Chrome, y như iPhone.
 *
 * Ẩn khi: đã cài (standalone) · đã tắt nhắc · máy không phải Android/iOS và
 * trình duyệt không cho cài (desktop) · MẤT SÓNG (tầng mời
 * gọi ẩn hẳn khi offline — cài app cần mạng) · đã nhắc đủ 3 lần cách ≥1 ngày
 * (lib/install-nudge.ts) · dải "Việc cần làm ngay" đang ≥3 dòng (Trục 4 là lý
 * do app tồn tại — nhắc cài nhường chỗ, audit S8). Không nài — tắt là nhớ.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";

import { isStandalone, isIOS, isAndroid } from "@/lib/storage-persist";
import { useOnline } from "@/lib/use-online";
import {
  INSTALL_NUDGE_KEY,
  INSTALL_NUDGE_LEGACY_KEY,
  markInstallNudgeDismissed,
  markInstallNudgeShown,
  parseInstallNudge,
  shouldShowInstallNudge,
  type InstallNudgeState,
} from "@/lib/install-nudge";
import { AnchorIcon, CloseIcon } from "@/components/icons";

/** Dải khẩn từ ngần này dòng trở lên thì nhắc cài nhường chỗ. */
const URGENT_ROWS_HIDE_INSTALL = 3;

/*  Chờ `beforeinstallprompt` ngần này rồi mới chuyển sang hướng dẫn tay.
    Chrome bắn sự kiện gần như tức thì khi máy ĐỦ ĐIỀU KIỆN cài; chờ lâu hơn
    chỉ làm thẻ nhấp nháy đổi hình trước mắt bà con. Sự kiện tới muộn vẫn được
    NHẬN và nâng cấp thẻ lên nút bấm — không mất đường cài tử tế. */
const BIP_WAIT_MS = 2500;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function readNudge(): InstallNudgeState {
  try {
    return parseInstallNudge(
      localStorage.getItem(INSTALL_NUDGE_KEY),
      localStorage.getItem(INSTALL_NUDGE_LEGACY_KEY),
    );
  } catch {
    // không đọc được localStorage — coi như chưa nhắc lần nào
    return parseInstallNudge(null, null);
  }
}

function writeNudge(s: InstallNudgeState) {
  try {
    localStorage.setItem(INSTALL_NUDGE_KEY, JSON.stringify(s));
  } catch {
    // storage đầy/chặn — vẫn áp dụng cho phiên này
  }
}

/**
 * Bọc dải khẩn + nhắc cài (Trang chủ): đếm số dòng `li` của dải khẩn ngay
 * trong cây con của mình để ẩn nhắc cài khi dải ≥3 dòng. Không đụng
 * urgent-strip; không đọc lại localStorage lần hai. `children` = UrgentStrip.
 */
export function UrgentWithInstall({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [rows, setRows] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const count = () => setRows(el.querySelectorAll("li").length);
    count();
    const mo = new MutationObserver(count);
    mo.observe(el, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);
  return (
    // empty:hidden — cả hai đều không vẽ gì thì khối này biến mất, không để lại
    // khoảng trống trong space-y của trang
    <div ref={ref} className="space-y-4 empty:hidden">
      {children}
      {rows < URGENT_ROWS_HIDE_INSTALL && <InstallBanner />}
    </div>
  );
}

export function InstallBanner() {
  /*  `android`     = Chrome cho cài, có nút bung hộp cài
      `android-tay` = Chrome KHÔNG hỏi (thường vì máy đã có bản CH Play) →
                      chỉ đường qua menu ⋮
      `ios`         = iPhone, xưa nay vẫn hướng dẫn tay */
  const [mode, setMode] = useState<"android" | "android-tay" | "ios" | null>(
    null,
  );
  const deferred = useRef<BeforeInstallPromptEvent | null>(null);
  const online = useOnline();
  /* mỗi lần thẻ THẬT SỰ hiện mới tính một lượt — chỉ ghi khi mode được đặt */
  const marked = useRef(false);

  useEffect(() => {
    if (isStandalone()) return; // đã cài rồi → thôi
    if (!shouldShowInstallNudge(readNudge(), Date.now())) return;

    // iOS Safari: KHÔNG có beforeinstallprompt → hướng dẫn tay
    if (isIOS()) {
      setMode("ios");
      return;
    }

    // Android/Chrome: chờ trình duyệt cho phép cài; sự kiện tới muộn vẫn nhận
    const onBIP = (e: Event) => {
      e.preventDefault(); // giữ sự kiện để tự bung khi bà con bấm
      deferred.current = e as BeforeInstallPromptEvent;
      setMode("android"); // nâng cấp cả khi đang ở nhánh hướng dẫn tay
    };
    const onInstalled = () => setMode(null);
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);

    /*  Hết giờ chờ mà Chrome không hỏi → VẪN mời cài, chỉ đường bằng tay.
        CHỈ trên Android: desktop không cài được thì mời là mời hão. */
    const t = isAndroid()
      ? window.setTimeout(() => {
          if (!deferred.current) setMode("android-tay");
        }, BIP_WAIT_MS)
      : null;

    return () => {
      if (t != null) window.clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // ghi "đã hiện 1 lượt" đúng lúc thẻ ra màn (không tính lúc đang chờ BIP)
  useEffect(() => {
    if (!mode || marked.current) return;
    marked.current = true;
    writeNudge(markInstallNudgeShown(readNudge(), Date.now()));
  }, [mode]);

  // MẤT SÓNG → ẩn (không huỷ state; sóng về thì hiện lại)
  if (!mode || !online) return null;

  const dismiss = () => {
    writeNudge(markInstallNudgeDismissed(readNudge()));
    setMode(null);
  };

  const install = async () => {
    const d = deferred.current;
    if (!d) return;
    let outcome: "accepted" | "dismissed" = "dismissed";
    try {
      await d.prompt();
      outcome = (await d.userChoice).outcome;
    } catch {
      // bà con huỷ / lỗi — không sao
    }
    deferred.current = null;
    // bấm Cài rồi HUỶ = đã trả lời rồi, ghi như đã tắt (audit S7)
    if (outcome === "dismissed") writeNudge(markInstallNudgeDismissed(readNudge()));
    setMode(null);
  };

  return (
    <div className="surface flex gap-3 p-4">
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-t1-bg text-t1"
        aria-hidden
      >
        <AnchorIcon className="h-6 w-6" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="display text-[1.0625rem] font-bold leading-tight text-navy">
          Cài SDFish về máy
        </p>
        {/* CÂU CHỮ TÁCH THEO MÁY (sửa 2026-07-31): trên Android bản cài dùng
            CHUNG kho với trình duyệt nên cài xong là mang theo được thật. Trên
            iPhone bản cài giữ kho RIÊNG — dự báo đã tải trong Safari KHÔNG theo
            sang, mà lần mở đầu tiên của bản cài bắt buộc phải có sóng. Hứa
            "cài xong là ra khơi mở được" cho iPhone là hứa hão. */}
        <p className="mt-1 text-[0.9375rem] leading-snug text-foreground/70">
          {mode === "ios"
            ? "Cài về màn hình chính thì máy giữ dự báo lâu hơn — không tự xoá sau ít ngày."
            : "Cài về màn hình chính thì ra khơi mất sóng vẫn mở được, và máy giữ dự báo lâu hơn — không tự xoá sau ít ngày."}
        </p>

        {mode === "android-tay" ? (
          /*  Chrome không hỏi — hầu hết là vì máy đã có bản CH Play, lúc đó
              Chrome coi origin này "đã cài". Không nói lý do kỹ thuật ra màn
              hình: bà con chỉ cần biết BẤM VÀO ĐÂU. */
          <p className="mt-2 rounded-xl bg-background p-3 text-[0.9375rem] font-semibold leading-snug text-navy">
            Trên Android: bấm nút <span className="font-bold">⋮</span> ở góc trên
            Chrome, rồi chọn{" "}
            <span className="font-bold">“Thêm vào Màn hình chính”</span> (có máy
            ghi <span className="font-bold">“Cài ứng dụng”</span>).
          </p>
        ) : mode === "ios" ? (
          <p className="mt-2 rounded-xl bg-background p-3 text-[0.9375rem] font-semibold leading-snug text-navy">
            Trên iPhone: bấm nút <span className="font-bold">Chia sẻ</span> ở thanh
            dưới trình duyệt, rồi chọn{" "}
            <span className="font-bold">“Thêm vào Màn hình chính”</span>.
            <span className="mt-2 block font-bold text-danger">
              Cài xong mở app vừa cài NGAY khi còn sóng: bản cài bắt đầu từ kho
              trống, phải tải lại dự báo một lần.
            </span>
          </p>
        ) : (
          <button
            type="button"
            onClick={install}
            className="mt-2 flex min-h-[3.25rem] w-full items-center justify-center rounded-xl bg-t1 text-[1.0625rem] font-bold text-white transition active:scale-[0.99]"
          >
            Cài về máy
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Ẩn nhắc cài về máy"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground/50 transition active:bg-background"
      >
        <CloseIcon className="h-5 w-5" />
      </button>
    </div>
  );
}
