"use client";

/*
  CHẾ ĐỘ HẢI ĐỒ (`/hai-do`) — đợt 1, 2026-11-04. Anh Long chốt: "chế độ hải đồ
  thuần này là 1 lớp mới, ko dính tới cái cũ, bà con quen nhìn giao diện này thì
  đổi qua thôi … rồi cho cái mới trên cái đó". Rà + hướng: docs/research/
  hai-do-thuan-sdvico-2026-11.md · spec màn: 07 §10.8.

  Một màn RIÊNG, không import fishing-map-view. Dùng lại lib dữ liệu + style.
  Mặt màn chỉ có: hải đồ · tàu mình + vạch hướng đi · dải số liệu trên cùng ·
  cột nút phải (phóng to/nhỏ, Màu, Cài đặt, về tàu, về Bản đồ) · thước tỉ lệ.
  Dự báo cá, mật độ tàu, chợ… KHÔNG ở đây (lớp sẽ thêm ở đợt sau, tắt mặc định).

  Offline: không gọi mạng nào ngoài các file /data đã nằm trong SHELL (sw.js) —
  báo hiệu, đèn, xác tàu, đảo, đẳng sâu, hình bờ. GPS chỉ ở trong máy.
*/

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import MapGL, { AttributionControl, Layer, Marker, ScaleControl, Source, type LayerProps, type MapRef } from "react-map-gl/maplibre";
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
} from "@/lib/ocean-map";
import { KHONG_PHAI_CUM, LA_CUM, SEAMARK_ICON_LAYOUT } from "@/components/ban-do/hai-do";
import { fetchSeamarks, type Seamark } from "@/lib/seamarks";
import { fetchDenBien, type DenBien } from "@/lib/den-bien";
import { fetchVnAids, type VnAid } from "@/lib/vn-aids";
import { fetchXacTau, type XacTau } from "@/lib/xac-tau";
import { useNavTracking } from "@/lib/use-nav-tracking";
import { useOnline } from "@/lib/use-online";
import { readUserRecord } from "@/lib/user-list-store";
import type { BoatProfile } from "@/lib/route-plan";
import { fmtCoordPair, speedReadout, useMapPrefs } from "@/lib/map-prefs";
import { NHAN } from "@/lib/labels";
import { apBangMauLop, doiMau } from "@/lib/hai-do/bang-mau";
import { dauVecTo, duongAnToanM, MUC_AN_TOAN_M, VEC_PHUT, vecToGeo } from "@/lib/hai-do/an-toan";
import { buildHaiDoStyle } from "@/lib/hai-do/style";
import { bangKeTiep, setHaiDoPrefs, useHaiDoPrefs } from "@/lib/hai-do/prefs";
import { baoHieuTheoTang, denBienGeo, vnAidGeo, xacTauGeo } from "@/components/hai-do/lop-du-lieu";
import { Popover } from "@/components/ui/popover";
import {
  CloudSunIcon,
  CrosshairIcon,
  GearIcon,
  MinusIcon,
  MoonIcon,
  NavArrowIcon,
  PlusIcon,
  RadarIcon,
} from "@/components/icons";

registerPmtilesProtocol();
registerDataProtocol();

/** Màu vạch hướng đi (nội dung bản đồ) — mực đậm, đổi theo bảng màu như mọi lớp. */
const VEC_COLOR = "#15333e";
const NHAN_BANG = { ngay: "Ngày", chieu: "Chiều", dem: "Đêm" } as const;

