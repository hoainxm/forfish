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

// Không fix mới quá lâu → coi như mất định vị (nói thật, không đóng băng ngầm)
const STALE_MS = 10_000;
// Đi được quãng này giữa 2 fix mới suy ra hướng (m) — dưới ngưỡng là nhiễu GPS
const MIN_MOVE_M = 15;
// Tốc độ suy từ 2 fix vượt ngưỡng này coi là nhiễu (km/h ≈ 40 hải lý/giờ)
const JITTER_MAX_KMH = 74;

interface WakeLockSentinelLike {
  release: () => Promise<void>;
  released: boolean;
  addEventListener?: (t: string, cb: () => void) => void;
}

/**
 * Theo dõi GPS khi `active`. Trả vị trí/hướng/tốc độ + trạng thái trung thực.
 * Ngưng theo dõi + nhả wake lock khi `active=false` hoặc unmount.
 */
export function useNavTracking(active: boolean): NavTracking {
  const [state, setState] = useState<NavTracking>({
    pos: null,
    headingDeg: null,
    speedKmh: null,
    status: "idle",
    lastFixAt: null,
    accuracyM: null,
  });

  // giá trị bền giữa các fix (không gây re-render)
  const prevFix = useRef<{ pos: LatLon; t: number } | null>(null);
  const headingRef = useRef<number | null>(null);
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

    const onFix = (p: GeolocationPosition) => {
      if (stopped) return;
      const now = p.timestamp || Date.now();
      const pos: LatLon = { lat: p.coords.latitude, lon: p.coords.longitude };
      const prev = prevFix.current;

      // tốc độ: ưu tiên số máy đo (đã lọc); không có thì suy từ 2 fix (chặn nhiễu)
      const liveKmh = mpsToKmh(p.coords.speed);
      let speedKmh: number | null = null;
      if (liveKmh != null) {
        speedKmh = liveKmh >= MIN_MOVING_KMH ? liveKmh : null;
      } else if (prev) {
        const dtS = (now - prev.t) / 1000;
        const movedM = haversineKm(prev.pos, pos) * 1000;
        if (dtS >= 1) {
          const derived = (movedM / dtS) * 3.6;
          speedKmh =
            derived >= MIN_MOVING_KMH && derived <= JITTER_MAX_KMH ? derived : null;
        }
      }

      // hướng: số máy đo khi đang chạy → suy từ di chuyển → giữ hướng cũ
      const gpsHeading = p.coords.heading;
      if (
        gpsHeading != null &&
        Number.isFinite(gpsHeading) &&
        (liveKmh == null || liveKmh >= MIN_MOVING_KMH)
      ) {
        headingRef.current = gpsHeading;
      } else if (prev && haversineKm(prev.pos, pos) * 1000 > MIN_MOVE_M) {
        headingRef.current = bearingDeg(prev.pos, pos);
      }

      prevFix.current = { pos, t: now };
      setState({
        pos,
        headingDeg: headingRef.current,
        speedKmh,
        status: "tracking",
        lastFixAt: now,
        accuracyM: Number.isFinite(p.coords.accuracy) ? p.coords.accuracy : null,
      });
    };

    const onErr = (e: GeolocationPositionError) => {
      if (stopped) return;
      // 1 = PERMISSION_DENIED → máy từ chối; còn lại (unavailable/timeout) = mất sóng
      setState((s) => ({
        ...s,
        status: e.code === e.PERMISSION_DENIED ? "denied" : "lost",
      }));
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
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        startWatch();
        void requestWake();
      }
    };
    const onOnline = () => startWatch();

    startWatch();
    void requestWake();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);

    // đồng hồ nhắc "mất định vị" khi fix quá cũ (không đóng băng số ngầm)
    const staleTimer = window.setInterval(() => {
      setState((s) => {
        if (s.status !== "tracking" || s.lastFixAt == null) return s;
        return Date.now() - s.lastFixAt > STALE_MS ? { ...s, status: "lost" } : s;
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
      headingRef.current = null;
    };
  }, [active]);

  return state;
}
