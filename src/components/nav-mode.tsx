"use client";

/**
 * Trục 1 — DẪN ĐƯỜNG LIVE: HUD (thẻ nổi) + marker tàu sống.
 *
 * NavBoatMarker: chấm tàu tại vị trí GPS, mũi tên xoay theo hướng đang đi
 * (đặt BÊN TRONG <MapGL>). NavHud: thẻ nổi trên cùng hiện gợi ý lái + quãng/giờ
 * còn lại + cảnh báo lệch tuyến/mất định vị/tới nơi + nút Dừng. Luôn dặn dò
 * "dò hải đồ, nghe đài" — app KHÔNG phán đi/không đi (01 §product).
 */

import { Marker } from "react-map-gl/maplibre";

import type { LatLon } from "@/lib/route-plan";
import { formatHoursVN } from "@/lib/route-plan";
import type { NavProgress } from "@/lib/nav-progress";
import type { NavStatus } from "@/lib/use-nav-tracking";
import { useMapPrefs, fmtDist } from "@/lib/map-prefs";
import { AlertIcon, ClockIcon, NavArrowIcon, RouteIcon } from "@/components/icons";

/** Chấm tàu + mũi tên hướng trên bản đồ (đặt trong <MapGL>). */
export function NavBoatMarker({
  pos,
  headingDeg,
  stale,
}: {
  pos: LatLon | null;
  headingDeg: number | null;
  /** mất định vị → làm mờ để bà con biết đây là vị trí CŨ */
  stale?: boolean;
}) {
  if (!pos) return null;
  return (
    <Marker longitude={pos.lon} latitude={pos.lat} anchor="center">
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-md ring-2 ring-t1 transition-opacity ${
          stale ? "opacity-40" : "opacity-100"
        }`}
      >
        {headingDeg != null ? (
          // mũi tên chỉ thẳng lên (Bắc) → xoay theo heading; MapLibre bắc-lên
          <span
            className="flex"
            style={{ transform: `rotate(${headingDeg}deg)` }}
          >
            <NavArrowIcon className="h-6 w-6 text-t1" />
          </span>
        ) : (
          <span className="h-3.5 w-3.5 rounded-full bg-t1" aria-hidden />
        )}
      </span>
    </Marker>
  );
}

/** Thẻ nổi dẫn đường — chỉ hiện khi đang ở chế độ dẫn đường. */
export function NavHud({
  progress,
  status,
  onStop,
}: {
  progress: NavProgress | null;
  status: NavStatus;
  onStop: () => void;
}) {
  const prefs = useMapPrefs();
  const lost = status === "lost";
  const denied = status === "denied";

  return (
    <div className="pointer-events-auto surface space-y-2 p-3">
      <div className="flex items-center gap-2 text-t1">
        <RouteIcon className="h-6 w-6" />
        <h3 className="text-[1.0625rem] font-bold text-navy">Đang dẫn đường</h3>
      </div>

      {denied ? (
        <p className="flex items-start gap-2 rounded-xl bg-[var(--warn-bg)] p-3 text-[1rem] font-bold leading-snug text-[var(--warn)]">
          <AlertIcon className="mt-0.5 h-5 w-5 shrink-0" />
          Máy chưa bật định vị. Bật định vị (GPS) trên máy rồi mở lại để dẫn
          đường tới nơi.
        </p>
      ) : (
        <>
          {lost && (
            <p className="flex items-start gap-2 rounded-xl bg-[var(--warn-bg)] p-3 text-[1rem] font-bold leading-snug text-[var(--warn)]">
              <AlertIcon className="mt-0.5 h-5 w-5 shrink-0" />
              Mất định vị — đang tìm lại. Số dưới là lần bắt được gần nhất, chưa
              phải vị trí bây giờ.
            </p>
          )}

          {progress ? (
            <div className={lost ? "opacity-50" : ""}>
              {/* Dòng LỚN: gợi ý lái + hướng đi */}
              <div className="flex items-center gap-2.5">
                {progress.steer && (
                  <span
                    className="flex shrink-0"
                    style={{ transform: `rotate(${progress.steer.turnDeg}deg)` }}
                  >
                    <NavArrowIcon className="h-8 w-8 text-t1" />
                  </span>
                )}
                <p className="display text-[1.5rem] font-bold leading-tight text-navy">
                  {progress.arrived
                    ? "Đã tới gần nơi"
                    : progress.steer
                      ? progress.steer.label
                      : "Đang bắt hướng đi…"}
                </p>
              </div>
              <p className="mt-0.5 text-[0.9375rem] font-semibold text-foreground/70">
                Hướng đi tới: {progress.dirVN}
              </p>

              {/* Còn lại + giờ tới */}
              <div className="mt-2 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-xl bg-background p-2.5">
                  <RouteIcon className="mx-auto h-5 w-5 text-t1" />
                  <p className="display mt-1 text-[1.25rem] font-bold leading-none text-navy">
                    {fmtDist(progress.remainingKm, prefs.distUnit)}
                  </p>
                  <p className="mt-1 text-[0.8125rem] font-semibold text-foreground/70">
                    còn lại
                  </p>
                </div>
                <div className="rounded-xl bg-background p-2.5">
                  <ClockIcon className="mx-auto h-5 w-5 text-t1" />
                  <p className="display mt-1 text-[1.25rem] font-bold leading-none text-navy">
                    {progress.etaHours != null
                      ? formatHoursVN(progress.etaHours)
                      : "—"}
                  </p>
                  <p className="mt-1 text-[0.8125rem] font-semibold text-foreground/70">
                    {progress.etaHours != null ? "còn chạy" : "tàu chưa chạy"}
                  </p>
                </div>
              </div>

              {progress.offRoute && !progress.arrived && (
                <p className="mt-2 rounded-xl bg-[var(--warn-bg)] p-2.5 text-[0.9375rem] font-bold leading-snug text-[var(--warn)]">
                  Đang lệch tuyến ~{fmtDist(progress.offRouteKm, prefs.distUnit)} —
                  lái về đường xanh đã vẽ.
                </p>
              )}
              {progress.arrived && (
                <p className="mt-2 rounded-xl bg-[var(--ok-bg)] p-2.5 text-[0.9375rem] font-bold leading-snug text-[var(--ok)]">
                  Đã tới gần điểm đến — bấm Dừng khi neo xong.
                </p>
              )}
            </div>
          ) : (
            !lost && (
              <p className="rounded-xl bg-background p-3 text-[1rem] font-semibold text-foreground/70">
                Đang tìm vị trí tàu…
              </p>
            )
          )}
        </>
      )}

      <p className="text-[0.8125rem] leading-snug text-foreground/65">
        Chỉ tham khảo — không thay máy định vị của tàu. Dò hải đồ và nghe đài
        duyên hải khi chạy.
      </p>

      <button
        type="button"
        onClick={onStop}
        className="min-h-[3.5rem] w-full rounded-xl bg-background text-[1.0625rem] font-bold text-navy transition active:scale-[0.99]"
      >
        Dừng dẫn đường
      </button>
    </div>
  );
}
