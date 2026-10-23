"use client";

/*  Tách nguyên văn khỏi src/components/route-planner.tsx (2026-10-19, rà Codex đợt 3: tách file lớn
    theo trách nhiệm, KHÔNG đổi hành vi). */

import { AnchorIcon, PinIcon } from "@/components/icons";
import { fmtDist, type DistUnit } from "@/lib/map-prefs";
import { ROUTE_CASING_COLOR, ROUTE_LEG_AMBER, ROUTE_LEG_PASSED, ROUTE_LEG_RED, ROUTE_LINE_COLOR } from "@/lib/ocean-map";
import { cumulativeKmAt } from "@/lib/route-legs";
import { haversineKm, type LatLon } from "@/lib/route-plan";
import { routePointRows } from "@/lib/route-points";
import { type RouteStop } from "@/lib/route-stops";
import { useMemo } from "react";
import { Layer, Marker, Source } from "react-map-gl/maplibre";
import type { PlannedRoute } from "@/components/route-planner";

/** Tuyến + điểm xuất phát vẽ lên bản đồ — đặt BÊN TRONG <MapGL> */
/** id lớp bắt chạm của tuyến — khai vào `interactiveLayerIds` của <MapGL> */
export const ROUTE_HIT_LAYER = "fuel-route-hit";

