// SERVER-ONLY: kéo lưới vệ tinh NOAA + dựng dự báo cá (PFZ). Tách từ route
// /api/fish-forecast để dùng chung với collector lưu lịch sử (0005). Logic
// giữ nguyên: SST + phù du BẮT BUỘC; SSHA / dị thường nhiệt / dòng chảy /
// tầng nhiệt TUỲ CHỌN — thiếu thì chia lại trọng số. Nguồn fail → null.
import {
  anomGridUrl,
  buildFishForecast,
  chlGridUrl,
  currentGridUrl,
  parseErddapGrid,
  slaGridUrl,
  sstGridUrl,
  type CurrentGrids,
  type FishForecast,
  type ScalarGrid,
} from "@/lib/fish-predict";
import { fetchThermoclineGrid } from "@/lib/hycom";

export async function loadFishForecast(
  month: number,
): Promise<FishForecast | null> {
  try {
    const opt = { next: { revalidate: 21600 } };
    const thermoP = fetchThermoclineGrid().catch(() => null);
    const [sstRes, chlRes, slaRes, anomRes, uRes, vRes] = await Promise.all([
      fetch(sstGridUrl(), opt),
      fetch(chlGridUrl(), opt),
      fetch(slaGridUrl(), opt).catch(() => null),
      fetch(anomGridUrl(), opt).catch(() => null),
      fetch(currentGridUrl("u"), opt).catch(() => null),
      fetch(currentGridUrl("v"), opt).catch(() => null),
    ]);
    if (!sstRes.ok || !chlRes.ok) return null;

    const sst = parseErddapGrid(await sstRes.json(), {
      hasAltitude: false,
      kelvin: true,
    });
    const chl = parseErddapGrid(await chlRes.json(), { hasAltitude: true });
    if (sst.lats.length === 0 || chl.lats.length === 0) return null;

    const optionalGrid = async (
      res: Response | null,
    ): Promise<ScalarGrid | null> => {
      if (!res?.ok) return null;
      try {
        const g = parseErddapGrid(await res.json(), { hasAltitude: false });
        return g.lats.length > 0 ? g : null;
      } catch {
        return null;
      }
    };
    const [sla, anom, u, v] = await Promise.all([
      optionalGrid(slaRes),
      optionalGrid(anomRes),
      optionalGrid(uRes),
      optionalGrid(vRes),
    ]);
    const cur: CurrentGrids | null =
      u && v && u.lats.length === v.lats.length && u.lons.length === v.lons.length
        ? { u, v }
        : null;

    const thermo = await thermoP;
    return buildFishForecast(sst, chl, sla, month, { anom, cur, thermo });
  } catch {
    return null;
  }
}
