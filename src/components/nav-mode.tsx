"use client";

/**
 * Trục 1 — DẪN ĐƯỜNG LIVE: HUD (thẻ nổi) + marker tàu sống.
 *
 * NavBoatMarker: chấm tàu tại vị trí GPS, mũi tên xoay theo hướng đang đi
 * (đặt BÊN TRONG <MapGL>). NavHud: thẻ nổi trên cùng hiện gợi ý lái + quãng/giờ
 * còn lại + cảnh báo lệch tuyến/mất định vị/tới nơi + nút Dừng. Luôn dặn dò
 * "dò hải đồ, nghe đài" — app KHÔNG phán đi/không đi (01 §product).
 */

import { useRef, useState } from "react";
import { Marker } from "react-map-gl/maplibre";

import type { LatLon } from "@/lib/route-plan";
import { formatHoursVN } from "@/lib/route-plan";
import type { NavProgress } from "@/lib/nav-progress";
import type { NavStatus } from "@/lib/use-nav-tracking";
import type { BorderLevel } from "@/lib/geofence";
import { useMapPrefs, fmtDist } from "@/lib/map-prefs";
import {
  AlertIcon,
  ClockIcon,
  MinusIcon,
  NavArrowIcon,
  RouteIcon,
} from "@/components/icons";

/**
 * VỊ TRÍ TÀU trên bản đồ (đặt trong <MapGL>) — **CHẤM NHỎ NHẤP NHÁY**, không
 * phải mũi tên (user 2026-08-25c: *"cái vị trí hiện tại của mình thì nên là 1
 * chấm nhỏ (nhấp nháy), cái vị trí trỏ đến thì nên là cái dấu mũi tên"* —
 * bản trước làm NGƯỢC: tàu là mũi tên, con trỏ là vòng ngắm). Chấm nhỏ đúng
 * quy ước "chỗ tôi đang đứng" của mọi app bản đồ; chỗ TRỎ TỚI thì là cái ghim
 * (`PinIcon`, kiểu Google Maps — chốt 2026-08-25d, xem 07 §10.9).
 * CỠ — chốt sau BA nhịp (ghi lại để đừng chỉnh vòng vo nữa): vòng trắng 44px
 * ban đầu chê TO → thu về 0.875rem chê NHỎ (*"đang dấu . nhỏ quá x3 nó lên đi"*)
 * → ×3 lại chê to (*"x2 thôi x3 to quá"*) ⇒ **×2 là mức chốt**: khung 1.75rem,
 * chấm 1.25rem, viền trắng 3px, pip hướng ×2. Chấm tàu
 * là thứ mắt phải bắt được NGAY giữa bản đồ đầy màu — khác cái ghim con trỏ
 * (đứng yên, tìm lúc nào cũng được).
 */
export function NavBoatMarker({
  pos,
  headingDeg,
  stale,
}: {
  pos: LatLon | null;
  headingDeg: number | null;
  /** mất định vị → làm mờ + TẮT nhấp nháy: số cũ thì đừng giả vờ đang sống */
  stale?: boolean;
}) {
  if (!pos) return null;
  return (
    <Marker longitude={pos.lon} latitude={pos.lat} anchor="center">
      <span
        className={`relative flex h-[1.75rem] w-[1.75rem] items-center justify-center transition-opacity ${
          stale ? "opacity-45" : "opacity-100"
        }`}
        style={headingDeg != null ? { transform: `rotate(${headingDeg}deg)` } : undefined}
      >
        {/* quầng nhấp nháy — chỉ khi đang có tín hiệu sống */}
        {!stale && (
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full bg-t1/60"
            aria-hidden
          />
        )}
        {/* pip hướng tàu: tam giác nhỏ phía trước chấm (khung đã xoay theo heading) */}
        {headingDeg != null && (
          <span
            className="absolute -top-1.5 h-0 w-0 border-x-[0.375rem] border-b-[0.5rem] border-x-transparent border-b-t1"
            aria-hidden
          />
        )}
        <span className="relative h-[1.25rem] w-[1.25rem] rounded-full border-[3px] border-white bg-t1 shadow-md" />
      </span>
    </Marker>
  );
}

/**
 * Thẻ nổi dẫn đường — chỉ hiện khi đang ở chế độ dẫn đường.
 * Liquid glass (nhìn xuyên thấy bản đồ), GỌN một nửa so với bản cũ; kéo hàng
 * đầu để DI CHUYỂN cho khỏi che bản đồ, nút trừ để ẨN thành chip nhỏ
 * (user 2026-07-29).
 */