export function RouteMapLayers({
  route,
  alongKm = null,
  pickedIdx = null,
}: {
  route: PlannedRoute | null;
  /** điểm đang chọn ở danh sách "Các điểm trên tuyến" (chỉ số trong `plan.waypoints`) */
  pickedIdx?: number | null;
  /*  Quãng tàu đã chạy dọc tuyến (km) — từ `projectOntoRoute` khi đang dẫn
      đường. null = chưa chạy ⇒ không chặng nào xám. */
  alongKm?: number | null;
}) {
  // useMemo giữ nguyên reference GeoJSON giữa các re-render của cha (bản đồ
  // re-render liên tục khi play animation) — không thì mỗi render là một lần
  // setData lên MapLibre dù tuyến không đổi
  /*  MỖI CHẶNG MỘT FEATURE, màu do `state` quyết định (2026-08-29g). Trước
      đây cả tuyến là MỘT LineString một màu: tuyến 4 chặng chỉ chặng 3 đè bãi
      cạn vẫn hiện một dải đỏ suốt từ bến, bà con đọc thành "cả đường này dữ".
      Cắt theo `stopWpIdx` rồi tô riêng thì cảnh báo trỏ đúng khúc.
      Tuyến MỘT chặng vẫn chạy đúng nhánh này (một feature) — không có nhánh
      thứ hai để lệch nhau. */
  const line = useMemo(() => {
    if (!route) return null;
    const wps = route.plan.waypoints;
    if (wps.length < 2) return null;

    /*  TÔ MÀU TỪNG KHÚC THẬT (2026-09-09): `segRisks` chấm mức nguy hiểm cho MỖI
        cặp waypoint (chỗ có sóng dữ/cạn), mịn hơn hẳn tô theo chặng chỗ-ghé —
        chuyến không có điểm ghé giữa trước đây chỉ một màu, nay đúng khúc nào dữ
        khúc đó đỏ. Gộp các khúc LIỀN NHAU cùng mức thành một feature cho nét
        liền (join tròn), chỉ đứt ở chỗ ĐỔI màu. */
    const seg = route.plan.segRisks;
    if (seg && seg.length === wps.length - 1) {
      const cum = cumulativeKmAt(
        wps,
        wps.map((_, i) => i),
      );
      // ĐÃ ĐI QUA = mốc CUỐI khúc đã ở sau lưng (xám nửa vời làm khúc đang đi
      // trông như đã xong nên chỉ xám khi qua trọn khúc).
      const stateAt = (k: number): string =>
        alongKm != null && cum[k + 1] != null && alongKm >= cum[k + 1]
          ? "passed"
          : seg[k];
      const feats = [];
      let runStart = 0;
      for (let k = 0; k < seg.length; k++) {
        const next = k + 1 < seg.length ? stateAt(k + 1) : null;
        if (next !== stateAt(k)) {
          feats.push({
            type: "Feature" as const,
            properties: { state: stateAt(k), legIdx: runStart },
            geometry: {
              type: "LineString" as const,
              coordinates: wps.slice(runStart, k + 2).map((w) => [w.lon, w.lat]),
            },
          });
          runStart = k + 1;
        }
      }
      return { type: "FeatureCollection" as const, features: feats };
    }

    /*  LÙI VỀ TÔ THEO CHẶNG (tuyến cũ/thiếu segRisks). Chưa tính được chặng ⇒
        vẽ NGUYÊN MỘT ĐƯỜNG xanh. Thà mất màu còn hơn mất tuyến. */
    const bounds = route.legBoundsKm ?? [];
    const legs = route.legs ?? [];
    const cuts =
      route.stopWpIdx.length === legs.length && legs.length > 0
        ? route.stopWpIdx
        : [wps.length - 1];
    const feats = [];
    let from = 0;
    for (let i = 0; i < cuts.length; i++) {
      const to = Math.min(Math.max(cuts[i], from + 1), wps.length - 1);
      const passed =
        alongKm != null && bounds[i] != null && alongKm >= bounds[i];
      feats.push({
        type: "Feature" as const,
        properties: {
          state: passed ? "passed" : (legs[i]?.risk ?? "blue"),
          legIdx: i,
        },
        geometry: {
          type: "LineString" as const,
          coordinates: wps.slice(from, to + 1).map((w) => [w.lon, w.lat]),
        },
      });
      from = to;
    }
    return { type: "FeatureCollection" as const, features: feats };
  }, [route, alongKm]);
  /*  CHỖ ĐỔI HƯỚNG (waypoint giữa, không phải chỗ ghé) — chấm tròn + số khớp
      danh sách "Các điểm trên tuyến". Chỗ ghé/điểm cuối đã có ghim riêng bên
      dưới, không chấm chồng. */
  /*  Số in cạnh chấm = `turnNo` của CHÍNH `routePointRows` mà danh sách dùng
      — một nguồn đánh số, hai chỗ không bao giờ lệch nhau. */
  const turnPts = useMemo(() => {
    if (!route) return null;
    const features = routePointRows(route.plan.waypoints, route.stopWpIdx)
      .filter((r) => r.kind === "turn")
      .map((r) => ({
        type: "Feature" as const,
        properties: { n: String(r.turnNo) },
        geometry: { type: "Point" as const, coordinates: [r.lon, r.lat] },
      }));
    return { type: "FeatureCollection" as const, features };
  }, [route]);
  if (!route || !line) return null;
  const picked =
    pickedIdx != null ? (route.plan.waypoints[pickedIdx] ?? null) : null;
  return (
    <>
      <Source id="fuel-route" type="geojson" data={line}>
        {/*  LỚP BẮT CHẠM — trong suốt, DÀY 22px (chủ dự án 2026-08-29g:
             *"từng khoảng màu ở trên tuyến thì trên bản đồ có thể click nhìn
             thấy info của từng đoạn"*). Nét vẽ chỉ 3,5-5px: bắt chạm đúng bề
             dày đó là bắt bà con chấm trúng một sợi chỉ trên tàu đang lắc.
             Đặt DƯỚI hai lớp nhìn được để không phủ màu lên chúng. */}
        <Layer
          id="fuel-route-hit"
          type="line"
          layout={{ "line-cap": "round", "line-join": "round" }}
          paint={{ "line-color": ROUTE_LINE_COLOR, "line-width": 22, "line-opacity": 0 }}
        />
        <Layer
          id="fuel-route-casing"
          type="line"
          layout={{ "line-cap": "round", "line-join": "round" }}
          paint={{
            "line-color": ROUTE_CASING_COLOR,
            "line-width": 7,
            "line-opacity": 0.85,
          }}
        />
        <Layer
          id="fuel-route-line"
          type="line"
          layout={{ "line-cap": "round", "line-join": "round" }}
          paint={{
            "line-color": [
              "match",
              ["get", "state"],
              "passed",
              ROUTE_LEG_PASSED,
              "red",
              ROUTE_LEG_RED,
              "amber",
              ROUTE_LEG_AMBER,
              ROUTE_LINE_COLOR,
            ],
            /*  Chặng đáng lo VẼ DÀY HƠN, chặng đã qua MỎNG hơn: nắng chói trên
                biển làm màu bạc đi rất nhanh, chỉ dựa vào màu là thua. Bề dày
                đọc được cả khi màn loá. */
            "line-width": [
              "match",
              ["get", "state"],
              "passed",
              2.5,
              "red",
              5,
              "amber",
              4.5,
              3.5,
            ],
            "line-opacity": [
              "match",
              ["get", "state"],
              "passed",
              0.55,
              1,
            ],
          }}
        />
      </Source>
      {turnPts && turnPts.features.length > 0 && (
        <Source id="fuel-route-pts" type="geojson" data={turnPts}>
          {/*  Xa (z<8) chỉ là chấm nhỏ cho thấy tuyến bẻ ở đâu; gần thì nở
               ra đủ chỗ in số — số nhỏ ở zoom xa chồng nhau thành vệt rác. */}
          <Layer
            id="fuel-route-pts-dot"
            type="circle"
            paint={{
              "circle-color": ROUTE_CASING_COLOR,
              "circle-stroke-color": ROUTE_LINE_COLOR,
              "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 5, 1.5, 8, 2.5],
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 3, 8, 10],
            }}
          />
          <Layer
            id="fuel-route-pts-num"
            type="symbol"
            minzoom={8}
            layout={{
              "text-field": ["get", "n"],
              "text-font": ["Noto Sans Bold"],
              "text-size": 12,
              "text-allow-overlap": true,
              "text-ignore-placement": true,
            }}
            paint={{ "text-color": ROUTE_LINE_COLOR }}
          />
        </Source>
      )}
      {picked && (
        <Marker
          longitude={picked.lon}
          latitude={picked.lat}
          anchor="center"
          style={{ pointerEvents: "none" }}
        >
          {/*  Vòng khoanh điểm vừa chạm trong danh sách — to hơn mọi ghim để
               nhìn một cái là thấy, rỗng ruột để không che số/ghim bên dưới. */}
          <span
            className="block h-14 w-14 rounded-full"
            style={{ boxShadow: `0 0 0 0.25rem ${ROUTE_LINE_COLOR}, 0 0 0 0.5rem ${ROUTE_CASING_COLOR}` }}
            aria-label="Điểm đang chọn"
          />
        </Marker>
      )}
      <Marker
        longitude={route.start.lon}
        latitude={route.start.lat}
        anchor="center"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-navy shadow-md ring-2 ring-navy">
          <AnchorIcon className="h-5 w-5" />
        </span>
      </Marker>
      {/*  ĐIỂM CUỐI LUÔN CÓ GHIM, VÀ GHIM KHÁC HẲN CHỖ GHÉ GIỮA ĐƯỜNG
          (chủ dự án 2026-08-29h: *"ko thấy điểm cuối"*).

          LỖI CŨ: chỉ vẽ ghim khi đường đi có ≥2 chỗ, với lý do "đi một chỗ thì
          con số 1 là thừa — ghim con trỏ đã nói rồi". Sai ở chỗ **ghim con trỏ
          đi chỗ khác được**: chạm bản đồ một cái là con trỏ nhảy sang nơi
          khác, còn tuyến vẫn nằm nguyên ⇒ vạch chạy ra giữa biển rồi HẾT, không
          có gì đánh dấu nó kết thúc ở đâu. Giữa biển thì đó là câu hỏi quan
          trọng nhất của cả màn.

          Nay: chỗ ghé GIỮA đường mang số (1, 2, 3…), ĐIỂM CUỐI mang ghim đích
          nền đặc + icon — nhìn một cái biết đâu là nơi mình định tới, không
          phải đếm số rồi so với danh sách trong thẻ. */}
      {route.stops.map((s, i) => {
        const cuoi = i === route.stops.length - 1;
        return (
          <Marker
            key={`${s.lat},${s.lon}`}
            longitude={s.lon}
            latitude={s.lat}
            anchor="center"
          >
            <span className="flex h-14 w-14 items-center justify-center">
              {cuoi ? (
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full text-white shadow-md"
                  style={{
                    background: ROUTE_LINE_COLOR,
                    boxShadow: `0 0 0 0.1875rem ${ROUTE_CASING_COLOR}`,
                  }}
                  aria-label="Điểm đến"
                >
                  <PinIcon className="h-6 w-6" />
                </span>
              ) : (
                <span
                  className="display flex h-10 w-10 items-center justify-center rounded-full bg-white text-[1rem] font-semibold shadow-md"
                  style={{
                    color: ROUTE_LINE_COLOR,
                    boxShadow: `0 0 0 0.1875rem ${ROUTE_LINE_COLOR}`,
                  }}
                >
                  {i + 1}
                </span>
              )}
            </span>
          </Marker>
        );
      })}
    </>
  );
}

