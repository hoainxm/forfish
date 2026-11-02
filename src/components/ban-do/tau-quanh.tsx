"use client";

/*
  THẺ "TÀU QUANH ĐÂY" (2026-10-31) — mở từ menu chạm GIỮ 3 GIÂY trên bản đồ (chỉ tài khoản được xem AIS, mặc định
  0938635689). Liệt kê tàu đã phát AIS trong 6 hải lý quanh điểm vừa giữ, 6 giờ qua (lib/tau-ais-quanh); bản đồ vẽ
  vòng 6 hải lý + chấm mỗi tàu ở chỗ nó đi GẦN điểm nhất. Chạm dòng ⇒ chọn (chấm to lên) + chi tiết dưới dòng, có nút
  Đường đi khi tàu theo được đường.

  Đủ trạng thái: đang tải · không có bản (mất sóng lần đầu — chạm thử lại) · trống · có tàu · chỉ bản (thiếu lộ trình
  6 giờ hoặc bản trong máy) nói rõ ở chân thẻ.

  THÔNG MINH HƠN (2026-11-02, anh Long: "đang ở đó, đã đi qua đó, tàu gì… tàu cá đã ở đó 3 h trước, tàu hàng đã chạy
  qua 5 h trước, hiện thời chỉ có tàu hàng ở đó"): hai câu tóm tắt đầu thẻ (Bây giờ / Đã qua, nhóm theo loại), mỗi dòng
  một nhãn "Đang ở" hoặc giờ đã qua + câu "ở quanh đây ~3 giờ" / "chạy qua". Chạm chấm trên bản đồ ⇒ dòng đó mở + cuộn tới.

  GỌN + LỌC BẰNG ICON (2026-11-02, anh Long: "gọn lại tối ưu lại thông minh hơn, lọc được luôn, lọc thông minh theo
  click icon thôi"): bỏ hai câu tóm tắt dài ⇒ MỘT hàng icon có số: chấm đặc (đang ở) · chấm rỗng (đã qua) | icon tàu
  từng nhóm (cùng hình/màu bản đồ). Chạm icon = lọc cả danh sách lẫn bản đồ, chạm lại = bỏ lọc; số icon này đếm theo
  lọc chiều kia (lib demLocQuanh). Dòng tàu một hàng: icon tàu (mờ = đã qua) + tên + nhãn; câu trạng thái vào phần mở.
*/
import { useEffect, useRef, useState } from "react";
import { CloseButton } from "@/components/ui/close-button";
import { NHAN } from "@/lib/labels";
import { fmtCoordPair, type MapPrefs } from "@/lib/map-prefs";
import { MAU_TAU, coTheXemVet, gioNgayVN, loaiTauLabel, nhomTau } from "@/lib/tau-ais";
import {
  QUANH_GIO,
  QUANH_NM,
  demLocQuanh,
  locTauQuanh,
  tenNhomTau,
  trangThaiQuanh,
  type KetQuaQuanh,
  type LocQuanh,
  type NhomQuanh,
  type TauQuanh,
} from "@/lib/tau-ais-quanh";

const TEN_NHOM: Record<NhomQuanh, string> = { ca: "Tàu cá", hang: "Tàu hàng", dau: "Tàu dầu", khach: "Tàu khách", khac: "Tàu khác hoặc chưa rõ loại" };

/** Icon tàu nhỏ CÙNG hình bản đồ (components/ban-do/icon-tau): tam giác xoay theo mũi khi chạy, chấm tròn khi đứng. */
function IconTau({ mau, huong, mo = false }: { mau: string; huong?: number | null; mo?: boolean }) {
  return (
    <svg viewBox="0 0 22 30" className={`h-[1.125rem] w-[0.875rem] flex-none ${mo ? "opacity-45" : ""}`} aria-hidden>
      {huong != null ? (
        <path d="M11 3 L17 25 L11 21 L5 25 Z" transform={`rotate(${huong} 11 15)`} fill={mau} className="stroke-white" strokeWidth={2.4} strokeLinejoin="round" />
      ) : (
        <circle cx={11} cy={15} r={6} fill={mau} className="stroke-white" strokeWidth={2.4} />
      )}
    </svg>
  );
}

/** Chấm trạng thái: đặc = đang ở, rỗng = đã qua */
const ChamTrangThai = ({ dac }: { dac: boolean }) => (
  <span className={`inline-block h-2.5 w-2.5 flex-none rounded-full border-2 border-navy ${dac ? "bg-navy" : ""}`} aria-hidden />
);

