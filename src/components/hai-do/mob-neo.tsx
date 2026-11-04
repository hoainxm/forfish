"use client";

/*
  NGƯỜI RƠI XUỐNG BIỂN (MOB) + CANH NEO — chế độ Hải đồ đợt 2 (2026-11-04), anh
  Long duyệt. Đối chiếu iSailor `MOBPanel` (BRG · RNG · TTG · tuổi, kích/tắt có hỏi)
  và `AnchorWatchPanel` (Let go · By cursor · Swing circle · bán kính · báo động).
  Khác có chủ ý: kích/tắt MOB bằng GIỮ 1 giây thay hộp hỏi (tay ướt, tàu lắc —
  hộp hỏi là thêm một chạm đúng lúc gấp nhất).
*/
import { AnchorIcon, LifebuoyIcon } from "@/components/icons";
import { NHAN } from "@/lib/labels";
import { fmtDist, type DistUnit } from "@/lib/map-prefs";
import { BAN_KINH_NEO_M, fmtPv, MOB_GIU_MS, type ThongSoMob } from "@/lib/hai-do/may";
import { Chip, NutGiu } from "@/components/hai-do/ui";

/** Nút MOB đỏ góc trái dưới — luôn có khi có GPS. */
export function NutMob({ onKich, coGps }: { onKich: () => void; coGps: boolean }) {
  if (!coGps) return null;
  return (
    <NutGiu
      label="Người rơi xuống biển — đánh dấu chỗ rơi"
      ms={MOB_GIU_MS}
      onXong={onKich}
      className="flex h-14 w-14 items-center justify-center rounded-full bg-danger text-card shadow-trim-fab"
    >
      <span className="flex flex-col items-center leading-none">
        <LifebuoyIcon className="h-6 w-6" aria-hidden />
        <span className="mt-0.5 text-[0.6875rem] font-semibold">MOB</span>
      </span>
    </NutGiu>
  );
}

/** Bảng MOB to trên cùng khi đang có người rơi — thay dải số liệu. */
export function BangMob({
  so,
  unit,
  onDaVot,
}: {
  so: ThongSoMob | null;
  unit: DistUnit;
  onDaVot: () => void;
}) {
  return (
    <div role="alert" className="pointer-events-auto rounded-2xl bg-danger p-3 text-card shadow-float">
      <p className="text-[0.875rem] font-semibold">Người rơi xuống biển</p>
      {so ? (
        <div className="mt-1 flex items-end gap-4">
          <div>
            <p className="text-[0.75rem] opacity-80">Hướng tới</p>
            <p className="text-[2rem] font-semibold leading-none tabular-nums">{fmtPv(so.pvDeg)}</p>
          </div>
          <div>
            <p className="text-[0.75rem] opacity-80">Cách</p>
            <p className="text-[1.5rem] font-semibold leading-none tabular-nums">{fmtDist(so.cuLyKm, unit, so.cuLyKm < 1 ? 2 : 1)}</p>
          </div>
          <div className="ml-auto text-right text-[0.8125rem] font-semibold tabular-nums">
            <p>{so.phut} phút trước</p>
            {so.toiPhut != null && <p>Tới nơi ~{so.toiPhut} phút</p>}
          </div>
        </div>
      ) : (
        <p className="mt-1 text-[0.875rem]">Đang chờ GPS để chỉ hướng</p>
      )}
      <NutGiu
        label="Đã vớt người — tắt báo người rơi"
        ms={MOB_GIU_MS}
        onXong={onDaVot}
        className="sq-btn mt-3 w-full bg-card/20 text-card"
      >
        {NHAN.daVot}
      </NutGiu>
    </div>
  );
}

/** Nội dung bảng Neo (Popover từ nút neo). */
export function BangNeo({
  dangNeo,
  banKinhM,
  cachM,
  coGps,
  onTha,
  onNho,
  onBanKinh,
}: {
  dangNeo: boolean;
  banKinhM: number;
  cachM: number | null;
  coGps: boolean;
  onTha: () => void;
  onNho: () => void;
  onBanKinh: (m: number) => void;
}) {
  return (
    <div>
      <h3 className="flex items-center gap-2 text-[0.875rem] font-semibold text-navy">
        <AnchorIcon className="h-4 w-4" aria-hidden /> Canh neo
      </h3>
      <p className="mt-2 text-[0.75rem] font-semibold text-muted">Vòng xoay</p>
      <div className="mt-1 flex flex-wrap gap-2">
        {BAN_KINH_NEO_M.map((m) => (
          <Chip key={m} on={banKinhM === m} onClick={() => onBanKinh(m)}>
            {`${m} m`}
          </Chip>
        ))}
      </div>
      {dangNeo && cachM != null && (
        <p className={`mt-2 text-[0.9375rem] font-semibold tabular-nums ${cachM > banKinhM ? "text-danger" : "text-navy"}`}>
          {`Cách neo ${Math.round(cachM)} / ${banKinhM} m`}
        </p>
      )}
      {!coGps && !dangNeo && <p className="mt-2 text-[0.8125rem] text-warn">Cần GPS để thả neo</p>}
      {dangNeo ? (
        <button type="button" onClick={onNho} className="sq-btn mt-3 w-full bg-field text-foreground">
          {NHAN.nhoNeo}
        </button>
      ) : (
        <button type="button" onClick={onTha} disabled={!coGps} className="sq-btn mt-3 w-full bg-sea text-card disabled:opacity-50">
          {NHAN.thaNeo}
        </button>
      )}
    </div>
  );
}
