"use client";

/*
  BẢNG TUYẾN · BẢNG VẾT — chế độ Hải đồ đợt 4 (2026-11-04). Ngăn đáy nổi trên hải đồ
  (tối đa ~52 % màn), đóng bằng × chấm góc phải (03 §6 mục 8).

  Tuyến (iSailor RouteEditPage/WaypointEditPage + RouteCheck; OpenCPN Route Manager):
    · danh sách: tên · cự ly · số điểm — Bắt đầu / Sửa / Xoá; Thêm · Nhập GPX · Xuất GPX
    · soạn: chạm hải đồ để thêm điểm; bảng chặng (hướng · cự ly · phút); Bỏ điểm ·
      Đảo tuyến · Kiểm tuyến (hậu kiểm `auditRoute` đã có) · Lưu · Huỷ
  Vết (iSailor TracksListPage/TrackViewPage; OpenCPN tracks):
    · Ghi vết / Dừng ghi · danh sách: ngày · cự ly · thời gian — Bản đồ / Tạo tuyến / Xuất GPX / Xoá
*/
import { CloseButton } from "@/components/ui/close-button";
import { NHAN } from "@/lib/labels";
import { fmtDist, type DistUnit } from "@/lib/map-prefs";
import { fmtPv } from "@/lib/hai-do/may";
import { cacChang, thongKeVet, tongKm, type Tuyen, type Vet } from "@/lib/hai-do/tuyen";
import type { LatLon } from "@/lib/route-plan";
import type { RouteHit } from "@/lib/route-hazards";

const NUT = "sq-btn bg-field text-foreground disabled:opacity-50";
const NUT_CHINH = "sq-btn bg-sea text-card disabled:opacity-50";

export function Ngan({ tieuDe, onDong, children }: { tieuDe: string; onDong: () => void; children: React.ReactNode }) {
  return (
    <section
      aria-label={tieuDe}
      className="pointer-events-auto absolute inset-x-2 bottom-3 z-20 flex max-h-[52%] flex-col rounded-2xl border border-line bg-card shadow-float"
    >
      <div className="flex items-center justify-between px-3 pb-1 pt-3">
        <h2 className="text-[1rem] font-semibold text-navy">{tieuDe}</h2>
        <CloseButton onClose={onDong} label={`Đóng ${tieuDe.toLowerCase()}`} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">{children}</div>
    </section>
  );
}

const gio = (phut: number) => (phut < 60 ? `${Math.round(phut)} phút` : `${Math.floor(phut / 60)} giờ ${Math.round(phut % 60)} phút`);

