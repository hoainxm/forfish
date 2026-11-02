"use client";

// Trục 1 — DẪN ĐƯỜNG LIVE: vòng đời theo dõi GPS + giữ màn hình sáng.
// Tính toán bám tuyến ở nav-progress.ts (thuần); file này chỉ lo GPS/wake lock
// và các TRẠNG THÁI TRUNG THỰC (đang dẫn / mất định vị / máy từ chối) — theo
// mẫu use-storm-check: mất tín hiệu thì NÓI THẬT + tự tìm lại, KHÔNG đứng câm,
// KHÔNG để số cũ trôi như số mới. Vị trí CHỈ nằm trên máy — không gửi đi đâu.

import { useEffect, useRef, useState } from "react";

import { bearingDeg, haversineKm, type LatLon } from "@/lib/route-plan";
import { mpsToKmh, MIN_MOVING_KMH } from "@/lib/nav-progress";

export type NavStatus =
  | "idle" // chưa bật dẫn đường
  | "tracking" // có fix mới, số đang chạy
  | "lost" // mất định vị — đang tìm lại
  | "denied"; // máy từ chối / không có GPS

export interface NavTracking {
  pos: LatLon | null;
  /** hướng tàu đang đi (0–360) — null khi chưa xác định */
  headingDeg: number | null;
  /** tốc độ tàu hiện tại (km/h) — null khi tàu chưa chạy / chưa biết */
  speedKmh: number | null;
  status: NavStatus;
  /** epoch ms của fix gần nhất */
  lastFixAt: number | null;
  /** sai số định vị (m) của fix gần nhất — để UI dặn khi kém */
  accuracyM: number | null;
}

// Không fix mới quá lâu → coi như mất định vị (nói thật, không đóng băng ngầm).
// ĐANG CHẠY: 10 s. ĐỨNG YÊN: 60 s — LỖI 2026-10-18 (iPhone, ảnh chủ dự án): máy
// đứng yên thì vị trí không đổi nên WebView có khi vài chục giây mới trả fix mới
// ⇒ "Mất định vị" trong khi toạ độ vừa bắt lúc 08:22 (đồng hồ 8:22).
export const STALE_MS = 10_000;
export const STALE_DUNG_MS = 60_000;

/** Fix gần nhất đã quá cũ chưa — ngưỡng theo đang chạy hay đứng yên. Thuần, có test. */
export function fixQuaCu(lastFixAt: number | null, speedKmh: number | null, now: number): boolean {
  if (lastFixAt == null) return false;
  return now - lastFixAt > (speedKmh != null ? STALE_MS : STALE_DUNG_MS);
}
// Đi được quãng này giữa 2 fix mới suy ra hướng/tốc độ (m) — dưới ngưỡng là nhiễu GPS.
// Máy báo sai số lớn thì ngưỡng nới theo: max(15 m, 2 × sai số).
const MIN_MOVE_M = 15;
// Tốc độ suy từ 2 fix vượt ngưỡng này coi là nhiễu (km/h ≈ 40 hải lý/giờ)
const JITTER_MAX_KMH = 74;
// Hằng số thời gian làm mượt tốc độ (giây)
const SPEED_TAU_S = 20;

/** Trạng thái lọc bền giữa các fix. */
export interface LocState {
  pos: LatLon;
  t: number;
  /** tốc độ đã làm mượt (km/h), 0 = đứng; null = chưa biết */
  smoothKmh: number | null;
  headingDeg: number | null;
}

export interface LocIn {
  pos: LatLon;
  t: number;
  /** m/s do máy đo, null nếu không có */
  speedMps: number | null;
  /** độ do máy đo, null nếu không có */
  headingDeg: number | null;
  accuracyM: number | null;
}

/**
 * Lọc 1 fix GPS: tốc độ làm mượt EMA (τ=20 s), bỏ nhiễu dịch gần (< max(15 m, 2×sai số)),
 * hướng chỉ nhận khi tàu đang chạy (≥ MIN_MOVING_KMH). Thuần, có test.
 * `speedKmh` null khi đứng/chưa biết.
 */
