"use client";

/*
  TẤM CHẠM GOM — chế độ Hải đồ đợt 2 (2026-11-04). Đối chiếu iSailor
  `ChartInfoGenerator`: một tấm gom mọi thứ dưới ngón tay — vị trí con trỏ · độ sâu
  · triều · vật. Ở đây xếp: vật (an toàn → báo hiệu → đèn → đảo, `xepCham`) → độ
  sâu theo lưới → con nước trạm gần nhất → toạ độ + phương vị/cự ly từ tàu.
  Đóng: × chấm nhỏ góc trên phải (luật thẻ nổi 03 §6 mục 8).
*/
import { CloseButton } from "@/components/ui/close-button";

export interface DongCham {
  /** chữ đậm: tên/loại vật hoặc nhãn mục */
  tieu: string;
  /** chữ thường bên dưới */
  phu?: string;
  /** tô cảnh báo (xác tàu, đá, nông) */
  canh?: boolean;
  /** một nút việc (vd Xoá điểm đã lưu) — nhãn từ labels.ts */
  viec?: { nhan: string; lam: () => void };
}

export function TamCham({ dong, onDong }: { dong: DongCham[]; onDong: () => void }) {
  return (
    <div className="pointer-events-auto absolute inset-x-2 bottom-3 z-20 max-h-[45%] overflow-y-auto rounded-2xl border border-line bg-card p-3 shadow-float">
      <div className="absolute right-2 top-2">
        <CloseButton onClose={onDong} label="Đóng thông tin điểm" />
      </div>
      <ul className="flex flex-col gap-2 pr-8">
        {dong.map((d, k) => (
          <li key={k}>
            <p className={`text-[0.9375rem] font-semibold ${d.canh ? "text-danger" : "text-navy"}`}>{d.tieu}</p>
            {d.phu && <p className="text-[0.8125rem] text-muted">{d.phu}</p>}
            {d.viec && (
              <button type="button" onClick={d.viec.lam} className="sq-btn mt-1.5 bg-field text-foreground">
                {d.viec.nhan}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
