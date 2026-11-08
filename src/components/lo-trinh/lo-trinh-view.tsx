"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PORTS } from "@/data/ports";
import { NHAN, TEN_GOI } from "@/lib/labels";
import { useFeatureAccess } from "@/lib/use-tier";
import { useOnline } from "@/lib/use-online";
import { useTodayVN } from "@/lib/use-today";
import { addDaysIso } from "@/lib/days";
import { gioLuu } from "@/lib/offline-line";
import { storageFullCopy } from "@/lib/user-store";
import { docCangNha } from "@/lib/cang-nha";
import { loadPlaces, placeId, type SavedPlace } from "@/lib/places";
import { loadCurrentBoatId } from "@/lib/boats";
import { forecastStoreReady } from "@/lib/forecast-store";
import { banDoCaDaLuu, fetchFishForecast, savedFishMark, type FishForecast } from "@/lib/fish-forecast-client";
import { fetchClimatology, type Climatology } from "@/lib/fish-blend";
import { fetchStormCheck, type StormCheck } from "@/lib/storms";
import { fetchForecastGrid, loadLongestSavedGrid, type ForecastGrid } from "@/lib/forecast-grid";
import { fetchFleetNen, type NenFleet } from "@/lib/fleet-density";
import { deXuatLoTrinh, GIO_XUAT_BEN, NGHE_DEN } from "@/lib/lo-trinh/plan";
import {
  baoTuTinBao,
  docSo,
  docTauTinh,
  BAI_NGHE,
  dungBaiTheoNgay,
  dungBienTheoNgay,
  dungCaTheoNgay,
  ghiTauTinh,
  gioTinBao,
  TAU_TRAN,
} from "@/lib/lo-trinh/dau-vao";
import {
  cauTuoiLoTrinh,
  docLoTrinhDaLuu,
  ghiLoTrinhDaLuu,
  loTrinhReadFailed,
  tenLoTrinh,
  themLoTrinh,
  xoaLoTrinh,
} from "@/lib/lo-trinh/luu";
import type { DiemCoTen, LoTrinhDaLuu, Nghe } from "@/lib/lo-trinh/types";
import { PremiumLock } from "@/components/premium-gate";
import { ChipRow } from "@/components/ui/chip-row";
import { Field, inputClass, PrimaryButton } from "@/components/ui/primitives";
import { ChevronRightIcon } from "@/components/icons";
import { KetQuaLoTrinh } from "./ket-qua-lo-trinh";

/*
  ĐỀ XUẤT LỘ TRÌNH CHUYẾN BIỂN — màn `/lo-trinh` (09-ba-spec §4/§5/§5c; 07 §5 hàng 2b).
  MỘT màn, không wizard: (đã lưu) → form ≤4 mục + điểm quen tuỳ chọn → nút chính "Tính" → kết quả.
  Tính năng thuộc gói (chốt #1 đầu doc 09) ⇒ chưa có gói thì PremiumLock gọn như lớp cá.

  OFFLINE (CLAUDE.md 🟡): mọi request có trần + `.catch`, mất sóng dùng bản lưu và NÓI tuổi:
   · bản đồ cá — `banDoCaDaLuu` (kho bền) hiện NGAY, `fetchFishForecast` (trần 35 s, tự lùi bản lưu)
     thay khi về; mùa vụ `fetchClimatology` (trần 15 s, không ném); tin bão `fetchStormCheck`
     (trần 28 s, lùi bản lưu). Không kiểm được bão ⇒ `bao: null` ⇒ thuật toán ghi chú, không im.
   · lộ trình đã lưu + hồ sơ tàu + điểm quen đọc thẳng localStorage — chạy trọn khi mất sóng.
*/

type Ket = {
  kq: LoTrinhDaLuu["ketQua"];
  input: LoTrinhDaLuu["input"];
  tuoiDuLieu: LoTrinhDaLuu["tuoiDuLieu"];
  taoLuc: string;
  /** id trong kho — null = vừa tính, chưa lưu */
  savedId: string | null;
  /** câu tuổi dữ liệu, soạn lúc tính / lúc mở (không gọi giờ máy trong lúc vẽ) */
  tuoiCa: string;
};