export function locFix(prev: LocState | null, fix: LocIn): LocState & { speedKmh: number | null } {
  const acc = fix.accuracyM != null && Number.isFinite(fix.accuracyM) ? fix.accuracyM : 0;
  const minMove = Math.max(MIN_MOVE_M, 2 * acc);
  const dtS = prev ? (fix.t - prev.t) / 1000 : 0;
  const movedM = prev ? haversineKm(prev.pos, fix.pos) * 1000 : 0;

  // mẫu tốc độ thô: số máy đo ưu tiên; không có thì suy từ 2 fix (dịch ngắn = đứng)
  let sample: number | null = null; // null = bỏ mẫu (không đủ cơ sở / nhiễu)
  const live = mpsToKmh(fix.speedMps);
  if (live != null) {
    sample = live < MIN_MOVING_KMH ? 0 : live;
  } else if (prev && dtS >= 1) {
    if (movedM < minMove) sample = 0;
    else {
      const derived = (movedM / dtS) * 3.6;
      if (derived <= JITTER_MAX_KMH) sample = derived;
    }
  }

  let smooth = prev?.smoothKmh ?? null;
  if (sample != null) {
    if (smooth == null || dtS <= 0) smooth = sample;
    else smooth += (1 - Math.exp(-dtS / SPEED_TAU_S)) * (sample - smooth);
  }
  const speedKmh = smooth != null && smooth >= MIN_MOVING_KMH ? smooth : null;

  // hướng: số máy đo CHỈ khi đang chạy → suy từ di chuyển đủ xa → giữ hướng cũ
  let headingDeg = prev?.headingDeg ?? null;
  if (fix.headingDeg != null && Number.isFinite(fix.headingDeg) && speedKmh != null) {
    headingDeg = ((fix.headingDeg % 360) + 360) % 360;
  } else if (prev && movedM > minMove) {
    headingDeg = bearingDeg(prev.pos, fix.pos);
  }

  return { pos: fix.pos, t: fix.t, smoothKmh: smooth, headingDeg, speedKmh };
}

/*  LỌC ĐIỂM NHẢY Ở CHỖ NHẬN VỊ TRÍ (rà 2026-11-02). Trước đây chỉ bỏ MẪU TỐC ĐỘ khi
    nhảy, còn vị trí thì nhận nguyên ⇒ một điểm nhảy là đủ kêu chuông lệch tuyến /
    ranh giới, hay "tới nơi" giả làm xoá chuyến dở. Bỏ fix khi: sai số > SAI_SO_BO_M
    (định vị theo trạm, không phải GPS) hoặc vọt từ fix trước nhanh hơn JITTER_MAX_KMH
    trên quãng > NHAY_MIN_M. Bỏ liền quá BO_LIEN_MAX lần thì NHẬN (fix trước mới là
    cái sai — tàu đã đi thật, hoặc điểm đầu tiên là điểm nhảy), không kẹt mãi. */
export const SAI_SO_BO_M = 1000;
const NHAY_MIN_M = 500;
export const BO_LIEN_MAX = 3;
/*  ĐIỂM BỊ BỎ MÀ KHÔNG AI CÃI LẠI (thử iOS Simulator 2026-11-02): máy chỉ gửi fix khi vị
    trí ĐỔI — tàu neo yên thì sau một điểm "nhảy" (thật ra điểm TRƯỚC mới sai) không còn fix
    nào nữa ⇒ bỏ liền không bao giờ đủ BO_LIEN_MAX, app kẹt "Mất định vị" ở chỗ cũ. Giữ điểm
    bị bỏ gần nhất; quá NHAY_CHO_MS không có fix nào khác thì NHẬN nó. */
export const NHAY_CHO_MS = 8_000;

/** Điểm bị bỏ đang chờ có nên nhận không (không fix nào tới sau nó đủ lâu). Thuần, có test. */
export function nenNhanDiemCho(choAt: number | null, now: number): boolean {
  return choAt != null && now - choAt >= NHAY_CHO_MS;
}

/** Nhận fix này không. `boLien` = số fix đã bỏ liền trước đó. Thuần, có test. */
export function nhanFix(
  prev: Pick<LocState, "pos" | "t"> | null,
  fix: Pick<LocIn, "pos" | "t" | "accuracyM">,
  boLien: number,
): { nhan: boolean; boLien: number } {
  if (!prev || boLien >= BO_LIEN_MAX) return { nhan: true, boLien: 0 };
  const acc = fix.accuracyM;
  if (acc != null && Number.isFinite(acc) && acc > SAI_SO_BO_M) return { nhan: false, boLien: boLien + 1 };
  const dtS = (fix.t - prev.t) / 1000;
  const m = haversineKm(prev.pos, fix.pos) * 1000;
  if (m > NHAY_MIN_M && (dtS <= 0 || (m / dtS) * 3.6 > JITTER_MAX_KMH)) return { nhan: false, boLien: boLien + 1 };
  return { nhan: true, boLien: 0 };
}

interface WakeLockSentinelLike {
  release: () => Promise<void>;
  released: boolean;
  addEventListener?: (t: string, cb: () => void) => void;
}

/**
 * Theo dõi GPS khi `active`. Trả vị trí/hướng/tốc độ + trạng thái trung thực.
 * Ngưng theo dõi + nhả wake lock khi `active=false` hoặc unmount.
 *
 * `keepAwake` (mặc định true = như dẫn đường): giữ màn hình sáng. Ô toạ độ tàu
 * ở màn Ra khơi cũng theo dõi GPS nhưng KHÔNG được giữ sáng — bà con mở bản đồ
 * cả buổi, khoá màn hình rồi mà máy vẫn sáng là hết pin giữa biển.
 */
