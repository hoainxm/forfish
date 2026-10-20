/*
  LƯỚI SỐ CHUẨN 3 CỘT của ngăn gió sóng (tách khỏi fishing-map-view 2026-10-20,
  rà Codex lần 4). Chỉ BÀY: bên gọi dựng sẵn danh sách ô (`buildSeaCells`, lib/sea-cells.ts) (nhãn ngắn + MỘT giá
  trị), ở đây lo nhịp lưới. Mỗi ô = nhãn 0.75rem + số 0.9375rem đậm, chữ số
  thẳng hàng, không kẻ vạch. `full` chiếm trọn hàng (Cá, Độ sâu, Mùa này),
  `span2` hai cột (Trăng, Trời). `tone` = class màu token (text-warn…).
*/
import type { SeaCell } from "@/lib/sea-cells";

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
