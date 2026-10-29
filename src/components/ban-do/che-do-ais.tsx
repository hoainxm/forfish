"use client";

/*
  CHẾ ĐỘ AIS — RADAR + CPA/TCPA (2026-10-29, anh Long: "tổ chức cho tàu xem được AIS xem quanh … đổi qua chế
  độ AIS, triển khai với acc 0938635689"). Màn phủ trên bản đồ: radar tầm 2/4/6/12 hải lý quanh tàu mình,
  đếm theo mức (nguy hiểm/cảnh báo/an toàn/đang đứng), chip lọc, danh sách xếp nguy trước, chạm tàu ⇒ thẻ
  CPA/TCPA, nút Hải đồ về bản đồ bay tới tàu đó. Logic thuần ở lib/ais-cpa (có test).

  Tầm radar: vòng NGOÀI = tầm đang chọn, ba vòng chia đều; nhãn vòng ghi cả hải lý lẫn km (anh Long 29/10:
  "vòng radar bao nhiêu km? cần xác định"). Mặc định 6 hải lý = 11,1 km.

  Nói thật về dữ liệu: bản AIS ~10 phút một lần, vị trí đã ƯỚC theo tốc độ/hướng trong tin ⇒ dòng nhắc ở cuối
  luôn hiện; tin cũ hơn 30 phút mờ đi và không bao giờ báo nguy. Không GPS ⇒ lấy điểm đang xem trên bản đồ làm
  tâm, nói rõ và mời bật định vị. Mất sóng ⇒ bản lưu trong máy (lib/tau-ais), nói "bản lưu trong máy".
*/
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CloseButton } from "@/components/ui/close-button";
import { ChipRow } from "@/components/ui/chip-row";
import {
  KM_PER_NM,
  MAU_MUC,
  MUC_LABEL,
  TAM_RADAR_NM,
  demMuc,
  hlLabel,
  locMucTieu,
  quetQuanh,
  tcpaLabel,
  type LocAis,
  type MucTieu,
  type TauMinh,
} from "@/lib/ais-cpa";
import type { LatLon } from "@/lib/geo";
import { NHAN } from "@/lib/labels";
import { fmtCoordPair, type MapPrefs } from "@/lib/map-prefs";
import { MAU_TAU, loaiTauLabel, nhomTau, tuoiTinLabel, type TauAisBan } from "@/lib/tau-ais";

type TamNm = (typeof TAM_RADAR_NM)[number];
/** số dòng danh sách vẽ một lần — vùng cảng đông có thể vài trăm tàu trong 12 hải lý */
const DS_TOI_DA = 60;
/** vạch vận tốc trên radar = quãng đi trong 12 phút */
const VECTOR_PHUT = 12;

const kmLabel = (nm: number) => `${(nm * KM_PER_NM).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} km`;
const knLabel = (kmh: number | null) =>
  kmh == null ? "—" : `${(kmh / KM_PER_NM).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} hải lý/h`;