const NGHE: { id: Nghe; label: string }[] = [
  { id: "cau-ngu", label: NHAN.cauNgu },
  { id: "luoi-vay", label: NHAN.luoiVay },
  { id: "luoi-re", label: NHAN.luoiRe },
  { id: "chup-muc", label: NHAN.chupMuc },
  { id: "luoi-keo", label: NHAN.cao },
  { id: "keo-doi", label: NHAN.caoDoi },
];
const CHIP_NGAY = ["7", "15", "16"] as const;
const TRAN_NGAY_TINH = 16;
const TRAN_NGAY_KHAI = 60;
const MAX_DIEM_QUEN = 5;
const CANG_NHA_ID = "cang-nha";

export function LoTrinhView() {
  const { access } = useFeatureAccess();
  const online = useOnline();
  if (access === "checking")
    return (
      <p role="status" className="mt-8 text-center text-[1rem] text-muted">
        Đang mở…
      </p>
    );
  if (access !== "open")
    return (
      <div className="px-4 pt-2">
        <PremiumLock
          access={access}
          feature="đề xuất lộ trình"
          blurb="Gợi ý lịch chuyến theo ngày, vùng đánh, dầu và ngày nên về."
          compact
        />
        {/* PremiumLock ẩn khi mất sóng (lời mời gọi điện vô ích) — vẫn phải nói vì sao màn trống */}
        {!online && (
          <p className="mt-2 text-[0.875rem] text-muted">Đề xuất lộ trình nằm trong {TEN_GOI}.</p>
        )}
      </div>
    );
  return <LoTrinhMo />;
}

