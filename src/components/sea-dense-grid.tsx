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
  /*  THÍCH ỨNG THEO BỀ RỘNG NGĂN, không theo màn (rà Codex lần 7): container
      query `@min-[17rem]` — ngăn rộng thì 3 cột, ngăn hẹp (máy 320 px, ngăn
      chỉ ~16,8rem) hoặc phóng chữ to (ngưỡng tính bằng rem nên phóng chữ 200%
      là ngưỡng gấp đôi) thì 2 cột. KHÔNG `truncate`: "Gió · Đông Bắc", "Dòng →
      Tây Nam" bị cắt là mất hướng — thà xuống dòng. */
  return (
    <div className="@container">
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 pt-1 @min-[17rem]:grid-cols-3">
        {cells.map((c, i) => (
          <div key={i} className={`min-w-0 ${c.full ? "col-span-full" : c.span2 ? "col-span-2" : ""}`}>
            <dt className="break-words text-[0.75rem] leading-tight text-foreground/65">{c.k}</dt>
            <dd
              className={`mt-0.5 break-words text-[0.9375rem] font-semibold leading-tight tabular-nums ${c.tone ?? "text-navy"}`}
            >
              {c.v}
            </dd>
          </div>
        ))}
      </dl>
    </div>
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
 * VIÊN TÓM TẮT dính mép phải (nội dung tay cầm mở ngăn): ngày đang xem · sóng cao
 * nhất ("~" nếu ước) · cấp gió. Số từ BẢN LƯU ⇒ thêm dòng "Bản lưu HH:MM" màu
 * cảnh báo — báo theo `stale`, không theo `savedAt` (rà Codex lần 7: có luồng
 * bản lưu mà không có giờ lưu; khi đó vẫn ghi "Bản lưu", chỉ thiếu giờ). Ngày
 * đang xem GIỮ NGUYÊN — bản lưu không có nghĩa là đang xem hôm nay.
 */
export function SeaTab({
  date,
  todayIso,
  waveMaxM,
  waveEstimated,
  windMaxKmh,
  stale,
  savedAt,
}: {
  date: string;
  todayIso: string;
  waveMaxM: number;
  waveEstimated: boolean;
  windMaxKmh: number;
  stale: boolean;
  savedAt: number | null;
}) {
  return (
    /*  Không `whitespace-nowrap` (rà Codex lần 9): phóng chữ 200% thì viên nở
        ngang tới tràn khỏi màn 320px. Trần bề ngang ~11rem, chữ dài thì xuống
        dòng — số vẫn đọc đủ, không cắt. */
    <span className="flex max-w-[11rem] flex-col items-start leading-tight">
      <span className="text-[0.75rem] text-foreground/65">{chipLabel(date, todayIso)}</span>
      <span className="text-[0.8125rem] font-semibold text-navy">
        {waveMaxM > 0 ? `${waveEstimated ? "~" : ""}${formatNumberVN(waveMaxM)} m` : "—"} · cấp {beaufort(windMaxKmh)}
      </span>
      {stale && (
        <span className="text-[0.75rem] font-semibold text-warn">
          Bản lưu{savedAt != null ? ` ${savedStampVN(savedAt, todayIso)}` : ""}
        </span>
      )}
    </span>
  );
}
