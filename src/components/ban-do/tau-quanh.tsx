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
*/
import { useEffect, useRef, useState } from "react";
import { CloseButton } from "@/components/ui/close-button";
import { NHAN } from "@/lib/labels";
import { fmtCoordPair, type MapPrefs } from "@/lib/map-prefs";
import { MAU_TAU, coTheXemVet, gioNgayVN, loaiTauLabel, nhomTau } from "@/lib/tau-ais";
import { QUANH_GIO, QUANH_NM, tomTatQuanh, trangThaiQuanh, type KetQuaQuanh, type TauQuanh } from "@/lib/tau-ais-quanh";

/** số dòng vẽ một lần — cửa cảng đông có thể vài trăm tàu trong 6 hải lý */
const DS_TOI_DA = 60;

export function TheTauQuanh({
  kq,
  chonId,
  onChon,
  onDuongDi,
  onRetry,
  onClose,
  prefs,
}: {
  /** null = đang tải; "loi" = không có sóng và máy chưa có bản nào */
  kq: KetQuaQuanh | null | "loi";
  chonId: string | null;
  onChon: (id: string | null) => void;
  onDuongDi: (t: TauQuanh) => void;
  onRetry: () => void;
  onClose: () => void;
  prefs: MapPrefs;
}) {
  const ds = kq && kq !== "loi" ? kq.tau : [];
  // mốc "bây giờ" chốt lúc thẻ mở (thẻ dựng lại theo điểm — key ở fishing-map-view)
  const [nowGiay] = useState(() => Math.floor(Date.now() / 1000));
  const tom = ds.length ? tomTatQuanh(ds, nowGiay) : null;
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
          {ds.length === 0 ? (
            <p className="mt-1.5 px-1 text-[0.8125rem] text-muted">
              Không có tàu phát AIS trong {QUANH_NM} hải lý quanh điểm này {QUANH_GIO} giờ qua.
            </p>
          ) : (
            <>
            {tom && (
              <div className="mt-1 px-1 text-[0.8125rem] leading-snug">
                <p className="font-semibold text-navy">{tom.bayGio}</p>
                {tom.daQua && <p className="text-muted">{tom.daQua}</p>}
              </div>
            )}
            <ul ref={dsRef} className="mt-1.5 max-h-[28dvh] overflow-y-auto overscroll-contain rounded-xl border border-line">
              {ds.slice(0, DS_TOI_DA).map((t) => {
                const mo = chonId === t.id;
                const tt = trangThaiQuanh(t, nowGiay);
                const mau = MAU_TAU[nhomTau(t.loai)];
                return (
                  <li key={t.id} data-tau={t.id} className="border-b border-line last:border-b-0">
                    <button
                      type="button"
                      onClick={() => onChon(mo ? null : t.id)}
                      aria-expanded={mo}
                      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left active:bg-field ${mo ? "bg-field" : ""}`}
                    >
                      {/* chấm ĐẶC = đang ở đây, chấm RỖNG = đã qua — khớp chấm trên bản đồ */}
                      <span
                        className="inline-block h-2.5 w-2.5 flex-none rounded-full border-2"
                        style={{ borderColor: mau, backgroundColor: tt.oDay ? mau : "transparent" }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.875rem] font-semibold text-navy">{t.ten ?? "Tàu chưa rõ tên"}</span>
                        <span className="block truncate text-[0.75rem] text-muted">{tt.cau}</span>
                      </span>
                      <span className={`flex-none rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold ${tt.oDay ? "bg-ok-bg text-ok" : "bg-field text-muted"}`}>{tt.chip}</span>
                    </button>
                    {mo && (
                      <div className="bg-field px-3 pb-2.5 pt-0.5 text-[0.75rem] leading-snug text-muted">
                        <p>
                          {loaiTauLabel(t.loai)} · trong vòng từ {gioNgayVN(t.dau ?? t.gan.t)} tới {tt.oDay ? "nay" : gioNgayVN(t.cuoi)}
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
              {ds.length > DS_TOI_DA && (
                <li className="px-3 py-2 text-[0.75rem] text-muted">Còn {(ds.length - DS_TOI_DA).toLocaleString("vi-VN")} tàu xa hơn.</li>
              )}
            </ul>
            </>
          )}
          <p className="mt-1.5 px-1 text-[0.6875rem] leading-snug text-muted">
            {ds.length > 0 ? `${ds.length.toLocaleString("vi-VN")} tàu · ` : ""}
            {kq.chiBan
              ? kq.tuMay
                ? "Mất sóng: chỉ tàu trong bản lưu trong máy, thiếu tàu đã đi khỏi."
                : "Chưa đọc được lộ trình 6 giờ: chỉ tàu trong bản mới nhất."
              : "Lộ trình một mốc mỗi giờ — tàu lướt qua nhanh có thể sót."}{" "}
            Tàu không bật AIS sẽ không hiện.
          </p>
        </>
      )}
    </div>
  );
}