function LoTrinhMo() {
  const online = useOnline();
  const { todayIso } = useTodayVN();

  /* ── dữ liệu ── */
  const [fc, setFc] = useState<FishForecast | null>(null);
  const [fcNguon, setFcNguon] = useState<"moi" | "luu" | null>(null);
  const [fcXong, setFcXong] = useState(false); // lượt tải mạng đã trả lời (được/hỏng)
  const [clim, setClim] = useState<Climatology | null>(null);
  const [storm, setStorm] = useState<StormCheck | null>(null);
  const [baoChuaKiem, setBaoChuaKiem] = useState(false);
  /** lưới gió sóng đủ vùng 16 ngày — hệ số biển của lộ trình (he-so.ts); null = chưa có, thuật toán tự nói ra */
  const [luoiBien, setLuoiBien] = useState<ForecastGrid | null>(null);
  /** bãi tàu CÙNG NGHỀ 16 ngày (lớp mật độ tàu, cất offline — fetchFleetNen tự lùi bản đã cất); null = chưa có */
  const [baiNen, setBaiNen] = useState<NenFleet | null>(null);

  useEffect(() => {
    let huy = false;
    // bản lưu trước — mất sóng vẫn có ngay, không đợi mạng hết giờ
    forecastStoreReady()
      .then(() => {
        const luu = banDoCaDaLuu();
        if (!huy && luu) {
          setFc((cu) => cu ?? luu);
          setFcNguon((cu) => cu ?? "luu");
        }
      })
      .catch(() => {});
    fetchFishForecast()
      .then((r) => {
        if (huy) return;
        if (r.ok) {
          setFc(r);
          setFcNguon(r.tuKhoOffline ? "luu" : "moi");
        }
      })
      .catch(() => {})
      .finally(() => !huy && setFcXong(true));
    fetchClimatology()
      .then((c) => !huy && setClim(c))
      .catch(() => {});
    // gió sóng: bản lưu dài ngày nhất NGAY (mất sóng vẫn có), rồi bản mới (snapshot trước, có trần chờ + lùi bản lưu)
    forecastStoreReady()
      .then(() => {
        const luu = loadLongestSavedGrid();
        if (!huy && luu) setLuoiBien((cu) => cu ?? luu.grid);
      })
      .catch(() => {});
    fetchForecastGrid(16)
      .then((g) => !huy && setLuoiBien(g))
      .catch(() => {});
    fetchStormCheck()
      .then((c) => {
        if (huy) return;
        setStorm(c);
        setBaoChuaKiem(baoTuTinBao(c, Date.now()) === null);
      })
      .catch(() => {
        if (huy) return;
        setStorm({ ok: false });
        setBaoChuaKiem(true);
      });
    return () => {
      huy = true;
    };
  }, []);

  const fcAt = useMemo(() => {
    if (!fc) return null;
    const g = Date.parse(fc.generatedAt ?? "");
    return Number.isFinite(g) ? g : (savedFishMark()?.dataAt ?? null);
  }, [fc]);

  /* ── kho trong máy (đọc sau mount) ── */
  const [daLuu, setDaLuu] = useState<LoTrinhDaLuu[]>([]);
  const [daLuuHong, setDaLuuHong] = useState(false);
  const [cangNha, setCangNha] = useState<DiemCoTen | null>(null);
  /** cảng nhà trùng một cảng trong danh mục 10 cảng (PORTS) — null = cảng nhà nằm ngoài danh mục */
  const [cangNhaPortId, setCangNhaPortId] = useState<string | null>(null);
  const [diemLuu, setDiemLuu] = useState<SavedPlace[]>([]);
  const [tauHong, setTauHong] = useState(false);
  const [tauMacDinh, setTauMacDinh] = useState(false);

  /* ── form ── */
  const [ngayDi, setNgayDi] = useState(todayIso);
  const [soNgayRaw, setSoNgayRaw] = useState("15");
  const [gioDi, setGioDi] = useState(GIO_XUAT_BEN);
  const [nghe, setNghe] = useState<Nghe>("cau-ngu");
  const [cangId, setCangId] = useState("");
  const [toc, setToc] = useState("");
  const [dauGio, setDauGio] = useState("");
  const [ket, setKet] = useState("");
  const [litDem, setLitDem] = useState("");
  const [quen, setQuen] = useState<string[]>([]);
  const [daBam, setDaBam] = useState(false); // hiện lỗi ô sau lần bấm Tính đầu

  // bãi theo NGHỀ đang chọn: đổi nghề thì tải nền của nghề đó (trần 30 s, mất sóng/không gói ⇒ bản đã cất hoặc null
  // — thuật toán tự ghi chú "chưa có bãi"). Một request mỗi lần đổi nghề, không chạy lúc mở app.
  useEffect(() => {
    let huy = false;
    setBaiNen(null);
    fetchFleetNen(BAI_NGHE[nghe], todayIso)
      .then((n) => !huy && setBaiNen(n))
      .catch(() => {});
    return () => {
      huy = true;
    };
  }, [nghe, todayIso]);

  useEffect(() => {
    setDaLuu(docLoTrinhDaLuu());
    setDaLuuHong(loTrinhReadFailed());
    const nha = docCangNha();
    if (nha) {
      setCangNha({ lat: nha.lat, lon: nha.lon, ten: nha.name });
      const trung = PORTS.find((p) => placeId(p.lat, p.lon) === placeId(nha.lat, nha.lon) || p.id === nha.portId);
      setCangNhaPortId(trung?.id ?? null);
      setCangId(trung ? trung.id : CANG_NHA_ID);
    }
    setDiemLuu(loadPlaces().filter((p) => p.kind === "spot"));
    const t = docTauTinh();
    setToc(String(t.tau.speedKn));
    setDauGio(String(t.tau.litersPerHour));
    setKet(t.tau.fuelTankL != null ? String(t.tau.fuelTankL) : "");
    setLitDem(t.tau.litDem != null ? String(t.tau.litDem) : "");
    setTauHong(t.docHong);
    setTauMacDinh(t.macDinh);
  }, []);

  const cang: DiemCoTen | null = useMemo(() => {
    if (cangId === CANG_NHA_ID) return cangNha;
    const p = PORTS.find((x) => x.id === cangId);
    return p ? { lat: p.lat, lon: p.lon, ten: `Cảng ${p.name}` } : null;
  }, [cangId, cangNha]);

  const soNgay = /^\d{1,2}$/.test(soNgayRaw.trim()) ? Number(soNgayRaw.trim()) : NaN;
  const loiSoNgay =
    Number.isFinite(soNgay) && soNgay >= 1 && soNgay <= TRAN_NGAY_KHAI ? "" : `Nhập số ngày từ 1 đến ${TRAN_NGAY_KHAI}.`;
  const loiNgayDi = !/^\d{4}-\d{2}-\d{2}$/.test(ngayDi)
    ? "Chọn ngày xuất bến."
    : ngayDi < todayIso
      ? "Ngày này đã qua — chọn từ hôm nay trở đi."
      : "";
  const vToc = docSo(toc, TAU_TRAN.speedKn);
  const vDau = docSo(dauGio, TAU_TRAN.litersPerHour);
  const vKet = ket.trim() ? docSo(ket, TAU_TRAN.fuelTankL) : null;
  const loiKet = ket.trim() && vKet == null ? "Két dầu chưa đúng" : "";
  const ngheDen = NGHE_DEN.includes(nghe);
  const vLitDem = ngheDen && litDem.trim() ? docSo(litDem, TAU_TRAN.litDem) : null;
  const loiDen = ngheDen && litDem.trim() && vLitDem == null ? "Lít đèn chưa đúng" : "";
  const loiTau = vToc == null || vDau == null || loiKet || loiDen;

  const diemQuen: DiemCoTen[] = diemLuu
    .filter((p) => quen.includes(p.id))
    .map((p) => ({ lat: p.lat, lon: p.lon, ten: p.name }));

  /* ── tính ── */
  const [dangTinh, setDangTinh] = useState(false);
  const [tinhLoi, setTinhLoi] = useState(false);
  const [ketQua, setKetQua] = useState<Ket | null>(null);
  const [luuLoi, setLuuLoi] = useState<string | null>(null);
  const [tauLuuLoi, setTauLuuLoi] = useState<string | null>(null);
  const ketRef = useRef<HTMLDivElement>(null);

  const chuaCoCa = !fc && fcXong;
  const dangTaiCa = !fc && !fcXong;
  const coTheTinh = !dangTinh && !dangTaiCa && (fc != null || diemQuen.length > 0);

  const bamTinh = () => {
    setDaBam(true);
    if (loiSoNgay || loiNgayDi || !cang || loiTau || vToc == null || vDau == null) return;
    // ô đèn chỉ có ở nghề đèn — nghề khác không gửi `litDem` ⇒ hồ sơ giữ nguyên số đã khai
    const tau = { speedKn: vToc, litersPerHour: vDau, fuelTankL: vKet, ...(ngheDen ? { litDem: vLitDem } : {}) };
    // ghi thông số tàu về hồ sơ — hỏng thì NÓI, vẫn tính bằng số đang gõ
    setTauLuuLoi(
      ghiTauTinh(tau)
        ? null
        : tauHong
          ? "Hồ sơ tàu trong máy đọc không được — số này chỉ dùng cho lần tính này, chưa ghi đè."
          : storageFullCopy("thông số tàu"),
    );
    setDangTinh(true);
    setTinhLoi(false);
    setLuuLoi(null);
    // nhường một nhịp vẽ để nút kịp hiện "Đang tính"
    window.setTimeout(() => {
      const now = Date.now();
      const bao = baoTuTinBao(storm, now);
      let kq: Ket["kq"];
      try {
        kq = deXuatLoTrinh(
          {
            cang,
            ngayDi,
            gioDi,
            soNgay,
            nghe,
            tau,
            diemQuen,
            caTheoNgay: dungCaTheoNgay(fc, clim, ngayDi, todayIso, nghe),
            bao,
            bienTheoNgay: dungBienTheoNgay(luoiBien, ngayDi),
            baiTheoNgay: baiNen?.nghe === BAI_NGHE[nghe] ? dungBaiTheoNgay(baiNen, ngayDi) : null,
          },
          new Date(now),
        );
      } catch {
        // thuật toán ném (dữ liệu lạ) ⇒ nói ra, KHÔNG kẹt nút "Đang tính"
        setTinhLoi(true);
        setDangTinh(false);
        return;
      }
      const tuoiDuLieu = {
        ca: fcAt != null ? new Date(fcAt).toISOString() : null,
        bao: bao == null ? null : gioTinBao(storm),
      };
      const taoLuc = new Date(now).toISOString();
      setKetQua({
        kq,
        input: { cang, ngayDi, gioDi, soNgay, nghe, tau, diemQuen },
        tuoiDuLieu,
        taoLuc,
        savedId: null,
        tuoiCa: cauTuoiLoTrinh({ taoLuc, tuoiDuLieu }, now),
      });
      setDangTinh(false);
      window.setTimeout(() => ketRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }, 30);
  };

  const luu = () => {
    if (!ketQua || ketQua.savedId) return;
    const rec: LoTrinhDaLuu = {
      id: `lt${Date.parse(ketQua.taoLuc)}`,
      ten: tenLoTrinh(ketQua.input.cang.ten, ketQua.input.soNgay, ketQua.input.ngayDi),
      boatId: loadCurrentBoatId(),
      taoLuc: ketQua.taoLuc,
      tuoiDuLieu: ketQua.tuoiDuLieu,
      input: ketQua.input,
      ketQua: ketQua.kq,
    };
    const next = themLoTrinh(daLuu, rec);
    if (!ghiLoTrinhDaLuu(next)) {
      setLuuLoi(
        loTrinhReadFailed()
          ? "Danh sách lộ trình trong máy đọc không được — chưa lưu để khỏi đè mất bản cũ."
          : storageFullCopy("lộ trình"),
      );
      return;
    }
    setDaLuu(next);
    setKetQua({ ...ketQua, savedId: rec.id });
  };

  const xoa = (id: string) => {
    const next = xoaLoTrinh(daLuu, id);
    if (!ghiLoTrinhDaLuu(next)) {
      setLuuLoi(storageFullCopy("thay đổi"));
      return;
    }
    setDaLuu(next);
    setKetQua(null);
  };

  const moDaLuu = (r: LoTrinhDaLuu) => {
    setLuuLoi(null);
    setKetQua({
      kq: r.ketQua,
      input: r.input,
      tuoiDuLieu: r.tuoiDuLieu,
      taoLuc: r.taoLuc,
      savedId: r.id,
      // chạy trong onClick (không phải lúc vẽ) — luật purity không phân biệt được hàm handler
      // eslint-disable-next-line react-hooks/purity
      tuoiCa: cauTuoiLoTrinh(r, Date.now()),
    });
    window.setTimeout(() => ketRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  /* ── câu trạng thái dữ liệu ── */
  const cauCa = dangTaiCa
    ? { mau: "text-muted", cau: "Đang tải bản đồ cá…" }
    : chuaCoCa
      ? {
          mau: "text-warn",
          cau: online
            ? "Mạng yếu, chưa tải được bản đồ cá — chọn điểm quen để tính quanh đó, hoặc thử lại sau."
            : "Mất sóng — máy chưa có bản đồ cá. Chọn điểm quen để tính quanh đó; có sóng sẽ tải.",
        }
      : fcNguon === "luu" && fcXong
        ? { mau: "text-warn", cau: `${online ? "Mạng yếu" : "Mất sóng"} — bản đồ cá lúc ${fcAt ? gioLuu(fcAt) : "trước"}` }
        : { mau: "text-muted", cau: `Bản đồ cá lúc ${fcAt ? gioLuu(fcAt) : "—"}` };
  const cauBao =
    storm == null
      ? "Đang hỏi tin bão…"
      : baoChuaKiem
        ? "Chưa kiểm được tin bão — vẫn tính được, nhưng chưa đối chiếu bão."
        : null;

  const coLoi = daBam && (loiSoNgay || loiNgayDi || !cang || loiTau);

  return (
    <div className="px-4 pb-8">
      {/* ── ĐÃ LƯU ── */}
      {daLuuHong && (
        <p role="alert" className="mb-3 text-[0.875rem] font-semibold leading-snug text-danger">
          Danh sách lộ trình đã lưu đọc không được — máy giữ nguyên, chưa ghi đè.
        </p>
      )}
      {daLuu.length > 0 && (
        <section aria-label="Lộ trình đã lưu" className="mb-2 pt-3">
          <h2 className="display pb-1.5 text-[1.125rem] font-semibold text-navy">{NHAN.daLuu}</h2>
          <ul className="surface divide-y divide-line">
            {daLuu.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => moDaLuu(r)}
                  aria-current={ketQua?.savedId === r.id ? "true" : undefined}
                  className="flex min-h-(--h-row) w-full items-center gap-3 px-3 py-2 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[1rem] font-semibold text-navy">{r.ten}</span>
                    <span className="block truncate text-[0.8125rem] text-muted">
                      {r.ketQua.chanBao ? "Có bão lúc tính" : `Về ${r.ketQua.ngayNenVe.slice(8, 10)}/${r.ketQua.ngayNenVe.slice(5, 7)}`}
                      {" · tính lúc "}
                      {gioLuu(Date.parse(r.taoLuc))}
                    </span>
                  </span>
                  <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── FORM ── */}
      <section aria-label="Thông tin chuyến">
        <h2 className="display pb-2 pt-3 text-[1.125rem] font-semibold text-navy">Chuyến mới</h2>

        <div className="grid grid-cols-[1fr_5.5rem_5rem] gap-2">
          <Field label="Ngày đi" error={daBam ? loiNgayDi : ""}>
            <input
              type="date"
              value={ngayDi}
              min={todayIso}
              max={addDaysIso(todayIso, 60)}
              onChange={(e) => setNgayDi(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Giờ đi">
            <select value={gioDi} onChange={(e) => setGioDi(Number(e.target.value))} className={inputClass}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {h} giờ
                </option>
              ))}
            </select>
          </Field>
          <Field label="Mấy ngày" error={daBam ? loiSoNgay : ""}>
            <input
              inputMode="numeric"
              value={soNgayRaw}
              onChange={(e) => setSoNgayRaw(e.target.value.replace(/[^\d]/g, "").slice(0, 2))}
              className={inputClass}
            />
          </Field>
        </div>
        <div className="-mx-4 -mt-1">
          <ChipRow
            ariaLabel="Số ngày đi"
            level={2}
            options={CHIP_NGAY.map((n) => ({ id: n, label: `${n} ngày` }))}
            value={soNgayRaw as (typeof CHIP_NGAY)[number]}
            onChange={setSoNgayRaw}
          />
        </div>
        {soNgay > TRAN_NGAY_TINH && !loiSoNgay && (
          <p className="-mt-1 mb-3 text-[0.8125rem] leading-snug text-muted">
            Dữ liệu chỉ tới 16 ngày — app tính 16 ngày đầu của chuyến {soNgay} ngày.
          </p>
        )}

        <p className="mb-1.5 text-[0.875rem] font-semibold text-navy">Nghề</p>
        {/* 6 nghề chia đều HAI hàng × 3 (ChipRow min 5.5rem/chip tràn ở 360px, cắt mất "Chụp mực" — sửa bằng bố cục) */}
        <div role="group" aria-label="Nghề" className="mb-3 grid grid-cols-3 gap-1.5">
          {NGHE.map((o) => {
            const on = o.id === nghe;
            return (
              <button
                key={o.id}
                type="button"
                aria-pressed={on}
                onClick={() => setNghe(o.id)}
                className={`h-(--h-chip) rounded-full border px-1 text-[0.8125rem] font-semibold transition active:scale-[0.97] ${
                  on ? "border-navy bg-navy text-white" : "border-line bg-card text-foreground/75"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>

        <Field label="Cảng xuất bến" error={daBam && !cang ? "Chọn cảng xuất bến." : ""}>
          <select value={cangId} onChange={(e) => setCangId(e.target.value)} className={inputClass}>
            {!cangId && <option value="">Chọn cảng…</option>}
            {cangNha && !cangNhaPortId && <option value={CANG_NHA_ID}>{cangNha.ten} (cảng nhà)</option>}
            {PORTS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.id === cangNhaPortId ? "cảng nhà" : p.province}
              </option>
            ))}
          </select>
        </Field>

        <p className="mb-1.5 text-[0.875rem] font-semibold text-navy">Tàu</p>
        <div className="grid grid-cols-3 gap-2">
          <label className="block">
            <span className="mb-1 block text-[0.8125rem] text-muted">Hải lý/giờ</span>
            <input inputMode="decimal" value={toc} onChange={(e) => setToc(e.target.value)} aria-invalid={daBam && vToc == null} className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[0.8125rem] text-muted">Lít dầu/giờ</span>
            <input inputMode="decimal" value={dauGio} onChange={(e) => setDauGio(e.target.value)} aria-invalid={daBam && vDau == null} className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[0.8125rem] text-muted">Két (lít)</span>
            <input inputMode="numeric" value={ket} placeholder="Tuỳ" onChange={(e) => setKet(e.target.value)} aria-invalid={!!(daBam && loiKet)} className={inputClass} />
          </label>
        </div>
        {ngheDen && (
          <label className="mt-2 grid grid-cols-[1fr_6rem] items-center gap-2">
            <span className="text-[0.8125rem] leading-snug text-muted">Dầu máy phát chong đèn, lít mỗi đêm</span>
            <input inputMode="decimal" value={litDem} placeholder="Tuỳ" onChange={(e) => setLitDem(e.target.value)} aria-invalid={!!(daBam && loiDen)} className={inputClass} />
          </label>
        )}
        {daBam && loiTau ? (
          <p role="alert" className="mt-1.5 text-[0.875rem] leading-snug text-danger">
            Tốc độ 1–30 hải lý/giờ, dầu 1–500 lít/giờ, két và lít đèn để trống nếu chưa biết.
          </p>
        ) : tauHong ? (
          <p className="mt-1.5 text-[0.8125rem] leading-snug text-warn">Hồ sơ tàu đọc không được — đang dùng số mặc định, máy giữ nguyên bản cũ.</p>
        ) : tauMacDinh ? (
          <p className="mt-1.5 text-[0.8125rem] leading-snug text-muted">Số mặc định — sửa cho đúng tàu mình, máy nhớ cho lần sau.</p>
        ) : null}

        {diemLuu.length > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-[0.875rem] font-semibold text-navy">
              Điểm quen <span className="font-normal text-muted">· tuỳ chọn, tối đa {MAX_DIEM_QUEN}</span>
            </p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Điểm quen muốn ghé">
              {diemLuu.map((p) => {
                const on = quen.includes(p.id);
                const het = !on && quen.length >= MAX_DIEM_QUEN;
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={on}
                    disabled={het}
                    onClick={() => setQuen((q) => (on ? q.filter((x) => x !== p.id) : [...q, p.id]))}
                    className={`inline-flex h-(--h-chip) max-w-full items-center rounded-full border px-3 text-[0.8125rem] font-semibold transition disabled:opacity-40 ${
                      on ? "border-navy bg-card text-navy" : "border-line bg-card text-foreground/75"
                    }`}
                  >
                    <span className="truncate">{p.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-5">
          <PrimaryButton onClick={bamTinh} disabled={!coTheTinh}>
            {dangTinh ? NHAN.dangTinh : NHAN.tinh}
          </PrimaryButton>
          <div aria-live="polite" className="mt-2 space-y-0.5">
            <p className={`text-[0.8125rem] leading-snug ${cauCa.mau}`}>{cauCa.cau}</p>
            {cauBao && <p className="text-[0.8125rem] leading-snug text-muted">{cauBao}</p>}
            {coLoi && <p className="text-[0.8125rem] text-danger">Còn ô chưa đúng — xem chữ đỏ ở trên.</p>}
            {tinhLoi && (
              <p role="alert" className="text-[0.8125rem] font-semibold text-danger">
                Chưa tính được lộ trình — bấm Tính lại giúp nhé.
              </p>
            )}
            {tauLuuLoi && (
              <p role="alert" className="text-[0.8125rem] font-semibold leading-snug text-danger">
                {tauLuuLoi}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── KẾT QUẢ ── */}
      <div ref={ketRef} className="scroll-mt-4">
        {ketQua && (
          <KetQuaLoTrinh
            key={ketQua.taoLuc}
            kq={ketQua.kq}
            ngayDi={ketQua.input.ngayDi}
            cangTen={ketQua.input.cang.ten}
            tuoiCa={ketQua.tuoiCa}
            daLuu={ketQua.savedId != null}
            onLuu={ketQua.kq.chanBao ? undefined : luu}
            luuLoi={luuLoi}
            onXoa={ketQua.savedId ? () => xoa(ketQua.savedId!) : undefined}
          />
        )}
      </div>
    </div>
  );
}
