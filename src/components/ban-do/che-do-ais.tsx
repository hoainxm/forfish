"use client";

/*
  CHẾ ĐỘ AIS (2026-10-29, xem trước acc 0938635689 qua `fleetAllowed`). Vào từ ô AIS trên rail bản đồ; hai cách
  xem chọn bằng `CheDoTabs`:
   · BÁN KÍNH (`CheDoAis`) — màn phủ: một CÂU nguy cơ trên cùng, radar quanh tàu mình, danh sách tàu.
   · TOÀN BIỂN (`AisToanBien`) — thẻ nổi đầu bản đồ: tìm tàu theo tên/số hiệu, lọc tàu cá, chú giải màu.

  RÀ DESIGN (anh Long 29/10: "phải đẹp, thân thiện, đơn giản, hữu ích, xem cái họ cần gì"). Bà con mở AIS để
  hỏi ba câu, theo thứ tự quan trọng:
    1. "Có tàu nào sắp đi sát mình không?" ⇒ câu `tomTatNguyCo` tô màu đỏ/vàng/xanh LÊN ĐẦU, thay 4 ô đếm.
    2. "Quanh đây có những tàu nào, tàu cá ở đâu?" ⇒ radar + danh sách nói câu đời thường ("Cách 1,1 hải lý ·
       phía Đông Bắc", "Đi sát 260 m sau 7 phút") thay cho độ và chữ viết tắt; CPA/TCPA chỉ còn trong chi tiết.
    3. "Tàu bạn (số hiệu …) đang ở đâu?" ⇒ ô tìm ở Toàn biển, chạm kết quả là bay tới + mở thẻ tàu.
  Bớt hộp: bỏ thẻ "Tàu mình" (tốc độ/hướng thành một dòng dưới radar), 5 chip tầm thành nút − / + trong radar,
  4 chip lọc còn 3 (Tất cả · Tới gần · Tàu cá), chạm một tàu mở chi tiết NGAY dưới dòng đó (không nhảy lên đầu).

  Tầm radar: vòng NGOÀI = tầm đang chọn, ba vòng chia đều; nhãn vòng ghi cả hải lý lẫn km (anh Long 29/10:
  "vòng radar bao nhiêu km? cần xác định"). Mặc định 6 hải lý = 11,1 km.

  Nói thật về dữ liệu: bản AIS ~10 phút một lần, vị trí đã ƯỚC theo tốc độ/hướng trong tin ⇒ dòng nhắc ở cuối
  luôn hiện; tin cũ hơn 30 phút mờ đi và không bao giờ báo nguy. Không GPS ⇒ lấy điểm đang xem trên bản đồ làm
  tâm, câu trên cùng mời bật định vị. Mất sóng ⇒ bản lưu trong máy (lib/tau-ais), nói "bản lưu trong máy".
*/
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { MinusIcon, PlusIcon } from "@/components/icons";
import { CloseButton } from "@/components/ui/close-button";
import { ChipRow } from "@/components/ui/chip-row";
import { SearchField } from "@/components/ui/search-field";
import {
  KM_PER_NM,
  MAU_MUC,
  TAM_RADAR_NM,
  dongPhuTau,
  hlLabel,
  huongChu,
  locMucTieu,
  quangNgan,
  quetQuanh,
  tcpaLabel,
  tomTatNguyCo,
  type LocAis,
  type MucTieu,
  type TauMinh,
} from "@/lib/ais-cpa";
import { haversineKm, type LatLon } from "@/lib/geo";
import { NHAN } from "@/lib/labels";
import { fmtCoordPair, type MapPrefs } from "@/lib/map-prefs";
import { MAU_TAU, demTheoNhom, loaiTauLabel, nhomTau, timTau, tuoiTinLabel, type TauAis, type TauAisBan } from "@/lib/tau-ais";

export type CheDoAisXem = "ban-kinh" | "toan-bien";
type TaiState = "idle" | "loading" | "error" | "ok";

