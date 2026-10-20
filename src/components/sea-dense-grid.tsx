/*
  LƯỚI SỐ CHUẨN 3 CỘT của ngăn gió sóng (tách khỏi fishing-map-view 2026-10-20,
  rà Codex lần 4). Chỉ BÀY: bên gọi dựng sẵn danh sách ô (`buildSeaCells`, lib/sea-cells.ts) (nhãn ngắn + MỘT giá
  trị), ở đây lo nhịp lưới. Mỗi ô = nhãn 0.75rem + số 0.9375rem đậm, chữ số
  thẳng hàng, không kẻ vạch. `full` chiếm trọn hàng (Cá, Độ sâu, Mùa này),
  `span2` hai cột (Trăng, Trời). `tone` = class màu token (text-warn…).
*/
import type { ReactNode } from "react";
import { AlertIcon } from "@/components/icons";
import { chipLabel } from "@/lib/day-labels";
import { formatNumberVN, beaufort } from "@/lib/marine-weather";
import { savedStampVN, type SeaCell } from "@/lib/sea-cells";

export function SeaDenseGrid({ cells }: { cells: readonly SeaCell[] }) {
  if (cells.length === 0) return null;
  return (
    <dl className="grid grid-cols-3 gap-x-3 gap-y-2.5 pt-1">
      {cells.map((c, i) => (
        <div key={i} className={`min-w-0 ${c.full ? "col-span-3" : c.span2 ? "col-span-2" : ""}`}>
          <dt className="truncate text-[0.75rem] leading-tight text-foreground/65">{c.k}</dt>
          <dd
            className={`mt-0.5 text-[0.9375rem] font-semibold leading-tight tabular-nums ${
              c.full ? "" : "truncate"
            } ${c.tone ?? "text-navy"}`}
          >
            {c.v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * NGĂN DÀY SỐ (thân ngăn gió sóng khi mở): CẢNH BÁO AN TOÀN đứng trước số, không
 * chờ "Xem đủ" — rất gần ranh giới · mưa to/dông · sóng là số ước · bản lưu —
 * rồi dải ngày, dòng khoá ngày, lưới số. Tách khỏi fishing-map-view (rà Codex
 * lần 6); component bản đồ chỉ truyền dữ liệu đã tra.
 */
export function SeaDensePanel({
  borderLabel,
  dangerWeather,
  waveEstimated,
  savedAt,
  stale,
  todayIso,
  dayChips,
  lockLine,
  cells,
}: {
  /** chỉ khi RẤT gần ranh giới */
  borderLabel: string | null;
  /** nhãn mưa to / dông (null = không nguy hiểm) */
  dangerWeather: string | null;
  waveEstimated: boolean;
  savedAt: number | null;
  stale: boolean;
  todayIso: string;
  dayChips: ReactNode;
  lockLine: ReactNode;
  cells: readonly SeaCell[];
}) {
  return (
    <div className="space-y-2">
      {borderLabel && <p className="text-[0.8125rem] font-bold leading-snug text-danger">{borderLabel}.</p>}
      {dangerWeather && (
        <p className="flex items-center gap-1.5 rounded-lg bg-danger-bg px-2 py-1.5 text-[0.8125rem] font-bold leading-snug text-danger">
          <AlertIcon className="h-4 w-4 shrink-0" />
          {dangerWeather}
        </p>
      )}
      {waveEstimated && (
        <p className="text-[0.75rem] font-semibold leading-snug text-warn">
          ~ Sóng máy ước theo gió · nghe thêm đài duyên hải
        </p>
      )}
      {stale && (
        <p className="text-[0.75rem] font-semibold leading-snug text-warn">
          Bản lưu{savedAt != null ? ` ${savedStampVN(savedAt, todayIso)}` : ""} · chưa phải số mới
        </p>
      )}
      {dayChips}
      {lockLine}
      <SeaDenseGrid cells={cells} />
    </div>
  );
}

/**
 * VIÊN TÓM TẮT dính mép phải (nội dung tay cầm mở ngăn): dòng trên = ngày đang
 * xem, hoặc "Bản lưu HH:MM" màu cảnh báo khi số từ bản lưu; dòng dưới = sóng cao
 * nhất ("~" nếu ước) · cấp gió.
 */
export function SeaTab({
  date,
  todayIso,
  waveMaxM,
  waveEstimated,
  windMaxKmh,
  savedAt,
}: {
  date: string;
  todayIso: string;
  waveMaxM: number;
  waveEstimated: boolean;
  windMaxKmh: number;
  /** có = đang xem bản lưu */
  savedAt: number | null;
}) {
  return (
    <span className="flex flex-col items-start leading-tight">
      {savedAt != null ? (
        <span className="whitespace-nowrap text-[0.75rem] font-semibold text-warn">
          Bản lưu {savedStampVN(savedAt, todayIso)}
        </span>
      ) : (
        <span className="whitespace-nowrap text-[0.75rem] text-foreground/65">{chipLabel(date, todayIso)}</span>
      )}
      <span className="whitespace-nowrap text-[0.8125rem] font-semibold text-navy">
        {waveMaxM > 0 ? `${waveEstimated ? "~" : ""}${formatNumberVN(waveMaxM)} m` : "—"} · cấp {beaufort(windMaxKmh)}
      </span>
    </span>
  );
}
