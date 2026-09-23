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
import type { HudLine } from "@/lib/nav-context";
import { useMapPrefs, fmtDist } from "@/lib/map-prefs";
import {
  AlertIcon,
  AnchorIcon,
  ChevronRightIcon,
  ClockIcon,
  MinusIcon,
  NavArrowIcon,
  RouteIcon,
} from "@/components/icons";

/** Ảnh dấu tàu — sinh từ `Workops/assets/sdfish/sdfish-fishing-vessel-map-marker.png`
    (653 KB → 5,5 KB) bằng `sharp`: trim viền trong suốt rồi hạ còn 72×100 (+ bản
    @2x cho màn retina). Đã ghim vào CRITICAL_SHELL của service worker: thiếu nó
    thì giữa biển mất sóng, bà con không thấy tàu mình đâu. */
const BOAT_MARKER_SRC = "/icons/boat-marker.png";

/**
 * VỊ TRÍ TÀU trên bản đồ (đặt trong <MapGL>) — **ẢNH GHIM TÀU CÁ** do chủ dự án
 * cấp (2026-08-25l), đặt trên quầng nhấp nháy.
 *
 * ⚠️ ẢNH LÀ CÁI GHIM (mũi nhọn chỉ xuống), KHÔNG phải hình tàu nhìn từ trên.
 * Ba hệ quả bắt buộc, đừng sửa lẻ một cái:
 *  1. `anchor="bottom"` — MŨI GHIM mới là toạ độ thật, không phải tâm ảnh.
 *  2. **KHÔNG xoay theo `headingDeg`.** Ghim mà xoay là nằm nghiêng/chổng ngược,
 *     và mũi ghim rời khỏi chỗ nó đang chỉ. Nghĩa là bản này KHÔNG còn chỉ hướng
 *     tàu đang chạy — mất một thông tin so với hình tàu-nhìn-từ-trên trước đó.
 *  3. Quầng nhấp nháy phải neo vào MŨI GHIM (`-bottom` + `left-1/2`), không neo
 *     giữa ảnh — neo sai là vòng nháy lệch lên nửa thân ghim.
 */
