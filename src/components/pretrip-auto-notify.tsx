"use client";

/**
 * Trục 1 — TỰ TẢI SẴN DỰ BÁO + một dòng báo tự tắt.
 *
 * Trước 2026-07-25 chỗ này là thẻ "Chuẩn bị đi biển": một nút to + thẻ xanh báo
 * xong + một dòng thường trực "Trong máy: …". Chủ dự án xem app thật thấy màn
 * hình RỐI vì quá nhiều chữ nằm lì trên bản đồ → bỏ cả ba, máy tự lo.
 *
 * Cách hiện học theo banner tin bão (components/storm-banner.tsx): một dòng gọn
 * bo tròn, nổi trên bản đồ, nói xong thì TỰ TẮT — không có nút, không chắn view.
 *
 * TIẾT CHẾ DATA: mỗi lượt tải sẵn ≈ 2,5–3 MB. Cửa chặn (còn mới / mất sóng /
 * đã chạy rồi) nằm ở lib/pretrip-auto.ts — xem lý do ở đó.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  runLayer,
  runPretrip,
  savedCoverage,
  type PretripPoint,
  type SavedCoverage,
  type SavedLayerId,
} from "@/lib/pretrip";
import {
  autoPretripLine,
  autoPretripTone,
  coverageChipOk,
  coverageChipText,
  layerRetryFailed,
  lastAutoPretripAt,
  markAutoPretripRun,
  shouldMarkPretripRun,
  shouldAttemptAutoPretrip,
  type PretripSavedPhase,
} from "@/lib/pretrip-auto";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { savedAgoLabel } from "@/lib/forecast-cache";
import {
  forecastStoreState,
  subscribeForecastStore,
} from "@/lib/forecast-store";
import { exportOfflineData } from "@/lib/offline-backup";
import {
  ensurePersistentStorage,
  isIOS,
  isStandalone,
} from "@/lib/storage-persist";
import { isShellReady } from "@/lib/shell-ready";
import { isOffline, subscribeOnline } from "@/lib/use-online";
import { NOTIFY_HIDE_LONG_MS, NOTIFY_HIDE_MS } from "@/lib/notify";
import { AlertIcon, CheckIcon, ChevronDownIcon, ChevronUpIcon, DownloadIcon } from "@/components/icons";
import { SQ_BTN } from "@/components/ui/sq-btn";

/** byte → "~1,2 MB" / "~340 KB" (rỗng nếu 0 — lớp nằm kho khác) */
function fmtBytes(b: number): string {
  if (b <= 0) return "";
  if (b >= 1024 * 1024)
    return `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(b / 1024))} KB`;
}

/* CÓ SÓNG KHÔNG — `isOffline` / `subscribeOnline` nay ở lib/use-online.ts (gom
   một chỗ 2026-08-18): không request, không khoá `forfish.*`, không hẹn giờ. */

/* Trạng thái tải sẵn dùng CHUNG cho dòng nổi tự tắt (PretripAutoNotify) và nhãn
   nhỏ thường trực trên box biển động (PretripSavedStatus). Store nhỏ ở mức
   module + useSyncExternalStore để hai chỗ luôn khớp mà không phải nâng state
   lên tận trang. */
let sharedPhase: PretripSavedPhase = "idle";
const phaseSubs = new Set<() => void>();
function setSharedPhase(p: PretripSavedPhase) {
  sharedPhase = p;
  phaseSubs.forEach((f) => f());
}
function subscribePhase(f: () => void) {
  phaseSubs.add(f);
  return () => {
    phaseSubs.delete(f);
  };
}

/* CHẠM NHÃN = MỞ POPUP "đã lưu những gì" (2026-07-29): thay vì bắn tải cả mẻ,
   chip mở bảng per-layer để bà con thấy lớp nào đã lưu / còn thiếu và chạm "Tải
   lại" đúng lớp cần. Bộ máy tự tải (PretripAutoNotify) vẫn chạy nền như cũ. */

/* Nhịp tự tắt: NOTIFY_HIDE_MS (1 dòng, 5s) nay ở lib/notify.ts — dùng chung
   với mọi dòng báo nổi trên bản đồ + banner bão. */

/**
 * Mốc lần THỬ tải gần nhất trong PHIÊN này (không phải lần tải xong — cái đó
 * nằm ở localStorage `PRETRIP_LAST_RUN_KEY`). Ở mức module nên vẽ lại, đóng/mở
 * sheet hay đi qua lại giữa các màn đều không bắn lại.
 *
 * 2026-07-29: TRƯỚC đây là cờ `startedThisLoad` một-lần-mỗi-phiên — mở app lúc
 * mất sóng là cả phiên không bao giờ tự kéo nữa (ra khơi bắt được sóng lại cũng
 * nằm im). Nay đổi thành MỐC THỜI GIAN để còn thử lại được, cửa chặn
 * PRETRIP_MIN_RETRY_MS lo phần không dội data.
 */