/**
 * ĐƯỜNG NHÁP — các chỗ đã chấm nhưng CHƯA tính tuyến: nét đứt nối thẳng + số
 * mờ. Bà con thấy ngay mình đang chấm cái gì trước khi bấm tính. Xanh nét đứt
 * = "chưa phải tuyến đã tính" (tuyến thật là nét liền, cùng màu). Đặt BÊN
 * TRONG <MapGL>.
 *
 * `hidden` CHỈ nên bật khi tuyến đã tính còn khớp CẢ CHUỖI điểm
 * (`routeMatchesStops`) — lúc đó hai đường trùng nhau, vẽ chồng chỉ gây rối.
 * Tuyến lệch thì phải vẽ CẢ HAI để bà con thấy tận mắt chỗ lệch.
 */
export function RouteStopsLayers({
  stops,
  hidden,
  from = null,
  distUnit = "nm",
}: {
  stops: RouteStop[];
  hidden?: boolean;
  /*  Nơi XUẤT PHÁT đang chọn (vị trí tàu / cảng / chỗ đang xem) — để nhãn đầu
      tiên nói được "từ đây tới chỗ 1 bao xa" (chủ dự án 2026-08-29g). null =
      chưa biết ⇒ bỏ nhãn đầu, các nhãn giữa vẫn vẽ. */
  from?: LatLon | null;
  distUnit?: DistUnit;
}) {
  const line = useMemo(
    () =>
      stops.length >= 2
        ? {
            type: "Feature" as const,
            properties: {},
            geometry: {
              type: "LineString" as const,
              coordinates: stops.map((s) => [s.lon, s.lat]),
            },
          }
        : null,
    [stops],
  );
  /*  NHÃN KHOẢNG CÁCH GIỮA HAI CHỖ LIỀN NHAU, VẼ NGAY TRÊN ĐƯỜNG NHÁP
      (chủ dự án 2026-08-29g: *"lúc chọn điểm số 2 thì trên bản đồ show luôn
      khoảng cách từ vị trí hiện thời tới điểm 1, điểm 1 tới điểm dự kiến thứ
      2, điểm 3 thì show khoảng cách tới điểm 2"*).

      NÓI THẲNG LÀ "THẲNG": đây là đường chim bay giữa hai ghim, KHÔNG phải
      quãng tuyến đã tính (tuyến né cạn/sóng luôn dài hơn). Bỏ chữ "thẳng" đi
      là hứa một con số máy chưa tính — bà con tính dầu theo đó là thiếu dầu.
      Nhãn đặt ở TRUNG ĐIỂM đoạn, `pointer-events-none` để không cướp chạm của
      bản đồ bên dưới.
      GỌN 2026-10-22 (anh Long: "ko cần text… giao diện đơn giản"): chữ "đường
      chim bay" đổi thành dấu "~" đứng trước số — nét đứt + dấu xấp xỉ vẫn nói
      đây chưa phải quãng đã tính, mà không thêm một dòng chữ trên bản đồ. */
  const labels = useMemo(() => {
    const pts: LatLon[] = from ? [from, ...stops] : stops;
    const out: { key: string; lat: number; lon: number; text: string }[] = [];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      out.push({
        key: `${a.lat},${a.lon}->${b.lat},${b.lon}`,
        lat: (a.lat + b.lat) / 2,
        lon: (a.lon + b.lon) / 2,
        text: `~${fmtDist(haversineKm(a, b), distUnit)}`,
      });
    }
    return out;
  }, [from, stops, distUnit]);

  /*  Đoạn từ nơi xuất phát tới chỗ 1 cũng phải có NÉT, không chỉ có nhãn:
      nhãn treo giữa khoảng trống không nói được nó đo từ đâu tới đâu. */
  const leadLine = useMemo(
    () =>
      from && stops.length > 0
        ? {
            type: "Feature" as const,
            properties: {},
            geometry: {
              type: "LineString" as const,
              coordinates: [
                [from.lon, from.lat],
                [stops[0].lon, stops[0].lat],
              ],
            },
          }
        : null,
    [from, stops],
  );

  if (hidden || stops.length === 0) return null;
  return (
    <>
      {leadLine && (
        <Source id="route-draft-lead" type="geojson" data={leadLine}>
          <Layer
            id="route-draft-lead-line"
            type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{
              "line-color": ROUTE_LINE_COLOR,
              "line-width": 2.5,
              "line-opacity": 0.45,
              "line-dasharray": [1.5, 2],
            }}
          />
        </Source>
      )}
      {labels.map((l) => (
        <Marker
          key={l.key}
          longitude={l.lon}
          latitude={l.lat}
          anchor="center"
          style={{ pointerEvents: "none" }}
        >
          <span
            className="whitespace-nowrap rounded-full bg-white/90 px-2 py-0.5 text-[0.8125rem] font-semibold shadow-sm"
            style={{ color: ROUTE_LINE_COLOR }}
          >
            {l.text}
          </span>
        </Marker>
      ))}
      {line && (
        <Source id="route-draft" type="geojson" data={line}>
          <Layer
            id="route-draft-line"
            type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{
              "line-color": ROUTE_LINE_COLOR,
              "line-width": 2.5,
              "line-opacity": 0.7,
              "line-dasharray": [2, 1.6],
            }}
          />
        </Source>
      )}
      {stops.map((s, i) => (
        <Marker key={s.id} longitude={s.lon} latitude={s.lat} anchor="center">
          {/*  GHIM SỐ CHỈ ĐỂ NHÌN, KHÔNG BẤM ĐƯỢC — bỏ một chỗ là bấm nút trong
               danh sách của thẻ dưới. Lớp bọc "vùng chạm" của bản trước đã gỡ:
               nó là tap target giả cho một hành vi không tồn tại (Marker này
               chưa từng có onClick), mà comment cũ còn dạy sai rằng đây là cách
               DUY NHẤT bỏ một chỗ. */}
          <span
            className="display flex h-10 w-10 items-center justify-center rounded-full bg-white/85 text-[1rem] font-semibold shadow-md"
            style={{
              color: ROUTE_LINE_COLOR,
              boxShadow: `0 0 0 0.1875rem ${ROUTE_LINE_COLOR}`,
            }}
          >
            {i + 1}
          </span>
        </Marker>
      ))}
    </>
  );
}