/** số dòng danh sách vẽ một lần — vùng cảng đông có thể vài trăm tàu trong 24 hải lý */
const DS_TOI_DA = 60;
/** vạch vận tốc trên radar = quãng đi trong 12 phút */
const VECTOR_PHUT = 12;
/** chỉ số trong TAM_RADAR_NM ⇒ 6 hải lý */
const MAC_DINH_TAM = 2;

const kmLabel = (nm: number) => `${(nm * KM_PER_NM).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} km`;
const so1 = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 1 });
const banLucLabel = (ban: TauAisBan) => new Date(ban.luc).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
const tenTau = (t: TauAis) => t.ten ?? "Tàu chưa rõ tên";

function mauMucTieu(m: MucTieu): string {
  if (m.muc === "nguy" || m.muc === "canh") return MAU_MUC[m.muc];
  return MAU_TAU[nhomTau(m.tau.loai)];
}

/** Hai cách xem của chế độ AIS — segmented, nhãn ≤2 chữ (labels.ts). */
export function CheDoTabs({ value, onChange }: { value: CheDoAisXem; onChange: (v: CheDoAisXem) => void }) {
  const ds: { id: CheDoAisXem; label: string }[] = [
    { id: "ban-kinh", label: NHAN.banKinh },
    { id: "toan-bien", label: NHAN.toanBien },
  ];
  return (
    <div role="tablist" aria-label="Cách xem AIS" className="flex gap-1 rounded-full bg-field p-1">
      {ds.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={o.id === value}
          onClick={() => onChange(o.id)}
          className={`h-(--h-chip) flex-1 rounded-full px-3 text-[0.875rem] font-semibold transition-colors ${o.id === value ? "bg-navy text-white" : "text-foreground/70"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const NHOM_LABEL: Record<keyof typeof MAU_TAU, string> = { ca: "Cá", hang: "Hàng", dau: "Dầu", khach: "Khách", khac: "Khác" };

/**
 * Thẻ nổi của cách xem "Toàn biển" — đầu cột trái cụm trên bản đồ (như NavHud). Bản đồ đã bay về cả vùng biển,
 * lớp chấm tàu bật. Việc chính ở đây: TÌM tàu theo tên/số hiệu và lọc chỉ tàu cá; hàng chấm màu là chú giải.
 */
export function AisToanBien({
  ban,
  state,
  tuKho,
  chiTauCa,
  onChiTauCa,
  viTriMinh,
  onChonTau,
  onRetry,
  onBanKinh,
  onClose,
}: {
  ban: TauAisBan | null;
  state: TaiState;
  tuKho: boolean;
  chiTauCa: boolean;
  onChiTauCa: (v: boolean) => void;
  /** để nói tàu tìm được cách mình bao xa — null khi chưa có GPS */
  viTriMinh: LatLon | null;
  onChonTau: (t: TauAis) => void;
  onRetry: () => void;
  onBanKinh: () => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const dem = useMemo(() => (ban ? demTheoNhom(ban.tau) : null), [ban]);
  const kq = useMemo(() => (ban ? timTau(ban.tau, q) : []), [ban, q]);
  const dangTim = q.trim().length >= 2;
  return (
    <div className="pointer-events-auto rounded-2xl bg-card/97 p-3 shadow-xl">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-[1.125rem] font-semibold leading-tight text-navy">Chế độ AIS</h2>
          <p className="text-[0.8125rem] text-foreground/60">
            {ban && dem
              ? `${ban.soTau.toLocaleString("vi-VN")} tàu · ${dem.ca.toLocaleString("vi-VN")} tàu cá · bản lúc ${banLucLabel(ban)}`
              : "Toàn biển"}
            {tuKho ? " · bản lưu trong máy" : ""}
          </p>
        </div>
        <CloseButton onClose={onClose} label="Thoát chế độ AIS" />
      </div>
      <div className="mt-2">
        <CheDoTabs value="toan-bien" onChange={(v) => v === "ban-kinh" && onBanKinh()} />
      </div>

      {state === "loading" && !ban && <p className="mt-2 text-[0.8125rem] text-foreground/60">Đang tải vị trí tàu…</p>}
      {state === "error" && !ban && (
        <button type="button" onClick={onRetry} className="mt-2 w-full rounded-xl bg-field px-3 py-2 text-left text-[0.8125rem] text-foreground/75 active:scale-[0.99]">
          Chưa tải được vị trí tàu — cần có sóng lần đầu. Chạm để thử lại.
        </button>
      )}

      {ban && dem && (
        <>
          <SearchField className="mt-2" value={q} onChange={setQ} placeholder="Tìm tàu: tên hoặc số hiệu" label="Tìm tàu theo tên hoặc số hiệu" />
          {dangTim ? (
            kq.length === 0 ? (
              <p className="mt-2 px-1 text-[0.8125rem] text-foreground/60">Không thấy tàu nào tên &ldquo;{q.trim()}&rdquo; đang phát AIS.</p>
            ) : (
              <ul className="mt-1.5 max-h-[40dvh] overflow-y-auto">
                {kq.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setQ("");
                        onChonTau(t);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left active:bg-field"
                    >
                      <span className="inline-block h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: MAU_TAU[nhomTau(t.loai)] }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.875rem] font-semibold text-navy">{tenTau(t)}</span>
                        <span className="block truncate text-[0.75rem] text-foreground/60">
                          {loaiTauLabel(t.loai)}
                          {viTriMinh ? ` · cách mình ${so1(haversineKm(viTriMinh, { lat: t.lat, lon: t.lon }) / KM_PER_NM)} hải lý` : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex flex-none gap-1 rounded-full bg-field p-1" role="group" aria-label="Lọc tàu trên bản đồ">
                {([false, true] as const).map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    aria-pressed={chiTauCa === v}
                    onClick={() => onChiTauCa(v)}
                    className={`h-9 min-w-[5rem] rounded-full px-3 text-[0.8125rem] font-semibold transition-colors ${chiTauCa === v ? "bg-card text-navy shadow-sm" : "text-foreground/65"}`}
                  >
                    {v ? NHAN.tauCa : NHAN.tatCa}
                  </button>
                ))}
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap gap-x-2 gap-y-0.5" aria-label="Màu theo loại tàu">
                {(Object.keys(NHOM_LABEL) as (keyof typeof MAU_TAU)[])
                  .filter((k) => !chiTauCa || k === "ca")
                  .map((k) => (
                    <span key={k} className="inline-flex items-center gap-1 text-[0.75rem] text-foreground/65">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: MAU_TAU[k] }} />
                      {NHOM_LABEL[k]}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function CheDoAis({
  ban,
  state,
  tuKho,
  gps,
  diemXem,
  prefs,
  onRetry,
  onDinhVi,
  onHaiDo,
  onToanBien,
  onClose,
}: {
  ban: TauAisBan | null;
  state: TaiState;
  tuKho: boolean;
  /** tàu mình theo GPS — null khi chưa bật/không có định vị */
  gps: TauMinh | null;
  /** tâm dự phòng khi không có GPS: điểm đang xem trên bản đồ */
  diemXem: LatLon;
  prefs: MapPrefs;
  onRetry: () => void;
  onDinhVi: () => void;
  onHaiDo: (m: MucTieu) => void;
  /** đổi sang cách xem Toàn biển */
  onToanBien: () => void;
  onClose: () => void;
}) {
  const [tamI, setTamI] = useState(MAC_DINH_TAM);
  const tam = TAM_RADAR_NM[tamI];
  const [loc, setLoc] = useState<LocAis>("tat");
  const [chonId, setChonId] = useState<string | null>(null);
  /*  Đồng hồ riêng 30 s: vị trí ước trôi theo tuổi tin — đồng hồ 5 phút của bản đồ quá thưa cho radar. */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const ds = useMemo(
    () => (ban ? quetQuanh(ban, gps ?? { pos: diemXem, speedKmh: null, headingDeg: null }, tam, now) : []),
    [ban, gps, diemXem, tam, now],
  );
  const hien = useMemo(() => locMucTieu(ds, loc), [ds, loc]);
  const tomTat = tomTatNguyCo(ds, !!gps, tam);

  /** chạm chấm trên radar ⇒ chọn + cuộn tới dòng đó (chi tiết mở ngay dưới dòng) */
  const chonTuRadar = (id: string) => {
    setChonId(id);
    if (loc !== "tat" && !hien.some((m) => m.tau.id === id)) setLoc("tat");
    window.setTimeout(() => document.getElementById(`ais-${id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 50);
  };

  const mauTomTat =
    tomTat.muc === "nguy"
      ? "bg-danger-bg text-danger"
      : tomTat.muc === "canh"
        ? "bg-warn-bg text-warn"
        : tomTat.muc === "an"
          ? "bg-ok-bg text-ok"
          : "bg-field text-foreground/80";

  /*  Cổng ra <body> (như can-giay-sheet): khung bản đồ tạo ngữ cảnh xếp lớp riêng ⇒ ở trong đó dock và
      popover Lớp đè lên màn phủ dù z cao. */
  return createPortal(
    <div className="fixed inset-0 z-[90] mx-auto flex max-w-(--w-app) flex-col bg-background" role="dialog" aria-modal="true" aria-label="Chế độ AIS — bán kính">
      <div className="flex items-center gap-2 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="min-w-0 flex-1">
          <h2 className="text-[1.125rem] font-semibold leading-tight text-navy">Chế độ AIS</h2>
          <p className="text-[0.8125rem] text-foreground/60">
            {ban ? `Bản lúc ${banLucLabel(ban)}` : "Tàu quanh mình"}
            {tuKho ? " · bản lưu trong máy" : ""}
          </p>
        </div>
        <CloseButton onClose={onClose} label="Thoát chế độ AIS" />
      </div>
      <div className="px-4 pb-3">
        <CheDoTabs value="ban-kinh" onChange={(v) => v === "toan-bien" && onToanBien()} />
      </div>

      <div className="flex-1 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
        {/* 1 — CÂU NGUY CƠ: điều bà con cần biết đầu tiên */}
        {ban && (
          <div role={tomTat.muc === "nguy" ? "alert" : "status"} className={`mx-4 mb-3 flex items-center gap-3 rounded-2xl px-3.5 py-3 ${mauTomTat}`}>
            <p className="min-w-0 flex-1 text-[0.875rem] font-medium leading-snug">{tomTat.cau}</p>
            {tomTat.muc === "chua-gps" && (
              <button type="button" onClick={onDinhVi} className="h-(--h-chip) min-w-[5.5rem] flex-none rounded-full bg-navy px-3 text-[0.875rem] font-semibold text-white active:scale-[0.98]">
                {NHAN.dinhVi}
              </button>
            )}
          </div>
        )}

        {/* 2 — RADAR: tầm − / + ngay trên, tàu mình một dòng dưới */}
        <div className="mx-4 rounded-2xl bg-navy px-2 pb-2 pt-1 text-white">
          <div className="flex items-center gap-2 px-1">
            <button
              type="button"
              onClick={() => setTamI((i) => Math.max(0, i - 1))}
              disabled={tamI === 0}
              aria-label="Thu nhỏ tầm radar"
              className="flex h-11 w-11 items-center justify-center rounded-full text-white transition active:bg-white/15 disabled:opacity-35"
            >
              <MinusIcon className="h-5 w-5" />
            </button>
            <p className="min-w-0 flex-1 text-center" aria-live="polite">
              <span className="block text-[0.875rem] font-semibold leading-tight">Tầm {tam} hải lý</span>
              <span className="block text-[0.75rem] text-white/65">= {kmLabel(tam)} · mỗi vòng {so1(tam / 3)} hải lý</span>
            </p>
            <button
              type="button"
              onClick={() => setTamI((i) => Math.min(TAM_RADAR_NM.length - 1, i + 1))}
              disabled={tamI === TAM_RADAR_NM.length - 1}
              aria-label="Mở rộng tầm radar"
              className="flex h-11 w-11 items-center justify-center rounded-full text-white transition active:bg-white/15 disabled:opacity-35"
            >
              <PlusIcon className="h-5 w-5" />
            </button>
          </div>
          <Radar ds={ds} tam={tam} gps={gps} chonId={chonId} onChon={chonTuRadar} />
          <p className="px-1 pt-1 text-center text-[0.75rem] text-white/70">
            {gps
              ? `Tàu mình ${gps.speedKmh != null && gps.speedKmh / KM_PER_NM >= 0.5 ? `chạy ${so1(gps.speedKmh / KM_PER_NM)} hải lý/h${gps.headingDeg != null ? ` hướng ${huongChu(gps.headingDeg)}` : ""}` : "đang đứng"} · vạch = quãng đi ${VECTOR_PHUT} phút`
              : "Chưa có định vị — tâm là điểm đang xem trên bản đồ"}
          </p>
        </div>

        {state === "loading" && !ban && <p className="mx-4 mt-3 text-[0.875rem] text-foreground/60">Đang tải vị trí tàu…</p>}
        {state === "error" && !ban && (
          <button type="button" onClick={onRetry} className="mx-4 mt-3 w-[calc(100%-2rem)] rounded-xl bg-field px-3 py-2.5 text-left text-[0.875rem] text-foreground/75 active:scale-[0.99]">
            Chưa tải được vị trí tàu — cần có sóng lần đầu. Chạm để thử lại.
          </button>
        )}

        {/* 3 — DANH SÁCH: câu đời thường, chạm mở chi tiết ngay dưới dòng */}
        {ban && (
          <>
            <div className="mt-3">
              <ChipRow
                level={2}
                ariaLabel="Lọc tàu"
                options={[
                  { id: "tat", label: NHAN.tatCa },
                  { id: "gan", label: NHAN.toiGan },
                  { id: "ca", label: NHAN.tauCa },
                ]}
                value={loc}
                onChange={setLoc}
              />
            </div>
            {hien.length === 0 ? (
              <p className="mx-4 text-[0.875rem] text-foreground/60">
                {ds.length === 0
                  ? `Không có tàu phát AIS trong ${tam} hải lý (${kmLabel(tam)}). Bấm + để xem xa hơn.`
                  : loc === "gan"
                    ? "Không có tàu nào đang tới gần."
                    : "Không có tàu cá nào trong tầm này."}
              </p>
            ) : (
              <ul className="mx-4 overflow-hidden rounded-2xl bg-card surface">
                {hien.slice(0, DS_TOI_DA).map((m) => {
                  const mo = chonId === m.tau.id;
                  return (
                    <li key={m.tau.id} id={`ais-${m.tau.id}`} className="border-b border-line last:border-b-0">
                      <button
                        type="button"
                        onClick={() => setChonId(mo ? null : m.tau.id)}
                        aria-expanded={mo}
                        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-field ${mo ? "bg-field" : ""} ${m.tinCu ? "opacity-60" : ""}`}
                      >
                        <span className="inline-block h-3 w-3 flex-none rounded-full" style={{ backgroundColor: mauMucTieu(m) }} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[0.875rem] font-semibold text-navy">{tenTau(m.tau)}</span>
                          <span
                            className={`block truncate text-[0.8125rem] ${m.muc === "nguy" ? "font-medium text-danger" : m.muc === "canh" ? "font-medium text-warn" : "text-foreground/60"}`}
                          >
                            {dongPhuTau(m, !!gps)}
                          </span>
                        </span>
                        <span className="flex-none text-[0.75rem] text-foreground/50">{loaiTauLabel(m.tau.loai)}</span>
                      </button>
                      {mo && <ChiTietTau m={m} prefs={prefs} coGps={!!gps} onHaiDo={() => onHaiDo(m)} />}
                    </li>
                  );
                })}
              </ul>
            )}
            {hien.length > DS_TOI_DA && (
              <p className="mx-4 mt-1.5 text-[0.75rem] text-foreground/55">
                Còn {(hien.length - DS_TOI_DA).toLocaleString("vi-VN")} tàu xa hơn — bấm − để thu tầm.
              </p>
            )}
          </>
        )}

        <p className="mx-4 mt-3 text-[0.75rem] leading-snug text-foreground/55">
          Vị trí cập nhật khoảng 10 phút một lần, app ước tới hiện tại. Tàu không bật AIS sẽ không hiện — luôn canh
          chừng bằng mắt và radar trên tàu.
        </p>
      </div>
    </div>,
    document.body,
  );
}

/** Chi tiết một tàu — câu đời thường trước, số kỹ thuật (CPA/TCPA, độ) để nhỏ cho người cần. */
function ChiTietTau({ m, prefs, coGps, onHaiDo }: { m: MucTieu; prefs: MapPrefs; coGps: boolean; onHaiDo: () => void }) {
  const t = m.tau;
  const chay = t.kn != null && t.kn >= 0.5;
  const tinhDuoc = coGps && !m.tinCu && m.cpaNm != null && m.tcpaPhut != null;
  return (
    <div className="bg-field px-3 pb-3 pt-0.5 text-[0.8125rem] leading-snug text-foreground/80">
      <p className="text-[0.8125rem] text-foreground/60">
        {loaiTauLabel(t.loai)}
        {t.co ? ` · cờ ${t.co}` : ""}
        {t.dai ? ` · dài ${t.dai} m` : ""}
        {t.dich ? ` · đến ${t.dich}` : ""}
      </p>
      <ul className="mt-1.5 space-y-1">
        <li>
          Cách mình <b className="font-medium text-navy">{hlLabel(m.cachNm)}</b> ({quangNgan(m.cachNm)}) về phía {huongChu(m.phuongVi)}
        </li>
        <li>
          {chay ? (
            <>
              Đang chạy <b className="font-medium text-navy">{so1(t.kn as number)} hải lý/h</b>
              {t.huong != null ? ` về hướng ${huongChu(t.huong)}` : ""}
            </>
          ) : (
            "Đang đứng hoặc thả trôi"
          )}
        </li>
        {tinhDuoc && (m.tcpaPhut as number) >= 0 && (
          <li className={m.muc === "nguy" ? "font-medium text-danger" : m.muc === "canh" ? "font-medium text-warn" : ""}>
            Nếu hai tàu giữ hướng: gần nhất {quangNgan(m.cpaNm as number)} sau {tcpaLabel(m.tcpaPhut)}
          </li>
        )}
        {tinhDuoc && (m.tcpaPhut as number) < 0 && <li>Hai tàu đang ra xa nhau</li>}
      </ul>
      <p className="mt-1.5 text-[0.75rem] text-foreground/55">
        {tinhDuoc ? `CPA ${hlLabel(m.cpaNm as number)} · TCPA ${tcpaLabel(m.tcpaPhut)} · ` : ""}
        phương vị {Math.round(m.phuongVi)}° · {fmtCoordPair(m.pos.lat, m.pos.lon, prefs.coordFormat)} (đã ước) · tin {tuoiTinLabel(m.tuoiPhut)}
        {m.tinCu ? " — tin cũ, không dùng để tránh va" : ""}
      </p>
      <button type="button" onClick={onHaiDo} className="mt-2.5 h-(--h-chip) min-w-[5.5rem] rounded-full bg-navy px-4 text-[0.875rem] font-semibold text-white active:scale-[0.98]">
        {NHAN.haiDo}
      </button>
    </div>
  );
}

const hangMuc = (m: MucTieu) => (m.muc === "nguy" ? 2 : m.muc === "canh" ? 1 : 0);

/** Radar Bắc-lên: tâm = tàu mình, vòng ngoài = `tam` hải lý, ba vòng chia đều có nhãn hải lý + km. */
function Radar({ ds, tam, gps, chonId, onChon }: { ds: MucTieu[]; tam: number; gps: TauMinh | null; chonId: string | null; onChon: (id: string) => void }) {
  const R = 100;
  const k = R / tam;
  const vong = [1, 2, 3].map((i) => (tam * i) / 3);
  const huong = gps?.headingDeg;
  const xy = (m: MucTieu) => {
    const r = Math.min(m.cachNm, tam) * k;
    return { x: r * Math.sin((m.phuongVi * Math.PI) / 180), y: -r * Math.cos((m.phuongVi * Math.PI) / 180) };
  };
  // tàu tới gần vẽ SAU để nằm trên; tàu đang chọn trên hết
  const thuTu = [...ds].sort((a, b) => Number(a.tau.id === chonId) - Number(b.tau.id === chonId) || hangMuc(a) - hangMuc(b));
  const chon = ds.find((m) => m.tau.id === chonId);
  return (
    <svg viewBox="-116 -116 232 232" className="mx-auto block aspect-square w-full max-w-[28rem]" role="img" aria-label={`Radar tầm ${tam} hải lý, ${ds.length} tàu`}>
      {vong.map((nm, i) => (
        <g key={nm}>
          <circle r={(R * (i + 1)) / 3} fill="none" stroke="currentColor" strokeOpacity={i === 2 ? 0.5 : 0.22} strokeWidth={0.6} />
          <text x={2.5} y={-(R * (i + 1)) / 3 + 5.5} fontSize={5} fill="currentColor" fillOpacity={0.6}>
            {so1(nm)} hl · {kmLabel(nm)}
          </text>
        </g>
      ))}
      <line x1={-R} y1={0} x2={R} y2={0} stroke="currentColor" strokeOpacity={0.12} strokeWidth={0.5} />
      <line x1={0} y1={-R} x2={0} y2={R} stroke="currentColor" strokeOpacity={0.12} strokeWidth={0.5} />
      {(
        [
          ["B", 0, -R - 5],
          ["Đ", R + 6, 2],
          ["N", 0, R + 9],
          ["T", -R - 6, 2],
        ] as const
      ).map(([c, x, y]) => (
        <text key={c} x={x} y={y} fontSize={6.5} textAnchor="middle" fill="currentColor" fillOpacity={c === "B" ? 1 : 0.6} fontWeight={600}>
          {c}
        </text>
      ))}

      {thuTu.map((m) => {
        const { x, y } = xy(m);
        const mau = mauMucTieu(m);
        const dang = m.tau.kn != null && m.tau.kn >= 0.5 && m.tau.huong != null;
        const vec = dang ? (((m.tau.kn as number) * VECTOR_PHUT) / 60) * k : 0;
        const h = m.tau.huong ?? 0;
        const noiBat = m.muc === "nguy" || m.muc === "canh";
        return (
          <g key={m.tau.id} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`} opacity={m.tinCu ? 0.4 : 1} onClick={() => onChon(m.tau.id)} className="cursor-pointer">
            <circle r={8} fill="transparent" />
            {noiBat && <circle r={6.5} fill={mau} fillOpacity={0.18} stroke={mau} strokeOpacity={0.6} strokeWidth={0.6} />}
            {dang && <line x1={0} y1={0} x2={vec * Math.sin((h * Math.PI) / 180)} y2={-vec * Math.cos((h * Math.PI) / 180)} stroke={mau} strokeWidth={0.8} strokeOpacity={0.85} />}
            {dang ? <path d="M0 -4.4 L2.9 3.1 L0 1.7 L-2.9 3.1 Z" fill={mau} transform={`rotate(${h})`} /> : <circle r={2.3} fill={mau} />}
            {m.tau.id === chonId && <circle r={7.5} fill="none" stroke="currentColor" strokeWidth={1} />}
          </g>
        );
      })}

      {/* tàu mình */}
      {huong != null ? (
        <g transform={`rotate(${huong})`}>
          <line x1={0} y1={0} x2={0} y2={-R} stroke="currentColor" strokeOpacity={0.45} strokeWidth={0.7} strokeDasharray="2 2" />
          <path d="M0 -6 L4 4.5 L0 2.4 L-4 4.5 Z" fill="currentColor" />
        </g>
      ) : (
        <circle r={3.2} fill="currentColor" />
      )}

      {/* tên tàu đang chọn — để biết chấm nào là dòng nào */}
      {chon &&
        (() => {
          const { x, y } = xy(chon);
          const ten = tenTau(chon.tau);
          const trai = x > 40;
          return (
            <text x={x + (trai ? -10 : 10)} y={y + 2} fontSize={6} fontWeight={600} textAnchor={trai ? "end" : "start"} fill="currentColor" stroke="var(--navy)" strokeWidth={2} paintOrder="stroke">
              {ten.length > 18 ? `${ten.slice(0, 17)}…` : ten}
            </text>
          );
        })()}
    </svg>
  );
}