function mauMucTieu(m: MucTieu): string {
  if (m.muc === "nguy" || m.muc === "canh") return MAU_MUC[m.muc];
  return MAU_TAU[nhomTau(m.tau.loai)];
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
  onClose,
}: {
  ban: TauAisBan | null;
  state: "idle" | "loading" | "error" | "ok";
  tuKho: boolean;
  /** tàu mình theo GPS — null khi chưa bật/không có định vị */
  gps: TauMinh | null;
  /** tâm dự phòng khi không có GPS: điểm đang xem trên bản đồ */
  diemXem: LatLon;
  prefs: MapPrefs;
  onRetry: () => void;
  onDinhVi: () => void;
  onHaiDo: (m: MucTieu) => void;
  onClose: () => void;
}) {
  const [tam, setTam] = useState<TamNm>(6);
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
  const dem = useMemo(() => demMuc(ds), [ds]);
  const hien = useMemo(() => locMucTieu(ds, loc), [ds, loc]);
  const chon = chonId ? ds.find((m) => m.tau.id === chonId) ?? null : null;

  /*  Cổng ra <body> (như can-giay-sheet): khung bản đồ tạo ngữ cảnh xếp lớp riêng ⇒ ở trong đó dock và
      popover Lớp đè lên màn phủ dù z cao. */
  return createPortal(
    <div className="fixed inset-0 z-[90] mx-auto flex max-w-(--w-app) flex-col bg-background" role="dialog" aria-modal="true" aria-label={NHAN.radarAis}>
      <div className="flex items-center gap-2 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="min-w-0 flex-1">
          <h2 className="text-[1.25rem] font-semibold leading-tight text-navy">{NHAN.radarAis}</h2>
          <p className="text-[0.8125rem] text-foreground/60">
            Tàu quanh mình
            {ban ? ` · bản lúc ${new Date(ban.luc).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}` : ""}
            {tuKho ? " · bản lưu trong máy" : ""}
          </p>
        </div>
        <CloseButton onClose={onClose} label="Đóng radar AIS" />
      </div>

      <div className="flex-1 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
        {/* TÀU MÌNH — tâm radar */}
        <div className="mx-4 mb-3 rounded-2xl bg-card p-3 surface">
          {gps ? (
            <div className="grid grid-cols-3 gap-2 text-[0.8125rem]">
              <div className="col-span-3 text-foreground/60">Tàu mình · {fmtCoordPair(gps.pos.lat, gps.pos.lon, prefs.coordFormat)}</div>
              <div>
                <p className="text-foreground/55">Tốc độ</p>
                <p className="text-[1rem] font-semibold text-navy">{knLabel(gps.speedKmh)}</p>
              </div>
              <div>
                <p className="text-foreground/55">Hướng</p>
                <p className="text-[1rem] font-semibold text-navy">{gps.headingDeg != null ? `${Math.round(gps.headingDeg)}°` : "—"}</p>
              </div>
              <div>
                <p className="text-foreground/55">Tầm</p>
                <p className="text-[1rem] font-semibold text-navy">{kmLabel(tam)}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <p className="min-w-0 flex-1 text-[0.8125rem] text-foreground/70">
                Chưa có định vị — đang lấy điểm xem trên bản đồ làm tâm, chưa tính được tàu nào sắp tới gần mình.
              </p>
              <button type="button" onClick={onDinhVi} className="h-(--h-chip) min-w-[5.5rem] flex-none rounded-full bg-navy px-3 text-[0.875rem] font-semibold text-white active:scale-[0.98]">
                {NHAN.dinhVi}
              </button>
            </div>
          )}
        </div>

        <ChipRow
          ariaLabel="Tầm radar"
          options={TAM_RADAR_NM.map((n) => ({ id: String(n), label: `${n} hải lý` }))}
          value={String(tam)}
          onChange={(id) => setTam(Number(id) as TamNm)}
        />

        <Radar ds={ds} tam={tam} gps={gps} chonId={chon?.tau.id ?? null} onChon={setChonId} />

        {state === "loading" && !ban && <p className="mx-4 mt-3 text-[0.875rem] text-foreground/60">Đang tải vị trí tàu…</p>}
        {state === "error" && !ban && (
          <button type="button" onClick={onRetry} className="mx-4 mt-3 w-[calc(100%-2rem)] rounded-xl bg-field px-3 py-2.5 text-left text-[0.875rem] text-foreground/75 active:scale-[0.99]">
            Chưa tải được vị trí tàu — cần có sóng lần đầu. Chạm để thử lại.
          </button>
        )}

        {ban && (
          <>
            <div className="mx-4 mt-3 grid grid-cols-4 gap-2">
              {(["nguy", "canh", "an", "dung"] as const).map((k) => (
                <div key={k} className="rounded-xl bg-card px-2 py-2 text-center surface">
                  <p className="text-[1.25rem] font-semibold leading-none" style={k === "nguy" || k === "canh" ? { color: MAU_MUC[k] } : undefined}>
                    {dem[k]}
                  </p>
                  <p className="mt-1 text-[0.75rem] text-foreground/60">{MUC_LABEL[k]}</p>
                </div>
              ))}
            </div>

            {chon && <TheMucTieu m={chon} prefs={prefs} coGps={!!gps} onHaiDo={() => onHaiDo(chon)} onBo={() => setChonId(null)} />}

            <div className="mt-3">
              <ChipRow
                level={2}
                ariaLabel="Lọc tàu"
                options={[
                  { id: "tat", label: NHAN.tatCa },
                  { id: "nguy", label: NHAN.nguyHiem },
                  { id: "canh", label: NHAN.canhBao },
                  { id: "ca", label: NHAN.tauCa },
                ]}
                value={loc}
                onChange={setLoc}
              />
            </div>

            {hien.length === 0 ? (
              <p className="mx-4 text-[0.875rem] text-foreground/60">
                {ds.length === 0 ? `Không có tàu phát AIS trong ${tam} hải lý (${kmLabel(tam)}).` : "Không có tàu nào khớp bộ lọc."}
              </p>
            ) : (
              <ul className="mx-4 overflow-hidden rounded-2xl bg-card surface">
                {hien.slice(0, DS_TOI_DA).map((m) => (
                  <li key={m.tau.id} className="border-b border-line last:border-b-0">
                    <button
                      type="button"
                      onClick={() => setChonId(m.tau.id)}
                      aria-pressed={chon?.tau.id === m.tau.id}
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-field ${chon?.tau.id === m.tau.id ? "bg-field" : ""} ${m.tinCu ? "opacity-60" : ""}`}
                    >
                      <span className="inline-block h-3 w-3 flex-none rounded-full" style={{ backgroundColor: mauMucTieu(m) }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.9375rem] font-semibold text-navy">{m.tau.ten ?? "Tàu chưa rõ tên"}</span>
                        <span className="block truncate text-[0.75rem] text-foreground/60">
                          {loaiTauLabel(m.tau.loai)}
                          {m.tau.co ? ` · ${m.tau.co}` : ""} · {MUC_LABEL[m.muc].toLowerCase()}
                          {m.tinCu ? " · tin cũ" : ""}
                        </span>
                      </span>
                      <span className="flex-none text-right">
                        <span className="block text-[0.875rem] font-semibold text-foreground/85">{hlLabel(m.cachNm)}</span>
                        <span className="block text-[0.75rem] text-foreground/60">
                          {gps && !m.tinCu && m.cpaNm != null && m.tcpaPhut != null && m.tcpaPhut >= 0
                            ? `CPA ${hlLabel(m.cpaNm)} · ${tcpaLabel(m.tcpaPhut)}`
                            : `${Math.round(m.phuongVi)}°`}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {hien.length > DS_TOI_DA && (
              <p className="mx-4 mt-1.5 text-[0.75rem] text-foreground/55">
                Còn {(hien.length - DS_TOI_DA).toLocaleString("vi-VN")} tàu xa hơn — thu tầm radar để xem gọn.
              </p>
            )}
          </>
        )}

        <p className="mx-4 mt-3 text-[0.75rem] leading-snug text-foreground/55">
          Vị trí tàu cập nhật khoảng 10 phút một lần, app ước tới hiện tại theo tốc độ và hướng trong tin. Tàu không
          bật AIS sẽ không hiện. Chỉ để tham khảo — luôn canh chừng bằng mắt và radar trên tàu.
        </p>
      </div>
    </div>,
    document.body,
  );
}

function TheMucTieu({ m, prefs, coGps, onHaiDo, onBo }: { m: MucTieu; prefs: MapPrefs; coGps: boolean; onHaiDo: () => void; onBo: () => void }) {
  const t = m.tau;
  const o = (nhan: string, gt: string) => (
    <div>
      <p className="text-[0.75rem] text-foreground/55">{nhan}</p>
      <p className="text-[0.9375rem] font-semibold text-navy">{gt}</p>
    </div>
  );
  return (
    <div className="mx-4 mt-3 rounded-2xl bg-card p-3 surface">
      <div className="flex items-start gap-2">
        <span className="mt-1.5 inline-block h-3.5 w-3.5 flex-none rounded-full" style={{ backgroundColor: mauMucTieu(m) }} />
        <div className="min-w-0 flex-1">
          <p className="text-[1.125rem] font-semibold leading-tight text-navy">{t.ten ?? "Tàu chưa rõ tên"}</p>
          <p className="text-[0.8125rem] text-foreground/65">
            {loaiTauLabel(t.loai)}
            {t.co ? ` · ${t.co}` : ""}
            {t.dai ? ` · ${t.dai} m` : ""}
            {t.dich ? ` · đến ${t.dich}` : ""}
          </p>
        </div>
        {(m.muc === "nguy" || m.muc === "canh") && (
          <span className="flex-none rounded-full px-2 py-0.5 text-[0.75rem] font-semibold text-white" style={{ backgroundColor: MAU_MUC[m.muc] }}>
            {MUC_LABEL[m.muc]}
          </span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {o("Khoảng cách", hlLabel(m.cachNm))}
        {o("Phương vị", `${Math.round(m.phuongVi)}°`)}
        {o("Tốc độ", t.kn == null ? "—" : t.kn < 0.5 ? "đang đứng" : `${t.kn.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} hải lý/h`)}
        {o("CPA", coGps && !m.tinCu && m.cpaNm != null ? hlLabel(m.cpaNm) : "—")}
        {o("TCPA", coGps && !m.tinCu ? tcpaLabel(m.tcpaPhut) : "—")}
        {o("Hướng", t.huong != null ? `${t.huong}°` : "—")}
      </div>
      <p className="mt-2 text-[0.75rem] text-foreground/55">
        {fmtCoordPair(m.pos.lat, m.pos.lon, prefs.coordFormat)} (đã ước) · tin {tuoiTinLabel(m.tuoiPhut)}
        {m.tinCu ? " — tin cũ, không dùng để tránh va" : ""}
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onHaiDo} className="h-(--h-chip) min-w-[5.5rem] rounded-full bg-navy px-3 text-[0.875rem] font-semibold text-white active:scale-[0.98]">
          {NHAN.haiDo}
        </button>
        <button type="button" onClick={onBo} className="h-(--h-chip) min-w-[5.5rem] rounded-full bg-field px-3 text-[0.875rem] font-semibold text-foreground/80 active:scale-[0.98]">
          {NHAN.boChon}
        </button>
      </div>
    </div>
  );
}

/** Radar Bắc-lên: tâm = tàu mình, vòng ngoài = `tam` hải lý, ba vòng chia đều có nhãn hải lý + km. */
function Radar({ ds, tam, gps, chonId, onChon }: { ds: MucTieu[]; tam: number; gps: TauMinh | null; chonId: string | null; onChon: (id: string) => void }) {
  const R = 100;
  const k = R / tam;
  const vong = [1, 2, 3].map((i) => (tam * i) / 3);
  const huong = gps?.headingDeg;
  return (
    <div className="mx-4 rounded-2xl bg-navy p-2 text-white">
      <svg viewBox="-112 -112 224 224" className="mx-auto block aspect-square w-full max-w-[28rem]" role="img" aria-label={`Radar tầm ${tam} hải lý`}>
        {vong.map((nm, i) => (
          <g key={nm}>
            <circle r={(R * (i + 1)) / 3} fill="none" stroke="currentColor" strokeOpacity={i === 2 ? 0.55 : 0.3} strokeWidth={0.6} />
            <text x={2} y={-(R * (i + 1)) / 3 + 5} fontSize={5.2} fill="currentColor" fillOpacity={0.75}>
              {nm.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} hl · {kmLabel(nm)}
            </text>
          </g>
        ))}
        <line x1={-R} y1={0} x2={R} y2={0} stroke="currentColor" strokeOpacity={0.18} strokeWidth={0.5} />
        <line x1={0} y1={-R} x2={0} y2={R} stroke="currentColor" strokeOpacity={0.18} strokeWidth={0.5} />
        <text x={0} y={-R - 3} fontSize={7} textAnchor="middle" fill="currentColor" fontWeight={600}>
          B
        </text>

        {ds.map((m) => {
          const r = Math.min(m.cachNm, tam) * k;
          const x = r * Math.sin((m.phuongVi * Math.PI) / 180);
          const y = -r * Math.cos((m.phuongVi * Math.PI) / 180);
          const mau = mauMucTieu(m);
          const dang = m.tau.kn != null && m.tau.kn >= 0.5 && m.tau.huong != null;
          const vec = dang ? ((m.tau.kn as number) * VECTOR_PHUT) / 60 * k : 0;
          const h = m.tau.huong ?? 0;
          const chon = m.tau.id === chonId;
          return (
            <g key={m.tau.id} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`} opacity={m.tinCu ? 0.45 : 1} onClick={() => onChon(m.tau.id)} className="cursor-pointer">
              <circle r={7} fill="transparent" />
              {dang && <line x1={0} y1={0} x2={vec * Math.sin((h * Math.PI) / 180)} y2={-vec * Math.cos((h * Math.PI) / 180)} stroke={mau} strokeWidth={0.8} />}
              {dang ? (
                <path d="M0 -4.2 L2.8 3 L0 1.6 L-2.8 3 Z" fill={mau} transform={`rotate(${h})`} />
              ) : (
                <circle r={2.2} fill={mau} />
              )}
              {chon && <rect x={-6} y={-6} width={12} height={12} fill="none" stroke="currentColor" strokeWidth={0.9} />}
            </g>
          );
        })}

        {/* tàu mình */}
        {huong != null ? (
          <g transform={`rotate(${huong})`}>
            <line x1={0} y1={0} x2={0} y2={-R} stroke="currentColor" strokeOpacity={0.6} strokeWidth={0.7} strokeDasharray="2 2" />
            <path d="M0 -6 L4 4.5 L0 2.4 L-4 4.5 Z" fill="currentColor" />
          </g>
        ) : (
          <circle r={3.2} fill="currentColor" />
        )}
      </svg>
      <p className="pb-1 text-center text-[0.75rem] text-white/70">
        Vòng ngoài {tam} hải lý = {kmLabel(tam)} · mỗi vòng {(tam / 3).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} hải lý · vạch = quãng đi {VECTOR_PHUT} phút
      </p>
    </div>
  );
}
