"use client";

/*
  KHAY LỚP của chế độ Hải đồ — đợt 3 (2026-11-04). Đối chiếu OpenCPN "Display
  Category" (Base · Standard · All) + bật/tắt nhóm; iSailor ChartOptions (All ·
  Custom · Simplified). Ở đây: Mức hiển thị 3 nấc + 4 công tắc + Gió/Sóng toàn vùng (sau đợt 4, một lúc một lớp). Xác tàu, đèn biển,
  đường an toàn KHÔNG có công tắc (an toàn — `nhomTheoMuc`).
*/
import { NHAN } from "@/lib/labels";
import { MUC_HIEN_THI, NHAN_MUC } from "@/lib/hai-do/lop";
import { setHaiDoPrefs, type HaiDoPrefs } from "@/lib/hai-do/prefs";
import { Chip } from "@/components/hai-do/ui";

export function KhayLop({ prefs, coAis }: { prefs: HaiDoPrefs; coAis: boolean }) {
  return (
    <div>
      <h3 className="text-[0.875rem] font-semibold text-navy">Mức hiển thị</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {MUC_HIEN_THI.map((m) => (
          <Chip key={m} on={prefs.hienThi === m} onClick={() => setHaiDoPrefs({ hienThi: m })}>
            {NHAN_MUC[m]}
          </Chip>
        ))}
      </div>
      <p className="mt-1 text-[0.75rem] text-muted">
        {prefs.hienThi === "co-ban"
          ? "Bờ, đảo, độ sâu, đèn biển, xác tàu"
          : prefs.hienThi === "chuan"
            ? "Thêm phao, tiêu, cáp, ống, giàn khoan, vùng cấm"
            : "Thêm luồng, phân luồng tàu"}
      </p>
      <h3 className="mt-3 text-[0.875rem] font-semibold text-navy">Lớp</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        <Chip on={prefs.toNong} onClick={() => setHaiDoPrefs({ toNong: !prefs.toNong })}>
          {NHAN.toNong}
        </Chip>
        <Chip on={prefs.lopTrieu} onClick={() => setHaiDoPrefs({ lopTrieu: !prefs.lopTrieu })}>
          {NHAN.conNuoc}
        </Chip>
        {coAis && (
          <Chip on={prefs.lopAis} onClick={() => setHaiDoPrefs({ lopAis: !prefs.lopAis })}>
            {NHAN.ais}
          </Chip>
        )}
      </div>
      <h3 className="mt-3 text-[0.875rem] font-semibold text-navy">Gió sóng</h3>
      <div className="mt-2 flex gap-2">
        <Chip on={prefs.lopThoiTiet === "gio"} onClick={() => setHaiDoPrefs({ lopThoiTiet: prefs.lopThoiTiet === "gio" ? "tat" : "gio" })}>
          {NHAN.gio}
        </Chip>
        <Chip on={prefs.lopThoiTiet === "song"} onClick={() => setHaiDoPrefs({ lopThoiTiet: prefs.lopThoiTiet === "song" ? "tat" : "song" })}>
          {NHAN.song}
        </Chip>
      </div>
      <p className="mt-1 text-[0.75rem] text-muted">Mũi tên cả vùng biển, kéo dải giờ ở đáy màn</p>
      <h3 className="mt-3 text-[0.875rem] font-semibold text-navy">Đổi màu</h3>
      <div className="mt-2 flex gap-2">
        <Chip on={prefs.tuDongMau} onClick={() => setHaiDoPrefs({ tuDongMau: !prefs.tuDongMau })}>
          {NHAN.tuDong}
        </Chip>
      </div>
      <p className="mt-1 text-[0.75rem] text-muted">Tự sang Chiều, Đêm theo giờ mặt trời chỗ tàu</p>
    </div>
  );
}
