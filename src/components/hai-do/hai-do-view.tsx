"use client";

/*
  CHẾ ĐỘ HẢI ĐỒ (`/hai-do`) — 2026-11-04. Anh Long chốt: "chế độ hải đồ thuần này là
  1 lớp mới, ko dính tới cái cũ … rồi cho cái mới trên cái đó"; "đảm bảo hải đồ mình
  phải dễ dùng và tương đồng [iSailor, OpenCPN] … độc lập với bản đồ đang có rồi nên
  ko bị ràng buộc". Rà + bảng đối chiếu từng màn: docs/research/hai-do-thuan-sdvico-
  2026-11.md §8 · spec màn: 07 §13.

  Một màn RIÊNG, không import fishing-map-view; dùng lại lib dữ liệu + style.
    Đợt 1: hải đồ thuần · bảng màu Ngày/Chiều/Đêm · tàu + vạch hướng · thước · đường an toàn.
    Đợt 2: hướng bản đồ (Bắc/Hướng đi/Tuyến lên) · dải số mở rộng (độ sâu dưới tàu) ·
           tấm chạm gom · Đo (ERBL) + vòng cự ly · canh neo · MOB · chuông báo động chung.

  Offline: chỉ file /data trong SHELL (sw.js) + GPS trong máy; tin bão qua
  useStormCheck (có trần + bản lưu sẵn có của app).
*/

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { diTrang } from "@/lib/dialog-focus";
import MapGL, {
  AttributionControl,
  Layer,
  Marker,
  ScaleControl,
  Source,
  type LayerProps,
  type MapLayerMouseEvent,
  type MapRef,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

import { registerPmtilesProtocol } from "@/lib/pmtiles-protocol";
import { registerDataProtocol } from "@/lib/data-protocol";
import {
  CLUSTER_BADGE,
  DEFAULT_VIEW,
  LIGHTHOUSE_LABEL_LAYER,
  LIGHTHOUSE_LAYER,
  SEAMARK_CLUSTER_MAXZOOM,
  SEAMARK_CLUSTER_RADIUS,
  SEAMARK_TIER_MINZOOM,
  SOVEREIGNTY_LABELS,
  VN_AID_MINZOOM,
  WRECK_LAYER,
  SEA_LANE_COLOR,
  CHART_TIER,
  RIG_MINZOOM,
  SEA_PIPELINE_MINZOOM,
  CABLE_LANDING_MINZOOM,
  SEA_RESTRICTED_MINZOOM,
  RESTRICTED_LABEL_COLOR,
  SEA_CABLE_COLOR,
  SEA_CABLE_DASH,
  PIPELINE_COLOR,
  PIPELINE_DASH,
  SEA_RESTRICTED_COLOR,
  RESTRICTED_FILL_COLOR,
  RESTRICTED_FILL_OPACITY,
  TIDE_STATION_LAYER,
  TIDE_STATION_LABEL_LAYER,
  TIDE_FILTER_VUNG,
  TIDE_FILTER_CANG,
  TIDE_STATION_CANG_MINZOOM,
} from "@/lib/ocean-map";
import { fetchSeaLanes } from "@/lib/sea-lanes";
import { CHART_FEATURE_ICON, CHART_ICON_SIZE } from "@/lib/chart-symbols";
import { fetchQuyenAis, fetchTauAis, moTaTau, peekQuyenAis, TAU_AIS_LAM_MOI_MS, tauGeoJson, type TauAisBan } from "@/lib/tau-ais";
import { quetQuanh, type LocAis, type MucTieu } from "@/lib/ais-cpa";
import { CO_ICON_TAU, dangKyIconTau } from "@/components/ban-do/icon-tau";
import { useAuthUser } from "@/lib/use-auth";
import { syncOwnerPhone } from "@/lib/user-sync";
import { beaufort, fetchSeaPoint, formatNumberVN, windDirectionVN } from "@/lib/marine-weather";
import { bangTheoTroi, canDanCongTrinh, canhBaoCongTrinh, cauCpa, doCaoMatTroi, khungHienTai, loaiCongTrinh, nhomTheoMuc, TEN_CONG_TRINH, VONG_GIAN_M, type SapAis } from "@/lib/hai-do/lop";
import { KhayLop } from "@/components/hai-do/khay-lop";
import { BangTuyen, BangVet } from "@/components/hai-do/bang-tuyen";
import { BangAis, type TamDs } from "@/components/hai-do/bang-ais";
import { ThanhGio, type TrangThaiLuoi } from "@/components/hai-do/thanh-gio";
import { arrowFeatures, fetchForecastGrid, WAVE_COLOR_EXPR, WIND_COLOR_EXPR, type ForecastGrid } from "@/lib/forecast-grid";
import { isoDateVN } from "@/lib/day-labels";
import { useFeatureAccess } from "@/lib/use-tier";
import { soNgayThoiTiet } from "@/lib/tier";
import { cauLech, docGpx, gioTaiDiem, giamSat, nhanDiemVet, tenMacDinh, tuyenTuVet, vietGpx, daoTuyen, type Tuyen, type Vet } from "@/lib/hai-do/tuyen";
import { dsVet, luuVet, setChay, setTuyen, setVetGhi, useChay, useTuyen, useVetGhi, xoaVet } from "@/lib/hai-do/kho-tuyen";
import { auditRoute, type RouteHit } from "@/lib/route-hazards";
import { buildHazardList, requiredDepthM } from "@/lib/hazards";
import { loadPlaces, persistPlaces, removePlace, upsertPlace, type SavedPlace } from "@/lib/places";
import { DEFAULT_BOAT } from "@/lib/route-plan";
import { DongY } from "@/components/hai-do/dong-y";
import { SHEET_AUTO_HIDE_MS } from "@/lib/use-sheet-auto-hide";
import { KHONG_PHAI_CUM, LA_CUM, SEAMARK_ICON_LAYOUT } from "@/components/ban-do/hai-do";
import { describeSeamark, fetchSeamarks, huongDiQuaPhao, type Seamark } from "@/lib/seamarks";
import { fetchDenBien, type DenBien } from "@/lib/den-bien";
import { fetchVnAids, type VnAid } from "@/lib/vn-aids";
import { fetchXacTau, moTaXacTau, type XacTau } from "@/lib/xac-tau";
import { depthClassAt, fetchDepthGrid, type DepthGrid } from "@/lib/depth-grid";
import {
  fetchTideStations,
  nearestTideStation,
  tideTrendAt,
  tideTrendText,
  tideUpcoming,
  tideUpcomingText,
  type TideStation,
} from "@/lib/tides";
import { useNavTracking, fixQuaCu } from "@/lib/use-nav-tracking";
import { useStormCheck } from "@/lib/use-storm-check";
import { useOnline } from "@/lib/use-online";
import { readUserRecord } from "@/lib/user-list-store";
import type { BoatProfile, LatLon } from "@/lib/route-plan";
import { haversineKm } from "@/lib/geo";
import { fmtCoordPair, fmtDist, speedReadout, useMapPrefs } from "@/lib/map-prefs";
import { NHAN } from "@/lib/labels";
import { apBangMauLop, doiMau } from "@/lib/hai-do/bang-mau";
import { dauVecTo, duongAnToanM, MUC_AN_TOAN_M, VEC_PHUT, vecToGeo } from "@/lib/hai-do/an-toan";
import { buildHaiDoStyle } from "@/lib/hai-do/style";
import { bangKeTiep, setHaiDoPrefs, useHaiDoPrefs } from "@/lib/hai-do/prefs";
import {
  BAN_KINH_NEO_MAC_DINH,
  DO_SAU_NGAN,
  doPvCuLy,
  dsBaoDong,
  fmtPv,
  gocCamera,
  demNhinTruoc,
  huongKeTiep,
  lamMuotHuong,
  NHAN_HUONG,
  thongSoMob,
  VONG_CU_LY_NM,
  vongTron,
  xepCham,
  xetNeo,
  type VatCham,
} from "@/lib/hai-do/may";
import { setMob, setNeo, useMob, useNeo } from "@/lib/hai-do/tam";
import { mucKhay, nutNoi, type MucKhay, chamTuAn } from "@/lib/hai-do/cot-nut";
import { baoHieuTheoTang, denBienGeo, tramTrieuGeo, vnAidGeo, xacTauGeo } from "@/components/hai-do/lop-du-lieu";
import { Chip, NutCot } from "@/components/hai-do/ui";
import { Chuong } from "@/components/hai-do/chuong";
import { TamCham, type DongCham } from "@/components/hai-do/tam-cham";
import { BangMob, BangNeo, NutMob } from "@/components/hai-do/mob-neo";
import { Popover } from "@/components/ui/popover";
import {
  AnchorIcon,
  CloudSunIcon,
  CrosshairIcon,
  GearIcon,
  LayersIcon,
  LifebuoyIcon,
  MenuIcon,
  MinusIcon,
  MoonIcon,
  NavArrowIcon,
  PlusIcon,
  RadarIcon,
  RouteIcon,
  RulerIcon,
  TargetIcon,
} from "@/components/icons";

/** Vết tàu — đường gấp khúc chấm (chưa có icon riêng trong bộ). */
function TrackIcon(p: { className?: string }) {
  return (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19c3-1 3-6 7-7s5-5 9-7" strokeDasharray="2 3" />
      <circle cx="20" cy="5" r="1.6" />
    </svg>
  );
}

registerPmtilesProtocol();
registerDataProtocol();

/** Màu nội dung bản đồ (đổi theo bảng màu như mọi lớp). */
const VEC_COLOR = "#15333e";
const DO_COLOR = "#c8461f";
const NEO_COLOR = "#086e73";
const MOB_COLOR = "#a82218";
const NHAN_BANG = { ngay: "Ngày", chieu: "Chiều", dem: "Đêm" } as const;
/** Tuyến (xanh dương — cùng màu tuyến dẫn đường của app), vết đã ghi (tím than), điểm người dùng (vàng đất). */
const TUYEN_COLOR = "#1a73e8";
const VET_COLOR = "#4338ca";
const DIEM_COLOR = "#a16207";
/** Cáp điện (đỏ sen) tách khỏi cáp quang (tím, SEA_CABLE_COLOR) — không trùng cam vùng cấm / xanh tuyến. */
const CAP_DIEN_COLOR = "#be185d";
const CAP_KHAC_COLOR = "#7c5a9c";
/** Ống xả / lấy nước — xám, nhẹ hơn ống dầu khí (mực). */
const ONG_XA_COLOR = "#6b7280";
/** Cáp + ống hiện từ nấc XA (z7) — sớm hơn màn cũ (z9): bà con cần biết từ xa để tránh thả neo, kéo lưới đáy. */
const CAP_ONG_MINZOOM = CHART_TIER.XA;
const KM_HL = 1.852;
/** Lớp chạm được — tên lớp khớp `HANG_CHAM` (lib/hai-do/may). */
const LOP_CHAM = ["hd-diem", "hd-gian", "hd-cap", "hd-ong", "hd-cap-bo", "hd-vung-cam-fill", "hd-ais", "hd-trieu", "hd-trieu-cang", "hd-xac-tau", "hd-vn-aid", "hd-seamark-near", "hd-seamark-mid", "hd-seamark-far", "hd-den-bien", "hd-island-dot", "hd-island-label"];
const RONG = { type: "FeatureCollection", features: [] } as GeoJSON.FeatureCollection;
/** Ô trong khay ⋯ — nhãn từ labels.ts (≤ 2 chữ), tên đầy đủ ở aria-label. */
const KHAY: Record<MucKhay, { nhan: string; aria: string; icon: (p: { className?: string }) => React.ReactNode }> = {
  mau: { nhan: NHAN.mauSac, aria: "Bảng màu", icon: CloudSunIcon },
  do: { nhan: NHAN.doDac, aria: "Đo phương vị, cự ly", icon: RulerIcon },
  neo: { nhan: NHAN.neoTau, aria: "Canh neo", icon: AnchorIcon },
  lop: { nhan: NHAN.lop, aria: "Lớp hải đồ", icon: LayersIcon },
  tau: { nhan: NHAN.cacTau, aria: "Danh sách tàu AIS", icon: TargetIcon },
  tuyen: { nhan: NHAN.tuyenDi, aria: "Tuyến đi", icon: RouteIcon },
  vet: { nhan: NHAN.vetTau, aria: "Vết tàu", icon: TrackIcon },
  caiDat: { nhan: NHAN.caiDat, aria: "Cài đặt hải đồ", icon: GearIcon },
  banDo: { nhan: NHAN.banDo, aria: "Về bản đồ thường", icon: RadarIcon },
};
const fc = (f: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: "FeatureCollection", features: f });

