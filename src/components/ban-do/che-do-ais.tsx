"use client";

/*
  CHẾ ĐỘ AIS (2026-10-29; ai thấy: quyền `aisAllowed`, ô quản trị tau_ais_xem — mặc định chỉ 0938635689). Vào từ ô
  AIS trên rail bản đồ; hai cách xem chọn bằng `CheDoTabs`, CẢ HAI ĐỀU TRÊN NỀN BẢN ĐỒ, dock vẫn giữ:
   · BÁN KÍNH (`AisBanKinh`) — vòng radar vẽ THẲNG LÊN BẢN ĐỒ quanh tàu mình (lib/ais-cpa radarGeoJson, Source
     `ais-radar` ở fishing-map-view), mục tiêu ở vị trí đã ước + vạch 12 phút; thẻ nổi trên: câu nguy cơ, tầm − / +,
     danh sách gập được.
   · TOÀN BIỂN (`AisToanBien`) — bản đồ cả vùng biển: tìm tàu theo tên/số hiệu, lọc tàu cá, chú giải màu.

  Vì sao lên nền bản đồ (anh Long 29/10: "vẫn giữ cái bottom menu với vòng rada, rồi radar nó show trên nền bản đồ
  chứ đừng có làm đen thui thế, tham khảo các bên khác"): MarineTraffic, Navionics, máy định vị có lớp radar/AIS
  đều vẽ vòng tầm + mục tiêu chồng lên hải đồ — người đi biển đọc tàu lạ CÙNG đảo, phao, bãi cạn quanh đó; một màn
  đen riêng cắt mất bối cảnh đó và che mất dock.

  Bà con mở AIS để hỏi ba câu, theo thứ tự (rà design 29/10):
    1. "Có tàu nào sắp đi sát mình không?" ⇒ câu `tomTatNguyCo` tô màu đỏ/vàng/xanh đầu thẻ.
    2. "Quanh đây có những tàu nào?" ⇒ vòng + chấm trên bản đồ; danh sách nói câu đời thường ("Cách 1,1 hải lý ·
       phía Đông Bắc", "Đi sát 260 m sau 7 phút"); chạm dòng hoặc chạm chấm ⇒ chi tiết ngay dưới dòng.
    3. "Tàu bạn (số hiệu …) đang ở đâu?" ⇒ ô tìm ở Toàn biển.

  Tầm radar: vòng NGOÀI = tầm đang chọn, ba vòng chia đều, nhãn mỗi vòng ghi hải lý + km (anh Long: "vòng radar
  bao nhiêu km? cần xác định"). Mặc định 6 hải lý = 11,1 km.

  Nói thật về dữ liệu: bản AIS ~10 phút một lần, vị trí đã ƯỚC theo tốc độ/hướng trong tin; tin cũ hơn 30 phút mờ
  và không bao giờ báo nguy. Không GPS ⇒ tâm là điểm đang xem, câu đầu mời bật định vị. Mất sóng ⇒ bản lưu trong máy.
*/
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDownIcon, ChevronLeftIcon, MinusIcon, PlusIcon, SearchIcon } from "@/components/icons";
import { CloseButton } from "@/components/ui/close-button";
import { SearchField } from "@/components/ui/search-field";
import {
  KM_PER_NM,
  dongPhuTau,
  hlLabel,
  huongChu,
  locMucTieu,
  mauMucTieu,
  quangNgan,
  tcpaLabel,
  tomTatNguyCo,
  type LocAis,
  type MucTieu,
} from "@/lib/ais-cpa";
import { haversineKm, type LatLon } from "@/lib/geo";
import { NHAN } from "@/lib/labels";
import { fmtCoordPair, type MapPrefs } from "@/lib/map-prefs";
import { MAU_TAU, demTheoNhom, loaiTauLabel, nhomTau, timTau, tuoiTinLabel, type TauAis, type TauAisBan } from "@/lib/tau-ais";

export type CheDoAisXem = "ban-kinh" | "toan-bien";
type TaiState = "idle" | "loading" | "error" | "ok";

/** số dòng danh sách vẽ một lần — vùng cảng đông có thể vài trăm tàu trong 24 hải lý */
const DS_TOI_DA = 60;