/** Ranh giới theo GPS — cha (fishing-map-view) tính từ lib/geofence, HUD chỉ vẽ */
export type NavBorderNotice = {
  /** mốc đang trong (15/10/6/3 hải lý) */
  step: number;
  distanceNm: number;
  level: BorderLevel;
  /** bà con đã chạm thu (chỉ được khi >6 hải lý) */
  dismissed: boolean;
};

export function NavHud({
  progress,
  status,
  onStop,
  border,
  onDismissBorder,
}: {
  progress: NavProgress | null;
  status: NavStatus;
  onStop: () => void;
  border?: NavBorderNotice | null;
  onDismissBorder?: () => void;
}) {
  const prefs = useMapPrefs();
  const lost = status === "lost";
  const denied = status === "denied";
  /* RANH GIỚI (2026-08-18, audit M3): dòng warn/danger theo GPS; ≤6 hải lý
     (very_near) KHÔNG thu được — cả khi HUD đã ẩn thành chip vẫn phải hiện. */
  const borderLocked = border != null && border.level === "very_near";
  const borderShow = border != null && (borderLocked || !border.dismissed);
  const borderLine = border
    ? `Còn ~${
        border.level === "very_near"
          ? border.distanceNm.toFixed(1)
          : Math.round(border.distanceNm)
      } hải lý tới ranh giới — giữ khoảng cách`
    : null;
  const borderTone = borderLocked
    ? "bg-danger-bg text-danger"
    : "bg-warn-bg text-warn";

  const [hidden, setHidden] = useState(false);
  // kéo-thả: offset so với chỗ gốc (đầu màn hình) — chip ẩn cũng giữ chỗ này
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(
    null,
  );
  const onDragStart = (e: React.PointerEvent) => {
    // capture để kéo nhanh ra ngoài handle vẫn bám — máy không hỗ trợ thì thôi
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* vẫn kéo được, chỉ không capture */
    }
    drag.current = { px: e.clientX, py: e.clientY, x: pos.x, y: pos.y };
  };
  const onDragMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    // giữ trong màn hình để panel không "trôi mất"
    const clamp = (v: number, min: number, max: number) =>
      Math.max(min, Math.min(max, v));
    setPos({
      x: clamp(d.x + (e.clientX - d.px), -window.innerWidth * 0.8, window.innerWidth * 0.8),
      y: clamp(d.y + (e.clientY - d.py), -12, window.innerHeight * 0.72),
    });
  };
  const onDragEnd = () => {
    drag.current = null;
  };
  const floatStyle = { transform: `translate(${pos.x}px, ${pos.y}px)` };

  // ẨN → chỉ còn chip nhỏ (vẫn thấy quãng còn lại), chạm để mở lại
  if (hidden) {
    return (
      <div style={floatStyle} className="space-y-1.5 self-start">
        <button
          type="button"
          onClick={() => setHidden(false)}
          className="pointer-events-auto glass flex min-h-[3rem] items-center gap-2 px-4 text-[0.9375rem] font-bold text-navy transition active:scale-[0.97]"
          aria-label="Mở lại bảng dẫn đường"
        >
          <RouteIcon className="h-5 w-5 text-t1" />
          {progress
            ? `Còn ${fmtDist(progress.remainingKm, prefs.distUnit)}`
            : "Đang dẫn đường"}
        </button>
        {/* rất gần ranh giới thì HUD ẩn vẫn phải nói — không thu được */}
        {borderLocked && borderLine && (
          <p
            role="alert"
            className={`pointer-events-auto flex items-center gap-2 rounded-xl px-3 py-2 text-[0.9375rem] font-bold leading-snug shadow-md ${borderTone}`}
          >
            <AlertIcon className="h-5 w-5 shrink-0" />
            {borderLine}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      style={floatStyle}
      className="pointer-events-auto glass space-y-1.5 p-2.5"
    >
      {/* hàng đầu: giữ ngón tay KÉO để di chuyển · nút trừ = ẩn */}
      <div className="flex items-center gap-2">
        <div
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          style={{ touchAction: "none" }}
          className="flex min-h-[2.75rem] min-w-0 flex-1 cursor-grab items-center gap-2 active:cursor-grabbing"
          aria-label="Giữ và kéo để dời bảng dẫn đường"
        >
          <RouteIcon className="h-5 w-5 shrink-0 text-t1" />
          <h3 className="text-[0.9375rem] font-bold text-navy">
            Đang dẫn đường
          </h3>
          <span
            className="ml-1 h-1 w-8 rounded-full bg-navy/20"
            aria-hidden
          />
        </div>
        <button
          type="button"
          onClick={() => setHidden(true)}
          aria-label="Ẩn bảng dẫn đường"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-navy/10 text-navy transition active:scale-95"
        >
          <MinusIcon className="h-5 w-5" />
        </button>
      </div>

      {/* RANH GIỚI theo GPS — trên mọi thứ khác trong HUD; chạm để thu khi còn
          >6 hải lý, nói lại khi vượt mốc mới (cha lo), ≤6 hải lý nằm đó. */}
      {borderShow && borderLine && (
        <button
          type="button"
          role="alert"
          disabled={borderLocked}
          onClick={onDismissBorder}
          aria-label={
            borderLocked ? undefined : "Thu dòng cảnh báo ranh giới"
          }
          className={`flex min-h-[2.75rem] w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[0.9375rem] font-bold leading-snug ${borderTone}`}
        >
          <AlertIcon className="h-5 w-5 shrink-0" />
          <span className="min-w-0 flex-1">{borderLine}</span>
          {!borderLocked && <MinusIcon className="h-4 w-4 shrink-0" />}
        </button>
      )}

      {denied ? (
        <p className="flex items-start gap-2 rounded-xl bg-[var(--warn-bg)] p-2.5 text-[0.9375rem] font-bold leading-snug text-[var(--warn)]">
          <AlertIcon className="mt-0.5 h-5 w-5 shrink-0" />
          Máy chưa bật định vị. Bật định vị (GPS) rồi mở lại để dẫn đường.
        </p>
      ) : (
        <>
          {lost && (
            <p className="flex items-start gap-2 rounded-xl bg-[var(--warn-bg)] p-2.5 text-[0.9375rem] font-bold leading-snug text-[var(--warn)]">
              <AlertIcon className="mt-0.5 h-5 w-5 shrink-0" />
              Mất định vị — đang tìm lại. Số dưới là lần bắt được gần nhất.
            </p>
          )}

          {progress ? (
            <div className={lost ? "opacity-50" : ""}>
              {/* gợi ý lái + hướng đi */}
              <div className="flex items-center gap-2">
                {progress.steer && (
                  <span
                    className="flex shrink-0"
                    style={{ transform: `rotate(${progress.steer.turnDeg}deg)` }}
                  >
                    <NavArrowIcon className="h-6 w-6 text-t1" />
                  </span>
                )}
                <p className="display min-w-0 text-[1.25rem] font-bold leading-tight text-navy">
                  {progress.arrived
                    ? "Đã tới gần nơi"
                    : progress.steer
                      ? progress.steer.label
                      : "Đang bắt hướng đi…"}
                </p>
              </div>
              {/* một dòng: hướng · quãng còn lại · giờ chạy (thay 2 ô to cũ) */}
              <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[0.9375rem] font-semibold text-foreground/75">
                {progress.dirVN}
                <span aria-hidden>·</span>
                còn {fmtDist(progress.remainingKm, prefs.distUnit)}
                <span aria-hidden>·</span>
                <ClockIcon className="h-4 w-4 shrink-0" aria-hidden />
                {progress.etaHours != null
                  ? formatHoursVN(progress.etaHours)
                  : "tàu chưa chạy"}
              </p>

              {progress.offRoute && !progress.arrived && (
                <p className="mt-1.5 rounded-xl bg-[var(--warn-bg)] p-2 text-[0.875rem] font-bold leading-snug text-[var(--warn)]">
                  Lệch tuyến ~{fmtDist(progress.offRouteKm, prefs.distUnit)} —
                  lái về đường xanh đã vẽ.
                </p>
              )}
              {progress.arrived && (
                <p className="mt-1.5 rounded-xl bg-[var(--ok-bg)] p-2 text-[0.875rem] font-bold leading-snug text-[var(--ok)]">
                  Đã tới gần điểm đến — bấm Dừng khi neo xong.
                </p>
              )}
            </div>
          ) : (
            !lost && (
              <p className="rounded-xl bg-white/45 p-2.5 text-[0.9375rem] font-semibold text-foreground/70">
                Đang tìm vị trí tàu…
              </p>
            )
          )}
        </>
      )}

      {/* dặn dò an toàn RÚT GỌN — vẫn giữ vì app không thay máy định vị */}
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 text-[0.75rem] leading-snug text-foreground/65">
          Chỉ tham khảo — dò hải đồ, nghe đài duyên hải khi chạy.
        </p>
        <button
          type="button"
          onClick={onStop}
          className="min-h-[2.75rem] shrink-0 rounded-xl bg-navy/10 px-4 text-[0.9375rem] font-bold text-navy transition active:scale-[0.97]"
        >
          Dừng
        </button>
      </div>
    </div>
  );
}
