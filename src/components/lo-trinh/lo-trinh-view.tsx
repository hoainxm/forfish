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
import { daysBetweenISO } from "@/lib/day-labels";
import {
  cachTuyenTB,
  docNhatKy,
  ghiNhatKy,
  ghiSanLuong,
  nenHoiSanLuong,
  nhatKyReadFailed,
  soBamTuyen,
  themLanSo,
  timChuyen,
  type NhatKyChuyen,
} from "@/lib/lo-trinh/nhat-ky";
import { deXuatLoTrinh, gioDiMacDinh } from "@/lib/lo-trinh/plan";
import {
  baoTuTinBao,
  docMonTau,
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
import type { DiemCoTen, LoTrinhDaLuu, Nghe, TauTinh } from "@/lib/lo-trinh/types";
import { dungCuaTrieu } from "@/lib/lo-trinh/trieu-cang";
import { bangTrongSo, bienDenCuaLuoi, cauMatKhiTinhLai, soVoiLucTinh, thamSoTrongSo, type DongTrongSo } from "@/lib/lo-trinh/offline-trong-so";
import { fetchTideStations, type TideStation } from "@/lib/tides";
import { fetchFairwayDepths, type FairwayDepth } from "@/lib/fairway-depth";
import { PremiumLock } from "@/components/premium-gate";
import { ChipRow } from "@/components/ui/chip-row";
import { Field, inputClass, PrimaryButton } from "@/components/ui/primitives";
import { ChevronRightIcon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { FishPicker } from "@/components/fish-species-sheet";
import { loadFishPicks, saveFishPicks } from "@/lib/fish-picks";
import { SPECIES_META } from "@/lib/species-meta";
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
   · Phase 2/3 (2026-11-08): "Tính lại" từ chỗ tàu đang đứng chạy TRONG MÁY bằng dữ liệu đang có (không request mới) ·
     nhật ký đo hiệu quả `forfish.trip-log.v1` chỉ trong máy. (Quy dầu ra tiền: anh Long bỏ 08/11 — không làm.)
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
  /** lớp dữ liệu có/thiếu lúc tính (cất cùng bản lưu); vắng = bản lưu cũ */
  trongSo?: DongTrongSo[];
  /** mở bản lưu: câu "tính lại bây giờ sẽ mất …" (soạn lúc mở); null = tính lại không mất gì */
  cauTinhLai?: string | null;
  /** bản ghi đã lưu đang mở (để ghi nhật ký so vị trí / sản lượng) — null với lộ trình vừa tính */
  rec?: LoTrinhDaLuu | null;
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
  /** trạm con nước (ghim offline, tính trong máy) + đoạn luồng cửa — null = chưa tải được */
  const [tram, setTram] = useState<TideStation[] | null>(null);
  const [luongDoan, setLuongDoan] = useState<FairwayDepth[] | null>(null);

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
  /** nhật ký đo hiệu quả (Phase 3) — chỉ trong máy */
  const [nhatKy, setNhatKy] = useState<NhatKyChuyen[]>([]);
  const [nhatKyLoi, setNhatKyLoi] = useState<string | null>(null);

  /* ── form ── */
  const [ngayDi, setNgayDi] = useState(todayIso);
  const [soNgayRaw, setSoNgayRaw] = useState("15");
  /** null = theo giờ tàu cùng nghề hay ra cảng (gioDiMacDinh, đổi theo nghề); bà con chọn thì giữ số đó */
  const [gioDiChon, setGioDiChon] = useState<number | null>(null);
  const [nghe, setNghe] = useState<Nghe>("cau-ngu");
  const gioDi = gioDiChon ?? gioDiMacDinh(nghe);
  const [cangId, setCangId] = useState("");
  const [toc, setToc] = useState("");
  /** lít dầu/giờ trong hồ sơ tàu — form KHÔNG hỏi nữa (anh Long 09/11 "bỏ cái lít dầu đi, lấy trung bình"): chỉ giữ để ghi
   *  hồ sơ không đè mất số đã khai ở chỗ khác; thuật toán dùng số TRUNG BÌNH theo nghề (`dauTrungBinh`, plan.ts). */
  const [dauGioHoSo, setDauGioHoSo] = useState<number | null>(null);
  const [ket, setKet] = useState("");
  const [quen, setQuen] = useState<string[]>([]);
  /** loài chủ tàu đánh — cùng bộ của lớp Dự báo cá (`forfish.fishPicks.v1`); chưa chọn ⇒ [] và nút Tính đòi chọn */
  const [loai, setLoai] = useState<string[]>(() => loadFishPicks() ?? []);
  const [moLoai, setMoLoai] = useState(false);
  const [loaiNhap, setLoaiNhap] = useState<string[]>([]);
  const [daBam, setDaBam] = useState(false); // hiện lỗi ô sau lần bấm Tính đầu

  // con nước + độ sâu luồng: file tĩnh cùng origin (service worker giữ), một lần mỗi lần mở màn; hỏng ⇒ null, thuật toán nói ra
  useEffect(() => {
    let huy = false;
    fetchTideStations()
      .then((t) => !huy && setTram(t))
      .catch(() => {});
    fetchFairwayDepths()
      .then((d) => !huy && setLuongDoan(d))
      .catch(() => {});
    return () => {
      huy = true;
    };
  }, []);

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
    setNhatKy(docNhatKy());
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
    setDauGioHoSo(t.tau.litersPerHour);
    setKet(t.tau.fuelTankL != null ? String(t.tau.fuelTankL) : "");
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
  const vKet = ket.trim() ? docSo(ket, TAU_TRAN.fuelTankL) : null;
  const loiKet = ket.trim() && vKet == null ? "Két dầu chưa đúng" : "";
  const loiTau = vToc == null || loiKet;
  const loiLoai = loai.length === 0 ? "Chọn loài tàu mình đánh." : "";
  /** loài để chọn: loài bản đồ cá đang có (khoá `sp` của ô), chưa có bản đồ ⇒ đủ danh sách loài */
  const dsLoai = useMemo(() => {
    const co = new Set<string>();
    for (const c of fc?.cells ?? []) for (const k of Object.keys(c.sp ?? {})) if (SPECIES_META[k]) co.add(k);
    return co.size ? [...co] : Object.keys(SPECIES_META);
  }, [fc]);

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

  /** Bảng lớp dữ liệu ĐANG CÓ trong máy cho một lần tính (offline-trong-so.ts) — chụp lúc tính, so lại khi mở bản lưu. */
  const trongSoBayGio = (now: number, c: DiemCoTen, ngay: string, soN: number, ng: Nghe, baoKiem: boolean): DongTrongSo[] => {
    const cua = dungCuaTrieu(c, tram, luongDoan, docMonTau());
    return bangTrongSo({
      now,
      ngayDi: ngay,
      soNgay: Math.min(16, soN),
      caLuc: fcAt ?? null,
      coMuaVu: clim != null,
      bienDen: bienDenCuaLuoi(luoiBien),
      baoKiemDuoc: baoKiem,
      baiTu: baiNen?.nghe === BAI_NGHE[ng] ? baiNen.tu : null,
      thamSo: thamSoTrongSo(ng),
      trieu: tram == null ? null : { coTram: cua != null, rangBuoc: !!cua?.rangBuoc },
    });
  };

  /** Một lần tính (chuyến mới, hoặc tính lại từ chỗ đang đứng khi có `diemDau`) — dữ liệu lấy từ những gì ĐANG có trong máy. */
  const tinh = (v: {
    cang: DiemCoTen;
    ngayDi: string;
    gioDi: number;
    soNgay: number;
    nghe: Nghe;
    loai?: string[];
    tau: TauTinh;
    diemQuen: DiemCoTen[];
    diemDau?: DiemCoTen;
  }) => {
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
            ...v,
            caTheoNgay: dungCaTheoNgay(fc, clim, v.ngayDi, todayIso, v.loai),
            bao,
            bienTheoNgay: dungBienTheoNgay(luoiBien, v.ngayDi),
            baiTheoNgay: baiNen?.nghe === BAI_NGHE[v.nghe] ? dungBaiTheoNgay(baiNen, v.ngayDi) : null,
            cuaTrieu: dungCuaTrieu(v.cang, tram, luongDoan, docMonTau()),
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
        input: v,
        tuoiDuLieu,
        taoLuc,
        savedId: null,
        tuoiCa: cauTuoiLoTrinh({ taoLuc, tuoiDuLieu }, now),
        trongSo: trongSoBayGio(now, v.cang, v.ngayDi, v.soNgay, v.nghe, bao != null),
        rec: null,
      });
      setDangTinh(false);
      window.setTimeout(() => ketRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }, 30);
  };

  const bamTinh = () => {
    setDaBam(true);
    if (loiSoNgay || loiNgayDi || !cang || loiTau || loiLoai || vToc == null) return;
    // lít dầu/giờ + lít đèn: form không hỏi nữa — giữ nguyên số trong hồ sơ (không gửi `litDem` ⇒ không đụng)
    const tau = { speedKn: vToc, litersPerHour: dauGioHoSo ?? TAU_TRAN.litersPerHour[0], fuelTankL: vKet };
    // ghi thông số tàu về hồ sơ — hỏng thì NÓI, vẫn tính bằng số đang gõ
    setTauLuuLoi(
      ghiTauTinh(tau)
        ? null
        : tauHong
          ? "Hồ sơ tàu trong máy đọc không được — số này chỉ dùng cho lần tính này, chưa ghi đè."
          : storageFullCopy("thông số tàu"),
    );
    tinh({ cang, ngayDi, gioDi, soNgay, nghe, loai, tau, diemQuen });
  };

  /*  TÍNH LẠI GIỮA CHUYẾN (Phase 2, 09 §6): từ chỗ tàu đang đứng (GPS của lần "Vị trí"), số ngày CÒN LẠI của chuyến đang mở
      làm hạn, cùng cảng về / nghề / tàu / điểm quen. Chạy trong máy với dữ liệu đang có (mất sóng = bản đã cất) — câu tuổi
      dữ liệu + bảng "Dữ liệu dùng lúc tính" nói thật lớp nào cũ/thiếu. */
  const [tinhLaiLoi, setTinhLaiLoi] = useState<string | null>(null);
  const tinhLaiTuDay = (pos: { lat: number; lon: number }) => {
    if (!ketQua) return;
    const g = ketQua.input;
    const het = addDaysIso(g.ngayDi, Math.max(1, Math.min(TRAN_NGAY_TINH, g.soNgay)) - 1);
    const con = daysBetweenISO(todayIso, het) + 1;
    if (daysBetweenISO(g.ngayDi, todayIso) < 0) {
      setTinhLaiLoi("Chưa tới ngày xuất bến — dùng nút Tính ở trên cho chuyến này.");
      return;
    }
    if (con < 1) {
      setTinhLaiLoi("Chuyến đã hết số ngày đã khai — tính chuyến mới ở trên.");
      return;
    }
    setTinhLaiLoi(null);
    // giờ VN hiện tại = giờ "đi" của bản tính lại
    // eslint-disable-next-line react-hooks/purity
    const gioVN = new Date(Date.now() + 7 * 3_600_000).getUTCHours();
    tinh({
      cang: g.cang,
      ngayDi: todayIso,
      gioDi: gioVN,
      soNgay: con,
      nghe: g.nghe,
      loai: g.loai,
      tau: g.tau,
      diemQuen: g.diemQuen ?? [],
      diemDau: { lat: pos.lat, lon: pos.lon, ten: "Chỗ tàu đang đứng" },
    });
  };

  /* ── nhật ký đo hiệu quả (Phase 3) — chỉ lộ trình ĐÃ LƯU, chỉ trong máy ── */
  const ghiNk = (next: NhatKyChuyen[] | null) => {
    if (!next) return;
    if (!ghiNhatKy(next)) {
      setNhatKyLoi(nhatKyReadFailed() ? "Nhật ký chuyến trong máy đọc không được — chưa ghi để khỏi đè mất." : storageFullCopy("nhật ký chuyến"));
      return;
    }
    setNhatKyLoi(null);
    setNhatKy(next);
  };
  const ghiLanSo = (pos: { lat: number; lon: number }, cachHaiLy: number) => {
    if (!ketQua?.rec) return;
    ghiNk(themLanSo(nhatKy, ketQua.rec, pos, cachHaiLy, Date.now(), todayIso));
  };
  const ghiKg = (kg: number) => {
    if (!ketQua?.rec) return false;
    const next = ghiSanLuong(nhatKy, ketQua.rec, kg, Date.now());
    if (!next) return false;
    ghiNk(next);
    return true;
  };
  const chuyenNk = ketQua?.rec ? timChuyen(nhatKy, ketQua.rec.id) : null;
  const cauDo = (() => {
    if (!ketQua?.rec) return null;
    const phan: string[] = [];
    const tb = chuyenNk ? cachTuyenTB(chuyenNk) : null;
    if (chuyenNk && tb != null)
      phan.push(`Đã so vị trí ${chuyenNk.viTri.length} lần trong chuyến, trung bình cách tuyến ${Math.round(tb)} hải lý.`);
    if (chuyenNk?.sanLuong) phan.push(`Sản lượng đã ghi: ${chuyenNk.sanLuong.kg.toLocaleString("vi-VN")} kg.`);
    const so = soBamTuyen(nhatKy, ketQua.rec.input.nghe);
    if (so.duSo && so.bam.kgTB != null && so.lech.kgTB != null)
      phan.push(
        `Các chuyến bà con đã ghi: đi sát tuyến trung bình ${so.bam.kgTB.toLocaleString("vi-VN")} kg (${so.bam.n} chuyến), đi khác tuyến ${so.lech.kgTB.toLocaleString("vi-VN")} kg (${so.lech.n} chuyến).`,
      );
    return phan.length ? phan.join(" ") : null;
  })();

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
      ...(ketQua.trongSo ? { trongSo: ketQua.trongSo } : {}),
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
    setKetQua({ ...ketQua, savedId: rec.id, rec });
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
    setTinhLaiLoi(null);
    setKetQua({
      kq: r.ketQua,
      input: r.input,
      tuoiDuLieu: r.tuoiDuLieu,
      taoLuc: r.taoLuc,
      savedId: r.id,
      // chạy trong onClick (không phải lúc vẽ) — luật purity không phân biệt được hàm handler
      // eslint-disable-next-line react-hooks/purity
      tuoiCa: cauTuoiLoTrinh(r, Date.now()),
      ...(r.trongSo ? { trongSo: r.trongSo } : {}),
      rec: r,
      // so với dữ liệu ĐANG có trong máy: tính lại bây giờ sẽ mất lớp nào (mất sóng thì nên xem bản này)
      cauTinhLai: cauMatKhiTinhLai(
        soVoiLucTinh(
          r.trongSo,
          // eslint-disable-next-line react-hooks/purity
          trongSoBayGio(Date.now(), r.input.cang, r.input.ngayDi, r.input.soNgay, r.input.nghe, baoTuTinBao(storm, Date.now()) != null),
        ),
      ),
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

  const coLoi = daBam && (loiSoNgay || loiNgayDi || !cang || loiTau || loiLoai);

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
            <select value={gioDi} onChange={(e) => setGioDiChon(Number(e.target.value))} className={inputClass}>
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

        {/* LOÀI ĐÁNH (09/11, anh Long "cho chủ tàu chủ động chọn"): cùng bộ loài của lớp Dự báo cá — chọn ở đây thì bản đồ
            cũng nhớ. Lộ trình chấm ô theo các loài này; chưa chọn thì nút Tính đòi chọn. */}
        <p className="mb-1.5 text-[0.875rem] font-semibold text-navy">Loài đánh</p>
        <button
          type="button"
          onClick={() => {
            setLoaiNhap(loai);
            setMoLoai(true);
          }}
          aria-invalid={!!(daBam && loiLoai)}
          className={`${inputClass} mb-1 flex items-center gap-2 text-left`}
        >
          <span className={`min-w-0 flex-1 truncate ${loai.length ? "" : "text-muted"}`}>
            {loai.length ? loai.map((l) => SPECIES_META[l]?.full ?? l).join(", ") : "Chọn loài…"}
          </span>
          <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" />
        </button>
        {daBam && loiLoai ? (
          <p role="alert" className="mb-3 text-[0.875rem] leading-snug text-danger">{loiLoai}</p>
        ) : (
          <p className="mb-3 text-[0.8125rem] leading-snug text-muted">Lộ trình chỉ chấm chỗ có loài này.</p>
        )}
        {moLoai && (
          <BottomSheet title="Loài đánh" onClose={() => setMoLoai(false)}>
            <FishPicker
              species={dsLoai}
              picks={loaiNhap}
              regionShorts={KHONG_VU}
              onChange={setLoaiNhap}
              onDone={() => {
                setLoai(loaiNhap);
                // ghi chung bộ với bản đồ; máy không cho ghi thì vẫn dùng trong phiên
                saveFishPicks(loaiNhap);
                setMoLoai(false);
              }}
            />
          </BottomSheet>
        )}

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
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-[0.8125rem] text-muted">Hải lý/giờ</span>
            <input inputMode="decimal" value={toc} onChange={(e) => setToc(e.target.value)} aria-invalid={daBam && vToc == null} className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[0.8125rem] text-muted">Két (lít)</span>
            <input inputMode="numeric" value={ket} placeholder="Tuỳ" onChange={(e) => setKet(e.target.value)} aria-invalid={!!(daBam && loiKet)} className={inputClass} />
          </label>
        </div>
        {daBam && loiTau ? (
          <p role="alert" className="mt-1.5 text-[0.875rem] leading-snug text-danger">
            Tốc độ 1–30 hải lý/giờ, két để trống nếu chưa biết.
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
            onSoViTri={ketQua.rec ? ghiLanSo : undefined}
            onTinhLai={ketQua.rec && !dangTinh ? tinhLaiTuDay : undefined}
            tinhLaiLoi={tinhLaiLoi}
            hoiSanLuong={ketQua.rec ? nenHoiSanLuong(chuyenNk, ketQua.rec, todayIso) : false}
            onSanLuong={ghiKg}
            cauDo={cauDo}
            nhatKyLoi={nhatKyLoi}
          />
        )}
        {ketQua?.cauTinhLai && <p className="mt-2 text-[0.8125rem] leading-snug text-warn">{ketQua.cauTinhLai}</p>}
        {ketQua?.trongSo && ketQua.trongSo.length > 0 && (
          <details className="mt-2 text-[0.8125rem] leading-snug">
            <summary className="cursor-pointer text-muted">
              Dữ liệu dùng lúc tính · {ketQua.trongSo.filter((r) => r.trangThai === "du").length}/{ketQua.trongSo.length} đủ
            </summary>
            <ul className="mt-1 space-y-0.5">
              {ketQua.trongSo.map((r) => (
                <li key={r.ma} className={r.trangThai === "du" ? "text-muted" : "text-warn"}>
                  {r.cau}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}

/** Bộ chọn loài ở form lộ trình không có "vùng đang xem" như bản đồ ⇒ không mục "Đang vụ quanh đây". */
const KHONG_VU = new Set<string>();
