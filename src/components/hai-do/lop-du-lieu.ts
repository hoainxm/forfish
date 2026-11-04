/*
  CHẾ ĐỘ HẢI ĐỒ — DỰNG GEOJSON CHO CÁC LỚP BÁO HIỆU (2026-11-04, đợt 1). Thuần.

  Cùng luật với màn bản đồ cũ (fishing-map-view.tsx: seamarkGeo/seamarkTiers,
  denBienGeo, vnAidGeo, xacTauGeo): tách 3 tầng xa/vừa/gần, bỏ đèn OSM trùng
  đèn biển nhà nước trong 300 m, bỏ giàn khoan OSM (đã có ở sea-lanes).
  // nợ: trùng logic với 4 useMemo trong fishing-map-view.tsx (anh Long chốt màn cũ không đụng ở đợt 1); gộp màn cũ sang gọi file này khi có đợt sửa màn cũ.
*/

import { chartSymbolId, lighthouseSymbolId, tideSymbolId, wreckSymbolId } from "@/lib/chart-symbols";
import { isModelStation, tideDaySeries, tideHeightAt, tideTrendAt, vnIsoDate, type TideStation } from "@/lib/tides";
import { denOsmTrungDenBien, type DenBien } from "@/lib/den-bien";
import { fmtDepthM } from "@/lib/map-prefs";
import { lightAbbrev, type Seamark } from "@/lib/seamarks";
import type { VnAid } from "@/lib/vn-aids";
import type { XacTau } from "@/lib/xac-tau";
import { SEAMARK_AN, SEAMARK_FAR, SEAMARK_MID } from "@/components/ban-do/hai-do";

type FC = GeoJSON.FeatureCollection;
const fc = (features: GeoJSON.Feature[]): FC => ({ type: "FeatureCollection", features });
const diem = (lon: number, lat: number, properties: Record<string, unknown>): GeoJSON.Feature => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [lon, lat] },
  properties,
});

/** Báo hiệu OSM chia 3 tầng hiện theo nấc zoom. */
export function baoHieuTheoTang(list: readonly Seamark[], denBien: readonly DenBien[] | null): { far: FC; mid: FC; near: FC } {
  const trung = denOsmTrungDenBien(list as Seamark[], denBien as DenBien[] | null);
  const far: GeoJSON.Feature[] = [];
  const mid: GeoJSON.Feature[] = [];
  const near: GeoJSON.Feature[] = [];
  list.forEach((m, i) => {
    if (SEAMARK_AN.includes(m.type) || trung.has(i)) return;
    const f = diem(m.lon, m.lat, { i, t: m.type, ic: chartSymbolId(m) });
    (SEAMARK_FAR.includes(m.type) ? far : SEAMARK_MID.includes(m.type) ? mid : near).push(f);
  });
  return { far: fc(far), mid: fc(mid), near: fc(near) };
}

export function denBienGeo(list: readonly DenBien[]): FC {
  return fc(list.map((d, i) => diem(d.lon, d.lat, { i, ic: lighthouseSymbolId(d), ten: d.ten, dt: lightAbbrev(d.light) })));
}

export function vnAidGeo(list: readonly VnAid[]): FC {
  return fc(list.map((m, i) => diem(m.lon, m.lat, { i, ic: chartSymbolId(m, m.tacDung ?? undefined) })));
}

export function xacTauGeo(list: readonly XacTau[]): FC {
  return fc(
    list.map((x, i) =>
      diem(x.lon, x.lat, {
        i,
        ic: wreckSymbolId(x.loai, x.doSauVuotQua),
        nhan: typeof x.doSauVuotQua === "number" && x.doSauVuotQua > 0 ? fmtDepthM(x.doSauVuotQua) : "",
      }),
    ),
  );
}

/* ── TRẠM CON NƯỚC (đợt 3) — cùng ký hiệu + nhãn với màn cũ (tideSymbolId) ── */

export function tramTrieuGeo(list: readonly TideStation[], nowMs: number): FC {
  const chu = (t: ReturnType<typeof tideTrendAt>) => (t === "len" ? "đang lên" : t === "xuong" ? "đang xuống" : "nước đứng");
  const ngay = vnIsoDate(nowMs);
  return fc(
    list.map((s, i) => {
      const trend = tideTrendAt(s, nowMs);
      const ser = tideDaySeries(s, ngay, 60);
      const lo = Math.min(...ser);
      const hi = Math.max(...ser);
      const frac = hi > lo ? (tideHeightAt(s, nowMs) - lo) / (hi - lo) : NaN;
      const model = isModelStation(s);
      return diem(s.lon, s.lat, {
        i,
        ten: s.name,
        model: model ? 1 : 0,
        hang: s.hang ?? "vung",
        ic: tideSymbolId(trend, frac, model),
        nhan9: `${s.name} · ${chu(trend)}`,
      });
    }),
  );
}
