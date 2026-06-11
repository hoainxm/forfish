import {
  anomGridUrl,
  buildFishForecast,
  chlGridUrl,
  currentGridUrl,
  parseErddapGrid,
  slaGridUrl,
  sstGridUrl,
  type CurrentGrids,
  type ScalarGrid,
} from "@/lib/fish-predict";

/**
 * Dự báo cá (PFZ) — tính server: kéo lưới SST + phù du mới nhất từ nguồn
 * công khai (chậm, vài MB) rồi chấm điểm bằng lib thuần, trả về gọn cho app.
 * Cache 6 giờ — ảnh nguồn mỗi ngày một bản, không cần tươi hơn.
 * Nguồn fail → { ok:false }, client im lặng/fallback mùa vụ (không bịa).
 */
export async function GET() {
  try {
    // SST + phù du là BẮT BUỘC; SSHA (xoáy), dị thường nhiệt (nước trồi),
    // dòng chảy u/v (hội tụ) là TUỲ CHỌN — fail thì vẫn dự báo, chia lại trọng số
    const opt = { next: { revalidate: 21600 } };
    const [sstRes, chlRes, slaRes, anomRes, uRes, vRes] = await Promise.all([
      fetch(sstGridUrl(), opt),
      fetch(chlGridUrl(), opt),
      fetch(slaGridUrl(), opt).catch(() => null),
      fetch(anomGridUrl(), opt).catch(() => null),
      fetch(currentGridUrl("u"), opt).catch(() => null),
      fetch(currentGridUrl("v"), opt).catch(() => null),
    ]);
    if (!sstRes.ok || !chlRes.ok) return Response.json({ ok: false });

    const sst = parseErddapGrid(await sstRes.json(), {
      hasAltitude: false,
      kelvin: true,
    });
    const chl = parseErddapGrid(await chlRes.json(), { hasAltitude: true });
    if (sst.lats.length === 0 || chl.lats.length === 0) {
      return Response.json({ ok: false });
    }

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
    // u,v phải CÙNG có và cùng cỡ lưới mới tính hội tụ được
    const cur: CurrentGrids | null =
      u && v && u.lats.length === v.lats.length && u.lons.length === v.lons.length
        ? { u, v }
        : null;

    const month = new Date().getMonth() + 1;
    return Response.json(buildFishForecast(sst, chl, sla, month, { anom, cur }));
  } catch {
    return Response.json({ ok: false });
  }
}