export function NavBoatMarker({
  pos,
  headingDeg,
  stale,
}: {
  pos: LatLon | null;
  /*  CÒN TRONG PROPS nhưng KHÔNG DÙNG: ảnh ghim không xoay được (xem trên).
      Giữ lại để nơi gọi không phải sửa và để lần sau ai muốn thêm mũi tên chỉ
      hướng thì đã có sẵn số. */
  headingDeg?: number | null;
  /** mất định vị → làm mờ + TẮT nhấp nháy: số cũ thì đừng giả vờ đang sống */
  stale?: boolean;
}) {
  if (!pos) return null;
  return (
    <Marker longitude={pos.lon} latitude={pos.lat} anchor="bottom">
      <span
        className={`relative flex flex-col items-center transition-opacity ${
          stale ? "opacity-45" : "opacity-100"
        }`}
      >
        {!stale && (
          <span
            className="pointer-events-none absolute -bottom-[1.3125rem] left-1/2 h-[2.625rem] w-[2.625rem] -translate-x-1/2 animate-ping rounded-full bg-t1/55"
            aria-hidden
          />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={BOAT_MARKER_SRC}
          srcSet={`${BOAT_MARKER_SRC} 1x, /icons/boat-marker@2x.png 2x`}
          alt=""
          aria-hidden
          className="relative h-[3rem] w-auto drop-shadow-pin"
        />
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

/**
 * Lệch tuyến — cha (fishing-map-view) tính mốc từ lib/nav-progress, HUD chỉ vẽ.
 * KHÁC ranh giới ở hai chỗ, cố ý: (1) màu VÀNG, không bao giờ đỏ — đỏ giữ riêng
 * cho ranh giới IUU; (2) LUÔN thu được, kể cả lệch rất xa — lái khác đường đã
 * vẽ là quyền của thuyền trưởng (né tàu bạn, thả lưới, đổi ý), app là người
 * phụ việc chứ không phải người chấm đúng-sai (09-ba-spec §5c).
 */
export type NavOffRouteNotice = {
  /** mốc đang ở (km — 2/5/10/20) */
  step: number;
  km: number;
  /** bà con đã chạm thu dòng này */
  dismissed: boolean;
};

/*  Mảng rỗng DÙNG CHUNG làm mặc định: `hazardLines = []` viết thẳng trong
    tham số sẽ tạo mảng MỚI mỗi lần vẽ — mà HUD vẽ lại theo nhịp GPS. */
const EMPTY_LINES: HudLine[] = [];

/** Nền + chữ cho từng mức cảnh báo — token màu, không hex (design-system §màu). */
const MUC_TONE: Record<HudLine["muc"], string> = {
  do: "bg-danger-bg text-danger",
  vang: "bg-warn-bg text-warn",
  // dòng TIN (phao, đèn) không phải cảnh báo: nền kính nhạt như ô "đang tìm vị trí"
  tin: "bg-white/45 text-navy",
};

export function NavHud({
  progress,
  status,
  onStop,
  border,
  onDismissBorder,
  offRoute,
  onDismissOffRoute,
  nextStop = null,
  hazardLines = EMPTY_LINES,
  rungOn = true,
  onToggleRung,
  onShelter,
}: {
  progress: NavProgress | null;
  status: NavStatus;
  onStop: () => void;
  border?: NavBorderNotice | null;
  onDismissBorder?: () => void;
  offRoute?: NavOffRouteNotice | null;
  onDismissOffRoute?: () => void;
  /*  CẢNH BÁO HIỂM HOẠ khi đang chạy (Đợt 3) — cha tính ở `lib/nav-hazards`
      rồi chọn dòng ở `lib/pickHudLines`; HUD chỉ VẼ, không xếp lại thứ tự,
      không tự viết câu. Tối đa 2 dòng: dòng `khoa` (đỏ) không thu được và
      hiện cả khi HUD đã thu thành chip — cùng luật với ranh giới ≤6 hải lý. */
  hazardLines?: HudLine[];
  /** cờ rung của bà con (`forfish.nav.rung.v1`) — cha giữ, HUD chỉ bật/tắt */
  rungOn?: boolean;
  onToggleRung?: () => void;
  /*  CHỖ TRÚ BÃO — cha chỉ truyền hàm này khi ĐANG CÓ BÃO (`stormInfo.kind ===
      "co-bao"`) và kho khu trú đã nạp. Không có bão thì không có nút: nút trú
      bão nằm sẵn quanh năm là dạy mắt bỏ qua nó đúng hôm cần. */
  onShelter?: () => void;
  /*  CHỖ GHÉ KẾ TIẾP — chỉ có khi đường đi qua NHIỀU chỗ (chủ dự án
      2026-08-29g: *"rồi hiện thời gian và khoảng cách tới điểm tiếp theo"*).
      Đường đi một chỗ thì dòng "còn X · Y giờ" sẵn có ĐÃ nói đúng thứ này —
      thêm một dòng nữa là lặp. */
  nextStop?: { so: number; km: number; hours: number | null } | null;
}) {
  const prefs = useMapPrefs();
  /*  Thu từng dòng cảnh báo (chỉ dòng KHÔNG khoá). Nhớ theo `id` chứ không
      theo vị trí: `nav-hazards` chỉ nói mỗi vật tối đa 2 lần, nên thu một lần
      là thu đúng cái vật đó — vật khác tới vẫn nói. */
  const [thuIds, setThuIds] = useState<string[]>([]);
  const lines = hazardLines.filter((l) => l.khoa || !thuIds.includes(l.id));
  const linesKhoa = lines.filter((l) => l.khoa);
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
        {/*  HIỂM HOẠ MỨC ĐỎ cũng theo luật đó: xác tàu/bãi cạn/vùng cấm ngay
             trước mũi là chuyện tính mạng, thu HUD thành chip không được làm
             nó biến mất. Dòng vàng/tin thì nhường — mở HUD ra là thấy. */}
        {linesKhoa.map((l) => (
          <p
            key={l.id}
            role="alert"
            className="pointer-events-auto flex items-center gap-2 rounded-xl bg-danger-bg px-3 py-2 text-[0.9375rem] font-bold leading-snug text-danger shadow-md"
          >
            <AlertIcon className="h-5 w-5 shrink-0" />
            {l.cau}
          </p>
        ))}
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
        {/*  TẮT/BẬT RUNG — nhỏ nhưng phải bấm được bằng ngón cái ướt: 44 px
             (2.75rem) như nút ẩn bên cạnh. Chữ chứ không chỉ hình: bà con
             không đoán được biểu tượng rung, mà bấm nhầm là mất kênh cảnh báo
             duy nhất còn tới được khi máy trong túi áo mưa. */}
        {onToggleRung && (
          <button
            type="button"
            onClick={onToggleRung}
            aria-pressed={rungOn}
            aria-label={rungOn ? "Tắt rung khi có cảnh báo" : "Bật rung khi có cảnh báo"}
            className={`min-h-[2.75rem] shrink-0 rounded-xl px-3 text-[0.875rem] font-bold transition active:scale-95 ${
              rungOn ? "bg-t1/15 text-t1" : "bg-navy/10 text-navy/60"
            }`}
          >
            {rungOn ? "Rung: bật" : "Rung: tắt"}
          </button>
        )}
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

      {/*  HIỂM HOẠ TRÊN ĐƯỜNG (Đợt 3) — dưới ranh giới, trên mọi thứ khác.
           Thứ tự do `lib/nav-hazards` quyết (nặng nhất trước), HUD KHÔNG xếp
           lại. Đỏ: không thu được. Vàng/tin: chạm để thu, thu theo id nên vật
           khác tới vẫn nói. */}
      {lines.map((l) =>
        l.khoa ? (
          <p
            key={l.id}
            role="alert"
            className={`flex min-h-[2.75rem] items-center gap-2 rounded-xl px-2.5 py-2 text-[0.9375rem] font-bold leading-snug ${MUC_TONE.do}`}
          >
            <AlertIcon className="h-5 w-5 shrink-0" />
            <span className="min-w-0 flex-1">{l.cau}</span>
          </p>
        ) : (
          <button
            key={l.id}
            type="button"
            role={l.muc === "vang" ? "alert" : "status"}
            onClick={() => setThuIds((ids) => [...ids.slice(-7), l.id])}
            aria-label="Thu dòng này"
            className={`flex min-h-[2.75rem] w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[0.9375rem] font-bold leading-snug ${MUC_TONE[l.muc]}`}
          >
            {l.muc === "vang" && <AlertIcon className="h-5 w-5 shrink-0" />}
            <span className="min-w-0 flex-1">{l.cau}</span>
            <MinusIcon className="h-4 w-4 shrink-0" />
          </button>
        ),
      )}

      {/*  KHU TRÚ BÃO GẦN — CHỈ hiện khi đang có bão. App không phán "chạy vào
           đi": chỉ mở danh sách khu, còn bao xa, chừng bao lâu; vào hay không
           là quyết định của thuyền trưởng. */}
      {onShelter && (
        <button
          type="button"
          onClick={onShelter}
          className="flex min-h-[3.5rem] w-full items-center gap-2 rounded-xl bg-warn-bg px-2.5 py-2 text-left text-[1rem] font-bold leading-snug text-warn"
        >
          <AnchorIcon className="h-5 w-5 shrink-0" />
          <span className="min-w-0 flex-1">Khu trú bão gần</span>
          <ChevronRightIcon className="h-5 w-5 shrink-0" />
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

              {/*  CHỖ GHÉ KẾ TIẾP — dòng riêng, ĐẶT TRÊN dòng tổng vì đó mới là
                   thứ đang phải lái tới. Dòng trên nói tới ĐÍCH CUỐI: đi 3 chỗ
                   mà chỉ thấy "còn 491 hải lý" thì bà con không biết bao giờ
                   tới chỗ thả lưới đầu tiên.
                   Chỉ hiện khi đường đi nhiều chỗ VÀ chưa qua hết (`nextStop`
                   null ở hai ca đó) — không đẻ dòng thừa cho chuyến một chỗ. */}
              {nextStop && !progress.arrived && (
                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[0.9375rem] font-bold text-t1">
                  Tới chỗ {nextStop.so}
                  <span aria-hidden>·</span>
                  {fmtDist(nextStop.km, prefs.distUnit)}
                  {nextStop.hours != null && (
                    <>
                      <span aria-hidden>·</span>
                      <ClockIcon className="h-4 w-4 shrink-0" aria-hidden />
                      {formatHoursVN(nextStop.hours)}
                    </>
                  )}
                </p>
              )}

              {/* LỆCH TUYẾN — chỉ nói khi cha bảo (vượt sang mốc xa hơn), thu
                  được, giọng trung tính. Trước đây dòng này in lại MỖI NHỊP GPS
                  suốt thời gian còn lệch và không thu được. */}
              {offRoute && !offRoute.dismissed && !progress.arrived && (
                <button
                  type="button"
                  onClick={onDismissOffRoute}
                  aria-label="Thu dòng nhắc lệch tuyến"
                  className="mt-1.5 flex min-h-[2.75rem] w-full items-center gap-2 rounded-xl bg-[var(--warn-bg)] px-2.5 py-2 text-left text-[0.875rem] font-bold leading-snug text-[var(--warn)]"
                >
                  <span className="min-w-0 flex-1">
                    Đang đi khác đường đã vẽ ~
                    {fmtDist(offRoute.km, prefs.distUnit)} — lái về vạch xanh
                    nếu muốn.
                  </span>
                  <MinusIcon className="h-4 w-4 shrink-0" />
                </button>
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