const kmLabel = (nm: number) => `${(nm * KM_PER_NM).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} km`;
const so1 = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 1 });
const banLucLabel = (ban: TauAisBan) => new Date(ban.luc).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
const tenTau = (t: TauAis) => t.ten ?? "Tàu chưa rõ tên";

/** Hai cách xem của chế độ AIS — segmented GỌN (h-9), nhãn ≤2 chữ (labels.ts). */
export function CheDoTabs({ value, onChange }: { value: CheDoAisXem; onChange: (v: CheDoAisXem) => void }) {
  const ds: { id: CheDoAisXem; label: string }[] = [
    { id: "ban-kinh", label: NHAN.banKinh },
    { id: "toan-bien", label: NHAN.toanBien },
  ];
  return (
    <div role="tablist" aria-label="Cách xem AIS" className="flex min-w-0 flex-1 gap-0.5 rounded-full bg-field p-0.5">
      {ds.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={o.id === value}
          onClick={() => onChange(o.id)}
          className={`h-9 flex-1 rounded-full px-2 text-[0.8125rem] font-semibold transition-colors ${o.id === value ? "bg-navy text-white" : "text-foreground/70"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Hàng đầu MỘT dòng của cả hai thẻ (anh Long: "gọn vào, diện tích đừng lấn chiếm"): cách xem · nút phụ · ✕. */
function DauThe({ xem, onDoi, onClose, children }: { xem: CheDoAisXem; onDoi: () => void; onClose: () => void; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1">
      <CheDoTabs value={xem} onChange={(v) => v !== xem && onDoi()} />
      {children}
      <CloseButton onClose={onClose} label="Thoát chế độ AIS" />
    </div>
  );
}

const NHOM_LABEL: Record<keyof typeof MAU_TAU, string> = { ca: "Cá", hang: "Hàng", dau: "Dầu", khach: "Khách", khac: "Khác" };

function TaiLoi({ state, ban, onRetry }: { state: TaiState; ban: TauAisBan | null; onRetry: () => void }) {
  if (ban) return null;
  if (state === "loading") return <p className="mt-1.5 px-1 text-[0.8125rem] text-foreground/60">Đang tải vị trí tàu…</p>;
  if (state === "error")
    return (
      <button type="button" onClick={onRetry} className="mt-1.5 w-full rounded-xl bg-field px-3 py-2 text-left text-[0.8125rem] text-foreground/75 active:scale-[0.99]">
        Chưa tải được vị trí tàu — cần có sóng lần đầu. Chạm để thử lại.
      </button>
    );
  return null;
}

/**
 * Thẻ nổi "Toàn biển" — đầu cột trái cụm trên bản đồ. Mặc định HAI dòng: [cách xem · 🔍 · ✕] và [Tàu cá · số tàu ·
 * chú giải màu]. Tìm tàu chỉ là nút kính lúp; chạm mới mở ô gõ (thay hàng đầu), xong/← là thu về.
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
  const [tim, setTim] = useState(false);
  const [q, setQ] = useState("");
  const dem = useMemo(() => (ban ? demTheoNhom(ban.tau) : null), [ban]);
  const kq = useMemo(() => (ban ? timTau(ban.tau, q) : []), [ban, q]);
  const dangTim = q.trim().length >= 2;
  const oTimRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (tim) oTimRef.current?.querySelector("input")?.focus();
  }, [tim]);
  const dongTim = () => {
    setTim(false);
    setQ("");
  };
  return (
    <div className="pointer-events-auto rounded-2xl bg-card/97 p-2 shadow-xl">
      {tim ? (
        <div ref={oTimRef} className="flex items-center gap-1">
          <button type="button" onClick={dongTim} aria-label="Đóng tìm tàu" className="flex h-11 w-9 flex-none items-center justify-center rounded-full text-navy active:bg-field">
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <SearchField className="min-w-0 flex-1" value={q} onChange={setQ} placeholder="Tên hoặc số hiệu tàu" label="Tìm tàu theo tên hoặc số hiệu" />
        </div>
      ) : (
        <DauThe xem="toan-bien" onDoi={onBanKinh} onClose={onClose}>
          {ban && (
            <button type="button" onClick={() => setTim(true)} aria-label="Tìm tàu theo tên hoặc số hiệu" className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-navy active:bg-field">
              <SearchIcon className="h-5 w-5" />
            </button>
          )}
        </DauThe>
      )}

      <TaiLoi state={state} ban={ban} onRetry={onRetry} />

      {ban && dem && tim && dangTim && (
        kq.length === 0 ? (
          <p className="mt-1.5 px-2 text-[0.8125rem] text-foreground/60">Không thấy tàu nào tên &ldquo;{q.trim()}&rdquo; đang phát AIS.</p>
        ) : (
          <ul className="mt-1 max-h-[36dvh] overflow-y-auto overscroll-contain">
            {kq.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => {
                    dongTim();
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
      )}
      {ban && dem && tim && !dangTim && <p className="mt-1.5 px-2 text-[0.75rem] text-foreground/55">Gõ ít nhất 2 ký tự, vd &ldquo;92468&rdquo;.</p>}

      {ban && dem && !tim && (
        <div className="mt-1.5 flex items-center gap-2 px-0.5">
          <button
            type="button"
            aria-pressed={chiTauCa}
            onClick={() => onChiTauCa(!chiTauCa)}
            className={`h-8 flex-none rounded-full border px-3 text-[0.8125rem] font-semibold transition-colors ${chiTauCa ? "border-navy bg-navy text-white" : "border-line text-foreground/75"}`}
          >
            {NHAN.tauCa}
          </button>
          <p className="min-w-0 flex-1 truncate text-[0.75rem] text-foreground/60">
            {(chiTauCa ? dem.ca : ban.soTau).toLocaleString("vi-VN")} tàu · bản {banLucLabel(ban)}
            {tuKho ? " · lưu trong máy" : ""}
          </p>
          {!chiTauCa && (
            <span className="flex flex-none items-center gap-1" aria-label="Màu: cam tàu cá, xám tàu hàng, đỏ tàu dầu, xanh tàu khách">
              {(Object.keys(NHOM_LABEL) as (keyof typeof MAU_TAU)[]).map((k) => (
                <span key={k} title={NHOM_LABEL[k]} className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: MAU_TAU[k] }} />
              ))}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Thẻ nổi "Bán kính" — vòng radar + mục tiêu do fishing-map-view vẽ lên bản đồ từ cùng `ds`; thẻ chỉ nói và điều
 * khiển, GỌN BA DÒNG: [cách xem · ✕] · câu nguy cơ (chạm mở danh sách tới gần) · [tầm − / + · N tàu ▾].
 */
export function AisBanKinh({
  ban,
  state,
  tuKho,
  ds,
  coGps,
  tam,
  coTheThu,
  coTheMo,
  onTam,
  chonId,
  onChon,
  onXemTau,
  prefs,
  onDinhVi,
  onRetry,
  onToanBien,
  onClose,
}: {
  ban: TauAisBan | null;
  state: TaiState;
  tuKho: boolean;
  /** mục tiêu trong tầm — lib/ais-cpa quetQuanh, xếp nguy → cảnh → an → đứng */
  ds: MucTieu[];
  coGps: boolean;
  /** tầm đang chọn (hải lý) */
  tam: number;
  coTheThu: boolean;
  coTheMo: boolean;
  /** −1 thu tầm, +1 mở tầm */
  onTam: (buoc: -1 | 1) => void;
  chonId: string | null;
  onChon: (id: string | null) => void;
  onXemTau: (m: MucTieu) => void;
  prefs: MapPrefs;
  onDinhVi: () => void;
  onRetry: () => void;
  onToanBien: () => void;
  onClose: () => void;
}) {
  const tomTat = tomTatNguyCo(ds, coGps, tam);
  const coGan = tomTat.muc === "nguy" || tomTat.muc === "canh";
  /*  Danh sách GẬP mặc định — vòng radar trên bản đồ là thứ chính, mở danh sách là che nó. Có tàu tới gần thì câu
      cảnh báo nêu tên tàu; chạm câu đó mới mở danh sách lọc "Tới gần". */
  const [moDs, setMoDs] = useState(false);
  const tenGan = useMemo(
    () => ds.filter((m) => m.muc === "nguy" || m.muc === "canh").slice(0, 2).map((m) => tenTau(m.tau)),
    [ds],
  );
  const [loc, setLoc] = useState<LocAis>("tat");
  const hien = useMemo(() => locMucTieu(ds, loc), [ds, loc]);
  const listRef = useRef<HTMLUListElement>(null);

  /*  Chạm chấm trên bản đồ ⇒ cha đặt `chonId` ⇒ mở danh sách, bỏ lọc nếu nó giấu tàu đó, cuộn tới dòng. */
  useEffect(() => {
    if (!chonId) return;
    setMoDs(true);
    setLoc((l) => (l === "tat" || locMucTieu(ds, l).some((m) => m.tau.id === chonId) ? l : "tat"));
    const id = window.setTimeout(() => listRef.current?.querySelector(`[data-id="${CSS.escape(chonId)}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 60);
    return () => window.clearTimeout(id);
  }, [chonId, ds]);

  const mauTomTat =
    tomTat.muc === "nguy"
      ? "bg-danger-bg text-danger"
      : tomTat.muc === "canh"
        ? "bg-warn-bg text-warn"
        : tomTat.muc === "an"
          ? "bg-ok-bg text-ok"
          : "bg-field text-foreground/75";

  return (
    <div className="pointer-events-auto rounded-2xl bg-card/97 p-2 shadow-xl">
      <DauThe xem="ban-kinh" onDoi={onToanBien} onClose={onClose} />
      <TaiLoi state={state} ban={ban} onRetry={onRetry} />

      {ban && (
        <>
          {/* câu nguy cơ — có tàu tới gần thì nêu tên + chạm mở danh sách "Tới gần" */}
          <div role={tomTat.muc === "nguy" ? "alert" : "status"} className={`mt-1.5 flex items-center gap-2 rounded-xl ${mauTomTat}`}>
            {coGan ? (
              <button
                type="button"
                onClick={() => {
                  setLoc("gan");
                  setMoDs(true);
                }}
                className="min-w-0 flex-1 px-3 py-1.5 text-left active:opacity-80"
              >
                <span className="block truncate text-[0.8125rem] font-medium leading-snug">{tomTat.cau}</span>
                <span className="block truncate text-[0.75rem] opacity-85">{tenGan.join(" · ")} — chạm xem</span>
              </button>
            ) : (
              <p className="min-w-0 flex-1 truncate px-3 py-2 text-[0.8125rem] font-medium leading-snug">{tomTat.cau}</p>
            )}
            {tomTat.muc === "chua-gps" && (
              <button type="button" onClick={onDinhVi} className="mr-1.5 h-8 min-w-[5rem] flex-none rounded-full bg-navy px-3 text-[0.8125rem] font-semibold text-white active:scale-[0.98]">
                {NHAN.dinhVi}
              </button>
            )}
          </div>

          {/* tầm − / + ; số tàu ▾ mở danh sách */}
          <div className="mt-1.5 flex items-center gap-1">
            <button type="button" onClick={() => onTam(-1)} disabled={!coTheThu} aria-label="Thu nhỏ tầm radar" className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-field text-navy transition active:scale-95 disabled:opacity-35">
              <MinusIcon className="h-4 w-4" />
            </button>
            <p className="min-w-0 px-1 text-center leading-tight" aria-live="polite">
              <span className="block text-[0.8125rem] font-semibold text-navy">{tam} hải lý</span>
              <span className="block text-[0.6875rem] text-foreground/60">{kmLabel(tam)}</span>
            </p>
            <button type="button" onClick={() => onTam(1)} disabled={!coTheMo} aria-label="Mở rộng tầm radar" className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-field text-navy transition active:scale-95 disabled:opacity-35">
              <PlusIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setMoDs((v) => !v)}
              aria-expanded={moDs}
              className="ml-auto flex h-9 min-w-0 items-center gap-1 rounded-full px-2.5 text-[0.8125rem] font-semibold text-navy active:bg-field"
            >
              <span className="truncate">{ds.length.toLocaleString("vi-VN")} tàu</span>
              <ChevronDownIcon className={`h-4 w-4 flex-none transition-transform ${moDs ? "rotate-180" : ""}`} />
            </button>
          </div>

          {moDs && (
            <div className="mt-1.5">
              <div className="flex gap-0.5 rounded-full bg-field p-0.5" role="group" aria-label="Lọc tàu">
                {(
                  [
                    ["tat", NHAN.tatCa],
                    ["gan", NHAN.toiGan],
                    ["ca", NHAN.tauCa],
                  ] as const
                ).map(([id, nhan]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={loc === id}
                    onClick={() => setLoc(id)}
                    className={`h-8 flex-1 rounded-full px-2 text-[0.8125rem] font-semibold transition-colors ${loc === id ? "bg-card text-navy shadow-sm" : "text-foreground/65"}`}
                  >
                    {nhan}
                  </button>
                ))}
              </div>
              {hien.length === 0 ? (
                <p className="mt-1.5 px-1 text-[0.8125rem] text-foreground/60">
                  {ds.length === 0
                    ? `Không có tàu phát AIS trong ${tam} hải lý. Bấm + để xem xa hơn.`
                    : loc === "gan"
                      ? "Không có tàu nào đang tới gần."
                      : "Không có tàu cá nào trong tầm này."}
                </p>
              ) : (
                <ul ref={listRef} className="mt-1.5 max-h-[24dvh] overflow-y-auto overscroll-contain rounded-xl border border-line">
                  {hien.slice(0, DS_TOI_DA).map((m) => {
                    const mo = chonId === m.tau.id;
                    return (
                      <li key={m.tau.id} data-id={m.tau.id} className="border-b border-line last:border-b-0">
                        <button
                          type="button"
                          onClick={() => onChon(mo ? null : m.tau.id)}
                          aria-expanded={mo}
                          className={`flex w-full items-center gap-2.5 px-3 py-2 text-left active:bg-field ${mo ? "bg-field" : ""} ${m.tinCu ? "opacity-60" : ""}`}
                        >
                          <span className="inline-block h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: mauMucTieu(m) }} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[0.875rem] font-semibold text-navy">{tenTau(m.tau)}</span>
                            <span className={`block truncate text-[0.75rem] ${m.muc === "nguy" ? "font-medium text-danger" : m.muc === "canh" ? "font-medium text-warn" : "text-foreground/60"}`}>
                              {dongPhuTau(m, coGps)}
                            </span>
                          </span>
                          <span className="flex-none text-[0.6875rem] text-foreground/50">{loaiTauLabel(m.tau.loai)}</span>
                        </button>
                        {mo && <ChiTietTau m={m} prefs={prefs} coGps={coGps} onXemTau={() => onXemTau(m)} />}
                      </li>
                    );
                  })}
                  {hien.length > DS_TOI_DA && (
                    <li className="px-3 py-2 text-[0.75rem] text-foreground/55">Còn {(hien.length - DS_TOI_DA).toLocaleString("vi-VN")} tàu xa hơn — bấm − để thu tầm.</li>
                  )}
                </ul>
              )}
              <p className="mt-1.5 px-1 text-[0.6875rem] leading-snug text-foreground/55">
                Bản lúc {banLucLabel(ban)}
                {tuKho ? " (lưu trong máy)" : ""}, khoảng 10 phút một bản, vị trí đã ước. Tàu không bật AIS sẽ không hiện — luôn canh chừng bằng mắt.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Chi tiết một tàu — câu đời thường trước, số kỹ thuật (CPA/TCPA, độ) để nhỏ cho người cần. */
function ChiTietTau({ m, prefs, coGps, onXemTau }: { m: MucTieu; prefs: MapPrefs; coGps: boolean; onXemTau: () => void }) {
  const t = m.tau;
  const chay = t.kn != null && t.kn >= 0.5;
  const tinhDuoc = coGps && !m.tinCu && m.cpaNm != null && m.tcpaPhut != null;
  return (
    <div className="bg-field px-3 pb-2.5 pt-0.5 text-[0.8125rem] leading-snug text-foreground/80">
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
      <button type="button" onClick={onXemTau} className="mt-2 h-9 min-w-[5.5rem] rounded-full bg-navy px-4 text-[0.8125rem] font-semibold text-white active:scale-[0.98]">
        {NHAN.xemTau}
      </button>
    </div>
  );
}