export function BangTuyen({
  ds,
  soan,
  tocDoKn,
  unit,
  kiem,
  dangChayId,
  onThem,
  onSua,
  onXoa,
  onChay,
  onDung,
  onBoDiem,
  onDao,
  onKiem,
  onLuu,
  onHuy,
  onNhap,
  onXuat,
  onDong,
}: {
  ds: Tuyen[];
  soan: { ten: string; diem: LatLon[] } | null;
  tocDoKn: number;
  unit: DistUnit;
  kiem: { hits: RouteHit[]; missing: string[] } | null;
  dangChayId: string | null;
  onThem: () => void;
  onSua: (t: Tuyen) => void;
  onXoa: (t: Tuyen) => void;
  onChay: (t: Tuyen) => void;
  onDung: () => void;
  onBoDiem: () => void;
  onDao: () => void;
  onKiem: () => void;
  onLuu: () => void;
  onHuy: () => void;
  onNhap: () => void;
  onXuat: () => void;
  onDong: () => void;
}) {
  if (soan) {
    const chang = cacChang(soan.diem, tocDoKn);
    return (
      <Ngan tieuDe={soan.ten} onDong={onHuy}>
        {soan.diem.length < 2 ? (
          <p className="text-[0.875rem] text-muted">{`Chạm lên hải đồ để đặt điểm (${soan.diem.length} điểm).`}</p>
        ) : (
          <>
            <p className="text-[0.875rem] font-semibold text-navy tabular-nums">
              {`${soan.diem.length} điểm · ${fmtDist(tongKm(soan.diem), unit, 1)} · ${gio(chang[chang.length - 1].phutDon)} ở ${tocDoKn} hải lý/giờ`}
            </p>
            <ol className="mt-1 flex flex-col gap-0.5 text-[0.8125rem] tabular-nums text-foreground">
              {chang.map((c, k) => (
                <li key={k}>{`${k + 1}→${k + 2}: ${fmtPv(c.pvDeg)} · ${fmtDist(c.km, unit, 1)} · ${gio(c.phut)}`}</li>
              ))}
            </ol>
          </>
        )}
        {kiem && (
          <div className="mt-2">
            <h3 className="text-[0.875rem] font-semibold text-navy">Nguy hiểm trên tuyến</h3>
            {kiem.hits.length === 0 ? (
              <p className="text-[0.8125rem] text-muted">Không thấy nguy hiểm trong dữ liệu đang có.</p>
            ) : (
              <ul className="mt-1 flex flex-col gap-1">
                {kiem.hits.slice(0, 12).map((h) => (
                  <li
                    key={h.id}
                    className={`rounded-lg px-2 py-1 text-[0.8125rem] ${
                      h.muc === "do" ? "bg-danger-bg text-danger" : h.muc === "vang" ? "bg-warn-bg text-warn" : "bg-field text-foreground"
                    }`}
                  >
                    {`Cách đầu tuyến ${fmtDist(h.alongKm, unit, 1)}: ${h.cau}`}
                  </li>
                ))}
              </ul>
            )}
            {kiem.missing.length > 0 && <p className="mt-1 text-[0.75rem] text-muted">{`Chưa soi được: ${kiem.missing.join(", ")}`}</p>}
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={NUT} onClick={onBoDiem} disabled={soan.diem.length === 0}>
            {NHAN.boDiem}
          </button>
          <button type="button" className={NUT} onClick={onDao} disabled={soan.diem.length < 2}>
            {NHAN.daoTuyen}
          </button>
          <button type="button" className={NUT} onClick={onKiem} disabled={soan.diem.length < 2}>
            {NHAN.kiemTuyen}
          </button>
          <button type="button" className={NUT_CHINH} onClick={onLuu} disabled={soan.diem.length < 2}>
            {NHAN.luu}
          </button>
          <button type="button" className={NUT} onClick={onHuy}>
            {NHAN.huy}
          </button>
        </div>
      </Ngan>
    );
  }
  return (
    <Ngan tieuDe="Tuyến" onDong={onDong}>
      {ds.length === 0 ? (
        <p className="text-[0.875rem] text-muted">Chưa có tuyến. Thêm tuyến rồi chạm hải đồ để đặt điểm, hoặc nhập tệp GPX.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {ds.map((t) => (
            <li key={t.id} className="py-2">
              <p className="text-[0.9375rem] font-semibold text-navy">{t.ten}</p>
              <p className="text-[0.8125rem] text-muted tabular-nums">{`${t.diem.length} điểm · ${fmtDist(tongKm(t.diem), unit, 1)}`}</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {dangChayId === t.id ? (
                  <button type="button" className={NUT} onClick={onDung}>
                    {NHAN.dung}
                  </button>
                ) : (
                  <button type="button" className={NUT_CHINH} onClick={() => onChay(t)}>
                    {NHAN.batDau}
                  </button>
                )}
                <button type="button" className={NUT} onClick={() => onSua(t)}>
                  {NHAN.sua}
                </button>
                <button type="button" className={NUT} onClick={() => onXoa(t)}>
                  {NHAN.xoa}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={NUT_CHINH} onClick={onThem}>
          {NHAN.them}
        </button>
        <button type="button" className={NUT} onClick={onNhap}>
          {NHAN.nhapGpx}
        </button>
        {ds.length > 0 && (
          <button type="button" className={NUT} onClick={onXuat}>
            {NHAN.xuatGpx}
          </button>
        )}
      </div>
    </Ngan>
  );
}

export function BangVet({
  ds,
  dangGhiId,
  dangXemId,
  unit,
  onGhi,
  onDungGhi,
  onXem,
  onTaoTuyen,
  onXuat,
  onXoa,
  onDong,
}: {
  ds: Vet[];
  dangGhiId: string | null;
  dangXemId: string | null;
  unit: DistUnit;
  onGhi: () => void;
  onDungGhi: () => void;
  onXem: (v: Vet) => void;
  onTaoTuyen: (v: Vet) => void;
  onXuat: (v: Vet) => void;
  onXoa: (v: Vet) => void;
  onDong: () => void;
}) {
  return (
    <Ngan tieuDe="Vết tàu" onDong={onDong}>
      <div className="flex flex-wrap items-center gap-2">
        {dangGhiId ? (
          <button type="button" className="sq-btn bg-danger text-card" onClick={onDungGhi}>
            {NHAN.dungGhi}
          </button>
        ) : (
          <button type="button" className={NUT_CHINH} onClick={onGhi}>
            {NHAN.ghiVet}
          </button>
        )}
        {dangGhiId && <span className="text-[0.8125rem] font-semibold text-danger">Đang ghi — giữ màn mở</span>}
      </div>
      {ds.length === 0 ? (
        <p className="mt-2 text-[0.875rem] text-muted">Chưa có vết nào.</p>
      ) : (
        <ul className="mt-2 flex flex-col divide-y divide-line">
          {ds.map((v) => {
            const tk = thongKeVet(v.diem);
            const ngay = new Date(v.batDau).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
            return (
              <li key={v.id} className="py-2">
                <p className="text-[0.9375rem] font-semibold text-navy">
                  {ngay}
                  {v.id === dangGhiId ? " · đang ghi" : ""}
                </p>
                <p className="text-[0.8125rem] text-muted tabular-nums">{`${fmtDist(tk.km, unit, 1)} · ${gio(tk.phut)} · ${v.diem.length} điểm`}</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <button type="button" aria-pressed={dangXemId === v.id} className={dangXemId === v.id ? NUT_CHINH : NUT} onClick={() => onXem(v)}>
                    {NHAN.banDo}
                  </button>
                  <button type="button" className={NUT} onClick={() => onTaoTuyen(v)} disabled={v.diem.length < 2}>
                    {NHAN.taoTuyen}
                  </button>
                  <button type="button" className={NUT} onClick={() => onXuat(v)}>
                    {NHAN.xuatGpx}
                  </button>
                  {v.id !== dangGhiId && (
                    <button type="button" className={NUT} onClick={() => onXoa(v)}>
                      {NHAN.xoa}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Ngan>
  );
}
