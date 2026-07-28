"use client";

/*
  Trục 1 — THANH THỜI GIAN kiểu Windy: THANH XEM PHIM.
  User 2026-07-28 (xem windy.com):
   - Ô NGÀY BẰNG NHAU (không co giãn theo số giờ).
   - TRONG mỗi ngày, nấc-giờ chia ĐỀU theo SỐ NẤC của ngày đó (ngày 4 nấc → 4
     vị trí, ngày 2 nấc → 2 vị trí). Kéo marker snap theo nấc.
   - Marker (bong bóng giờ) KÉO TAY tới lui; ray tự cuộn để marker luôn trong
     tầm nhìn. Ranh giới rõ giữa các ngày.
   - Thanh dải màu cường độ LUÔN hiện bên dưới.
*/

import { useCallback, useEffect, useMemo, useRef } from "react";
import { groupTimesByDay, scrubDayLabel, timeLabelVN } from "@/lib/forecast-grid";

export interface ScrubberLegend {
  title: string;
  unit: string;
  gradient: string;
  ticks: number[];
}

/** bề rộng MỖI Ô NGÀY (px) — bằng nhau, gọn (user 2026-07-29: ngắn bớt nữa) */
const DAY_PX = 64;

export function TimeScrubber({
  times,
  timeIdx,
  onSeek,
  legend,
  todayIso,
}: {
  times: string[];
  timeIdx: number;
  onSeek: (idx: number) => void;
  legend: ScrubberLegend;
  todayIso: string;
}) {
  const days = useMemo(() => groupTimesByDay(times), [times]);
  const len = times.length;
  const clamped = Math.max(0, Math.min(timeIdx, len - 1));

  // ánh xạ global idx → (ngày, thứ tự trong ngày, số nấc của ngày)
  const posOf = useMemo(() => {
    const m: { dayI: number; localI: number; n: number }[] = [];
    days.forEach((d, dayI) =>
      d.ticks.forEach((t, localI) => {
        m[t.idx] = { dayI, localI, n: d.ticks.length };
      }),
    );
    return m;
  }, [days]);

  const trackWidth = Math.max(days.length, 1) * DAY_PX;

  // x của một global idx: ô ngày bằng nhau, nấc chia đều TRONG ngày
  const xOf = useCallback(
    (idx: number) => {
      const p = posOf[idx];
      if (!p) return DAY_PX / 2;
      return p.dayI * DAY_PX + ((p.localI + 0.5) / p.n) * DAY_PX;
    },
    [posOf],
  );

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);

  const seekFromX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track || days.length === 0) return;
      const rel = clientX - track.getBoundingClientRect().left;
      const dayI = Math.max(0, Math.min(days.length - 1, Math.floor(rel / DAY_PX)));
      const day = days[dayI];
      const frac = (rel - dayI * DAY_PX) / DAY_PX; // 0..1 trong ngày
      const localI = Math.max(0, Math.min(day.ticks.length - 1, Math.floor(frac * day.ticks.length)));
      onSeek(day.ticks[localI].idx);
    },
    [days, onSeek],
  );

  // ray tự cuộn để marker ở giữa tầm nhìn
  useEffect(() => {
    const c = scrollRef.current;
    if (!c) return;
    c.scrollTo({
      left: xOf(clamped) - c.clientWidth / 2,
      behavior: dragging.current ? "auto" : "smooth",
    });
  }, [clamped, xOf]);

  const playheadX = xOf(clamped);
  const bubble = timeLabelVN(times[clamped] ?? "", todayIso);

  return (
    <div className="mt-1">
      {/* THANH XEM PHIM — cuộn ngang, kéo marker snap theo nấc */}
      <div
        ref={scrollRef}
        className="overflow-x-auto pt-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div
          ref={trackRef}
          className="relative h-8 cursor-pointer touch-none select-none"
          style={{ width: trackWidth }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            dragging.current = true;
            seekFromX(e.clientX);
          }}
          onPointerMove={(e) => {
            if (dragging.current) seekFromX(e.clientX);
          }}
          onPointerUp={() => {
            dragging.current = false;
          }}
          onPointerCancel={() => {
            dragging.current = false;
          }}
        >
          {/* ô NGÀY bằng nhau + ranh giới + nấc-giờ chia đều trong ngày */}
          <div className="flex h-full rounded-lg bg-field">
            {days.map((d) => (
              <div
                key={d.iso}
                className="relative flex h-full items-center justify-center border-l-2 border-navy/25 first:border-l-0"
                style={{ width: DAY_PX }}
              >
                <span className="whitespace-nowrap text-[0.75rem] font-bold text-navy">
                  {scrubDayLabel(d.iso, todayIso)}
                </span>
                {/* nấc-giờ mờ: chia đều theo SỐ NẤC của ngày này */}
                {d.ticks.map((_, k) => (
                  <span
                    key={k}
                    className="pointer-events-none absolute bottom-1 h-1.5 w-px bg-navy/25"
                    style={{ left: `${((k + 0.5) / d.ticks.length) * 100}%` }}
                    aria-hidden
                  />
                ))}
              </div>
            ))}
          </div>

          {/* marker: bong bóng giờ + vạch (cam như Windy) */}
          <div
            className="pointer-events-none absolute -top-5 bottom-0 z-10 -translate-x-1/2"
            style={{ left: playheadX }}
          >
            <span className="absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap rounded-md bg-trim px-2 py-0.5 text-[0.75rem] font-bold text-white shadow">
              {bubble}
            </span>
            <span className="absolute left-1/2 top-5 h-3 w-[3px] -translate-x-1/2 rounded bg-trim" />
          </div>
        </div>
      </div>

      {/* THANH DẢI MÀU cường độ (luôn hiện) — sát ray, không chừa hàng trống */}
      <div className="mt-1 flex items-center gap-2">
        <span className="shrink-0 text-[0.6875rem] font-bold text-foreground/60">
          {legend.title} ({legend.unit})
        </span>
        <div className="min-w-0 flex-1">
          <div
            className="h-2.5 w-full rounded-full"
            style={{ background: legend.gradient }}
            aria-hidden
          />
          <div className="relative mt-0.5 h-3.5">
            {legend.ticks.map((value, i) => {
              const min = legend.ticks[0];
              const max = legend.ticks[legend.ticks.length - 1];
              const p = ((value - min) / (max - min || 1)) * 100;
              const edge =
                i === 0
                  ? "left-0"
                  : i === legend.ticks.length - 1
                    ? "right-0"
                    : "-translate-x-1/2";
              return (
                <span
                  key={value}
                  className={`absolute text-[0.625rem] font-semibold tabular-nums text-foreground/55 ${edge}`}
                  style={
                    i === 0 || i === legend.ticks.length - 1
                      ? undefined
                      : { left: `${p}%` }
                  }
                >
                  {value}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