function useDuLieu<T>(fetcher: () => Promise<T>, online: boolean, ok: (v: T) => boolean = () => true): T | null {
  const [v, setV] = useState<T | null>(null);
  useEffect(() => {
    if (v) return;
    let alive = true;
    fetcher()
      .then((x) => {
        if (alive && ok(x)) setV(x);
      })
      .catch(() => {
        // im có chủ ý: file nằm trong SHELL; hỏng thì lần sóng về (online đổi) tự thử lại.
        // Thiếu một lớp thì hải đồ vẫn dùng được — không làm sập cả màn.
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `ok` là hàm lọc thuần
  }, [v, online, fetcher]);
  return v;
}
const coMuc = (x: unknown[]) => x.length > 0;

export default function HaiDoView() {
  const router = useRouter();
  const prefs = useHaiDoPrefs();
  const mapPrefs = useMapPrefs();
  const online = useOnline();
  const mapRef = useRef<MapRef>(null);
  const unit = mapPrefs.distUnit;
  const thuONguon = () =>
    mapRef.current?.getContainer().querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");

  // mớn tàu — đọc một lần (đổi hồ sơ tàu thì mở lại màn)
  const [draftM] = useState<number | null>(() => {
    const b = readUserRecord<Partial<BoatProfile>>("forfish.boat.v1").value;
    return typeof b?.draftM === "number" && b.draftM > 0 && b.draftM <= 10 ? b.draftM : null;
  });
  const anToanM = duongAnToanM(draftM, prefs.anToanM);
  // tốc độ chạy thường của tàu (hồ sơ tàu) — ước giờ trên tuyến; chưa khai ⇒ mặc định app
  const [tocDoKn] = useState<number>(() => {
    const b = readUserRecord<Partial<BoatProfile>>("forfish.boat.v1").value;
    return typeof b?.speedKn === "number" && b.speedKn > 0 && b.speedKn < 40 ? b.speedKn : DEFAULT_BOAT.speedKn;
  });

  // ── neo / MOB (sống qua tắt-mở app) ───────────────────────────────────────
  const neo = useNeo();
  const mob = useMob();
  const [banKinhNeo, setBanKinhNeo] = useState(neo?.banKinhM ?? BAN_KINH_NEO_MAC_DINH);

  // ── tuyến / vết (đợt 4) ───────────────────────────────────────────────────
  const dsTuyen = useTuyen();
  const chay = useChay();
  const vetGhiId = useVetGhi();
  const tuyenChay = chay ? dsTuyen.find((t) => t.id === chay.id) ?? null : null;

  // GPS — giữ sáng màn khi canh neo / có người rơi (cần nghe chuông) / đang chạy tuyến / đang ghi vết
  const tau = useNavTracking(true, { keepAwake: neo != null || mob != null || tuyenChay != null || vetGhiId != null });
  const coGps = tau.pos != null && tau.status !== "denied";

  // đồng hồ màn (phút MOB, GPS cũ, mặt trời, con nước) — không gọi Date.now() lúc vẽ
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 5000);
    return () => window.clearInterval(id);
  }, []);

  /*  BẢNG MÀU: chọn tay, hoặc TỰ ĐỘNG theo độ cao mặt trời tại chỗ tàu (chưa GPS ⇒ tâm bản đồ mặc định). */
  const viTriTroi = tau.pos ?? { lat: DEFAULT_VIEW.latitude, lon: DEFAULT_VIEW.longitude };
  const bang = prefs.tuDongMau ? bangTheoTroi(doCaoMatTroi(viTriTroi.lat, viTriTroi.lon, nowMs)) : prefs.bang;
  /*  Bảng màu phủ CẢ TRANG khi đang ở màn này (dock + lớp nổi portal ra <body> nằm ngoài
      `.hai-do`): dock sáng trắng giữa đêm là đúng thứ làm loá mắt. Rời màn thì gỡ. */
  useEffect(() => {
    if (bang === "ngay") return;
    const lop = `hai-do-${bang}`;
    document.documentElement.classList.add(lop);
    return () => document.documentElement.classList.remove(lop);
  }, [bang]);
  const mapStyle = useMemo(
    () => buildHaiDoStyle({ bang, anToanM, matSong: !online, toNong: prefs.toNong }),
    [bang, anToanM, online, prefs.toNong],
  );
  const nhom = nhomTheoMuc(prefs.hienThi);

  // ── hướng bản đồ ──────────────────────────────────────────────────────────
  const [huongMuot, setHuongMuot] = useState<number | null>(null);
  useEffect(() => {
    if (tau.headingDeg == null || tau.speedKmh == null) return;
    const h = tau.headingDeg;
    setHuongMuot((cu) => lamMuotHuong(cu, h));
  }, [tau.headingDeg, tau.speedKmh, tau.lastFixAt]);
  // GIÁM SÁT TUYẾN — điểm kế, PV, cự ly, giờ, lệch; tới điểm tự chuyển (lib/hai-do/tuyen)
  const gs = tuyenChay && chay ? giamSat(tuyenChay.diem, chay.toi, tau.pos, tau.speedKmh) : null;
  useEffect(() => {
    if (chay && gs && gs.toi !== chay.toi) setChay({ id: chay.id, toi: gs.toi });
  }, [chay, gs]);
  const pvChang = gs?.pvChang ?? null;
  const coGs = gs != null;
  const [goc, setGoc] = useState(0); // bearing camera hiện tại
  const [bam, setBam] = useState(true); // bản đồ đang bám theo tàu
  const daBay = useRef(false);
  const daToiZoom = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const bearing = gocCamera(prefs.huong === "tuyen" && !coGs ? "bac" : prefs.huong, tau.speedKmh != null ? huongMuot : null, pvChang, map.getBearing());
    if (!tau.pos || !bam) {
      if (Math.abs(bearing - map.getBearing()) > 0.5) map.rotateTo(bearing, { duration: 300 });
      return;
    }
    // nhìn trước: xoay theo hướng đi/tuyến + đang chạy ⇒ tàu xuống ~2/3 màn (lib/hai-do/may demNhinTruoc)
    const huongThat = prefs.huong === "tuyen" && !coGs ? "bac" : prefs.huong;
    const padding = { top: demNhinTruoc(huongThat, tau.speedKmh, map.getContainer().clientHeight), bottom: 0, left: 0, right: 0 };
    if (!daBay.current) {
      daBay.current = true;
      map.flyTo({ center: [tau.pos.lon, tau.pos.lat], zoom: Math.max(map.getZoom(), 11), bearing, padding, duration: 800 });
    } else {
      /* Cú bay đầu (zoom ≥ 11) hay bị easeTo của fix kế tiếp / hướng đang làm mượt CẮT NGANG — mở thẳng ở
         "Hướng đi lên" thì kẹt zoom toàn vùng (đo 2026-11-04: 4,6). Chưa từng tới zoom 11 ⇒ easeTo mang luôn zoom;
         tới rồi thì thôi, không giành zoom với ngón tay bà con. */
      if (map.getZoom() >= 10.9) daToiZoom.current = true;
      map.easeTo({ center: [tau.pos.lon, tau.pos.lat], bearing, padding, duration: 400, ...(daToiZoom.current ? {} : { zoom: 11 }) });
    }
  }, [tau.pos, tau.speedKmh, bam, prefs.huong, huongMuot, pvChang, coGs]);

  // ── neo: xét mỗi fix ─────────────────────────────────────────────────────
  const demNeo = useRef(0);
  const [neoTroi, setNeoTroi] = useState(false);
  const neoCachM = neo && tau.pos ? haversineKm(neo, tau.pos) * 1000 : null;
  useEffect(() => {
    if (!neo || !tau.pos) {
      demNeo.current = 0;
      setNeoTroi(false);
      return;
    }
    const r = xetNeo(neo, tau.pos, tau.accuracyM, demNeo.current);
    demNeo.current = r.dem;
    setNeoTroi(r.troi);
  }, [neo, tau.pos, tau.accuracyM, tau.lastFixAt]);

  const dau = dauVecTo(tau.pos, tau.headingDeg, tau.speedKmh, prefs.vecPhut);
  const vecGeo = useMemo(() => vecToGeo(tau.pos, dau), [tau.pos, dau]);

  // ── dữ liệu trong máy ─────────────────────────────────────────────────────
  const seamarks = useDuLieu<Seamark[]>(fetchSeamarks, online, coMuc);
  const den = useDuLieu<DenBien[]>(fetchDenBien, online, coMuc);
  const aids = useDuLieu<VnAid[]>(fetchVnAids, online, coMuc);
  const xac = useDuLieu<XacTau[]>(fetchXacTau, online, coMuc);
  const grid = useDuLieu<DepthGrid>(fetchDepthGrid, online);
  const tram = useDuLieu<TideStation[]>(fetchTideStations, online, coMuc);
  const tang = useMemo(() => (seamarks ? baoHieuTheoTang(seamarks, den) : null), [seamarks, den]);
  const denGeo = useMemo(() => (den ? denBienGeo(den) : null), [den]);
  const aidGeo = useMemo(() => (aids ? vnAidGeo(aids) : null), [aids]);
  const xacGeo = useMemo(() => (xac ? xacTauGeo(xac) : null), [xac]);
  // cáp · ống · giàn · vùng cấm · luồng — nạp vào JS (chạm + báo động), gắn `i` + loại
  const seaLanes = useDuLieu<GeoJSON.Feature[]>(fetchSeaLanes, online, coMuc);
  const congTrinhGeo = useMemo(
    () =>
      seaLanes
        ? fc(
            seaLanes.map((f, i) => ({
              ...f,
              properties: { ...f.properties, i, lct: loaiCongTrinh(String(f.properties?.kind ?? ""), f.properties?.loai as string | undefined) ?? "" },
            })),
          )
        : null,
    [seaLanes],
  );
  const vongGianGeo = useMemo(
    () =>
      seaLanes
        ? fc(
            seaLanes
              .filter((f) => f.properties?.kind === "giankhoan" && f.geometry.type === "Point")
              .map((f) => {
                const [lon, lat] = (f.geometry as GeoJSON.Point).coordinates;
                return vongTron({ lat, lon }, VONG_GIAN_M / 1000, 48);
              }),
          )
        : null,
    [seaLanes],
  );

  const doSauTau = grid && tau.pos ? depthClassAt(grid, tau.pos.lat, tau.pos.lon) : null;

  // ── bão gần (tin bão của app — có bản lưu, có trần) ───────────────────────
  const storm = useStormCheck();
  const baoGan = useMemo(() => {
    if (!tau.pos || !storm.check || !storm.check.ok) return null;
    let best: { ten: string; km: number } | null = null;
    for (const s of storm.check.storms) {
      if (s.alert !== "danger") continue;
      const km = haversineKm(tau.pos, { lat: s.lat, lon: s.lon });
      if (km < 600 && (!best || km < best.km)) best = { ten: `${s.kindLabel} ${s.name}`.trim(), km };
    }
    return best ? `${best.ten} cách ${fmtDist(best.km, unit)}` : null;
  }, [tau.pos, storm.check, unit]);

  // ── AIS (đợt 3) — chỉ tài khoản được xem (ô `tau_ais_xem` quản trị, như màn cũ) ──
  const { phone: authPhone } = useAuthUser();
  const aisPhone = authPhone ?? syncOwnerPhone();
  const [coAis, setCoAis] = useState(false);
  useEffect(() => {
    if (!aisPhone) return;
    setCoAis(peekQuyenAis(aisPhone) ?? false);
    let alive = true;
    void fetchQuyenAis(aisPhone).then((v) => alive && v != null && setCoAis(v));
    return () => {
      alive = false;
    };
  }, [aisPhone]);
  const [aisBan, setAisBan] = useState<TauAisBan | null>(null);
  const aisBat = coAis && prefs.lopAis;
  useEffect(() => {
    if (!aisBat) return;
    let alive = true;
    const tai = () =>
      fetchTauAis()
        .then((r) => alive && setAisBan(r.ban))
        .catch(() => {
          /* không tải được (mất sóng) — giữ bản cũ đang vẽ; fetchTauAis tự lùi về bản lưu */
        });
    tai();
    const id = window.setInterval(tai, TAU_AIS_LAM_MOI_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [aisBat, online]);
  const aisGeo = useMemo(() => (aisBat && aisBan ? tauGeoJson(aisBan) : null), [aisBat, aisBan]);
  const cpa = useMemo(() => {
    if (!aisBat || !aisBan || !tau.pos) return null;
    const ds = quetQuanh(aisBan, { pos: tau.pos, speedKmh: tau.speedKmh, headingDeg: tau.headingDeg }, 6, nowMs);
    return cauCpa(ds, (nm) => fmtDist(nm * KM_HL, unit, nm < 1 ? 2 : 1));
  }, [aisBat, aisBan, tau.pos, tau.speedKmh, tau.headingDeg, nowMs, unit]);

  // ── con nước trên hải đồ (đợt 3) ──────────────────────────────────────────
  const nowPhut = Math.floor(nowMs / 300000); // vẽ lại ký hiệu triều mỗi 5 phút
  const trieuGeo = useMemo(
    () => (prefs.lopTrieu && tram ? tramTrieuGeo(tram, nowPhut * 300000) : null),
    [prefs.lopTrieu, tram, nowPhut],
  );

  // ── công trình: neo gần cáp/ống, tàu trong vòng giàn ─────────────────────
  const congTrinh = useMemo(
    () => (seaLanes ? canhBaoCongTrinh(seaLanes as never, tau.pos, neo) : null),
    [seaLanes, tau.pos, neo],
  );

  // ── báo động chung ────────────────────────────────────────────────────────
  const gpsMat = tau.status === "lost" || fixQuaCu(tau.lastFixAt, tau.speedKmh, nowMs);
  const baoDong = dsBaoDong({
    mob,
    neoTroi,
    neoCachM,
    baoGan,
    doSau: doSauTau,
    anToanM,
    gpsMat: tau.lastFixAt != null && gpsMat,
    cpa,
    congTrinh,
    lechTuyen: gs ? cauLech(gs, (km) => fmtDist(km, unit, km < 10 ? 1 : 0)) : null,
    hetTuyen: gs?.het ?? false,
  });

  // ── tâm màn (cho Đo) ──────────────────────────────────────────────────────
  const [tam, setTam] = useState<LatLon | null>(null);
  const [doMo, setDoMo] = useState(false);
  const [gocDo, setGocDo] = useState<LatLon | null>(null);
  const goDo = gocDo ?? tau.pos;
  const ketQuaDo = doMo && goDo && tam ? doPvCuLy(goDo, tam) : null;
  const doGeo = useMemo(
    () =>
      doMo && goDo && tam
        ? fc([{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[goDo.lon, goDo.lat], [tam.lon, tam.lat]] } }])
        : RONG,
    [doMo, goDo, tam],
  );

  // ── DANH SÁCH TÀU AIS (bảng §8 hàng 11, sau đợt 4) — tâm = tàu mình; chưa GPS ⇒ tâm màn ──
  const [tamDs, setTamDs] = useState<TamDs>(12);
  const [locDs, setLocDs] = useState<LocAis>("tat");
  const [sapDs, setSapDs] = useState<SapAis>("tcpa");
  const dsAis = useMemo(() => {
    const goc = tau.pos ?? tam;
    if (!aisBat || !aisBan || !goc) return null;
    return quetQuanh(aisBan, { pos: goc, speedKmh: tau.pos ? tau.speedKmh : null, headingDeg: tau.pos ? tau.headingDeg : null }, tamDs, nowMs);
  }, [aisBat, aisBan, tau.pos, tam, tau.speedKmh, tau.headingDeg, tamDs, nowMs]);
  const tuoiBanAis = aisBan ? Math.max(0, (nowMs - Date.parse(aisBan.luc)) / 60_000) : null;

  // ── LỚP GIÓ / SÓNG TOÀN VÙNG + TUA GIỜ (bảng §8 hàng 17) — lưới của màn cũ, cùng bản lưu + luật gói ──
  const { access } = useFeatureAccess();
  const soNgay = soNgayThoiTiet(access);
  const lopTT = prefs.lopThoiTiet;
  const [luoi, setLuoi] = useState<ForecastGrid | null>(null);
  const [luoiTT, setLuoiTT] = useState<TrangThaiLuoi>("dang-tai");
  const [khungIdx, setKhungIdx] = useState(0);
  useEffect(() => {
    if (lopTT === "tat") return;
    let alive = true;
    setLuoiTT("dang-tai");
    /* fetchForecastGrid tự lùi về bản lưu (kho dự báo) khi mất sóng + có trần thời gian (tai-co-nhip);
       hỏng hẳn ⇒ "loi" — dải nói rõ, hải đồ vẫn dùng bình thường. Sóng về (online đổi) ⇒ thử lại. */
    fetchForecastGrid(soNgay)
      .then((g) => {
        if (!alive) return;
        setLuoi(g);
        setLuoiTT("ok");
        setKhungIdx(khungHienTai(g.times, Date.now()));
      })
      .catch(() => alive && setLuoiTT("loi"));
    return () => {
      alive = false;
    };
  }, [lopTT, soNgay, online]);
  const muiTenGeo = useMemo(
    () => (lopTT !== "tat" && luoi ? arrowFeatures(luoi, Math.min(khungIdx, luoi.times.length - 1), lopTT === "gio" ? "wind" : "wave") : null),
    [lopTT, luoi, khungIdx],
  );

  // ── vòng: cự ly quanh tàu + vòng neo + MOB ───────────────────────────────
  const vongGeo = useMemo(
    () => (prefs.vong && tau.pos ? fc(VONG_CU_LY_NM.map((nm) => vongTron(tau.pos!, nm * KM_HL))) : RONG),
    [prefs.vong, tau.pos],
  );
  const neoGeo = useMemo(() => (neo ? fc([vongTron(neo, neo.banKinhM / 1000)]) : RONG), [neo]);
  const mobGeo = useMemo(
    () =>
      mob && tau.pos
        ? fc([{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[tau.pos.lon, tau.pos.lat], [mob.lon, mob.lat]] } }])
        : RONG,
    [mob, tau.pos],
  );
  const soMob = mob && tau.pos ? thongSoMob(mob, tau.pos, Math.max(nowMs, tau.lastFixAt ?? 0), tau.speedKmh) : null;

  // ── lớp JSX theo bảng màu ─────────────────────────────────────────────────
  type Spec = { id: string; type: string; paint?: Record<string, unknown>; layout?: Record<string, unknown> } & Record<string, unknown>;
  const L = (spec: object): LayerProps => apBangMauLop(spec as Spec, bang) as unknown as LayerProps;
  const iconLop = (id: string, minzoom: number, leCum = false) =>
    L({ id, type: "symbol", layout: SEAMARK_ICON_LAYOUT, minzoom, ...(leCum ? { filter: KHONG_PHAI_CUM } : {}) });
  const cumLop = (id: string, minzoom: number): LayerProps[] => [
    L({
      id: `${id}-cum`,
      type: "circle",
      minzoom,
      filter: LA_CUM,
      paint: {
        "circle-radius": CLUSTER_BADGE.radius,
        "circle-color": CLUSTER_BADGE.fill,
        "circle-stroke-color": CLUSTER_BADGE.stroke,
        "circle-stroke-width": 2,
      },
    }),
    L({
      id: `${id}-cum-so`,
      type: "symbol",
      minzoom,
      filter: LA_CUM,
      layout: {
        "text-field": ["concat", "+", ["to-string", ["get", "point_count"]]],
        "text-font": ["Noto Sans Bold"],
        "text-size": 13,
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      },
      paint: { "text-color": CLUSTER_BADGE.text },
    }),
  ];

  // ── tấm chạm ──────────────────────────────────────────────────────────────
  // ── BẢNG TUYẾN / VẾT · ĐIỂM NGƯỜI DÙNG · GPX (đợt 4) ─────────────────────────
  const [bang_, setBang] = useState<"tuyen" | "vet" | "tau" | null>(null);
  const [soan, setSoan] = useState<{ id: string | null; ten: string; diem: LatLon[] } | null>(null);
  const [kiem, setKiem] = useState<{ hits: RouteHit[]; missing: string[] } | null>(null);
  const [places, setPlaces] = useState<SavedPlace[]>(() => loadPlaces());
  const [vets, setVets] = useState<Vet[]>([]);
  const [vetXemId, setVetXemId] = useState<string | null>(null);
  const [diemMoi, setDiemMoi] = useState<LatLon | null>(null);
  const [tenDiem, setTenDiem] = useState("");
  const [baoLoi, setBaoLoi] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const taiVet = () =>
    dsVet()
      .then(setVets)
      .catch(() => setBaoLoi("Máy không cho lưu vết (bộ nhớ trình duyệt bị chặn)"));

  // GHI VẾT: mỗi fix mới qua bộ lọc (≥ 20 m hoặc 30 s, bỏ fix kém) ⇒ thêm điểm + ghi IndexedDB ngay
  // (tắt app giữa chừng không mất vết đã ghi). Ghi hỏng ⇒ nói thật, không im.
  const vetDangGhi = useRef<Vet | null>(null);
  useEffect(() => {
    if (!vetGhiId || !tau.pos || tau.lastFixAt == null) return;
    const v = vetDangGhi.current;
    if (!v || v.id !== vetGhiId) return;
    const cuoi = v.diem.length ? v.diem[v.diem.length - 1] : null;
    if (!nhanDiemVet(cuoi, tau.pos.lat, tau.pos.lon, tau.lastFixAt, tau.accuracyM)) return;
    v.diem.push([tau.pos.lat, tau.pos.lon, tau.lastFixAt]);
    luuVet(v)
      .then(() => setVets((ds) => [v, ...ds.filter((x) => x.id !== v.id)]))
      .catch(() => setBaoLoi("Không ghi được vết vào máy"));
  }, [vetGhiId, tau.pos, tau.lastFixAt, tau.accuracyM]);
  // mở lại app giữa lúc đang ghi ⇒ nạp lại vết đang dở rồi ghi tiếp
  useEffect(() => {
    if (!vetGhiId || vetDangGhi.current?.id === vetGhiId) return;
    dsVet()
      .then((ds) => {
        setVets(ds);
        vetDangGhi.current = ds.find((v) => v.id === vetGhiId) ?? { id: vetGhiId, batDau: Date.now(), diem: [] };
      })
      .catch(() => setBaoLoi("Không đọc được vết đang ghi"));
  }, [vetGhiId]);

  const kiemTuyen = (diem: LatLon[]) => {
    try {
      const need = requiredDepthM(draftM, null, tocDoKn);
      const kho = buildHazardList({ xacTau: xac ?? null, laneFeatures: seaLanes ?? null, seamarks: seamarks ?? null } as never, need);
      setKiem(
        auditRoute({
          waypoints: diem,
          hoursAt: gioTaiDiem(diem, tocDoKn),
          departMs: nowMs,
          draftM,
          stores: {
            hazards: kho.hazards,
            passable: kho.passable,
            lanes: seaLanes ?? undefined,
            seamarks: seamarks ?? undefined,
            vnAids: aids ?? undefined,
            tides: tram ?? undefined,
            border: true,
          },
        }),
      );
    } catch {
      setKiem({ hits: [], missing: ["bộ soi gặp lỗi"] });
    }
  };

  /** Xuất GPX: chia sẻ tệp (máy có) — không thì tải xuống. */
  const xuatGpx = async (xml: string, ten: string) => {
    const file = new File([xml], `${ten.replace(/[^\p{L}\p{N}\- ]+/gu, "").trim() || "sdfish"}.gpx`, { type: "application/gpx+xml" });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: ten });
        return;
      }
    } catch {
      /* bà con huỷ chia sẻ — thôi, không tải thay */
      return;
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  };
  const nhapGpx = async (f: File) => {
    try {
      const r = docGpx(await f.text(), Date.now());
      if (r.tuyen.length) setTuyen([...r.tuyen, ...dsTuyen]);
      for (const v of r.vet) await luuVet(v);
      if (r.vet.length) void taiVet();
      if (r.diem.length) {
        const moi = r.diem.reduce((ds, d) => upsertPlace(ds, { name: d.ten, lat: d.lat, lon: d.lon }), places);
        if (persistPlaces(moi)) setPlaces(moi);
      }
      setBaoLoi(
        r.tuyen.length + r.vet.length + r.diem.length
          ? `Đã nhập ${r.tuyen.length} tuyến · ${r.vet.length} vết · ${r.diem.length} điểm`
          : "Tệp không có tuyến, vết hay điểm nào đọc được",
      );
    } catch {
      setBaoLoi("Không đọc được tệp GPX");
    }
  };

  // ĐIỂM NGƯỜI DÙNG: giữ ngón ~0,6 s trên hải đồ (chuột phải trên máy tính) ⇒ thêm điểm
  const giu = useRef<{ t: number; x: number; y: number; ll: LatLon } | null>(null);
  const batDauGiu = (x: number, y: number, ll: LatLon) => {
    giu.current = { t: Date.now(), x, y, ll };
  };
  const ketThucGiu = (x: number, y: number) => {
    const g = giu.current;
    giu.current = null;
    if (!g || soan || doMo) return;
    if (Date.now() - g.t >= 600 && Math.hypot(x - g.x, y - g.y) < 10) {
      setDiemMoi(g.ll);
      setTenDiem(`Điểm ${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`);
    }
  };

  // hình vẽ: tuyến đang soạn / đang chạy / vết / điểm
  const soanGeo = useMemo(() => {
    if (!soan) return RONG;
    const f: GeoJSON.Feature[] = soan.diem.map((p, k) => ({ type: "Feature", properties: { so: String(k + 1) }, geometry: { type: "Point", coordinates: [p.lon, p.lat] } }));
    if (soan.diem.length >= 2) f.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: soan.diem.map((p) => [p.lon, p.lat]) } });
    return fc(f);
  }, [soan]);
  const chayGeo = useMemo(() => {
    if (!tuyenChay) return RONG;
    const f: GeoJSON.Feature[] = tuyenChay.diem.map((p, k) => ({
      type: "Feature",
      properties: { so: String(k + 1), qua: chay && k < chay.toi ? 1 : 0 },
      geometry: { type: "Point", coordinates: [p.lon, p.lat] },
    }));
    f.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: tuyenChay.diem.map((p) => [p.lon, p.lat]) } });
    return fc(f);
  }, [tuyenChay, chay]);
  const vetGeo = useMemo(() => {
    const ds = vets.filter((v) => v.id === vetXemId || v.id === vetGhiId).filter((v) => v.diem.length >= 2);
    return fc(ds.map((v) => ({ type: "Feature", properties: { ghi: v.id === vetGhiId ? 1 : 0 }, geometry: { type: "LineString", coordinates: v.diem.map(([la, lo]) => [lo, la]) } })));
  }, [vets, vetXemId, vetGhiId]);
  const diemGeo = useMemo(
    () => fc(places.map((p) => ({ type: "Feature", properties: { id: p.id, ten: p.name }, geometry: { type: "Point", coordinates: [p.lon, p.lat] } }))),
    [places],
  );

  const [cham, setCham] = useState<DongCham[] | null>(null);
  const chamKhoa = useRef<string | null>(null);
  /** gió sóng tại điểm đã về / hỏng xong — mốc bắt đầu đếm tự ẩn (như sheet bản đồ thường: đếm từ lúc NGÃ NGŨ) */
  const [chamXong, setChamXong] = useState(false);
  /** lúc một lớp nổi vừa đóng vì chạm ra ngoài — cú chạm đó CHỈ để đóng, không bung tấm chạm */
  const vuaDongRef = useRef(0);
  useEffect(() => {
    if (!cham || !chamXong || !chamTuAn(cham)) return;
    const t = setTimeout(() => setCham(null), SHEET_AUTO_HIDE_MS);
    return () => clearTimeout(t);
  }, [cham, chamXong]);
  const onCham = (e: MapLayerMouseEvent) => {
      if (doMo) return;
      if (Date.now() - vuaDongRef.current < 500) return;
      if (soan) {
        setSoan({ ...soan, diem: [...soan.diem, { lat: e.lngLat.lat, lon: e.lngLat.lng }] });
        setKiem(null);
        return;
      }
      const map = mapRef.current?.getMap();
      if (!map) return;
      const { x, y } = e.point;
      const R = 16;
      const coLop = LOP_CHAM.filter((id) => map.getLayer(id));
      const fs = coLop.length ? map.queryRenderedFeatures([[x - R, y - R], [x + R, y + R]], { layers: coLop }) : [];
      const vat: VatCham[] = [];
      for (const f of fs) {
        if (f.properties?.point_count != null) continue;
        // đường / vùng (cáp, ống, vùng cấm) không có một điểm để đo ⇒ coi như cách đúng bán kính chạm
        const px =
          f.geometry.type === "Point"
            ? (() => {
                const p = map.project((f.geometry as GeoJSON.Point).coordinates as [number, number]);
                return Math.hypot(p.x - x, p.y - y);
              })()
            : R;
        vat.push({ lop: f.layer.id, i: Number(f.properties?.i ?? f.properties?.rank ?? 0), px });
      }
      const dong: DongCham[] = [];
      const islands = fs.filter((f) => f.layer.id.startsWith("hd-island"));
      for (const v of xepCham(vat)) {
        if (v.lop === "hd-diem") {
          const id = fs.find((f) => f.layer.id === "hd-diem")?.properties?.id as string | undefined;
          const pl = places.find((q) => q.id === id);
          if (pl)
            dong.push({
              tieu: pl.name,
              phu: "Điểm đã lưu",
              viec: {
                nhan: NHAN.xoa,
                lam: () => {
                  const moi = removePlace(places, pl.id);
                  if (persistPlaces(moi)) setPlaces(moi);
                  setCham(null);
                },
              },
            });
          continue;
        }
        if (["hd-gian", "hd-cap", "hd-ong", "hd-cap-bo", "hd-vung-cam-fill"].includes(v.lop) && seaLanes?.[v.i]) {
          const pr = seaLanes[v.i].properties ?? {};
          const lct = loaiCongTrinh(String(pr.kind ?? ""), pr.loai as string | undefined);
          if (lct) dong.push({ tieu: TEN_CONG_TRINH[lct], phu: `${pr.ten ? `${String(pr.ten)} · ` : ""}${canDanCongTrinh(lct)}`, canh: true });
          else dong.push({ tieu: String(pr.ten ?? "Vùng cấm"), phu: pr.kind === "cap-bo" ? "Điểm cáp cập bờ — không thả neo gần" : "Vùng cấm — xem tên vùng", canh: true });
        } else if (v.lop === "hd-ais") {
          const id = fs.find((f) => f.layer.id === "hd-ais")?.properties?.id;
          const t = aisBan?.tau.find((x) => x.id === id);
          if (t) dong.push({ tieu: t.ten ?? "Tàu AIS", phu: moTaTau(t) });
        } else if ((v.lop === "hd-trieu" || v.lop === "hd-trieu-cang") && tram?.[v.i]) {
          const st = tram[v.i];
          const tiep = tideUpcoming(st, nowMs, 2);
          dong.push({ tieu: `Trạm ${st.name} — ${tideTrendText(tideTrendAt(st, nowMs))}`, phu: tiep.map(tideUpcomingText).join(" · ") || undefined });
        } else if (v.lop === "hd-xac-tau" && xac?.[v.i]) dong.push({ tieu: moTaXacTau(xac[v.i]), canh: true });
        else if (v.lop.startsWith("hd-seamark") && seamarks?.[v.i]) {
          const m = seamarks[v.i];
          dong.push({ tieu: describeSeamark(m), phu: huongDiQuaPhao(m) ?? undefined });
        } else if (v.lop === "hd-vn-aid" && aids?.[v.i]) {
          const a = aids[v.i];
          dong.push({ tieu: a.ten ? `${a.ten} — ${describeSeamark(a)}` : describeSeamark(a), phu: a.tacDung ?? undefined });
        } else if (v.lop === "hd-den-bien" && den?.[v.i]) {
          dong.push({ tieu: `Đèn ${den[v.i].ten}`, phu: describeSeamark(den[v.i]) });
        } else if (v.lop.startsWith("hd-island")) {
          const ten = islands.find((f) => f.layer.id === v.lop)?.properties?.name;
          if (ten) dong.push({ tieu: String(ten) });
        }
      }
      const { lat, lng } = e.lngLat;
      const cls = grid ? depthClassAt(grid, lat, lng) : null;
      if (cls != null && cls !== 0) dong.push({ tieu: `Độ sâu: ${DO_SAU_NGAN[cls]}`, phu: "theo lưới độ sâu — tham khảo", canh: cls <= 3 });
      if (tram?.length) {
        const g = nearestTideStation(tram, lat, lng);
        if (g && g.distanceKm <= 120) {
          const tiep = tideUpcoming(g.station, nowMs, 1)[0];
          dong.push({
            tieu: `${tideTrendText(tideTrendAt(g.station, nowMs))} — trạm ${g.station.name}`,
            phu: tiep ? tideUpcomingText(tiep) : undefined,
          });
        }
      }
      const tuTau = tau.pos ? doPvCuLy(tau.pos, { lat, lon: lng }) : null;
      dong.push({
        tieu: fmtCoordPair(lat, lng, mapPrefs.coordFormat),
        phu: tuTau ? `Từ tàu: ${fmtPv(tuTau.pvDeg)} · ${fmtDist(tuTau.cuLyKm, unit, tuTau.cuLyKm < 10 ? 1 : 0)}` : undefined,
      });
      setCham(dong);
      setChamXong(false);
      /*  GIÓ SÓNG HÔM NAY tại điểm (đợt 3) — `fetchSeaPoint` có bản lưu trước/mạng sau + trần; chỉ HÔM NAY như
          tài khoản thường (tier). Trên bờ / hỏng ⇒ không thêm dòng. Chạm điểm khác trước khi về ⇒ bỏ. */
      const khoa = `${lat.toFixed(4)},${lng.toFixed(4)}`;
      chamKhoa.current = khoa;
      fetchSeaPoint({ lat, lon: lng }, 1)
        .then((c) => {
          if (chamKhoa.current !== khoa) return;
          setChamXong(true);
          if (!c.onSea) return;
          const bits: string[] = [];
          if (c.windKmh != null) bits.push(`Gió cấp ${beaufort(c.windKmh)}${c.windDirDeg != null ? ` ${windDirectionVN(c.windDirDeg)}` : ""}`);
          if (c.waveM != null) bits.push(`sóng ${formatNumberVN(c.waveM)} m`);
          if (!bits.length) return;
          setCham((cu) => (cu ? [...cu, { tieu: bits.join(" · "), phu: c.stale ? "bản lưu trong máy" : "hôm nay" }] : cu));
        })
        .catch(() => {
          /* mất sóng không bản lưu — tấm chạm vẫn đủ phần trong máy */
          if (chamKhoa.current === khoa) setChamXong(true);
        });
  };

  const [caiDatMo, setCaiDatMo] = useState(false);
  const [neoMo, setNeoMo] = useState(false);
  const [nutNeo, setNutNeo] = useState<HTMLButtonElement | null>(null);
  const [moRong, setMoRong] = useState(false);

  // ── cột nút thông minh + khay ⋯ ────────────────────────────────────────────
  const [khayMo, setKhayMo] = useState(false);
  const [nutThem, setNutThem] = useState<HTMLButtonElement | null>(null);
  const tinhCot = { coBaoDong: baoDong.length > 0, dangNeo: neo != null, dangDo: doMo, nutZoom: prefs.nutZoom };
  const cotNut = nutNoi(tinhCot);
  const khay = mucKhay(tinhCot, { lop: true, tau: aisBat, tuyen: true, vet: true });
  const [lopMo, setLopMo] = useState(false);
  /*  MỘT LÚC MỘT LỚP NỔI (như bản đồ thường 07 §10.7 I; anh Long 04/11 chụp khay ⋯ đè lên Cài đặt): mở thứ nào thì
      đóng hết khay/bảng còn lại + tấm chạm. Popover chỉ tự đóng khi chạm NGOÀI nó và ngoài nút neo — Cài đặt/Lớp neo
      vào nút ⋯ nên bấm ⋯ không đóng chúng; phải đóng ở đây. */
  const dongNoi = () => {
    setKhayMo(false);
    setCaiDatMo(false);
    setLopMo(false);
    setNeoMo(false);
    setCham(null);
  };
  /** popover đóng vì chạm ra ngoài ⇒ ghi mốc để cú chạm bản đồ đó không bung tấm chạm */
  const dongBoiNgoai = (dong: () => void) => () => {
    vuaDongRef.current = Date.now();
    dong();
  };
  const chonKhay = (m: MucKhay) => {
    if (m === "mau") {
      setHaiDoPrefs({ bang: bangKeTiep(bang) });
      return; // khay mở tiếp — chạm nữa để đổi tiếp
    }
    dongNoi();
    if (m === "do") {
      setDoMo(true);
      setGocDo(null);
      setCham(null);
    } else if (m === "neo") setNeoMo(true);
    else if (m === "caiDat") setCaiDatMo(true);
    else if (m === "lop") setLopMo(true);
    else if (m === "tau") setBang("tau");
    else if (m === "tuyen") setBang("tuyen");
    else if (m === "vet") {
      setBang("vet");
      void taiVet();
    }
    else if (m === "banDo") {
      setHaiDoPrefs({ moHaiDo: false });
      // diTrang, KHÔNG router.push: khay ⋯ vừa đóng sẽ lùi mục lịch sử của nó — push trần thì cú lùi đó
      // kéo bà con về lại /hai-do ("click 3 lần mới đổi", anh Long 2026-11-04). Xem lib/dialog-focus.
      diTrang(router, "/ngu-truong");
    }
  };

  const toc = speedReadout(tau.speedKmh, unit);
  const huong = tau.headingDeg != null && tau.speedKmh != null ? fmtPv(tau.headingDeg) : "—";
  const gpsChu =
    tau.status === "denied" ? "Máy chưa cho GPS" : tau.status === "lost" ? "Mất GPS — đang tìm" : tau.pos ? null : "Đang bắt GPS…";
  const gio = tau.lastFixAt ? new Date(tau.lastFixAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : null;

  return (
    <div className="hai-do relative h-full w-full bg-background" data-bang-mau={bang}>
      <MapGL
        ref={mapRef}
        initialViewState={DEFAULT_VIEW}
        mapStyle={mapStyle as unknown as string}
        attributionControl={false}
        dragRotate={false}
        pitchWithRotate={false}
        touchPitch={false}
        onDragStart={() => setBam(false)}
        onMove={(e) => {
          setTam({ lat: e.viewState.latitude, lon: e.viewState.longitude });
          setGoc(e.viewState.bearing);
        }}
        onClick={onCham}
        onContextMenu={(e) => {
          if (soan || doMo) return;
          setDiemMoi({ lat: e.lngLat.lat, lon: e.lngLat.lng });
          setTenDiem(`Điểm ${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`);
        }}
        onTouchStart={(e) => {
          if (e.points.length === 1) batDauGiu(e.point.x, e.point.y, { lat: e.lngLat.lat, lon: e.lngLat.lng });
          else giu.current = null;
        }}
        onTouchMove={(e) => {
          const g = giu.current;
          if (g && Math.hypot(e.point.x - g.x, e.point.y - g.y) > 10) giu.current = null;
        }}
        onTouchEnd={(e) => ketThucGiu(e.point.x, e.point.y)}
        // ô nguồn bản đồ: MapLibre bung sẵn che đáy màn — thu về nút ⓘ (cùng cách màn bản đồ cũ `thuONguon`)
        onLoad={(e) => {
          thuONguon();
          dangKyIconTau(e.target);
          e.target.touchZoomRotate.disableRotation();
          const c = e.target.getCenter();
          setTam({ lat: c.lat, lon: c.lng });
        }}
        onStyleData={(e) => {
          thuONguon();
          dangKyIconTau(e.target); // đổi style (bảng màu) xoá ảnh tự thêm ⇒ nạp lại icon tàu AIS
        }}
        onResize={thuONguon}
        style={{ width: "100%", height: "100%" }}
      >
        <AttributionControl compact position="bottom-left" />
        <ScaleControl position="bottom-left" unit={unit === "km" ? "metric" : "nautical"} maxWidth={96} />

        {xacGeo && (
          <Source id="hd-xac-tau" type="geojson" data={xacGeo}>
            <Layer {...L({ ...WRECK_LAYER, id: "hd-xac-tau" })} />
          </Source>
        )}
        {nhom.baoHieu && tang && (
          <Source id="hd-seamarks-far" type="geojson" data={tang.far}>
            <Layer {...iconLop("hd-seamark-far", SEAMARK_TIER_MINZOOM.far)} />
          </Source>
        )}
        {nhom.baoHieu && tang && (
          <Source id="hd-seamarks-mid" type="geojson" data={tang.mid} cluster clusterRadius={SEAMARK_CLUSTER_RADIUS} clusterMaxZoom={SEAMARK_CLUSTER_MAXZOOM.mid}>
            <Layer {...iconLop("hd-seamark-mid", SEAMARK_TIER_MINZOOM.mid, true)} />
            {cumLop("hd-seamark-mid", SEAMARK_TIER_MINZOOM.mid).map((s) => (
              <Layer key={s.id} {...s} />
            ))}
          </Source>
        )}
        {nhom.baoHieu && tang && (
          <Source id="hd-seamarks-near" type="geojson" data={tang.near} cluster clusterRadius={SEAMARK_CLUSTER_RADIUS} clusterMaxZoom={SEAMARK_CLUSTER_MAXZOOM.near}>
            <Layer {...iconLop("hd-seamark-near", SEAMARK_TIER_MINZOOM.near, true)} />
            {cumLop("hd-seamark-near", SEAMARK_TIER_MINZOOM.near).map((s) => (
              <Layer key={s.id} {...s} />
            ))}
          </Source>
        )}
        {nhom.baoHieu && aidGeo && (
          <Source id="hd-vn-aids" type="geojson" data={aidGeo} cluster clusterRadius={SEAMARK_CLUSTER_RADIUS} clusterMaxZoom={SEAMARK_CLUSTER_MAXZOOM.mid}>
            <Layer {...iconLop("hd-vn-aid", VN_AID_MINZOOM, true)} />
            {cumLop("hd-vn-aid", VN_AID_MINZOOM).map((s) => (
              <Layer key={s.id} {...s} />
            ))}
          </Source>
        )}
        {denGeo && (
          <Source id="hd-den-bien" type="geojson" data={denGeo}>
            <Layer {...L({ ...LIGHTHOUSE_LAYER, id: "hd-den-bien" })} />
            <Layer {...L({ ...LIGHTHOUSE_LABEL_LAYER, id: "hd-den-bien-ten" })} />
          </Source>
        )}

        {/* CÁP · ỐNG · GIÀN · VÙNG CẤM (mức Chuẩn trở lên — tàu cá thả neo, kéo lưới đáy) + LUỒNG (mức Đủ).
            Dữ liệu vn-sea-lanes nạp vào JS (`congTrinhGeo`) để chạm ra tên + báo động neo gần cáp / vào vòng giàn. */}
        {congTrinhGeo && (nhom.luong || nhom.camCap) && (
          <Source id="hd-sea-lanes" type="geojson" data={congTrinhGeo}>
            {nhom.camCap && (
              <Layer
                {...L({
                  id: "hd-vung-cam-fill",
                  type: "fill",
                  minzoom: SEA_RESTRICTED_MINZOOM,
                  filter: ["all", ["==", ["get", "kind"], "vungcam"], ["==", ["geometry-type"], "Polygon"]],
                  paint: { "fill-color": RESTRICTED_FILL_COLOR, "fill-opacity": RESTRICTED_FILL_OPACITY },
                })}
              />
            )}
            {nhom.camCap && (
              <Layer
                {...L({
                  id: "hd-vung-cam-line",
                  type: "line",
                  minzoom: SEA_RESTRICTED_MINZOOM,
                  filter: ["==", ["get", "kind"], "vungcam"],
                  paint: { "line-color": SEA_RESTRICTED_COLOR, "line-width": 1.6, "line-dasharray": [2, 2] },
                })}
              />
            )}
            {nhom.camCap && (
              <Layer
                {...L({
                  id: "hd-cap",
                  type: "line",
                  minzoom: CAP_ONG_MINZOOM,
                  filter: ["==", ["get", "kind"], "cap"],
                  paint: {
                    "line-color": ["match", ["get", "lct"], "cap-quang", SEA_CABLE_COLOR, "cap-dien", CAP_DIEN_COLOR, CAP_KHAC_COLOR],
                    "line-width": ["interpolate", ["linear"], ["zoom"], 7, 1.2, 12, 2.2],
                    "line-dasharray": [...SEA_CABLE_DASH],
                  },
                })}
              />
            )}
            {nhom.camCap && (
              <Layer
                {...L({
                  id: "hd-ong",
                  type: "line",
                  minzoom: CAP_ONG_MINZOOM,
                  filter: ["==", ["get", "kind"], "ong"],
                  paint: {
                    "line-color": ["match", ["get", "lct"], "ong-xa", ONG_XA_COLOR, PIPELINE_COLOR],
                    "line-width": ["interpolate", ["linear"], ["zoom"], 7, 1.4, 12, 2.6],
                    "line-dasharray": [...PIPELINE_DASH],
                  },
                })}
              />
            )}
            {nhom.camCap && (
              <Layer
                {...L({
                  id: "hd-ong-dau",
                  type: "symbol",
                  minzoom: SEA_PIPELINE_MINZOOM,
                  filter: ["all", ["==", ["get", "kind"], "ong"], ["==", ["get", "lct"], "ong-dau-khi"]],
                  layout: {
                    "symbol-placement": "line",
                    "symbol-spacing": 140,
                    "icon-image": CHART_FEATURE_ICON.pipelineMark,
                    "icon-size": CHART_ICON_SIZE,
                    "icon-allow-overlap": true,
                  },
                })}
              />
            )}
            {nhom.camCap && (
              <Layer
                {...L({
                  id: "hd-cap-bo",
                  type: "symbol",
                  minzoom: CABLE_LANDING_MINZOOM,
                  filter: ["==", ["get", "kind"], "cap-bo"],
                  layout: { "icon-image": CHART_FEATURE_ICON.cableLanding, "icon-size": CHART_ICON_SIZE, "icon-allow-overlap": true },
                })}
              />
            )}
            {nhom.camCap && (
              <Layer
                {...L({
                  id: "hd-cam-neo",
                  type: "symbol",
                  minzoom: SEA_RESTRICTED_MINZOOM,
                  filter: ["all", ["==", ["get", "loai"], "cam-neo"], ["!=", ["get", "hoDang"], true]],
                  layout: { "icon-image": CHART_FEATURE_ICON.noAnchor, "icon-size": CHART_ICON_SIZE, "icon-allow-overlap": true },
                })}
              />
            )}
            {nhom.camCap && (
              <Layer
                {...L({
                  id: "hd-vung-cam-ten",
                  type: "symbol",
                  minzoom: SEA_RESTRICTED_MINZOOM,
                  filter: ["all", ["==", ["get", "kind"], "vungcam"], ["!=", ["get", "hoDang"], true]],
                  layout: { "text-field": ["get", "ten"], "text-font": ["Noto Sans Bold"], "text-size": 12, "text-max-width": 9, "text-optional": true },
                  paint: { "text-color": RESTRICTED_LABEL_COLOR, "text-halo-color": "#ffffff", "text-halo-width": 1.4 },
                })}
              />
            )}
            {nhom.camCap && (
              <Layer
                {...L({
                  id: "hd-gian",
                  type: "symbol",
                  minzoom: RIG_MINZOOM,
                  filter: ["==", ["get", "kind"], "giankhoan"],
                  layout: { "icon-image": "platform", "icon-size": CHART_ICON_SIZE, "icon-allow-overlap": true, "icon-ignore-placement": true },
                })}
              />
            )}
            {nhom.luong && (
              <Layer
                {...L({
                  id: "hd-luong",
                  type: "line",
                  filter: ["match", ["get", "kind"], ["luong", "phanluong", "tuyen"], true, false],
                  paint: { "line-color": SEA_LANE_COLOR, "line-width": 1.4, "line-dasharray": [3, 2], "line-opacity": 0.8 },
                })}
              />
            )}
          </Source>
        )}
        {/* VÒNG CẤM 500 m quanh giàn khoan */}
        {nhom.camCap && vongGianGeo && (
          <Source id="hd-vong-gian" type="geojson" data={vongGianGeo}>
            <Layer {...L({ id: "hd-vong-gian-fill", type: "fill", minzoom: SEA_RESTRICTED_MINZOOM, paint: { "fill-color": RESTRICTED_FILL_COLOR, "fill-opacity": 0.12 } })} />
            <Layer
              {...L({
                id: "hd-vong-gian-line",
                type: "line",
                minzoom: SEA_RESTRICTED_MINZOOM,
                paint: { "line-color": SEA_RESTRICTED_COLOR, "line-width": 1.2, "line-dasharray": [1.5, 1.5] },
              })}
            />
          </Source>
        )}

        {/* TRẠM CON NƯỚC — vùng từ nấc xa, tại cảng từ nấc vừa (như màn cũ) */}
        {trieuGeo && (
          <Source id="hd-trieu-src" type="geojson" data={trieuGeo}>
            <Layer {...L({ ...TIDE_STATION_LAYER, id: "hd-trieu", filter: TIDE_FILTER_VUNG })} />
            <Layer {...L({ ...TIDE_STATION_LAYER, id: "hd-trieu-cang", filter: TIDE_FILTER_CANG, minzoom: TIDE_STATION_CANG_MINZOOM })} />
            <Layer {...L({ ...TIDE_STATION_LABEL_LAYER, id: "hd-trieu-ten", filter: TIDE_FILTER_VUNG })} />
          </Source>
        )}

        {/* GIÓ / SÓNG TOÀN VÙNG — mũi tên của lưới dự báo (màu = thang màn cũ, `forecast-grid`) */}
        {muiTenGeo && (
          <Source id="hd-gio-song-src" type="geojson" data={muiTenGeo}>
            <Layer
              {...L({
                id: "hd-gio-song",
                type: "line",
                layout: { "line-cap": "round", "line-join": "round" },
                paint: {
                  "line-color": (lopTT === "gio" ? WIND_COLOR_EXPR : WAVE_COLOR_EXPR) as unknown as string,
                  "line-width": ["interpolate", ["linear"], ["zoom"], 4, 1.6, 9, 2.6],
                  "line-opacity": 0.9,
                },
              })}
            />
          </Source>
        )}

        {/* TÀU AIS — icon như màn cũ (components/ban-do/icon-tau) */}
        {aisGeo && (
          <Source id="hd-ais-src" type="geojson" data={aisGeo}>
            <Layer
              {...L({
                id: "hd-ais",
                type: "symbol",
                layout: {
                  "icon-image": ["concat", "ais-", ["get", "mk"], "-", ["case", ["==", ["get", "chay"], 1], "chay", "dung"]],
                  "icon-size": CO_ICON_TAU,
                  "icon-rotate": ["case", ["==", ["get", "chay"], 1], ["get", "huong"], 0],
                  "icon-rotation-alignment": "map",
                  "icon-allow-overlap": true,
                  "icon-ignore-placement": true,
                },
              })}
            />
          </Source>
        )}

        {/* ĐIỂM NGƯỜI DÙNG (kho places — dùng chung màn bản đồ cũ) */}
        <Source id="hd-diem-src" type="geojson" data={diemGeo}>
          <Layer
            {...L({
              id: "hd-diem",
              type: "circle",
              paint: { "circle-radius": 6, "circle-color": DIEM_COLOR, "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 },
            })}
          />
          <Layer
            {...L({
              id: "hd-diem-ten",
              type: "symbol",
              minzoom: 9,
              layout: { "text-field": ["get", "ten"], "text-font": ["Noto Sans Bold"], "text-size": 12, "text-offset": [0, 1], "text-anchor": "top", "text-optional": true },
              paint: { "text-color": DIEM_COLOR, "text-halo-color": "#ffffff", "text-halo-width": 1.4 },
            })}
          />
        </Source>
        {/* VẾT TÀU — đang ghi (đỏ) / đang xem (tím than) */}
        <Source id="hd-vet-src" type="geojson" data={vetGeo}>
          <Layer
            {...L({
              id: "hd-vet",
              type: "line",
              layout: { "line-cap": "round", "line-join": "round" },
              paint: { "line-color": ["case", ["==", ["get", "ghi"], 1], MOB_COLOR, VET_COLOR], "line-width": 2.5, "line-opacity": 0.85 },
            })}
          />
        </Source>
        {/* TUYẾN ĐANG CHẠY — điểm đã qua mờ đi */}
        <Source id="hd-chay-src" type="geojson" data={chayGeo}>
          <Layer {...L({ id: "hd-chay-line", type: "line", filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": TUYEN_COLOR, "line-width": 3 } })} />
          <Layer
            {...L({
              id: "hd-chay-diem",
              type: "circle",
              filter: ["==", ["geometry-type"], "Point"],
              paint: { "circle-radius": 7, "circle-color": TUYEN_COLOR, "circle-opacity": ["case", ["==", ["get", "qua"], 1], 0.35, 1], "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 },
            })}
          />
          <Layer
            {...L({
              id: "hd-chay-so",
              type: "symbol",
              filter: ["==", ["geometry-type"], "Point"],
              layout: { "text-field": ["get", "so"], "text-font": ["Noto Sans Bold"], "text-size": 10, "text-allow-overlap": true },
              paint: { "text-color": "#ffffff" },
            })}
          />
        </Source>
        {/* TUYẾN ĐANG SOẠN */}
        <Source id="hd-soan-src" type="geojson" data={soanGeo}>
          <Layer {...L({ id: "hd-soan-line", type: "line", filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": DO_COLOR, "line-width": 3, "line-dasharray": [2, 1] } })} />
          <Layer
            {...L({
              id: "hd-soan-diem",
              type: "circle",
              filter: ["==", ["geometry-type"], "Point"],
              paint: { "circle-radius": 8, "circle-color": DO_COLOR, "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 },
            })}
          />
          <Layer
            {...L({
              id: "hd-soan-so",
              type: "symbol",
              filter: ["==", ["geometry-type"], "Point"],
              layout: { "text-field": ["get", "so"], "text-font": ["Noto Sans Bold"], "text-size": 10, "text-allow-overlap": true },
              paint: { "text-color": "#ffffff" },
            })}
          />
        </Source>

        {/* VÒNG CỰ LY 1-2-5 hải lý quanh tàu */}
        <Source id="hd-vong" type="geojson" data={vongGeo}>
          <Layer id="hd-vong-line" type="line" paint={{ "line-color": doiMau(VEC_COLOR, bang), "line-width": 1, "line-opacity": 0.55, "line-dasharray": [4, 3] }} />
        </Source>
        {/* VÒNG NEO */}
        <Source id="hd-neo" type="geojson" data={neoGeo}>
          <Layer id="hd-neo-fill" type="fill" paint={{ "fill-color": doiMau(neoTroi ? MOB_COLOR : NEO_COLOR, bang), "fill-opacity": 0.12 }} />
          <Layer id="hd-neo-line" type="line" paint={{ "line-color": doiMau(neoTroi ? MOB_COLOR : NEO_COLOR, bang), "line-width": 2 }} />
        </Source>
        {/* ĐƯỜNG VỀ NGƯỜI RƠI */}
        <Source id="hd-mob" type="geojson" data={mobGeo}>
          <Layer id="hd-mob-line" type="line" paint={{ "line-color": doiMau(MOB_COLOR, bang), "line-width": 3 }} />
        </Source>
        {/* ĐO */}
        <Source id="hd-do" type="geojson" data={doGeo}>
          <Layer id="hd-do-line" type="line" paint={{ "line-color": doiMau(DO_COLOR, bang), "line-width": 2.5, "line-dasharray": [3, 2] }} />
        </Source>
        {/* VẠCH HƯỚNG ĐI — vị trí sau N phút nếu giữ hướng + tốc độ */}
        <Source id="hd-vec" type="geojson" data={vecGeo}>
          <Layer
            id="hd-vec-line"
            type="line"
            layout={{ "line-cap": "round" }}
            paint={{ "line-color": doiMau(VEC_COLOR, bang), "line-width": 2.5, "line-dasharray": [2, 1.2] }}
          />
        </Source>

        {/* nhãn chủ quyền — luôn trên mọi lớp (luật 03 §6) */}
        {SOVEREIGNTY_LABELS.map((s) => (
          <Marker key={s.name} longitude={s.lng} latitude={s.lat} anchor="center" rotationAlignment="viewport">
            <div className="pointer-events-none select-none text-center leading-tight text-navy [text-shadow:0_0_3px_var(--card),0_0_6px_var(--card)]">
              <div className={s.kind === "sea" ? "text-[0.875rem] font-semibold tracking-[0.18em]" : "text-[0.8125rem] font-semibold tracking-[0.06em]"}>
                {s.name}
              </div>
              {s.sub && <div className="text-[0.75rem] font-semibold italic">{s.sub}</div>}
            </div>
          </Marker>
        ))}

        {neo && (
          <Marker longitude={neo.lon} latitude={neo.lat} anchor="center">
            <span role="img" aria-label="Chỗ thả neo" className="pointer-events-none flex h-7 w-7 items-center justify-center rounded-full bg-sea text-card drop-shadow-pin">
              <AnchorIcon className="h-4 w-4" aria-hidden />
            </span>
          </Marker>
        )}
        {mob && (
          <Marker longitude={mob.lon} latitude={mob.lat} anchor="center">
            <span role="img" aria-label="Chỗ người rơi" className="pointer-events-none flex h-9 w-9 items-center justify-center rounded-full bg-danger text-card drop-shadow-pin">
              <LifebuoyIcon className="h-5 w-5" aria-hidden />
            </span>
          </Marker>
        )}

        {/* TÀU MÌNH — mũi tên xoay theo hướng đi (theo bản đồ); đứng yên thì chấm tròn (không bịa hướng) */}
        {tau.pos && (
          <Marker longitude={tau.pos.lon} latitude={tau.pos.lat} anchor="center" rotationAlignment="map">
            <div role="img" aria-label="Vị trí tàu" className="pointer-events-none">
              {tau.headingDeg != null && tau.speedKmh != null ? (
                <span className="block" style={{ transform: `rotate(${tau.headingDeg}deg)` }}>
                  <NavArrowIcon className="h-8 w-8 fill-sea text-card drop-shadow-pin" aria-hidden />
                </span>
              ) : (
                <span className="block h-4 w-4 rounded-full border-2 border-card bg-sea drop-shadow-pin" />
              )}
            </div>
          </Marker>
        )}
      </MapGL>

      {/* TÂM ĐO */}
      {doMo && (
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-trim">
          <CrosshairIcon className="h-9 w-9" />
        </div>
      )}

      {/* TRÊN CÙNG: bảng MOB (nếu có) hoặc DẢI SỐ LIỆU */}
      <div className="pointer-events-none absolute inset-x-2 top-[calc(env(safe-area-inset-top)+0.5rem)] z-10 flex flex-col gap-1.5">
        {mob ? (
          <BangMob so={soMob} unit={unit} onDaVot={() => setMob(null)} />
        ) : (
          <button
            type="button"
            aria-expanded={moRong}
            aria-label="Số liệu tàu — chạm để mở thêm"
            onClick={() => setMoRong((v) => !v)}
            className="glass pointer-events-auto flex flex-col rounded-[1.25rem] px-4 py-2 text-left text-navy"
          >
            <span className="flex w-full items-center gap-3">
              <span className="flex items-baseline gap-1">
                <span className="text-[1.375rem] font-semibold tabular-nums">{toc.value}</span>
                <span className="text-[0.75rem] font-semibold text-muted">{toc.unit}</span>
              </span>
              <span className="text-[1.375rem] font-semibold tabular-nums">{huong}</span>
              <span className="ml-auto min-w-0 truncate text-right text-[0.75rem] font-semibold tabular-nums">
                {gpsChu ? (
                  <span className={tau.status === "denied" || tau.status === "lost" ? "text-warn" : "text-muted"}>{gpsChu}</span>
                ) : (
                  tau.pos && fmtCoordPair(tau.pos.lat, tau.pos.lon, mapPrefs.coordFormat)
                )}
              </span>
            </span>
            {moRong && (
              <span className="mt-1 flex w-full flex-wrap gap-x-4 gap-y-0.5 border-t border-line pt-1 text-[0.8125rem] font-semibold tabular-nums">
                <span>
                  <span className="text-muted">Độ sâu </span>
                  {doSauTau != null ? DO_SAU_NGAN[doSauTau] : "—"}
                </span>
                <span>
                  <span className="text-muted">Sai số </span>
                  {tau.accuracyM != null ? `±${Math.round(tau.accuracyM)} m` : "—"}
                </span>
                <span>
                  <span className="text-muted">Giờ </span>
                  {gio ?? "—"}
                </span>
                {neo && neoCachM != null && (
                  <span className={neoCachM > neo.banKinhM ? "text-danger" : ""}>
                    <span className="text-muted">Neo </span>
                    {`${Math.round(neoCachM)}/${neo.banKinhM} m`}
                  </span>
                )}
              </span>
            )}
          </button>
        )}
        {tuyenChay && gs && (
          <div role="status" className="glass pointer-events-auto flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-[1.25rem] px-4 py-2 text-navy tabular-nums">
            {gs.het ? (
              <span className="text-[0.9375rem] font-semibold">{`${tuyenChay.ten}: đã tới điểm cuối`}</span>
            ) : (
              <>
                <span className="text-[0.75rem] font-semibold text-muted">{`Tới điểm ${gs.toi + 1}/${tuyenChay.diem.length}`}</span>
                <span className="text-[1.125rem] font-semibold">{fmtPv(gs.btwDeg)}</span>
                <span className="text-[1.125rem] font-semibold">{gs.dtwKm != null ? fmtDist(gs.dtwKm, unit, gs.dtwKm < 10 ? 1 : 0) : "—"}</span>
                <span className="text-[0.8125rem] font-semibold">{gs.ttgPhut != null ? `${Math.round(gs.ttgPhut)} phút` : "—"}</span>
                <span className={`text-[0.8125rem] font-semibold ${gs.xtdKm != null && gs.xtdKm > 0.926 ? "text-warn" : ""}`}>
                  {gs.xtdKm != null ? `lệch ${fmtDist(gs.xtdKm, unit, 2)}` : ""}
                </span>
                {gs.denCuoiPhut != null && <span className="text-[0.75rem] text-muted">{`hết tuyến ~${Math.round(gs.denCuoiPhut)} phút`}</span>}
              </>
            )}
          </div>
        )}
        <p className="pl-4 text-[0.75rem] font-semibold text-muted [text-shadow:0_0_3px_var(--card)]">
          {`An toàn ${anToanM} m · ${NHAN_HUONG[prefs.huong]}`}
          {vetGhiId ? " · Đang ghi vết" : ""}
          {neo && !moRong ? ` · Neo ${neoCachM != null ? Math.round(neoCachM) : "—"}/${neo.banKinhM} m` : ""}
          {!online ? " · Mất sóng — dữ liệu trong máy" : ""}
        </p>
        {ketQuaDo && (
          <div className="glass pointer-events-auto flex items-center gap-3 self-start rounded-full py-1.5 pl-4 pr-1.5 text-navy">
            <span className="text-[1.125rem] font-semibold tabular-nums">{fmtPv(ketQuaDo.pvDeg)}</span>
            <span className="text-[1.125rem] font-semibold tabular-nums">
              {fmtDist(ketQuaDo.cuLyKm, unit, ketQuaDo.cuLyKm < 10 ? 2 : 1)}
            </span>
            <button type="button" onClick={() => tam && setGocDo(tam)} className="sq-btn bg-field text-foreground">
              {NHAN.datGoc}
            </button>
          </div>
        )}
      </div>

      {/* CỘT NÚT PHẢI — "thông minh" (lib/hai-do/cot-nut): lúc yên 3 nút, có việc mới nổi thêm */}
      <div
        className={`pointer-events-none absolute right-2 z-10 flex flex-col gap-2 ${
          mob ? "top-[calc(env(safe-area-inset-top)+10.5rem)]" : "top-[calc(env(safe-area-inset-top)+6rem)]"
        }`}
      >
        {cotNut.map((n) => {
          if (n === "zoom")
            return (
              <div key={n} className="flex flex-col gap-2">
                <NutCot label="Phóng to" onClick={() => mapRef.current?.zoomIn()}>
                  <PlusIcon className="h-5 w-5" aria-hidden />
                </NutCot>
                <NutCot label="Thu nhỏ" onClick={() => mapRef.current?.zoomOut()}>
                  <MinusIcon className="h-5 w-5" aria-hidden />
                </NutCot>
              </div>
            );
          if (n === "huong")
            return (
              <NutCot
                key={n}
                label={`Hướng bản đồ: ${NHAN_HUONG[prefs.huong]} — chạm để đổi`}
                active={prefs.huong !== "bac"}
                onClick={() => setHaiDoPrefs({ huong: huongKeTiep(prefs.huong, tuyenChay != null) })}
              >
                {/* mũi chỉ BẮC thật — xoay ngược theo góc bản đồ */}
                <span className="block" style={{ transform: `rotate(${-goc}deg)` }}>
                  <NavArrowIcon className="h-5 w-5" aria-hidden />
                </span>
              </NutCot>
            );
          if (n === "chuong") return <Chuong key={n} ds={baoDong} />;
          if (n === "neo")
            return (
              <NutCot key={n} label="Canh neo" active canh={neoTroi} onClick={() => {
                  const mo = !neoMo;
                  dongNoi();
                  setNeoMo(mo);
                }} nutRef={setNutNeo}>
                <AnchorIcon className="h-5 w-5" aria-hidden />
              </NutCot>
            );
          if (n === "do")
            return (
              <NutCot key={n} label="Tắt đo" active onClick={() => setDoMo(false)}>
                <RulerIcon className="h-5 w-5" aria-hidden />
              </NutCot>
            );
          if (n === "viTri")
            return (
              <NutCot
                key={n}
                label="Về chỗ tàu"
                active={bam && !!tau.pos}
                onClick={() => {
                  setBam(true);
                  if (tau.pos) mapRef.current?.flyTo({ center: [tau.pos.lon, tau.pos.lat], zoom: Math.max(mapRef.current.getZoom(), 11) });
                }}
              >
                <CrosshairIcon className="h-5 w-5" aria-hidden />
              </NutCot>
            );
          return (
            <NutCot key={n} label={khayMo ? "Đóng khay" : "Thêm: màu, đo, neo, cài đặt…"} active={khayMo} onClick={() => {
                const mo = !khayMo;
                dongNoi();
                setKhayMo(mo);
              }} nutRef={setNutThem}>
              <MenuIcon className="h-5 w-5" aria-hidden />
            </NutCot>
          );
        })}
      </div>

      {khayMo && (
        <Popover anchor={nutThem} role="menu" label="Thêm" onClose={dongBoiNgoai(() => setKhayMo(false))} className="w-[14.5rem] p-2">
          <div className="grid grid-cols-3 gap-1.5">
            {khay.map((m) => {
              const o = KHAY[m];
              const Icon = m === "mau" ? (bang === "dem" ? MoonIcon : CloudSunIcon) : o.icon;
              return (
                <button
                  key={m}
                  type="button"
                  role="menuitem"
                  aria-label={m === "mau" ? `Bảng màu: ${NHAN_BANG[bang]} — chạm để đổi` : o.aria}
                  onClick={() => chonKhay(m)}
                  className="flex min-h-(--h-ctl) flex-col items-center justify-center gap-0.5 rounded-xl bg-field px-1 py-1.5 text-[0.75rem] font-semibold text-foreground transition active:scale-95"
                >
                  <Icon className="h-5 w-5" aria-hidden />
                  {m === "mau" ? NHAN_BANG[bang] : o.nhan}
                </button>
              );
            })}
          </div>
        </Popover>
      )}

      {/* MOB — góc trái dưới, trên thước tỉ lệ */}
      {!mob && (
        <div className="absolute bottom-[7.5rem] left-2 z-10">
          <NutMob
            coGps={coGps}
            onKich={() => {
              if (!tau.pos) return;
              setMob({ lat: tau.pos.lat, lon: tau.pos.lon, luc: Date.now() });
              setBam(true);
            }}
          />
        </div>
      )}

      {cham && !doMo && !bang_ && <TamCham dong={cham} onDong={() => setCham(null)} />}

      {bang_ === "tau" && (
        <BangAis
          ds={dsAis}
          coGps={coGps}
          tamNm={tamDs}
          loc={locDs}
          sap={sapDs}
          tuoiBanPhut={tuoiBanAis}
          onTam={setTamDs}
          onLoc={setLocDs}
          onSap={setSapDs}
          onChon={(m: MucTieu) => {
            setBang(null);
            mapRef.current?.getMap().flyTo({ center: [m.pos.lon, m.pos.lat], zoom: Math.max(mapRef.current.getMap().getZoom(), 11), duration: 800 });
            setCham([{ tieu: m.tau.ten ?? "Tàu AIS", phu: moTaTau(m.tau) }]);
          }}
          onDong={() => setBang(null)}
        />
      )}

      {lopTT !== "tat" && !bang_ && (
        <ThanhGio
          kind={lopTT === "gio" ? "wind" : "wave"}
          grid={luoi}
          trangThai={luoiTT}
          idx={Math.min(khungIdx, Math.max(0, (luoi?.times.length ?? 1) - 1))}
          todayIso={isoDateVN(nowMs)}
          nowMs={nowMs}
          chiHomNay={soNgay < 2}
          onIdx={setKhungIdx}
          onTat={() => setHaiDoPrefs({ lopThoiTiet: "tat" })}
        />
      )}

      {bang_ === "tuyen" && (
        <BangTuyen
          ds={dsTuyen}
          soan={soan}
          tocDoKn={tocDoKn}
          unit={unit}
          kiem={kiem}
          dangChayId={chay?.id ?? null}
          onThem={() => {
            setSoan({ id: null, ten: tenMacDinh(nowMs), diem: [] });
            setKiem(null);
            setCham(null);
          }}
          onSua={(t) => {
            setSoan({ id: t.id, ten: t.ten, diem: [...t.diem] });
            setKiem(null);
          }}
          onXoa={(t) => {
            setTuyen(dsTuyen.filter((x) => x.id !== t.id));
            if (chay?.id === t.id) setChay(null);
          }}
          onChay={(t) => {
            setChay({ id: t.id, toi: 1 });
            setBang(null);
            setBam(true);
          }}
          onDung={() => setChay(null)}
          onBoDiem={() => soan && setSoan({ ...soan, diem: soan.diem.slice(0, -1) })}
          onDao={() => soan && setSoan({ ...soan, diem: daoTuyen(soan.diem) })}
          onKiem={() => soan && kiemTuyen(soan.diem)}
          onLuu={() => {
            if (!soan || soan.diem.length < 2) return;
            const t: Tuyen = { id: soan.id ?? `t${nowMs}`, ten: soan.ten, diem: soan.diem, luc: Date.now() };
            setTuyen([t, ...dsTuyen.filter((x) => x.id !== t.id)]);
            setSoan(null);
            setKiem(null);
          }}
          onHuy={() => {
            setSoan(null);
            setKiem(null);
          }}
          onNhap={() => fileRef.current?.click()}
          onXuat={() => void xuatGpx(vietGpx({ tuyen: dsTuyen, diem: places.map((p) => ({ ten: p.name, lat: p.lat, lon: p.lon })) }), "Tuyến SDFish")}
          onDong={() => setBang(null)}
        />
      )}
      {bang_ === "vet" && (
        <BangVet
          ds={vets}
          dangGhiId={vetGhiId}
          dangXemId={vetXemId}
          unit={unit}
          onGhi={() => {
            const v: Vet = { id: `v${Date.now()}`, batDau: Date.now(), diem: [] };
            vetDangGhi.current = v;
            setVetGhi(v.id);
            luuVet(v)
              .then(() => setVets((ds) => [v, ...ds]))
              .catch(() => setBaoLoi("Không ghi được vết vào máy"));
          }}
          onDungGhi={() => {
            vetDangGhi.current = null;
            setVetGhi(null);
          }}
          onXem={(v) => setVetXemId((cu) => (cu === v.id ? null : v.id))}
          onTaoTuyen={(v) => {
            setSoan({ id: null, ten: tenMacDinh(v.batDau).replace("Tuyến", "Tuyến từ vết"), diem: tuyenTuVet(v) });
            setKiem(null);
            setBang("tuyen");
          }}
          onXuat={(v) => void xuatGpx(vietGpx({ vet: [v] }), `Vết ${new Date(v.batDau).toISOString().slice(0, 10)}`)}
          onXoa={(v) => {
            xoaVet(v.id)
              .then(() => setVets((ds) => ds.filter((x) => x.id !== v.id)))
              .catch(() => setBaoLoi("Không xoá được vết"));
            if (vetXemId === v.id) setVetXemId(null);
          }}
          onDong={() => setBang(null)}
        />
      )}

      {/* THÊM ĐIỂM — giữ ngón trên hải đồ */}
      {diemMoi && (
        <div className="pointer-events-auto absolute inset-x-2 bottom-3 z-30 rounded-2xl border border-line bg-card p-3 shadow-float">
          <label htmlFor="hd-ten-diem" className="text-[0.875rem] font-semibold text-navy">
            Lưu điểm này
          </label>
          <p className="text-[0.75rem] text-muted tabular-nums">{fmtCoordPair(diemMoi.lat, diemMoi.lon, mapPrefs.coordFormat)}</p>
          <input
            id="hd-ten-diem"
            value={tenDiem}
            onChange={(e) => setTenDiem(e.target.value)}
            maxLength={60}
            className="mt-2 h-(--h-ctl) w-full rounded-xl border border-line bg-field px-3 text-[1rem] text-foreground"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="sq-btn bg-sea text-card"
              onClick={() => {
                const moi = upsertPlace(places, { name: tenDiem, lat: diemMoi.lat, lon: diemMoi.lon });
                if (persistPlaces(moi)) setPlaces(moi);
                else setBaoLoi("Không lưu được điểm vào máy");
                setDiemMoi(null);
              }}
            >
              {NHAN.luu}
            </button>
            <button type="button" className="sq-btn bg-field text-foreground" onClick={() => setDiemMoi(null)}>
              {NHAN.huy}
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".gpx,application/gpx+xml,application/xml,text/xml"
        className="hidden"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void nhapGpx(f);
          e.target.value = "";
        }}
      />
      {baoLoi && (
        <div role="status" className="pointer-events-auto absolute inset-x-2 top-[45%] z-40 flex items-center gap-2 rounded-xl bg-navy px-3 py-2 text-[0.875rem] text-card">
          <span className="flex-1">{baoLoi}</span>
          <button type="button" className="sq-btn bg-card/20 text-card" onClick={() => setBaoLoi(null)}>
            {NHAN.dong}
          </button>
        </div>
      )}

      {neoMo && (
        <Popover anchor={neo ? nutNeo : nutThem} label="Canh neo" onClose={dongBoiNgoai(() => setNeoMo(false))} className="w-[17rem] p-3">
          <BangNeo
            dangNeo={neo != null}
            banKinhM={neo?.banKinhM ?? banKinhNeo}
            cachM={neoCachM}
            coGps={coGps}
            onBanKinh={(m) => {
              setBanKinhNeo(m);
              if (neo) setNeo({ ...neo, banKinhM: m });
            }}
            onTha={() => {
              if (!tau.pos) return;
              setNeo({ lat: tau.pos.lat, lon: tau.pos.lon, banKinhM: banKinhNeo, luc: Date.now() });
              setNeoMo(false);
            }}
            onNho={() => {
              setNeo(null);
              setNeoMo(false);
            }}
          />
        </Popover>
      )}

      {lopMo && (
        <Popover anchor={nutThem} label="Lớp hải đồ" onClose={dongBoiNgoai(() => setLopMo(false))} className="w-[17rem] p-3">
          <KhayLop prefs={prefs} coAis={coAis} />
        </Popover>
      )}

      {!prefs.daDongY && <DongY />}

      {caiDatMo && (
        <Popover anchor={nutThem} label="Cài đặt hải đồ" onClose={dongBoiNgoai(() => setCaiDatMo(false))} className="w-[17rem] p-3">
          <h3 className="text-[0.875rem] font-semibold text-navy">Đường an toàn</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <Chip on={prefs.anToanM == null} onClick={() => setHaiDoPrefs({ anToanM: null })}>
              {NHAN.theoMon}
            </Chip>
            {MUC_AN_TOAN_M.map((m) => (
              <Chip key={m} on={prefs.anToanM === m} onClick={() => setHaiDoPrefs({ anToanM: m })}>
                {`${m} m`}
              </Chip>
            ))}
          </div>
          <p className="mt-1 text-[0.75rem] text-muted">
            {draftM != null ? `Mớn ${String(draftM).replace(".", ",")} m` : "Chưa khai mớn tàu"}
          </p>
          <h3 className="mt-3 text-[0.875rem] font-semibold text-navy">Vạch hướng</h3>
          <div className="mt-2 flex gap-2">
            {VEC_PHUT.map((p) => (
              <Chip key={p} on={prefs.vecPhut === p} onClick={() => setHaiDoPrefs({ vecPhut: p })}>
                {`${p} phút`}
              </Chip>
            ))}
          </div>
          <h3 className="mt-3 text-[0.875rem] font-semibold text-navy">Vòng cự ly</h3>
          <div className="mt-2 flex gap-2">
            <Chip on={!prefs.vong} onClick={() => setHaiDoPrefs({ vong: false })}>
              {NHAN.an}
            </Chip>
            <Chip on={prefs.vong} onClick={() => setHaiDoPrefs({ vong: true })}>
              {"1-2-5 hl"}
            </Chip>
          </div>
          <h3 className="mt-3 text-[0.875rem] font-semibold text-navy">Nút phóng to</h3>
          <div className="mt-2 flex gap-2">
            <Chip on={!prefs.nutZoom} onClick={() => setHaiDoPrefs({ nutZoom: false })}>
              {NHAN.an}
            </Chip>
            <Chip on={prefs.nutZoom} onClick={() => setHaiDoPrefs({ nutZoom: true })}>
              {"+ / −"}
            </Chip>
          </div>
        </Popover>
      )}
    </div>
  );
}