export function useNavTracking(
  active: boolean,
  opts?: { keepAwake?: boolean },
): NavTracking {
  const keepAwake = opts?.keepAwake !== false;
  const [state, setState] = useState<NavTracking>({
    pos: null,
    headingDeg: null,
    speedKmh: null,
    status: "idle",
    lastFixAt: null,
    accuracyM: null,
  });

  // giá trị bền giữa các fix (không gây re-render)
  const prevFix = useRef<LocState | null>(null);
  const boLienRef = useRef(0);
  const watchId = useRef<number | null>(null);
  const wakeRef = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    if (!active) {
      setState((s) => ({ ...s, status: "idle" }));
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState((s) => ({ ...s, status: "denied" }));
      return;
    }

    let stopped = false;

    /** điểm bị bỏ gần nhất + lúc nhận được nó (đồng hồ máy) — xem NHAY_CHO_MS */
    let cho: { p: GeolocationPosition; at: number } | null = null;
    const onFix = (p: GeolocationPosition, epNhan = false) => {
      if (stopped) return;
      const now = p.timestamp || Date.now();
      const pos: LatLon = { lat: p.coords.latitude, lon: p.coords.longitude };
      if (!epNhan) {
        const k = nhanFix(prevFix.current, { pos, t: now, accuracyM: p.coords.accuracy }, boLienRef.current);
        boLienRef.current = k.boLien;
        if (!k.nhan) {
          cho = { p, at: Date.now() }; // điểm nhảy — giữ vị trí cũ, chờ xem có fix nào cãi lại không
          return;
        }
      }
      cho = null;
      boLienRef.current = 0;
      const r = locFix(prevFix.current, {
        pos,
        t: now,
        speedMps: p.coords.speed,
        headingDeg: p.coords.heading,
        accuracyM: p.coords.accuracy,
      });
      prevFix.current = r;
      setState({
        pos,
        headingDeg: r.headingDeg,
        speedKmh: r.speedKmh,
        status: "tracking",
        lastFixAt: now,
        accuracyM: Number.isFinite(p.coords.accuracy) ? p.coords.accuracy : null,
      });
    };

    const onErr = (e: GeolocationPositionError) => {
      if (stopped) return;
      // 1 = PERMISSION_DENIED → máy từ chối. 3 = TIMEOUT: chưa có fix MỚI trong 15 s —
      // máy đứng yên hay gặp (vị trí không đổi) ⇒ chỉ là mất định vị khi fix cũ đã
      // quá ngưỡng, không thì giữ "đang theo dõi". 2 = UNAVAILABLE ⇒ mất sóng thật.
      setState((s) => {
        if (e.code === e.PERMISSION_DENIED) return { ...s, status: "denied" };
        if (e.code === e.TIMEOUT && s.status === "tracking" && !fixQuaCu(s.lastFixAt, s.speedKmh, Date.now())) return s;
        return { ...s, status: "lost" };
      });
    };

    const startWatch = () => {
      if (watchId.current != null) return;
      watchId.current = navigator.geolocation.watchPosition(onFix, onErr, {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 15_000,
      });
    };
    const stopWatch = () => {
      if (watchId.current != null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    };

    const requestWake = async () => {
      if (!keepAwake) return;
      try {
        const wl = (navigator as unknown as {
          wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinelLike> };
        }).wakeLock;
        if (!wl || wakeRef.current) return;
        wakeRef.current = await wl.request("screen");
      } catch {
        // máy không hỗ trợ / bị chặn — bỏ qua êm, không phá dẫn đường
      }
    };
    const releaseWake = () => {
      wakeRef.current?.release().catch(() => {});
      wakeRef.current = null;
    };

    // Tab hiện lại (mở khoá máy) → wake lock tự nhả, watch có thể ngủ: bật lại
    // + thử lại định vị. online trở lại cũng thử lại. (mẫu use-storm-check)
    /*  KHỞI ĐỘNG LẠI watch, không chỉ "bật nếu chưa có" (rà 2026-11-02): máy có thể
        giết GPS lúc khoá màn mà `watchId` vẫn còn ⇒ `startWatch` thoát ngay, kẹt ở
        "Mất định vị". Dọn rồi bật lại là đủ rẻ — một lượt mỗi lần mở khoá / có mạng. */
    const restartWatch = () => {
      stopWatch();
      startWatch();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        restartWatch();
        void requestWake();
      }
    };
    const onOnline = () => restartWatch();

    startWatch();
    void requestWake();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);

    // đồng hồ nhắc "mất định vị" khi fix quá cũ (không đóng băng số ngầm)
    const staleTimer = window.setInterval(() => {
      if (cho && nenNhanDiemCho(cho.at, Date.now())) onFix(cho.p, true);
      setState((s) => {
        if (s.status !== "tracking" || s.lastFixAt == null) return s;
        return fixQuaCu(s.lastFixAt, s.speedKmh, Date.now()) ? { ...s, status: "lost" } : s;
      });
    }, 3000);

    return () => {
      stopped = true;
      stopWatch();
      releaseWake();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.clearInterval(staleTimer);
      prevFix.current = null;
      boLienRef.current = 0;
    };
  }, [active, keepAwake]);

  return state;
}