/** số dòng vẽ một lần — cửa cảng đông có thể vài trăm tàu trong 6 hải lý */
const DS_TOI_DA = 60;

/** "trong vòng từ 07:00 1/11 tới nay" · "trong vòng lúc 05:00 2/11" (một mốc) */
function khungTrongVong(t: TauQuanh, oDay: boolean): string {
  const dau = gioNgayVN(t.dau ?? t.gan.t);
  if (oDay) return `trong vòng từ ${dau} tới nay`;
  const cuoi = gioNgayVN(t.cuoi);
  return cuoi === dau ? `trong vòng lúc ${dau}` : `trong vòng từ ${dau} tới ${cuoi}`;
}

export function TheTauQuanh({
  kq,
  chonId,
  onChon,
  onDuongDi,
  onRetry,
  onClose,
  prefs,
  loc,
  onLoc,
}: {
  /** null = đang tải; "loi" = không có sóng và máy chưa có bản nào */
  kq: KetQuaQuanh | null | "loi";
  chonId: string | null;
  onChon: (id: string | null) => void;
  onDuongDi: (t: TauQuanh) => void;
  onRetry: () => void;
  onClose: () => void;
  prefs: MapPrefs;
  /** lọc bằng icon — state ở fishing-map-view để bản đồ lọc theo cùng */
  loc: LocQuanh;
  onLoc: (loc: LocQuanh) => void;
}) {
  const tatCa = kq && kq !== "loi" ? kq.tau : [];
  const ds = locTauQuanh(tatCa, loc);
  const dem = demLocQuanh(tatCa, loc);
  // mốc "bây giờ" chốt lúc thẻ mở (thẻ dựng lại theo điểm — key ở fishing-map-view)
  const [nowGiay] = useState(() => Math.floor(Date.now() / 1000));
  // chạm chấm của tàu nằm ngoài DS_TOI_DA dòng đầu ⇒ vẫn thêm dòng đó vào cuối để mở + cuộn tới được
  const dau = ds.slice(0, DS_TOI_DA);
  const chonNgoai = chonId && !dau.some((t) => t.id === chonId) ? ds.find((t) => t.id === chonId) : undefined;
  const hienThi = chonNgoai ? [...dau, chonNgoai] : dau;
  // chạm chấm trên bản đồ ⇒ dòng đó cuộn vào khung
  const dsRef = useRef<HTMLUListElement | null>(null);
  useEffect(() => {
    if (!chonId) return;
    dsRef.current?.querySelector(`[data-tau="${CSS.escape(chonId)}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [chonId]);
  return (
    <div className="pointer-events-auto rounded-2xl bg-card/97 p-2 shadow-xl">
      <div className="flex items-center gap-2 pl-1">
        <p className="min-w-0 flex-1 truncate text-[0.875rem] font-semibold text-navy">
          Tàu quanh đây · {QUANH_NM} hải lý · {QUANH_GIO} giờ qua
        </p>
        <CloseButton onClose={onClose} label="Đóng danh sách tàu quanh đây" />
      </div>

      {kq == null && <p className="mt-1.5 px-1 text-[0.8125rem] text-muted">Đang tìm tàu quanh điểm này…</p>}
      {kq === "loi" && (
        <button type="button" onClick={onRetry} className="mt-1.5 w-full rounded-xl bg-field px-3 py-2 text-left text-[0.8125rem] text-foreground/75 active:scale-[0.99]">
          Chưa tải được vị trí tàu — cần có sóng lần đầu. Chạm để thử lại.
        </button>
      )}

      {kq && kq !== "loi" && (
        <>
          {tatCa.length === 0 ? (
            <p className="mt-1.5 px-1 text-[0.8125rem] text-muted">
              Không có tàu phát AIS trong {QUANH_NM} hải lý quanh điểm này {QUANH_GIO} giờ qua.
            </p>
          ) : (
            <>
            {/* HÀNG ICON LỌC — chạm = lọc cả danh sách + bản đồ, chạm lại = bỏ */}
            <div className="-mx-0.5 mt-1 flex gap-1 overflow-x-auto px-0.5 pb-0.5 [scrollbar-width:none]">
              {([true, false] as const).map((o) => {
                const bat = loc.o === o;
                const n = o ? dem.o : dem.qua;
                return (
                  <button
                    key={String(o)}
                    type="button"
                    onClick={() => onLoc({ ...loc, o: bat ? null : o })}
                    aria-pressed={bat}
                    aria-label={`${o ? "Đang ở đây" : "Đã qua"}: ${n} tàu`}
                    className={`flex h-8 flex-none items-center gap-1.5 rounded-full px-2.5 text-[0.75rem] font-semibold tabular-nums active:scale-[0.97] ${bat ? "bg-navy text-white [&>span]:border-white [&>span.bg-navy]:bg-white" : "bg-field text-navy"}`}
                  >
                    <ChamTrangThai dac={o} />
                    {n.toLocaleString("vi-VN")}
                  </button>
                );
              })}
              <span className="mx-0.5 w-px flex-none self-stretch bg-line" aria-hidden />
              {dem.nhom.map(({ nhom, n }) => {
                const bat = loc.nhom === nhom;
                return (
                  <button
                    key={nhom}
                    type="button"
                    onClick={() => onLoc({ ...loc, nhom: bat ? null : nhom })}
                    aria-pressed={bat}
                    aria-label={`${TEN_NHOM[nhom]}: ${n} tàu`}
                    className={`flex h-8 flex-none items-center gap-1 rounded-full px-2.5 text-[0.75rem] font-semibold tabular-nums active:scale-[0.97] ${bat ? "bg-navy text-white" : "bg-field text-navy"}`}
                  >
                    <IconTau mau={MAU_TAU[nhom]} huong={0} />
                    {n.toLocaleString("vi-VN")}
                  </button>
                );
              })}
            </div>
            {ds.length === 0 ? (
              <p className="mt-1.5 px-1 text-[0.8125rem] text-muted">Không có tàu nào khớp — chạm icon đang chọn để bỏ lọc.</p>
            ) : (
            <ul ref={dsRef} className="mt-1.5 max-h-[28dvh] overflow-y-auto overscroll-contain rounded-xl border border-line">
              {hienThi.map((t) => {
                const mo = chonId === t.id;
                const tt = trangThaiQuanh(t, nowGiay);
                const mau = MAU_TAU[nhomTau(t.loai)];
                return (
                  <li key={t.id} data-tau={t.id} className="border-b border-line last:border-b-0">
                    <button
                      type="button"
                      onClick={() => onChon(mo ? null : t.id)}
                      aria-expanded={mo}
                      className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left active:bg-field ${mo ? "bg-field" : ""}`}
                    >
                      {/* icon CÙNG bản đồ: đậm = đang ở, mờ = đã qua */}
                      <IconTau mau={mau} huong={(t.oDay ? t.hienTai : t.gan)?.huong} mo={!tt.oDay} />
                      <span className="min-w-0 flex-1 truncate text-[0.875rem] font-semibold text-navy">{t.ten ?? tenNhomTau(t.loai)}</span>
                      <span className={`flex-none rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold ${tt.oDay ? "bg-ok-bg text-ok" : "bg-field text-muted"}`}>{tt.chip}</span>
                    </button>
                    {mo && (
                      <div className="bg-field px-3 pb-2.5 pt-0.5 text-[0.75rem] leading-snug text-muted">
                        <p className="text-foreground/80">{tt.cau}</p>
                        <p>
                          {t.loai === 0 ? "Chưa rõ loại" : loaiTauLabel(t.loai)} · {khungTrongVong(t, tt.oDay)}
                        </p>
                        <p>
                          {t.co ? `Cờ ${t.co} · ` : ""}
                          {t.mmsi ? `MMSI ${t.mmsi} · ` : ""}
                          chỗ gần nhất {fmtCoordPair(t.gan.lat, t.gan.lon, prefs.coordFormat)}
                        </p>
                        {coTheXemVet(t) && (
                          <button type="button" onClick={() => onDuongDi(t)} className="mt-2 h-9 min-w-[5.5rem] rounded-full bg-navy px-4 text-[0.8125rem] font-semibold text-white active:scale-[0.98]">
                            {NHAN.duongDi}
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
              {ds.length > hienThi.length && (
                <li className="px-3 py-2 text-[0.75rem] text-muted">Còn {(ds.length - hienThi.length).toLocaleString("vi-VN")} tàu qua lâu hơn — chạm icon trên bản đồ để xem.</li>
              )}
            </ul>
            )}
            </>
          )}
          <p className="mt-1.5 px-1 text-[0.6875rem] leading-snug text-muted">
            {kq.chiBan
              ? kq.tuMay
                ? "Mất sóng: chỉ tàu trong bản lưu trong máy."
                : "Chưa đọc được lộ trình 6 giờ: chỉ tàu trong bản mới nhất."
              : "Mốc mỗi giờ — có thể sót tàu lướt nhanh, tàu tắt AIS."}
          </p>
        </>
      )}
    </div>
  );
}
