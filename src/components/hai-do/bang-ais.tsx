"use client";

/*
  DANH SÁCH TÀU AIS — chế độ Hải đồ, bảng §8 hàng 11 (2026-11-04, sau đợt 4).
  Đối chiếu iSailor AIS list (lọc, sắp theo tên/cự ly/TCPA, thẻ tàu) + OpenCPN AIS
  Target List. Ngăn đáy như bảng Tuyến/Vết; mở từ khay ⋯ → Tàu (chỉ khi lớp AIS bật).

  Trên đầu: câu nguy cơ (`tomTatNguyCo`) — câu đầu tiên bà con cần. Dưới: lọc (Tất cả ·
  Tới gần · Tàu cá), xếp (Sắp gặp · Gần nhất · Tên), tầm (6/12/24 hải lý). Mỗi dòng: tên,
  câu đời thường (`dongPhuTau`), chấm màu theo mức. Chạm dòng ⇒ bay tới tàu + tấm chạm.
  Tin cũ hơn 30 phút mờ và không bao giờ báo nguy (luật `ais-cpa`).
*/
import { NHAN } from "@/lib/labels";
import { dongPhuTau, locMucTieu, mauMucTieu, tomTatNguyCo, type LocAis, type MucTieu } from "@/lib/ais-cpa";
import { SAP_AIS, sapMucTieu, type SapAis } from "@/lib/hai-do/lop";
import { tuoiTinLabel } from "@/lib/tau-ais";
import { Ngan } from "@/components/hai-do/bang-tuyen";
import { Chip } from "@/components/hai-do/ui";

/** vùng cảng đông có thể vài trăm tàu trong 24 hải lý — vẽ chừng này dòng một lần */
const DS_TOI_DA = 60;
export const TAM_DS_NM = [6, 12, 24] as const;
export type TamDs = (typeof TAM_DS_NM)[number];

const LOC: { id: LocAis; nhan: string }[] = [
  { id: "tat", nhan: NHAN.tatCa },
  { id: "gan", nhan: NHAN.toiGan },
  { id: "ca", nhan: NHAN.tauCa },
];
const NHAN_SAP: Record<SapAis, string> = { tcpa: NHAN.sapGap, cach: NHAN.ganNhat, ten: NHAN.theoTen };

export function BangAis({
  ds,
  coGps,
  tamNm,
  loc,
  sap,
  tuoiBanPhut,
  onTam,
  onLoc,
  onSap,
  onChon,
  onDong,
}: {
  /** null = chưa có bản AIS nào (đang tải / mất sóng chưa lưu) */
  ds: MucTieu[] | null;
  coGps: boolean;
  tamNm: TamDs;
  loc: LocAis;
  sap: SapAis;
  /** tuổi bản AIS đang dùng, phút — null khi chưa có bản */
  tuoiBanPhut: number | null;
  onTam: (n: TamDs) => void;
  onLoc: (l: LocAis) => void;
  onSap: (s: SapAis) => void;
  onChon: (m: MucTieu) => void;
  onDong: () => void;
}) {
  const tom = ds ? tomTatNguyCo(ds, coGps, tamNm) : null;
  const hien = ds ? sapMucTieu(locMucTieu(ds, loc), sap) : [];
  return (
    <Ngan tieuDe="Tàu quanh đây" onDong={onDong}>
      {tom && (
        <p
          role="status"
          className={`rounded-lg px-2 py-1.5 text-[0.875rem] font-semibold ${
            tom.muc === "nguy" ? "bg-danger-bg text-danger" : tom.muc === "canh" ? "bg-warn-bg text-warn" : "bg-field text-foreground"
          }`}
        >
          {tom.cau}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {LOC.map((o) => (
          <Chip key={o.id} on={loc === o.id} onClick={() => onLoc(o.id)}>
            {o.nhan}
          </Chip>
        ))}
      </div>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-0.5">
        {SAP_AIS.map((s) => (
          <span key={s} className="shrink-0">
            <Chip on={sap === s} onClick={() => onSap(s)}>
              {NHAN_SAP[s]}
            </Chip>
          </span>
        ))}
        {TAM_DS_NM.map((n) => (
          <span key={n} className="shrink-0">
            <Chip on={tamNm === n} onClick={() => onTam(n)}>
              {`${n} hl`}
            </Chip>
          </span>
        ))}
      </div>
      {ds == null ? (
        <p className="mt-2 text-[0.875rem] text-muted">Đang tải tàu AIS… Mất sóng mà máy chưa lưu bản nào thì chưa có danh sách.</p>
      ) : hien.length === 0 ? (
        <p className="mt-2 text-[0.875rem] text-muted">
          {ds.length === 0 ? `Không có tàu nào trong ${tamNm} hải lý.` : "Không có tàu nào khớp bộ lọc."}
        </p>
      ) : (
        <ul className="mt-2 flex flex-col divide-y divide-line">
          {hien.slice(0, DS_TOI_DA).map((m) => (
            <li key={m.tau.id}>
              <button
                type="button"
                onClick={() => onChon(m)}
                className={`flex min-h-(--h-ctl) w-full items-center gap-2 py-1.5 text-left ${m.tinCu ? "opacity-60" : ""}`}
              >
                <span aria-hidden className="h-3 w-3 shrink-0 rounded-full" style={{ background: mauMucTieu(m) }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.9375rem] font-semibold text-navy">{m.tau.ten ?? "Tàu chưa rõ tên"}</span>
                  <span className="block text-[0.8125rem] text-muted tabular-nums">{dongPhuTau(m, coGps)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {hien.length > DS_TOI_DA && <p className="mt-1 text-[0.75rem] text-muted">{`Hiện ${DS_TOI_DA} / ${hien.length} tàu — thu tầm để xem gọn`}</p>}
      {tuoiBanPhut != null && (
        <p className="mt-2 text-[0.75rem] text-muted">{`Bản AIS cập nhật ${tuoiTinLabel(Math.round(tuoiBanPhut))} — vị trí đã ước theo tốc độ, hướng. Tham khảo, không thay canh chừng.`}</p>
      )}
    </Ngan>
  );
}
