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

import { NHAN } from "@/lib/labels";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { isStandalone, isIOS, isAndroid } from "@/lib/storage-persist";
import { useOnline } from "@/lib/use-online";
import {
  INSTALL_NUDGE_KEY,
  INSTALL_NUDGE_LEGACY_KEY,
  markInstallNudgeDismissed,
  markInstallNudgeSnoozed,
  markInstallNudgeShown,
  parseInstallNudge,
  shouldShowInstallNudge,
  type InstallNudgeState,
} from "@/lib/install-nudge";
import { AnchorIcon, ChevronRightIcon, CloseIcon } from "@/components/icons";
import { SQ_BTN } from "@/components/ui/sq-btn";

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
  /*  MỘT HÀNG, CHẠM MỚI BUNG (chủ dự án chốt 2026-10-19 sau kiểm ảnh 360×740):
      thẻ cũ — tiêu đề + 2 câu + hộp hướng dẫn — chiếm hơn nửa màn ngay dưới tin
      bão, đẩy Việc cần làm và Thông báo xuống dưới. Nay gập còn một hàng 56px;
      chạm hàng mới mở lời giải thích + hướng dẫn từng bước + nút cài. */
  const [open, setOpen] = useState(false);
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

  // "Ẩn" = hoãn 7 ngày (lib/install-nudge) — Cài-rồi-huỷ hộp của máy vẫn là tắt hẳn (dưới)
  const dismiss = () => {
    writeNudge(markInstallNudgeSnoozed(readNudge(), Date.now()));
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

  const guide =
    mode === "android-tay" ? (
      /*  Chrome không hỏi — hầu hết là vì máy đã có bản CH Play, lúc đó
          Chrome coi origin này "đã cài". Không nói lý do kỹ thuật ra màn
          hình: bà con chỉ cần biết BẤM VÀO ĐÂU. */
      <p className="rounded-xl bg-background p-3 text-[1rem] font-semibold leading-snug text-navy">
        Trên Android: bấm nút <span className="font-semibold">⋮</span> ở góc trên
        Chrome, rồi chọn{" "}
        <span className="font-semibold">“Thêm vào Màn hình chính”</span> (có máy
        ghi <span className="font-semibold">“Cài ứng dụng”</span>).
      </p>
    ) : mode === "ios" ? (
      <p className="rounded-xl bg-background p-3 text-[1rem] font-semibold leading-snug text-navy">
        Trên iPhone: bấm nút <span className="font-semibold">Chia sẻ</span> ở thanh
        dưới trình duyệt, rồi chọn{" "}
        <span className="font-semibold">“Thêm vào Màn hình chính”</span>.
        <span className="mt-2 block font-semibold text-danger">
          Cài xong mở app vừa cài NGAY khi còn sóng: bản cài bắt đầu từ kho
          trống, phải tải lại dự báo một lần.
        </span>
      </p>
    ) : (
      <button
        type="button"
        onClick={install}
        className="flex min-h-(--h-row) w-full items-center justify-center gap-2 rounded-2xl bg-t1 text-[1rem] font-semibold text-white transition active:scale-[0.98]"
      >
        <AnchorIcon className="h-5 w-5" />
        {NHAN.caiApp}
      </button>
    );

  return (
    <div className="surface p-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-h-(--h-row) min-w-0 flex-1 items-center gap-3 rounded-2xl pl-2 text-left transition active:bg-background"
        >
          {/* icon TRƠN, không vòng tròn màu (rà Taste 2026-10-22: "icon trong ô/vòng tô màu"
              là dấu giao diện máy sinh) — giữ màu thương hiệu trên nét icon */}
          <AnchorIcon className="h-5 w-5 shrink-0 text-t1" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="display block text-[1rem] font-semibold leading-tight text-navy">Cài app</span>
            <span className="block text-[0.8125rem] leading-snug text-foreground/65">Dùng được khi mất sóng</span>
          </span>
          <ChevronRightIcon
            className={`h-5 w-5 shrink-0 text-foreground/60 transition-transform ${open ? "rotate-90" : ""}`}
          />
        </button>
        {/*  Nút đóng theo khuôn ô vuông chung (2026-08-29, luật A2/A3/A5): sàn
            chạm 56px, tay ướt tàu lắc không bấm nhầm. aria-label giữ nguyên. */}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Ẩn nhắc cài về máy"
          className={`${SQ_BTN} text-foreground/70 active:bg-background`}
        >
          <CloseIcon className="h-6 w-6" />
          Ẩn
        </button>
      </div>
      {open && (
        <div className="space-y-2 px-2 pb-2 pt-1">
          {/* CÂU CHỮ TÁCH THEO MÁY (sửa 2026-07-31): trên Android bản cài dùng
              CHUNG kho với trình duyệt nên cài xong là mang theo được thật. Trên
              iPhone bản cài giữ kho RIÊNG — dự báo đã tải trong Safari KHÔNG theo
              sang, mà lần mở đầu tiên của bản cài bắt buộc phải có sóng. Hứa
              "cài xong là ra khơi mở được" cho iPhone là hứa hão. */}
          <p className="text-[1rem] leading-snug text-foreground/75">
            {mode === "ios"
              ? "Cài ra màn hình chính giúp máy giữ dự báo lâu hơn (không bị tự xóa sau vài ngày)."
              : "Cài ra màn hình chính giúp mở app khi không có sóng, và máy sẽ giữ dự báo lâu hơn (không bị tự xóa sau vài ngày)."}
          </p>
          {guide}
        </div>
      )}
    </div>
  );
}
