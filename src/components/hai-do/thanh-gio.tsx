"use client";

/*
  THANH TUA GIỜ của lớp gió/sóng toàn vùng — chế độ Hải đồ, bảng §8 hàng 17 (2026-11-04,
  sau đợt 4). Đối chiếu iSailor Weather (tua giờ) + OpenCPN GRIB (thanh thời gian).
  Dùng lại lưới `lib/forecast-grid` của màn cũ (cùng bản lưu offline, cùng luật gói):
  thường/khách chỉ hôm nay, gói thì 16 ngày.

  Dải nằm đáy màn (trên thước tỉ lệ), gọn một khối: dòng 1 = tên lớp + mốc đang xem +
  thanh màu cường độ; dòng 2 = các ngày cuộn ngang, mỗi ngày các nấc giờ. Đủ trạng thái:
  đang tải · lỗi (mất sóng, chưa có bản lưu) · bản lưu cũ · chỉ hôm nay (chưa có gói).
*/
import { CloseButton } from "@/components/ui/close-button";
import { NHAN } from "@/lib/labels";
import {
  groupTimesByDay,
  legendGradientCss,
  legendStops,
  legendUnit,
  scrubDayLabel,
  timeLabelVN,
  type ForecastGrid,
} from "@/lib/forecast-grid";
import { luoiDaQua } from "@/lib/hai-do/lop";

export type TrangThaiLuoi = "dang-tai" | "loi" | "ok";

export function ThanhGio({
  kind,
  grid,
  trangThai,
  idx,
  todayIso,
  nowMs,
  chiHomNay,
  onIdx,
  onTat,
}: {
  kind: "wind" | "wave";
  grid: ForecastGrid | null;
  trangThai: TrangThaiLuoi;
  idx: number;
  todayIso: string;
  nowMs: number;
  /** chưa có gói ⇒ chỉ hôm nay (nói một dòng, không giấu) */
  chiHomNay: boolean;
  onIdx: (i: number) => void;
  onTat: () => void;
}) {
  const ten = kind === "wind" ? NHAN.gio : NHAN.song;
  const stops = legendStops(kind);
  const ngay = grid ? groupTimesByDay(grid.times) : [];
  const daQua = grid ? luoiDaQua(grid.times, nowMs) : false;
  const luuLuc =
    grid?.stale && grid.savedAt
      ? new Date(grid.savedAt).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "numeric" })
      : null;
  return (
    <section
      aria-label={`Lớp ${ten.toLowerCase()} theo giờ`}
      className="pointer-events-auto absolute inset-x-2 bottom-12 z-10 rounded-2xl border border-line bg-card/95 px-3 pb-2 pt-1.5 shadow-float"
    >
      <div className="flex items-center gap-2">
        <span className="text-[0.875rem] font-semibold text-navy">{ten}</span>
        <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-foreground tabular-nums">
          {trangThai === "dang-tai" && !grid
            ? "Đang tải…"
            : trangThai === "loi" && !grid
              ? "Chưa tải được — mất sóng, máy chưa lưu bản nào"
              : grid
                ? timeLabelVN(grid.times[idx] ?? "", todayIso)
                : ""}
        </span>
        <CloseButton onClose={onTat} label={`Tắt lớp ${ten.toLowerCase()}`} />
      </div>
      {grid && (
        <>
          <div className="mt-1 flex items-center gap-2 text-[0.6875rem] text-muted tabular-nums">
            <span>{stops[0]?.value}</span>
            <span aria-hidden className="h-1.5 flex-1 rounded-full" style={{ background: legendGradientCss(kind) }} />
            <span>{`${stops[stops.length - 1]?.value} ${legendUnit(kind)}`}</span>
          </div>
          <div className="mt-1.5 flex gap-3 overflow-x-auto pb-0.5" role="group" aria-label="Chọn giờ">
            {ngay.map((d) => (
              <div key={d.iso} className="shrink-0">
                <p className="text-[0.6875rem] font-semibold text-muted">{scrubDayLabel(d.iso, todayIso)}</p>
                <div className="mt-0.5 flex gap-1">
                  {d.ticks.map((t) => (
                    <button
                      key={t.idx}
                      type="button"
                      aria-pressed={t.idx === idx}
                      aria-label={timeLabelVN(grid.times[t.idx] ?? "", todayIso)}
                      onClick={() => onIdx(t.idx)}
                      className={`h-(--h-chip) min-w-[2.5rem] rounded-full px-2 text-[0.8125rem] font-semibold tabular-nums ${
                        t.idx === idx ? "bg-sea text-card" : "bg-field text-foreground"
                      }`}
                    >
                      {`${t.hour}h`}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {daQua && (
            <p role="status" className="mt-1 rounded-lg bg-warn-bg px-2 py-1 text-[0.75rem] font-semibold text-warn">
              Bản lưu đã qua giờ — đây là gió sóng ngày cũ, có sóng sẽ tự tải lại
            </p>
          )}
          {(chiHomNay || luuLuc) && (
            <p className="mt-1 text-[0.6875rem] text-muted">
              {[luuLuc ? `Bản lưu lúc ${luuLuc}` : null, chiHomNay ? "Chỉ hôm nay — nhiều ngày đi kèm gói dự báo" : null].filter(Boolean).join(" · ")}
            </p>
          )}
        </>
      )}
    </section>
  );
}
