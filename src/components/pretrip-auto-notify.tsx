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
  coverageChipText,
  lastAutoPretripAt,
  markAutoPretripRun,
  shouldAttemptAutoPretrip,
  type PretripSavedPhase,
} from "@/lib/pretrip-auto";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { savedAgoLabel } from "@/lib/forecast-cache";
import { exportOfflineData, importOfflineData } from "@/lib/offline-backup";
import { AlertIcon, CheckIcon } from "@/components/icons";

/** byte → "~1,2 MB" / "~340 KB" (rỗng nếu 0 — lớp nằm kho khác) */
function fmtBytes(b: number): string {
  if (b <= 0) return "";
  if (b >= 1024 * 1024)
    return `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(b / 1024))} KB`;
}

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

/**
 * Nói xong thì tắt sau ngần này — đủ đọc một dòng, rồi trả lại bản đồ.
 * Xuất ra để MỌI dòng báo nổi trên bản đồ tắt cùng một nhịp (vd nhắc "mất
 * sóng — đang dùng bản đồ lưu trong máy" ở fishing-map-view).
 */
export const NOTIFY_HIDE_MS = 5000;

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
    const online =
      typeof navigator === "undefined" ? true : navigator.onLine !== false;
    // Bản còn mới / mất sóng / vừa thử xong → IM LẶNG hoàn toàn, không báo gì.
    // `force` = bà con CHẠM nhãn xin tải → bỏ cửa chặn, chạy luôn (mất sóng
    // thì runPretrip fail và báo thật "chưa có sóng" — vẫn là trả lời).
    if (
      !force &&
      !shouldAttemptAutoPretrip({
        lastRunAt: lastAutoPretripAt(),
        lastAttemptAt,
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
        markAutoPretripRun();
        const ok = !r.full && r.ok > 0 && r.saved.places > 0 && !!r.saved.untilIso;
        setNote({ text: autoPretripLine(r), kind: ok ? "ok" : "warn" });
      })
      .catch(() => {
        setNote({ text: "Chưa tải được dự báo — chưa có sóng.", kind: "warn" });
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
    const t = setTimeout(() => setNote(null), NOTIFY_HIDE_MS);
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
      className={`pointer-events-none mx-auto flex w-fit max-w-[92%] items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.875rem] font-bold leading-snug shadow-md ${skin}`}
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
}: {
  points: PretripPoint[];
  /** bản đồ cá đang khoá (chưa đăng nhập / chưa premium) → không tính là thiếu */
  fishLocked: boolean;
}) {
  const phase = useSyncExternalStore(
    subscribePhase,
    () => sharedPhase,
    () => "idle" as PretripSavedPhase,
  );
  const [cov, setCov] = useState<SavedCoverage | null>(null);
  const [open, setOpen] = useState(false);

  const reread = useCallback(
    () => setCov(savedCoverage({ fishLocked })),
    [fishLocked],
  );
  // đọc lại khi vào màn + mỗi lần phase đổi (tự tải xong → cập nhật)
  useEffect(() => {
    reread();
    return subscribePhase(reread);
  }, [reread]);

  const text = coverageChipText(phase, cov);
  const allSaved = !!cov?.allSaved;
  const tone =
    phase === "loading" ? "text-navy" : allSaved ? "text-ok" : "text-warn";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Xem dữ liệu đã lưu để đi biển"
        className={`pointer-events-auto inline-flex min-h-[2.75rem] items-center gap-1.5 rounded-full bg-card/95 px-3 py-1 text-[0.8125rem] font-bold shadow-sm ring-1 ring-line transition active:scale-95 ${tone}`}
      >
        {phase === "loading" && (
          <span
            className="h-2 w-2 animate-pulse rounded-full bg-navy"
            aria-hidden
          />
        )}
        {text}
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
  fish: "Bản đồ điểm cá (dự báo ngắn ngày, cần premium)",
  scalar: "Mây, mưa, nhiệt không khí, nguy cơ dông, áp suất",
  salinity: "Độ mặn nước biển",
  seascalar: "Nước dâng / xoáy nước (gom mồi)",
  curdepth: "Dòng chảy 3 tầng SÂU — tầng mặt đã có ở lưới cả vùng",
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
  const initial = savedCoverage({ fishLocked });
  const [layers, setLayers] = useState(() => initial.layers);
  const [total, setTotal] = useState(() => initial.totalBytes);
  const [busy, setBusy] = useState<SavedLayerId | "all" | null>(null);
  // lớp vừa TẢI LẠI mà vẫn không có dữ liệu → nói thật (mất sóng / nguồn bận),
  // đừng để nút bấm xong im ru như hỏng
  const [failed, setFailed] = useState<Set<SavedLayerId>>(new Set());
  const [backupBusy, setBackupBusy] = useState<"export" | "import" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    const c = savedCoverage({ fishLocked });
    setLayers(c.layers);
    setTotal(c.totalBytes);
    onChanged();
  }, [fishLocked, onChanged]);

  // SAO LƯU ra tệp .json (bà con cầm theo, phòng app/máy xoá cache)
  const doExport = useCallback(async () => {
    setBackupBusy("export");
    try {
      const json = await exportOfflineData();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "sdfish-du-bao-da-luu.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* trình duyệt chặn tải — bỏ qua, không làm app chết */
    }
    setBackupBusy(null);
  }, []);

  // PHỤC HỒI từ tệp đã sao lưu
  const doImport = useCallback(
    async (file: File) => {
      setBackupBusy("import");
      try {
        await importOfflineData(await file.text());
      } catch {
        /* tệp hỏng — bỏ qua */
      }
      setBackupBusy(null);
      refresh();
    },
    [refresh],
  );

  const retry = useCallback(
    async (id: SavedLayerId) => {
      if (busy) return;
      setBusy(id);
      let threw = false;
      try {
        await runLayer(id, points);
      } catch {
        threw = true;
      }
      setBusy(null);
      // vẫn chưa lưu được sau khi thử → đánh dấu lỗi để nói thật với bà con
      const after = savedCoverage({ fishLocked }).layers.find((l) => l.id === id);
      setFailed((prev) => {
        const n = new Set(prev);
        if (threw || (after && !after.saved)) n.add(id);
        else n.delete(id);
        return n;
      });
      refresh();
    },
    [busy, points, refresh, fishLocked],
  );

  const retryAll = useCallback(async () => {
    if (busy) return;
    setBusy("all");
    for (const l of layers) {
      if (l.retriable && !l.saved) {
        try {
          await runLayer(l.id, points);
        } catch {
          /* bỏ qua lớp hỏng, chạy tiếp lớp khác */
        }
      }
    }
    setBusy(null);
    refresh();
  }, [busy, layers, points, refresh]);

  const missing = layers.filter((l) => l.retriable && !l.saved).length;

  return (
    <BottomSheet title="Dữ liệu đã lưu để đi biển" onClose={onClose}>
      <p className="mb-3 text-[0.9375rem] leading-snug text-foreground/70">
        Mỗi lớp cần tải sẵn lúc còn sóng để xem được khi ra khơi mất sóng. Dòng
        nào <b>chưa lưu</b> thì chạm <b>Tải lại</b>.
      </p>
      <ul className="space-y-2">
        {layers.map((l) => {
          const rowBusy = busy === l.id || busy === "all";
          return (
            <li
              key={l.id}
              className="flex items-center gap-3 rounded-xl bg-field px-3 py-2.5"
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                  l.saved ? "bg-ok-bg text-ok" : "bg-warn-bg text-warn"
                }`}
                aria-hidden
              >
                {l.saved ? (
                  <CheckIcon className="h-4 w-4" />
                ) : (
                  <AlertIcon className="h-4 w-4" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[1rem] font-bold leading-tight text-navy">
                  {l.label}
                </span>
                {!l.saved && failed.has(l.id) ? (
                  <span className="block text-[0.8125rem] font-semibold leading-snug text-warn">
                    Chưa tải được — cần có sóng, hoặc nguồn đang bận. Thử lại sau.
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
                <span className="shrink-0 text-[0.8125rem] font-bold text-foreground/55">
                  Đang tải…
                </span>
              ) : l.saved && l.fresh ? (
                // còn trong chu kỳ cập nhật → KHÔNG cần tải lại (user: >chu kỳ mới cần)
                <span className="shrink-0 text-[0.75rem] font-bold text-ok">
                  ✓ còn mới
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => retry(l.id)}
                  disabled={!!busy}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-[0.8125rem] font-bold transition active:scale-95 disabled:opacity-50 ${
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

      {missing > 0 && (
        <button
          type="button"
          onClick={retryAll}
          disabled={!!busy}
          className="mt-4 min-h-[3.25rem] w-full rounded-xl bg-navy text-[1.0625rem] font-bold text-white transition active:scale-[0.99] disabled:opacity-60"
        >
          {busy === "all"
            ? "Đang tải các lớp còn thiếu…"
            : `Tải lại ${missing} lớp còn thiếu`}
        </button>
      )}
      {total > 0 && (
        <p className="mt-3 text-[0.875rem] font-semibold text-foreground/70">
          Tổng trong máy: ~{fmtBytes(total)}
        </p>
      )}

      {/* SAO LƯU / PHỤC HỒI ra tệp — phòng app hay máy lỡ xoá cache */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={doExport}
          disabled={!!backupBusy || total <= 0}
          className="min-h-[3rem] rounded-xl bg-field text-[0.9375rem] font-bold text-navy transition active:scale-[0.99] disabled:opacity-50"
        >
          {backupBusy === "export" ? "Đang lưu…" : "Lưu ra tệp"}
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={!!backupBusy}
          className="min-h-[3rem] rounded-xl bg-field text-[0.9375rem] font-bold text-navy transition active:scale-[0.99] disabled:opacity-50"
        >
          {backupBusy === "import" ? "Đang phục hồi…" : "Phục hồi từ tệp"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) doImport(f);
            e.target.value = "";
          }}
        />
      </div>

      <p className="mt-3 text-[0.8125rem] leading-snug text-foreground/60">
        Cần có sóng (mạng) để tải. Ngoài khơi mất sóng thì chỉ xem lại được thứ
        đã tải sẵn. <b>Lưu ra tệp</b> để giữ bản dự phòng phòng khi máy xoá.
      </p>
      <button
        type="button"
        onClick={onClose}
        className="mt-2 min-h-[3rem] w-full rounded-xl bg-field text-[1rem] font-bold text-navy transition active:scale-[0.99]"
      >
        Đóng
      </button>
    </BottomSheet>
  );
}