/** Nút tròn trên cột phải — chỉ icon (luật thẻ nổi 03 §6 mục 8), tên ở aria-label. */
function NutCot({
  label,
  onClick,
  children,
  active = false,
  nutRef,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  nutRef?: (el: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      ref={nutRef}
      type="button"
      aria-label={label}
      aria-pressed={active || undefined}
      onClick={onClick}
      className={`pointer-events-auto flex h-(--h-ctl) w-(--h-ctl) items-center justify-center rounded-full transition active:scale-95 ${
        active ? "bg-sea text-card" : "glass text-navy"
      }`}
    >
      {children}
    </button>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`h-(--h-chip) min-w-[3.5rem] rounded-full px-3 text-[0.875rem] font-semibold tabular-nums transition active:scale-95 ${
        on ? "bg-sea text-card" : "bg-field text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function useDuLieu<T>(fetcher: () => Promise<T[]>, online: boolean): T[] | null {
  const [v, setV] = useState<T[] | null>(null);
  useEffect(() => {
    if (v) return;
    let alive = true;
    fetcher()
      .then((x) => {
        if (alive && x.length) setV(x);
      })
      .catch(() => {
        // im có chủ ý: file nằm trong SHELL; hỏng thì lần sóng về (online đổi) tự thử lại.
        // Thiếu một lớp báo hiệu thì hải đồ vẫn dùng được — không làm sập cả màn.
      });
    return () => {
      alive = false;
    };
  }, [v, online, fetcher]);
  return v;
}

export default function HaiDoView() {
  const router = useRouter();
  const prefs = useHaiDoPrefs();
  const mapPrefs = useMapPrefs();
  const online = useOnline();
  const mapRef = useRef<MapRef>(null);
  const thuONguon = () =>
    mapRef.current?.getContainer().querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");

  // mớn tàu — đọc một lần (đổi hồ sơ tàu thì mở lại màn)
  const [draftM] = useState<number | null>(() => {
    const b = readUserRecord<Partial<BoatProfile>>("forfish.boat.v1").value;
    return typeof b?.draftM === "number" && b.draftM > 0 && b.draftM <= 10 ? b.draftM : null;
  });
  const anToanM = duongAnToanM(draftM, prefs.anToanM);
  const bang = prefs.bang;
  /*  Bảng màu phủ CẢ TRANG khi đang ở màn này (dock + lớp nổi portal ra <body> nằm ngoài
      `.hai-do`): dock sáng trắng giữa đêm là đúng thứ làm loá mắt. Rời màn thì gỡ. */
  useEffect(() => {
    if (bang === "ngay") return;
    const lop = `hai-do-${bang}`;
    document.documentElement.classList.add(lop);
    return () => document.documentElement.classList.remove(lop);
  }, [bang]);

  const mapStyle = useMemo(
    () => buildHaiDoStyle({ bang, anToanM, matSong: !online }),
    [bang, anToanM, online],
  );

  // GPS — không giữ sáng màn (bà con khoá máy thì thôi, như màn bản đồ cũ khi chưa dẫn đường)
  const tau = useNavTracking(true, { keepAwake: false });
  const [bam, setBam] = useState(true); // bản đồ đang bám theo tàu
  const daBay = useRef(false);
  useEffect(() => {
    if (!tau.pos || !bam) return;
    const map = mapRef.current;
    if (!map) return;
    if (!daBay.current) {
      daBay.current = true;
      map.flyTo({ center: [tau.pos.lon, tau.pos.lat], zoom: Math.max(map.getZoom(), 11), duration: 800 });
    } else {
      map.easeTo({ center: [tau.pos.lon, tau.pos.lat], duration: 400 });
    }
  }, [tau.pos, bam]);

  const dau = dauVecTo(tau.pos, tau.headingDeg, tau.speedKmh, prefs.vecPhut);
  const vecGeo = useMemo(() => vecToGeo(tau.pos, dau), [tau.pos, dau]);

  // dữ liệu báo hiệu — toàn file trong máy
  const seamarks = useDuLieu<Seamark>(fetchSeamarks, online);
  const den = useDuLieu<DenBien>(fetchDenBien, online);
  const aids = useDuLieu<VnAid>(fetchVnAids, online);
  const xac = useDuLieu<XacTau>(fetchXacTau, online);
  const tang = useMemo(() => (seamarks ? baoHieuTheoTang(seamarks, den) : null), [seamarks, den]);
  const denGeo = useMemo(() => (den ? denBienGeo(den) : null), [den]);
  const aidGeo = useMemo(() => (aids ? vnAidGeo(aids) : null), [aids]);
  const xacGeo = useMemo(() => (xac ? xacTauGeo(xac) : null), [xac]);

  // lớp vẽ bằng JSX cũng phải theo bảng màu (style nền đã đổi trong buildHaiDoStyle)
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

  const [caiDatMo, setCaiDatMo] = useState(false);
  const [nutCaiDat, setNutCaiDat] = useState<HTMLButtonElement | null>(null);

  const toc = speedReadout(tau.speedKmh, mapPrefs.distUnit);
  const huong = tau.headingDeg != null && tau.speedKmh != null ? `${Math.round(tau.headingDeg).toString().padStart(3, "0")}°` : "—";
  const gpsChu =
    tau.status === "denied" ? "Máy chưa cho GPS" : tau.status === "lost" ? "Mất GPS — đang tìm" : tau.pos ? null : "Đang bắt GPS…";

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
        // ô nguồn bản đồ: MapLibre bung sẵn che đáy màn — thu về nút ⓘ (cùng cách màn bản đồ cũ `thuONguon`)
        onLoad={thuONguon}
        onStyleData={thuONguon}
        style={{ width: "100%", height: "100%" }}
      >
        <AttributionControl compact position="bottom-left" />
        <ScaleControl position="bottom-left" unit={mapPrefs.distUnit === "km" ? "metric" : "nautical"} maxWidth={96} />

        {xacGeo && (
          <Source id="hd-xac-tau" type="geojson" data={xacGeo}>
            <Layer {...L(WRECK_LAYER)} />
          </Source>
        )}
        {tang && (
          <Source id="hd-seamarks-far" type="geojson" data={tang.far}>
            <Layer {...iconLop("hd-seamark-far", SEAMARK_TIER_MINZOOM.far)} />
          </Source>
        )}
        {tang && (
          <Source
            id="hd-seamarks-mid"
            type="geojson"
            data={tang.mid}
            cluster
            clusterRadius={SEAMARK_CLUSTER_RADIUS}
            clusterMaxZoom={SEAMARK_CLUSTER_MAXZOOM.mid}
          >
            <Layer {...iconLop("hd-seamark-mid", SEAMARK_TIER_MINZOOM.mid, true)} />
            {cumLop("hd-seamark-mid", SEAMARK_TIER_MINZOOM.mid).map((s) => (
              <Layer key={s.id} {...s} />
            ))}
          </Source>
        )}
        {tang && (
          <Source
            id="hd-seamarks-near"
            type="geojson"
            data={tang.near}
            cluster
            clusterRadius={SEAMARK_CLUSTER_RADIUS}
            clusterMaxZoom={SEAMARK_CLUSTER_MAXZOOM.near}
          >
            <Layer {...iconLop("hd-seamark-near", SEAMARK_TIER_MINZOOM.near, true)} />
            {cumLop("hd-seamark-near", SEAMARK_TIER_MINZOOM.near).map((s) => (
              <Layer key={s.id} {...s} />
            ))}
          </Source>
        )}
        {aidGeo && (
          <Source
            id="hd-vn-aids"
            type="geojson"
            data={aidGeo}
            cluster
            clusterRadius={SEAMARK_CLUSTER_RADIUS}
            clusterMaxZoom={SEAMARK_CLUSTER_MAXZOOM.mid}
          >
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
          <Marker key={s.name} longitude={s.lng} latitude={s.lat} anchor="center">
            <div className="pointer-events-none select-none text-center leading-tight text-navy [text-shadow:0_0_3px_var(--card),0_0_6px_var(--card)]">
              <div className={s.kind === "sea" ? "text-[0.875rem] font-semibold tracking-[0.18em]" : "text-[0.8125rem] font-semibold tracking-[0.06em]"}>
                {s.name}
              </div>
              {s.sub && <div className="text-[0.75rem] font-semibold italic">{s.sub}</div>}
            </div>
          </Marker>
        ))}

        {/* TÀU MÌNH — mũi tên xoay theo hướng đi; đứng yên thì chấm tròn (không bịa hướng) */}
        {tau.pos && (
          <Marker longitude={tau.pos.lon} latitude={tau.pos.lat} anchor="center">
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

      {/* DẢI SỐ LIỆU — một dòng trên cùng */}
      <div className="pointer-events-none absolute inset-x-2 top-[calc(env(safe-area-inset-top)+0.5rem)] z-10">
        <div role="status" className="glass flex items-center gap-3 rounded-full px-4 py-2 text-navy">
          <div className="flex items-baseline gap-1">
            <span className="text-[1.375rem] font-semibold tabular-nums">{toc.value}</span>
            <span className="text-[0.75rem] font-semibold text-muted">{toc.unit}</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-[1.375rem] font-semibold tabular-nums">{huong}</span>
          </div>
          <div className="ml-auto min-w-0 truncate text-right text-[0.75rem] font-semibold tabular-nums">
            {gpsChu ? (
              <span className={tau.status === "denied" || tau.status === "lost" ? "text-warn" : "text-muted"}>{gpsChu}</span>
            ) : (
              tau.pos && fmtCoordPair(tau.pos.lat, tau.pos.lon, mapPrefs.coordFormat)
            )}
          </div>
        </div>
        <p className="mt-1 pl-4 text-[0.75rem] font-semibold text-muted [text-shadow:0_0_3px_var(--card)]">
          An toàn {anToanM} m{!online ? " · Mất sóng — dữ liệu trong máy" : ""}
        </p>
      </div>

      {/* CỘT NÚT PHẢI */}
      <div className="pointer-events-none absolute right-2 top-[calc(env(safe-area-inset-top)+5.5rem)] z-10 flex flex-col gap-2">
        <NutCot label="Phóng to" onClick={() => mapRef.current?.zoomIn()}>
          <PlusIcon className="h-5 w-5" aria-hidden />
        </NutCot>
        <NutCot label="Thu nhỏ" onClick={() => mapRef.current?.zoomOut()}>
          <MinusIcon className="h-5 w-5" aria-hidden />
        </NutCot>
        <NutCot
          label={`Bảng màu: ${NHAN_BANG[bang]} — chạm để đổi`}
          onClick={() => setHaiDoPrefs({ bang: bangKeTiep(bang) })}
        >
          {bang === "dem" ? <MoonIcon className="h-5 w-5" aria-hidden /> : <CloudSunIcon className="h-5 w-5" aria-hidden />}
        </NutCot>
        <NutCot label="Cài đặt hải đồ" active={caiDatMo} onClick={() => setCaiDatMo((v) => !v)} nutRef={setNutCaiDat}>
          <GearIcon className="h-5 w-5" aria-hidden />
        </NutCot>
        <NutCot
          label="Về chỗ tàu"
          active={bam && !!tau.pos}
          onClick={() => {
            setBam(true);
            if (tau.pos) mapRef.current?.flyTo({ center: [tau.pos.lon, tau.pos.lat], zoom: Math.max(mapRef.current.getZoom(), 11) });
          }}
        >
          <CrosshairIcon className="h-5 w-5" aria-hidden />
        </NutCot>
        <NutCot
          label="Về bản đồ thường"
          onClick={() => {
            setHaiDoPrefs({ moHaiDo: false });
            router.push("/ngu-truong");
          }}
        >
          <RadarIcon className="h-5 w-5" aria-hidden />
        </NutCot>
      </div>

      {caiDatMo && (
        <Popover anchor={nutCaiDat} label="Cài đặt hải đồ" onClose={() => setCaiDatMo(false)} className="w-[17rem] p-3">
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
        </Popover>
      )}
    </div>
  );
}