let lastAttemptAt: number | null = null;
/**
 * Lần thử gần nhất có BỊ CẮT giữa chừng không (hết trần 240 giây). Mẻ bị cắt cố
 * ý KHÔNG ghi mốc 6 giờ (còn 6–8 lớp chưa tải), nên nếu vẫn để cửa 2 phút thì
 * mỗi lần bà con liếc điện thoại lại một mẻ nữa — cờ này giãn cửa ra 30 phút
 * (PRETRIP_PARTIAL_RETRY_MS). Ở mức module như `lastAttemptAt`, cùng vòng đời.
 */
let lastAttemptPartial = false;
/** đang chạy dở → không bắn chồng */
let running = false;

type Note = { text: string; kind: "busy" | "ok" | "warn" };

export function PretripAutoNotify({ points }: { points: PretripPoint[] }) {
  const [note, setNote] = useState<Note | null>(null);
  // chỗ tải sẵn có thể đổi khi bà con ghim thêm điểm — lấy bản mới nhất lúc
  // chạy, nhưng KHÔNG để nó kích hoạt chạy lại
  const pointsRef = useRef(points);
  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  const tryRun = useCallback((force = false) => {
    if (running) return;
    const online = !isOffline();
    // Bản còn mới / mất sóng / vừa thử xong → IM LẶNG hoàn toàn, không báo gì.
    // `force` = bà con CHẠM nhãn xin tải → bỏ cửa chặn, chạy luôn (mất sóng
    // thì runPretrip fail và báo thật "chưa có sóng" — vẫn là trả lời).
    if (
      !force &&
      !shouldAttemptAutoPretrip({
        lastRunAt: lastAutoPretripAt(),
        lastAttemptAt,
        lastAttemptPartial,
        nowMs: Date.now(),
        online,
      })
    ) {
      return;
    }

    running = true;
    lastAttemptAt = Date.now();
    setNote({ text: "Đang tải dự báo…", kind: "busy" });
    setSharedPhase("loading");
    runPretrip(pointsRef.current)
      .then((r) => {
        // CHỈ ghi mốc khi mẻ này thật sự giữ được gì (hoặc máy hết chỗ — thử
        // lại cũng vô ích). Ghi vô điều kiện là khoá 6 giờ ngay cả khi hỏng
        // sạch — xem shouldMarkPretripRun.
        if (shouldMarkPretripRun(r)) markAutoPretripRun();
        /*  XIN BỘ NHỚ BỀN NGAY SAU KHI GHI ĐƯỢC (2026-08-03) — chỗ đáng giá
            nhất mà trước đây bỏ trống. Cả Safari lẫn Chromium tự gật/tự từ chối
            theo LỊCH SỬ TƯƠNG TÁC với trang, nên thời điểm bà con vừa để app
            tải trọn gói đi biển (~3 MB) là lúc dễ được gật nhất — hơn hẳn lần
            hỏi lúc app vừa cài xong, còn trắng trơn.
            Đặt ở nhánh `then` (mẻ chạy xong) chứ không phải `finally`: mẻ ném
            sạch nghĩa là chẳng ghi được gì, xin lúc đó chỉ tốn một cửa/ngày.
            KHÔNG phải request mạng, không ai chờ nó — xem lib/storage-persist. */
        void ensurePersistentStorage();
        // Mẻ bị cắt giữa chừng → giãn cửa THỬ LẠI ra 30 phút (không ghi mốc 6
        // giờ nhưng cũng không được bắn lại sau 2 phút).
        lastAttemptPartial = r.timedOut;
        // MÀU khớp CHỮ, dựng cùng một chỗ (autoPretripTone) để không bao giờ
        // lệch: xanh mà chữ nói "còn thiếu vài lớp" là nói dối bằng màu.
        setNote({ text: autoPretripLine(r), kind: autoPretripTone(r) });
      })
      .catch(() => {
        lastAttemptPartial = false;
        setNote({ text: "Chưa tải được dự báo — máy đang không có mạng.", kind: "warn" });
      })
      .finally(() => {
        running = false;
        setSharedPhase("idle");
      });
  }, []);

  // Chạy lúc mở màn + TỰ CHẠY LẠI khi máy CÓ SÓNG LẠI hoặc bà con quay lại app
  // (user 2026-07-29: "khi máy online thì tự kéo các nguồn để làm mới"). Điện
  // thoại hay ngủ tab nên nghe cả `visibilitychange`, không chỉ `online`.
  useEffect(() => {
    tryRun();
    const onOnline = () => tryRun();
    const onVisible = () => {
      if (document.visibilityState === "visible") tryRun();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [tryRun]);

  // tự tắt sau khi đã nói xong (lúc đang tải thì cứ để đó)
  useEffect(() => {
    if (!note || note.kind === "busy") return;
    // cảnh báo (vàng) = luật 8 giây của lib/notify (rà bố cục 2026-10-22 — trước 3 giây
    // cho cả câu cảnh báo hai dòng, chưa đọc xong đã tắt)
    const t = setTimeout(() => setNote(null), note.kind === "warn" ? NOTIFY_HIDE_LONG_MS : NOTIFY_HIDE_MS);
    return () => clearTimeout(t);
  }, [note]);

  if (!note) return null;

  const skin =
    note.kind === "ok"
      ? "bg-ok-bg text-ok"
      : note.kind === "warn"
        ? "bg-warn-bg text-warn"
        : "bg-card/95 text-navy";

  return (
    <p
      role="status"
      className={`pointer-events-none mx-auto flex w-fit max-w-[92%] items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.875rem] font-semibold leading-snug shadow-md ${skin}`}
    >
      {note.kind === "ok" && <CheckIcon className="h-4 w-4 shrink-0" />}
      {note.kind === "warn" && <AlertIcon className="h-4 w-4 shrink-0" />}
      {note.text}
    </p>
  );
}

/**
 * Nhãn NHỎ THƯỜNG TRỰC sát trên box biển động — bà con liếc là biết trong máy đã
 * lưu ĐỦ dự báo cho offline chưa, khác dòng nổi tự tắt ở trên. Câu chữ THEO ĐỘ
 * PHỦ TỪNG LỚP (coverageChipText) nên "đã lưu tới ngày X" chỉ nói khi MỌI lớp đã
 * có. Chạm → mở popup liệt kê từng lớp + nút "Tải lại" cho lớp còn thiếu.
 */
export function PretripSavedStatus({
  points,
  fishLocked,
  iconOnly = false,
  hideWhenOk = false,
}: {
  points: PretripPoint[];
  /** bản đồ cá đang khoá (chưa đăng nhập / chưa premium) → không tính là thiếu */
  fishLocked: boolean;
  /** chỉ icon tròn (chữ ở aria-label/title) — dùng nổi trên bản đồ */
  iconOnly?: boolean;
  /** đủ dữ liệu thì KHÔNG vẽ nút (bản đồ chỉ nổi chip khi có việc cần biết) */
  hideWhenOk?: boolean;
}) {
  const phase = useSyncExternalStore(
    subscribePhase,
    () => sharedPhase,
    () => "idle" as PretripSavedPhase,
  );
  const [cov, setCov] = useState<SavedCoverage | null>(null);
  const [open, setOpen] = useState(false);
  /* VỎ APP đã cài đủ chưa — MỘT NGUỒN SỰ THẬT cho chữ "sẵn sàng" (2026-08-01).
     Trước đây chip chỉ đếm localStorage (dữ liệu), còn vỏ app đủ hay thiếu thì
     không ai đọc ⇒ chip báo xanh trên vỏ rỗng. Dữ liệu đủ mà vỏ thiếu vẫn là
     không mở được app giữa biển. null = chưa đọc xong. */
  const [shellOk, setShellOk] = useState<boolean | null>(null);

  const reread = useCallback(() => {
    setCov(savedCoverage({ fishLocked }));
    void isShellReady().then(setShellOk);
  }, [fishLocked]);
  // đọc lại khi vào màn + mỗi lần phase đổi (tự tải xong → cập nhật)
  useEffect(() => {
    reread();
    const boPhase = subscribePhase(reread);
    /*  ĐỌC LẠI KHI KHO DỰ BÁO MỞ XONG (2026-08-02k — vá lỗi CHẶN).
        `subscribePhase` chỉ nổ khi mẻ tải sẵn đổi trạng thái, mà ngoài biển mất
        sóng thì mẻ KHÔNG BAO GIỜ chạy ⇒ không có lượt đọc lại nào. Kho nay nạp
        bất đồng bộ, nên thiếu vế này là chip/thẻ đóng băng ở lượt đọc đầu tiên
        suốt cả chuyến. */
    /*  Cùng lý do với popup: `reread()` vừa chạy ngay trên, nên chỉ đăng ký khi
        kho CHƯA mở xong — tránh quét kho hai lượt lúc vào màn. */
    /*  Gác bằng TRẠNG THÁI THẬT, không bằng "đã nạp xong" (vòng soát 6): nạp
        xong mà KHÔNG MỞ ĐƯỢC kho thì còn lượt nạp lại phía sau — bỏ đăng ký ở
        đây là chip đứng "Đang mở kho dữ liệu…" suốt chuyến dù kho đã mở được. */
    const boKho =
      forecastStoreState() === "san-sang"
        ? () => undefined
        : subscribeForecastStore(reread);
    return () => {
      boPhase();
      boKho();
    };
  }, [reread]);

  /* CÓ SÓNG KHÔNG — R1 (2026-08-02). Chip trước đây không biết chuyện sóng nên
     giữa biển nó đứng vàng suốt chuyến với lời mời "chạm tải mới", việc KHÔNG
     LÀM ĐƯỢC ngoài khơi, mà lại nuốt mất dòng "tới ngày 18/8" — đúng thông tin
     duy nhất còn giá trị lúc đó. Trạng thái lấy từ sự kiện online/offline có
     sẵn: không request, không khoá mới, không hẹn giờ. */
  const online = useSyncExternalStore(
    subscribeOnline,
    () => !isOffline(),
    () => true,
  );

  // Vỏ chưa đủ thì KHÔNG được nói "đã lưu đủ" dù dữ liệu đầy.
  const shellMissing = shellOk === false;
  const text = shellMissing
    ? "App cần mạng để tải nốt dữ liệu. Bà con mở lại khi có sóng nhé."
    : coverageChipText(phase, cov, undefined, online, forecastStoreState());
  // MÀU phải khớp CHỮ: đủ lớp + còn hạn + chưa quá chu kỳ (coverageChipOk),
  // chứ không chỉ "có bản trong máy" — chip xanh trên bản 10 ngày tuổi là lời
  // hứa dối ở đúng chỗ bà con liếc trước khi nhổ neo.
  const allSaved = coverageChipOk(cov, undefined, online) && shellOk === true;
  const tone =
    phase === "loading" ? "text-navy" : allSaved ? "text-ok" : "text-warn";

  /* THẺ NHẮC TO khi BẢN ĐÃ CÀI mà trong máy chưa có gì (2026-08-01).
     Ca thật hay gặp nhất trên iPhone: bà con tải đủ dữ liệu trong Safari rồi
     mới "Thêm vào Màn hình chính" — kho của bản cài TÁCH RIÊNG nên nó bắt đầu
     từ TRỐNG KHÔNG. Chip nhỏ ở góc dễ lướt qua; nhổ neo xong mới biết thì
     không quay lại bờ được nữa. */
  /*  ⚠️ CHỈ KẾT LUẬN "CHƯA CÓ GÌ" KHI KHO ĐÃ MỞ XONG VÀ ĐỌC ĐƯỢC (2026-08-02k).
      Kho dự báo nay nạp bất đồng bộ và có thể KHÔNG MỞ ĐƯỢC (IndexedDB chậm quá
      trần chờ / hỏng). Hai trạng thái đó KHÔNG phải "trống": bung thẻ nhắc TO
      giữa biển trong khi máy đang giữ đủ 16 ngày thì bà con quay tàu về bờ. */
  const emptyOnInstalled =
    isStandalone() &&
    phase !== "loading" &&
    forecastStoreState() === "san-sang" &&
    !!cov &&
    cov.savedCount === 0;
  if (emptyOnInstalled) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="pointer-events-auto w-full rounded-2xl bg-warn-bg px-4 py-3 text-left shadow-md ring-1 ring-warn/30 transition active:scale-[0.99]"
        >
          <p className="text-[0.875rem] font-semibold leading-snug text-warn">
            Máy chưa có dữ liệu đi biển
          </p>
          <p className="mt-0.5 text-[0.875rem] leading-snug text-warn/90">
            App vừa cài bắt đầu từ trống. Chạm để tải ngay khi còn sóng — ra
            khơi mất sóng là không tải được nữa.
          </p>
        </button>
        {open && (
          <PretripSavedSheet
            points={points}
            fishLocked={fishLocked}
            onChanged={reread}
            onClose={() => setOpen(false)}
          />
        )}
      </>
    );
  }

  /*  CHIP GỌN 2 CHỮ trên bản đồ (anh Long 2026-10-20: "vẫn tốn chỗ, chưa thông
      minh"): câu đầy đủ ("App cần mạng để tải nốt dữ liệu. Bà con mở lại khi có
      sóng nhé." / "Còn dùng tới ngày 31/10 — chạm tải mới"…) chiếm cả một dải
      ngang trên đáy bản đồ. Nay chip chỉ nói TRẠNG THÁI bằng icon + 2 chữ, màu
      giữ đúng luật cũ (xanh chỉ khi coverageChipOk + vỏ đủ); câu đầy đủ nằm ở
      aria-label/title và trong sheet khi chạm. */
  const short =
    phase === "loading"
      ? "Đang tải"
      : shellMissing
        ? "Cần sóng"
        : allSaved
          ? "Đã lưu"
          : "Chưa đủ";
  /*  Bản đồ chỉ nổi chip khi CÓ VIỆC cần biết (2026-10-20, "thông tin trùng lặp,
      thiết kế vẫn to"): đủ dữ liệu ⇒ không vẽ gì trên bản đồ — chip đủ chữ nằm
      trong đầu ngăn gió sóng. */
  if (hideWhenOk && allSaved && phase !== "loading") return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        // câu `text` đã có dấu chấm cuối — bỏ trước khi ghép, kẻo trình đọc đọc ".." (BD-14)
        aria-label={`Dữ liệu đi biển: ${text.replace(/[.\s]+$/, "")}. Chạm để xem.`}
        title={text}
        className={`pointer-events-auto inline-flex h-(--h-ctl) items-center gap-1.5 rounded-full border border-line bg-card/95 text-[0.8125rem] font-semibold shadow-sm transition active:scale-95 ${
          iconOnly ? "w-(--h-ctl) justify-center" : "px-3"
        } ${tone}`}
      >
        {phase === "loading" ? (
          <span
            className="h-2 w-2 animate-pulse rounded-full bg-navy"
            aria-hidden
          />
        ) : allSaved ? (
          <CheckIcon className="h-4 w-4 shrink-0" aria-hidden />
        ) : (
          /* mũi tên tải xuống, KHÔNG ⚠ (BD-08): nghĩa thật là "chưa tải xong gói" — ⚠ để cho bão · ranh giới · định vị */
          <DownloadIcon className="h-4 w-4 shrink-0" aria-hidden />
        )}
        {/* máy hẹp (<380px): chỉ icon — hàng đáy bản đồ còn bước ngày + nút ⌃;
            chữ đầy đủ vẫn ở aria-label/title, chạm mở sheet */}
        <span className={iconOnly ? "sr-only" : "max-[379px]:sr-only"}>{short}</span>
      </button>
      {open && (
        <PretripSavedSheet
          points={points}
          fishLocked={fishLocked}
          onChanged={reread}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

const LAYER_HELP: Record<SavedLayerId, string> = {
  grid: "Gió & sóng CẢ Biển Đông — xem ở BẤT KỲ đâu (kể cả tầng mặt)",
  point: "Ghim điểm nào là có dự báo chi tiết 16 ngày điểm đó",
  fish: "Bản đồ điểm cá (dự báo ngắn ngày, cần tài khoản Premium)",
  scalar: "Mây, mưa, nhiệt không khí, nguy cơ dông, áp suất",
  salinity: "Độ mặn nước biển",
  seascalar: "Nước dâng / xoáy nước (gom mồi)",
  curdepth: "Dòng chảy 3 tầng SÂU — tầng mặt đã có ở lưới cả vùng",
  storm: "Bản tin bão Biển Đông hỏi được gần nhất — mất sóng vẫn xem lại được",
  price: "Bảng giá cá tuần + kỳ giá dầu lúc rời bờ",
};

/**
 * Popup "đã lưu những gì" — liệt kê TỪNG lớp: đã lưu (xanh ✓ + chi tiết/tuổi)
 * hay chưa (vàng ⚠ + nút "Tải lại"). Chạm "Tải lại" tải đúng lớp đó (runLayer),
 * xong đọc lại. "Tải lại N lớp còn thiếu" chạy tuần tự các lớp thiếu.
 */
function PretripSavedSheet({
  points,
  fishLocked,
  onChanged,
  onClose,
}: {
  points: PretripPoint[];
  fishLocked: boolean;
  onChanged: () => void;
  onClose: () => void;
}) {
  /*  ⚠️ QUÉT KHO CHỈ ĐƯỢC CHẠY MỘT LẦN, TRONG `useState` LAZY (sửa 2026-08-02h).

      LỖI ĐÃ SỬA: bản cũ gọi `savedCoverage({ fishLocked })` THẲNG TRONG THÂN
      RENDER rồi mới đưa kết quả vào `useState(() => initial…)`. Dạng lazy chỉ
      hoãn việc DÙNG — lời gọi vẫn chạy MỌI LẦN RENDER.

      Giá một lượt (đọc được từ mã, và `usage-heartbeat.tsx` cũng ghi đúng con
      số này): 11 lượt `loadAll` + 9 lượt `bytesUnder`, mà `entriesUnder` lại
      `JSON.parse` CẢ payload chỉ để đọc `savedAt` ⇒ riêng lưới `grid.d16`
      (~1,6 MB) bị parse 4 lượt; `bytesUnder("")` dựng lại toàn bộ chuỗi ~5 MB.
      Sheet này có 10 ô state, và một cú bấm "Tải lại N lớp còn thiếu" đi qua
      `setBusy` → `setBusy(null)` → `setFailed` → `refresh()` ⇒ **≥6 lượt quét
      kho liên tiếp**, mỗi lượt vài trăm ms tới hơn 1 giây trên Android rẻ.

      Đây là màn CHUẨN BỊ ĐI BIỂN — màn quyết định có nhổ neo được không. Bà con
      thấy popup "chết" nên bấm lại, mỗi lần bấm lại thêm một vòng quét.

      `useState` với hàm khởi tạo chỉ chạy ở lần render ĐẦU; `refresh()` là
      đường cập nhật sau đó. */
  const [initial] = useState(() => savedCoverage({ fishLocked }));
  const [layers, setLayers] = useState(initial.layers);
  const [total, setTotal] = useState(initial.totalBytes);
  /*  KHO CHƯA MỞ XONG THÌ POPUP CŨNG PHẢI IM (2026-08-02k — vòng đánh giá cuối).
      Chip ngoài đã có cổng trạng thái, nhưng popup mở ra ngay sau cú chạm thì
      chưa: nó liệt kê thẳng 12 dòng "chưa lưu" trong khi chip cạnh đó nói "Đang
      mở kho dữ liệu…". Cùng một màn hình mà hai chỗ nói hai kiểu thì bà con tin
      cái đáng sợ hơn, rồi quay tàu về bờ — đúng câu cảnh báo đã ghi ở
      `coverageChipText`. Bản vá trước mới dời khuôn lỗi xuống sâu một tầng. */
  const [khoState, setKhoState] = useState(forecastStoreState);
  const [busy, setBusy] = useState<SavedLayerId | "all" | null>(null);
  // lớp vừa TẢI LẠI mà vẫn không có dữ liệu → nói thật (mất sóng / nguồn bận),
  // đừng để nút bấm xong im ru như hỏng
  const [failed, setFailed] = useState<Set<SavedLayerId>>(new Set());
  const [exporting, setExporting] = useState(false);
  // băng iPhone gập/bung (BD-13) — mặc định gập
  const [iosMo, setIosMo] = useState(false);

  const refresh = useCallback(() => {
    const c = savedCoverage({ fishLocked });
    setLayers(c.layers);
    setTotal(c.totalBytes);
    setKhoState(forecastStoreState());
    onChanged();
  }, [fishLocked, onChanged]);

  /*  ĐỌC LẠI KHI KHO MỞ XONG — popup mở đúng lúc kho còn đang nạp thì nó phải
      TỰ cập nhật, chứ không bắt bà con đóng ra mở lại.

      ⚠️ CHỈ ĐĂNG KÝ KHI KHO CHƯA MỞ XONG. `subscribeForecastStore` bắn NGAY một
      nhịp nếu kho đã sẵn sàng — mà `initial` ở trên vừa quét kho xong rồi, nên
      đăng ký vô điều kiện là quét HAI LƯỢT mỗi lần mở popup. Chính file này đã
      ghi: một cú chạm từng tốn "≥6 lượt quét kho liên tiếp", vài trăm ms tới
      hơn một giây trên máy Android rẻ, đúng lúc bà con sốt ruột trước chuyến. */
  useEffect(() => {
    if (forecastStoreState() === "san-sang") return;
    return subscribeForecastStore(refresh);
  }, [refresh]);

  /*  SAO LƯU RA TỆP — HAI NÚT, KHÔNG PHẢI MỘT (2026-08-02, audit vòng 2 T5).
      Bản cũ chỉ có một nút "Lưu ra tệp" mà tệp lại gom SẠCH mọi khoá
      `forfish.*`: tin nhắn riêng, CCCD 12 số của từng bạn thuyền, tủ giấy tờ,
      điểm ghim luồng cá, mã máy, nhịp. Câu chữ thì nói "giữ bản dự phòng dự
      báo" ⇒ bà con AirDrop/Zalo tệp cho nhau như chia bản tin thời tiết.
      Nay tách rõ: nút mặc định chỉ mang DỰ BÁO (chia cho ai cũng vô hại), còn
      chuyển đồ riêng của tàu phải đi qua nút thứ hai + cảnh báo đỏ. */
  const download = useCallback((json: string, name: string) => {
    try {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* trình duyệt chặn tải — bỏ qua, không làm app chết */
    }
  }, []);

  /*  Chỉ còn sao lưu DỰ BÁO (chia cho ai cũng vô hại). Phục hồi + chuyển máy
      đã gỡ khỏi giao diện 2026-10-20 (anh Long). */
  const doExport = useCallback(async () => {
    setExporting(true);
    try {
      const json = await exportOfflineData("forecast");
      download(json, "sdfish-du-bao-da-luu.json");
    } catch {
      /* gói hỏng — bỏ qua, không làm app chết */
    }
    setExporting(false);
  }, [download]);

  const retry = useCallback(
    async (id: SavedLayerId) => {
      if (busy) return;
      const before = layers.find((l) => l.id === id);
      setBusy(id);
      let threw = false;
      try {
        await runLayer(id, points);
      } catch {
        threw = true;
      }
      setBusy(null);
      // vẫn chưa đạt sau khi thử → đánh dấu lỗi để nói thật với bà con
      const after = savedCoverage({ fishLocked }).layers.find((l) => l.id === id);
      setFailed((prev) => {
        const n = new Set(prev);
        if (threw || layerRetryFailed(before, after)) n.add(id);
        else n.delete(id);
        return n;
      });
      refresh();
    },
    [busy, layers, points, refresh, fishLocked],
  );

  /**
   * Chạy tuần tự MỘT NHÓM lớp (thiếu hoặc đã cũ) — dùng chung cho hai nút đáy.
   * Chạy xong soi lại từng lớp: lớp nào chưa đạt thì đánh dấu để dòng của nó nói
   * thật, thay vì cả nhóm im lặng như đã xong.
   */
  const runMany = useCallback(
    async (ids: SavedLayerId[]) => {
      if (busy || ids.length === 0) return;
      const before = new Map(layers.map((l) => [l.id, l]));
      setBusy("all");
      /*  ⚠️ GIỮ TÍN HIỆU NÉM CỦA TỪNG LỚP (vòng soát 7 — khuôn NGƯỢC: "ghi hỏng
          mà màn hình báo xong"). Bản trước `catch {}` rồi VỨT LUÔN `threw`, chỉ
          soi `savedCoverage`. Mà `savedCoverage` đọc qua `fcGet` → GƯƠNG RAM:
          bản vừa ghi vào gương là `saved:true`, `savedAt = now` ⇒ `fresh:true`.
          Kết quả: đĩa từ chối, `runLayer` ném đủ 6 lớp, mà 6 dòng đều XANH ✓
          "còn mới" và chip có thể xanh "Đã lưu đủ dự báo" — tàu nhổ neo, đóng
          app một cái là trắng. Đúng "dấu xanh trên kho rỗng" mà cả mạch này đi
          vá, và đây là NÚT TO bà con bấm nhiều nhất.
          `retry()` một lớp vốn đã làm đúng (`threw || layerRetryFailed`); nút
          gom phải theo cùng luật. */
      const daNem = new Set<SavedLayerId>();
      for (const id of ids) {
        try {
          await runLayer(id, points);
        } catch {
          daNem.add(id); // bỏ qua lớp hỏng, chạy tiếp lớp khác — nhưng NHỚ nó
        }
      }
      setBusy(null);
      const after = savedCoverage({ fishLocked }).layers;
      setFailed((prev) => {
        const n = new Set(prev);
        for (const id of ids) {
          if (
            daNem.has(id) ||
            layerRetryFailed(before.get(id), after.find((l) => l.id === id))
          )
            n.add(id);
          else n.delete(id);
        }
        return n;
      });
      refresh();
    },
    [busy, layers, points, refresh, fishLocked],
  );

  const missingIds = layers
    .filter((l) => l.retriable && !l.saved)
    .map((l) => l.id);
  const missing = missingIds.length;
  /* LỚP ĐÃ CÓ NHƯNG ĐÃ CŨ — phải có nút gom ở đáy (2026-08-02). Chip ngoài bản
     đồ mời "chạm tải mới", chạm vào thì mở đúng popup này; đủ lớp nên nút "Tải
     lại N lớp còn thiếu" không hiện, bà con phải tự dò từng dòng tìm nút nhỏ —
     lời mời ngoài kia hoá ra không có chỗ bấm. */
  const staleIds = layers
    .filter((l) => l.retriable && l.saved && !l.fresh)
    .map((l) => l.id);

  return (
    <BottomSheet title="Dữ liệu đã lưu để đi biển" onClose={onClose}>
      {/* CHẶN Ở CỬA VÀO thay vì chữa hậu quả (2026-08-01c): iPhone chạy trong
          TAB Safari bị iOS xoá sạch dữ liệu website sau ~7 ngày không mở —
          xoá cả kho lẫn service worker, nên tải sẵn bao nhiêu cũng thành công
          cốc, mà không API nào chống được. Bản THÊM VÀO MÀN HÌNH CHÍNH được
          miễn luật đó. Nói trước một câu ở đúng chỗ bà con sắp bấm Tải, còn
          hơn để họ tin nhầm rồi ra khơi mới biết. */}
      {/*  BD-13 (2026-10-25): băng iPhone 4 dòng + câu dẫn đứng TRƯỚC danh sách đẩy
           mục đầu xuống ~400 px. Nay danh sách lên đầu; băng iPhone gập một hàng
           ở dưới danh sách (chạm mới bung — khuôn InstallBanner); bỏ câu dẫn. */}
      {/*  KHO CHƯA MỞ XONG ⇒ NÓI THẬT, ĐỪNG LIỆT KÊ "CHƯA LƯU" (2026-08-02k).
           Danh sách bên dưới đọc kho ĐỒNG BỘ; kho nạp chưa xong thì mọi dòng ra
           "chưa lưu" — 12 dòng đỏ trên một máy đang giữ đủ 16 ngày. Giữa biển đó
           là lý do bà con quay tàu về bờ. */}
      {khoState !== "san-sang" && (
        <p className="mb-3 rounded-xl bg-warn-bg px-3 py-2 text-[0.9375rem] font-semibold leading-snug text-warn">
          {khoState === "dang-mo"
            ? "Đang mở kho dữ liệu trong máy…"
            : "Máy chưa mở được dữ liệu đã lưu. Bà con thử đóng app rồi mở lại xem sao nhé."}
        </p>
      )}
      {/*  DANH SÁCH KẺ MẢNH (rà design Codex lần 2, 2026-10-19 — anh Long gửi ảnh
           sheet này): trước mỗi lớp là một hộp nền xám + vòng tròn tick to, câu
           lỗi vàng đậm 3 dòng. Nay một .surface divide-y, icon trạng thái nhỏ có
           màu (không nền tròn), câu lỗi một dòng chữ thường màu cảnh báo. */}
      <ul className="surface divide-y divide-line overflow-hidden">
        {layers.map((l) => {
          const rowBusy = busy === l.id || busy === "all";
          return (
            <li
              key={l.id}
              className="flex min-h-(--h-row) items-center gap-3 px-3.5 py-2.5"
            >
              <span className={`shrink-0 ${l.saved ? "text-ok" : "text-warn"}`} aria-hidden>
                {l.saved ? (
                  <CheckIcon className="h-4 w-4" />
                ) : (
                  <DownloadIcon className="h-4 w-4" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.9375rem] font-semibold leading-snug text-navy">
                  {l.label}
                </span>
                {failed.has(l.id) ? (
                  <span className="block text-[0.8125rem] leading-snug text-warn">
                    {l.saved
                      ? // lớp vốn đã có: nói đúng cái vừa hụt — bản MỚI
                        "Chưa có bản mới — hệ thống chưa cập nhật hoặc đang mất sóng."
                      : "Chưa tải được — kiểm tra mạng rồi thử lại."}
                  </span>
                ) : (
                  <span className="block text-[0.8125rem] leading-snug text-foreground/65">
                    {l.saved ? l.detail : LAYER_HELP[l.id]}
                    {l.saved && l.savedAt != null && ` · ${savedAgoLabel(l.savedAt)}`}
                    {l.saved && l.sizeBytes > 0 && ` · ${fmtBytes(l.sizeBytes)}`}
                  </span>
                )}
              </span>
              {!l.retriable ? (
                <span className="shrink-0 text-[0.75rem] font-semibold text-foreground/55">
                  khoá
                </span>
              ) : rowBusy ? (
                <span className="shrink-0 text-[0.8125rem] font-semibold text-foreground/55">
                  Đang tải…
                </span>
              ) : l.saved && l.fresh ? (
                // còn trong chu kỳ cập nhật → KHÔNG cần tải lại (user: >chu kỳ mới cần)
                <span className="shrink-0 text-[0.75rem] font-semibold text-ok">
                  ✓ còn mới
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => retry(l.id)}
                  disabled={!!busy}
                  className={`flex h-(--h-ctl) shrink-0 items-center rounded-full px-3.5 text-[0.875rem] font-semibold transition active:scale-95 disabled:opacity-50 ${
                    l.saved ? "text-sea" : "bg-navy text-white"
                  }`}
                >
                  {l.saved ? "Tải mới" : "Tải lại"}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {missing > 0 ? (
        <button
          type="button"
          onClick={() => runMany(missingIds)}
          disabled={!!busy}
          className="mt-4 h-(--h-cta) w-full rounded-xl bg-navy text-[1rem] font-semibold text-white transition active:scale-[0.99] disabled:opacity-60"
        >
          {busy === "all"
            ? "Đang tải"
            : "Tải thiếu"}
        </button>
      ) : staleIds.length > 0 ? (
        <button
          type="button"
          onClick={() => runMany(staleIds)}
          disabled={!!busy}
          className="mt-4 h-(--h-cta) w-full rounded-xl bg-navy text-[1rem] font-semibold text-white transition active:scale-[0.99] disabled:opacity-60"
        >
          {busy === "all"
            ? "Đang tải"
            : "Tải mới"}
        </button>
      ) : null}
      {total > 0 && (
        <p className="mt-2 px-1 text-[0.8125rem] text-foreground/65">
          Tổng trong máy: ~{fmtBytes(total)} · cần sóng để tải; mất sóng chỉ
          xem được thứ đã tải.
        </p>
      )}

      {/* CHẶN Ở CỬA VÀO thay vì chữa hậu quả (2026-08-01c): iPhone chạy trong
          TAB Safari bị iOS xoá sạch dữ liệu website sau ~7 ngày không mở —
          xoá cả kho lẫn service worker, nên tải sẵn bao nhiêu cũng thành công
          cốc, mà không API nào chống được. Bản THÊM VÀO MÀN HÌNH CHÍNH được
          miễn luật đó. Gập một hàng, chạm mới đọc đủ (BD-13). */}
      {isIOS() && !isStandalone() && (
        <div className="mt-3 rounded-xl bg-warn-bg text-warn">
          <button
            type="button"
            onClick={() => setIosMo((v) => !v)}
            aria-expanded={iosMo}
            className="flex min-h-(--h-row) w-full items-center gap-2 px-3.5 text-left text-[0.9375rem] font-semibold"
          >
            <AlertIcon className="h-4 w-4 shrink-0" aria-hidden />
            <span className="flex-1">iPhone: nên cài ra màn hình chính</span>
            {iosMo ? (
              <ChevronUpIcon className="h-5 w-5 shrink-0" aria-hidden />
            ) : (
              <ChevronDownIcon className="h-5 w-5 shrink-0" aria-hidden />
            )}
          </button>
          {iosMo && (
            <p className="px-3.5 pb-3 text-[0.875rem] leading-snug">
              Hãy <b>Thêm vào Màn hình chính</b> rồi tải trong app vừa thêm. Chạy trong
              Safari thì máy có thể tự xoá sạch dữ liệu đã tải sau khoảng 7 ngày không mở.
            </p>
          )}
        </div>
      )}

      {/* SAO LƯU dự báo ra tệp — CHỈ PREMIUM (user chốt: chỉ premium xem được
          dự báo >3 ngày nên chỉ premium mới thấy nút xuất tệp).
          BỎ "Phục hồi" + "Chuyển máy" khỏi sheet (anh Long 2026-10-20: "bỏ phần
          phục hồi và chuyển máy đi"). Hàm thuần lib/offline-backup (import/
          transfer) GIỮ — chỉ gỡ lối vào giao diện. */}
      {!fishLocked && (
        <div className="mt-5 flex items-center gap-2">
          <span className="min-w-0 flex-1">
            <span className="block text-[1rem] font-semibold text-navy">Tệp dự báo</span>
            <span className="block text-[0.8125rem] leading-snug text-foreground/65">
              Chỉ gồm dự báo đã tải — gửi ai cũng được.
            </span>
          </span>
          <button
            type="button"
            onClick={() => void doExport()}
            disabled={exporting || total <= 0}
            className={`${SQ_BTN} bg-field text-navy disabled:opacity-50`}
          >
            {exporting ? "Đang lưu" : "Sao lưu"}
          </button>
        </div>
      )}

      {/* nút "Đóng" ở đáy ĐÃ BỎ (rà bố cục 2026-10-22): BottomSheet ngăn xem nay có × góc
          trên-phải — 03 §Nút X mục 2: không để cả × lẫn nút đóng. */}
    </BottomSheet>
  );
}
