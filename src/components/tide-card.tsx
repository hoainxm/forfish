"use client";

/*
  THẺ CON NƯỚC — một thẻ dùng chung cho bốn chỗ (2026-09-04, chủ dự án chốt):
    · sheet chạm điểm trên bản đồ Ra khơi (dưới dòng "Dòng chảy")
    · thẻ cảng nhà ở Trang chủ (chạm → xem các ngày khác)
    · sheet chạm TRẠM trên bản đồ (lớp trạm mặc định bật, tắt được)
    · màn nhiều ngày (đường nước + hai con nước + tuần trăng)

  Câu chữ và luật im lặng nằm ở `lib/tides.ts` (`tideCardAt`) — ở đây chỉ bày.
  Không có chữ nào phán "đi được / không đi được" (03-design-system, user chốt
  2026-06-10). Mọi số tính TRONG MÁY từ file trạm đã nằm trong CRITICAL_SHELL —
  mất sóng nhiều ngày vẫn ra đúng con nước.
*/

import { useEffect, useMemo, useRef, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { SQ_BTN } from "@/components/ui/sq-btn";
import { ChevronRightIcon, ClockIcon, CloseIcon, MoonIcon, WavesIcon } from "@/components/icons";
import { chipLabel } from "@/lib/day-labels";
import { moonPhase } from "@/lib/moon";
import {
  tideCardAt,
  tideDaySeries,
  tideExtremesForDay,
  tideExtremeText,
  tideHeightText,
  tideMoonText,
  tideRangeText,
  tideTrendText,
  tideTrustText,
  tideUpcomingText,
  vnIsoDate,
  VN_OFFSET_MS,
  type TideStation,
  type TideTrend,
} from "@/lib/tides";

/**
 * Số ngày bày trong màn nhiều ngày — TRỌN một chu kỳ trăng (chủ dự án
 * 2026-09-04: "không xem được các ngày khác trong tháng à?"): bà con tính
 * chuyến theo con nước rong/kém của cả tháng, không phải theo tuần.
 */
export const TIDE_DAYS = 30;

function TrendChip({ trend }: { trend: TideTrend }) {
  const mau =
    trend === "len" ? "bg-t1-bg text-t1" : trend === "xuong" ? "bg-warn-bg text-warn" : "bg-field text-foreground/70";
  return (
    <span className={`inline-flex min-h-[2rem] items-center rounded-full px-3 text-[0.875rem] font-bold ${mau}`}>
      {tideTrendText(trend)}
    </span>
  );
}

/**
 * Thẻ 3 dòng: lúc này · hai con nước kế · tuần trăng + cường/kém. Trạm xa
 * (>120 km) chỉ còn dòng lên/xuống. Không có trạm → không vẽ gì.
 */
export function TideCard({
  stations,
  lat,
  lon,
  nowMs,
  dayIso,
  onMore,
}: {
  stations: readonly TideStation[] | null | undefined;
  lat: number;
  lon: number;
  nowMs: number;
  /**
   * Có = bày CON NƯỚC CỦA NGÀY ĐÓ (sheet điểm đang xem ngày mai/kia): không
   * "lúc này", không chip lên/xuống — hai thứ đó chỉ có nghĩa với hôm nay.
   */
  dayIso?: string;
  /** có = hiện nút "Xem các ngày khác" */
  onMore?: (station: TideStation, distanceKm: number) => void;
}) {
  const card = useMemo(
    () => (stations && stations.length ? tideCardAt(stations, lat, lon, nowMs) : null),
    [stations, lat, lon, nowMs],
  );
  const ngayKhac = dayIso && dayIso !== vnIsoDate(nowMs) ? dayIso : null;
  if (!card) return null;
  const { station, distanceKm } = card;
  // ngày khác: các con nước của ngày đó + trăng đêm đó (trưa ngày đó, giờ VN)
  const truaNgayKhac = ngayKhac ? Date.parse(`${ngayKhac}T12:00:00Z`) - VN_OFFSET_MS : null;
  const cuaNgayKhac = ngayKhac && !card.far ? tideExtremesForDay(station, ngayKhac) : [];
  const rangeNgayKhac =
    ngayKhac && truaNgayKhac != null && !card.far
      ? (() => {
          const r = tideRangeText(station, ngayKhac);
          const m = tideMoonText(truaNgayKhac);
          return r ? `${m} · ${r}` : m;
        })()
      : null;
  return (
    <div className="surface p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-t1">
          <WavesIcon className="h-5 w-5 shrink-0" />
          <span className="truncate text-[0.9375rem] font-bold leading-snug">
            Con nước · trạm {station.name}
          </span>
        </div>
        {!ngayKhac && <TrendChip trend={card.trend} />}
      </div>

      {card.far ? (
        <p className="mt-2 text-[0.9375rem] font-semibold leading-snug text-foreground/75">
          Trạm gần nhất cách {Math.round(distanceKm)} km — chỉ xem được nước đang
          lên hay xuống, không có giờ cho cửa này.
        </p>
      ) : ngayKhac ? (
        <ul className="mt-2 space-y-1.5">
          {cuaNgayKhac.length === 0 ? (
            <li className="text-[1rem] font-semibold leading-snug text-foreground/75">
              Hôm đó nước gần như đứng cả ngày — không có con nước rõ.
            </li>
          ) : (
            cuaNgayKhac.map((e) => (
              <li
                key={e.atMs}
                className="flex items-center gap-2 text-[1rem] font-semibold leading-snug text-foreground/85"
              >
                <WavesIcon className={`h-5 w-5 shrink-0 ${e.kind === "high" ? "text-t1" : "text-warn"}`} />
                <span>{tideExtremeText(e)}</span>
              </li>
            ))
          )}
          {rangeNgayKhac && (
            <li className="flex items-center gap-2 text-[0.9375rem] font-semibold leading-snug text-foreground/75">
              <MoonIcon className="h-5 w-5 shrink-0 text-foreground/55" />
              <span>{rangeNgayKhac}</span>
            </li>
          )}
        </ul>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {card.nowM != null && (
            <li className="flex items-center gap-2 text-[1rem] font-bold leading-snug text-navy">
              <ClockIcon className="h-5 w-5 shrink-0 text-foreground/55" />
              <span>Lúc này {tideHeightText(card.nowM)}</span>
            </li>
          )}
          {card.upcoming.map((u) => (
            <li
              key={u.atMs}
              className="flex items-center gap-2 text-[1rem] font-semibold leading-snug text-foreground/85"
            >
              <WavesIcon
                className={`h-5 w-5 shrink-0 ${u.kind === "high" ? "text-t1" : "text-warn"}`}
              />
              <span>{tideUpcomingText(u)}</span>
            </li>
          ))}
          {card.moonRange && (
            <li className="flex items-center gap-2 text-[0.9375rem] font-semibold leading-snug text-foreground/75">
              <MoonIcon className="h-5 w-5 shrink-0 text-foreground/55" />
              <span>{card.moonRange}</span>
            </li>
          )}
        </ul>
      )}

      {card.trust && (
        <p className="mt-2 text-[0.8125rem] font-semibold leading-snug text-foreground/60">
          {card.trust}
        </p>
      )}

      {onMore && !card.far && (
        <button
          type="button"
          onClick={() => onMore(station, distanceKm)}
          className="mt-3 flex min-h-[3.5rem] w-full items-center justify-between rounded-2xl bg-field px-4 text-[1rem] font-bold text-navy transition active:scale-[0.98]"
        >
          <span>Xem các ngày khác</span>
          <ChevronRightIcon className="h-5 w-5 shrink-0" />
        </button>
      )}
    </div>
  );
}

/* ── ĐƯỜNG NƯỚC MỘT NGÀY ──────────────────────────────────────────────────── */

const W = 320;
const H = 132;
const PAD_L = 30;
const PAD_R = 8;
const PAD_T = 18;
const PAD_B = 18;

function TideCurve({
  station,
  isoDate,
  loM,
  hiM,
  nowMs,
}: {
  station: TideStation;
  isoDate: string;
  loM: number;
  hiM: number;
  /** có = vẽ vạch "bây giờ" (chỉ truyền khi đúng ngày hôm nay) */
  nowMs: number | null;
}) {
  const series = tideDaySeries(station, isoDate, 30);
  const extremes = tideExtremesForDay(station, isoDate);
  if (series.length < 2) return null;
  const pw = W - PAD_L - PAD_R;
  const ph = H - PAD_T - PAD_B;
  const X = (min: number) => PAD_L + (min / 1440) * pw;
  const Y = (v: number) => PAD_T + ((hiM - v) / (hiM - loM || 1)) * ph;
  const dayStart = Date.parse(`${isoDate}T00:00:00Z`) - VN_OFFSET_MS;
  const path = series.map((v, i) => `${i ? "L" : "M"}${X(i * 30).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
  const area = `${path} L${X(1440).toFixed(1)},${(PAD_T + ph).toFixed(1)} L${X(0).toFixed(1)},${(PAD_T + ph).toFixed(1)} Z`;
  const nowMin = nowMs != null ? (nowMs - dayStart) / 60000 : null;
  const gio = (min: number) => {
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return `${h}:${String(m).padStart(2, "0")}`;
  };
  const meters: number[] = [];
  for (let v = Math.ceil(loM); v <= Math.floor(hiM); v++) meters.push(v);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-auto w-full"
      role="img"
      aria-label={`Biểu đồ nước ngày ${isoDate} tại trạm ${station.name}`}
    >
      {/* đêm: 0h–5h30 và 18h–24h tô nền mờ để đọc "nước lớn ban đêm" ngay */}
      <rect x={X(0)} y={PAD_T} width={X(330) - X(0)} height={ph} className="fill-field" />
      <rect x={X(1080)} y={PAD_T} width={X(1440) - X(1080)} height={ph} className="fill-field" />
      {meters.map((v) => (
        <g key={v}>
          <line x1={PAD_L} x2={W - PAD_R} y1={Y(v)} y2={Y(v)} className="stroke-line" strokeWidth={1} />
          <text x={PAD_L - 4} y={Y(v) + 4} textAnchor="end" className="fill-foreground/60" fontSize={10}>
            {v} m
          </text>
        </g>
      ))}
      {[0, 6, 12, 18, 24].map((h) => (
        <text key={h} x={X(h * 60)} y={H - 5} textAnchor="middle" className="fill-foreground/60" fontSize={10}>
          {h}h
        </text>
      ))}
      <path d={area} className="fill-t1/15" />
      <path d={path} className="stroke-t1" fill="none" strokeWidth={2.5} strokeLinejoin="round" />
      {nowMin != null && nowMin >= 0 && nowMin <= 1440 && (
        <g>
          <line
            x1={X(nowMin)}
            x2={X(nowMin)}
            y1={PAD_T}
            y2={PAD_T + ph}
            className="stroke-danger"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
          <text x={X(nowMin)} y={PAD_T - 6} textAnchor="middle" className="fill-danger" fontSize={10} fontWeight={700}>
            bây giờ
          </text>
        </g>
      )}
      {extremes.map((e) => {
        const min = (e.atMs - dayStart) / 60000;
        const x = X(min);
        const anchor = x < PAD_L + 30 ? "start" : x > W - PAD_R - 30 ? "end" : "middle";
        return (
          <g key={e.atMs}>
            <circle cx={x} cy={Y(e.heightM)} r={4} className={e.kind === "high" ? "fill-t1" : "fill-warn"} />
            <text
              x={x}
              y={e.kind === "high" ? Y(e.heightM) - 8 : Y(e.heightM) + 16}
              textAnchor={anchor}
              className="fill-navy"
              fontSize={11}
              fontWeight={700}
            >
              {tideHeightText(e.heightM)} · {gio(min)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── DẢI CẢ THÁNG ─────────────────────────────────────────────────────────── */

const SW = 320;
const SH = 96;
const S_TOP = 6;
const S_BOT = 22;

function TideMonthStrip({
  thang,
  days,
  sel,
  onSel,
}: {
  thang: { bienDo: number[]; cuong: boolean[]; trang: ("ram" | "non" | null)[]; max: number };
  days: string[];
  sel: number;
  onSel: (i: number) => void;
}) {
  const n = days.length;
  const colW = SW / n;
  const ph = SH - S_TOP - S_BOT;
  const chon = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (r.width <= 0) return;
    const i = Math.floor(((e.clientX - r.left) / r.width) * n);
    onSel(Math.max(0, Math.min(n - 1, i)));
  };
  return (
    <div
      role="group"
      aria-label="Dự báo con nước 30 ngày — chạm để chọn ngày"
      onClick={chon}
      className="mt-2 min-h-[3.5rem] cursor-pointer select-none"
    >
      <svg viewBox={`0 0 ${SW} ${SH}`} className="block h-auto w-full" aria-hidden>
        {days.map((d, i) => {
          const h = Math.max(3, (thang.bienDo[i] / thang.max) * ph);
          const x = i * colW + 1;
          const y = S_TOP + ph - h;
          const daySo = Number(d.slice(8, 10));
          return (
            <g key={d}>
              <rect
                x={x}
                y={y}
                width={colW - 2}
                height={h}
                rx={1.5}
                className={thang.cuong[i] ? "fill-navy" : "fill-t1/45"}
              />
              {i === sel && (
                <rect
                  x={x - 1}
                  y={S_TOP - 2}
                  width={colW}
                  height={ph + 4}
                  rx={2}
                  className="fill-none stroke-danger"
                  strokeWidth={1.5}
                />
              )}
              {thang.trang[i] === "ram" && (
                <circle cx={x + (colW - 2) / 2} cy={SH - 14} r={3} className="fill-navy" />
              )}
              {thang.trang[i] === "non" && (
                <circle
                  cx={x + (colW - 2) / 2}
                  cy={SH - 14}
                  r={3}
                  className="fill-none stroke-navy"
                  strokeWidth={1.2}
                />
              )}
              {(i === 0 || daySo % 5 === 0) && !thang.trang[i] && (
                <text
                  x={x + (colW - 2) / 2}
                  y={SH - 11}
                  textAnchor="middle"
                  className="fill-foreground/60"
                  fontSize={8.5}
                >
                  {daySo}
                </text>
              )}
              <text
                x={x + (colW - 2) / 2}
                y={SH - 1}
                textAnchor="middle"
                className="fill-foreground/60"
                fontSize={7}
              >
                {(i === 0 || daySo === 1) ? `${daySo}/${Number(d.slice(5, 7))}` : ""}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 text-[0.8125rem] font-semibold text-foreground/60">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-navy" aria-hidden /> nước rong
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-t1/45" aria-hidden /> thường / kém
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-navy" aria-hidden /> rằm
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full border-2 border-navy" aria-hidden /> mùng 1
        </span>
      </p>
    </div>
  );
}

/* ── MÀN NHIỀU NGÀY ───────────────────────────────────────────────────────── */

/**
 * Bảy ngày kể từ hôm nay: chọn ngày → đường nước + từng con nước + tuần trăng.
 * Dùng trong sheet chạm trạm và sheet cảng nhà.
 */
export function TideDaysView({
  station,
  distanceKm,
  nowMs,
}: {
  station: TideStation;
  distanceKm: number;
  nowMs: number;
}) {
  const todayIso = vnIsoDate(nowMs);
  const days = useMemo(
    () => Array.from({ length: TIDE_DAYS }, (_, i) => vnIsoDate(nowMs + i * 86400000)),
    [nowMs],
  );
  const [sel, setSel] = useState(0);
  const iso = days[sel] ?? todayIso;
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // chọn ngày từ dải tháng thì hàng chip phải cuộn tới chip đó — không thì
  // dải nói một ngày, hàng chip đang bày ngày khác
  useEffect(() => {
    chipRefs.current[sel]?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [sel]);
  /*  Cả tháng tính MỘT lần: biên độ từng ngày (cho dải), trục mét cố định (đổi
      ngày mà trục nhảy là mắt đọc sai cường/kém), ngày cường, rằm / mùng 1.
      30 ngày × 25 mẫu giờ + 30 lượt tìm đỉnh — vài ms trên máy cũ. */
  const thang = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    const bienDo: number[] = [];
    const cuong: boolean[] = [];
    for (const d of days) {
      let dlo = Infinity;
      let dhi = -Infinity;
      for (const v of tideDaySeries(station, d, 60)) {
        if (v < dlo) dlo = v;
        if (v > dhi) dhi = v;
      }
      if (dlo < lo) lo = dlo;
      if (dhi > hi) hi = dhi;
      bienDo.push(Number.isFinite(dhi - dlo) ? dhi - dlo : 0);
      cuong.push(/cường/.test(tideRangeText(station, d) ?? ""));
    }
    // rằm = pha trăng vượt 0,5 trong ngày; mùng 1 = pha quay về 0 (trăng non)
    const frac = days.map((d) => moonPhase(new Date(Date.parse(`${d}T12:00:00Z`) - VN_OFFSET_MS)).frac);
    const trang: ("ram" | "non" | null)[] = frac.map((f, i) => {
      if (i === 0) return null;
      const p = frac[i - 1];
      if (p < 0.5 && f >= 0.5) return "ram";
      if (f < p) return "non";
      return null;
    });
    const truc: [number, number] =
      Number.isFinite(lo) && Number.isFinite(hi)
        ? [Math.floor(lo * 2) / 2 - 0.25, Math.ceil(hi * 2) / 2 + 0.25]
        : [0, 4];
    return { bienDo, cuong, trang, truc, max: Math.max(0.1, ...bienDo) };
  }, [station, days]);
  const [loM, hiM] = thang.truc;
  const extremes = tideExtremesForDay(station, iso);
  const range = tideRangeText(station, iso);
  const moon = tideMoonText(Date.parse(`${iso}T12:00:00Z`) - VN_OFFSET_MS);
  const trust = tideTrustText(distanceKm, station);
  const isToday = iso === todayIso;

  return (
    <div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
        {days.map((d, i) => (
          <button
            key={d}
            ref={(el) => {
              chipRefs.current[i] = el;
            }}
            type="button"
            onClick={() => setSel(i)}
            aria-pressed={i === sel}
            className={`min-h-[3.5rem] shrink-0 rounded-2xl px-3 text-[0.9375rem] font-bold leading-tight transition active:scale-95 ${
              i === sel ? "bg-navy text-white" : "bg-field text-navy"
            }`}
          >
            {chipLabel(d, todayIso)}
          </button>
        ))}
      </div>

      <div className="surface mt-3 p-3">
        <TideCurve station={station} isoDate={iso} loM={loM} hiM={hiM} nowMs={isToday ? nowMs : null} />
      </div>

      {/*  CẢ CHU KỲ — 30 cột, cột cao = nước lên xuống mạnh (rong/cường), cột
           thấp = nước kém; rằm ● và mùng 1 ○ đánh dấu dưới cột. Chạm vào dải
           chọn ngày gần ngón tay nhất (cả dải là một vùng chạm 56 px — 30 cột
           riêng lẻ chỉ 11 px, không đủ chạm); chip ở trên tự cuộn tới ngày đó. */}
      <div className="surface mt-3 p-3">
        <p className="text-[0.9375rem] font-bold leading-snug text-navy">Cả chu kỳ · 30 ngày tới</p>
        <p className="mt-0.5 text-[0.8125rem] font-semibold leading-snug text-foreground/60">
          Cột cao là nước rong (lên xuống mạnh), cột thấp là nước kém. Chạm cột để xem ngày đó.
        </p>
        <TideMonthStrip thang={thang} days={days} sel={sel} onSel={setSel} />
      </div>

      <ul className="mt-3 space-y-1.5">
        {extremes.length === 0 ? (
          <li className="text-[1rem] font-semibold leading-snug text-foreground/75">
            Hôm đó nước gần như đứng cả ngày — không có con nước rõ.
          </li>
        ) : (
          extremes.map((e) => (
            <li
              key={e.atMs}
              className="flex items-center gap-2 text-[1rem] font-semibold leading-snug text-foreground/85"
            >
              <WavesIcon className={`h-5 w-5 shrink-0 ${e.kind === "high" ? "text-t1" : "text-warn"}`} />
              <span>{tideExtremeText(e)}</span>
            </li>
          ))
        )}
        <li className="flex items-center gap-2 text-[0.9375rem] font-semibold leading-snug text-foreground/75">
          <MoonIcon className="h-5 w-5 shrink-0 text-foreground/55" />
          <span>{range ? `${moon} · ${range}` : moon}</span>
        </li>
      </ul>

      <p className="mt-3 text-[0.8125rem] font-semibold leading-snug text-foreground/60">
        {trust ? `${trust} ` : ""}
        Số 0 hải đồ tại trạm {station.name}. Tham khảo — không thay bảng thuỷ
        triều chính thức.
      </p>
    </div>
  );
}

/** Sheet chạm trạm trên bản đồ / chạm thẻ cảng nhà. */
export function TideStationSheet({
  station,
  distanceKm,
  nowMs,
  title,
  onClose,
}: {
  station: TideStation;
  distanceKm: number;
  nowMs: number;
  title?: string;
  onClose: () => void;
}) {
  return (
    <BottomSheet title={title ?? `Con nước · trạm ${station.name}`} onClose={onClose}>
      <TideDaysView station={station} distanceKm={distanceKm} nowMs={nowMs} />
      <div className="mt-4 flex justify-end">
        <button type="button" onClick={onClose} className={`${SQ_BTN} bg-card text-t1`}>
          <CloseIcon className="h-6 w-6" />
          Đóng
        </button>
      </div>
    </BottomSheet>
  );
}
